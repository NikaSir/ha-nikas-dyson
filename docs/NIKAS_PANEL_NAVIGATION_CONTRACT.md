# NikaS Panel Navigation and Return Contract v1.3

**Status:** REQUIRED
**Canonical owner:** `NikaSir/ha-contract-generated-ui`
**Applies to:** every NikaS panel and its internal detail pages

## 1. Hierarchical title navigation

The title opens exactly one declared parent level. A top-level panel opens the native Home Assistant overview at `/home/overview`. This rule applies equally after direct opening and navigation from another panel.

All main NikaS panels are top-level for this rollout. Their parent is `/home/overview`, including House, Rooms, Actions, Infrastructure, Access, Climate, Dyson, S8 OMNI, irrigation, ZONT, StarLine, Stark, Keenetic, LIDER, VLESS and Water Accounting.

An internal detail page opens its own section, not the native overview. Rooms preserves diagnostics → room → Rooms overview → native overview. Peer selectors and ordinary tabs do not create hierarchy levels merely because their selection changes.

`parent_route` is the declared immediate parent URL path. Registry identifiers such as `house.vehicles` are not URL paths. A missing, invalid or self-referencing parent falls back to `/home/overview`; route validation must reject parent cycles in the declared hierarchy.

## 2. Public routes and ownership

The canonical machine-readable registry is `navigation/main.yaml`. Existing public routes remain supported:

| Main panel | Entry route | Parent |
|---|---|---|
| House | `/dashboard-house-v13/home` | `/home/overview` |
| Rooms | `/dashboard-rooms-v11/rooms` | `/home/overview` |
| Actions | `/dashboard-actions/home` | `/home/overview` |
| Infrastructure | `/dashboard-infrastructure/overview` | `/home/overview` |
| Access | `/dashboard-access-v1/home` | `/home/overview` |
| Climate | `/dashboard-climate-v1/home` | `/home/overview` |
| Dyson | `/dashboard-dyson` | `/home/overview` |
| S8 OMNI | `/dashboard-s8-omni` | `/home/overview` |
| Irrigation | `/dashboard-irrigation` | `/home/overview` |
| ZONT | `/dashboard-zont` | `/home/overview` |
| StarLine | `/starline` | `/home/overview` |
| Stark | `/dashboard-ups` | `/home/overview` |
| Keenetic | `/dashboard-keenetic` | `/home/overview` |
| LIDER | `/dashboard-lider` | `/home/overview` |
| VLESS | `/dashboard-vless-gateway` | `/home/overview` |
| Water Accounting | `/dashboard-water` | `/home/overview` |

Every active route has exactly one owner and every installed main panel must have a visible entry link. Home Assistant overview links are valid entry links. A missing, orphaned or mismatched public route is a blocking defect.

## 3. No ambient return authority

`return_to`, `from`, source hand-off, saved session/local storage, `document.referrer` and browser history must never choose or override the title destination. Legacy hand-off helpers may remain temporarily for source compatibility, but title navigation does not read or write their state. The former v1.2 capture precedence is retired.

`safe_return_route` is retained as legacy metadata during migration and equals `/home/overview` for main panels. It does not override the declared immediate parent of an internal page.

## 4. Validation and navigation

A parent must be an absolute same-origin path, not an external URL, protocol-relative URL, script URL or registry identifier. Parent paths do not contain queries or fragments. Self-parent references and cycles are invalid. Unknown parents must be rejected by the registry before publication.

The geometrically centered title plaque is one semantic button with focus and pressed states, at least 44px high. Its second line remains exactly `UI vX.Y.Z`. Click and keyboard activation perform the same transition. The left rail owns the Home Assistant menu; the right rail owns refresh. No separate arrow or Back control is added.

Navigation uses `history.pushState()` and a `location-changed` event. `history.back()`, forced reload and `location.href` assignment are prohibited. Telemetry, refresh, tab and peer changes must not replace the persistent Header or its handler. Only an actual hierarchical page change changes its parent destination.

## 5. Required verification

- Execute the actual title/resolver with conflicting query, storage, hand-off and referrer values; it must still choose the declared parent.
- Check every main title reaches `/home/overview` and every internal title moves exactly one level.
- Verify direct opening, unavailable storage and repeated telemetry do not change the parent.
- Validate registered paths, parent existence, absence of cycles and packaged registry parity.
- Verify semantic title keyboard activation, one navigation per activation, bundle reproducibility, version/cache coherence and required CI.
- Perform separate live phone acceptance. Automated tests or document parity do not establish device acceptance.

## 6. Coordinated rollout

Publish updated contract, source kit, consumer metadata, runtime handlers and tests together. Do not remove existing public entry routes or restore retired central runtime dashboards. Track consumers that still implement v1.2 as pending migration; never certify them from a document-only update.
