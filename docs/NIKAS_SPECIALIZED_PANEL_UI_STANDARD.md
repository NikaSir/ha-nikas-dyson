# NikaS Specialized Panel UI Standard v2.2

**Status:** REQUIRED
**Canonical source:** `NikaSir/ha-contract-generated-ui`
**Applies to:** every integration-owned specialized Home Assistant panel
**Mandatory acceptance matrix:** phone portrait/landscape, tablet portrait/landscape, desktop with Home Assistant sidebar expanded/collapsed
**Normative shell reference:** the numeric host-bound geometry in this document; screenshots and individual panels are not normative
**Reference Header surface and controls:** S8 OMNI
**Reference connection/freshness plaque:** S8 OMNI
**Reference peer-device status lamps:** Stark SolarPower / StarLine lineage
**Reference typography and domain status treatment:** LIDER
**Required navigation companion:** `docs/NIKAS_PANEL_NAVIGATION_CONTRACT.md` v1.2
**Canonical build-time source kit:** `templates/shell_v2/nikas-specialized-shell.js`

This document supersedes every earlier shell, Header, zoom, scrolling and Bottom Tab Bar rule. Historical documents and named panel implementations remain useful only as visual lineage where they do not conflict with this standard. Version 2.2 keeps the v2 geometry and adds the proven peer-device selector status-lamp contract. It retains the vendored build-time shell source and current four-panel base route topology.

## 1. Ownership and topology

```text
HEADER                                      native scale
DEVICE SELECTOR (peer devices only)         native scale
ONE WORK VIEWPORT                           scroll/zoom owner
BOTTOM TAB BAR                              native scale
```

- Only the work area scales.
- Header, peer selector and Bottom Tab Bar never scale or move with content.
- Exactly one zoom viewport may exist per panel instance; nested wrappers are prohibited.
- Shell reconciliation is idempotent across redraws and Home Assistant state updates.
- The effective iOS safe area is consumed exactly once.
- On phones the panel owns a height-locked application shell. The outer Home Assistant page must not become the scrolling surface: only the work viewport scrolls, so Header and Bottom Tab Bar stay at fixed screen coordinates.
- Prevent scroll chaining from the work viewport into Home Assistant's outer document. A sticky element inside the scrolling/transformed subtree does not satisfy the fixed-chrome requirement.
- On iOS, CSS overscroll containment alone is not sufficient. The shell installs a capture-phase, non-passive `touchmove` boundary guard: a downward finger move at the top edge, an upward finger move at the bottom edge, and either vertical direction on a short view are consumed before Home Assistant can start pull-to-refresh or scroll its outer container. Interior movement on a long view remains native.
- Short views fill the available work row rather than shrinking the application shell and pulling either menu toward their content.

### 1.1 Home Assistant host boundary

- The panel root is bound to the actual Home Assistant panel host, not to the browser window. Its border box must equal the current `ha-panel` content box after Home Assistant chrome and an expanded or collapsed sidebar have taken their space.
- Responsive breakpoints are evaluated from the current panel-host inline size, for example with a shell container query; the browser-window width is not a substitute when the Home Assistant sidebar consumes part of the window.
- The shell uses the host's local coordinate system: logical `inset:0`, `inline-size:100%`, `block-size:100%`, `min-inline-size:0` and `min-block-size:0`. `100vw`, a hard-coded sidebar offset and viewport-fixed positioning derived from `window.innerWidth` are prohibited.
- Opening, closing or resizing the Home Assistant sidebar must resize the shell naturally. A panel must not render below, behind or across the sidebar, and must not reserve a sidebar-sized blank strip when the sidebar is collapsed.
- If a Home Assistant version does not provide a stable percentage height, a `fixed_root` or `boundary_guard` may be used only when all four coordinates are derived from the current host rectangle. A browser-window fixed root is non-conforming.
- The outer Home Assistant document remains at scroll origin. Neither native scroll nor overscroll from the work viewport may transfer to it.
- A vertical gesture that starts on Header or Bottom Tab Bar is also consumed by the shell boundary guard; fixed chrome is never a drag handle for the outer Home Assistant page. Two-finger gestures remain available to the work-area zoom engine.

### 1.2 Canonical shell rows

The shell is one persistent grid with the following rows, in this order:

```text
Header          60px + effective top safe area
Peer selector   0px, or exactly 52px when required
Work viewport   minmax(0, 1fr)
Bottom Tab Bar  64px + effective bottom safe area
```

- Header and Bottom Tab Bar always span the complete host width on phone, tablet and desktop.
- Safe left/right insets are consumed by the corresponding shell row exactly once.
- Domain content cannot add an outer Header, footer, application margin or second safe-area reserve.
- A short page fills the work row. A long page scrolls only inside that row. Content height must never determine the vertical position of either menu.

### 1.3 Canonical work-content frame

- The work viewport always occupies the full middle shell row and has `min-width:0`, `min-height:0`, `overflow-y:auto`, `overflow-x:hidden` and contained overscroll.
- Its immediate content frame is centered, uses `width:100%`, `max-width:1280px`, `box-sizing:border-box`, and exactly `12px` horizontal padding below `600px`, `16px` from `600px` through `1023px`, and `24px` from `1024px` upward.
- A domain scene, diagram or card collection may choose its own internal composition, but may not change the shell width, shell rows, outer content frame or chrome coordinates.
- A narrower domain card is allowed inside the canonical content frame. Applying a domain `max-width` to the shell, Header, work viewport or Bottom Tab Bar is prohibited.

### 1.4 Navigation levels

- A NikaS base panel uses the global four-destination navigation: `Дом / Помещения / Действия / Инфра`.
- A specialized integration panel uses only its own 3–5 primary destinations. Five destinations, as used by Keenetic, conform to this limit.
- Global base navigation and specialized integration navigation are different levels and must never be mixed in one Bottom Tab Bar.

### 1.5 Build-time shell source

- Every changed panel vendors the exact canonical `templates/shell_v2/nikas-specialized-shell.js` source into its own repository and verifies its SHA-256 in CI.
- The vendored source is concatenated at build time into the panel's one autonomous production bundle. Loading Contract Generated UI or any shared remote module at runtime is prohibited.
- The kit owns only host geometry, fixed chrome, canonical work frame and navigation hand-off. Domain cards, entities, commands, routes, state models and assets remain owned by the panel repository.
- A repository may add domain CSS inside the canonical work frame, but may not override the kit's host, shell rows, Header, outer work frame or Bottom Tab Bar geometry.

## 2. Header — canonical geometry with S8 OMNI surface

The complete upper application menu copies the S8 OMNI Header, not merely its title typography. The Header surface, menu plaque, center return plaque and optional right action are one visual system.

- The Header body is exactly `60px` high, plus the effective top safe area owned by the Header.
- Its body grid is exactly `52px minmax(0,1fr) 52px` with `12px` horizontal padding plus the effective left/right safe area. On widths below `360px`, only the two rails reduce to `48px`; the body height does not change.
- Both side rails remain reserved even when the right action is disabled or absent. The title therefore never moves when action state changes.
- The Header strip uses the S8 OMNI surface: background `color-mix(in srgb,var(--primary-background-color) 97%,transparent)`, bottom border `1px solid color-mix(in srgb,var(--divider-color) 70%,transparent)`, and `backdrop-filter:blur(18px) saturate(130%)`. The iOS-prefixed equivalent may be added.
- The Header strip remains a persistent mounted layer. Blur, border and background must not be toggled or remounted during scroll, pinch, telemetry changes or tab switches.
- A solid integration-brand color, a transparent strip that exposes moving work content, or a card-white strip disconnected from `var(--primary-background-color)` is non-conforming.
- Title remains geometrically centered regardless of side actions.
- Primary title: `23px`, weight `800`, one line; `21px` on very narrow phones.
- Secondary/version line: `14px`, weight approximately `560`, `var(--secondary-text-color)`; `13px` on very narrow phones.
- The permanent left action is only Home Assistant system menu `mdi:menu`; it dispatches bubbling/composed `hass-toggle-menu`.
- At most one panel-global action occupies the right rail. Refresh uses `mdi:refresh` in idle/busy state and the completion glyphs defined below.
- Menu and refresh copy the S8 OMNI side plaques exactly: `44px × 44px`, `16px` radius, `1px solid color-mix(in srgb,var(--divider-color) 72%,transparent)` border, `var(--card-background-color)` background, `0 7px 20px rgba(23,45,76,.08)` shadow and a `25px` `ha-icon` glyph.
- Menu glyph uses `var(--primary-text-color)`; refresh uses `var(--primary-color)` in idle/busy state.
- Disabled global action may reduce opacity, but its plaque geometry and reserved rail remain unchanged so title centering never moves.
- A transparent refresh rail, a borderless side action, a locally selected integration color or mismatched menu/refresh geometry is non-conforming.
- Back, an integration drawer, a device command or a decorative brand icon is prohibited in the permanent left rail.

### Refresh — busy, success and error

[NikaS Refresh Action Contract v1.1](NIKAS_REFRESH_ACTION_CONTRACT.md) is required
when a refresh action is present. The same mounted button has four states:
idle arrow → busy rotation → success check or error glyph → idle arrow.

- Start the permitted read-only refresh immediately; rotate for at least 900 ms
  and until the request settles, with duplicate activation blocked throughout.
- After explicit success, stop rotation and show green `mdi:check` (`#43a047`)
  for 1400 ms. After failure, show red `mdi:alert-circle-outline` (`#e53935`)
  for 1400 ms with a visible error message. Then restore the idle arrow/color.
- Keep the `44px × 44px` plaque, `25px` glyph and Header coordinates unchanged.
  Update accessible names for busy/success/error; color alone is insufficient.
- A deliberate retry is available during the result interval. Cancel the previous
  timer; neither it nor a late callback may overwrite the new request.
- Telemetry and tab changes preserve the button, result and original deadline.
  Reduced motion removes rotation but retains visible busy and result states.
- The check confirms the declared HA/API request result only. It never fabricates
  a device acknowledgement, sample timestamp, healthy state or fresh telemetry.

### Center title plaque — return to the source NikaS base panel

- The geometrically centered two-line title is a persistent clickable plaque and the sole standard return control from a specialized panel to the NikaS base interface.
- The first line is the current specialized-panel name. The second line is the interface version in the exact form `UI vX.Y.Z`.
- The whole plaque is one semantic `button` and copies the S8 OMNI reference geometry and tone exactly; it retains geometric centering between the side rails.
- Default geometry: `justify-self:center`, `width:min(360px,100%)`, `height:52px`, `padding:5px 14px`. Below `360px` it uses `width:100%; padding-inline:8px` so the plaque fills the available center grid column without moving the side rails.
- Reference surface: `1px` border `color-mix(in srgb,var(--primary-color,#03a9d9) 24%,var(--divider-color,#dfe3e8))`, `16px` radius, background `color-mix(in srgb,var(--primary-color,#03a9d9) 5%,var(--card-background-color,#fff))`, and shadow `0 5px 16px rgba(23,45,76,.06)`.
- Pressed state: background primary mix `13%`, border primary mix `42%`, shadow `0 2px 7px rgba(23,45,76,.05)`; an optional subtle `scale(.985)` response is allowed. Focus-visible uses a `2px` primary-color outline with `2px` offset.
- The focus state and pressed response are mandatory and remain visibly distinct from the default state.
- A transparent title, a plain text label without the S8 OMNI surface, a white-only card surface, a wider `460px` desktop plaque forced into the phone Header, or a locally chosen integration color is non-conforming.
- An arrow, chevron, a separate `Назад` label and `history.back()` are prohibited.
- When a specialized panel is opened from `/dashboard-house-v13/home`, `/dashboard-rooms-v11/rooms`, `/dashboard-actions/home` or `/dashboard-infrastructure/overview`, it returns to that same base panel. Permitted sub-routes are normalized according to the required navigation contract.
- The base shell records the source route in the same click/keyboard handler, immediately before changing location to the specialized panel. Ambient shell synchronization and telemetry updates must not refresh the hand-off timestamp. The common one-shot hand-off key is `sessionStorage["nikas.specialized.source_route.v1"]`; `return_to` or `from` query parameters may be used as an explicit hand-off.
- The specialized panel captures and validates the route once, persists its accepted route for that panel/client, and does not recalculate it during telemetry updates. Only same-origin routes rooted at `/dashboard-house-v13`, `/dashboard-rooms-v11`, `/dashboard-actions` and `/dashboard-infrastructure` are accepted.
- Capture precedence is: explicit `return_to`/`from`, one-shot session hand-off, saved route for that specialized panel, safe same-origin referrer, configured `parent_route`, then the repository-defined safe base-panel fallback.
- Navigation is explicit Home Assistant navigation: `history.pushState()` followed by a `location-changed` event. Browser history is never the routing contract.
- The title plaque, its accepted route and its click handler are mounted with the fixed Header and survive tab switches, polling, loss/recovery and every state-only patch.

## 3. Peer-device selector

- Use a selector only for peer physical devices of the same integration, for example `UPS Интернет / UPS Котёл`; a zone, channel or functional subsection is not automatically a peer device.
- It remains directly below Header, outside the work viewport and at native scale.
- Selected peer persists across tabs and owns its own locally persisted scale/position state.
- Hiding a selector on an aggregate view is allowed when all peers are already visible, but the same selector subtree is retained for single-peer views.

### 3.1 Peer-device status lamps — Stark SolarPower reference

- When a peer-device selector is present, every device button carries one compact status lamp, including the selected peer. The lamp reports that device's current health while the button surface reports selection; these two meanings remain independent.
- The selected button keeps the canonical primary-color selection background, border and text. Device health must never recolor the complete selector button or replace the selection treatment.
- The reference lamp is a persistent `9px × 9px` circle inside the button, with a subtle `3px` halo mixed from the same state color. It must not change button height, width, order or label alignment.
- State priority is fail-closed: red overrides orange, orange overrides green, and an untrusted or incomplete result is gray. A lower-priority healthy fact must not conceal a higher-priority fault.
- Green means the device is reachable, its required telemetry is current and no domain fault or warning is active.
- Orange means the device remains usable but is in a documented warning state, such as battery operation, degraded/reserve operation, stale telemetry or a non-critical domain alert.
- Red means a confirmed fault, unavailable device or lost required connection.
- Gray means unknown, missing, incomplete or otherwise unreliable status. Gray is mandatory until enough factual inputs exist to classify the device safely.
- The lamp state is derived only from Home Assistant or integration-owned facts for that specific peer. Selection, last-clicked state and optimistic command results are not health inputs.
- Color is not the sole accessible signal: the button has an `aria-label` containing device name and status, and the lamp exposes the same status as a title or equivalent accessible description.
- Lamps do not blink, pulse or animate between states. State changes patch only the existing lamp class/color and accessible text; they never rebuild the selector, Header, work viewport or panel shell.
- The complete peer selector remains mounted during tab switches, telemetry polling, peer changes and loss/recovery. Unchanged lamp state produces no DOM write.

## 4. Work viewport at 100%

At exactly `scale = 1`:

- `x = 0` and `y = 0` are invariant;
- one-finger transform panning is disabled;
- normal native vertical scrolling is enabled;
- horizontal scrolling is disabled;
- the canvas cannot be pulled sideways, below the top origin or beyond its real lower edge;
- clicks, hold-to-more-info and vertical scrolling start without a gesture delay;
- stored transforms are normalized to `{scale:1,x:0,y:0}` before display.

The former rule that one-finger transform panning also provides vertical movement at 100% is retired.

## 5. Zoom and enlarged pan

- Pinch uses two fingers and preserves the focal midpoint.
- Range is `75–200%`.
- Permanent zoom buttons are prohibited.
- Pinch ending within `97–103%` snaps to exactly 100% and origin.
- Two-finger double tap resets scale, transform and native scroll to 100%/origin and briefly shows `Масштаб 100%`.
- Every route to 100% — explicit two-finger reset, automatic `97–103%` snap, invalid stored-state normalization or programmatic reset — uses one canonical reset operation: `scale=1`, `x=0`, `y=0`, `scrollLeft=0`, `scrollTop=0`, then persists the normalized 100% state.
- Scale persists locally per panel/client and per selected peer device where applicable.
- One-finger transform panning is enabled only when `scale > 1`.
- Each axis is enabled only when scaled content exceeds the viewport on that axis.
- Translation is clamped to factual content edges; exposing empty canvas is prohibited.
- Resize, orientation change, content reflow, peer switch and tab change re-run bounds clamping.
- A tab change returns native scroll to the top and removes invalid translation; stored scale may remain.
- A second finger cancels pending more-info; post-gesture synthetic clicks are briefly suppressed, while intentional stationary hold still opens native more-info.
- Pinch and two-finger reset must not open history, a graph or more-info.

## 6. Bottom Tab Bar — canonical geometry with UPS visual lineage

- One persistent, edge-attached bar spanning the complete host width on every supported viewport; never a floating card or pill.
- It remains outside the work viewport and above the Home Indicator.
- Background: `var(--card-background-color)`; top divider and a subtle upward shadow.
- The native bar body is exactly `64px`: `6px` top padding, a `52px` tab target row and `6px` bottom padding. The effective bottom safe area is added below that body exactly once; effective left/right safe areas are added once.
- The complete icon/label stack must fit inside the `52px` target row: icon no larger than `26px`, stack gap `1px`, label `12px/14px`, and at least `6px` internal clearance below the label. Browser-default button typography and an implicit `normal` line-height are prohibited because they can clip Cyrillic descenders at the host edge.
- All destinations have equal-width columns; 3–5 primary tabs are supported.
- Tab touch target height: exactly `52px`.
- Tab radius: `16px`; compact internal padding and `1px` icon/label gap.
- Icons are MDI through `ha-icon`, never text characters; canonical glyph size is `26px`.
- Labels are one line, approximately `12px`, weight `700`, readable and ellipsized only when necessary.
- Inactive content uses `var(--secondary-text-color)`.
- Active icon/label use `var(--primary-color)` and an `11%` primary-color background, without a second shadow and without changing the tab's size, column width or bar height.
- Navigating between tabs restores the work area to the page start before interaction resumes.
- A short view must not move the bar. A long view must scroll its final control/card fully clear of the bar and Home Indicator.

## 7. Typography envelope

- Meaningful user-facing text stays within `12–25px` inclusive.
- `12px` is the minimum for captions, state freshness, navigation labels, chips and compact secondary values.
- `25px` is the maximum for a prominent live value or compact hero heading. Larger display typography is not part of the phone form baseline.
- The Header is governed by its explicit `23/14px` wide and `21/13px` narrow pairs above.
- `9–10px` is allowed only for redundant, non-interactive schematic annotations whose meaning is already conveyed elsewhere. It is prohibited for statuses, controls, navigation, entity names, measurements and required explanations.
- A layout that needs meaningful text below `12px` must be recomposed instead of shrinking the type.

## 8. Optional connection and freshness indicator — S8 OMNI reference

The two-level indicator is introduced only by an explicit product request. It is not a mandatory shell element. In particular, it is absent from `Дом сейчас` and StarLine until separately requested.

### Semantics

- The first line describes the actual data path: `Локально`, `Облако`, `Резерв`, `Нет связи` or `Нет данных`.
- `Онлайн` is not used: it duplicates `Локально`/`Облако` and hides the transport path.
- Tuya Local and Zigbee delivered through local MQTT are `Локально`; Tuya cloud and other remote cloud APIs are `Облако`.
- Local transport also includes a local LAN/API, local MQTT, Modbus and SNMP path that does not require an external vendor service.
- `Резерв` means a known fallback path is actively supplying data, not merely that fallback capability exists.
- The second line describes freshness only: `Данные актуальны`, `Данные устарели` or `Нет данных`.
- Transport and freshness are independent. For example, `Облако · Данные устарели` is valid; stale data must not be relabelled as a transport outage without evidence.
- A failed current poll makes preserved telemetry `Данные устарели`. Unless a domain documents another justified threshold, a sample also becomes stale after three normal polling intervals; it becomes current again only after a new successful sample is accepted.

### Placement and geometry — locked contract

The mandatory companion is [NikaS Connection Plaque and Blue Corner Contract
v1.1](NIKAS_CONNECTION_DECORATION_CONTRACT.md). It restores the compact S8
width and phone insets, with an exact `58px` height instead of the former
minimum-only height. It supersedes v1.0's larger `200px × 60px` plaque.

- The plaque is exactly `168px × 58px` border-box, radius `18px`, at `top:13px;
  right:13px` from the operational card's inner border edge.
- Use `11px 12px` padding, a `1px` border, internal columns `10px minmax(0,1fr)`,
  `9px` column gap and a circular `10px × 10px` lamp.
- Main text is `16px/700`, line-height `17px`; freshness is `13px/600`, line-height
  `14px`; text gap is `3px`. Both use the companion's exact shared font stack.
- The title occupies its own reserved area. Below `360px` outer card width it
  moves below the plaque; the plaque retains its top/right position and size.
- Both elements belong to the work viewport and scale with it. Status text,
  image size/loading, peer switches and telemetry must not move their anchors.
- The separate upper-right background circle is exactly `205px × 205px`,
  `top:-92px; right:-70px`, radius `50%`, fill `rgba(3,169,217,0.07)`.
  It is clipped by a persistent card decoration layer and never recolored by
  `--primary-color`, state or device mode. It does not represent Refresh.
- No per-panel or responsive override may change these tokens. Validate actual
  production computed styles and rectangles using the companion's scenarios;
  merely copying the latest S8 CSS is not evidence of conformance.

### State surfaces and colors

- `Локально` and `Облако`: lamp and main line use `var(--success-color,#43a047)`; background is an `11%` success-color mix with `var(--card-background-color)`; border is a `30%` success-color mix with `var(--divider-color)`.
- `Резерв`: lamp and main line use `var(--warning-color,#f6a623)`; background is a `10%` warning-color mix with `var(--card-background-color)`; border is a `30%` warning-color mix with `var(--divider-color)`.
- `Нет связи`: lamp and main line use `var(--error-color,#db4437)`; background is a `10%` error-color mix with `var(--card-background-color)`; border is a `30%` error-color mix with `var(--divider-color)`.
- `Нет данных`: lamp and main line use `var(--disabled-text-color,var(--secondary-text-color))`; background is an `8%` secondary-text-color mix with `var(--card-background-color)`; border is a `28%` secondary-text-color mix with `var(--divider-color)`.
- A current freshness line uses `var(--secondary-text-color)`. `Данные устарели` uses `var(--warning-color,#f6a623)` at weight `600`. `Нет данных` uses `var(--secondary-text-color)`.
- Color is always accompanied by text. Saturated full fills, arbitrary product colors and a green surface for `unknown`, `unavailable`, stale or untrusted data are prohibited.

### Rendering behavior

- Flashing, pulsing, saturated full fills and repeated entrance animations are prohibited.
- The indicator is a stable DOM subtree. State updates patch only text, classes, ARIA label and state color variables; they never remount the plaque, Hero, panel or fixed shell and never animate layout geometry.
- The plaque remains structurally present when changing among local/cloud/reserve/offline/no-data states so that telemetry changes cannot make the page flash or shift.

## 9. Stable rendering and flicker prevention

- Header, peer selector, one viewport, one work canvas, persistent background and Bottom Tab Bar are mounted once per panel instance.
- A `hass` setter or telemetry timer must patch existing text, attributes, classes and CSS variables. Reassigning the panel or card `shadowRoot.innerHTML` for routine telemetry is prohibited.
- Tabs and peer-device views use lazy DOM caching. Returning to a visited view reattaches the same view subtree; it must not rebuild the application shell.
- A structural configuration change may replace only the affected work-view subtree. It must not create a second viewport or discard the fixed chrome.
- The stored transform is applied before a newly selected work view becomes visible. Background images and large compositor layers are not recreated during scroll, telemetry refresh or indicator updates.
- Rendering is coalesced to at most one animation frame, and unchanged values do not write the DOM.
- Wrapping a full redraw in `requestAnimationFrame`, or delaying it until after scrolling, is still a full redraw and is non-conforming.
- Keys, element order and child topology remain stable for state-only changes. Conditional status copy uses stable placeholders or targeted insertion rather than whole-tree replacement.
- Exact changing telemetry age is not a structural key. An unchanged image does not receive the same `src` again.
- `backdrop-filter`, masks, `will-change` and containment may be used only on persistent layers; toggling or remounting them during scroll is prohibited because it can flash in iOS WebView.
- No polling loop may rebuild the active tab. Time-only displays patch their own text nodes.
- A full-screen loading frame is allowed only during initial mount. Later loss, staleness and recovery patch the mounted content in place.

## 10. Data truth and command safety

- A panel renders facts only from Home Assistant state objects, integration-owned APIs/coordinators or the Home Assistant entity/device registries. Frontend code must not invent entity IDs, raw device datapoints, capabilities, samples or success states.
- Entity mapping is supplied by the integration, panel configuration or registry discovery. A hard-coded entity ID is allowed only when it is an explicit, tested part of that integration's public contract.
- Missing, malformed, `unknown` and `unavailable` data are rendered explicitly and never receive a healthy tone. A preserved last-known sample remains visibly stale until a newer successful sample is accepted.
- Derived values identify their factual inputs and fail closed when those inputs are absent. The UI must not replace an unknown value with zero, an optimistic default or fabricated history.
- Read-only panels remain read-only. A refresh action may request new telemetry but must not masquerade as a device command.
- A write action is allowed only through a registered integration service or a discovered Home Assistant entity capability. It is disabled when its target or capability is unavailable, prevents duplicate submission, awaits completion and exposes busy/error feedback without inventing success.
- Secrets, raw credentials and vendor tokens never enter panel configuration, DOM attributes, logs or frontend bundles.
- Every repository declares its data source and command policy in `.nikas-ui-standard.json` and verifies the product-specific mapping in tests.

## 11. Production bundle and version coherence

- Every specialized panel has exactly one shipped JavaScript `production_entrypoint`. `module_url` points only to that entrypoint with deterministic cache busting tied to the current UI version.
- The production entrypoint is autonomous: it contains no runtime `import`, dynamic `import()` or `export`, and it does not load a previous UI module, remote script, stylesheet or CDN dependency. Local versioned artwork may remain a separately packaged asset.
- Historical source layers may be composed at build time only when the generated entrypoint contains one active shell, one active Header-return implementation and no superseded zoom or navigation engine.
- `runtime_files` lists only files executed by Home Assistant. Build inputs are declared separately as `build_source_files`; documentation and test fixtures are never presented as runtime.
- Generated bundles are deterministic. CI regenerates them and fails on a diff, or invokes an equivalent `--check` mode that fails when the tracked bundle is stale.
- The visible `UI vX.Y.Z`, configured `ui_version`, panel manifest, panel contract, registration/cache key and current web-component name describe the same release. A runtime change that affects behavior increments the UI version and cache key.
- The production bundle is syntax-checked directly. Tests reject runtime imports, duplicate current component registration and more than one active shell/viewport.
- Styles required for the shell are bundled or shipped locally with the same deterministic version policy. Runtime network failure must not remove Header, navigation or core state presentation.

## 12. Brand and repository identity

- Every integration repository ships a recognizable integration brand asset.
- A packaged `custom_components/<domain>/brand/icon.png` is mandatory; it is the minimum HACS brand asset and must not be an empty placeholder.
- `brand/logo.png`, `brand/dark_icon.png` and `brand/dark_logo.png` are required when the mark or wordmark is not legible in both themes.
- Brand files use the integration package layout expected by Home Assistant/HACS and are included in distribution checks.
- README starts with the same recognizable project/integration identity; repository and installed integration must not present unrelated marks.
- Header does not display the brand icon; it is for repository/HACS/HA identity, sidebar/launcher and suitable domain cards.
- Changed raster assets use deterministic cache/version handling where served by the panel.

## 13. Required automated guards

Repository tests or static checks must verify:

1. exactly one work/zoom viewport;
2. no permanent scale controls;
3. `hass-toggle-menu` and `mdi:menu` in the left rail;
4. the Header strip and both side actions use the S8 OMNI reference surface, border, blur, dimensions and shadow;
5. Bottom Tab icons use `ha-icon` and canonical size;
6. no horizontal movement and no transform pan at 100%;
7. axis-aware overflow bounds above 100%;
8. clamp after resize/tab/peer changes;
9. brand `icon.png` exists in the shipped integration package;
10. meaningful typography stays within `12–25px`, subject only to the documented schematic exception;
11. routine telemetry cannot replace the shell, viewport, canvas, background or Bottom Tab Bar;
12. a requested connection indicator and enabled blue corner satisfy `NIKAS_CONNECTION_DECORATION_CONTRACT.md` v1.1, including exact tokens, all label lengths, stable DOM and zero state-caused geometry movement; transport/freshness vocabulary and state-tinted surface percentages remain canonical;
13. the center title is a two-line, exactly `52px` high semantic button, contains no arrow or separate Back label and retains geometric centering;
14. every reset path normalizes and persists `{scale:1,x:0,y:0}` and native scroll origin;
15. source-route capture follows `NIKAS_PANEL_NAVIGATION_CONTRACT.md`, uses the four canonical base entry routes, writes the common session hand-off at outbound click/keyboard time, consumes it once, performs explicit HA navigation and contains no `history.back()`;
16. the hand-off route and timestamp are a required pair, reject missing, invalid, expired and future timestamps, and are both removed before candidate selection;
17. the production entrypoint is the only runtime file, is autonomous and is reproducible from its declared build inputs;
18. UI version, manifest/contract, component registration and cache key stay coherent;
19. unknown/unavailable data and product command policy are explicit and fail closed;
20. JavaScript syntax, package validation, HACS and Hassfest pass.
21. the shell border box equals the Home Assistant panel-host border box within `2px` on every edge and uses no `100vw` or hard-coded sidebar offset;
22. Header and Bottom Tab Bar span the host width and keep their coordinates within `2px` before and after work scrolling, overscroll, tab changes and sidebar toggles;
23. the title-plaque horizontal center equals the panel-host horizontal center within `2px` with the right action present, absent, enabled and disabled;
24. the outer Home Assistant scrolling element remains at origin while the work viewport scrolls;
25. the canonical shell row sizes, work-content frame, breakpoint gutters and 3–5 specialized-tab limit are machine-checked.
26. every Bottom Tab Bar label is fully visible, including Cyrillic descenders, with the sidebar expanded and collapsed and in every mandatory viewport.
27. the non-passive touch boundary guard blocks Home Assistant pull-to-refresh and outer scrolling at both work-viewport edges without replacing native interior scrolling or two-finger zoom.
28. a peer-device selector, when present, keeps one persistent accessible status lamp per device, preserves selection styling independently, applies the green/orange/red/gray fail-closed state contract and updates lamps without replacing selector DOM.
29. an owned panel route is registered before fallible device I/O, remains present after initial failure and is removed only by its exact owner, as required by `NIKAS_PANEL_LIFECYCLE_CONTRACT.md`.
30. a refresh action satisfies `NIKAS_REFRESH_ACTION_CONTRACT.md` v1.1, including the 1400 ms green check/red error state, truthful completion, retry/timer isolation and stable geometry.

Each repository also maintains `docs/NIKAS_SPECIALIZED_PANEL_COMPLIANCE.md` (or an equivalent explicit record). Unimplemented runtime behavior is recorded as `GAP`, never assumed to pass from documentation alone.

## 14. Mandatory viewport acceptance

Every changed shell is accepted at all of these CSS viewport sizes:

| Class | Viewport | Home Assistant state |
|---|---:|---|
| Phone portrait | `430 × 932` | mobile menu closed and opened |
| Phone landscape | `932 × 430` | mobile menu closed and opened |
| Tablet portrait | `768 × 1024` | sidebar expanded and collapsed |
| Tablet landscape | `1024 × 768` | sidebar expanded and collapsed |
| Desktop | `1440 × 900` | sidebar expanded and collapsed |

For every matrix entry, compare the measured Header, title plaque, work viewport and Bottom Tab Bar rectangles with the canonical reference. A coordinate or size deviation greater than `2px` is a blocking shell defect. Domain content is compared only against its own approved composition.

- long diagnostics pages scroll vertically at 100%;
- 100% cannot move horizontally or be pulled away from the top origin;
- enlarged content pans only on necessary axes and never exposes empty field;
- release preserves clamped position without rebound;
- pinch never causes content snap-back;
- card activation does not become accidental pan;
- Header, selector and Bottom Tab Bar remain stationary at every scale;
- every peer selector shows one correctly classified lamp per device; selected styling remains unchanged while green/orange/red/gray health states update independently and without geometry shift;
- the upper menu visually matches S8 OMNI: persistent 97% primary-background strip, divider, blur and three aligned plaques below Dynamic Island;
- both Header side buttons are visible matching `44px × 44px` plaques;
- the centered title plaque shows the panel name and exact `UI vX.Y.Z`, returns to each of the four originating NikaS base panels and uses the configured safe fallback after a direct open;
- Bottom icons and labels match the Stark SolarPower visual scale;
- integration/repository icon is present and recognizable in installed/distribution surfaces.
- a requested connection indicator has the exact `168px × 58px` box, `13px` top/right inset, `18px` radius, internal `10px` lamp and fixed `16/700` + `13/600` text; an enabled blue corner has the exact `205px` circle and fixed fill/anchor from `NIKAS_CONNECTION_DECORATION_CONTRACT.md`;
- repeated telemetry, indicator transitions, tab changes and upward/downward scroll produce no full-screen flash or white frame;
- scrolling the work area never moves Header, peer selector or Bottom Tab Bar;
- pulling downward at the top of any tab never displays the Home Assistant refresh spinner or splash screen; dragging upward at the bottom never moves the complete panel or leaves a blank field below it;
- a short tab consumes vertical edge gestures in both directions, while a long tab still scrolls naturally between Header and Bottom Tab Bar;
- short views do not pull either menu inward, and long views expose their last control above the Bottom Tab Bar;
- at least ten consecutive tab switches produce no blank frame, lost map/image or duplicated viewport;
- loss/recovery changes telemetry and any enabled indicator in place; preserved samples are visibly stale;
- `Дом сейчас` and StarLine contain no unrequested two-level connection indicator.
- repeated telemetry and tab changes do not change the captured Header return destination or replace its click handler.
- an unavailable target cannot be commanded and never flashes an optimistic success state;
- a missing or stale hand-off timestamp falls back safely instead of reusing an old source route.
- expanding or collapsing the Home Assistant sidebar changes only the available host width; it does not overlap, offset twice or leave a blank sidebar reserve in the NikaS shell;
- rotating between portrait and landscape preserves one shell, one work viewport, the selected tab and valid scroll/zoom bounds.

## 15. Publication

- NikaS panel and integration work is published through traceable commits, branches and pull requests.
- GitHub Releases are not used.
- Automatic release tags are not used as a publication gate or update channel. An internal integration/UI version does not require a Git tag.
- A pull request remains draft until automated checks pass and the complete viewport matrix above is ready for user verification.

## 16. Panel lifecycle and availability

[NikaS Panel Lifecycle Contract v1.0](NIKAS_PANEL_LIFECYCLE_CONTRACT.md) is a
required companion to this standard.

- A configured panel route is application infrastructure, not telemetry state.
- The owner registers its route before fallible first device/cloud/coordinator I/O,
  or uses integration-wide registration when the route is not entry-specific.
- `async_config_entry_first_refresh()` and successful device discovery must never
  be prerequisites for route existence.
- Initial failure mounts explicit unavailable/no-data content and preserves Header,
  navigation and sidebar entry.
- Recovery uses the normal coordinator/config-entry retry lifecycle and patches the
  existing panel.
- Generated panel existence follows enabled manifest/configuration state; entity
  availability affects content only.
