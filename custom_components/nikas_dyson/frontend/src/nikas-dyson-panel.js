const UI_VERSION = "1.0.2";
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
  constructor(){
    super(); this.attachShadow({mode:"open"}); this._devices=[]; this._selected="dyson_v15"; this._tab="state"; this._requestId=0;
    try {this._selected=localStorage.getItem("nikas.dyson.device")||this._selected;this._tab=localStorage.getItem("nikas.dyson.tab")||this._tab;} catch (_) {}
    if(!TABS.some(([id])=>id===this._tab)) this._tab="state";
  }
  _save(key,value){try{localStorage.setItem(key,value)}catch(_) {}}
  set hass(value){this._hass=value;if(this.isConnected && !this._loading && Date.now()-(this._lastAttempt||0)>=15000)this._load(false);}
  set panel(value){this._panel=value;}
  connectedCallback(){
    if(!this._mounted)this._mount();
    this._boundaryCleanup?.();
    this._boundaryCleanup=createNikasShellScrollBoundaryGuard({host:this,viewport:this.shadowRoot.querySelector("main")});
    this._zoom=window.NikasDysonZoom?.attach(this);
    clearInterval(this._pollTimer);this._pollTimer=setInterval(()=>this._load(false),15000);
    this._load(false);
  }
  disconnectedCallback(){
    this._requestId++;this._loading=false;clearInterval(this._pollTimer);clearTimeout(this._requestTimer);
    clearTimeout(this._busyTimer);this._busyResolve?.();this._busyResolve=null;
    clearTimeout(this._resultTimer);this._feedback("idle");
    this._boundaryCleanup?.();this._boundaryCleanup=null;this._zoom?.destroy();this._zoom=null;
  }

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
      .peers{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:5px;padding:6px 8px;background:var(--card-background-color,#fff);border-bottom:1px solid var(--divider-color,#dfe3e8);overflow:hidden}.peer{min-width:0;height:40px;padding:0 5px;border:1px solid var(--divider-color,#dfe3e8);border-radius:13px;background:var(--card-background-color,#fff);color:var(--primary-text-color);font-size:12px;font-weight:750;display:flex;align-items:center;justify-content:center;gap:5px;white-space:nowrap;overflow:hidden}.peer.active{border-color:color-mix(in srgb,var(--primary-color,#03a9d9) 50%,var(--divider-color));background:color-mix(in srgb,var(--primary-color,#03a9d9) 10%,var(--card-background-color));color:var(--primary-color,#03a9d9)}.lamp{width:9px;height:9px;flex:0 0 9px;border-radius:50%;background:#9aa0a6;box-shadow:0 0 0 3px color-mix(in srgb,#9aa0a6 17%,transparent)}.lamp.good{background:#32a852;box-shadow:0 0 0 3px color-mix(in srgb,#32a852 18%,transparent)}.lamp.warn{background:#e49b18;box-shadow:0 0 0 3px color-mix(in srgb,#e49b18 18%,transparent)}.lamp.bad{background:#d94141;box-shadow:0 0 0 3px color-mix(in srgb,#d94141 18%,transparent)}
      main{min-height:0;overflow-y:auto;overflow-x:hidden;overscroll-behavior:contain;-webkit-overflow-scrolling:touch}.content{width:100%;max-width:1280px;margin:0 auto;padding:12px 12px 20px;display:grid;gap:12px}.card{border:1px solid var(--divider-color,#dfe3e8);border-radius:22px;background:var(--card-background-color,#fff);padding:16px;box-shadow:0 4px 15px rgba(23,45,76,.04)}
      .hero{display:grid;gap:10px;text-align:center}.hero-icon{width:76px;height:76px;border-radius:24px;margin:0 auto;display:grid;place-items:center;background:color-mix(in srgb,var(--primary-color,#03a9d9) 9%,var(--card-background-color));color:var(--primary-color,#03a9d9)}.hero-icon ha-icon{--mdc-icon-size:46px}.hero h2{margin:0;font-size:24px}.hero .status{font-size:20px;font-weight:800}.hero .status.good{color:#238a43}.hero .status.warn{color:#c27b08}.hero .status.bad{color:#c43131}.note{font-size:13px;line-height:1.35;color:var(--secondary-text-color,#68737d)}
      .metrics{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.metric{min-width:0;padding:13px;border:1px solid var(--divider-color,#dfe3e8);border-radius:17px;background:color-mix(in srgb,var(--primary-background-color,#f4f6f8) 60%,var(--card-background-color,#fff))}.metric span{display:block;font-size:12px;color:var(--secondary-text-color,#68737d);font-weight:650}.metric strong{display:block;margin-top:4px;font-size:19px;overflow:hidden;text-overflow:ellipsis}.wide{grid-column:1/-1}
      .row{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:12px;align-items:center;padding:11px 0;border-bottom:1px solid var(--divider-color,#e5e7ea)}.row:last-child{border-bottom:0}.row .k{font-size:13px;color:var(--secondary-text-color)}.row .v{font-size:14px;font-weight:700;text-align:right;word-break:break-all}.session{padding:12px 0;border-bottom:1px solid var(--divider-color,#e5e7ea)}.session:last-child{border-bottom:0}.session b,.session span{display:block}.session span{font-size:13px;color:var(--secondary-text-color);margin-top:3px}
      footer{padding:6px calc(6px + env(safe-area-inset-right,0px)) calc(6px + env(safe-area-inset-bottom,0px)) calc(6px + env(safe-area-inset-left,0px));display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:2px;background:var(--card-background-color,#fff);border-top:1px solid var(--divider-color,#dfe3e8);box-shadow:0 -5px 22px rgba(23,45,76,.08);z-index:10}.tab{height:52px;border:0;border-radius:16px;background:transparent;color:var(--secondary-text-color,#68737d);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;font-weight:700}.tab ha-icon{--mdc-icon-size:26px}.tab small{font-size:12px}.tab.active{color:var(--primary-color,#2186d7);background:color-mix(in srgb,var(--primary-color,#2186d7) 11%,transparent)}
      .empty{text-align:center;padding:25px 12px;color:var(--secondary-text-color)}
      @media(min-width:600px){.content{padding-inline:16px}.metrics{grid-template-columns:repeat(4,minmax(0,1fr))}} @media(min-width:1024px){.content{padding-inline:24px}} @media(max-width:420px){.peers{gap:3px;padding-inline:4px}.peer{font-size:10px;padding:0 2px}.lamp{width:7px;height:7px;flex-basis:7px}.title b{font-size:21px}.title small{font-size:13px}}
      ${nikasShellV2Styles()}
      .refresh.spin ha-icon{animation:spin .7s linear infinite}.refresh.ok{color:#2e7d32}.refresh.error{color:#e53935}
      @media(prefers-reduced-motion:reduce){.refresh ha-icon{animation:none!important}}
      .peers{grid-template-columns:repeat(5,minmax(0,1fr)) minmax(68px,1.25fr);gap:4px;padding-inline:6px}
      .peer{font-size:11px;gap:4px}.peer span:last-child{min-width:0;overflow:hidden;text-overflow:ellipsis}
      .setup-action{min-height:44px;grid-column:1/-1;border:1px solid var(--divider-color);border-radius:15px;background:var(--card-background-color);color:var(--primary-color)}
    </style><div class="shell nikas-shell nikas-shell--with-peer"><header class="nikas-shell__header"><button class="side menu nikas-shell__side-action" aria-label="Меню"><ha-icon icon="mdi:menu"></ha-icon></button><button class="title nikas-shell__title" aria-label="Вернуться в Действия"><strong>Техника</strong><small>UI v${UI_VERSION}</small></button><button class="side right refresh nikas-shell__side-action nikas-shell__side-action--right" aria-label="Обновить"><ha-icon icon="mdi:refresh"></ha-icon></button></header><div class="peers nikas-shell__peer"></div><main class="nikas-shell__viewport viewport"><div class="nikas-shell__canvas canvas"><div class="content nikas-shell__content"><section class="card hero"><div class="hero-icon"><ha-icon class="device-icon" icon="mdi:power-plug-outline"></ha-icon></div><h2 class="device-name">Техника</h2><div class="status muted">Загрузка…</div><div class="note explanation">Получение данных Home Assistant</div></section><section class="view"></section></div></div></main><footer class="nikas-shell__tabs"></footer></div>`;
    this.shadowRoot.querySelector(".menu").onclick=()=>this.dispatchEvent(new CustomEvent("hass-toggle-menu",{bubbles:true,composed:true}));
    this.shadowRoot.querySelector(".title").onclick=()=>this._navigate(this._returnRoute);
    this.shadowRoot.querySelector(".refresh").onclick=()=>this._load(true);
    this._returnRoute=captureNikasShellReturnRoute({panelId:"dyson",parentRoute:this._panel?.config?.parent_route||"/dashboard-actions/home",safeReturnRoute:"/dashboard-actions/home"});
    this._renderTabs(); this._renderPeers();
  }
  _navigate(path){navigateNikasShell(path);}
  _feedback(phase){
    const b=this.shadowRoot.querySelector(".refresh");if(!b)return;
    for(const name of ["spin","ok","error"])b.classList.toggle(name,name===({busy:"spin",success:"ok",error:"error"}[phase]));
    b.disabled=phase==="busy";b.setAttribute("aria-busy",String(phase==="busy"));
    b.querySelector("ha-icon").setAttribute("icon",phase==="success"?"mdi:check":phase==="error"?"mdi:alert-circle-outline":"mdi:refresh");
  }
  async _load(manual){
    if(!this._hass||this._loading||!this.isConnected)return;
    this._loading=true;this._lastAttempt=Date.now();const id=++this._requestId;const started=Date.now();
    if(manual){clearTimeout(this._resultTimer);this._feedback("busy");}let success=false;
    try {
      const timeout=new Promise((_,reject)=>{this._requestTimer=setTimeout(()=>reject(Error("Нет ответа Home Assistant")),10000)});
      const result=await Promise.race([this._hass.callWS({type:"nikas_dyson/snapshot"}),timeout]);
      if(id!==this._requestId||!this.isConnected)return;
      if(!Array.isArray(result.devices))throw Error("Некорректный ответ Home Assistant");
      this._devices=result.devices;this._error=null;success=true;
      if(!this._devices.some(x=>x.id===this._selected)&&this._devices[0])this._selected=this._devices[0].id;
    } catch(error) {
      if(id!==this._requestId||!this.isConnected)return;
      this._error=error;
      this._devices=this._devices.map(d=>({...d,status:d.status==="restricted"?"restricted":"stale",issue:"snapshot_error",power_w:null,active:null}));
    } finally {
      if(id===this._requestId){
        clearTimeout(this._requestTimer);
        this._renderPeers();this._render();
        if(manual){
          const remaining=Math.max(0,900-(Date.now()-started));
          if(remaining)await new Promise(resolve=>{this._busyResolve=resolve;this._busyTimer=setTimeout(resolve,remaining)});
          this._busyResolve=null;
        }
        if(id===this._requestId&&this.isConnected){
          this._loading=false;
          if(manual){this._feedback(success?"success":"error");this._resultTimer=setTimeout(()=>this._feedback("idle"),1400);}
        }
      }
    }
  }
  _patchNode(target,source){
    if(target.nodeType!==source.nodeType||target.nodeName!==source.nodeName){target.replaceWith(source);return;}
    if(source.nodeType===Node.TEXT_NODE){if(target.textContent!==source.textContent)target.textContent=source.textContent;return;}
    for(const a of [...target.attributes])if(!source.hasAttribute(a.name))target.removeAttribute(a.name);
    for(const a of source.attributes)if(target.getAttribute(a.name)!==a.value)target.setAttribute(a.name,a.value);
    target.onclick=source.onclick;
    const old=[...target.childNodes],next=[...source.childNodes];
    next.forEach((n,i)=>old[i]?this._patchNode(old[i],n):target.append(n));old.slice(next.length).forEach(n=>n.remove());
  }
  _renderTabs(){ const f=this.shadowRoot.querySelector("footer"); if(f.children.length){[...f.children].forEach((b,i)=>b.classList.toggle("active",TABS[i][0]===this._tab));return;} f.replaceChildren(...TABS.map(([id,icon,label])=>{const b=document.createElement("button");b.className=`tab nikas-shell__tab ${this._tab===id?"active":""}`;b.innerHTML=`<ha-icon icon="${icon}"></ha-icon><small>${label}</small>`;b.onclick=()=>{this._tab=id;this._save("nikas.dyson.tab",id);this._renderTabs();this._render();this.shadowRoot.querySelector("main").scrollTop=0};return b;})); }
  _lamp(d){ if(!d) return ""; const s=STATUS[d.status]||[d.status||"Неизвестно","muted"]; return s[1]; }
  _renderPeers(){ if(!this.shadowRoot) return; const holder=this.shadowRoot.querySelector(".peers"); const order=this._devices.length?this._devices:[{id:"dyson_v15",label:"V15"},{id:"dyson_v12",label:"V12"},{id:"dyson_v8",label:"V8"},{id:"lg",label:"LG"},{id:"s8_socket",label:"S8"},{id:"massage_chair",label:"Кресло"}]; const peers=order.map(d=>{const b=document.createElement("button");b.className=`peer ${d.id===this._selected?"active":""}`;const l=document.createElement("span");l.className=`lamp ${this._lamp(d)}`;const t=document.createElement("span");t.textContent=d.label;b.append(l,t);b.onclick=()=>{this._selected=d.id;this._save("nikas.dyson.device",d.id);this._renderPeers();this._render();};return b;}); if(holder.children.length===peers.length)peers.forEach((b,i)=>this._patchNode(holder.children[i],b));else holder.replaceChildren(...peers); }
  _row(k,v){const r=document.createElement("div");r.className="row";const a=document.createElement("span");a.className="k";a.textContent=k;const b=document.createElement("span");b.className="v";b.textContent=v;r.append(a,b);return r;}
  _metric(k,v,wide=false){const x=document.createElement("div");x.className=`metric ${wide?"wide":""}`;const a=document.createElement("span");a.textContent=k;const b=document.createElement("strong");b.textContent=v;x.append(a,b);return x;}
  _render(){ if(!this.shadowRoot) return; const d=this._devices.find(x=>x.id===this._selected), status=this.shadowRoot.querySelector(".status"), view=this.shadowRoot.querySelector(".view");
    if(!d){this.shadowRoot.querySelector(".device-name").textContent="Техника";status.textContent=this._error?"Ошибка получения данных":"Загрузка…";status.className=`status ${this._error?"bad":"muted"}`;this.shadowRoot.querySelector(".explanation").textContent=this._error?String(this._error):"Получение данных Home Assistant";view.innerHTML="";return;}
    this.shadowRoot.querySelector(".device-name").textContent=d.name||d.label;this.shadowRoot.querySelector(".device-icon").setAttribute("icon",d.icon||"mdi:power-plug-outline");const s=STATUS[d.status]||[d.status||"Неизвестно","muted"];status.textContent=s[0];status.className=`status ${s[1]}`;this.shadowRoot.querySelector(".explanation").textContent=this._error?"Связь с Home Assistant потеряна. Показаны последние данные; текущая мощность и сеанс неизвестны.":d.issue?`Источник: ${s[0]}`:(d.kind==="charger"?"Состояние определяется по фактическому потреблению зарядной станции.":d.kind==="chair"?"Сеанс работы определяется по мощности розетки.":"Учитывается активное потребление подключённой нагрузки.");
    const draft=document.createElement("section");draft.className="view"; const target=draft; if(this._tab==="state") this._state(target,d); else if(this._tab==="sessions") this._sessions(target,d); else if(this._tab==="stats") this._stats(target,d); else this._diag(target,d);this._patchNode(view,draft);
  }
  _state(view,d){const c=document.createElement("section");c.className="card metrics";c.append(this._metric("Текущая мощность",fmt(d.power_w,1,"Вт")),this._metric("Текущий сеанс",d.active?dur(d.active.duration_s):"—"),this._metric("Энергия сеанса",d.active?fmt(d.active.energy_kwh,4,"кВт⋅ч"):"—"),this._metric("Сегодня",fmt(d.today_kwh,4,"кВт⋅ч")));const n=document.createElement("div");n.className="note wide";n.textContent=d.calibrated?"Пороги классификации подтверждены.":"Пороги пока не подтверждены: мощность и энергия учитываются, но состояние зарядки/работы требует калибровки.";c.append(n);if(this._hass?.user?.is_admin){const b=document.createElement("button");b.className="setup-action";b.textContent="Настроить источники и калибровку";b.onclick=()=>this._navigate("/config/integrations/integration/nikas_dyson");c.append(b);}view.append(c);}
  _sessions(view,d){const c=document.createElement("section");c.className="card";const items=(d.history||[]).slice(0,30);if(!items.length){const e=document.createElement("div");e.className="empty";e.textContent="Завершённых сеансов пока нет.";c.append(e);}else items.forEach(x=>{const r=document.createElement("div");r.className="session";const b=document.createElement("b");b.textContent=`${when(x.start)} — ${when(x.end)}`;const s=document.createElement("span");s.textContent=`${dur(x.duration_s)} · ${fmt(x.energy_kwh,4,"кВт⋅ч")}${x.incomplete?" · неполные данные":""}`;r.append(b,s);c.append(r)});view.append(c);}
  _stats(view,d){const c=document.createElement("section");c.className="card metrics";c.append(this._metric("Сегодня",fmt(d.today_kwh,4,"кВт⋅ч")),this._metric("Месяц",fmt(d.month_kwh,4,"кВт⋅ч")),this._metric("Год",fmt(d.year_kwh,4,"кВт⋅ч")),this._metric("Всего",fmt(d.total_kwh,4,"кВт⋅ч")),this._metric("Сеансов",d.started_at?String(d.sessions??0):"—"),this._metric("Средняя длительность",d.average_minutes==null?"—":dur(d.average_minutes*60)),this._metric("Стоимость",d.cost==null?"Тариф не задан":`${d.cost_partial?"≥ ":""}${fmt(d.cost,2,d.currency||"₽")}`,true));view.append(c);}
  _diag(view,d){const c=document.createElement("section");c.className="card";const src=d.sources||{};c.append(this._row("Датчик мощности",src.power_entity||"Не назначен"),this._row("Счётчик энергии",src.energy_entity||"Не назначен"),this._row("Розетка",src.switch_entity||"Не назначена"),this._row("Присутствие на базе",src.presence_entity||"Не назначено"),this._row("Последнее показание",d.source_reported_at?`${when(d.source_reported_at)} · ${Math.floor(d.source_age_s||0)} с назад`:"—"),this._row("Метод энергии",d.energy_method==="meter"?"Накопительный счётчик":"Расчёт по мощности"),this._row("Сбросов счётчика",String(d.meter_resets??0)),this._row("Неполные интервалы",d.incomplete?"Да":"Нет"),this._row("Пороги",d.thresholds?`≥ ${d.thresholds.on_w} Вт / ≤ ${d.thresholds.off_w} Вт`:"—"));view.append(c);}
}
if(!customElements.get("nikas-dyson-panel")) customElements.define("nikas-dyson-panel",NikaSDysonPanel);
