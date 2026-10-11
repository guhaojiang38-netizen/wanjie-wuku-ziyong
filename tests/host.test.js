import test from 'node:test';
import strict from 'node:assert/strict';
import { ChatStore, installInjection, scope } from '../src/host.js';
import { MODULE_ID, ASYNC_MARKER, STATE_MARKER, hash, clone, emptyState } from '../src/core.js';

function fixture({ deny = false, badSave = false } = {}) {
  const memory = new Map(), handlers = new Map(); let saved;
  const localStorage = { getItem: k => memory.get(k), setItem: (k, v) => { if (deny) throw new Error('quota'); memory.set(k, v); } };
  const ctx = { userHandle: 'test-user', chatId: 'chat-one', characterId: 0, characters: [{ avatar: 'a.png', name: '角色' }], name1: '玩家', name2: '角色', chatMetadata: {}, chat: [{ mes: '开场' }], accountStorage: { getItem: () => null, setItem: () => { throw new Error('AccountStorage is not a checkpoint'); } }, getRequestHeaders: () => ({ 'Content-Type': 'application/json' }), saveChat: async () => { if (badSave) return; saved = clone(ctx.chatMetadata); }, eventTypes: { CHAT_COMPLETION_PROMPT_READY: 'chat-ready', GENERATE_AFTER_COMBINE_PROMPTS: 'plain-ready' }, eventSource: { on: (event, handler) => handlers.set(event, handler), removeListener: event => handlers.delete(event) } };
  const store = new ChatStore({ context: () => ctx, storageImpl: localStorage, lockManager: null, fetchImpl: async () => ({ ok: true, json: async () => [{ chat_metadata: saved || {} }] }) });
  return { ctx, store, memory, handlers };
}
test('server save is verified against read-back data rather than save return value', async () => { const { store } = fixture(); const result = await store.transact(s => { s.syncCursor = 1; }); strict.equal(result.save.verified, true); strict.equal(store.read().revision, 1); });
test('swallowed host save failure still preserves one durable local transaction and reports unverified', async () => { const { store, ctx, memory } = fixture({ badSave: true }); const result = await store.transact(s => { s.syncCursor = 1; }); strict.equal(result.save.verified, false); strict.match(result.save.note, /本机备份/); ctx.chatMetadata = {}; strict.equal(store.read().syncCursor, 1); strict.equal(memory.size, 1); });
test('自用版：local backup failure warns but still commits', async () => { const { store } = fixture({ deny: true }); const r = await store.transact(s => { s.syncCursor = 1; }); strict.equal(store.read().syncCursor, 1); strict.match(r.save.note, /IndexedDB|清理旧备份/); });
test('failed candidate mutation does not partly modify metadata or backup', async () => { const { store, memory } = fixture(); const before = store.read(); await strict.rejects(store.transact(s => { s.syncCursor = 1; throw new Error('invalid-effect'); })); strict.deepEqual(store.read(), before); strict.equal(memory.size, 0); });
test('serialized updates reread the ledger and preserve both edits', async () => { const { store } = fixture(); await Promise.all([store.transact(s => { s.syncCursor++; }), store.transact(s => { s.syncCursor++; })]); strict.equal(store.read().syncCursor, 2); strict.equal(store.read().revision, 2); });
test('switching chat while an async candidate is waiting cannot write into the new chat', async () => { const { store, ctx, memory } = fixture(); let resume; const pending = store.transact(async s => { s.syncCursor = 1; await new Promise(resolve => { resume = resolve; }); }); await new Promise(resolve => setTimeout(resolve, 0)); ctx.chatId = 'chat-two'; ctx.chatMetadata = {}; resume(); await strict.rejects(pending, /聊天已切换/); strict.equal(memory.size, 0); strict.equal(store.read().syncCursor, 0); });
test('captured old revision cannot overwrite new facts', async () => { const { store } = fixture(); const captured = store.capture(); await store.transact(s => { s.syncCursor++; }); await strict.rejects(store.transact(s => { s.syncCursor = 99; }, { captured }), /档案已经变化/); strict.equal(store.read().syncCursor, 1); });
test('per-chat backups remain isolated', async () => { const { store, ctx } = fixture(); const old = scope(ctx).key; await store.transact(s => { s.syncCursor = 9; }); ctx.chatId = 'two'; ctx.chatMetadata = {}; strict.equal(store.read().syncCursor, 0); ctx.chatId = 'chat-one'; ctx.chatMetadata = {}; strict.equal(scope(ctx).key, old); strict.equal(store.read().syncCursor, 9); });
test('two accounts with identical character and chat filenames have distinct local checkpoints', async () => { const { store, ctx } = fixture(); await store.transact(s => { s.syncCursor = 7; }); ctx.userHandle = 'other-user'; ctx.chatMetadata = {}; strict.equal(store.read().syncCursor, 0); ctx.userHandle = 'test-user'; ctx.chatMetadata = {}; strict.equal(store.read().syncCursor, 7); });
test('main prompt receives authoritative state, own raw query remains untouched', () => {
  const { ctx, store, handlers } = fixture(); const state = emptyState(); state.powers.p = { id: 'p', name: '演示', active: true, rules: '完整演示正文', ruleVersion: hash('完整演示正文'), resources: {}, assets: {}, fields: { result: { label: '已完成', value: '永久所得已成立' } }, fixedQuotes: [], quotes: [], pricing: 'stateful' };
  ctx.chatMetadata.extensions = { [MODULE_ID]: state };
  const bridge = installInjection({ context: () => ctx, store }); strict.equal(bridge.chat, true); strict.equal(bridge.plain, true);
  const raw = { chat: [{ role: 'system', content: ASYNC_MARKER }] }; handlers.get('chat-ready')(raw); strict.equal(raw.chat.length, 1);
  const main = { chat: [{ role: 'user', content: '继续' }] }; handlers.get('chat-ready')(main); handlers.get('chat-ready')(main); strict.equal(main.chat.length, 2); strict.match(main.chat[1].content, /永久所得已成立/);
  const plain = { prompt: '当前故事' }; handlers.get('plain-ready')(plain); strict.match(plain.prompt, /永久所得已成立/); const asyncPlain = { prompt: ASYNC_MARKER }; handlers.get('plain-ready')(asyncPlain); strict.equal(asyncPlain.prompt, ASYNC_MARKER);
  bridge.cleanup(); strict.equal(handlers.size, 0); strict.equal(STATE_MARKER, 'WJWK_COMMITTED_STATE_V1');
});
