# NikaS Refresh Action Contract v1.1

**Status:** REQUIRED companion to NikaS Specialized Panel UI Standard v2.2  
**Canonical source:** `NikaSir/ha-contract-generated-ui`  
**Applies to:** every NikaS specialized panel that exposes a refresh action  
**Approved:** 2026-09-07  
**Completion feedback amendment:** 2026-09-08
**Machine contract:** `.nikas-ui-standard.json` → `refresh_action_feedback`

This companion extends the Header, stable-rendering, data-truth and acceptance rules of [NikaS UI Standard v2.2](NIKAS_SPECIALIZED_PANEL_UI_STANDARD.md). It does not change shell geometry, require a refresh button where none was approved, or certify unchanged panels as compliant.

## Why this rule exists

In HO-SC-8W UI 0.7.08, the upper-right refresh button gave no visible progress feedback. A request could be sent while the user could not distinguish execution, inactivity or failure. The fix is tracked in [HO-SC-8W PR #170](https://github.com/NikaSir/ha-ho-sc-8w/pull/170), UI 0.7.10 / integration 1.0.0-b006.31.

A working service call without observable feedback is a UI defect. An animation without a real refresh request is also a defect.

The completion check was accepted by the user in Climate UI 1.4.17. S8 OMNI
[PR #129](https://github.com/NikaSir/ha-s8-omni/pull/129) and HO-SC-8W
[PR #175](https://github.com/NikaSir/ha-ho-sc-8w/pull/175) add the same visible result.
These implementations are evidence for the completion presentation, not automatic
certification of every requirement of this companion.

## Mandatory behavior

### REFRESH-01 — Immediate, truthful feedback

On accepted activation, mark the existing button busy before awaiting asynchronous work. Start the real read-only telemetry refresh through the panel's declared Home Assistant/integration API. The button does not reload Home Assistant, restart an integration, change device settings or invoke unrelated commands.

### REFRESH-02 — Visible duration follows the request

With ordinary motion settings, rotate the refresh glyph continuously at one full turn per 900 ms. Keep the busy presentation for at least 900 ms and until the actual awaited request settles, whichever takes longer. Start the request immediately; the minimum duration delays only removal of feedback. A timer must not re-enable the button while its request is still pending.

### REFRESH-03 — No duplicate requests

Disable repeat activation for the complete busy interval. A handler-level single-flight guard is mandatory in addition to the button's disabled state. Rapid taps, keyboard activation and repeated handler calls must not dispatch a second request or queue a delayed duplicate.

### REFRESH-04 — Completion and failure are observable

After the request settles and the minimum busy interval ends, stop rotation and
clear busy/disabled state on every exit path, including exceptions. Show the result
in the same button for 1400 ms, then restore its idle glyph and color:

| State | Glyph | Glyph color | Accessible name |
|---|---|---|---|
| Idle | `mdi:refresh` | `var(--primary-color)` | `Обновить` |
| Busy | rotating `mdi:refresh` | `var(--primary-color)` | `Обновление данных` |
| Success | static `mdi:check` | green `#43a047` | `Запрос обновления выполнен` |
| Error | static `mdi:alert-circle-outline` | red `#e53935` | `Не удалось обновить данные` |

Success requires an explicit successful result from the declared refresh API.
A caught exception or returned `false` must not become success merely because the
promise resolved. If several required requests form one refresh, all must settle
successfully before the check appears; partial failure uses the error state.
A rejected request, missing update service or absence of refreshable entities must
also produce a visible message such as `Не удалось обновить данные`.
Technical details must not disclose credentials or tokens.

The result is informational and does not lock out a deliberate retry. On a new
accepted activation, cancel the previous result timer, clear the old result and
enter busy immediately. An old timer or completion callback must never overwrite
a newer request's state. Dispose of result timers on panel removal; late callbacks
must not update a disconnected or replacement panel.

The canonical `44px × 44px` plaque, `25px` glyph, border, background and Header
rail remain unchanged in every state. Only the glyph, its color and accessible
status change for success/error. Do not add a separate check button, resize the
control, flash the whole Header or use a panel-wide loading CSS class for the button.

Successful completion of the request does not by itself prove that every device supplied a new sample. Never mark preserved telemetry current, change its timestamp, or turn a status healthy merely because the animation ended. Freshness changes only when factual new data is accepted.

### REFRESH-05 — Preserve the user's context

Patch the mounted UI; do not rebuild the panel or call `location.reload()`. Keep Header, selected tab/peer, work viewport, scroll, zoom and unsubmitted editor draft. New telemetry may update untouched fields according to the product's existing editor contract, but refresh must not submit or silently discard user edits. The button keeps its size and rail so the title does not move.

### REFRESH-06 — Stable busy state during rendering

Ordinary Home Assistant updates and tab changes must not replace the Header button, lose its busy or result state, restart its animation/result timer or re-enable it early. Reconciliation restores the current state on the mounted control, including the check/error glyph for the remaining result interval. Unchanged state must not cause unnecessary DOM writes.

### REFRESH-07 — Accessibility and reduced motion

Use a semantic button with an accessible name. While busy expose `aria-busy="true"`, disabled semantics and a name such as `Обновление данных`. During success/error clear busy semantics, use the result name from the table, and restore `Обновить` after 1400 ms. Announce the result through an accessible status region when changing the button name alone is not announced. With `prefers-reduced-motion: reduce`, suppress rotation but retain a visibly distinct static busy surface and accessible status; success/error glyphs still appear without animation for 1400 ms. Neither busy nor result may be signalled by color alone.

## Required production regression cases

The owning panel's CI must execute its registered production entrypoint and assert behavior, not only search source text for `busy`, CSS animation or a function name. Test the actual button-to-handler wiring and exact allowed service/API call. The following case identifiers are part of the machine contract:

| Case | Required assertion |
|---|---|
| `activation` | Pointer and keyboard activation start the real permitted request and immediately expose busy state. |
| `fast_success` | An immediately settled request shows busy for at least 900 ms, then a green check for 1400 ms, then the idle arrow. |
| `slow_success` | A request exceeding 900 ms remains busy/disabled until it settles; no timer produces false completion. |
| `duplicate_activation` | Repeat taps, keyboard events and handler calls during busy produce only one request. |
| `failure_cleanup` | Rejection or returned false shows a red error glyph and message, clears busy, and restores the arrow after 1400 ms; retry is possible. |
| `unavailable_targets` | Missing service or no refreshable entities produce visible failure and no false success. |
| `render_stability` | State updates and tab changes preserve the control, active request, result glyph and original result deadline. |
| `context_preservation` | Refresh preserves tab/peer, scroll, zoom and unsubmitted editor changes, without page reload. |
| `reduced_motion` | Browser-computed reduced-motion styling stops rotation but keeps visible busy feedback and ARIA. |
| `truthful_freshness` | Completion without a new accepted sample does not invent a fresh timestamp or healthy state. |
| `result_presentation` | Browser-computed glyph, color, accessible name and 1400 ms result interval match the table; plaque and Header geometry remain unchanged. |
| `retry_during_result` | A new activation clears the old result; its timer cannot clear the newer busy/result state or issue a duplicate request. |
| `partial_failure` | One failed required subrequest prevents a green check even if all other requests succeeded. |
| `disconnect_cleanup` | Panel removal clears result timers and isolates late completions from a replacement panel. |

A static contract check is additional protection, not a substitute for these behavioral tests. Browser checks are required for actual animation, reduced-motion styling and visual geometry; a fake DOM or screenshot alone does not prove them.

## Acceptance and adoption

Include the refresh action in the v2.2 mandatory viewport matrix. Check rapid repeat activation, a slow response and a rejected response on the phone; ensure there is no title shift, viewport reset or lost draft. A still screenshot cannot establish that an icon rotates.

This registry stores the rule, its digest and its regression-case list. Registry CI protects that agreement from deletion or silent weakening; it does not execute every panel's runtime. Each owning repository records implementation, production-test evidence and phone/browser acceptance separately. Missing evidence is `GAP`, not an assumed pass. HO-SC-8W PR #170 is the initial fix, not certification of every case above or of other NikaS panels.
