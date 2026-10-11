// Offline browser integration only. All model responses come from mock-host.js.
import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { resolve, dirname, extname, relative, isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
const project = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(process.env.WJWK_NODE_MODULES ? `${process.env.WJWK_NODE_MODULES}/package.json` : import.meta.url);
const { chromium } = require('playwright');
const output = resolve(process.env.WJWK_SCREENSHOTS || resolve(project, '../../work/management-browser'));
await mkdir(output, { recursive: true });
const server = createServer(async (req, res) => {
  try {
    const path = resolve(project, `.${decodeURIComponent(new URL(req.url, 'http://local').pathname)}`), rel = relative(project, path);
    if (rel === '..' || rel.startsWith('..\\') || rel.startsWith('../') || isAbsolute(rel)) throw Error('Invalid path');
    const data = await readFile(path); res.setHeader('Content-Type', { '.js': 'text/javascript', '.html': 'text/html', '.css': 'text/css' }[extname(path)] || 'application/octet-stream'); res.end(data);
  } catch { res.writeHead(404); res.end('Not found'); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
let browser;
try {
  browser = await chromium.launch({ headless: true, ...(process.env.WJWK_BROWSER_EXECUTABLE ? { executablePath: process.env.WJWK_BROWSER_EXECUTABLE } : {}) });
  const page = await browser.newPage({ viewport: { width: 1400, height: 980 } });
  page.setDefaultTimeout(10000);
  const errors = [], external = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.route('**/*', route => { const u = new URL(route.request().url()); if (u.hostname === '127.0.0.1' || u.protocol === 'blob:') return route.continue(); external.push(u.origin); return route.abort(); });
  const button = name => page.locator(`[data-action="${name}"]`).last();
  const state = () => page.evaluate(() => wanjie_wuku_general_instance.store.read());
  await page.goto(`http://127.0.0.1:${server.address().port}/tests/preview.html`);
  await button('toggle').click();
  for (const name of ['签到', '人生模拟']) {
    await button('manage').click(); await button('read-book').click();
    const value = await page.locator('[data-primary] option').filter({ hasText:name }).first().getAttribute('value');
    await page.locator('[data-primary]').selectOption(value); await button('register').click();
    if (name === '人生模拟') { await page.locator('input[name^="balance:"]').fill('1'); await button('save-baseline').click(); }
    await page.waitForFunction(() => document.querySelector('.wjwk-modal').hidden);
  }
  await button('close').click(); await page.locator('#demo-workflow-turn').click(); await button('toggle').click();
  const original = await state();
  const selectPower = name => page.locator('.wjwk-power').filter({hasText:name}).click();
  const open = kind => page.locator(`[data-action="open-workflow"][data-kind="${kind}"]`).first().click();
  const source = async (index, quote, name) => {
    const p = Object.values((await state()).powers).find(p=>p.name===name);
    await page.locator('[name="sourceIndex"]').selectOption(String(index)); await page.locator('[name="quote"]').fill(quote);
    await page.locator('[name="ruleQuote"]').fill(p.rules.slice(p.rules.indexOf('演示约定'),p.rules.indexOf('演示约定')+18));
  };
  const save = async () => { await button('save-workflow').click(); await page.waitForFunction(()=>document.querySelector('.wjwk-modal').hidden); };
  const initialText = await page.evaluate(()=>demoContext.chat[1].mes);
  await selectPower('签到'); await open('cycle');
  await page.locator('[name="label"]').fill('旅途第七日签到'); await page.locator('[name="trigger"]').fill('日常签到'); await page.locator('[name="cycleKey"]').fill('旅途第七日');
  await source(1,initialText,'签到'); await save();
  await open('cycle'); await page.locator('[name="label"]').fill('重复签到'); await page.locator('[name="trigger"]').fill('日常签到'); await page.locator('[name="cycleKey"]').fill('旅途第七日');
  await source(1,initialText,'签到'); await button('save-workflow').click();
  await page.waitForFunction(()=>document.querySelector('.wjwk-notice')?.textContent.includes('已有记录'));
  await button('dialog-close').click();
  await selectPower('人生模拟'); await open('simulation');
  await page.locator('[name="label"]').fill('古塔命途'); await page.locator('[name="trigger"]').fill('模拟第1轮'); await page.locator('[name="cycleKey"]').fill('旅途第七日');
  await page.locator('[name="candidates"]').fill('步法心得｜步法衔接更加稳定｜可选\n古塔路线｜记录古塔隐秘入口｜等待条件'); await page.locator('[name="limit"]').fill('1');
  await source(1,initialText,'人生模拟'); await save();
  const afterRegister=await state(); await open('select'); await button('dialog-close').click(); assert.equal(JSON.stringify(await state()),JSON.stringify(afterRegister));
  await open('select'); await save();
  let s=await state(), p=Object.values(s.powers).find(p=>p.name==='人生模拟'), id=Object.keys(p.simulations)[0];
  assert.equal(p.simulations[id].candidates.candidate_0.status,'selected');
  await button('close').click(); await page.locator('#demo-workflow-receipt').click(); await button('toggle').click();
  const receiptText=await page.evaluate(()=>demoContext.chat[2].mes);
  await open('ready'); await source(2,receiptText,'人生模拟'); await save();
  assert.equal(await page.locator('[data-kind="select"]').isDisabled(),true);
  await open('simulation-receipt'); await source(2,receiptText,'人生模拟'); await save();
  assert.equal(await page.locator('[data-kind="simulation-receipt"]').count(),0);
  await selectPower('签到'); await open('cycle-receipt'); await source(2,receiptText,'签到');
  await page.locator('[name="result"]').fill('行囊中已增加一份清心散'); await save();
  s=await state(); assert.equal(s.roleWrites.length,0);assert.equal(s.narrativeActions.length,0);
  for(const [pid,power] of Object.entries(s.powers)){assert.deepEqual(power.resources,original.powers[pid].resources);assert.deepEqual(power.assets,original.powers[pid].assets);}
  await page.reload();await button('toggle').click();await selectPower('人生模拟');
  assert.match(await page.locator('.wjwk-content').innerText(),/正文已到账/);assert.match(await page.locator('.wjwk-content').innerText(),/已选 1\/1/);
  await page.getByRole('heading',{name:'模拟成果档案',exact:true}).evaluate(e=>e.scrollIntoView({block:'start'}));
  await page.screenshot({path:resolve(output,'第二阶段-桌面.png'),fullPage:true});
  await page.setViewportSize({width:390,height:844});await page.getByRole('heading',{name:'模拟成果档案',exact:true}).evaluate(e=>e.scrollIntoView({block:'start'}));await page.screenshot({path:resolve(output,'第二阶段-手机.png'),fullPage:true});
  assert.equal(await page.evaluate(()=>document.querySelector('.wjwk-window').scrollWidth<=document.querySelector('.wjwk-window').clientWidth),true);
  await page.evaluate(()=>{demoContext.chat[1].swipe_id=1;return demoEmit('MESSAGE_SWIPED');});
  assert.match(await page.locator('.wjwk-content').innerText(),/档案来源已变化/);
  assert.deepEqual(errors,[]);assert.deepEqual(external,[]);
  process.stdout.write(JSON.stringify({passed:true,checks:['model-off-registration','story-cycle-once','simulation-candidates','cancel-no-change','select-before-receipt','condition-confirmation','selection-limit','receipt-once','no-economic-or-MVU-write','reload','390px-width','stale-branch-warning'],pageErrors:errors,externalRequests:external,screenshots:output},null,2));
} finally { await browser?.close(); await new Promise(resolve=>server.close(resolve)); }
