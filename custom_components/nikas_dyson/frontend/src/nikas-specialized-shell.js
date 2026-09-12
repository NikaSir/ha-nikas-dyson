/* NikaS specialized panel shell source kit v2.1.
 * Copy this file into a panel repository at build time and concatenate it into
 * that panel's single autonomous production bundle. Runtime imports are forbidden.
 */

const NIKAS_SHELL_V2_VERSION = "2.1";
const NIKAS_SOURCE_ROUTE_KEY = "nikas.specialized.source_route.v1";
const NIKAS_SOURCE_ROUTE_AT_KEY = "nikas.specialized.source_route_at.v1";
const NIKAS_SOURCE_ROUTE_MAX_AGE_MS = 30_000;
const NIKAS_SHELL_BOUNDARY_THRESHOLD_PX = 4;

const NIKAS_BASE_ROUTES = Object.freeze([
  Object.freeze({ root: "/dashboard-house-v13", entry: "/dashboard-house-v13/home" }),
  Object.freeze({ root: "/dashboard-rooms-v11", entry: "/dashboard-rooms-v11/rooms" }),
  Object.freeze({ root: "/dashboard-actions", entry: "/dashboard-actions/home" }),
  Object.freeze({ root: "/dashboard-infrastructure", entry: "/dashboard-infrastructure/overview" }),
]);
const NIKAS_SPECIALIZED_ROOTS = Object.freeze([
  "/dashboard-access-v1",
  "/dashboard-zont",
  "/starline",
  "/dashboard-s8-omni",
  "/dashboard-irrigation",
  "/dashboard-ups",
  "/dashboard-keenetic",
  "/dashboard-lider",
  "/dashboard-water-accounting",
]);

function nikasShellV2Styles() {
  return `
    :host{
      display:block;position:relative;inline-size:100%;block-size:100%;min-inline-size:0;min-block-size:0;
      overflow:hidden;overscroll-behavior:none;color:var(--primary-text-color,#15191d);
      background:var(--primary-background-color,#f4f6f8);
      font-family:var(--paper-font-body1_-_font-family,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif)
    }
    *{box-sizing:border-box}
    [hidden]{display:none!important}
    button{appearance:none;-webkit-appearance:none;font:inherit;touch-action:manipulation;-webkit-tap-highlight-color:transparent}
    .nikas-shell{
      position:absolute;inset:0;inline-size:100%;block-size:100%;display:grid;min-inline-size:0;min-block-size:0;
      container:nikas-panel / inline-size;
      grid-template-areas:"header" "viewport" "tabs";
      grid-template-rows:calc(60px + env(safe-area-inset-top,0px)) minmax(0,1fr)
        calc(64px + env(safe-area-inset-bottom,0px));
      overflow:hidden;overscroll-behavior:none;background:var(--primary-background-color,#f4f6f8)
    }
    .nikas-shell--with-peer{
      grid-template-areas:"header" "peer" "viewport" "tabs";
      grid-template-rows:calc(60px + env(safe-area-inset-top,0px)) 52px minmax(0,1fr)
        calc(64px + env(safe-area-inset-bottom,0px))
    }
    .nikas-shell__header{
      grid-area:header;position:relative;z-index:20;min-inline-size:0;
      padding:env(safe-area-inset-top,0px) calc(12px + env(safe-area-inset-right,0px)) 0
        calc(12px + env(safe-area-inset-left,0px));
      display:grid;grid-template-columns:52px minmax(0,1fr) 52px;align-items:center;
      background:color-mix(in srgb,var(--primary-background-color,#f4f6f8) 97%,transparent);
      border-bottom:1px solid color-mix(in srgb,var(--divider-color,#dfe3e8) 70%,transparent);
      backdrop-filter:blur(18px) saturate(130%);-webkit-backdrop-filter:blur(18px) saturate(130%)
    }
    .nikas-shell__side-action{
      inline-size:44px;block-size:44px;padding:0;
      border:1px solid color-mix(in srgb,var(--divider-color,#dfe3e8) 72%,transparent);
      border-radius:16px;background:var(--card-background-color,#fff);box-shadow:0 7px 20px rgba(23,45,76,.08);
      display:grid;place-items:center;color:var(--primary-text-color,#17191c);cursor:pointer
    }
    .nikas-shell__side-action--right{justify-self:end;color:var(--primary-color,#03a9d9)}
    .nikas-shell__side-action:disabled{opacity:.55;cursor:wait}
    .nikas-shell__side-action ha-icon{--mdc-icon-size:25px}
    .nikas-shell__title{
      justify-self:center;inline-size:min(360px,100%);block-size:52px;padding:5px 14px;
      border:1px solid color-mix(in srgb,var(--primary-color,#03a9d9) 24%,var(--divider-color,#dfe3e8));
      border-radius:16px;background:color-mix(in srgb,var(--primary-color,#03a9d9) 5%,var(--card-background-color,#fff));
      box-shadow:0 5px 16px rgba(23,45,76,.06);color:inherit;display:grid;place-content:center;
      text-align:center;cursor:pointer;line-height:1.08
    }
    .nikas-shell__title strong{display:block;max-inline-size:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:23px;font-weight:800}
    .nikas-shell__title small{display:block;font-size:14px;font-weight:560;color:var(--secondary-text-color,#68737d)}
    .nikas-shell__title:active{
      transform:scale(.985);border-color:color-mix(in srgb,var(--primary-color,#03a9d9) 42%,var(--divider-color,#dfe3e8));
      background:color-mix(in srgb,var(--primary-color,#03a9d9) 13%,var(--card-background-color,#fff));
      box-shadow:0 2px 7px rgba(23,45,76,.05)
    }
    .nikas-shell__title:focus-visible,.nikas-shell__side-action:focus-visible{
      outline:2px solid var(--primary-color,#03a9d9);outline-offset:2px
    }
    .nikas-shell__side-action:active:not(:disabled){transform:scale(.985)}
    .nikas-shell__peer{grid-area:peer;min-inline-size:0;min-block-size:0}
    .nikas-shell__viewport{
      grid-area:viewport;position:relative;z-index:1;min-inline-size:0;min-block-size:0;
      overflow-y:auto;overflow-x:hidden;overscroll-behavior-x:none;overscroll-behavior-y:none;touch-action:pan-y;
      background:var(--primary-background-color,#f4f6f8);-webkit-overflow-scrolling:touch;overflow-anchor:none
    }
    .nikas-shell__viewport.zoomed{overflow:hidden;touch-action:none}
    .nikas-shell__canvas{inline-size:100%;min-block-size:100%;transform-origin:0 0}
    .nikas-shell__content{
      inline-size:100%;max-inline-size:1280px;min-block-size:100%;margin:0 auto;padding:12px 12px 20px
    }
    .nikas-shell__tabs{
      grid-area:tabs;position:relative;z-index:20;min-inline-size:0;min-block-size:0;
      padding:6px calc(6px + env(safe-area-inset-right,0px))
        calc(6px + env(safe-area-inset-bottom,0px)) calc(6px + env(safe-area-inset-left,0px));
      display:grid;grid-template-columns:repeat(var(--nikas-shell-tab-count,4),minmax(0,1fr));gap:2px;
      background:var(--card-background-color,#fff);border-top:1px solid var(--divider-color,#dfe3e8);
      box-shadow:0 -5px 22px rgba(23,45,76,.08)
    }
    .nikas-shell__tab{
      min-inline-size:0;block-size:52px;padding:2px 3px 6px;border:0;border-radius:16px;background:transparent;
      color:var(--secondary-text-color,#68737d);display:flex;flex-direction:column;align-items:center;
      justify-content:center;gap:1px;overflow:hidden;font-family:inherit;font-weight:700;line-height:1;cursor:pointer
    }
    .nikas-shell__tab ha-icon{--mdc-icon-size:26px;display:block;flex:0 0 26px}
    .nikas-shell__tab small{display:block;flex:0 0 14px;max-inline-size:100%;font-family:inherit;font-size:12px;font-weight:700;line-height:14px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .nikas-shell__tab.active{
      color:var(--primary-color,#2186d7);background:color-mix(in srgb,var(--primary-color,#2186d7) 11%,transparent)
    }
    @container nikas-panel (min-width:600px){.nikas-shell__content{padding-inline:16px}}
    @container nikas-panel (min-width:1024px){.nikas-shell__content{padding-inline:24px}}
    @container nikas-panel (max-width:359px){
      .nikas-shell__header{grid-template-columns:48px minmax(0,1fr) 48px}
      .nikas-shell__title{inline-size:100%;padding-inline:8px}
      .nikas-shell__title strong{font-size:21px}.nikas-shell__title small{font-size:13px}
    }
  `;
}

function shouldBlockNikasShellBoundaryMove({
  deltaX,
  deltaY,
  inViewport,
  scrollTop,
  scrollHeight,
  clientHeight,
}) {
  if (!Number.isFinite(deltaY) || Math.abs(deltaY) <= Math.abs(Number(deltaX) || 0)) return false;
  if (!inViewport) return true;
  const maximumScroll = Math.max(0, (Number(scrollHeight) || 0) - (Number(clientHeight) || 0));
  if (maximumScroll <= 1) return true;
  const currentScroll = Math.max(0, Number(scrollTop) || 0);
  if (deltaY > 0 && currentScroll <= 1) return true;
  return deltaY < 0 && currentScroll >= maximumScroll - 1;
}

function createNikasShellScrollBoundaryGuard({ host, viewport }) {
  if (!host?.addEventListener || !viewport) return () => {};
  let touch = null;

  const eventStartedInViewport = (event) => {
    const path = typeof event.composedPath === "function" ? event.composedPath() : [];
    return path.includes(viewport) || Boolean(viewport.contains?.(event.target));
  };
  const rememberTouch = (event) => {
    if (event.touches.length !== 1) {
      touch = null;
      return;
    }
    const current = event.touches[0];
    touch = {
      x: current.clientX,
      y: current.clientY,
      startX: current.clientX,
      startY: current.clientY,
      inViewport: eventStartedInViewport(event),
      blocked: false,
    };
  };
  const moveTouch = (event) => {
    if (event.touches.length !== 1) {
      touch = null;
      return;
    }
    const current = event.touches[0];
    if (!touch) {
      rememberTouch(event);
      return;
    }
    const deltaX = current.clientX - touch.x;
    const deltaY = current.clientY - touch.y;
    const travelX = current.clientX - touch.startX;
    const travelY = current.clientY - touch.startY;
    touch.x = current.clientX;
    touch.y = current.clientY;
    const verticalIntent = Math.abs(travelY) > NIKAS_SHELL_BOUNDARY_THRESHOLD_PX
      && Math.abs(travelY) > Math.abs(travelX);
    if (!touch.blocked && verticalIntent) {
      touch.blocked = shouldBlockNikasShellBoundaryMove({
        deltaX,
        deltaY,
        inViewport: touch.inViewport,
        scrollTop: viewport.scrollTop,
        scrollHeight: viewport.scrollHeight,
        clientHeight: viewport.clientHeight,
      });
    }
    if (touch.blocked && event.cancelable) {
      event.preventDefault();
    }
  };
  const endTouch = (event) => {
    if (event.touches.length === 1) rememberTouch(event);
    else touch = null;
  };
  const cancelTouch = () => {
    touch = null;
  };

  host.addEventListener("touchstart", rememberTouch, { passive: false, capture: true });
  host.addEventListener("touchmove", moveTouch, { passive: false, capture: true });
  host.addEventListener("touchend", endTouch, { passive: true, capture: true });
  host.addEventListener("touchcancel", cancelTouch, { passive: true, capture: true });

  return () => {
    host.removeEventListener("touchstart", rememberTouch, true);
    host.removeEventListener("touchmove", moveTouch, true);
    host.removeEventListener("touchend", endTouch, true);
    host.removeEventListener("touchcancel", cancelTouch, true);
    touch = null;
  };
}

function normalizeNikasBaseRoute(value) {
  if (typeof value !== "string" || !value || value.startsWith("//")) return null;
  try {
    const url = new URL(value, window.location.origin);
    if (url.origin !== window.location.origin) return null;
    const match = NIKAS_BASE_ROUTES.find(
      ({ root }) => url.pathname === root || url.pathname.startsWith(`${root}/`),
    );
    return match?.entry || null;
  } catch (_error) {
    return null;
  }
}

function consumeNikasSourceHandoff(now = Date.now()) {
  let route = null;
  let timestamp = null;
  try {
    route = window.sessionStorage.getItem(NIKAS_SOURCE_ROUTE_KEY);
    timestamp = window.sessionStorage.getItem(NIKAS_SOURCE_ROUTE_AT_KEY);
  } catch (_error) {
    return null;
  } finally {
    try {
      window.sessionStorage.removeItem(NIKAS_SOURCE_ROUTE_KEY);
      window.sessionStorage.removeItem(NIKAS_SOURCE_ROUTE_AT_KEY);
    } catch (_error) {
      // Storage is optional; both values were still consumed for this mount.
    }
  }
  if (!route || !timestamp) return null;
  const createdAt = Number(timestamp);
  const age = now - createdAt;
  if (!Number.isFinite(createdAt) || age < 0 || age > NIKAS_SOURCE_ROUTE_MAX_AGE_MS) return null;
  return normalizeNikasBaseRoute(route);
}

function captureNikasShellReturnRoute({ panelId, parentRoute, safeReturnRoute }) {
  const savedKey = `nikas.${panelId}.return_route.v1`;
  const params = new URLSearchParams(window.location.search);
  const handoff = consumeNikasSourceHandoff();
  let saved = null;
  try {
    saved = window.localStorage.getItem(savedKey);
  } catch (_error) {
    // Saved return routes are an optional convenience.
  }
  const candidates = [
    ...params.getAll("return_to"),
    ...params.getAll("from"),
    handoff,
    saved,
    document.referrer,
    parentRoute,
    safeReturnRoute,
  ];
  const accepted = candidates.map(normalizeNikasBaseRoute).find(Boolean)
    || NIKAS_BASE_ROUTES[0].entry;
  try {
    window.localStorage.setItem(savedKey, accepted);
  } catch (_error) {
    // The captured route remains stable for the mounted panel instance.
  }
  return accepted;
}

function rememberNikasSpecializedSourceRoute(destination) {
  if (typeof destination !== "string" || !destination.startsWith("/")) return false;
  const target = new URL(destination, window.location.origin);
  const isSpecialized = target.origin === window.location.origin && NIKAS_SPECIALIZED_ROOTS.some(
    (root) => target.pathname === root || target.pathname.startsWith(`${root}/`),
  );
  if (!isSpecialized) return false;
  const sourceRoute = normalizeNikasBaseRoute(window.location.pathname);
  if (!sourceRoute) return false;
  try {
    window.sessionStorage.setItem(NIKAS_SOURCE_ROUTE_KEY, sourceRoute);
    window.sessionStorage.setItem(NIKAS_SOURCE_ROUTE_AT_KEY, String(Date.now()));
    return true;
  } catch (_error) {
    try {
      window.sessionStorage.removeItem(NIKAS_SOURCE_ROUTE_KEY);
      window.sessionStorage.removeItem(NIKAS_SOURCE_ROUTE_AT_KEY);
    } catch (_storageError) {
      // Destination navigation remains available without storage.
    }
    return false;
  }
}

function navigateNikasShell(path, { captureSource = false } = {}) {
  if (typeof path !== "string" || !path.startsWith("/") || path.startsWith("//")) return false;
  const target = new URL(path, window.location.origin);
  if (target.origin !== window.location.origin) return false;
  const destination = `${target.pathname}${target.search}${target.hash}`;
  const current = `${window.location.pathname}${window.location.search}${window.location.hash}`;
  if (current === destination) return true;
  if (captureSource) rememberNikasSpecializedSourceRoute(destination);
  window.history.pushState(null, "", destination);
  window.dispatchEvent(new Event("location-changed"));
  return true;
}
