# NikaS Panel Navigation and Return Contract v1.2

**Status:** REQUIRED
**Canonical owner:** `NikaSir/ha-contract-generated-ui`
**Applies to:** base panels, specialized panels and every transition between them

This contract defines public panel routes, source hand-off and deterministic return behavior. It is a required companion to the NikaS Specialized Panel UI Standard.

## 1. Route model

- `panel_root` is the top-level path registered through `frontend_url_path` or `dashboard_path`.
- `entry_route` is the complete route that opens the canonical first screen.
- `source_route` is the normalized entry route of the NikaS base panel that opened a specialized panel.
- `safe_return_route` is the repository-defined base-panel fallback used after a direct open.
- Identifiers such as `house.vehicles` are registry keys, not URL paths, and must never be supplied to `history.pushState()`.

The four base panels are:

| Panel | `panel_root` | canonical `entry_route` |
|---|---|---|
| House now | `/dashboard-house-v13` | `/dashboard-house-v13/home` |
| Rooms | `/dashboard-rooms-v11` | `/dashboard-rooms-v11/rooms` |
| Actions | `/dashboard-actions` | `/dashboard-actions/home` |
| Infrastructure | `/dashboard-infrastructure` | `/dashboard-infrastructure/overview` |

The specialized-panel registry is:

| Panel | canonical route | `safe_return_route` |
|---|---|---|
| Access | `/dashboard-access-v1/home` | `/dashboard-house-v13/home` |
| ZONT | `/dashboard-zont` | `/dashboard-house-v13/home` |
| StarLine | `/starline` | `/dashboard-house-v13/home` |
| S8 OMNI | `/dashboard-s8-omni` | `/dashboard-actions/home` |
| HO-SC-8W | `/dashboard-irrigation` | `/dashboard-actions/home` |
| Stark SolarPower | `/dashboard-ups` | `/dashboard-infrastructure/overview` |
| Keenetic Hero 4G+ | `/dashboard-keenetic` | `/dashboard-infrastructure/overview` |
| LIDER | `/dashboard-lider` | `/dashboard-infrastructure/overview` |
| Water Accounting | `/dashboard-water` | `/dashboard-house-v13/home` |

`/dashboard-starline` is invalid. The registered StarLine route is `/starline`.

## 2. Ownership and discoverability

- The canonical route registry lives in `ha-contract-generated-ui` and is the single source of truth.
- Every integration repository exposes its registered root, canonical route, safe fallback and contract version in a machine-readable panel contract.
- One active route has exactly one owner.
- Every installed specialized panel has at least one visible entry link from the NikaS base interface; a sidebar-only or direct-URL-only panel is non-conforming.
- Required owners are: House now → Access, ZONT, StarLine and Water Accounting; Actions → S8 OMNI and HO-SC-8W; Infrastructure → Stark SolarPower and Keenetic; the Infrastructure power section → LIDER.
- A `more-info` action does not count as the required entry link.

Legacy `/dashboard-house/*` pages may remain declared detail routes during migration. They are not base-panel source routes and must not be used as a return fallback.

## 3. Source hand-off

In the same click/keyboard handler, immediately before navigating from a base panel to a specialized panel, the navigation handler stores the normalized current base route and current epoch timestamp:

```javascript
sessionStorage.setItem("nikas.specialized.source_route.v1", sourceRoute);
sessionStorage.setItem("nikas.specialized.source_route_at.v1", String(Date.now()));
```

Only these values are valid:

```text
/dashboard-house-v13/home
/dashboard-rooms-v11/rooms
/dashboard-actions/home
/dashboard-infrastructure/overview
```

- `/dashboard-house-v13/*` normalizes to `/dashboard-house-v13/home`.
- `/dashboard-rooms-v11/*` normalizes to `/dashboard-rooms-v11/rooms`.
- `/dashboard-actions/*` normalizes to `/dashboard-actions/home`.
- `/dashboard-infrastructure/*` normalizes to `/dashboard-infrastructure/overview`.
- `/dashboard-house` and `/dashboard-house/*` are never stored as the NikaS base source.
- Both hand-off values are required. A route without a timestamp, a timestamp without a route, a non-finite timestamp, a timestamp from the future or a hand-off older than 30 seconds is invalid.
- The valid age interval is inclusive: `0 <= Date.now() - timestamp <= 30_000`.
- The hand-off is one-shot. The specialized panel reads and removes both keys before validating candidates, including when an explicit `return_to` or `from` wins.
- A partial storage write is rolled back by removing both keys. Storage failure does not block navigation; the specialized panel uses its configured safe fallback.
- A base shell must not continuously overwrite the hand-off during telemetry, shell synchronization or DOM reconciliation. The timestamp is a defensive expiry guard, not a substitute for click-time capture.

## 4. Return-route capture

A specialized panel resolves its return destination once, when the persistent Header is mounted. Precedence is:

1. first valid `return_to`;
2. first valid `from`;
3. valid one-shot source hand-off;
4. saved route for that specialized panel;
5. safe same-origin referrer;
6. configured `parent_route`;
7. registered `safe_return_route`.

An invalid `return_to` must not suppress a valid `from`. The accepted route is stored under a panel-specific key such as `nikas.<panel_id>.return_route.v1` and is not recalculated during telemetry updates, tab changes or peer-device changes.

`parent_route` is a safe fallback, not an unconditional return destination. It must be an absolute allowed URL path, never a registry identifier.

## 5. Validation

- Accept same-origin URL paths only.
- Accept only the four base roots listed in section 1, then normalize them to their canonical entry routes.
- Reject external origins, protocol-relative URLs, `javascript:`, `data:`, specialized-panel routes, arbitrary dashboards and legacy `/dashboard-house` routes.
- Drop query and hash components unless a base-panel contract explicitly declares them canonical.
- A malformed explicit parameter does not invalidate lower-precedence valid candidates.

## 6. Header return action

- The geometrically centered title plaque is the sole standard return action.
- It is one semantic `button`, at least `44px` high, with focus and pressed states.
- Its first line is the panel name; its second line is exactly `UI vX.Y.Z`.
- Arrow, chevron, separate Back label, left-rail return control and `history.back()` are prohibited.
- The left rail owns only the Home Assistant menu; the right rail owns refresh.
- Header, accepted route and click handler survive every state-only update.

Return navigation is explicit:

```javascript
window.history.pushState(null, "", route);
window.dispatchEvent(new Event("location-changed"));
```

Assigning `location.href`, reloading the page or relying on browser-history depth is prohibited.

## 7. Required automated checks

CI must fail when any of the following is false:

1. every `entry_route` belongs to its registered `panel_root`;
2. every outbound target exists and has exactly one owner;
3. every specialized panel has a declared visible base entry;
4. no source or fallback uses `/dashboard-house`, `/dashboard-starline` or a registry identifier;
5. all four base source routes normalize exactly as specified;
6. both hand-off values are required, validated as a pair and consumed once;
7. direct open uses the declared safe fallback;
8. invalid or external routes are rejected;
9. the center title is a semantic version-only return button;
10. no runtime source contains `history.back()`;
11. repeated telemetry and tab changes preserve the captured route and handler;
12. JavaScript syntax, package validation, HACS and Hassfest pass.
13. every declared base-panel outbound handler writes the source hand-off immediately before navigation, rolls back a partial write and no ambient render/sync path refreshes it;
14. missing, non-finite, expired and future timestamps are rejected.

A missing, orphaned or mismatched public route is a blocking defect.

## 8. Required phone acceptance

On the primary iPhone viewport verify:

- each declared base card opens its actual specialized route;
- the title plaque returns to the same originating base panel;
- House now returns to `/dashboard-house-v13/home`, never `/dashboard-house`;
- a direct open returns to the declared safe fallback;
- refresh, polling, tab changes and peer switches do not alter the destination;
- Header does not flash, rebuild or lose its click handler.

## 9. Route changes

A public route change is atomic: update the canonical registry, owner registration, inbound links, fallbacks, tests and documentation in one coordinated rollout. Keep a temporary alias or redirect until every consumer is updated. Removing an old route before its consumers migrate is prohibited.
