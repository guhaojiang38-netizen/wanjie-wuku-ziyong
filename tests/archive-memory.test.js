import test from 'node:test';
import strict from 'node:assert/strict';
import { fixture } from './mvu-fixture.js';
import { saveArchive, archiveSource } from '../src/archives.js';
import { memoryDefaults, archiveIdentity, memoryPlan, memoryConfigFromForm } from '../src/archive-memory.js';
import { clone, validateState, ASYNC_MARKER } from '../src/core.js';
import { installInjection } from '../src/host.js';

function setup() {
  const f = fixture(), r = saveArchive(f.power, { type: 'population', name: '耐寒工蜂', status: 'planned', fields: { scale: '一小群', traits: '耐寒', location: '北坡' } }, archiveSource(f.ctx.chat, '玩家确认'));
  const id = archiveIdentity(f.power, r), config = { ...memoryDefaults(), selections: { [id]: { mode: 'next', token: 'memory_test' } } };
  f.state.archiveMemory = config;
  return { ...f, r, id, config };
}
test('memory is opt-in; plans are clearly labeled; automatic overview does not require keywords; details use names or locations', () => {
  const f = setup(); strict.equal(memoryPlan(f.state, f.ctx.chat, '', memoryDefaults()).packet, '');
  const plan = memoryPlan(f.state, f.ctx.chat); strict.match(plan.packet, /计划中/); strict.match(plan.packet, /耐寒工蜂/); strict.equal(plan.included.length, 1);
  const config = { ...memoryDefaults(), auto: true }; strict.match(memoryPlan(f.state, f.ctx.chat, '无关的掌法', config).packet, /当前概况/);
  strict.equal(memoryPlan(f.state, f.ctx.chat, '查看北坡的情况', config).included.length, 2);
  f.r.status = 'ended'; strict.equal(memoryPlan(f.state, f.ctx.chat, '耐寒工蜂', config).packet, '');
});
test('memory selections preserve other powers and existing consumption tokens; invalid backup fails', () => {
  const f = setup(), config = memoryConfigFromForm(f.state, f.power.id, { budget: '3000', [`memory:${f.r.id}`]: 'next' });
  strict.equal(config.selections[f.id].token, 'memory_test');
  strict.equal(memoryConfigFromForm(f.state, f.power.id, { budget: '3000' }).selections[f.id], undefined);
  strict.throws(() => memoryConfigFromForm(f.state, f.power.id, { budget: '10' }));
  validateState(f.state); const bad = clone(f.state); bad.archiveMemory.selections['missing/object'] = { mode: 'next', token: 'x' }; strict.throws(() => validateState(bad), /不存在/);
});
test('single use survives stopped or empty output and consumes only after injection plus new rendered reply', async () => {
  const f = setup(); await f.store.transact(next => { next.powers[f.power.id] = clone(f.power); next.archiveMemory = clone(f.config); });
  f.app.beginArchiveMemory('normal'); f.app.mainBusy = true;
  strict.match(f.app.memoryInjection(f.store.read()), /耐寒工蜂/);
  f.app.memoryAttempt.ended = true; f.app.memoryAttempt.rendered = 0; await f.app.completeArchiveMemory(); strict.ok(f.store.read().archiveMemory.selections[f.id]);
  f.app.memoryAttempt = null; strict.ok(f.store.read().archiveMemory.selections[f.id]);
  f.app.beginArchiveMemory('normal'); f.app.memoryInjection(f.store.read());
  f.ctx.chat.push({ is_user: false, mes: '' }); f.app.memoryAttempt.ended = true; f.app.memoryAttempt.rendered = 1;
  await f.app.completeArchiveMemory(); strict.ok(f.store.read().archiveMemory.selections[f.id]);
  f.ctx.chat[1].mes = '自编新正文：你继续观察耐寒工蜂。'; await f.app.completeArchiveMemory();
  strict.equal(f.store.read().archiveMemory.selections[f.id], undefined); strict.match(f.store.read().archiveMemory.last.packet, /耐寒工蜂/); strict.equal(f.replacementCount, 0);
});
test('new selections are not consumed by an older request; chat switch and quiet generation do not leak', async () => {
  const f = setup(); await f.store.transact(next => { next.powers[f.power.id] = clone(f.power); next.archiveMemory = clone(f.config); });
  f.app.beginArchiveMemory('normal'); f.app.mainBusy = true; f.app.memoryInjection(f.store.read());
  await f.store.transact(next => { next.archiveMemory.selections[f.id].token = 'new_token'; }, { facts: false });
  f.ctx.chat.push({ mes: '自编模型新正文', is_user: false }); f.app.memoryAttempt.ended = true; f.app.memoryAttempt.rendered = 1; await f.app.completeArchiveMemory();
  strict.equal(f.store.read().archiveMemory.selections[f.id].token, 'new_token');
  f.app.beginArchiveMemory('quiet'); strict.equal(f.app.memoryInjection(f.store.read()), '');
  f.app.beginArchiveMemory('normal'); f.ctx.chatId = 'another-chat'; f.ctx.chatMetadata = {}; strict.equal(f.app.memoryInjection(f.store.read()), '');
});
test('chat and text request hooks match preview, deduplicate and exclude async/dry-run requests', async () => {
  const f = setup(), handlers = new Map();
  f.ctx.eventSource = { on: (e, fn) => handlers.set(e, fn), removeListener: e => handlers.delete(e) };
  f.ctx.eventTypes = { CHAT_COMPLETION_PROMPT_READY: 'chat-ready', GENERATE_AFTER_COMBINE_PROMPTS: 'text-ready' };
  await f.store.transact(next => { next.powers[f.power.id] = clone(f.power); next.archiveMemory = clone(f.config); });
  const bridge = installInjection({ context: () => f.ctx, store: f.store, extraInjection: s => f.app.memoryInjection(s) });
  f.app.beginArchiveMemory('normal'); f.app.mainBusy = true;
  const request = { chat: [{ role: 'user', content: '继续' }] }; handlers.get('chat-ready')(request); handlers.get('chat-ready')(request);
  strict.equal(request.chat.length, 2); strict.ok(request.chat[1].content.endsWith(memoryPlan(f.store.read(), f.ctx.chat).packet));
  const plain = { prompt: '继续故事' }; handlers.get('text-ready')(plain); handlers.get('text-ready')(plain);
  strict.equal((plain.prompt.match(/\[WJWK_ARCHIVE_MEMORY_V1\]/g) || []).length, 1);
  f.app.beginArchiveMemory('normal'); const dry = { chat: [], dryRun: true }; handlers.get('chat-ready')(dry); strict.equal(f.app.memoryAttempt.plan, null);
  const asyncRequest = { chat: [{ role: 'system', content: ASYNC_MARKER }] }; handlers.get('chat-ready')(asyncRequest); strict.equal(f.app.memoryAttempt.plan, null);
  strict.ok(f.store.read().archiveMemory.selections[f.id]); bridge.cleanup();
});
test('restoring a backup preserves archives but clears injection selections and review cursors', async () => {
  const f = setup(); f.power.archiveReviewed = [{ index: 0, swipeId: 0, length: 3, textHash: '1'.repeat(16) }];
  await f.store.restore(f.state, f.state.historyAnchor); const restored = f.store.read();
  strict.equal(restored.archiveMemory, undefined); strict.deepEqual(restored.powers[f.power.id].archiveReviewed, []); strict.equal(restored.powers[f.power.id].archiveStart, f.ctx.chat.length);
  strict.equal(restored.powers[f.power.id].archives[f.r.id].name, '耐寒工蜂');
});
test('a long recent scene does not displace the current draft and opening a pinned record preserves its mode', async () => {
  const f = setup(); f.config.selections[f.id].mode = 'pinned';
  await f.store.transact(next => { next.powers[f.power.id] = clone(f.power); next.archiveMemory = clone(f.config); });
  const previousDocument = globalThis.document;
  try {
    globalThis.document = { querySelector: () => ({ value: '查看北坡育种区' }) };
    for (let i = 0; i < 4; i++) f.ctx.chat.push({ mes: '长篇场景'.repeat(500), is_user: false });
    strict.ok(f.app.memoryQuery().endsWith('查看北坡育种区')); strict.ok(f.app.memoryQuery().length <= 6000);
    let viewed; f.app.ui.showMemory = (_p, config) => { viewed = config; };
    f.app.openMemory(f.r.id); strict.equal(viewed.selections[f.id].mode, 'pinned');
  } finally { globalThis.document = previousDocument; }
});
test('failed local save leaves single-use selection available and never writes MVU', async () => {
  const f = setup(); await f.store.transact(next => { next.powers[f.power.id] = clone(f.power); next.archiveMemory = clone(f.config); });
  f.app.beginArchiveMemory('normal'); f.app.mainBusy = true; f.app.memoryInjection(f.store.read());
  f.ctx.chat.push({ mes: '自编新正文内容', is_user: false }); f.app.memoryAttempt.ended = true; f.app.memoryAttempt.rendered = 1;
  const previous = f.storage.setItem; f.storage.setItem = () => { throw new Error('quota'); };
  await strict.rejects(f.app.completeArchiveMemory(), /未提交/); f.storage.setItem = previous;
  strict.ok(f.store.read().archiveMemory.selections[f.id]); strict.equal(f.replacementCount, 0);
});
