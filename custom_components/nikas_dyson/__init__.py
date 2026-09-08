"""NikaS read-only appliance monitor and integration-owned panel."""
from pathlib import Path

import voluptuous as vol
from homeassistant.auth.permissions.const import POLICY_READ
from homeassistant.components import frontend, panel_custom, websocket_api
from homeassistant.components.http import StaticPathConfig
from homeassistant.const import Platform
from homeassistant.core import callback
from homeassistant.exceptions import HomeAssistantError

from .const import DOMAIN, NAME, PANEL_PATH, UI_VERSION
from .coordinator import MonitorCoordinator

PLATFORMS = [Platform.SENSOR]


async def async_setup_entry(hass, entry):
    domain_data = hass.data.setdefault(DOMAIN, {})
    if frontend.async_panel_exists(hass, PANEL_PATH):
        raise HomeAssistantError(f"Route /{PANEL_PATH} is already owned by another panel")
    manager = MonitorCoordinator(hass, entry)
    await manager.async_start()
    domain_data["manager"] = manager
    try:
        if not domain_data.get("static_registered"):
            await hass.http.async_register_static_paths([
                StaticPathConfig("/nikas_dyson_static", str(Path(__file__).parent / "frontend"), False)
            ])
            domain_data["static_registered"] = True
        if not domain_data.get("websocket_registered"):
            websocket_api.async_register_command(hass, websocket_snapshot)
            domain_data["websocket_registered"] = True
        await hass.config_entries.async_forward_entry_setups(entry, PLATFORMS)
        await panel_custom.async_register_panel(
            hass=hass, frontend_url_path=PANEL_PATH, webcomponent_name="nikas-dyson-panel",
            sidebar_title="Техника", sidebar_icon="mdi:power-plug-outline",
            module_url=f"/nikas_dyson_static/nikas-dyson-panel-v101.js?v={UI_VERSION}",
            embed_iframe=False, require_admin=False, handle_safe_area=True,
            config={"owner": DOMAIN, "entry_id": entry.entry_id, "ui_version": UI_VERSION,
                    "parent_route": "/dashboard-actions/home", "title": "Техника"},
        )
        domain_data["panel_owned"] = True
    except Exception:
        await hass.config_entries.async_unload_platforms(entry, PLATFORMS)
        await manager.async_stop()
        domain_data.pop("manager", None)
        raise
    entry.async_on_unload(entry.add_update_listener(_async_reload))
    return True


async def _async_reload(hass, entry):
    await hass.config_entries.async_reload(entry.entry_id)


async def async_unload_entry(hass, entry):
    if not await hass.config_entries.async_unload_platforms(entry, PLATFORMS):
        return False
    data = hass.data[DOMAIN]
    manager = data.pop("manager", None)
    if manager:
        await manager.async_stop()
    if data.pop("panel_owned", False):
        frontend.async_remove_panel(hass, PANEL_PATH, warn_if_unknown=False)
    return True


@websocket_api.websocket_command({vol.Required("type"): "nikas_dyson/snapshot"})
@callback
def websocket_snapshot(hass, connection, msg):
    manager = hass.data.get(DOMAIN, {}).get("manager")
    if manager is None:
        connection.send_error(msg["id"], "not_ready", f"{NAME} is not loaded")
        return
    manager.sample()
    devices = []
    for item in manager.data.values():
        if not all(connection.user.permissions.check_entity(entity, POLICY_READ)
                   for entity in item["sources"].values() if entity):
            devices.append({"id": item["id"], "label": item["label"], "name": item["label"],
                            "kind": item["kind"], "icon": item["icon"], "status": "restricted", "issue": "restricted"})
        else:
            devices.append(item)
    connection.send_result(msg["id"], {"devices": devices, "ui_version": UI_VERSION,
                                      "entry_id": manager.entry.entry_id,
                                      "refresh_scope": "home_assistant_snapshot"})
