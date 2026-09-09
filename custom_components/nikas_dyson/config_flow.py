"""Robust source binding for six monitored devices."""
import logging

import voluptuous as vol
from homeassistant import config_entries
from homeassistant.core import callback
from homeassistant.helpers import entity_registry as er, selector

from .const import DOMAIN, NAME, PRESET_BY_ID, PRESETS

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

    async def async_step_source(self, user_input=None):
        preset = PRESET_BY_ID[self.device_key]
        errors = {}
        if user_input is not None:
            source = user_input.get("switch_entity") or None
            if source:
                for key, other in self.config_entry.options.get("devices", {}).items():
                    if key != self.device_key and other.get("switch_entity") == source:
                        errors["base"] = "duplicate_source"
                        break
            if not errors:
                devices = dict(self.config_entry.options.get("devices", {}))
                if source:
                    config = dict(self.previous)
                    source_changed = self.previous.get("switch_entity") != source
                    if source_changed:
                        config.pop("power_entity", None)
                        config.pop("energy_entity", None)
                        config.pop("presence_entity", None)
                    config.update({
                        "name": config.get("name", preset["name"]),
                        "switch_entity": source,
                        "kind": config.get("kind", preset["kind"]) if self.device_key == "lg" else preset["kind"],
                        "calibrated": bool(config.get("calibrated", False)),
                        "estimate_full": bool(config.get("estimate_full", False)),
                        "on_w": float(config.get("on_w", 5.0)),
                        "off_w": float(config.get("off_w", 2.0)),
                        "start_delay_s": float(config.get("start_delay_s", 30.0)),
                        "stop_delay_s": float(config.get("stop_delay_s", 180.0)),
                        "min_session_s": float(config.get("min_session_s", 300.0)),
                        "stale_after_s": float(config.get("stale_after_s", 1800.0)),
                    })
                    # Persist the resolved telemetry. It must survive integration and HA reloads.
                    resolved = _same_device_telemetry(self.hass, source)
                    for field in ("power_entity", "energy_entity"):
                        if field in resolved:
                            config[field] = resolved[field]
                    devices[self.device_key] = config
                else:
                    devices.pop(self.device_key, None)
                return self.async_create_entry(title="", data={"devices": devices})

        suggested = self.previous.get("switch_entity") or preset.get("suggested_switch")
        if suggested and not self.hass.states.get(suggested):
            suggested = None
        marker = vol.Optional("switch_entity", description={"suggested_value": suggested}) if suggested else vol.Optional("switch_entity")
        return self.async_show_form(
            step_id="source",
            data_schema=vol.Schema({marker: selector.EntitySelector(selector.EntitySelectorConfig(domain="switch"))}),
            errors=errors,
            description_placeholders={"device": preset["name"]},
        )
