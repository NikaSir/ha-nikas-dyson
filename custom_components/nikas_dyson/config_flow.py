"""Robust source binding for six monitored devices."""
import logging

import voluptuous as vol
from homeassistant import config_entries
from homeassistant.core import callback
from homeassistant.helpers import entity_registry as er, selector

from .const import DOMAIN, NAME, PRESET_BY_ID, PRESETS
from .engine import Profile, numeric

_LOGGER = logging.getLogger(__name__)


def _same_device_telemetry(hass, switch_entity):
    """Resolve unambiguous power/energy siblings and return persistent bindings."""
    result = {}
    if not switch_entity:
        return result
    try:
        registry = er.async_get(hass)
        plug = registry.async_get(switch_entity)
        if not plug or not plug.device_id:
            return result
        candidates = {"power": [], "energy": []}
        for item in er.async_entries_for_device(registry, plug.device_id):
            if item.disabled_by:
                continue
            state = hass.states.get(item.entity_id)
            if not state:
                continue
            device_class = state.attributes.get("device_class") or item.device_class or item.original_device_class
            unit = state.attributes.get("unit_of_measurement")
            if device_class == "power" and unit in {"W", "kW"}:
                candidates["power"].append(item.entity_id)
            elif device_class == "energy" and unit in {"Wh", "kWh"}:
                candidates["energy"].append(item.entity_id)
        if len(candidates["power"]) == 1:
            result["power_entity"] = candidates["power"][0]
        if len(candidates["energy"]) == 1:
            result["energy_entity"] = candidates["energy"][0]
    except Exception:
        _LOGGER.exception("Unable to resolve telemetry for %s", switch_entity)
    return result


class ConfigFlow(config_entries.ConfigFlow, domain=DOMAIN):
    VERSION = 1

    async def async_step_user(self, user_input=None):
        await self.async_set_unique_id(DOMAIN)
        self._abort_if_unique_id_configured()
        if user_input is not None:
            return self.async_create_entry(title=NAME, data={})
        return self.async_show_form(step_id="user", data_schema=vol.Schema({}))

    @staticmethod
    @callback
    def async_get_options_flow(config_entry):
        return OptionsFlow()


class OptionsFlow(config_entries.OptionsFlow):
    async def async_step_init(self, user_input=None):
        if user_input is not None:
            self.device_key = user_input["device"]
            self.previous = self.config_entry.options.get("devices", {}).get(self.device_key, {})
            return await self.async_step_source()
        options = [{"value": p["id"], "label": p["name"]} for p in PRESETS]
        return self.async_show_form(step_id="init", data_schema=vol.Schema({
            vol.Required("device"): selector.SelectSelector(selector.SelectSelectorConfig(options=options))
        }))

    def _save(self, config):
        options = dict(self.config_entry.options)
        devices = dict(options.get("devices", {}))
        devices[self.device_key] = config
        options["devices"] = devices
        return self.async_create_entry(title="", data=options)

    async def async_step_source(self, user_input=None):
        preset = PRESET_BY_ID[self.device_key]
        fields = ("switch_entity", "power_entity", "energy_entity", "presence_entity")
        errors = {}
        if user_input is not None:
            if not user_input.get("enabled", True):
                # A persistent, nonempty record suppresses preset discovery on reload.
                config = dict(self.previous)
                config.update(dict.fromkeys(fields))
                config.update(enabled=False, calibrated=False, estimate_full=False)
                return self._save(config)
            source = user_input.get("switch_entity") or None
            config = dict(self.previous)
            config.update(dict.fromkeys(fields))
            discover = user_input.get("discover_telemetry", True)
            if discover:
                config.update(_same_device_telemetry(self.hass, source))
            for field in fields:
                if user_input.get(field):
                    config[field] = user_input[field]
            config.update(enabled=True, discover_telemetry=discover)
            assigned = {config.get(field) for field in fields} - {None}
            for key, other in self.config_entry.options.get("devices", {}).items():
                if key != self.device_key and assigned.intersection(other.get(field) for field in fields):
                    errors["base"] = "duplicate_source"
                    break
            if not assigned:
                errors["base"] = "missing_source"
            if not errors:
                if any(config.get(field) != self.previous.get(field) for field in fields):
                    config.update(calibrated=False, estimate_full=False)
                config.setdefault("calibrated", False)
                config.setdefault("estimate_full", False)
                config.setdefault("name", preset["name"])
                config.setdefault("kind", preset["kind"])
                self.pending = config
                return await self.async_step_calibration()

        suggested = dict(self.previous if user_input is None else user_input)
        if not self.previous and user_input is None:
            switch = preset.get("suggested_switch")
            if switch and self.hass.states.get(switch):
                suggested["switch_entity"] = switch
        schema = {
            vol.Required("enabled", default=suggested.get("enabled", True)): bool,
            vol.Required("discover_telemetry", default=suggested.get("discover_telemetry", True)): bool,
        }
        for field in fields:
            marker = vol.Optional(field, description={"suggested_value": suggested[field]}) if suggested.get(field) else vol.Optional(field)
            domain = "switch" if field == "switch_entity" else "binary_sensor" if field == "presence_entity" else "sensor"
            schema[marker] = selector.EntitySelector(selector.EntitySelectorConfig(domain=domain))
        return self.async_show_form(step_id="source", data_schema=vol.Schema(schema), errors=errors,
                                    description_placeholders={"device": preset["name"]})

    async def async_step_calibration(self, user_input=None):
        defaults = {"on_w": 5.0, "off_w": 2.0, "start_delay_s": 30.0,
                    "stop_delay_s": 180.0, "min_session_s": 300.0, "stale_after_s": 1800.0}
        config = {**defaults, **self.pending}
        errors = {}
        if user_input is not None:
            config.update(user_input)
            if not user_input.get("tariff_enabled", config.get("tariff") is not None):
                config["tariff"] = None
            try:
                if user_input.get("tariff_enabled") and config.get("tariff") is None:
                    raise ValueError("Tariff is required when enabled")
                for field in defaults:
                    value = numeric(config[field])
                    if value is None:
                        raise ValueError("Invalid number")
                    config[field] = value
                if config.get("tariff") is not None:
                    value = numeric(config["tariff"])
                    if value is None:
                        raise ValueError("Invalid tariff")
                    config["tariff"] = value
                if config["stale_after_s"] <= 0:
                    raise ValueError("Invalid stale interval")
                Profile(**{field: config[field] for field in (
                    "kind", "calibrated", "estimate_full", "on_w", "off_w", "start_delay_s",
                    "stop_delay_s", "min_session_s")}, tariff=config.get("tariff"))
            except (ValueError, TypeError):
                errors["base"] = "invalid_calibration"
            if not errors:
                config.pop("tariff_enabled", None)
                return self._save(config)
        schema = {
            vol.Required("calibrated", default=config["calibrated"]): bool,
            vol.Required("estimate_full", default=config["estimate_full"]): bool,
        }
        if self.device_key == "lg":
            schema[vol.Required("kind", default=config["kind"])] = selector.SelectSelector(
                selector.SelectSelectorConfig(options=["charger", "appliance"]))
        for field in defaults:
            schema[vol.Required(field, default=config[field])] = vol.Coerce(float)
        schema[vol.Required("tariff_enabled", default=config.get("tariff") is not None)] = bool
        schema[vol.Optional("tariff", description={"suggested_value": config.get("tariff")})] = vol.Coerce(float)
        return self.async_show_form(step_id="calibration", data_schema=vol.Schema(schema), errors=errors,
                                    description_placeholders={"device": PRESET_BY_ID[self.device_key]["name"]})
