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
  for (const name of ['深蓝', '源堡', '熟练度状态栏']) {
    await button('manage').click(); await button('read-book').click();
    const value = await page.locator('[data-primary] option').filter({ hasText: name }).first().getAttribute('value');
    await page.locator('[data-primary]').selectOption(value); await button('register').click();
    if (name === '深蓝') { await page.locator('input[name^="balance:"]').fill('6'); await button('save-baseline').click(); }
    await page.waitForFunction(() => document.querySelector('.wjwk-modal').hidden);
  }
  assert.equal(await page.locator('[data-goal]').isVisible(), false);
  assert.equal(await button('review-management').isDisabled(), true);
  await button('settings').click(); await page.locator('[name="mode"]').selectOption('st'); await button('save-settings').click();
  await button('close').click(); await page.locator('#demo-management-turn').click(); await button('toggle').click();
  const initial = await state(), originalRole = await page.evaluate(() => JSON.stringify(demoContext.chat[0].variables));
  await button('review-management').click(); await page.waitForSelector('[name="management-change"]');
  assert.equal(await page.locator('[name="management-change"]').count(), 3);
  assert.equal(JSON.stringify(await state()), JSON.stringify(initial));
  await button('dialog-close').click();
  await button('review-management').click(); await page.waitForSelector('[name="management-change"]');
  await page.locator('[name="management-change"]').first().focus(); await page.locator('[name="management-change"]').first().press('Space');
  assert.equal(await page.locator('[name="management-change"]').first().isChecked(), false);
  await page.locator('[name="management-change"]').first().press('Space');
  await button('apply-management').click(); await page.waitForFunction(() => document.querySelector('.wjwk-modal').hidden);
  let current = await state();
  assert.equal(Object.values(current.powers).reduce((n, p) => n + Object.keys(p.managementRecords).length, 0), 3);
  assert.equal(Object.values(Object.values(current.powers).find(p => p.name === '深蓝').resources)[0].balance, '6');
  assert.equal(current.roleWrites.length, 0); assert.equal(current.narrativeActions.length, 0);
  assert.equal(await page.evaluate(() => JSON.stringify(demoContext.chat[0].variables)), originalRole);
  await button('review-management').click(); assert.equal(await page.locator('[name="management-change"]').count(), 0);
  await page.locator('.wjwk-power').filter({ hasText: '源堡' }).click();
  await page.locator('[data-action="manual-management"]:not([data-id])').click(); await page.locator('[name="label"]').fill('书房备忘');
  await page.locator('[name="value"]').fill('保留旧卷目录，<img src=x onerror=alert(1)>作为文字保存。');
  await page.locator('[name="note"]').fill('玩家核对书房记录'); await button('save-management').click();
  await page.waitForFunction(() => document.querySelector('.wjwk-modal').hidden);
  assert.equal(await page.locator('.wjwk-content img').count(), 0);
  await page.reload(); await button('toggle').click(); await page.locator('.wjwk-power').filter({ hasText: '源堡' }).click();
  assert.match(await page.locator('.wjwk-content').innerText(), /书房备忘/);
  await page.screenshot({ path: resolve(output, '管理台-桌面.png'), fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: resolve(output, '管理台-手机.png'), fullPage: true });
  assert.equal(await page.evaluate(() => document.querySelector('.wjwk-window').scrollWidth <= document.querySelector('.wjwk-window').clientWidth), true);
  await page.setViewportSize({ width: 1400, height: 980 });
  await page.evaluate(() => { demoContext.chat[1].mes = '这段来源被修改。' + demoContext.chat[1].mes; return demoEmit('MESSAGE_EDITED'); });
  assert.match(await page.locator('.wjwk-content').innerText(), /来源正文已变化/);
  assert.equal(await button('review-management').isDisabled(), true);
  assert.deepEqual(errors, []); assert.deepEqual(external, []);
  process.stdout.write(JSON.stringify({ passed: true, checks: ['three-types-registered', 'no-currency-management', 'read-only-preview', 'cancel-and-retry', 'keyboard-selection', 'single-confirmation', 'no-debit-or-MVU-write', 'repeat-review', 'manual-calibration', 'inert-text', 'reload', 'mobile-width', 'stale-source-warning'], pageErrors: errors, externalRequests: external, screenshots: output }, null, 2));
} finally { await browser?.close(); await new Promise(resolve => server.close(resolve)); }

