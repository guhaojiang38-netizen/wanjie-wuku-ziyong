import test from 'node:test';
import strict from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { WukuApp } from '../index.js';
import { ChatStore } from '../src/host.js';
import { WorkbenchUI } from '../src/ui.js';
import { managementSources, managementPrompt, normalizeManagement, applyManagement } from '../src/management.js';
import { emptyState, createPower, importBook, clone, hash, stable, chatHashes, validateState, normalizeOperation, applyOperation, canAfford, publicPower, managementRecordCurrent, buildInjection } from '../src/core.js';

function fixture() {
  const s = emptyState(), chat = [{ name: '角色', is_user: false, mes: '你来到院中。' }];
  const entries = importBook({ entries: [
    { comment: '深蓝', content: '根据已经成立的锚点记录后续推演方向，已有成果长期保留。' },
    { comment: '源堡', content: '保存已经建立的领域安排与重要封存记录，直到主动改变。' },
    { comment: '熟练度状态栏', content: '记录实践中已经形成的真实成长，已有掌握长期保留。' },
  ] }, '自编管理样本');
  for (const e of entries) { const p = createPower(e); s.powers[p.id] = p; }
  const powers = Object.values(s.powers);
  s.managementStart = 1; s.syncCursor = 1; s.historyAnchor = chatHashes(chat);
  chat.push({ name: '角色', is_user: false, swipe_id: 0, mes: '轻灵步法的研究方向已经明确。旧卷已封存在书房的木柜中。剑术练习后步法衔接更加稳定。' });
  const sources = managementSources(chat, s);
  const raw = powers.map((p, i) => ({ powerId: p.id, category: ['progress', 'arrangement', 'progress'][i], label: ['研究方向', '封存安排', '剑术进展'][i], value: ['轻灵步法的研究方向已经明确。', '旧卷已封存在书房的木柜中。', '剑术练习后步法衔接更加稳定。'][i], sourceIndex: 1, quote: ['轻灵步法的研究方向已经明确。', '旧卷已封存在书房的木柜中。', '剑术练习后步法衔接更加稳定。'][i], ruleQuote: p.rules.slice(0, 12), status: 'active' }));
  return { s, chat, powers, sources, raw };
}
function appFixture() {
  const f = fixture(), memory = new Map(); let saved;
  const ctx = { userHandle: 'management-test', chatId: 'chat', characterId: 0, characters: [{ name: '角色', avatar: 'role.png' }], name1: '玩家', name2: '角色', mainApi: 'openai', chat: f.chat, chatMetadata: { extensions: { wanjie_wuku_general: f.s } }, extensionSettings: {}, getRequestHeaders: () => ({}), saveChat: async () => { saved = clone(ctx.chatMetadata); } };
  globalThis.SillyTavern = { getContext: () => ctx };
  const app = new WukuApp(); app.settings.mode = 'st';
  app.store = new ChatStore({ context: () => ctx, lockManager: null, storageImpl: { getItem: k => memory.get(k), setItem: (k, v) => memory.set(k, v) }, fetchImpl: async () => ({ ok: true, json: async () => [{ chat_metadata: saved }] }) });
  app.bridge = { chat: true, plain: true, available: true };
  app.ui = { render(v) { this.view = v; }, setNotice(message) { this.notice = { message }; }, closeDialog() {}, showManagementReview(v) { this.pending = v; }, showManagementRecord(p, r) { this.editing = { p, r }; } };
  let requests = 0;
  app.model = { request: async () => { requests++; return JSON.stringify({ changes: f.raw }); } };
  app.refresh(); return { ...f, app, ctx, requests: () => requests };
}

test('permanent or reusable assets cannot be debited, even through a stale/tampered operation', () => {
  const f = fixture(), p = f.powers[0];
  p.assets.skill = { id: 'skill', name: '掌法', kind: '能力', permanent: true, quantity: '1', description: '可复用能力' };
  const raw = { label: '操作', ready: true, ruleQuote: p.rules.slice(0, 12), costs: [{ kind: 'asset', id: 'skill', amount: '1' }], effects: [{ type: 'field_set', key: 'direction', value: '继续研究' }] };
  strict.throws(() => normalizeOperation(raw, p, f.s, 'context'), /不能作为消耗品/);
  p.assets.skill = { ...p.assets.skill, kind: '物资', permanent: false };
  const op = normalizeOperation(raw, p, f.s, 'context');
  p.assets.skill.permanent = true;
  strict.equal(canAfford(p, op).ok, false); strict.throws(() => applyOperation(f.s, op, 'context', []));
  strict.equal(p.assets.skill.quantity, '1');
});
test('ordinary consumable materials remain usable', () => {
  const f = fixture(), p = f.powers[0]; p.assets.material = { id: 'material', name: '矿石', kind: '物资', permanent: false, quantity: '2', description: '已持有矿石' };
  const op = normalizeOperation({ label: '加工', ready: true, ruleQuote: p.rules.slice(0, 12), costs: [{ kind: 'asset', id: 'material', amount: '1' }], effects: [{ type: 'field_set', key: 'progress', value: '加工完成' }] }, p, f.s, 'context');
  applyOperation(f.s, op, 'context', []); strict.equal(p.assets.material.quantity, '1');
});
test('three management samples save evidence without changing money, assets, or generating actions', () => {
  const f = fixture(), before = f.powers.map(p => stable([p.resources, p.assets]));
  const changes = normalizeManagement({ changes: f.raw }, f.s, f.sources);
  strict.equal(changes.length, 3); applyManagement(f.s, changes, f.sources, f.chat);
  strict.deepEqual(f.powers.map(p => stable([p.resources, p.assets])), before);
  strict.equal(f.s.transactions.length, 0); strict.equal(f.s.narrativeActions, undefined);
  for (const p of f.powers) strict.equal(Object.values(p.managementRecords)[0].source.index, 1);
  strict.equal(managementSources(f.chat, f.s).length, 0); validateState(f.s);
});
test('user intentions, old floors and owned status displays are excluded as evidence', () => {
  const f = fixture(); f.chat.push({ is_user: true, mes: '我打算完成签到并取得新掌法。' }, { is_system: true, mes: '系统说明不构成剧情。' }, { mes: '<WJWK-status>只有状态栏文字。</WJWK-status>' });
  strict.equal(managementSources(f.chat, f.s).length, 1);
  strict.equal(normalizeManagement({ changes: [{ ...f.raw[0], sourceIndex: 999, quote: '概括说明', ruleQuote:'' }] }, f.s, f.sources).length,1);
});
test('unknown records, duplicates and economic updates are rejected', () => {
  const f = fixture();
  for (const change of [{ ...f.raw[0], recordId: 'missing' }, { ...f.raw[0], label: '源质点余额' }, { ...f.raw[0], rolePath: '/玩家/技能' }, { ...f.raw[0], effects: [] }, { ...f.raw[0], category: '__proto__' }]) strict.throws(() => normalizeManagement({ changes: [change] }, f.s, f.sources));
  strict.throws(() => normalizeManagement({ changes: [f.raw[0], f.raw[0]] }, f.s, f.sources), /重复/);
});
test('an existing record updates by stable identity and can end without deletion', () => {
  const f = fixture(); const first = normalizeManagement({ changes: [f.raw[1]] }, f.s, f.sources); applyManagement(f.s, first, f.sources, f.chat);
  const id = first[0].id;
  f.chat.push({ mes: '你解除了书房的旧卷封存安排。', name: '角色', swipe_id: 0 });
  const sources = managementSources(f.chat, f.s);
  const change = normalizeManagement({ changes: [{ ...f.raw[1], recordId: id, value: '封存已解除', status: 'ended', sourceIndex: 2, quote: '你解除了书房的旧卷封存安排。' }] }, f.s, sources);
  applyManagement(f.s, change, sources, f.chat);
  strict.equal(Object.keys(f.powers[1].managementRecords).length, 1); strict.equal(f.powers[1].managementRecords[id].status, 'ended');
  strict.equal(Object.keys(publicPower(f.powers[1]).managementRecords).length, 0);
});
test('same-floor continuation can be reviewed again without storing unchanged facts twice', () => {
  const f = fixture(); applyManagement(f.s, normalizeManagement({ changes: f.raw }, f.s, f.sources), f.sources, f.chat);
  f.chat[1].mes += '你继续坐下研读。'; const sources = managementSources(f.chat, f.s);
  strict.equal(sources.length, 1); strict.equal(normalizeManagement({ changes: f.raw }, f.s, sources).length, 0);
});
test('editing or swiping the source after preview does not block saving', () => {
  for (const mutate of [f => { f.chat[1].mes += '被改写'; }, f => { f.chat[1].swipe_id = 1; }]) {
    const f = fixture(), changes = normalizeManagement({ changes: f.raw }, f.s, f.sources); mutate(f);
    applyManagement(f.s, changes, f.sources, f.chat);
    strict.equal(Object.keys(f.powers[0].managementRecords).length, 1); validateState(f.s);
  }
});
test('batching processes the oldest 24 floors and never silently skips later floors', () => {
  const f = fixture(); for (let i = 0; i < 30; i++) f.chat.push({ mes: `后续第${i}轮真实剧情。`, name: '角色' });
  const sources = managementSources(f.chat, f.s); strict.equal(sources.length, 24);
  applyManagement(f.s, [], sources, f.chat); strict.equal(managementSources(f.chat, f.s).length, 7);
});
test('request capacity rejects overload instead of truncating a rule', () => {
  const f = fixture(); f.powers[0].rules = '规'.repeat(130000);
  strict.throws(() => managementPrompt(f.s, f.sources), /不会截断/);
});
test('legacy schema migrates additive fields; malformed management backup is rejected', () => {
  const f = fixture(); delete f.s.managementStart; delete f.s.managementReviewed; for (const p of f.powers) delete p.managementRecords;
  validateState(f.s); strict.equal(f.s.managementStart, f.s.syncCursor);
  const bad = clone(f.s); bad.powers[f.powers[0].id].managementRecords = JSON.parse('{"__proto__":{}}'); strict.throws(() => validateState(bad));
});
test('controller review is read-only, confirmation is persisted, repeated confirmation is blocked', async () => {
  const f = appFixture(), before = stable(f.app.store.read());
  await f.app.reviewManagement(); strict.equal(stable(f.app.store.read()), before); strict.equal(f.requests(), 1);
  await f.app.applyManagementReview();
  strict.equal(f.app.store.read().transactions.at(-1).type, 'management'); strict.equal(f.app.store.lastSave.verified, true);
  await strict.rejects(f.app.applyManagementReview(), /预览已失效/);
  await f.app.reviewManagement(); strict.equal(f.requests(), 1);
  const reread = new ChatStore({ context: () => f.ctx, storageImpl: { getItem: () => null } }).read();
  strict.equal(Object.keys(reread.powers[f.powers[1].id].managementRecords).length, 1);
});
test('unchecked changes are not committed, and canceling never consumes source', async () => {
  const f = appFixture(); await f.app.reviewManagement(); f.app.pendingManagement = null;
  strict.equal(managementSources(f.chat, f.app.store.read()).length, 1);
  await f.app.reviewManagement(); const old = globalThis.FormData;
  globalThis.FormData = class { getAll() { return ['1']; } };
  try { await f.app.applyManagementReview({ form: {} }); } finally { globalThis.FormData = old; }
  strict.equal(Object.keys(f.app.store.read().powers[f.powers[0].id].managementRecords).length, 0);
  strict.equal(Object.keys(f.app.store.read().powers[f.powers[1].id].managementRecords).length, 1);
});
test('history change or chat switch invalidates a management preview', async () => {
  for (const kind of ['history', 'chat']) {
    const f = appFixture(); await f.app.reviewManagement();
    if (kind === 'chat') { f.ctx.chatId = 'other'; f.ctx.chatMetadata = {}; } else f.ctx.chat[1].mes += '另一个结果。';
    f.app.refresh(); strict.equal(f.app.pendingManagement, null); await strict.rejects(f.app.applyManagementReview());
  }
});
test('manual records work with async disabled and do not touch MVU; restore skips old source', async () => {
  const f = appFixture(); f.app.settings.mode = 'off';
  f.app.openManagementRecord(); await f.app.saveManagementRecord({ values: { category: 'arrangement', label: '书房安排', value: '旧卷保存在木柜', status: 'active', note: '玩家核对当前正文' } });
  const backup = f.app.store.read(); strict.equal(Object.values(backup.powers[f.powers[0].id].managementRecords)[0].source.type, 'manual');
  await f.app.store.restore(backup, chatHashes(f.chat)); strict.equal(managementSources(f.chat, f.app.store.read()).length, 0);
  strict.equal(f.app.store.read().roleLink, null);
});
test('management UI renders hostile names, values and evidence as inert text', () => {
  const f = fixture(), p = f.powers[1], changes = normalizeManagement({ changes: [f.raw[1]] }, f.s, f.sources);
  changes[0].label = '<img src=x onerror=alert(1)>'; changes[0].value = '<script>bad()</script>';
  applyManagement(f.s, changes, f.sources, f.chat);
  const ui = Object.create(WorkbenchUI.prototype), html = ui.legacyManagement(f.s, p, false, 'off');
  strict.doesNotMatch(html, /<img|<script>/); strict.match(html, /&lt;script&gt;/); strict.match(html, /补录管理记录/); strict.doesNotMatch(html, /未配置货币/);
});
test('saved management records survive edited prose and remain in narrative injection', () => {
  const f = fixture(), changes = normalizeManagement({ changes: [f.raw[1]] }, f.s, f.sources);
  applyManagement(f.s, changes, f.sources, f.chat);
  const record = Object.values(f.powers[1].managementRecords)[0];
  f.chat[1].mes += '你又读了几页。'; strict.equal(managementRecordCurrent(record, f.chat), true);
  strict.match(buildInjection(f.s, { chat: f.chat }), /封存安排/);
  f.chat[1].mes = '旧卷从未封存，这段旧正文被改写。'; strict.equal(managementRecordCurrent(record, f.chat), true);
  strict.match(buildInjection(f.s, { chat: f.chat }), /"label":"封存安排"/);
});
test('manual calibration refuses money and stale forms', async () => {
  const f = appFixture(); f.app.openManagementRecord();
  await strict.rejects(f.app.saveManagementRecord({ values: { category: 'record', label: '源质点余额', value: '999', status: 'active' } }), /原有账本/);
  await f.app.store.transact(next => { next.powers[f.powers[1].id].active = false; });
  await strict.rejects(f.app.saveManagementRecord({ values: { category: 'record', label: '研究记录', value: '既有研究', status: 'active' } }), /档案已经变化/);
});
test('provided V4.1 samples accept management evidence with actual selected rule text', async t => {
  if (!process.env.WJWK_TEST_BOOK) return t.skip('Set WJWK_TEST_BOOK to verify the original input');
  const entries = importBook(JSON.parse(await readFile(process.env.WJWK_TEST_BOOK, 'utf8')), '实际V4.1');
  const f = fixture();
  for (const [i, p] of f.powers.entries()) {
    const actual = entries.find(e => e.name === p.name); strict.ok(actual);
    p.rules = actual.content; p.ruleVersion = hash(p.rules); f.raw[i].ruleQuote = actual.content.slice(0, 30);
  }
  const changes = normalizeManagement({ changes: f.raw }, f.s, f.sources); strict.equal(changes.length, 3);
  applyManagement(f.s, changes, f.sources, f.chat); validateState(f.s);
});
