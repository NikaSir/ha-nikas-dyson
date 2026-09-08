"""One integration, six independently configured devices. No guessed sensors."""
import voluptuous as vol
from homeassistant import config_entries
from homeassistant.core import callback
from homeassistant.helpers import entity_registry as er, selector

from .const import DOMAIN, NAME, PRESET_BY_ID, PRESETS
from .engine import Profile


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
        if user_input is not None:
            self.source = user_input.get("switch_entity") or None
            return await self.async_step_device()
        preset = PRESET_BY_ID[self.device_key]
        suggested = self.previous.get("switch_entity") or preset.get("suggested_switch")
        if suggested and not self.hass.states.get(suggested):
            suggested = None
        field = vol.Optional("switch_entity", description={"suggested_value": suggested} if suggested else {})
        return self.async_show_form(step_id="source", data_schema=vol.Schema({
            field: selector.EntitySelector(selector.EntitySelectorConfig(domain=["switch"]))
        }), description_placeholders={"device": preset["name"]})

    def _associated(self, kind):
        registry = er.async_get(self.hass)
        plug = registry.async_get(self.source) if self.source else None
        if not plug or not plug.device_id:
            return None
        found = []
        for item in er.async_entries_for_device(registry, plug.device_id):
            state = self.hass.states.get(item.entity_id)
            if not item.disabled_by and state and state.attributes.get("device_class") == kind:
                found.append(item.entity_id)
        return found[0] if len(found) == 1 else None

    def _validate(self, cfg):
        try:
            Profile(kind=cfg.get("kind", PRESET_BY_ID[self.device_key]["kind"]),
                    on_w=cfg["on_w"], off_w=cfg["off_w"],
                    start_delay_s=cfg["start_delay_s"], stop_delay_s=cfg["stop_delay_s"],
                    min_session_s=cfg["min_session_s"], tariff=cfg.get("tariff"))
        except (ValueError, TypeError):
            return "invalid_thresholds"
        registry = er.async_get(self.hass)
        plug = registry.async_get(self.source) if self.source else None
        for key, units in (("power_entity", {"W", "kW"}), ("energy_entity", {"Wh", "kWh"})):
            entity_id = cfg.get(key)
            if not entity_id:
                continue
            state = self.hass.states.get(entity_id)
            if state is None:
                return "entity_not_found"
            if state.attributes.get("unit_of_measurement") not in units:
                return "invalid_unit"
            entry = registry.async_get(entity_id)
            if plug and entry and plug.device_id and entry.device_id and plug.device_id != entry.device_id:
                return "different_device"
        for key, other in self.config_entry.options.get("devices", {}).items():
            if key != self.device_key and (other.get("power_entity") == cfg["power_entity"]
                    or (self.source and other.get("switch_entity") == self.source)):
                return "duplicate_source"
        return None

    async def async_step_device(self, user_input=None):
        preset = PRESET_BY_ID[self.device_key]
        errors = {}
        if user_input is not None:
            config = dict(user_input)
            if self.source:
                config["switch_entity"] = self.source
            config["kind"] = config.get("kind", preset["kind"]) if self.device_key == "lg" else preset["kind"]
            config["estimate_full"] = bool(config.get("estimate_full", False)) and config["kind"] == "charger"
            error = self._validate(config)
            if error:
                errors["base"] = error
            else:
                devices = dict(self.config_entry.options.get("devices", {}))
                devices[self.device_key] = config
                return self.async_create_entry(title="", data={"devices": devices})
        previous = user_input or self.previous
        schema = {vol.Required("name", default=previous.get("name", preset["name"])): str}
        for key, kind, required in (("power_entity", "power", True), ("energy_entity", "energy", False)):
            suggested = previous.get(key) or self._associated(kind)
            mark = vol.Required if required else vol.Optional
            schema[mark(key, description={"suggested_value": suggested} if suggested else {})] = selector.EntitySelector(
                selector.EntitySelectorConfig(domain=["sensor"], device_class=[kind]))
        if self.device_key == "lg":
            schema[vol.Required("kind", default=previous.get("kind", "appliance"))] = selector.SelectSelector(
                selector.SelectSelectorConfig(options=[{"value": "appliance", "label": "Потребление розетки"},
                                                       {"value": "charger", "label": "Зарядка аккумуляторного пылесоса"}]))
        if preset["kind"] == "charger" or self.device_key == "lg":
            schema[vol.Optional("presence_entity", description={"suggested_value": previous.get("presence_entity")})] = selector.EntitySelector(
                selector.EntitySelectorConfig(domain=["binary_sensor"]))
            schema[vol.Required("estimate_full", default=previous.get("estimate_full", False))] = bool
        schema[vol.Required("calibrated", default=previous.get("calibrated", False))] = bool
        for key, default, minimum, maximum in (
                ("on_w", 5, 0.1, 5000), ("off_w", 2, 0, 4999),
                ("start_delay_s", 30, 1, 3600), ("stop_delay_s", 180, 1, 7200),
                ("min_session_s", 300, 1, 86400), ("stale_after_s", 1800, 60, 86400)):
            schema[vol.Required(key, default=previous.get(key, default))] = vol.All(vol.Coerce(float), vol.Range(min=minimum, max=maximum))
        schema[vol.Optional("tariff", description={"suggested_value": previous.get("tariff")})] = vol.All(vol.Coerce(float), vol.Range(min=0, max=10000))
        return self.async_show_form(step_id="device", data_schema=vol.Schema(schema), errors=errors,
                                    description_placeholders={"device": preset["name"]})
