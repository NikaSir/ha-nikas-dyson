const STATUS = {
  charging: ["Заряжается", "good"], charged_estimated: ["Заряжен · оценка", "good"],
  working: ["Работает", "good"], consuming: ["Активное потребление", "good"],
  idle: ["Ожидание", "muted"], detecting: ["Определение состояния…", "warn"],
  needs_calibration: ["Нужна калибровка", "warn"], not_configured: ["Не настроено", "muted"],
  unavailable: ["Недоступно", "bad"], no_data: ["Нет данных", "bad"], stale: ["Данные устарели", "warn"],
  invalid_unit: ["Неверные единицы", "bad"], power_off: ["Питание выключено", "muted"],
  not_docked: ["Снят с базы", "muted"], restricted: ["Нет доступа", "bad"],
};
const TABS = [
  ["state", "mdi:gauge", "Состояние"], ["sessions", "mdi:history", "Сеансы"],
  ["stats", "mdi:chart-line", "Статистика"], ["diag", "mdi:stethoscope", "Диагностика"],
];
const fmt = (v, digits=3, unit="") => v === null || v === undefined ? "—" : `${Number(v).toLocaleString("ru-RU", {maximumFractionDigits:digits})}${unit ? ` ${unit}` : ""}`;
const dur = (s) => {
  if (s === null || s === undefined) return "—";
  s = Math.max(0, Math.round(s)); const h=Math.floor(s/3600), m=Math.floor((s%3600)/60), sec=s%60;
  return h ? `${h} ч ${m} мин` : m ? `${m} мин ${sec} с` : `${sec} с`;
};
const when = (s) => s ? new Date(s*1000).toLocaleString("ru-RU", {day:"2-digit",month:"2-digit",hour:"2-digit",minute:"2-digit"}) : "—";

class NikaSDysonPanel extends HTMLElement {
  constructor(){ super(); this.attachShadow({mode:"open"}); this._devices=[]; this._selected=localStorage.getItem("nikas.dyson.device")||"dyson_v15"; this._tab=localStorage.getItem("nikas.dyson.tab")||"state"; this._busy=false; }
  set hass(value){ this._hass=value; if(!this._mounted) this._mount(); if(!this._loading) this._load(false); }
  set panel(value){ this._panel=value; }
  connectedCallback(){ if(this._hass && !this._mounted) this._mount(); }

  _mount(){
    this._mounted=true;
    this.shadowRoot.innerHTML=`<style>
      :host{display:block;position:relative;width:100%;height:100%;min-width:0;min-height:0;overflow:hidden;background:var(--primary-background-color,#f4f6f8);color:var(--primary-text-color,#17191c);font-family:var(--paper-font-body1_-_font-family,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif)}
      *{box-sizing:border-box} button{font:inherit;-webkit-tap-highlight-color:transparent}
      .shell{position:absolute;inset:0;display:grid;grid-template-rows:calc(60px + env(safe-area-inset-top,0px)) 52px minmax(0,1fr) calc(64px + env(safe-area-inset-bottom,0px));overflow:hidden}
      header{padding:env(safe-area-inset-top,0px) calc(12px + env(safe-area-inset-right,0px)) 0 calc(12px + env(safe-area-inset-left,0px));display:grid;grid-template-columns:52px minmax(0,1fr) 52px;align-items:center;background:color-mix(in srgb,var(--primary-background-color,#f4f6f8) 97%,transparent);border-bottom:1px solid var(--divider-color,#dfe3e8);backdrop-filter:blur(18px) saturate(130%);z-index:10}
      .side{width:44px;height:44px;border:1px solid color-mix(in srgb,var(--divider-color,#dfe3e8) 72%,transparent);border-radius:16px;background:var(--card-background-color,#fff);box-shadow:0 7px 20px rgba(23,45,76,.08);display:grid;place-items:center;color:var(--primary-text-color);cursor:pointer}.side.right{justify-self:end;color:var(--primary-color,#03a9d9)} .side ha-icon{--mdc-icon-size:25px}.side.spin ha-icon{animation:spin .7s linear infinite}.side.ok ha-icon{animation:pop .32s ease-out}
      @keyframes spin{to{transform:rotate(360deg)}} @keyframes pop{50%{transform:scale(1.25)}}
      .title{justify-self:center;width:min(360px,100%);height:52px;border:1px solid color-mix(in srgb,var(--primary-color,#03a9d9) 24%,var(--divider-color,#dfe3e8));border-radius:16px;background:color-mix(in srgb,var(--primary-color,#03a9d9) 5%,var(--card-background-color,#fff));box-shadow:0 5px 16px rgba(23,45,76,.06);display:grid;place-content:center;text-align:center;cursor:pointer}.title b{font-size:23px;font-weight:800;line-height:1.05}.title small{font-size:14px;color:var(--secondary-text-color,#68737d)}
      .peers{display:grid;grid-template-columns:repeat(5,minmax(0,1fr)) minmax(68px,1.25fr);gap:4px;padding:6px 6px;background:var(--card-background-color,#fff);border-bottom:1px solid var(--divider-color,#dfe3e8);overflow:hidden}.peer{min-width:0;height:40px;padding:0 3px;border:1px solid var(--divider-color,#dfe3e8);border-radius:13px;background:var(--card-background-color,#fff);color:var(--primary-text-color);font-size:11px;font-weight:750;display:flex;align-items:center;justify-content:center;gap:4px;white-space:nowrap;overflow:hidden}.peer span:last-child{min-width:0;overflow:hidden;text-overflow:ellipsis}.peer.active{border-color:color-mix(in srgb,var(--primary-color,#03a9d9) 50%,var(--divider-color));background:color-mix(in srgb,var(--primary-color,#03a9d9) 10%,var(--card-background-color));color:var(--primary-color,#03a9d9)}.lamp{width:8px;height:8px;flex:0 0 8px;border-radius:50%;background:#9aa0a6;box-shadow:0 0 0 3px color-mix(in srgb,#9aa0a6 17%,transparent)}.lamp.good{background:#32a852;box-shadow:0 0 0 3px color-mix(in srgb,#32a852 18%,transparent)}.lamp.warn{background:#e49b18;box-shadow:0 0 0 3px color-mix(in srgb,#e49b18 18%,transparent)}.lamp.bad{background:#d94141;box-shadow:0 0 0 3px color-mix(in srgb,#d94141 18%,transparent)}
      main{min-height:0;overflow-y:auto;overflow-x:hidden;overscroll-behavior:contain;-webkit-overflow-scrolling:touch}.content{width:100%;max-width:1280px;margin:0 auto;padding:12px 12px 20px;display:grid;gap:12px}.card{border:1px solid var(--divider-color,#dfe3e8);border-radius:22px;background:var(--card-background-color,#fff);padding:16px;box-shadow:0 4px 15px rgba(23,45,76,.04)}
      .hero{display:grid;gap:10px;text-align:center}.hero-icon{width:76px;height:76px;border-radius:24px;margin:0 auto;display:grid;place-items:center;background:color-mix(in srgb,var(--primary-color,#03a9d9) 9%,var(--card-background-color));color:var(--primary-color,#03a9d9)}.hero-icon ha-icon{--mdc-icon-size:46px}.hero h2{margin:0;font-size:24px}.hero .status{font-size:20px;font-weight:800}.hero .status.good{color:#238a43}.hero .status.warn{color:#c27b08}.hero .status.bad{color:#c43131}.note{font-size:13px;line-height:1.35;color:var(--secondary-text-color,#68737d)}
      .metrics{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.metric{min-width:0;padding:13px;border:1px solid var(--divider-color,#dfe3e8);border-radius:17px;background:color-mix(in srgb,var(--primary-background-color,#f4f6f8) 60%,var(--card-background-color,#fff))}.metric span{display:block;font-size:12px;color:var(--secondary-text-color,#68737d);font-weight:650}.metric strong{display:block;margin-top:4px;font-size:19px;overflow:hidden;text-overflow:ellipsis}.wide{grid-column:1/-1}
      .row{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:12px;align-items:center;padding:11px 0;border-bottom:1px solid var(--divider-color,#e5e7ea)}.row:last-child{border-bottom:0}.row .k{font-size:13px;color:var(--secondary-text-color)}.row .v{font-size:14px;font-weight:700;text-align:right;word-break:break-all}.session{padding:12px 0;border-bottom:1px solid var(--divider-color,#e5e7ea)}.session:last-child{border-bottom:0}.session b,.session span{display:block}.session span{font-size:13px;color:var(--secondary-text-color);margin-top:3px}
      footer{padding:6px calc(6px + env(safe-area-inset-right,0px)) calc(6px + env(safe-area-inset-bottom,0px)) calc(6px + env(safe-area-inset-left,0px));display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:2px;background:var(--card-background-color,#fff);border-top:1px solid var(--divider-color,#dfe3e8);box-shadow:0 -5px 22px rgba(23,45,76,.08);z-index:10}.tab{height:52px;border:0;border-radius:16px;background:transparent;color:var(--secondary-text-color,#68737d);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;font-weight:700}.tab ha-icon{--mdc-icon-size:26px}.tab small{font-size:12px}.tab.active{color:var(--primary-color,#2186d7);background:color-mix(in srgb,var(--primary-color,#2186d7) 11%,transparent)}
      .empty{text-align:center;padding:25px 12px;color:var(--secondary-text-color)}
      @media(min-width:600px){.content{padding-inline:16px}.metrics{grid-template-columns:repeat(4,minmax(0,1fr))}} @media(min-width:1024px){.content{padding-inline:24px}} @media(max-width:359px){.peers{grid-template-columns:repeat(5,minmax(0,1fr)) minmax(60px,1.2fr);gap:2px;padding-inline:3px}.peer{font-size:10px;gap:2px}.lamp{width:7px;height:7px;flex-basis:7px}.title b{font-size:21px}.title small{font-size:13px}}
    </style><div class="shell"><header><button class="side menu" aria-label="Меню"><ha-icon icon="mdi:menu"></ha-icon></button><button class="title" aria-label="Вернуться в Действия"><b>Техника</b><small>UI v1.0.1</small></button><button class="side right refresh" aria-label="Обновить"><ha-icon icon="mdi:refresh"></ha-icon></button></header><div class="peers"></div><main><div class="content"><section class="card hero"><div class="hero-icon"><ha-icon class="device-icon" icon="mdi:power-plug-outline"></ha-icon></div><h2 class="device-name">Техника</h2><div class="status muted">Загрузка…</div><div class="note explanation">Получение данных Home Assistant</div></section><section class="view"></section></div></main><footer></footer></div>`;
    this.shadowRoot.querySelector(".menu").onclick=()=>this.dispatchEvent(new CustomEvent("hass-toggle-menu",{bubbles:true,composed:true}));
    this.shadowRoot.querySelector(".title").onclick=()=>this._navigate("/dashboard-actions/home");
    this.shadowRoot.querySelector(".refresh").onclick=()=>this._load(true);
    this._renderTabs(); this._renderPeers();
  }
  _navigate(path){ history.pushState(null,"",path); window.dispatchEvent(new Event("location-changed")); }
  async _load(manual){
    if(!this._hass || this._loading) return; this._loading=true; const b=this.shadowRoot?.querySelector(".refresh"), i=b?.querySelector("ha-icon");
    if(manual&&b){b.classList.remove("ok");b.classList.add("spin");i.setAttribute("icon","mdi:refresh");}
    try{ const result=await this._hass.callWS({type:"nikas_dyson/snapshot"}); this._devices=result.devices||[]; if(!this._devices.some(x=>x.id===this._selected)&&this._devices[0]) this._selected=this._devices[0].id; this._renderPeers();this._render(); if(manual&&b){b.classList.remove("spin");b.classList.add("ok");i.setAttribute("icon","mdi:check");setTimeout(()=>{b.classList.remove("ok");i.setAttribute("icon","mdi:refresh")},1000);}}
   