"""Exercise the real options flow; isolate only Home Assistant's UI/runtime boundary."""
import asyncio
import importlib.util
from pathlib import Path
import sys
from types import ModuleType, SimpleNamespace

import pytest

ROOT = Path(__file__).parents[1] / "custom_components" / "nikas_dyson"


@pytest.fixture
def flow_factory(monkeypatch):
    class FlowBoundary:
        def __init_subclass__(cls, **kwargs):
            pass

        def async_show_form(self, **kwargs):
            return {"type": "form", **kwargs}

        def async_create_entry(self, **kwargs):
            return {"type": "create_entry", **kwargs}

    class Selector:
        def __init__(self, config=None):
            self.config = config

        def __call__(self, value):
            return value

    modules = {name: ModuleType(name) for name in (
        "homeassistant", "homeassistant.core", "homeassistant.helpers",
        "homeassistant.helpers.entity_registry", "homeassistant.helpers.selector",
        "dyson_options_test",
    )}
    modules["homeassistant"].config_entries = SimpleNamespace(ConfigFlow=FlowBoundary, OptionsFlow=FlowBoundary)
    modules["homeassistant.core"].callback = lambda fn: fn
    modules["dyson_options_test"].__path__ = [str(ROOT)]
    selectors = modules["homeassistant.helpers.selector"]
    for name in ("Entity", "Select", "Number", "Boolean", "Text"):
        setattr(selectors, name + "Selector", Selector)
        setattr(selectors, name + "SelectorConfig", lambda **kw: kw)
    registry = modules["homeassistant.helpers.entity_registry"]
    registry.async_get = lambda hass: hass.registry
    registry.async_entries_for_device = lambda reg, device: [x for x in reg.values() if x.device_id == device]
    for name, module in modules.items():
        monkeypatch.setitem(sys.modules, name, module)
    for name in ("const", "engine", "config_flow"):
        qualified = "dyson_options_test." + name
        spec = importlib.util.spec_from_file_location(qualified, ROOT / (name + ".py"))
        module = importlib.util.module_from_spec(spec)
        monkeypatch.setitem(sys.modules, qualified, module)
        spec.loader.exec_module(module)
    flow_cls = sys.modules["dyson_options_test.config_flow"].OptionsFlow

    def make(previous=None, others=None, discovery=None, key="dyson_v15"):
        devices = dict(others or {})
        if previous is not None:
            devices[key] = previous
        flow = flow_cls()
        flow.config_entry = SimpleNamespace(options={"devices": devices, "unrelated": "keep"})
        entries = {}
        states = {}
        for entity, kind, unit in discovery or []:
            entries[entity] = SimpleNamespace(entity_id=entity, device_id="plug", disabled_by=None,
                                             device_class=kind, original_device_class=kind)
            states[entity] = SimpleNamespace(state="on", attributes={"device_class": kind, "unit_of_measurement": unit})
        flow.hass = SimpleNamespace(states=SimpleNamespace(get=states.get), registry=SimpleNamespace(
            async_get=entries.get, values=entries.values))
        asyncio.run(flow.async_step_init({"device": key}))
        return flow
    return make


def submit(flow, source, calibration=None):
    result = asyncio.run(flow.async_step_source(source))
    assert result["type"] == "form" and result["step_id"] == "calibration"
    if calibration is None:
        return result
    return asyncio.run(flow.async_step_calibration(calibration))


def test_manual_source_and_explicit_calibration(flow_factory):
    flow = flow_factory()
    form = asyncio.run(flow.async_step_source())
    assert {"power_entity", "energy_entity", "presence_entity"} <= {str(k) for k in form["data_schema"].schema}
    result = submit(flow, {"power_entity": "sensor.manual", "energy_entity": "sensor.meter", "presence_entity": "binary_sensor.dock"},
                    {"calibrated": True, "on_w": 8, "off_w": 1, "estimate_full": True, "tariff": 6.5})
    cfg = result["data"]["devices"]["dyson_v15"]
    assert cfg["power_entity"] == "sensor.manual"
    assert cfg["presence_entity"] == "binary_sensor.dock"
    assert cfg["calibrated"] is True and cfg["tariff"] == 6.5
    assert result["data"]["unrelated"] == "keep"


def test_manual_binding_wins_over_discovery(flow_factory):
    flow = flow_factory(discovery=[("switch.plug", None, None), ("sensor.auto", "power", "W")])
    result = submit(flow, {"switch_entity": "switch.plug", "power_entity": "sensor.manual"}, {})
    assert result["data"]["devices"]["dyson_v15"]["power_entity"] == "sensor.manual"


def test_previous_values_survive_same_source(flow_factory):
    previous = {"switch_entity": "switch.plug", "power_entity": "sensor.manual", "on_w": 9,
                "off_w": 1, "tariff": 7, "calibrated": True, "estimate_full": True}
    result = submit(flow_factory(previous), {"switch_entity": "switch.plug", "power_entity": "sensor.manual"}, {})
    cfg = result["data"]["devices"]["dyson_v15"]
    assert all(cfg[k] == v for k, v in previous.items())


@pytest.mark.parametrize("source", [{"switch_entity": "switch.new"}, {"switch_entity": "switch.old", "power_entity": "sensor.new"}])
def test_changed_source_requires_new_confirmation(flow_factory, source):
    previous = {"switch_entity": "switch.old", "power_entity": "sensor.old", "calibrated": True, "estimate_full": True}
    result = submit(flow_factory(previous), source, {})
    cfg = result["data"]["devices"]["dyson_v15"]
    assert cfg["calibrated"] is False and cfg["estimate_full"] is False
    if source["switch_entity"] == "switch.new":
        assert cfg.get("power_entity") != "sensor.old"


@pytest.mark.parametrize("field,value", [("on_w", 2), ("off_w", -1), ("on_w", float("nan")),
    ("start_delay_s", 0), ("stop_delay_s", -1), ("min_session_s", float("inf")),
    ("stale_after_s", 0), ("tariff", -1), ("tariff", float("nan"))])
def test_reject_invalid_profile(flow_factory, field, value):
    result = submit(flow_factory(), {"power_entity": "sensor.power"}, {field: value})
    assert result["type"] == "form" and result["errors"]


@pytest.mark.parametrize("field", ["switch_entity", "power_entity", "energy_entity", "presence_entity"])
def test_reject_duplicate_bindings(flow_factory, field):
    flow = flow_factory(others={"lg": {field: "sensor.shared"}})
    result = asyncio.run(flow.async_step_source({field: "sensor.shared"}))
    assert result["type"] == "form" and result["errors"]["base"] == "duplicate_source"


def test_disable_preset_survives_reload(flow_factory):
    result = asyncio.run(flow_factory({"switch_entity": "switch.old", "calibrated": True}).async_step_source({"enabled": False}))
    cfg = result["data"]["devices"]["dyson_v15"]
    assert cfg and not cfg.get("switch_entity") and not cfg.get("power_entity")
    assert cfg["calibrated"] is False
    form = asyncio.run(flow_factory(cfg).async_step_source())
    assert not any((getattr(k, "description", None) or {}).get("suggested_value") == "switch.socket_zb_24" for k in form["data_schema"].schema)


def test_tariff_requires_value_when_enabled(flow_factory):
    result = submit(flow_factory(), {"power_entity": "sensor.power"}, {"tariff_enabled": True})
    assert result["type"] == "form" and result["errors"]


def test_clear_tariff_and_automatic_telemetry(flow_factory):
    previous = {"switch_entity": "switch.plug", "power_entity": "sensor.power", "energy_entity": "sensor.meter", "tariff": 6}
    flow = flow_factory(previous, discovery=[("switch.plug", None, None), ("sensor.meter", "energy", "kWh")])
    result = submit(flow, {"switch_entity": "switch.plug", "power_entity": "sensor.power", "discover_telemetry": False}, {"tariff_enabled": False})
    cfg = result["data"]["devices"]["dyson_v15"]
    assert cfg["energy_entity"] is None and cfg["tariff"] is None


def test_form_defaults_support_unchanged_profile_submission(flow_factory):
    flow = flow_factory({"power_entity": "sensor.power", "on_w": 10, "off_w": 1, "calibrated": True, "tariff": 7})
    form = submit(flow, {"power_entity": "sensor.power"})
    data = form["data_schema"]({"tariff": 7})
    result = asyncio.run(flow.async_step_calibration(data))
    cfg = result["data"]["devices"]["dyson_v15"]
    assert cfg["calibrated"] is True and cfg["on_w"] == 10 and cfg["tariff"] == 7
