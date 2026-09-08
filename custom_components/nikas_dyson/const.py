"""Names and six stable logical devices; no invented sensor bindings."""

DOMAIN = "nikas_dyson"
NAME = "NikaS Dyson"
VERSION = "0.1.3"
UI_VERSION = "1.0.1"
PANEL_PATH = "dashboard-dyson"
PRESETS = (
    {"id": "dyson_v15", "label": "V15", "name": "Dyson V15 · Гардероб", "kind": "charger", "icon": "mdi:vacuum-outline", "suggested_switch": "switch.socket_zb_24"},
    {"id": "dyson_v12", "label": "V12", "name": "Dyson V12 · Кухня", "kind": "charger", "icon": "mdi:vacuum-outline", "suggested_switch": "switch.socket_zb_22"},
    {"id": "dyson_v8", "label": "V8", "name": "Dyson V8 · Гараж", "kind": "charger", "icon": "mdi:vacuum-outline", "suggested_switch": "switch.socket_zb_4"},
    {"id": "lg", "label": "LG", "name": "Пылесос LG", "kind": "appliance", "icon": "mdi:vacuum-outline"},
    {"id": "s8_socket", "label": "S8", "name": "S8 · розетка", "kind": "appliance", "icon": "mdi:robot-vacuum"},
    {"id": "massage_chair", "label": "Кресло", "name": "Массажное кресло", "kind": "chair", "icon": "mdi:seat"},
)
PRESET_BY_ID = {item["id"]: item for item in PRESETS}
