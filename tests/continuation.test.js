import test from 'node:test';
import strict from 'node:assert/strict';
import { chatHashes, historyChanged, narrativeMessages, storyText, hash, stable, clone, validateState } from '../src/core.js';
import { fixture, linkFixture, roleOperation } from './mvu-fixture.js';

function hooks(f) {
  const handlers = new Map();
  f.ctx.eventTypes = Object.fromEntries(['CHAT_CHANGED', 'GENERATION_STARTED', 'GENERATION_STOPPED', 'GENERATION_ENDED', 'MESSAGE_EDITED', 'MESSAGE_DELETED', 'MESSAGE_SWIPED', 'MESSAGE_RECEIVED', 'CHARACTER_MESSAGE_RENDERED'].map(name => [name, name]));
  f.ctx.eventSource = { on(name, fn) { if (!handlers.has(name)) handlers.set(name, []); handlers.get(name).push(fn); }, removeListener(name, fn) { handlers.set(name, (handlers.get(name) || []).filter(x => x !== fn)); } };
  f.app.attachChatHooks();
  f.emit = (name, ...args) => { for (const fn of handlers.get(name) || []) fn(...args); };
  f.stop = () => { clearTimeout(f.app.roleTimer); clearTimeout(f.app.syncTimer); };
  return f;
}
const wallet = f => Object.values(f.store.read().powers[f.power.id].resources)[0].balance;
async function done() { const f = hooks(fixture()); await linkFixture(f); await f.app.generate(); await f.app.execute(); return f; }
function legacy(message, swipe = message.swipe_id ?? null) {
  return hash(stable({ user: Boolean(message.is_user), system: Boolean(message.is_system), name: message.name || '', mes: message.mes, swipe }));
}
async function continueFloor(f, text, balance = null) {
  f.emit('GENERATION_STARTED', 'continue', {}, false);
  const floor = f.ctx.chat.at(-1); floor.mes += text;
  if (balance !== null) floor.variables[floor.swipe_id ?? 0].stat_data.主角.源质点 = balance;
  f.emit('GENERATION_ENDED'); // Host can end generation before final render/MVU.
  f.emit('MESSAGE_RECEIVED', f.ctx.chat.length - 1, 'continue');
  f.emit('CHARACTER_MESSAGE_RENDERED', f.ctx.chat.length - 1, 'continue');
  await f.app.pullRoleBalances(); f.stop();
}

test('default swipe initialization and legacy anchors do not change an existing branch', () => {
  const message = { name: '角色', is_user: false, mes: '原正文' }, before = chatHashes([message]);
  message.swipe_id = 0; strict.deepEqual(chatHashes([message]), before);
  for (const swipe of [null, 0]) strict.equal(historyChanged({ historyAnchor: [legacy(message, swipe)] }, chatHashes([message])), false);
  message.swipe_id = 1; strict.equal(historyChanged({ historyAnchor: before }, chatHashes([message])), true);
});
test('MVU placeholders and display refresh preserve history while cleanup may only remove update blocks', () => {
  const message = { name: '角色', mes: '正文事实\n\n<UpdateVariable><JSONPatch>[1]</JSONPatch></UpdateVariable>' }, anchor = chatHashes([message]);
  message.mes += '\n\n<StatusPlaceHolderImpl/>\n<status_current_variable>旧显示</status_current_variable>';
  strict.equal(historyChanged({ historyAnchor: anchor }, chatHashes([message])), false);
  message.mes = message.mes.replace('旧显示', '新显示').replace(/\n\n<UpdateVariable>[\s\S]*?<\/UpdateVariable>/, '');
  strict.equal(historyChanged({ historyAnchor: anchor }, chatHashes([message])), false);
  message.mes = message.mes.replace('正文事实', '旧剧情被修改'); strict.equal(historyChanged({ historyAnchor: anchor }, chatHashes([message])), true);
});
test('changing, adding, or reordering native instructions on an anchored floor is not cleanup', () => {
  const first = '<UpdateVariable><JSONPatch>[1]</JSONPatch></UpdateVariable>', second = '<UpdateVariable><JSONPatch>[2]</JSONPatch></UpdateVariable>';
  const original = { mes: `正文\n\n${first}\n\n${second}` }, anchor = chatHashes([original]);
  for (const mes of [`正文\n\n${first.replace('[1]', '[3]')}\n\n${second}`, `${original.mes}\n\n${first}`, `正文\n\n${second}\n\n${first}`]) strict.equal(historyChanged({ historyAnchor: anchor }, chatHashes([{ mes }])), true);
  strict.equal(historyChanged({ historyAnchor: anchor }, chatHashes([{ mes: `正文\n\n${second}` }])), false);
});
test('old version placeholder false alarms are repaired only when the old text hash can be verified', async () => {
  for (const remove of [false, true]) {
    const f = fixture(); const original = f.ctx.chat[0].mes;
    await f.store.transact(next => { next.historyAnchor = [legacy({ ...f.ctx.chat[0], mes: remove ? `${original}\n\n<StatusPlaceHolderImpl/>` : original })]; });
    if (!remove) f.ctx.chat[0].mes += '\n\n<StatusPlaceHolderImpl/>';
    await f.app.prepareResources(); strict.equal(historyChanged(f.store.read(), chatHashes(f.ctx.chat)), false); strict.match(f.store.read().historyAnchor[0], /^h2\./);
  }
  const f = fixture(); await f.store.transact(next => { next.historyAnchor = [legacy(f.ctx.chat[0])]; }); f.ctx.chat[0].mes = '被改写正文\n\n<StatusPlaceHolderImpl/>'; await f.app.prepareResources(); strict.equal(historyChanged(f.store.read(), chatHashes(f.ctx.chat)), true);
});
test('a complete player turn after a write reads the new MVU wallet and executes on the new floor', async () => {
  const f = await done();
  try {
    const originalWrite = f.store.read().roleWrites[0];
    f.emit('GENERATION_STARTED', 'normal', {}, false);
    f.ctx.chat[0].mes += '\n\n<StatusPlaceHolderImpl/>'; // Native MVU rendering.
    f.ctx.chat.push({ name: f.ctx.name1, is_user: true, mes: '我使用新掌法救助旅人。' });
    const raw = f.getRaw(); raw.stat_data.主角.源质点 = 2;
    f.ctx.chat.push({ name: f.ctx.name2, is_user: false, mes: '你使用穿云游燕掌法救下旅人，获得两点源质。', variables: [raw] });
    f.emit('GENERATION_ENDED'); f.emit('MESSAGE_RECEIVED', 2, 'normal');
    f.ctx.chat[2].swipe_id = 0; f.emit('CHARACTER_MESSAGE_RENDERED', 2, 'normal');
    await f.app.pullRoleBalances(); strict.equal(wallet(f), '2'); strict.equal(f.app.ui.view.historyMismatch, false); strict.equal(f.app.roleError, '');
    const op = roleOperation(f); op.costs[0].amount = '1'; op.label = '回风掌'; op.effects[0].name = '回风掌（八品精妙）'; op.variableUpdates[0].path = '/主角/功法/回风掌'; op.roleChecks[0].paths = ['/主角/功法/回风掌'];
    f.app.model.request = async () => JSON.stringify({ operations: [op] }); await f.app.generate(); await f.app.execute();
    strict.equal(wallet(f), '1'); strict.equal(f.ctx.chat[2].variables[0].stat_data.主角.源质点, 1);
    strict.ok(f.ctx.chat[2].variables[0].stat_data.主角.功法.穿云游燕掌法); strict.ok(f.ctx.chat[2].variables[0].stat_data.主角.功法.回风掌);
    strict.equal(f.replacementCount, 2); strict.equal(f.store.read().roleWrites[0].id, originalWrite.id); strict.equal(f.store.read().roleWrites[1].capture.option.message_id, 2);
  } finally { f.stop(); }
});
test('automatic event read waits for the new assistant MVU data instead of using the previous floor', async () => {
  const f = hooks(fixture()); await linkFixture(f);
  try {
    f.emit('GENERATION_STARTED', 'normal', {}, false); f.ctx.chat.push({ name: f.ctx.name2, is_user: false, mes: '新剧情产生五点源质。' }); f.emit('GENERATION_ENDED');
    await strict.rejects(() => f.app.pullRoleBalances(), /角色变量仍在更新/); strict.equal(wallet(f), '6');
    const raw = f.getRaw(); raw.stat_data.主角.源质点 = 11; f.ctx.chat[1].variables = [raw]; f.emit('mvu_test_end');
    await new Promise(resolve => setTimeout(resolve, 280));
    strict.equal(wallet(f), '11'); strict.equal(f.app.roleError, ''); strict.equal(f.app.ui.view.historyMismatch, false);
  } finally { f.stop(); }
});
test('continue appends to the same floor, acknowledges only that floor and retains a new-story tail', async () => {
  const f = await done();
  try {
    const before = storyText(f.ctx.chat[0].mes), writes = f.replacementCount, rows = f.store.read().transactions.length;
    await continueFloor(f, '\n你用新掌法救下旅人，获得两点源质。\n<UpdateVariable><JSONPatch>[]</JSONPatch></UpdateVariable>\n\n<StatusPlaceHolderImpl/>', 2);
    strict.equal(wallet(f), '2'); strict.equal(f.app.ui.view.historyMismatch, false); strict.equal(f.replacementCount, writes);
    strict.deepEqual(f.store.read().syncTail, { index: 0, offset: before.length }); strict.equal(f.store.read().syncCursor, 1);
    const narrative = narrativeMessages(f.ctx.chat, 1, f.store.read().syncTail); strict.equal(narrative.length, 1); strict.equal(narrative[0].content, '你用新掌法救下旅人，获得两点源质。');
    strict.equal(f.store.read().transactions.length, rows + 1); strict.equal(f.store.read().transactions.at(-1).type, 'role-read');
  } finally { f.stop(); }
});
test('several continues preserve the first unsynced offset and reconciliation consumes it once', async () => {
  const f = hooks(fixture()); await linkFixture(f);
  try {
    await continueFloor(f, '\n新的旅人向你道谢。'); const first = clone(f.store.read().syncTail);
    await continueFloor(f, '\n你与旅人抵达城门。'); strict.deepEqual(f.store.read().syncTail, first);
    let calls = 0; f.app.model.request = async prompt => { calls++; const input = JSON.parse(prompt.user); const text = JSON.stringify(input); strict.doesNotMatch(text, /自编开场/); strict.match(text, /新的旅人向你道谢/); strict.match(text, /抵达城门/); return JSON.stringify({ events: [] }); };
    await f.app.sync(); await f.app.applySync(); strict.equal(f.store.read().syncTail, undefined);
    await f.app.sync(); strict.equal(calls, 1); strict.equal(f.replacementCount, 0);
  } finally { f.stop(); }
});
test('continue tracking works without a linked MVU and survives ledger serialization', async () => {
  const f = hooks(fixture());
  try { await continueFloor(f, '\n另一段可核算的新剧情。'); strict.equal(f.app.ui.view.historyMismatch, false); strict.ok(validateState(JSON.parse(JSON.stringify(f.store.read()))).syncTail); }
  finally { f.stop(); }
});
test('render cleanup must not let a stale tab refill the already spent MVU wallet', async () => {
  const f = hooks(fixture()); await linkFixture(f); const old = f.getRaw();
  try { await f.app.generate(); await f.app.execute(); f.ctx.chat[0].variables[0] = old; f.ctx.chat[0].mes += '\n\n<StatusPlaceHolderImpl/>'; await strict.rejects(() => f.app.pullRoleBalances(), /重新载入/); strict.equal(wallet(f), '0'); }
  finally { f.stop(); }
});
test('the exact in-flight context still invalidates a model result when MVU text changes', async () => {
  const f = fixture(); await linkFixture(f);
  f.app.model.request = async () => { f.ctx.chat[0].mes += '\n\n<StatusPlaceHolderImpl/>'; return JSON.stringify({ operations: [roleOperation(f)] }); };
  await strict.rejects(() => f.app.generate(), /查询期间剧情发生变化/); strict.equal(f.replacementCount, 0); strict.equal(wallet(f), '6');
});
test('generation end alone does not acknowledge a continuation before final rendering and MVU writes', async () => {
  const f = hooks(fixture()); await linkFixture(f);
  try {
    f.emit('GENERATION_STARTED', 'continue', {}, false); f.ctx.chat[0].mes += '\n新剧情'; f.emit('GENERATION_ENDED');
    await strict.rejects(() => f.app.pullRoleBalances(), /续写仍在完成/); strict.equal(wallet(f), '6');
    f.ctx.chat[0].mes += '\n<UpdateVariable><JSONPatch>[]</JSONPatch></UpdateVariable>'; f.ctx.chat[0].variables[0].stat_data.主角.源质点 = 8;
    f.emit('CHARACTER_MESSAGE_RENDERED', 0, 'continue'); await f.app.pullRoleBalances(); strict.equal(wallet(f), '8'); strict.equal(f.app.ui.view.historyMismatch, false);
  } finally { f.stop(); }
});
test('continuation waits for asynchronous MVU and accepts partial output on an explicit stop', async () => {
  const f = hooks(fixture()); await linkFixture(f);
  try {
    f.emit('GENERATION_STARTED', 'continue', {}, false); f.ctx.chat[0].mes += '\n停止时已生成的新剧情'; f.emit('GENERATION_STOPPED');
    f.engine.isDuringExtraAnalysis = () => true; await strict.rejects(() => f.app.pullRoleBalances(), /MVU 正在/); strict.ok(f.app.continuation);
    f.engine.isDuringExtraAnalysis = () => false; await f.app.pullRoleBalances(); strict.equal(f.app.ui.view.historyMismatch, false); strict.ok(f.store.read().syncTail); strict.equal(wallet(f), '6');
  } finally { f.stop(); }
});
test('continuing discards a previously generated proposal instead of executing it against the new story', async () => {
  const f = hooks(fixture()); await linkFixture(f);
  try { await f.app.generate(); const oldId = f.app.selected.id; await continueFloor(f, '\n故事继续推进。'); strict.equal(f.app.selected, null); strict.ok(!f.app.plans.some(op => op.id === oldId)); await strict.rejects(() => f.app.execute(), /选择一个操作/); strict.equal(wallet(f), '6'); }
  finally { f.stop(); }
});
