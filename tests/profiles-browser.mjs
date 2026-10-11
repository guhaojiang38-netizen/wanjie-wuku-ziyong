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
  assert(process.env.WJWK_TEST_BOOK,'WJWK_TEST_BOOK is required for source-profile browser acceptance');
  await page.goto(`http://127.0.0.1:${server.address().port}/tests/preview.html`); await button('toggle').click();
  await page.locator('[data-tab="coverage"]').click();
  assert.equal(await page.locator('[data-coverage-results] > details').count(),112);
  assert.match(await page.locator('[data-coverage-results]').innerText(),/尚未读取核对/);
  assert.equal(Object.keys((await state()).powers).length,0);
  await button('manage').click(); await page.locator('[data-book-file]').setInputFiles(process.env.WJWK_TEST_BOOK);
  await page.waitForFunction(()=>wanjie_wuku_general_instance.settings.catalog.length===112);
  assert.equal(await page.locator('[data-primary] option:disabled').count(),8);
  const selectEntry = async name => {
    const id=await page.locator('[data-primary] option').filter({hasText:name}).first().getAttribute('value');
    await page.locator('[data-primary]').selectOption(id);
  };
  await selectEntry('源堡'); await button('register').click(); await page.waitForFunction(()=>document.querySelector('.wjwk-modal').hidden);
  await page.locator('[data-tab="management"]').click();
  assert.match(await page.locator('.wjwk-profile').innerText(),/原文版本匹配/);
  const before=await state(); await page.locator('[data-action="template-management"]').filter({hasText:'领域安排'}).click();
  assert.equal(await page.locator('[name="label"]').inputValue(),'领域安排');assert.equal(await page.locator('[name="category"]').inputValue(),'arrangement');assert.equal(await page.locator('[name="value"]').inputValue(),'');
  assert.equal(JSON.stringify(await state()),JSON.stringify(before));
  await button('dialog-close').click();await page.locator('[data-action="template-management"]').filter({hasText:'领域安排'}).click();
  await page.locator('[name="value"]').fill('测试人工确认：书房旧卷封存在木柜，等待玩家后续校准。');await page.locator('[name="note"]').fill('离线测试人工补录，无实际世界变化');await button('save-management').click();await page.waitForFunction(()=>document.querySelector('.wjwk-modal').hidden);
  assert.equal((await state()).roleWrites.length,0);assert.equal((await state()).narrativeActions.length,0);
  await page.locator('[data-tab="coverage"]').click();await page.locator('[data-coverage-filter]').selectOption('verified');
  assert.equal(await page.locator('[data-coverage-results] > details').count(),112);
  await page.locator('[data-coverage-search]').fill('预支');assert.equal(await page.locator('[data-coverage-results] > details').count(),1);
  await page.locator('[data-coverage-results] summary').click();assert.match(await page.locator('[data-coverage-results]').innerText(),/不能承接负势差/);
  await page.locator('[data-coverage-search]').fill('');await page.locator('[data-coverage-filter]').selectOption('support');assert.equal(await page.locator('[data-coverage-results] > details').count(),8);
  // Register the actual structural-field samples: no baseline popup or phantom currency.
  for(const name of ['奇迹智子','文明之光系统','旅法师']) {
    await button('manage').click();await selectEntry(name);await button('register').click();await page.waitForFunction(()=>document.querySelector('.wjwk-modal').hidden);
    assert.equal(Object.keys(Object.values((await state()).powers).find(p=>p.name===name).resources).length,0);
  }
  const variants=await page.evaluate(()=>wanjie_wuku_general_instance.settings.catalog.filter(e=>e.name.startsWith('太始天')).map(e=>({id:e.id,name:e.name})));
  await button('manage').click();await page.locator('[data-primary]').selectOption(variants[0].id);await button('register').click();await page.waitForFunction(()=>document.querySelector('.wjwk-modal').hidden);
  await button('manage').click();await page.locator('[data-primary]').selectOption(variants[1].id);await button('register').click();await page.waitForFunction(()=>document.querySelector('.wjwk-modal .wjwk-notice').textContent.includes('先暂停'));
  assert.equal(Object.values((await state()).powers).filter(p=>p.name.startsWith('太始天')).length,1);await button('dialog-close').click();
  // Import a changed namesake and an unknown power as data only; neither inherits old templates.
  await button('manage').click(); const custom={entries:[{uid:1,comment:'源堡',content:'自编不同版本，只保留重要记录与实际安排。'},{uid:2,comment:'新权柄<img src=x>',content:'自编未知能力；重要事实可以记录。'}]};
  await page.locator('[data-book-file]').setInputFiles({name:'custom-profiles.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(custom))});
  await page.waitForFunction(()=>wanjie_wuku_general_instance.settings.catalog.length===114);
  const changedId=await page.evaluate(()=>wanjie_wuku_general_instance.settings.catalog.find(e=>e.book==='custom-profiles'&&e.name==='源堡').id);
  await page.locator('[data-primary]').selectOption(changedId);await button('register').click();await page.waitForFunction(()=>document.querySelector('.wjwk-modal').hidden);
  await page.locator('[data-tab="management"]').click();assert.match(await page.locator('.wjwk-profile').innerText(),/同名词条正文/);assert.equal(await page.locator('[data-action="template-management"]').count(),3);
  await page.locator('[data-tab="coverage"]').click();await page.locator('[data-coverage-filter]').selectOption('all');await page.locator('[data-coverage-search]').fill('新权柄');
  assert.equal(await page.locator('[data-coverage-results] img').count(),0);assert.match(await page.locator('[data-coverage-results]').innerText(),/未知词条/);
  await page.locator('[data-coverage-search]').fill('');await page.locator('[data-coverage-filter]').selectOption('fallback');assert.equal(await page.locator('[data-coverage-results] > details').count(),2);
  await page.locator('[data-coverage-search]').fill('');await page.locator('[data-coverage-filter]').selectOption('all');
  await page.getByRole('heading',{name:'全词条管理覆盖',exact:true}).evaluate(e=>e.scrollIntoView({block:'start'}));await page.screenshot({path:resolve(output,'第三阶段-桌面.png'),fullPage:true});
  await page.setViewportSize({width:390,height:844});await page.getByRole('heading',{name:'全词条管理覆盖',exact:true}).evaluate(e=>e.scrollIntoView({block:'start'}));await page.screenshot({path:resolve(output,'第三阶段-手机.png'),fullPage:true});
  assert.equal(await page.evaluate(()=>document.querySelector('.wjwk-window').scrollWidth<=document.querySelector('.wjwk-window').clientWidth),true);
  await page.reload();await button('toggle').click();await page.locator('.wjwk-power').filter({hasText:'源堡'}).first().click();await page.locator('[data-tab="management"]').click();assert.match(await page.locator('.wjwk-content').innerText(),/书房旧卷封存在木柜/);
  assert.deepEqual(errors,[]);assert.deepEqual(external,[]);
  process.stdout.write(JSON.stringify({passed:true,checks:['unread-config-not-enabled','full-source-import','eight-supports-not-primary','exact-profile','template-empty-facts','cancel-read-only','manual-template-save','112-source-matches','search-limitations','support-filter','no-phantom-wallets','variant-conflict','changed-version-fallback','unknown-inert-text','mixed-versions-fallback-filter','390px-width','reload-records'],pageErrors:errors,externalRequests:external,screenshots:output},null,2));
} finally { await browser?.close();await new Promise(resolve=>server.close(resolve)); }
