// Original fixtures only. No community character cards are included.
import { clone, createPower, emptyState, importBook, chatHashes, hash, stable, MODULE_ID } from '../src/core.js';
import { RoleBridge, bindingKey } from '../src/mvu.js';
import { ChatStore } from '../src/host.js';
import { WukuApp } from '../index.js';

export const roleBook = { entries: {
  1: { uid: 1, comment: '变量列表', content: '主角含源质点、功法、能力和境界。功法以名称为键，记录品级、掌握程度与描述。' },
  2: { uid: 2, comment: '[mvu_update]变量更新规则', content: '新增功法必须保留已有功法，登记实际品级、掌握程度与完整效果描述。余额按真实投入变化，不重复扣付。' },
  3: { uid: 3, comment: '[mvu_update]变量输出格式', content: '角色使用 UpdateVariable 内的 JSONPatch 列表更新 stat_data。' },
  4: { uid: 4, comment: '已停用变量更新规则', disable: true, content: '停用的测试规则不应默认选择。' },
} };
export function patchFixture(data, patches) {
  const result = clone(data);
  for (const p of patches) {
    const parts = p.path.slice(1).split('/').map(s => s.replace(/~1/g, '/').replace(/~0/g, '~'));
    const leaf = parts.pop(); let parent = result.stat_data;
    for (const part of parts) parent = parent[part];
    if (p.op === 'add' && Array.isArray(parent)) parent.splice(leaf === '-' ? parent.length : Number(leaf), 0, clone(p.value));
    else parent[leaf] = clone(p.value);
  } return result;
}
export function fixture() {
  const memory = new Map(); const storage = { getItem: k => memory.get(k), setItem: (k, v) => memory.set(k, String(v)) };
  let saved = [], replacementCount = 0, parseCount = 0, redrawCount = 0;
  const ctx = { userHandle: 'mvu-test', characterId: 0, characters: [{ avatar: 'own-fixture.png', name: '自编测试卡', data: { extensions: { world: '自编角色规则' } } }], chatId: 'mvu-fixture', chatMetadata: {}, extensionSettings: {}, mainApi: 'openai', name1: '主角', name2: '自编测试卡', getRequestHeaders: () => ({}),
    chat: [{ mes: '自编开场：你已掌握拂风绵掌，尚有六点源质。', name: '自编测试卡', is_user: false, swipe_id: 0, variables: [{ stat_data: { 主角: { 源质点: 6, 功法: { 拂风绵掌: { 品级: 3, 掌握程度: '登堂', 描述: '已掌握的三品外功。' } }, 能力: {}, 境界: '凡人' }, 配角: { 好感: 0 } }, schema: { type: 'object', properties: { 主角: { type: 'object', properties: { 源质点: { type: 'number' }, 功法: { type: 'object', extensible: true }, 能力: { type: 'object', extensible: true } } } } }, initialized_lorebooks: { 自编角色规则: [] } }] }],
    loadWorldInfo: async () => clone(roleBook), getWorldInfoNames: () => ['自编角色规则'], async saveChat() { if (f.saveFailure) throw new Error('fixture save failed'); saved = [{ chat_metadata: clone(ctx.chatMetadata) }, ...clone(ctx.chat)]; },
  };
  const f = { ctx, storage, saveFailure: false, corruptReadback: false, corruptReceiptReadback: false, parseHook: null, writeHook: null, get replacementCount() { return replacementCount; }, get parseCount() { return parseCount; }, get redrawCount() { return redrawCount; } };
  const engine = { events: { VARIABLE_UPDATE_ENDED: 'mvu_test_end' }, isDuringExtraAnalysis: () => false,
    getMvuData(options) { return clone(options.type === 'chat' ? ctx.chatMetadata.variables || {} : ctx.chat[options.message_id]?.variables?.[ctx.chat[options.message_id]?.swipe_id || 0] || {}); },
    async parseMessage(message, data) { parseCount++; const json = message.match(/<JSONPatch>([\s\S]*?)<\/JSONPatch>/)?.[1]; let next = patchFixture(data, JSON.parse(json)); if (f.parseHook) next = await f.parseHook(next, message) || next; return next; },
    async replaceMvuData(data, options) { replacementCount++; if (f.writeHook) await f.writeHook(data, options); if (options.type === 'chat') ctx.chatMetadata.variables = clone(data); else ctx.chat[options.message_id].variables[ctx.chat[options.message_id].swipe_id || 0] = clone(data); },
  };
  const helper = { getCharWorldbookNames: () => ({ primary: '自编角色规则', additional: [] }), getWorldbook: async () => Object.values(roleBook.entries).map(e => ({ uid: e.uid, name: e.comment, content: e.content, enabled: !e.disable })), async setChatMessages(messages, options = {}) { for (const m of messages) if (m.message !== undefined) { ctx.chat[m.message_id].mes = m.message; if (ctx.chat[m.message_id].swipes) ctx.chat[m.message_id].swipes[ctx.chat[m.message_id].swipe_id || 0] = m.message; } if (options.refresh !== 'none') redrawCount++; } };
  const bridge = new RoleBridge({ context: () => ctx, engine: () => engine, helper: () => helper, bookLoader: async () => clone(roleBook) });
  const state = emptyState(), entry = importBook({ entries: { 1: { comment: '深蓝', content: '根据已有能力为锚点消耗源质点，推演目标与当前状态之间的实际缺口，取得永久的完整能力成果。' } } }, '自编金手指')[0], power = createPower(entry);
  Object.values(power.resources)[0].balance = '6'; state.powers[power.id] = power; state.historyAnchor = chatHashes(ctx.chat); state.syncCursor = 1; ctx.chatMetadata.extensions = { [MODULE_ID]: state };
  const store = new ChatStore({ context: () => ctx, storageImpl: storage, lockManager: null, fetchImpl: async () => { const data = clone(saved); if (f.corruptReadback && data[1]) delete data[1].variables; if (f.corruptReceiptReadback && data[1]) data[1].mes = '自编开场：你已掌握拂风绵掌，尚有六点源质。'; return { ok: true, json: async () => data }; } });
  globalThis.SillyTavern = { getContext: () => ctx }; const app = new WukuApp(); app.store = store; app.role = bridge; app.bridge = { chat: true, plain: true, available: true };
  app.ui = { goal: '推演穿云游燕掌法，保留原有拂风绵掌', render(view) { this.view = view; }, setNotice(message, error) { this.notice = { message, error }; }, closeDialog() {}, showManage() {}, showSync() {} }; app.refresh();
  const rules = importBook(roleBook, '自编角色规则').filter(e => e.enabledInBook).map(e => ({ id: e.id, name: e.name, book: e.book, content: e.content }));
  const link = { enabled: true, character: ctx.characters[0].avatar, scope: 'message', roots: ['/主角'], rules, ruleVersion: hash(stable(rules)), bindings: { [bindingKey(power.id, Object.keys(power.resources)[0])]: '/主角/源质点' } };
  Object.assign(f, { engine, helper, bridge, state, power, store, app, link, getRaw: () => engine.getMvuData({ type: 'message', message_id: 0 }) });
  return f;
}
export function roleOperation(f) {
  return { label: '穿云游燕掌法', description: '获得八品精妙掌法，保留旧功法。', ready: true, ruleQuote: f.power.rules.slice(0, 16), costs: [{ kind: 'resource', id: Object.keys(f.power.resources)[0], amount: '6' }], requirements: [], effects: [{ type: 'asset_grant', name: '穿云游燕掌法（八品精妙）', kind: '永久能力', description: '八品精妙掌法；轻灵腾挪、掌力贯透，完整承接当前身体与已有掌法锚点。', quantity: '1', permanent: true }], variableUpdates: [{ op: 'add', path: '/主角/功法/穿云游燕掌法', value: { 品级: 8, 掌握程度: '精妙', 描述: '八品精妙掌法；轻灵腾挪、掌力贯透，完整承接当前身体与已有掌法锚点。' } }], roleRuleQuote: '新增功法必须保留已有功法', roleChecks: [{ ruleId: f.link.rules[1].id, quote: '新增功法必须保留已有功法', paths: ['/主角/功法/穿云游燕掌法'], reason: '按完整所得新增八品精妙掌法，已有拂风绵掌和其品级保持原样。' }] };
}
export async function linkFixture(f) { await f.store.transact(next => { next.roleLink = clone(f.link); }); f.app.refresh(); f.app.settings.mode = 'st'; f.app.model.request = async () => JSON.stringify({ operations: [roleOperation(f)] }); }
