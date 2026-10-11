import test from 'node:test';
import strict from 'node:assert/strict';
import { WukuApp } from '../index.js';
import { ChatStore } from '../src/host.js';
import { MODULE_ID, emptyState, importBook, createPower, clone, builtInOperations, hash, stable, chatHashes } from '../src/core.js';
import { ModelConnection } from '../src/model.js';

function setup() {
  const memory = new Map(); let saved;
  const localStorage = { getItem: k => memory.get(k), setItem: (k, v) => memory.set(k, v) };
  const ctx = { userHandle: 'test-user', chatId: 'app-test', characterId: 0, characters: [{ name: '角色', avatar: 'test.png' }], mainApi: 'openai', name1: '玩家', name2: '角色', chat: [{ mes: '最初的剧情。', name: '角色', is_user: false }], chatMetadata: {}, extensionSettings: {}, saveChat: async () => { saved = clone(ctx.chatMetadata); }, getRequestHeaders: () => ({}) };
  globalThis.SillyTavern = { getContext: () => ctx };
  const state = emptyState(); const entries = importBook({ entries: { 1: { comment: '蝴蝶效应', content: '使用因果点执行完整效果规格。{{user}}能够直接消耗1因果点，将一份固定基准底蕴永久叠加到自身' }, 2: { comment: '深蓝', content: '以既有能力为锚点，根据目标缺口消耗源质点推演进阶。' } } }, '测试');
  for (const entry of entries) { const p = createPower(entry); Object.values(p.resources)[0].balance = '3'; state.powers[p.id] = p; }
  state.historyAnchor = chatHashes(ctx.chat); state.syncCursor = ctx.chat.length; ctx.chatMetadata.extensions = { [MODULE_ID]: state };
  const app = new WukuApp(); app.store = new ChatStore({ context: () => ctx, storageImpl: localStorage, lockManager: null, fetchImpl: async () => ({ ok: true, json: async () => [{ chat_metadata: saved || {} }] }) });
  app.bridge = { chat: true, plain: true, available: true }; const dialogs = [];
  app.ui = { goal: '一个明确目标', notice: null, render(view) { this.view = view; }, setNotice(message, error) { this.notice = { message, error }; }, closeDialog() {}, showSync(ops, state, message) { dialogs.push({ ops, state, message }); } };
  app.refresh();
  return { app, ctx, state, dialogs, p: Object.values(state.powers)[0], blue: Object.values(state.powers)[1] };
}
function enable(f, responder) {
  f.app.settings.mode = 'st'; f.ctx.generateRaw = async params => responder(JSON.parse(params.prompt)); f.app.model = new ModelConnection({ context: () => f.ctx, settings: () => f.app.settings, getKey: () => '' });
}
function rawOperation(p, amount = '1') { return { label: '测试操作', ruleQuote: p.rules.slice(0, 12), ready: true, costs: [{ kind: 'resource', id: Object.values(p.resources)[0].id, amount }], effects: [{ type: 'asset_grant', name: '能力成果', kind: '能力', description: '明确且完整的测试能力成果规格', quantity: '1', permanent: true }] }; }

test('modern ST slash-command start without end cannot lock the workbench', async () => {
  const f = setup(), handlers = new Map();
  f.ctx.eventTypes = Object.fromEntries(['GENERATION_STARTED', 'GENERATION_AFTER_COMMANDS', 'GENERATION_ENDED', 'GENERATION_STOPPED'].map(n => [n, n]));
  f.ctx.eventSource = { on: (n, fn) => handlers.set(n, fn) };
  f.app.beginNarrative = async () => {}; f.app.scheduleRoleRead = () => {};
  f.app.attachChatHooks();
  // Real ST slash commands emit STARTED and then return without AFTER_COMMANDS or ENDED.
  await handlers.get('GENERATION_STARTED')?.('normal', {}, false);
  strict.equal(f.app.mainBusy, false); strict.equal(f.app.ui.view.busy, false);
  await handlers.get('GENERATION_AFTER_COMMANDS')('normal', {}, false);
  strict.equal(f.app.mainBusy, true); strict.equal(f.app.ui.view.busy, true);
  await handlers.get('GENERATION_ENDED')();
  strict.equal(f.app.mainBusy, false); strict.equal(f.app.ui.view.busy, false);
  await handlers.get('GENERATION_AFTER_COMMANDS')('quiet', {}, false);
  await handlers.get('GENERATION_AFTER_COMMANDS')('normal', {}, true);
  strict.equal(f.app.mainBusy, false);
});

test('hosts without AFTER_COMMANDS keep legacy generation locking', async () => {
  const f = setup(), handlers = new Map();
  f.ctx.eventTypes = { GENERATION_STARTED: 'start', GENERATION_STOPPED: 'stop' };
  f.ctx.eventSource = { on: (n, fn) => handlers.set(n, fn) };
  f.app.beginNarrative = async () => {}; f.app.stopNarrative = async () => {}; f.app.scheduleRoleRead = () => {};
  f.app.attachChatHooks(); await handlers.get('start')('normal', {}, false);
  strict.equal(f.app.mainBusy, true);
  await handlers.get('stop')(); strict.equal(f.app.mainBusy, false);
});
test('controller can execute a literal built-in operation with async model disabled', async () => { const f = setup(); f.app.selected = f.app.ui.view.operations[0]; await f.app.execute(); const p = Object.values(f.app.store.read().powers)[0]; strict.equal(Object.values(p.resources)[0].balance, '2'); strict.equal(Object.values(p.assets)[0].quantity, '1'); strict.equal(f.app.committing, false); });
test('generating and browsing a valid plan never changes the ledger', async () => { const f = setup(); enable(f, () => ({ operations: [] })); f.ctx.generateRaw = async () => JSON.stringify({ operations: [rawOperation(f.p)], message: '测试' }); const before = stable(f.app.store.read()); await f.app.generate(); strict.equal(f.app.plans.length, 1); strict.equal(stable(f.app.store.read()), before); });
test('invalid model output creates no executable plans and no debit', async () => { const f = setup(); enable(f, () => {}); f.ctx.generateRaw = async () => JSON.stringify({ operations: [{ ...rawOperation(f.p), ruleQuote: '这不是原始词条正文' }] }); await f.app.generate(); strict.equal(f.app.plans.length, 0); strict.equal(Object.values(Object.values(f.app.store.read().powers)[0].resources)[0].balance, '3'); });
test('the entire selected rule and only that power currency are sent to a plan request', async () => {
  const f = setup(); f.app.powerId = f.blue.id; f.app.refresh(); let captured; enable(f, input => { captured = input; return JSON.stringify({ operations: [] }); }); await f.app.generate(); strict.equal(captured.selectedRule.fullText, f.blue.rules); strict.equal(Object.values(captured.state.resources)[0].name, '源质点'); strict.equal(Object.values(f.app.store.read().powers)[0].resources[Object.keys(f.p.resources)[0]].balance, '3');
});
test('new narrative during generation invalidates the returned plan', async () => { const f = setup(); enable(f, () => { f.ctx.chat.push({ mes: '剧情已经变化。', is_user: false }); return JSON.stringify({ operations: [rawOperation(f.p)] }); }); await strict.rejects(f.app.generate(), /剧情发生变化/); strict.equal(f.app.plans.length, 0); });
test('manual story reconciliation is reviewed first and credits the delta exactly once', async () => {
  const f = setup(); const evidence = '你救下旅人，已经获得两点因果收益。'; f.ctx.chat.push({ mes: evidence, is_user: false }); enable(f, () => JSON.stringify({ events: [{ ...rawOperation(f.p), powerId: f.p.id, costs: [], effects: [{ type: 'resource_credit', id: Object.values(f.p.resources)[0].id, amount: '2' }], evidence: [evidence] }], message: '新增收益' }));
  await f.app.sync(); strict.equal(f.dialogs.length, 1); strict.equal(Object.values(Object.values(f.app.store.read().powers)[0].resources)[0].balance, '3'); await f.app.applySync(); strict.equal(Object.values(Object.values(f.app.store.read().powers)[0].resources)[0].balance, '5'); strict.equal(f.app.store.read().syncCursor, 2); await f.app.sync(); strict.equal(Object.values(Object.values(f.app.store.read().powers)[0].resources)[0].balance, '5');
});
test('failed later event rolls back the entire candidate batch', async () => {
  const f = setup(), evidence = '剧情中已经完成了一次变化。'; f.ctx.chat.push({ mes: evidence, is_user: false }); enable(f, () => JSON.stringify({ events: [{ ...rawOperation(f.p), powerId: f.p.id, costs: [], effects: [{ type: 'resource_credit', id: Object.values(f.p.resources)[0].id, amount: '2' }], evidence: [evidence] }, { ...rawOperation(f.blue, '99'), powerId: f.blue.id, evidence: [evidence] }] }));
  await f.app.sync(); const before = stable(f.app.store.read()); await strict.rejects(f.app.applySync(), /不足/); strict.equal(stable(f.app.store.read()), before);
});
test('player intention alone cannot be used as event evidence', async () => {
  const f = setup(), evidence = '我要完成签到并领取两点收益。'; f.ctx.chat.push({ mes: evidence, is_user: true }, { mes: '你还没有执行这次签到。', is_user: false }); enable(f, () => JSON.stringify({ events: [{ ...rawOperation(f.p), powerId: f.p.id, evidence: [evidence] }] })); await strict.rejects(f.app.sync(), /叙事证据/); strict.equal(f.app.store.read().transactions.length, 0);
});
test('main API must have the matching prompt bridge before an operation can commit', async () => { const f = setup(); f.app.bridge.chat = false; f.app.selected = f.app.ui.view.operations[0]; await strict.rejects(f.app.execute(), /主叙事同步接口/); strict.equal(Object.values(Object.values(f.app.store.read().powers)[0].resources)[0].balance, '3'); });
test('switching chat during a raw request discards the returned result', async () => { const f = setup(); enable(f, () => { f.ctx.chatId = 'another-chat'; f.ctx.chatMetadata = {}; return JSON.stringify({ operations: [rawOperation(f.p)] }); }); await strict.rejects(f.app.generate(), /聊天已经切换/); strict.equal(Object.keys(f.app.store.read().powers).length, 0); });
test('a second execution click while saving cannot generate another debit', async () => {
  const f = setup(); let release; f.ctx.saveChat = () => new Promise(resolve => { release = resolve; }); f.app.selected = f.app.ui.view.operations[0]; const first = f.app.execute(); await new Promise(resolve => setTimeout(resolve, 0)); await strict.rejects(f.app.execute(), /提交账目/); release(); await first; strict.equal(Object.values(Object.values(f.app.store.read().powers)[0].resources)[0].balance, '2'); strict.equal(f.app.store.read().transactions.length, 1);
});
test('opening balance setup scans candidates immediately and old resources upgrade without replacing stored balances', async () => {
  const f = setup(); let shown; Object.values(f.p.resources)[0].balance = null; f.ctx.chat.push({ mes: '<WJWK-status>【蝴蝶效应】<br>因果点余额：[12]</WJWK-status>', is_user:false }); f.app.ui.showBaseline = (p, findings) => { shown = {p,findings}; };
  await f.app.openBaseline(); strict.equal(shown.findings[Object.keys(f.p.resources)[0]].balance, '12'); strict.equal(Object.values(shown.p.resources)[0].balance, null);
  strict.ok(f.app.baselineCapture); strict.equal(f.app.baselinePowerId, f.p.id);
});
test('confirming a balance needs only its actual value, not a note or ability form', async () => {
  const f = setup(); f.app.ui.showBaseline = () => {}; await f.app.openBaseline(); const r = Object.values(f.p.resources)[0];
  await f.app.action('save-baseline', { values: { [`balance:${r.id}`]:'12', [`floor:${r.id}`]:'0', assetName:'', reason:'' } });
  const s = f.app.store.read(); strict.equal(s.powers[f.p.id].resources[r.id].balance, '12'); strict.match(s.transactions.at(-1).changes.join(' '), /玩家核对/);
});
test('all-power balance confirmation isolates identical resource identifiers between powers', async () => {
  const f = setup(); f.app.ui.showBalances = () => {}; await f.app.openBalances(); const r = Object.values(f.p.resources)[0], blue = Object.values(f.blue.resources)[0];
  await f.app.action('save-balances', { values: { [`balance:${f.p.id}:${r.id}`]:'7', [`balance:${f.blue.id}:${blue.id}`]:'9' } });
  const s = f.app.store.read(); strict.equal(s.powers[f.p.id].resources[r.id].balance, '7'); strict.equal(s.powers[f.blue.id].resources[blue.id].balance, '9');
});
test('model discovery consumes unsaved draft credentials and applies results without changing saved settings', async () => {
  const f = setup(); const oldFormData = globalThis.FormData; let credentials, selection; const fields = { mode:'custom',baseUrl:'https://example.test/v1',apiKey:'draft-key',model:'' }; const form = { isConnected:true };
  globalThis.FormData = class { constructor() { } *[Symbol.iterator]() { yield* Object.entries(fields); } };
  f.app.ui.setModelLoading = () => {}; f.app.ui.setModels = (ids, model) => { selection = { ids, model }; }; f.app.model.listModels = async data => { credentials = data; return ['a-embedding','chat-model']; };
  try { await f.app.fetchModels({ values:fields,form }); strict.equal(credentials.apiKey,'draft-key'); strict.equal(selection.model,'chat-model'); strict.equal(f.app.apiKey,''); strict.equal(f.app.settings.model,''); }
  finally { globalThis.FormData = oldFormData; }
});
test('model list refresh keeps a typed current selection and discards results from a closed form', async () => {
  const f = setup(); const oldFormData = globalThis.FormData; let selection; const fields = { mode:'custom',baseUrl:'https://example.test/v1',apiKey:'key',model:'custom-model' }; const form = { isConnected:true };
  globalThis.FormData = class { *[Symbol.iterator]() { yield* Object.entries(fields); } }; f.app.ui.setModelLoading = () => {}; f.app.ui.setModels = (_ids, model) => { selection = model; }; f.app.model.listModels = async () => ['chat-model'];
  try { await f.app.fetchModels({ values:fields,form }); strict.equal(selection,'custom-model'); selection = null; form.isConnected = false; await f.app.fetchModels({ values:fields,form }); strict.equal(selection,null); }
  finally { globalThis.FormData = oldFormData; }
});

test('delete power confirms before mutation, clears live references, preserves other power and audit history', async () => {
  const { saveArchive, archiveSource } = await import('../src/archives.js');
  const f = setup(); f.app.powerId = f.p.id; let prompted;
  const r = saveArchive(f.p, {type:'population',name:'工蜂',status:'active',fields:{scale:'三十只'}}, archiveSource(f.ctx.chat, '玩家确认'));
  f.state.archiveMemory = { auto:false,budget:3000,selections:{[`${f.p.id}/${r.id}`]:{mode:'pinned',token:'test'}} };
  f.state.favoriteActions = [{id:'fav_test',powerId:f.p.id,label:'测试',goal:'巡视',at:0}];
  f.state.transactions.push({id:'old',powerId:f.p.id,label:'旧记录',changes:[],evidence:[],costs:[],effects:[],at:0});
  f.app.ui.showDeletePower = p => prompted=p.id;
  const before = clone(f.app.store.read()); await f.app.action('delete-power', {}); strict.equal(prompted,f.p.id); strict.deepEqual(f.app.store.read(),before);
  await f.app.action('confirm-delete-power', {}); const after=f.app.store.read(); strict.equal(after.powers[f.p.id],undefined); strict.deepEqual(after.powers[f.blue.id],before.powers[f.blue.id]); strict.deepEqual(after.favoriteActions,[]); strict.deepEqual(after.archiveMemory.selections,{}); strict.ok(after.transactions.some(t=>t.id==='old')); strict.ok(after.transactions.some(t=>t.label===`删除接入：${f.p.name}`));
});
test('delete confirmation cannot cross chat or overwrite a newer revision', async () => {
  const f=setup(); f.app.powerId=f.p.id; f.app.ui.showDeletePower=()=>{};
  await f.app.action('delete-power',{}); await f.app.store.transact(s=>{s.syncCursor=0;}); await strict.rejects(f.app.action('confirm-delete-power',{}),/档案已经变化/); strict.ok(f.app.store.read().powers[f.p.id]);
  await f.app.action('delete-power',{}); f.ctx.chatId='other'; f.ctx.chatMetadata={}; await strict.rejects(f.app.action('confirm-delete-power',{}),/聊天已经切换/); strict.equal(Object.keys(f.app.store.read().powers).length,0);
});
test('delete blocks pending role writes and generation', async () => {
  const f=setup(); f.app.powerId=f.p.id; f.app.ui.showDeletePower=()=>{};
  f.app.mainBusy=true; await strict.rejects(f.app.action('delete-power',{}),/生成结束/); f.app.mainBusy=false;
  f.state.roleWrites=[{id:'pending',status:'pending',patches:[],changes:[],afterStatHash:'hash',linkVersion:'version',capture:{}}];
  await strict.rejects(f.app.action('delete-power',{}),/待完成的角色写回/); strict.ok(f.app.store.read().powers[f.p.id]);
});
