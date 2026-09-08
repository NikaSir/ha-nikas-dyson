"""Observe existing HA entities; this integration sends no device commands."""
from __future__ import annotations

from datetime import timedelta
from copy import deepcopy
import logging

from homeassistant.core import callback
from homeassistant.helpers.event import async_track_state_change_event, async_track_time_interval
from homeassistant.helpers.storage import Store
from homeassistant.helpers.update_coordinator import DataUpdateCoordinator
from homeassistant.util import dt as dt_util

from .const import DOMAIN, PRESETS
from .engine import Profile, Tracker, normalized

_LOGGER = logging.getLogger(__name__)
INVALID = {"unknown", "unavailable"}


class MonitorCoordinator(DataUpdateCoordinator):
    def __init__(self, hass, entry):
        super().__init__(hass, _LOGGER, name=DOMAIN)
        self.entry = entry
        self.settings = entry.options.get("devices", {})
        self.store = Store(hass, 1, f"{DOMAIN}.{entry.entry_id}")
        self.trackers = {}
        self._unsubs = []
        self._save_pending = False
        self._saved_fingerprint = None

    async def async_start(self):
        saved = await self.store.async_load() or {}
        for preset in PRESETS:
            key = preset["id"]
            cfg = self.settings.get(key, {})
            profile = Profile(
                kind=cfg.get("kind", preset["kind"]) if key == "lg" else preset["kind"], calibrated=cfg.get("calibrated", False),
                on_w=float(cfg.get("on_w", 5)), off_w=float(cfg.get("off_w", 2)),
                start_delay_s=float(cfg.get("start_delay_s", 30)),
                stop_delay_s=float(cfg.get("stop_delay_s", 180)),
                min_session_s=float(cfg.get("min_session_s", 300)),
                estimate_full=cfg.get("estimate_full", False),
                meter=bool(cfg.get("energy_entity")), tariff=cfg.get("tariff"),
                timezone=self.hass.config.time_zone,
            )
            self.trackers[key] = Tracker(profile, saved.get(key))
        ids = sorted({entity for cfg in self.settings.values() for key, entity in cfg.items()
                      if key.endswith("_entity") and entity})
        if ids:
            self._unsubs.append(async_track_state_change_event(self.hass, ids, self._changed))
        self._unsubs.append(async_track_time_interval(self.hass, self._changed, timedelta(seconds=15)))
        self.sample()

    async def _async_update_data(self):
        self.sample()
        return self.data

    @callback
    def _changed(self, _event):
        self.sample()

    def _entity(self, entity_id):
        state = self.hass.states.get(entity_id) if entity_id else None
        if state is None or state.state in INVALID or state.attributes.get("restored", False):
            return None
        return state

    @callback
    def sample(self):
        now = dt_util.utcnow().timestamp()
        data = {}
        for preset in PRESETS:
            key = preset["id"]
            cfg = self.settings.get(key, {})
            tracker = self.trackers[key]
            pstate = self._entity(cfg.get("power_entity"))
            power = normalized(pstate.state, pstate.attributes.get("unit_of_measurement"), "power") if pstate else None
            estate = self._entity(cfg.get("energy_entity"))
            energy = normalized(estate.state, estate.attributes.get("unit_of_measurement"), "energy") if estate else None
            sstate = self._entity(cfg.get("switch_entity"))
            dstate = self._entity(cfg.get("presence_entity"))
            reported = getattr(pstate, "last_reported", pstate.last_updated).timestamp() if pstate else None
            age = max(0, now - reported) if reported is not None else None
            stale_after = float(cfg.get("stale_after_s", 1800))
            issue = None
            if not cfg.get("power_entity"):
                issue = "not_configured"
            elif pstate is None:
                raw = self.hass.states.get(cfg["power_entity"])
                issue = "unavailable" if raw is not None and raw.state == "unavailable" else "no_data"
            elif power is None:
                issue = "invalid_unit"
            elif age is not None and age > stale_after:
                issue = "stale"
            elif cfg.get("switch_entity") and (sstate is None or sstate.state not in {"on", "off"}):
                raw_switch = self.hass.states.get(cfg["switch_entity"])
                issue = "unavailable" if raw_switch is not None and raw_switch.state == "unavailable" else "no_data"
            elif cfg.get("presence_entity") and (dstate is None or dstate.state not in {"on", "off"}):
                issue = "no_data"
            tracker.observe(now, power, energy, issue=issue,
                            switch=sstate.state if sstate else None,
                            present=(dstate.state == "on") if dstate else None)
            result = tracker.snapshot(now)
            result.update({
                "id": key, "label": preset["label"], "name": cfg.get("name", preset["name"]),
                "kind": tracker.profile.kind, "icon": preset["icon"],
                "sources": {field: cfg.get(field) for field in ("power_entity", "energy_entity", "switch_entity", "presence_entity")},
                "source_reported_at": reported, "source_age_s": age, "issue": issue,
                "energy_missing": bool(cfg.get("energy_entity")) and energy is None,
                "calibrated": cfg.get("calibrated", False), "estimate_full": cfg.get("estimate_full", False),
                "tariff": cfg.get("tariff"), "currency": "₽",
                "thresholds": {"on_w": cfg.get("on_w", 5), "off_w": cfg.get("off_w", 2),
                               "start_delay_s": cfg.get("start_delay_s", 30), "stop_delay_s": cfg.get("stop_delay_s", 180)},
            })
            data[key] = result
        self.async_set_updated_data(data)
        if not self._save_pending and self._fingerprint() != self._saved_fingerprint:
            self._save_pending = True
            self.store.async_delay_save(self._save_data, 60)

    def _fingerprint(self):
        return tuple((t.total, t.cost, t.priced_energy, t.sessions, t.resets, t.incomplete,
                      t.started_at, len(t.days), len(t.history),
                      t.history[-1]["end"] if t.history else None,
                      t.last_t if t.active else None) for t in self.trackers.values())

    @callback
    def _save_data(self):
        self._save_pending = False
        self._saved_fingerprint = self._fingerprint()
        return deepcopy({key: tracker.dump() for key, tracker in self.trackers.items()})

    async def async_stop(self):
        for unsubscribe in self._unsubs:
            unsubscribe()
        self._unsubs.clear()
        await self.store.async_save(self._save_data())
