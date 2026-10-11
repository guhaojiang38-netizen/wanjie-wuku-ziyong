import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { resolve, dirname, extname, relative, isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
const project = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(process.env.WJWK_NODE_MODULES ? `${process.env.WJWK_NODE_MODULES}/package.json` : import.meta.url);
const { chromium } = require('playwright');
const output = process.env.WJWK_SCREENSHOTS || resolve(project, '../deliverables');
await mkdir(output, { recursive: true });
const server = createServer(async (req, res) => {
  try { const path = resolve(project, `.${decodeURIComponent(new URL(req.url, 'http://local').pathname)}`); const rel = relative(project, path); if (rel === '..' || rel.startsWith('..\\') || rel.startsWith('../') || isAbsolute(rel)) throw new Error('Invalid path'); const bytes = await readFile(path); res.setHeader('Content-Type', { '.js': 'text/javascript', '.html': 'text/html', '.css': 'text/css' }[extname(path)] || 'application/octet-stream'); res.end(bytes); }
  catch { res.writeHead(404); res.end('Not found'); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const url = `http://127.0.0.1:${server.address().port}/tests/preview.html`;
const browser = await chromium.launch({ headless: true, ...(process.env.WJWK_BROWSER_EXECUTABLE ? {executablePath:process.env.WJWK_BROWSER_EXECUTABLE} : {}), args: ['--no-sandbox'] });
const context = await browser.newContext({ viewport: { width: 1400, height: 980 }, deviceScaleFactor: 1 });
const page = await context.newPage(); const errors = []; page.on('pageerror', error => errors.push(error.message));
const button = name => page.locator(`[data-action="${name}"]`).last();
const state = () => page.evaluate(() => SillyTavern.getContext().chatMetadata.extensions.wanjie_wuku_general);
const register = async name => { await button('manage').click(); await button('read-book').click(); const value = await page.locator('[data-primary] option').filter({hasText:name}).first().getAttribute('value'); await page.locator('[data-primary]').selectOption(value); await button('register').click(); await page.waitForSelector('[data-action="save-baseline"]'); };
const baseline = async (balance, asset = false) => { if (!(await page.locator('[data-action="save-baseline"]').count())) await button('baseline').click(); await page.locator('input[name^="balance:"]').fill(balance); if (asset) { await page.locator('summary').filter({hasText:'已有能力与物资'}).click(); await page.locator('[name="assetName"]').fill('基础呼吸法'); await page.locator('[name="assetDescription"]').fill('已掌握第一阶段，当前身体可稳定运转。'); } await button('save-baseline').click(); await page.waitForFunction(() => !document.querySelector('.wjwk-modal:not([hidden])')); };
try {
  await page.goto(url); await button('toggle').click(); await register('蝴蝶效应');
  // A host-like custom checkbox style must not hide the extension's native tick.
  await page.addStyleTag({ content: "input[type=checkbox]{appearance:none;display:grid;overflow:hidden;padding:0;width:16px;height:16px}input[type=checkbox]::before{content:'';width:12px;height:12px;transform:scale(0)}input[type=checkbox]:checked::before{transform:scale(1)}" });
  // Rescan must work before any note or asset form is filled.
  await button('extract-balances').click(); await button('dialog-close').click(); await page.locator('[data-tab="operations"]').click();
  assert.match(await page.locator('.wjwk-resource').innerText(), /未确认/); await button('select-operation').click(); assert.equal(await button('execute').isDisabled(), true);
  await baseline('3'); await button('select-operation').click(); await page.screenshot({ path: resolve(output, '万界武库-v0.4.0-桌面.png'), fullPage: true });
  await button('execute').click(); await page.waitForFunction(() => Object.values(demoContext.chatMetadata.extensions.wanjie_wuku_general.powers)[0].resources[Object.keys(Object.values(demoContext.chatMetadata.extensions.wanjie_wuku_general.powers)[0].resources)[0]].balance === '2');
  await page.waitForFunction(() => !wanjie_wuku_general_instance.mainBusy && !wanjie_wuku_general_instance.narrativeLaunching);
  let s = await state(); assert.equal(Object.values(Object.values(s.powers)[0].assets)[0].quantity, '1');
  await page.locator('#demo-narrative').click({ force: true }); const main = await page.evaluate(() => demoLastMain); assert.match(main.chat.at(-1).content, /固定基准本源增益/);
  await page.reload(); await button('toggle').click(); await page.locator('[data-tab="operations"]').click(); s = await state(); assert.equal(Object.values(Object.values(s.powers)[0].resources)[0].balance, '2'); assert.equal(Object.values(Object.values(s.powers)[0].assets)[0].quantity, '1');
  await button('settings').click(); await page.locator('[name="mode"]').selectOption('custom'); await page.locator('[name="baseUrl"]').fill('https://models.example.test/v1'); await page.locator('[name="apiKey"]').fill('demo-key'); await button('fetch-models').click(); await page.waitForFunction(() => document.querySelector('[name="model"]').value === 'demo-chat-fast'); await page.locator('[data-model-search]').fill('reasoning'); await page.locator('[data-model-list]').selectOption('demo-chat-reasoning'); assert.equal(await page.locator('[name="model"]').inputValue(),'demo-chat-reasoning'); await button('fetch-models').click(); await page.waitForFunction(() => !document.querySelector('[data-action="fetch-models"]').disabled); assert.equal(await page.locator('[name="model"]').inputValue(),'demo-chat-reasoning'); await page.locator('[name="mode"]').selectOption('st'); await button('save-settings').click();
  await page.evaluate(() => demoAppend('你救下了迷路的旅人，获得两点因果收益。')); await button('sync').click(); await button('apply-sync').click(); await page.waitForFunction(() => !document.querySelector('.wjwk-modal:not([hidden])'));
  s = await state(); assert.equal(Object.values(Object.values(s.powers)[0].resources)[0].balance, '4'); await button('sync').click(); s = await state(); assert.equal(Object.values(Object.values(s.powers)[0].resources)[0].balance, '4');
  await register('深蓝'); await baseline('5', true); await page.locator('[data-goal]').fill('把呼吸法推演到当前可承受的第二阶段'); await button('generate').click(); await page.waitForSelector('.wjwk-operation');
  s = await state(); const blue = Object.values(s.powers).find(p => p.name === '深蓝'); assert.equal(Object.values(blue.resources)[0].balance, '5'); await button('execute').click(); await page.waitForFunction(() => Object.values(demoContext.chatMetadata.extensions.wanjie_wuku_general.powers).find(p => p.name === '深蓝').resources[Object.keys(Object.values(demoContext.chatMetadata.extensions.wanjie_wuku_general.powers).find(p => p.name === '深蓝').resources)[0]].balance === '3');
  assert.equal(await page.evaluate(() => demoLastRaw.chat.some(m => m.content.includes('WJWK_COMMITTED_STATE_V1'))), false);
  // v0.3: actual role fields through the clearly labelled original mock host.
  await button('manage').click(); await button('role-read').click();
  await page.waitForSelector('[data-action="role-save"]');
  assert.ok(await page.locator('input[name="role-root"]:checked').count());
  const ruleInputs = page.locator('input[name="role-rule"]'), initialRules = await ruleInputs.evaluateAll(inputs => inputs.filter(i => i.checked).map(i => i.value));
  for (const input of await ruleInputs.all()) await input.uncheck();
  assert.equal(await button('role-save').isDisabled(), true);
  const updateRule = page.locator('input[name="role-rule"][data-role-kind="update"]').first();
  assert.equal(await updateRule.evaluate(input => getComputedStyle(input).appearance), 'auto');
  assert.equal(await updateRule.evaluate(input => getComputedStyle(input).padding), '0px');
  await updateRule.focus(); await updateRule.press('Space'); assert.equal(await updateRule.isChecked(), true); assert.equal(await button('role-save').isDisabled(), false);
  const ruleLabel = updateRule.locator('..'); await ruleLabel.locator('strong').click(); assert.equal(await updateRule.isChecked(), false); assert.equal(await button('role-save').isDisabled(), true);
  await ruleLabel.locator('strong').click(); assert.equal(await updateRule.isChecked(), true);
  await updateRule.locator('../..').locator('summary').click(); assert.equal(await updateRule.isChecked(), true);
  for (const input of await ruleInputs.all()) if (initialRules.includes(await input.inputValue())) await input.check();
  assert.match(await page.locator('[data-role-selected-count]').innerText(), /包含变量更新规则/);
  await button('role-save').click(); await page.waitForFunction(() => !document.querySelector('.wjwk-modal:not([hidden])'));
  await page.locator('[data-goal]').fill('推演穿云游燕掌法（八品精妙），保留旧功法');
  await button('generate').click(); await page.waitForSelector('.wjwk-role-changes');
  assert.equal(await page.evaluate(()=>demoContext.chat[0].variables[0].stat_data.主角.源质点),6);
  await button('execute').click(); await page.waitForFunction(()=>demoContext.chatMetadata.extensions.wanjie_wuku_general.roleWrites.at(-1)?.status==='applied');
  await page.waitForFunction(()=>demoContext.chatMetadata.extensions.wanjie_wuku_general.roleWrites.at(-1)?.receiptStatus==='written');
  assert.match(await page.locator('#demo-message-receipts summary').innerText(), /状态栏更新简报/);
  const role = await page.evaluate(()=>demoContext.chat.findLast(m=>m.variables?.[m.swipe_id||0]?.stat_data).variables[0].stat_data.主角);
  assert.equal(role.源质点,0); assert.equal(role.功法.拂风绵掌.品级,3); assert.equal(role.功法.穿云游燕掌法.品级,8);
  await button('close').click(); await page.locator('#demo-next-turn').click(); await button('toggle').click(); await page.waitForFunction(()=>Object.values(Object.values(demoContext.chatMetadata.extensions.wanjie_wuku_general.powers).find(p=>p.name==='深蓝').resources)[0].balance==='2');
  assert.equal(await button('generate').isDisabled(),false);
  await button('close').click(); await page.locator('#demo-continue').click(); await button('toggle').click(); await page.waitForFunction(()=>Object.values(Object.values(demoContext.chatMetadata.extensions.wanjie_wuku_general.powers).find(p=>p.name==='深蓝').resources)[0].balance==='4');
  assert.equal(await button('generate').isDisabled(),false);
  await page.locator('[data-tab="assets"]').click(); await page.setViewportSize({ width: 390, height: 844 }); await page.screenshot({ path: resolve(output, '万界武库-v0.4.0-手机.png'), fullPage: true });
  assert.equal(await page.evaluate(() => document.querySelector('.wjwk-window').scrollWidth <= document.querySelector('.wjwk-window').clientWidth), true);
  await page.setViewportSize({ width: 1400, height: 980 }); await page.locator('[data-tab="operations"]').click();
  await page.evaluate(() => { demoContext.chat[0].mes = '旧消息被改写'; return demoEmit('MESSAGE_EDITED'); }); assert.equal(await button('generate').isDisabled(), true); await button('rebase').click(); await button('confirm-rebase').click(); await page.waitForFunction(() => !document.querySelector('.wjwk-modal:not([hidden])')); assert.equal(await button('generate').isDisabled(), false);
  // A returned plan must be discarded if the user switches chats during the call.
  await page.evaluate(() => { globalThis.demoDelay = 250; }); await page.locator('[data-goal]').fill('再推演一阶段'); await button('generate').click(); await page.evaluate(() => { demoContext.chatId = 'other-chat'; demoContext.chatMetadata = {}; return demoEmit('CHAT_CHANGED'); }); await page.waitForTimeout(350); assert.equal(Object.keys((await state()).powers).length, 0);
  assert.deepEqual(errors, []); process.stdout.write(JSON.stringify({ browser: 'Chromium', passed: true, checks: ['registration-auto-balance-setup', 'rescan-without-required-note', 'unknown-balance', 'immediate-settlement', 'prompt-injection', 'reload-persistence', 'model-list-discovery-search-preserve', 'story-sync-once', 'deepblue-resource-separation', 'raw-query-isolation', 'mvu-two-panel-discovery', 'mvu-preview-no-debit', 'mvu-write-save-readback', 'mvu-preserve-old-skill', 'normal-turn-wallet-read', 'same-floor-continue-wallet-read', 'mobile-width', 'history-rebase', 'chat-switch-cancellation'], pageErrors: errors, screenshots: output }, null, 2));
} finally { await browser.close(); await new Promise(resolve => server.close(resolve)); }
