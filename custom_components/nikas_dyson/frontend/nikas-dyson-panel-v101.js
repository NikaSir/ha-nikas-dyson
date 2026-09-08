import "./nikas-dyson-panel.js?v=1.0.0";

const Panel = customElements.get("nikas-dyson-panel");
if (Panel && !Panel.prototype.__nikasV101Patched) {
  Panel.prototype.__nikasV101Patched = true;

  const originalMount = Panel.prototype._mount;
  Panel.prototype._mount = function () {
    originalMount.call(this);
    const style = document.createElement("style");
    style.textContent = `
      .peers{grid-template-columns:repeat(5,minmax(0,1fr)) minmax(68px,1.25fr)!important;gap:4px!important;padding-inline:6px!important}
      .peer{font-size:11px!important;padding-inline:3px!important;gap:4px!important}
      .peer span:last-child{min-width:0;overflow:hidden;text-overflow:ellipsis}
      .lamp{width:8px!important;height:8px!important;flex-basis:8px!important}
      .setup-action{grid-column:1/-1;min-height:44px;border:1px solid var(--divider-color,#dfe3e8);border-radius:15px;background:var(--card-background-color,#fff);color:var(--primary-color,#03a9d9);font-weight:750;display:flex;align-items:center;justify-content:center;gap:7px}
      @media(max-width:359px){.peers{grid-template-columns:repeat(5,minmax(0,1fr)) minmax(60px,1.2fr)!important;gap:2px!important;padding-inline:3px!important}.peer{font-size:10px!important;gap:2px!important}}
    `;
    this.shadowRoot.append(style);
    const version = this.shadowRoot.querySelector(".title small");
    if (version) version.textContent = "UI v1.0.1";
  };

  const originalState = Panel.prototype._state;
  Panel.prototype._state = function (view, device) {
    originalState.call(this, view, device);
    const note = view.querySelector(".note.wide");
    if (device.status === "not_configured") {
      if (note) note.textContent = "Источник мощности не назначен. Откройте NikaS Dyson → Настроить и выберите розетку/датчик мощности.";
      if (this._hass?.user?.is_admin) {
        const button = document.createElement("button");
        button.className = "setup-action";
        button.innerHTML = '<ha-icon icon="mdi:cog-outline"></ha-icon><span>Настроить источники</span>';
        button.onclick = () => this._navigate("/config/integrations/integration/nikas_dyson");
        view.querySelector(".metrics")?.append(button);
      }
    }
  };
}
