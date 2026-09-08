"""Simple, robust source binding for six monitored devices."""
import voluptuous as vol
from homeassistant import config_entries
from homeassistant.core import callback
from homeassistant.helpers import selector

from .const import DOMAIN, NAME, PRESET_BY_ID, PRESETS


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
    """Bind one HA outlet per logical appliance.

    The first-run flow deliberately stops after this single binding. Power and
    energy siblings are discovered by the coordinator from the selected HA
    device. Calibration is kept separate from source binding so an optional or
    malformed advanced field can never block the basic setup.
    """

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
                    # A changed outlet must not retain sensors belonging to the old device.
                    if self.previous.get("switch_entity") != source:
                        config.pop("power_entity", None)
                        config.pop("energy_entity", None)
                        config.pop("presence_entity", None)
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
            data_schema=vol.Schema({
                marker: selector.EntitySelector(selector.EntitySelectorConfig(domain="switch"))
            }),
            errors=errors,
            description_placeholders={"device": preset["name"]},
        )
