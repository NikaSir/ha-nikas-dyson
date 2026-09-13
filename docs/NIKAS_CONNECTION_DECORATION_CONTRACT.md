# NikaS Connection Plaque and Blue Corner Contract v1.1

**Status:** REQUIRED where the respective element is enabled.

**Authority:** `NikaSir/ha-contract-generated-ui`, NikaS UI Standard v2.2.

**Decision date:** 2026-09-08.

**Visual lineage:** S8 OMNI UI v1.0.4, compact phone layout. Revision 1.1 restores
its `168px` width and `13px` top/right inset at the user's request. The `58px`
height is now an exact compact specification; the source used only
`min-height:58px` and its full text stack could make the box about `60.45px` high.
The numbers below are normative across all supported widths; copying a moving
product implementation is not an acceptance criterion.

## 1. Scope and ownership

This contract fixes the two-line connection/freshness plaque («Связь») and the
separate pale-blue circle clipped by the upper-right corner of the operational
card. The circle is a background decoration with no status meaning or action.
The Header refresh button remains governed by `NIKAS_REFRESH_ACTION_CONTRACT.md`.

Apply this geometry to every requested instance, initially S8 OMNI, Climate and
HO-SC-8W. This does not add a connection plaque to StarLine or «Дом сейчас», or
introduce decoration into panels where it has not been requested.

All dimensions are CSS pixels at work scale 100%. Both elements belong to the
work card, scroll with it and scale together with the work area at 75–200%.
They are never independently scaled or fixed to the browser window. The Header,
peer selector and Bottom Tab Bar retain their existing native-scale contract.

## 2. One coordinate system

The containing operational card has `position:relative`, `isolation:isolate`,
`box-sizing:border-box`, a `1px` border and `16px` internal padding. Its outer
radius and approved domain composition remain owned by the panel. Clip only
the decoration layer to that same numeric radius; do not clip controls or focus rings.
The inset-zero layer starts inside the 1px border and inherits the outer radius
numerically, exactly as in §5; do not subtract 1px in individual panels.

The origin for offsets is the card's **inner border edge** (CSS absolute
positioning containing block). Let `C` be the card's outer border rectangle.
At 100%, with the required 1px card border:

| Element | Exact rectangle / anchor |
|---|---|
| Connection plaque | width `168px`, height `58px`, top `13px`, right `13px` |
| Plaque outer coordinates | top `C.top + 14px`; right `C.right − 14px` |
| Blue circle, before clipping | width `205px`, height `205px`, top `−92px`, right `−70px` |
| Circle outer coordinates | top `C.top + 1px − 92px`; right `C.right − 1px + 70px` |

The plaque is anchored to the card, not vertically centered against an image,
title, state text, remaining time or metrics. The card's top origin for a given
route/layout cannot depend on telemetry, image loading or status copy. Dynamic
messages appear below its reserved heading area, without shifting the card.
Different shell rows (for example an enabled peer selector) naturally change
the screen coordinate; compare the same host, route, scroll and work scale.

Reserve `177px` on the right of the state-heading area and at least `58px`
heading height. The card keeps its `16px` internal padding, while the plaque
uses a `13px` inset: `168 + 12 + 13 − 16 = 177px` leaves exactly `12px`
between the title column and the plaque. The state/title may wrap in its own column.
If the card's outer width is below `360px`, keep the plaque at the **same
top/right anchor**, reserve `67px` above the title and let the title span the
width below it. Relative to the padded content, `13 + 58 + 12 − 16 = 67px`
leaves exactly `12px` below the plaque. This one breakpoint depends on card width, never on status or
text length. It moves the title only; the plaque does not move, shrink or grow.
Keep a `12px` gap from the complete heading area to the separate image block.
Operational text and the plaque must not overlay the device image.

## 3. Exact connection plaque tokens

| Property | Required value |
|---|---|
| Box model | `border-box`; width/min-width/max-width `168px`; height/min-height/max-height `58px` |
| Placement | absolute; top `13px`; right `13px`; margin `0`; `z-index:2` |
| Padding / border / radius | `11px 12px` / `1px solid` / `18px` |
| Internal grid | `10px minmax(0,1fr)`; column gap `9px`; `align-items:center` |
| Lamp | `10px × 10px`; circle; no flex shrink; no extra halo |
| Text stack | vertical flex; gap `3px`; left aligned; no wrapping |
| Shared font stack | `-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Arial,sans-serif` |
| Main line | font size `16px`; weight `700`; line-height `17px` |
| Freshness line | font size `13px`; weight `600`; line-height `14px` |
| Typography reset | margin/padding `0`; letter-spacing `0`; font-style `normal`; text-transform `none` |
| Shadow | `0 4px 14px rgba(0,0,0,.055)` |

The text stack is exactly `34px` high (`17 + 3 + 14`); padding and border add
`24px`, producing the explicit `58px` border box. The text column is `123px`
wide. All canonical Russian labels must fit in full; ellipsis, clipping and
font shrinking are failures. Use the same font stack in every panel, without
domain-specific or HA-theme font overrides. Platform font selection is allowed
only through this common stack; physical glyph rasterization may vary by OS.

Revision 1.1 supersedes the v1.0 `200px × 60px` box and `16px` top/right
inset. It retains fixed sizing instead of restoring the source's proportional
width, minimum-only height or left-stacked narrow-screen variants. Horizontal
padding `12px` and column gap `9px` follow the compact S8 source; vertical
padding `11px` makes the exact `58px` height fit the unchanged `17px`/`14px`
line heights and `3px` text gap. Do not restore `12px` vertical padding inside
this smaller box: it would require `60px` and conflict with the fixed height.

Transport/freshness semantics and state surface colors remain those of
UI Standard v2.2 §8, including no false green for unknown/untrusted data.
State changes may update text, accessible descriptions and the state palette;
they may not change any geometry or typography token above.

## 4. Exact blue decoration tokens

| Property | Required value |
|---|---|
| Shape | one circle; border radius `50%` |
| Size | `205px × 205px`; no min/max or aspect-dependent alternatives |
| Anchor | absolute; top `−92px`; right `−70px` from the card's inner border edge |
| Base blue | `#03A9D9` (RGB `3,169,217`) |
| Fill | `rgba(3,169,217,0.07)`; element opacity `1` |
| Effects | border `0`; shadow `none`; filter `none`; transform `none`; animation `none` |
| Clipping | persistent inset-zero decoration layer, same outer radius as the card, `overflow:hidden` |
| Layer | decoration `z-index:0`; normal content `1`; plaque `2` |
| Interaction | `pointer-events:none`; `aria-hidden="true"` on the decoration layer; no focus target |

Do not use `var(--primary-color)` for this decoration: an integration or theme
accent must not turn it another color. Its specified translucent fill is the
same in light and dark themes; the final composited pixel naturally depends on
the card background. Do not apply opacity a second time to the containing
layer. No gradient, image asset, state tint, pulse, mobile resizing, orientation
override or per-panel offset is allowed. The persistent clipping layer must
not take layout space or create horizontal scroll overflow.

## 5. Reference geometry CSS

This is a geometry reference, not a panel replacement. Use exact component
selectors in the panel's own shadow root; preserve its factual state model.
The ancestor containing `.nikas-status-heading` establishes the named `nikas-card`
inline-size container on the card. CSS content width is outer width minus
`34px` (two borders and two 16px paddings), so `326px` corresponds to the
`360px` outer-card breakpoint.

```css
.nikas-status-card {
  position: relative;
  isolation: isolate;
  box-sizing: border-box;
  border-width: 1px;
  border-style: solid;
  padding: 16px;
  container: nikas-card / inline-size;
}
.nikas-card-decoration {
  position: absolute;
  inset: 0;
  border-radius: inherit;
  overflow: hidden;
  z-index: 0;
  pointer-events: none;
}
.nikas-card-decoration::before {
  content: "";
  position: absolute;
  top: -92px;
  right: -70px;
  width: 205px;
  height: 205px;
  border: 0;
  border-radius: 50%;
  background: rgba(3,169,217,0.07);
  opacity: 1;
  box-shadow: none;
  filter: none;
  transform: none;
  animation: none;
}
.nikas-status-content {
  position: relative;
  z-index: 1;
  min-width: 0;
}
.nikas-status-heading {
  box-sizing: border-box;
  min-height: 58px;
  padding-right: 177px;
}
.nikas-status-image {
  margin-top: 12px;
}
.nikas-connection-plaque {
  position: absolute;
  top: 13px;
  right: 13px;
  z-index: 2;
  box-sizing: border-box;
  width: 168px;
  min-width: 168px;
  max-width: 168px;
  height: 58px;
  min-height: 58px;
  max-height: 58px;
  margin: 0;
  padding: 11px 12px;
  border: 1px solid var(--nikas-connection-border);
  border-radius: 18px;
  display: grid;
  grid-template-columns: 10px minmax(0,1fr);
  column-gap: 9px;
  align-items: center;
  background: var(--nikas-connection-background);
  box-shadow: 0 4px 14px rgba(0,0,0,.055);
  font-family: -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Arial,sans-serif;
  font-style: normal;
  letter-spacing: 0;
  text-transform: none;
  text-align: left;
  white-space: nowrap;
  transition: none;
  animation: none;
}
.nikas-connection-lamp {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: var(--nikas-connection-main-color);
}
.nikas-connection-text {
  display: flex;
  flex-direction: column;
  gap: 3px;
  min-width: 0;
}
.nikas-connection-main {
  margin: 0;
  padding: 0;
  font: 700 16px/17px -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Arial,sans-serif;
  color: var(--nikas-connection-main-color);
}
.nikas-connection-freshness {
  margin: 0;
  padding: 0;
  font: 600 13px/14px -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Arial,sans-serif;
  color: var(--nikas-connection-freshness-color);
}
@container nikas-card (width < 326px) {
  .nikas-status-heading {
    padding-right: 0;
    padding-top: 67px;
  }
}
```

The decoration layer, the content layer and the plaque are direct children of
the card. Set the four state color variables on the plaque from §8; these are
the only appearance inputs permitted to vary with connection/freshness state.
`aria-hidden="true"` belongs on the decoration layer only. Expose both plaque
lines to assistive technology; do not hide operational state with the decoration.

## 6. Forbidden sources of drift

- `fit-content`, content-measured sizing, percentage widths, `flex-shrink`,
  `align-items:center` against the Hero image, or a left-aligned mobile plaque.
- `clamp()`, viewport/container font units, status-specific fonts, implicit
  `normal` line-height, UA `strong`/`small` styling or inherited product fonts.
- Wildcard overrides such as `[class*="connection"]` or broad `strong`, `small`,
  `span`, `ha-icon` rules that alter internal geometry. One historical wildcard
  turned the circular lamp into a horizontal bar.
- Appending another CSS patch to override earlier conflicting rules. Replace
  the old component rule and remove obsolete responsive variants instead.
- Remounting either element, retinting/repositioning the circle on status
  change, animated layout or using image dimensions as a positioning input.

## 7. Required acceptance evidence

Check the **actual production entrypoint**, not an obsolete imported ancestor
or a standalone drawing alone. Record commit SHA, UI version, environment,
viewport/host/card widths, work scale, computed styles and measured rectangles.

1. At 100%, both rectangles and every typography token match §§2–4. Computed
   numeric tokens must be exact; allow at most `1 CSS px` measurement rounding
   for rendered coordinates. A size/position delta caused by a state-only
   update must be `0` (at most `0.1 CSS px` numeric measurement noise).
2. Run all 15 transport/freshness label combinations as a **layout-only fixture**;
   this does not make impossible combinations valid domain states. Show the
   longest labels fully, with no overlap, ellipsis or lamp deformation.
3. Exercise factual local/cloud/reserve, outage, stale, no-data and recovery
   transitions. The same plaque and decoration DOM nodes remain mounted.
   Refresh busy/success/error and ten peer/tab changes must not alter anchors.
4. Vary adjacent title length, line count, remaining-time copy and image loading.
   Neither element moves. Test card outer widths `359`, `360`, `361px` and the
   narrow phone widths `320`, `360px`; the title alone reflows at the breakpoint.
5. Run the standard phone/tablet/desktop matrix with the HA sidebar open/closed;
   compare card-relative coordinates. Scroll, resize, orientation and zoom
   `75/100/150/200%`, then two-finger reset, must preserve the same local tokens
   without horizontal overflow at 100% or an extra scroll/zoom owner.
6. In light/dark themes and with a non-blue HA primary color, the circle keeps
   `rgba(3,169,217,0.07)` and its exact clip/position. Verify the clipping layer
   does not intercept input. Confirm iOS/HA font rendering separately.

Any unexplained shift, local token override or missing production evidence is
a blocking UI defect (`GAP` / `not_verified` until checked). A passing registry
hash/token check validates the specification only. It does not certify a panel
as conforming or claim that this documentation update changes installed UI.
