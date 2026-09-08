"""Persistent monitoring metrics, not direct Dyson/LG battery telemetry."""
from homeassistant.components.sensor import SensorDeviceClass, SensorEntity, SensorStateClass
from homeassistant.helpers.device_registry import DeviceInfo
from homeassistant.helpers.update_coordinator import CoordinatorEntity

from .const import DOMAIN, PRESETS

METRICS = (
    ("status", "Состояние", None, None, None),
    ("power_w", "Мощность", "W", SensorDeviceClass.POWER, SensorStateClass.MEASUREMENT),
    ("total_kwh", "Учтённая энергия", "kWh", SensorDeviceClass.ENERGY, SensorStateClass.TOTAL_INCREASING),
    ("today_kwh", "Энергия сегодня", "kWh", SensorDeviceClass.ENERGY, SensorStateClass.TOTAL_INCREASING),
    ("month_kwh", "Энергия за месяц", "kWh", SensorDeviceClass.ENERGY, SensorStateClass.TOTAL_INCREASING),
    ("year_kwh", "Энергия за год", "kWh", SensorDeviceClass.ENERGY, SensorStateClass.TOTAL_INCREASING),
    ("sessions", "Обнаружено сеансов", None, None, SensorStateClass.TOTAL_INCREASING),
)


async def async_setup_entry(hass, entry, async_add_entities):
    manager = hass.data[DOMAIN]["manager"]
    async_add_entities(MonitorSensor(manager, entry, preset, metric)
                       for preset in PRESETS for metric in METRICS)


class MonitorSensor(CoordinatorEntity, SensorEntity):
    _attr_has_entity_name = True

    def __init__(self, manager, entry, preset, metric):
        super().__init__(manager)
        self.device_key = preset["id"]
        key, name, unit, device_class, state_class = metric
        self.metric_key = key
        self._attr_unique_id = f"{entry.entry_id}_{self.device_key}_{key}"
        self._attr_name = name
        self._attr_native_unit_of_measurement = unit
        self._attr_device_class = device_class
        self._attr_state_class = state_class
        self._attr_device_info = DeviceInfo(
            identifiers={(DOMAIN, self.device_key)}, name=manager.settings.get(self.device_key, {}).get("name", preset["name"]),
            manufacturer="NikaS", model="Наблюдение по розетке",
        )
        self._attr_icon = preset["icon"] if key == "status" else None
        if unit:
            self._attr_suggested_display_precision = 1 if unit == "W" else 4

    @property
    def native_value(self):
        data = self.coordinator.data.get(self.device_key, {})
        if self.metric_key == "sessions" and data.get("started_at") is None:
            return None
        return data.get(self.metric_key)

    @property
    def extra_state_attributes(self):
        data = self.coordinator.data.get(self.device_key, {})
        result = {"energy_method": data.get("energy_method"), "incomplete": data.get("incomplete"),
                  "source_reported_at": data.get("source_reported_at")}
        if self.metric_key == "status":
            result.update({"calibrated": data.get("calibrated"), "source_issue": data.get("issue"),
                           "power_entity": data.get("sources", {}).get("power_entity"),
                           "battery_percentage_available": False})
        return result
