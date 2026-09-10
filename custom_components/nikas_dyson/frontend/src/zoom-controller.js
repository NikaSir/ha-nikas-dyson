// Gesture-only hybrid zoom controller for the VLESS Gateway panel.
// At 100% the viewport owns native vertical scrolling. Transform panning starts only above 100%.
(() => {
  if (window.NikasDysonZoom?.version === 2) return;

  const DEFAULT_MIN = 0.75;
  const DEFAULT_MAX = 2.0;
  const PAN_THRESHOLD = 6;
  const TAP_DURATION = 300;
  const DOUBLE_TAP_GAP = 420;
  const CLICK_GUARD = 460;
  const AUTO_TARGETS = new Set(["NIKAS-DYSON-PANEL"]);
  const controllers = new WeakMap();
  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
  const finite = (value, fallback) => Number.isFinite(Number(value)) ? Number(value) : fallback;

  class ZoomController {
    constructor(host, options = {}) {
      this.host = host;
      this.options = options;
      this.root = host.shadowRoot || host;
      this.viewport = null;
      this.canvas = null;
      this.state = { scale: 1, x: 0, y: 0 };
      this.session = null;
      this.lastTwoFingerTap = 0;
      this.suppressClicksUntil = 0;
      this.resizeObserver = null;
      this.boundStart = (event) => this._touchStart(event);
      this.boundMove = (event) => this._touchMove(event);
      this.boundEnd = (event) => this._touchEnd(event);
      this.boundGuard = (event) => this._guardActivation(event);
      this.observer = new MutationObserver(() => queueMicrotask(() => this.bind()));
      this.observer.observe(this.root, { childList: true, subtree: true });
      this.bind();
    }

    _min() { return clamp(finite(this.options.min, DEFAULT_MIN), 0.25, 1); }
    _max() { return clamp(finite(this.options.max, DEFAULT_MAX), 1, 4); }

    _panelKey() {
      const config = this.host?.panel?.config || this.host?.panel || {};
      const panel = this.options.key || config.id || this.host.localName || "specialized-panel";
      const device = this.host?._selectedDeviceId || this.host?._selectedDevice || "panel";
      return `${window.location.pathname}:${panel}:${device}`;
    }

    _storageKey() { return `nikas:panel-transform:v2:${this._panelKey()}`; }

    _loadState() {
      this.state = { scale: 1, x: 0, y: 0 };
      try {
        const stored = JSON.parse(window.localStorage.getItem(this._storageKey()) || "null");
        if (!stored) return;
        this.state = {
          scale: clamp(finite(stored.scale, 1), this._min(), this._max()),
          x: finite(stored.x, 0),
          y: finite(stored.y, 0),
        };
        if (this.state.scale <= 1) this.state = { scale: this.state.scale, x: 0, y: 0 };
      } catch (_error) {
        // Local persistence is optional.
      }
    }

    _saveState() {
      try { window.localStorage.setItem(this._storageKey(), JSON.stringify(this.state)); }
      catch (_error) { /* Keep the current session operational. */ }
    }

    bind() {
      const viewport = this.root.querySelector?.(".nikas-shell__viewport");
      const canvas = viewport?.querySelector?.(":scope > .nikas-shell__canvas");
      if (!viewport || !canvas) return;
      if (viewport === this.viewport && canvas === this.canvas) return;
      this._detach();
      this.viewport = viewport;
      this.canvas = canvas;
      this._loadState();
      viewport.addEventListener("touchstart", this.boundStart, { passive: false });
      viewport.addEventListener("touchmove", this.boundMove, { passive: false });
      viewport.addEventListener("touchend", this.boundEnd, { passive: false });
      viewport.addEventListener("touchcancel", this.boundEnd, { passive: false });
      viewport.addEventListener("click", this.boundGuard, true);
      viewport.addEventListener("contextmenu", this.boundGuard, true);
      if (typeof ResizeObserver === "function") {
        this.resizeObserver = new ResizeObserver(() => this._clampAndApply());
        this.resizeObserver.observe(viewport);
        this.resizeObserver.observe(canvas);
      }
      this._clampAndApply();
    }

    _detach() {
      this.resizeObserver?.disconnect();
      this.resizeObserver = null;
      if (!this.viewport) return;
      this.viewport.removeEventListener("touchstart", this.boundStart);
      this.viewport.removeEventListener("touchmove", this.boundMove);
      this.viewport.removeEventListener("touchend", this.boundEnd);
      this.viewport.removeEventListener("touchcancel", this.boundEnd);
      this.viewport.removeEventListener("click", this.boundGuard, true);
      this.viewport.removeEventListener("contextmenu", this.boundGuard, true);
      this.viewport = null;
      this.canvas = null;
    }

    _distance(touches) {
      return Math.hypot(touches[0].clientX - touches[1].clientX, touches[0].clientY - touches[1].clientY);
    }

    _midpoint(touches) {
      return { x: (touches[0].clientX + touches[1].clientX) / 2, y: (touches[0].clientY + touches[1].clientY) / 2 };
    }

    _bounds(scale = this.state.scale) {
      if (!this.viewport || !this.canvas || scale <= 1) return { minX: 0, minY: 0 };
      const width = Math.max(this.canvas.offsetWidth, this.canvas.scrollWidth);
      const height = Math.max(this.canvas.offsetHeight, this.canvas.scrollHeight);
      const availableWidth = Math.max(0, this.viewport.clientWidth - this.canvas.offsetLeft);
      const availableHeight = Math.max(0, this.viewport.clientHeight - this.canvas.offsetTop);
      return {
        minX: Math.min(0, availableWidth - width * scale),
        minY: Math.min(0, availableHeight - height * scale),
      };
    }

    _clampState(scale, x, y) {
      const safeScale = clamp(finite(scale, 1), this._min(), this._max());
      if (safeScale <= 1) return { scale: safeScale, x: 0, y: 0 };
      const bounds = this._bounds(safeScale);
      return {
        scale: safeScale,
        x: clamp(finite(x, 0), bounds.minX, 0),
        y: clamp(finite(y, 0), bounds.minY, 0),
      };
    }

    _apply() {
      if (!this.viewport || !this.canvas) return;
      const zoomed = this.state.scale > 1.0001;
      if (!zoomed) this.state = { scale: this.state.scale, x: 0, y: 0 };
      this.viewport.classList.toggle("zoomed", zoomed);
      this.canvas.style.transform = `translate3d(${this.state.x}px, ${this.state.y}px, 0) scale(${this.state.scale})`;
      this.canvas.classList.add("ready");
    }

    _clampAndApply() {
      this.state = this._clampState(this.state.scale, this.state.x, this.state.y);
      this._apply();
      this._saveState();
    }

    _cancelPendingHold(target) {
      if (!target?.dispatchEvent) return;
      const init = { bubbles: true, composed: true, cancelable: false, pointerType: "touch" };
      const event = typeof PointerEvent === "function" ? new PointerEvent("pointercancel", init) : new Event("pointercancel", init);
      target.dispatchEvent(event);
    }

    _touchStart(event) {
      if (event.touches.length === 1) {
        const touch = event.touches[0];
        this.session = {
          startedAt: performance.now(), maxTouches: 1, moved: false, multi: false,
          startX: touch.clientX, startY: touch.clientY, startState: { ...this.state }, target: event.composedPath?.()[0] || event.target,
        };
        return;
      }
      if (event.touches.length !== 2) return;
      const mid = this._midpoint(event.touches);
      const rect = this.viewport.getBoundingClientRect();
      const localX = mid.x - rect.left - this.canvas.offsetLeft;
      const localY = mid.y - rect.top - this.canvas.offsetTop;
      const nativeScrollY = this.state.scale <= 1 ? this.viewport.scrollTop : 0;
      this.session = {
        ...(this.session || {}), startedAt: this.session?.startedAt || performance.now(), maxTouches: 2, moved: false, multi: true,
        distance: Math.max(1, this._distance(event.touches)), scale: this.state.scale,
        contentX: (localX - this.state.x) / this.state.scale,
        contentY: (localY + nativeScrollY - this.state.y) / this.state.scale,
        midX: mid.x, midY: mid.y, target: this.session?.target || event.target,
      };
      this._cancelPendingHold(this.session.target);
      this.suppressClicksUntil = Date.now() + CLICK_GUARD;
      event.preventDefault();
    }

    _touchMove(event) {
      if (!this.session) return;
      if (this.session.multi && event.touches.length === 2) {
        const mid = this._midpoint(event.touches);
        const currentDistance = Math.max(1, this._distance(event.touches));
        const delta = Math.hypot(mid.x - this.session.midX, mid.y - this.session.midY);
        if (!this.session.moved && Math.abs(currentDistance - this.session.distance) < PAN_THRESHOLD && delta < PAN_THRESHOLD) return;
        this.session.moved = true;
        const rect = this.viewport.getBoundingClientRect();
        const localX = mid.x - rect.left - this.canvas.offsetLeft;
        const localY = mid.y - rect.top - this.canvas.offsetTop;
        const scale = clamp(this.session.scale * currentDistance / this.session.distance, this._min(), this._max());
        if (scale > 1) this.viewport.scrollTop = 0;
        this.state = this._clampState(scale, localX - this.session.contentX * scale, localY - this.session.contentY * scale);
        this._apply();
        this.suppressClicksUntil = Date.now() + CLICK_GUARD;
        event.preventDefault();
        return;
      }
      if (this.state.scale <= 1 || event.touches.length !== 1 || this.session.multi) return;
      const touch = event.touches[0];
      const dx = touch.clientX - this.session.startX;
      const dy = touch.clientY - this.session.startY;
      if (!this.session.moved && Math.hypot(dx, dy) < PAN_THRESHOLD) return;
      if (!this.session.moved) this._cancelPendingHold(this.session.target);
      this.session.moved = true;
      this.state = this._clampState(this.session.startState.scale, this.session.startState.x + dx, this.session.startState.y + dy);
      this._apply();
      this.suppressClicksUntil = Date.now() + CLICK_GUARD;
      event.preventDefault();
    }

    _touchEnd(event) {
      if (!this.session || event.touches.length) return;
      const session = this.session;
      const twoFingerTap = session.multi && !session.moved && performance.now() - session.startedAt <= TAP_DURATION;
      if (session.moved && this.state.scale >= 0.97 && this.state.scale <= 1.03) {
        this.reset(true);
      } else if (twoFingerTap) {
        const now = performance.now();
        if (now - this.lastTwoFingerTap <= DOUBLE_TAP_GAP) {
          this.lastTwoFingerTap = 0;
          this.reset(true);
        } else {
          this.lastTwoFingerTap = now;
        }
      } else {
        this._clampAndApply();
      }
      if (session.moved || session.multi) this.suppressClicksUntil = Date.now() + CLICK_GUARD;
      this.session = null;
    }

    _guardActivation(event) {
      if (Date.now() >= this.suppressClicksUntil) return;
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation?.();
    }

    reset(showStatus = false) {
      this.state = { scale: 1, x: 0, y: 0 };
      if (this.viewport) this.viewport.scrollTop = 0;
      this._apply();
      this._saveState();
      if (showStatus) {
        const status = this.root.querySelector?.(".scale-status");
        status?.classList.add("visible");
        window.setTimeout(() => status?.classList.remove("visible"), 1100);
      }
    }

    resetPosition() {
      if (this.viewport) this.viewport.scrollTop = 0;
      this.state = this._clampState(this.state.scale, 0, 0);
      this._apply();
      this._saveState();
    }

    contextChanged() {
      this._loadState();
      this.resetPosition();
    }

    destroy() { this.observer.disconnect(); this._detach(); controllers.delete(this.host); }
  }

  function attach(host, options = {}) {
    if (!host?.shadowRoot) return null;
    const existing = controllers.get(host);
    if (existing) { existing.bind(); return existing; }
    const controller = new ZoomController(host, options);
    controllers.set(host, controller);
    return controller;
  }

  function discover(root = document) {
    const visit = (node) => {
      if (!node) return;
      if (node.nodeType === Node.ELEMENT_NODE) {
        if (AUTO_TARGETS.has(node.tagName) || node.getAttribute?.("data-nikas-panel-zoom") === "true") attach(node);
        if (node.shadowRoot) visit(node.shadowRoot);
      }
      for (const child of node.children || node.childNodes || []) visit(child);
    };
    visit(root);
  }

  window.NikasDysonZoom = { version: 2, attach, discover, defaults: { min: DEFAULT_MIN, max: DEFAULT_MAX } };
})();
