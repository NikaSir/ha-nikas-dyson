"""HA-independent, conservative power/session accounting.

Meter deltas are preferred. Without a meter, left-rectangle integration is an
estimate. Missing samples never become zero or a successful charging finish.
All timestamps are UTC epoch seconds; daily buckets use the HA time zone.
"""
from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, time, timedelta
import math
from typing import Any
from zoneinfo import ZoneInfo


def numeric(value: Any) -> float | None:
    if value is None or isinstance(value, bool):
        return None
    try:
        number = float(value)
    except (TypeError, ValueError, OverflowError):
        return None
    return number if math.isfinite(number) and number >= 0 else None


def normalized(value: Any, unit: str | None, kind: str) -> float | None:
    number = numeric(value)
    factors = {"power": {"W": 1.0, "kW": 1000.0}, "energy": {"Wh": 0.001, "kWh": 1.0}}
    factor = factors.get(kind, {}).get(unit)
    return None if number is None or factor is None else number * factor


@dataclass(frozen=True)
class Profile:
    kind: str = "charger"
    calibrated: bool = False
    on_w: float = 5.0
    off_w: float = 2.0
    start_delay_s: float = 30.0
    stop_delay_s: float = 180.0
    min_session_s: float = 300.0
    estimate_full: bool = False
    estimate_ttl_s: float = 21600.0
    meter: bool = False
    tariff: float | None = None
    timezone: str = "UTC"
    max_gap_s: float = 90.0

    def __post_init__(self) -> None:
        if self.kind not in {"charger", "appliance", "chair"}:
            raise ValueError("Unknown device kind")
        if numeric(self.off_w) is None or numeric(self.on_w) is None or self.on_w <= self.off_w:
            raise ValueError("Start threshold must exceed stop threshold")
        for value in (self.start_delay_s, self.stop_delay_s, self.min_session_s, self.estimate_ttl_s, self.max_gap_s):
            if numeric(value) is None or value <= 0:
                raise ValueError("Intervals must be finite and positive")
        if self.tariff is not None and numeric(self.tariff) is None:
            raise ValueError("Tariff must be nonnegative or unset")
        ZoneInfo(self.timezone)


class Tracker:
    def __init__(self, profile: Profile, saved: dict | None = None) -> None:
        self.profile = profile
        self.zone = ZoneInfo(profile.timezone)
        self.total = 0.0
        self.cost = 0.0
        self.priced_energy = 0.0
        self.days: dict[str, dict[str, float]] = {}
        self.history: list[dict] = []
        self.sessions = 0
        self.resets = 0
        self.incomplete = False
        self.active: dict | None = None
        self.state = "not_configured"
        self.power: float | None = None
        self.raw_energy: float | None = None
        self.last_t: float | None = None
        self.last_valid = False
        self.previous_power: float | None = None
        self.previous_meter: float | None = None
        self.start_candidate: dict | None = None
        self.stop_candidate: dict | None = None
        self.saw_idle = False
        self.estimate_until = 0.0
        self.started_at: float | None = None
        if saved:
            self.total = numeric(saved.get("total")) or 0.0
            self.cost = numeric(saved.get("cost")) or 0.0
            self.priced_energy = numeric(saved.get("priced_energy")) or 0.0
            self.days = dict(saved.get("days", {}))
            self.history = list(saved.get("history", []))[-200:]
            self.sessions = int(saved.get("sessions", 0))
            self.resets = int(saved.get("resets", 0))
            self.incomplete = bool(saved.get("incomplete", False))
            self.started_at = saved.get("started_at")
            self.active = saved.get("active")
            if self.active:
                self._finish(float(saved.get("last_t") or self.active["start"]), "interrupted_restart")
                self.incomplete = True

    def _point(self, stamp: float) -> dict:
        return {"time": stamp, "total": self.total, "cost": self.cost, "priced": self.priced_energy}

    def _book(self, amount: float, start: float, end: float) -> None:
        if amount <= 0 or end <= start:
            return
        price = self.profile.tariff
        self.total += amount
        if price is not None:
            self.cost += amount * price
            self.priced_energy += amount
        cursor = start
        while cursor < end:
            local = datetime.fromtimestamp(cursor, self.zone)
            next_day = datetime.combine(local.date() + timedelta(days=1), time.min, self.zone).timestamp()
            boundary = min(next_day, end)
            part = amount * (boundary - cursor) / (end - start)
            bucket = self.days.setdefault(local.date().isoformat(), {"energy": 0.0, "cost": 0.0, "priced": 0.0})
            bucket["energy"] += part
            if price is not None:
                bucket["cost"] += part * price
                bucket["priced"] += part
            cursor = boundary
        for key in sorted(self.days)[:-400]:
            del self.days[key]

    def _finish(self, stamp: float, reason: str, point: dict | None = None) -> None:
        if self.active is None:
            return
        end = point or self._point(stamp)
        duration = max(0.0, stamp - self.active["start"])
        energy = max(0.0, end["total"] - self.active["energy_start"])
        priced = max(0.0, end["priced"] - self.active["priced_start"])
        self.history.append({
            "start": self.active["start"], "end": stamp, "duration_s": duration,
            "energy_kwh": energy,
            "cost": max(0.0, end["cost"] - self.active["cost_start"]) if priced >= energy - 1e-9 and self.profile.tariff is not None else None,
            "reason": reason, "start_known": self.active["start_known"],
            "energy_method": "meter" if self.profile.meter else "calculated",
            "incomplete": self.active.get("incomplete", False) or reason != "low_power",
        })
        self.history = self.history[-200:]
        self.active = None
        self.start_candidate = self.stop_candidate = None

    def observe(self, stamp: float, power: float | None, energy: float | None = None,
                *, issue: str | None = None, switch: str | None = None,
                present: bool | None = None) -> None:
        if not math.isfinite(stamp) or (self.last_t is not None and stamp < self.last_t):
            return
        power, energy = numeric(power), numeric(energy)
        valid = power is not None and issue is None
        gap = self.last_t is not None and stamp - self.last_t > self.profile.max_gap_s
        if gap:
            self.incomplete = self.incomplete or self.started_at is not None
            self._finish(self.last_t, "interrupted_gap")
            self.start_candidate = self.stop_candidate = None
            self.saw_idle = False
            self.estimate_until = 0
        if valid and self.last_valid and not gap and self.last_t is not None:
            if self.profile.meter:
                if energy is not None and self.previous_meter is not None:
                    delta = energy - self.previous_meter
                    if delta >= 0:
                        self._book(delta, self.last_t, stamp)
                    else:
                        self.resets += 1
                        self.incomplete = True
                        if self.active:
                            self.active["incomplete"] = True
                elif energy is None or self.previous_meter is None:
                    self.incomplete = True
                    if self.active:
                        self.active["incomplete"] = True
            elif self.previous_power is not None:
                self._book(self.previous_power * (stamp - self.last_t) / 3_600_000, self.last_t, stamp)
        elif self.started_at is not None and self.last_t is not None and not valid:
            self.incomplete = True
        previous_t = self.last_t
        self.last_t, self.last_valid = stamp, valid
        self.previous_power = power if valid else None
        self.previous_meter = energy if valid else None
        self.power, self.raw_energy = power if valid else None, energy
        if valid:
            day = datetime.fromtimestamp(stamp, self.zone).date().isoformat()
            self.days.setdefault(day, {"energy": 0.0, "cost": 0.0, "priced": 0.0})
            for old_day in sorted(self.days)[:-400]:
                del self.days[old_day]
            if self.started_at is None:
                self.started_at = stamp
        if not valid:
            self._finish(previous_t if previous_t is not None else stamp, "interrupted_data")
            self.state = issue or "no_data"
            self.start_candidate = self.stop_candidate = None
            self.saw_idle = False
            self.estimate_until = 0
            return
        if switch == "off" or (self.profile.kind == "charger" and present is False):
            self._finish(stamp, "power_off" if switch == "off" else "removed")
            self.state = "power_off" if switch == "off" else "not_docked"
            self.estimate_until = 0
            self.start_candidate = self.stop_candidate = None
            self.saw_idle = True
            return
        if not self.profile.calibrated:
            self._finish(stamp, "reconfigured")
            self.state = "needs_calibration"
            return
        assert power is not None
        if self.active:
            if power <= self.profile.off_w:
                if self.stop_candidate is None:
                    self.stop_candidate = self._point(stamp)
                if stamp - self.stop_candidate["time"] >= self.profile.stop_delay_s:
                    start_known = self.active["start_known"]
                    clean = not self.active.get("incomplete", False)
                    duration = self.stop_candidate["time"] - self.active["start"]
                    self._finish(self.stop_candidate["time"], "low_power", self.stop_candidate)
                    self.saw_idle = True
                    if (self.profile.kind == "charger" and self.profile.estimate_full
                            and start_known and clean and duration >= self.profile.min_session_s):
                        self.estimate_until = stamp + self.profile.estimate_ttl_s
                    self.state = "charged_estimated" if stamp < self.estimate_until else "idle"
                    return
            else:
                self.stop_candidate = None
            self.state = "charging" if self.profile.kind == "charger" else "working" if self.profile.kind == "chair" else "consuming"
            return
        if power >= self.profile.on_w:
            self.estimate_until = 0
            if self.start_candidate is None:
                self.start_candidate = self._point(stamp)
            if stamp - self.start_candidate["time"] >= self.profile.start_delay_s:
                point = self.start_candidate
                self.active = {"start": point["time"], "energy_start": point["total"],
                               "cost_start": point["cost"], "priced_start": point["priced"],
                               "start_known": self.saw_idle, "incomplete": False}
                self.sessions += 1
                self.start_candidate = None
                self.state = "charging" if self.profile.kind == "charger" else "working" if self.profile.kind == "chair" else "consuming"
            else:
                self.state = "detecting"
        else:
            self.start_candidate = None
            if power <= self.profile.off_w:
                self.saw_idle = True
            self.state = "charged_estimated" if stamp < self.estimate_until else "idle"

    def snapshot(self, stamp: float) -> dict:
        local = datetime.fromtimestamp(stamp, self.zone)
        day, month, year = local.date().isoformat(), local.strftime("%Y-%m"), local.strftime("%Y")
        completed = [x for x in self.history if x["reason"] == "low_power" and x["start_known"] and not x["incomplete"]]
        active = None
        if self.active:
            active = {"start": self.active["start"], "duration_s": max(0, stamp - self.active["start"]),
                      "energy_kwh": max(0, self.total - self.active["energy_start"]),
                      "start_known": self.active["start_known"], "incomplete": self.active.get("incomplete", False)}
        return {
            "status": self.state, "power_w": self.power, "raw_energy_kwh": self.raw_energy,
            "total_kwh": self.total if self.started_at is not None else None,
            "today_kwh": self.days.get(day, {}).get("energy"),
            "month_kwh": sum(x["energy"] for k, x in self.days.items() if k.startswith(month)) if any(k.startswith(month) for k in self.days) else None,
            "year_kwh": sum(x["energy"] for k, x in self.days.items() if k.startswith(year)) if any(k.startswith(year) for k in self.days) else None,
            "cost": self.cost if self.profile.tariff is not None and self.started_at is not None else None,
            "cost_partial": self.priced_energy < self.total - 1e-9,
            "sessions": self.sessions, "average_minutes": sum(x["duration_s"] for x in completed) / (60 * len(completed)) if completed else None,
            "active": active, "last": self.history[-1] if self.history else None,
            "history": list(reversed(self.history)),
            "days": [{"date": k, **self.days[k]} for k in sorted(self.days)[-31:]],
            "energy_method": "meter" if self.profile.meter else "calculated",
            "incomplete": self.incomplete, "meter_resets": self.resets, "started_at": self.started_at,
        }

    def dump(self) -> dict:
        return {"total": self.total, "cost": self.cost, "priced_energy": self.priced_energy,
                "days": self.days, "history": self.history, "sessions": self.sessions,
                "resets": self.resets, "incomplete": self.incomplete, "active": self.active,
                "last_t": self.last_t, "started_at": self.started_at}
