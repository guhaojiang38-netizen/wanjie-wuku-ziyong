import test from 'node:test';
import strict from 'node:assert/strict';
import { installInjection } from '../src/host.js';
import { WukuApp } from '../index.js';
import { importBook, createPower, hash, stable, chatHashes } from '../src/core.js';

test('shipped offline host completes role discovery, generation and saved-floor verification', async () => {
  const memory = new Map(), oldDoc = globalThis.document;
  globalThis.localStorage = { getItem: k => memory.get(k) ?? null, setItem: (k, v) => memory.set(k, String(v)), removeItem: k => memory.delete(k) };
  const elements = new Map(); globalThis.document = { querySelector: () => ({ textContent: '' }), getElementById(id) { if (!elements.has(id)) elements.set(id, { textContent: '', addEventListener() {} }); return elements.get(id); } };
  await import('./mock-host.js');
  const app = new WukuApp(), ctx = globalThis.demoContext; app.ui = { goal: '推演穿云游燕掌法，保留拂风绵掌', render(view) { this.view = view; }, setNotice(message, error) { this.notice = { message, error }; }, closeDialog() {}, showManage() {}, setSceneBusy() {}, showSceneSuggestions() {} }; app.bridge = { chat: true, plain: true, available: true };
  const entry = importBook(await ctx.loadWorldInfo('开发示例规则'), '开发示例规则').find(e => e.name === '深蓝'), power = createPower(entry);
  await app.store.transact(next => { next.powers[power.id] = power; next.historyAnchor = chatHashes(ctx.chat); next.syncCursor = ctx.chat.length; }); app.refresh();
  const draft = await app.role.discover(); app.roleDraft = draft; strict.equal(draft.rules.length, 3);
  const oldFD = globalThis.FormData; globalThis.FormData = class { getAll(name) { return name === 'role-root' ? ['/主角'] : name === 'role-rule' ? draft.rules.map(r => r.id) : []; } };
  try { await app.saveRole({ form: {}, values: { [`role-balance:${power.id}:${Object.keys(power.resources)[0]}`]: '/主角/源质点' } }); } finally { globalThis.FormData = oldFD; }
  app.settings.mode = 'st'; await app.generate(); strict.equal(app.plans.length, 1); strict.equal(ctx.chat[0].variables[0].stat_data.主角.源质点, 6); await app.execute();
  strict.equal(app.store.read().roleWrites[0].status, 'applied'); strict.equal(ctx.chat[0].variables[0].stat_data.主角.源质点, 0); strict.equal(ctx.chat[0].variables[0].stat_data.主角.功法.穿云游燕掌法.品级, 8); strict.equal(ctx.chat[0].variables[0].stat_data.主角.功法.拂风绵掌.品级, 3); strict.match(elements.get('demo-role-state').textContent, /穿云游燕掌法/);
  strict.equal(app.store.read().roleWrites[0].receiptStatus, 'written'); strict.match(elements.get('demo-message-receipts').innerHTML, /本次插件更新 · 已写回/);
  app.bridge = installInjection({store:app.store,extraInjection:s=>app.roleInjection(s)+app.narrativeInjection(s)}); app.attachChatHooks(); await app.unfoldStory();
  strict.equal(app.store.read().narrativeActions[0].status,'presented'); strict.match(elements.get('demo-story').textContent,/温热的力量/); strict.match(JSON.stringify(globalThis.demoLastMain),/WJWK_NARRATIVE_ACTION_V1/);
  await app.sceneActions(); strict.equal(app.ui.view.sceneCandidates.length,1); await app.saveFavorite(); strict.equal(app.store.read().favoriteActions.length,1);
  await app.reviewStory(app.store.read().narrativeActions[0].id); strict.equal(app.store.read().narrativeActions[0].review.covered,true); strict.doesNotMatch(JSON.stringify(globalThis.demoLastRaw),/WJWK_NARRATIVE_ACTION_V1/);
  await app.setStoryStatus(app.store.read().narrativeActions[0].id,'confirmed'); await globalThis.demoNextTurn(); await app.pullRoleBalances();
  strict.equal(app.ui.view.historyMismatch, false); strict.equal(ctx.chat.at(-1).variables[0].stat_data.主角.源质点, 2);
  await globalThis.demoNextTurn(true); await app.pullRoleBalances();
  strict.equal(app.ui.view.historyMismatch, false); strict.equal(ctx.chat.at(-1).variables[0].stat_data.主角.源质点, 4);
  strict.equal(app.store.read().roleWrites.length, 1); clearTimeout(app.roleTimer); clearTimeout(app.syncTimer); app.bridge.cleanup();
  if (oldDoc === undefined) delete globalThis.document; else globalThis.document = oldDoc;
});
