const SOURCE = 'custom_components/nikas_dyson/frontend/src/nikas-dyson-panel.js';
const FRONTEND = 'custom_components/nikas_dyson/frontend';
const KIND = 'dyson';
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const path = require("node:path");
const root = path.resolve(__dirname, "..");
for (const testedSource of [SOURCE, 'custom_components/nikas_dyson/frontend/nikas-dyson-panel.js']) {
const source = fs.readFileSync(path.join(root, testedSource), "utf8");
function method(name) {
  const start = source.indexOf(name + "() {");
  assert.ok(start >= 0, name + " must remain wired");
  return source.slice(start).match(/^[\s\S]*?\n {2,4}\}/)[0].replace(name + "()", "function()");
}
for (const stale of ["/dashboard-actions/home", "/dashboard-house-v13/home", "/dashboard-infrastructure/overview"]) {
  const destinations = [], events = [];
  const history = {pushState(_state, _title, route) { destinations.push(route); }};
  const storage = {getItem() { return stale; }, setItem() {}, removeItem() {}};
  const window = { location: {origin:"https://ha.local", pathname:"/special-panel", search:"?return_to="+stale+"&from="+stale, hash:""}, history, localStorage:storage, dispatchEvent(event) { events.push(event.type); }};
  const context = vm.createContext({window, history, sessionStorage:storage, document:{referrer:"https://ha.local"+stale}, URL, URLSearchParams, Event, Date});
  let handler;
  if (KIND === "s8") {
    vm.runInContext(source.slice(0, source.indexOf("function s8SameTreeShape")), context);
    handler = vm.runInContext("(" + method("_navigateParent") + ")", context);
  } else if (KIND === "ho") {
    handler = vm.runInContext("(" + method("navigateParent") + ")", context);
  } else if (KIND === "starline") {
    vm.runInContext(source.slice(0, source.indexOf("function openHomeAssistantMenu")), context);
    handler = vm.runInContext("(function(){" + source.match(/this\.\$\("\.title-button"\)\.addEventListener\("click", \(\) => ([^;]+);/)[1].replace(/\)$/, "") + ";})", context);
  } else {
    const shellPath = KIND === "dyson" ? "src/nikas-specialized-shell.js" : "nikas-specialized-shell.js";
    vm.runInContext(fs.readFileSync(path.join(root, FRONTEND, shellPath), "utf8"), context);
    const expr = KIND === "dyson" ? source.match(/querySelector\("\.title"\)\.onclick=\(\)=>([^;]+);/)[1] : source.match(/querySelector\("#zont-title"\)\.onclick = \(\) => ([\s\S]+?);/)[1];
    handler = vm.runInContext("(function(){" + expr + ";})", context);
  }
  const panel = {_panel:{config:{parent_path:stale, parent_route:stale}}, _returnRoute:stale, __zontReturnRouteV095:stale, _navigate(route) {vm.runInContext("navigateNikasShell("+JSON.stringify(route)+")",context);}};
  handler.call(panel);
  assert.deepEqual(destinations, ["/home/overview"], "title ignores source, stale parent, history, query and saved route");
  assert.deepEqual(events, ["location-changed"]);
}
console.log("Title parent behavior: 3 conflicting-origin cases passed");
}
