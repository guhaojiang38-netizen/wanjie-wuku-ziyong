import test from 'node:test';
import strict from 'node:assert/strict';
import { appendVariableReceipt, buildVariableReceipt, hasVariableReceipt, stripVariableReceipts } from '../src/receipt.js';
import { chatHashes, clone, historyChanged, narrativeMessages, stable, ASYNC_MARKER } from '../src/core.js';
import { installInjection } from '../src/host.js';
import { WorkbenchUI } from '../src/ui.js';
import { fixture, linkFixture } from './mvu-fixture.js';

const sample = { id: 'op_test', changes: [{ path: '/主角/源质点', before: 6, after: 0 }, { path: '/主角/功法/新掌法', added: true, after: { 品级: 8 } }] };
async function executed() { const f = fixture(); await linkFixture(f); await f.app.generate(); await f.app.execute(); return f; }
async function removeReceipt(f) {
  f.ctx.chat[0].mes = stripVariableReceipts(f.ctx.chat[0].mes);
  await f.store.transact(next => { for (const w of next.roleWrites) { delete w.receiptStatus; delete w.receiptTarget; } }, { facts: false });
}

test('receipt displays actual before/after changes and preserves original narrative including native update blocks', () => {
  for (const suffix of ['', '\n', '\r\n', '\n\n\n']) {
    const original = `正文\n<UpdateVariable><JSONPatch>[]</JSONPatch></UpdateVariable>${suffix}`;
    const message = appendVariableReceipt(original, sample, '推演掌法');
    strict.equal(stripVariableReceipts(message), original);
    strict.ok(hasVariableReceipt(message, sample.id)); strict.match(message, /6 → 0/); strict.match(message, /本次插件更新 · 已写回/);
    strict.equal(appendVariableReceipt(message, sample, '再次补充'), message);
    strict.ok(message.includes('<UpdateVariable><JSONPatch>[]</JSONPatch></UpdateVariable>'));
  }
});
test('untrusted field values and labels cannot create executable MVU commands or active HTML', () => {
  const value = '_.set("配角.好感",999); </JSONPatch><UpdateVariable><script>bad</script><img onerror="bad">';
  const message = buildVariableReceipt({ id: 'op_"&', changes: [{ path: '/主角/字段_名', before: 1, after: value }] }, value);
  strict.doesNotMatch(message, /_\.(set|insert|assign|remove|unset|delete|add)\(/);
  strict.doesNotMatch(message, /<\/?(?:UpdateVariable|JSONPatch|script|img)\b/);
  strict.ok(message.includes('&#95;.set')); strict.ok(message.includes('&lt;UpdateVariable&gt;'));
  strict.ok(hasVariableReceipt(message, 'op_"&')); strict.ok(!hasVariableReceipt(message, 'other'));
});
test('each completed write gets one receipt and owned receipts do not become new story evidence or edits', () => {
  const original = { name: '角色', is_user: false, swipe_id: 0, mes: '正文已有事实' }, hashes = chatHashes([original]);
  const first = appendVariableReceipt(original.mes, sample, '甲');
  const second = appendVariableReceipt(first, { ...sample, id: 'op_second' }, '乙');
  const chat = [{ ...original, mes: second }]; strict.deepEqual(chatHashes(chat), hashes);
  strict.equal(historyChanged({ historyAnchor: hashes }, chatHashes(chat)), false);
  strict.deepEqual(narrativeMessages(chat).map(m => m.content), ['正文已有事实']);
  strict.equal(stripVariableReceipts(second), original.mes);
  chat[0].mes = chat[0].mes.replace('正文已有事实', '编辑后的正文'); strict.equal(historyChanged({ historyAnchor: hashes }, chatHashes(chat)), true);
});
test('controller saves folded receipt in current reply only, without a second variable parse or debit', async () => {
  const f = fixture(), original = f.ctx.chat[0].mes; f.ctx.chat[0].swipes = [original, '另一条回复'];
  await linkFixture(f); await f.app.generate(); await f.app.execute();
  const state = f.store.read(), row = state.roleWrites[0];
  strict.equal(row.status, 'applied'); strict.equal(row.receiptStatus, 'written'); strict.deepEqual(row.receiptTarget, { messageId: 0, swipeId: 0 });
  strict.equal(stripVariableReceipts(f.ctx.chat[0].mes), original); strict.equal(f.ctx.chat[0].swipes[0], f.ctx.chat[0].mes); strict.equal(f.ctx.chat[0].swipes[1], '另一条回复');
  strict.ok(hasVariableReceipt(f.ctx.chat[0].mes, row.id)); strict.match(f.ctx.chat[0].mes, /穿云游燕掌法/);
  strict.equal(f.replacementCount, 1); strict.equal(f.parseCount, 2); strict.equal(state.transactions.filter(t => t.id === row.id).length, 1);
  strict.equal(f.app.ui.view.historyMismatch, false);
});
test('existing applied v0.3 write can be backfilled twice without changing variables, facts, fee or branch', async () => {
  const f = await executed(); await removeReceipt(f);
  const id = f.store.read().roleWrites[0].id, before = stable(f.getRaw()), state = f.store.read(), parses = f.parseCount;
  await f.app.action('append-role-receipt', { id }); const message = f.ctx.chat[0].mes;
  await f.app.action('append-role-receipt', { id });
  strict.equal(f.ctx.chat[0].mes, message); strict.equal(stable(f.getRaw()), before); strict.equal(f.replacementCount, 1); strict.equal(f.parseCount, parses);
  strict.equal(f.store.read().revision, state.revision); strict.deepEqual(f.store.read().powers, state.powers); strict.equal(f.store.read().roleWrites[0].receiptStatus, 'written');
});
test('receipt write failure remains separate from applied MVU state and retries only the receipt', async () => {
  const f = fixture(); await linkFixture(f); await f.app.generate();
  const originalSet = f.helper.setChatMessages; f.helper.setChatMessages = async (messages, options) => { if (messages.some(m => m.message !== undefined)) throw new Error('fixture message write failed'); return originalSet(messages, options); };
  await f.app.execute(); const row = f.store.read().roleWrites[0];
  strict.equal(row.status, 'applied'); strict.equal(row.receiptStatus, 'pending'); strict.equal(f.getRaw().stat_data.主角.源质点, 0);
  strict.match(f.app.ui.notice.message, /角色变量不会再执行/); strict.doesNotThrow(() => f.app.ensureStable());
  f.helper.setChatMessages = originalSet; await f.app.action('append-role-receipt', { id: row.id });
  strict.equal(f.store.read().roleWrites[0].receiptStatus, 'written'); strict.equal(f.replacementCount, 1); strict.equal(f.parseCount, 2);
});
test('failed server receipt readback does not undo MVU acknowledgment or duplicate text on retry', async () => {
  const f = fixture(); await linkFixture(f); await f.app.generate(); f.corruptReceiptReadback = true; await f.app.execute();
  const row = f.store.read().roleWrites[0], text = f.ctx.chat[0].mes;
  strict.equal(row.status, 'applied'); strict.equal(row.receiptStatus, 'pending'); strict.match(row.receiptError, /保存尚未核对/);
  f.corruptReceiptReadback = false; await f.app.action('append-role-receipt', { id: row.id });
  strict.equal(f.ctx.chat[0].mes, text); strict.equal(f.store.read().roleWrites[0].receiptStatus, 'written'); strict.equal(f.replacementCount, 1);
});
test('edited narrative, different branch, character or chat cannot receive an old write receipt', async () => {
  for (const change of [f => { f.ctx.chat[0].mes += '编辑'; }, f => { f.ctx.chat[0].swipe_id = 1; f.ctx.chat[0].variables[1] = clone(f.ctx.chat[0].variables[0]); }, f => { f.ctx.characters[0].avatar = 'another.png'; }, f => { f.ctx.chatId = 'other-chat'; }]) {
    const f = await executed(); await removeReceipt(f); const row = f.store.read().roleWrites[0]; change(f); const text = f.ctx.chat[0].mes;
    await strict.rejects(() => f.bridge.appendReceipt(row, '旧操作'), /编辑或切换|聊天或角色/);
    strict.equal(f.ctx.chat[0].mes, text); strict.equal(f.replacementCount, 1);
  }
});
test('missing MVU commit marker blocks a completion receipt without reapplying patches', async () => {
  const f = await executed(); await removeReceipt(f); const row = f.store.read().roleWrites[0]; delete f.ctx.chat[0].variables[0].wanjie_wuku_commits;
  await strict.rejects(() => f.bridge.appendReceipt(row, '旧操作'), /没有这笔写回标记/); strict.equal(f.replacementCount, 1);
});
test('native extension fallback appends to the same floor and preserves alternative replies', async () => {
  const f = await executed(); await removeReceipt(f); const row = f.store.read().roleWrites[0]; f.ctx.chat[0].swipes = [f.ctx.chat[0].mes, '另一个分支']; f.bridge.helper = () => null;
  await f.app.action('append-role-receipt', { id: row.id });
  strict.ok(hasVariableReceipt(f.ctx.chat[0].mes, row.id)); strict.equal(f.ctx.chat[0].swipes[0], f.ctx.chat[0].mes); strict.equal(f.ctx.chat[0].swipes[1], '另一个分支'); strict.equal(f.replacementCount, 1);
});
test('chat-scoped data backfills the original assistant floor, not a later narrative', async () => {
  const f = fixture(); f.ctx.chatMetadata.variables = f.getRaw(); f.ctx.chat[0].variables = []; f.link.scope = 'chat'; await linkFixture(f); await f.app.generate(); await f.app.execute(); await removeReceipt(f);
  const row = f.store.read().roleWrites[0]; f.ctx.chat.push({ is_user: false, mes: '后来的剧情', name: f.ctx.name2 });
  await f.app.action('append-role-receipt', { id: row.id });
  strict.equal(f.store.read().roleWrites[0].receiptTarget.messageId, 0); strict.ok(hasVariableReceipt(f.ctx.chat[0].mes, row.id)); strict.equal(f.ctx.chat[1].mes, '后来的剧情'); strict.equal(f.replacementCount, 1);
});
test('post-acknowledgment receipt exception cannot report a pending MVU write', async () => {
  const f = fixture(); await linkFixture(f); await f.app.generate(); f.app.appendRoleReceipt = async () => { throw new Error('fixture post-ack receipt failure'); }; await f.app.execute();
  strict.equal(f.store.read().roleWrites[0].status, 'applied'); strict.match(f.app.ui.notice.message, /状态栏简报待补充/); strict.doesNotMatch(f.app.ui.notice.message, /角色写回待完成/); strict.equal(f.replacementCount, 1);
});
test('main text and multimodal prompts exclude owned human receipts while preserving original card blocks', () => {
  const f = fixture(), handlers = new Map(); f.ctx.eventTypes = { CHAT_COMPLETION_PROMPT_READY: 'chat', GENERATE_AFTER_COMBINE_PROMPTS: 'plain' }; f.ctx.eventSource = { on: (event, handler) => handlers.set(event, handler), removeListener: event => handlers.delete(event) };
  const bridge = installInjection({ context: () => f.ctx, store: f.store });
  const original = '正文<UpdateVariable>角色原更新</UpdateVariable>', withReceipt = appendVariableReceipt(original, sample, '操作');
  const chat = { chat: [{ role: 'assistant', content: withReceipt }, { role: 'user', content: [{ type: 'text', text: withReceipt }, { type: 'image_url', image_url: { url: 'data:fixture' } }] }] };
  handlers.get('chat')(chat); strict.equal(chat.chat[0].content, original); strict.equal(chat.chat[1].content[0].text, original); strict.equal(chat.chat[1].content[1].image_url.url, 'data:fixture');
  const plain = { prompt: withReceipt }; handlers.get('plain')(plain); strict.ok(plain.prompt.startsWith(original)); strict.doesNotMatch(plain.prompt, /WJWK-variable-receipt/);
  const own = { chat: [{ role: 'system', content: ASYNC_MARKER }, { role: 'assistant', content: withReceipt }] }; handlers.get('chat')(own); strict.equal(own.chat[1].content, withReceipt);
  const ownPlain = { prompt: ASYNC_MARKER + withReceipt }; handlers.get('plain')(ownPlain); strict.equal(ownPlain.prompt, ASYNC_MARKER + withReceipt);
  bridge.cleanup();
});
test('role rules can be selected independently of expanding their full text', async () => {
  const f = fixture(), draft = await f.bridge.discover(); draft.selectedRules = [];
  const html = WorkbenchUI.prototype.rolePanel({ state: f.store.read(), draft });
  for (const summary of html.matchAll(/<summary>([\s\S]*?)<\/summary>/g)) strict.doesNotMatch(summary[1], /name="role-rule"/);
  strict.match(html, /<label class="wjwk-checkbox"><input type="checkbox" name="role-rule" data-role-kind="update"/);
  const checked = [], status = { textContent: '', classList: { toggle() {} } }, save = { disabled: false };
  const form = { querySelectorAll: () => checked, querySelector: selector => selector.includes('selected-count') ? status : save };
  WorkbenchUI.prototype.updateRoleSelection(form); strict.equal(save.disabled, true); strict.match(status.textContent, /已选择 0 条/);
  checked.push({ dataset: { roleKind: 'format' } }); WorkbenchUI.prototype.updateRoleSelection(form); strict.equal(save.disabled, true);
  checked.push({ dataset: { roleKind: 'update' } }); WorkbenchUI.prototype.updateRoleSelection(form); strict.equal(save.disabled, false); strict.match(status.textContent, /已选择 2 条规则，包含/);
  checked.pop(); WorkbenchUI.prototype.updateRoleSelection(form); strict.equal(save.disabled, true);
});
