const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {chromium} = require('playwright');
const root = path.resolve(__dirname, '..');
const frontend = path.join(root, 'custom_components/nikas_dyson/frontend');

(async () => {
  const browser = await chromium.launch({headless: true, ...(process.env.CHROME_PATH ? {executablePath: process.env.CHROME_PATH} : {})});
  const failures = [];
  async function check(name, test) {
    const page = await browser.newPage({viewport: {width: 430, height: 932}});
    await page.route('http://dyson.test/**', route => route.fulfill({contentType: 'text/html', body: '<body style="margin:0;height:100vh"></body>'}));
    await page.goto('http://dyson.test/dashboard-dyson');
    await page.addScriptTag({content: fs.readFileSync(path.join(frontend, 'nikas-dyson-panel.js'), 'utf8')});
    const legacy = path.join(frontend, 'nikas-dyson-panel-v101.js');
    if (fs.existsSync(legacy)) await page.addScriptTag({content: fs.readFileSync(legacy, 'utf8').replace(/^import.*$/m, '')});
    await page.evaluate(() => {
      window.device = {id:'dyson_v15',label:'V15',name:'Dyson V15',kind:'charger',status:'charging',power_w:20,calibrated:true};
      window.panel = document.createElement('nikas-dyson-panel');
      panel.hass = {user:{is_admin:true},callWS:async()=>({devices:[device]})};
      document.body.append(panel);
    });
    await page.waitForFunction(() => panel.shadowRoot.querySelector('.status').textContent === 'Заряжается');
    try {await test(page); console.log('PASS',name);} catch(e) {failures.push(name+': '+e.message);console.error('FAIL',name,e.message);}
    await page.close();
  }
  await check('failed snapshot invalidates status and live measurements, then recovers', async page => {
    await page.evaluate(async()=>{panel._hass.callWS=async()=>{throw Error('Connection lost')};await panel._load(false)});
    assert.equal(await page.locator('nikas-dyson-panel .status').textContent(), 'Данные устарели');
    assert.equal(await page.evaluate(()=>panel._devices[0].power_w), null);
    await page.evaluate(async()=>{panel._hass.callWS=async()=>({devices:[device]});await panel._load(false)});
    assert.equal(await page.locator('nikas-dyson-panel .status').textContent(), 'Заряжается');
    assert.equal(await page.evaluate(()=>Boolean(panel._error)), false);
  });
  await check('state updates preserve peer and tab controls and view nodes', async page => {
    await page.evaluate(()=>{window.peer=panel.shadowRoot.querySelector('.peer');window.tab=panel.shadowRoot.querySelector('.tab');window.metric=panel.shadowRoot.querySelector('.metric');});
    await page.evaluate(async()=>{panel._hass.callWS=async()=>({devices:[{...device,power_w:21}]});await panel._load(false)});
    assert.equal(await page.evaluate(()=>peer===panel.shadowRoot.querySelector('.peer')&&tab===panel.shadowRoot.querySelector('.tab')&&metric===panel.shadowRoot.querySelector('.metric')),true);
  });
  await check('detached pending response cannot overwrite reconnected state', async page => {
    await page.evaluate(()=>{panel._hass.callWS=()=>new Promise(resolve=>window.late=resolve);panel._load(false);panel.remove();panel._hass.callWS=async()=>({devices:[{...device,status:'idle'}]});document.body.append(panel)});
    await page.waitForFunction(()=>panel.shadowRoot.querySelector('.status').textContent==='Ожидание',{},{timeout:1500});
    await page.evaluate(()=>late({devices:[device]}));
    assert.equal(await page.locator('nikas-dyson-panel .status').textContent(),'Ожидание');
  });
  await check('manual refresh keeps busy 900ms and result 1400ms', async page => {
    await page.clock.install();
    await page.clock.pauseAt(new Date());
    await page.evaluate(()=>{panel._load(true)});
    await page.clock.runFor(899);
    assert.equal(await page.locator('nikas-dyson-panel .refresh').evaluate(b=>b.classList.contains('spin')),true);
    await page.clock.runFor(1);
    assert.equal(await page.locator('nikas-dyson-panel .refresh ha-icon').getAttribute('icon'),'mdi:check');
    await page.clock.runFor(1399);
    assert.equal(await page.locator('nikas-dyson-panel .refresh ha-icon').getAttribute('icon'),'mdi:check');
    await page.clock.runFor(1);
    assert.equal(await page.locator('nikas-dyson-panel .refresh ha-icon').getAttribute('icon'),'mdi:refresh');
  });
  await check('canonical shell keeps header and bottom navigation geometry', async page => {
    assert.equal(await page.locator('nikas-dyson-panel .nikas-shell').count(),1);
    for(const size of [{width:430,height:932},{width:932,height:430},{width:768,height:1024},{width:1440,height:900}]) {
      await page.setViewportSize(size);
      const boxes=await page.evaluate(()=>['header','.peers','main','footer'].map(s=>{const r=panel.shadowRoot.querySelector(s).getBoundingClientRect();return {top:r.top,bottom:r.bottom,height:r.height,width:r.width}}));
      assert.equal(Math.round(boxes[0].height),60);assert.equal(Math.round(boxes[1].height),52);assert.equal(Math.round(boxes[3].height),64);
      assert.equal(Math.round(boxes[3].bottom),size.height);assert.ok(boxes[2].bottom<=boxes[3].top+1);
    }
  });
  await check('background polling does not cancel refresh result reset', async page => {
    await page.clock.install();await page.clock.pauseAt(new Date());
    await page.evaluate(()=>{panel._load(true)});await page.clock.runFor(900);
    await page.evaluate(async()=>{await panel._load(false)});
    await page.clock.runFor(1400);
    assert.equal(await page.locator('nikas-dyson-panel .refresh ha-icon').getAttribute('icon'),'mdi:refresh');
  });
  await check('pinch gesture reaches the mounted canvas', async page => {
    const transform=await page.evaluate(()=>{
      const main=panel.shadowRoot.querySelector('main');
      function touch(type,points){const e=new Event(type,{bubbles:true,cancelable:true});Object.defineProperty(e,'touches',{value:points.map(([clientX,clientY],identifier)=>({clientX,clientY,identifier}))});main.dispatchEvent(e);}
      touch('touchstart',[[100,250],[200,250]]);touch('touchmove',[[50,250],[250,250]]);
      return panel.shadowRoot.querySelector('.canvas').style.transform;
    });
    assert.match(transform,/scale\(2\)/);
  });
  await browser.close();
  if(failures.length) throw Error(failures.join('\n'));
})().catch(error=>{console.error(error);process.exitCode=1});
