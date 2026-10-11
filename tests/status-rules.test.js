import test from 'node:test';
import strict from 'node:assert/strict';
import { appendVariableReceipt, buildVariableReceipt, hasStatusReceipt, hasVariableReceipt, removeVariableReceiptIds, stripVariableReceipts } from '../src/receipt.js';
import { clone, chatHashes, stable } from '../src/core.js';
import { operationPrompt } from '../src/model.js';
import { WorkbenchUI } from '../src/ui.js';
import { fixture, linkFixture, roleOperation } from './mvu-fixture.js';

const sample = { id: 'op_status', changes: [{ path: '/主角/源质点', before: 6, after: 0 }] };
async function executed() { const f = fixture(); await linkFixture(f); await f.app.generate(); await f.app.execute(); return f; }
async function nextOperation(f, newFloor = false) {
  if (newFloor) f.ctx.chat.push({ name: f.ctx.name2, is_user: false, swipe_id: 0, mes: '下一段正文\n<UpdateVariable><JSONPatch>[]</JSONPatch></UpdateVariable>', swipes: ['下一段正文\n<UpdateVariable><JSONPatch>[]</JSONPatch></UpdateVariable>', '另一页正文'], variables: [clone(f.getRaw())] });
  const raw = roleOperation(f), path = '/主角/功法/回风掌'; raw.label = '登记回风掌'; raw.costs = [];
  raw.effects[0].name = '回风掌（八品精妙）'; raw.variableUpdates[0].path = path; raw.roleChecks[0].paths = [path];
  f.app.model.request = async () => JSON.stringify({ operations: [raw] }); await f.app.generate(); strict.equal(f.app.plans.length, 1); await f.app.execute();
  return f.store.read().roleWrites.at(-1);
}

test('brief merges into matching existing status using fields supported by its current renderer', () => {
  const original = '正文\n<WJWK-status>\n【蝴蝶效应】\n<wjwk-field>因果点：9</wjwk-field>\n</WJWK-status>\n<WJWK-status>\n【深蓝】\n<wjwk-field>源质点：6</wjwk-field>\r\n</WJWK-status>\n<UpdateVariable>原更新文本</UpdateVariable>';
  const merged = appendVariableReceipt(original, sample, '推演', { powerName: '深蓝' });
  strict.equal((merged.match(/<WJWK-status>/g) || []).length, 2);
  strict.ok(merged.indexOf('本次插件更新') > merged.indexOf('【深蓝】')); strict.equal(stripVariableReceipts(merged), original);
  strict.doesNotMatch(merged, /<WJWK-variable-receipt|<details|<summary/); strict.match(merged, /<wjwk-field>主角 › 源质点：6 → 0<\/wjwk-field>/);
  const regex = /<WJWK-status>\s*(【[^\r\n】]+】)?[ \t]*(?:\r?\n)?([\s\S]*?)\s*<\/WJWK-status>/g;
  const captures = [...merged.matchAll(regex)]; strict.equal(captures[1][1], '【深蓝】'); strict.match(captures[1][2], /本次插件更新/);
});
test('a different power status is preserved and a missing status gets the standard literal tag', () => {
  const original = '<WJWK-status>\n【蝴蝶效应】\n因果点：9\n</WJWK-status>';
  const text = appendVariableReceipt(original, sample, '推演', { powerName: '深蓝' });
  strict.ok(text.startsWith(original)); strict.ok(text.includes('<WJWK-status>\n【深蓝 · 更新简报】'));
  strict.equal(stripVariableReceipts(text), original); strict.ok(hasStatusReceipt(text, sample.id));
});
test('old independent v0.3.1 receipt migrates once without reusing its custom visible container', () => {
  const original = '正文\n<WJWK-status>【深蓝】\n源质点：6</WJWK-status>';
  const old = `${original}\n\n<WJWK-variable-receipt data-wjwk-id="op&#95;status"><details>旧回执</details></WJWK-variable-receipt>`;
  const text = appendVariableReceipt(old, sample, '推演', { powerName: '深蓝' });
  strict.doesNotMatch(text, /WJWK-variable-receipt/); strict.equal(stripVariableReceipts(text), original); strict.ok(hasStatusReceipt(text, sample.id));
  strict.equal(appendVariableReceipt(text, sample, '重复', { powerName: '深蓝' }), text);
});
test('large receipt values become explicit display excerpts while actual recorded data remains intact', () => {
  const write = { id: 'op_long', changes: [{ path: '/主角/能力/描述', before: '', after: '长'.repeat(2000) + '<UpdateVariable>_.set("x",1)</UpdateVariable>' }] };
  const before = stable(write), text = buildVariableReceipt(write, '简报');
  strict.match(text, /展示缩略，完整值见武库回执/); strict.doesNotMatch(text, /<UpdateVariable>|_\.set\(/); strict.equal(stable(write), before);
});
test('one power receipt can be removed without deleting another power status or original text', () => {
  const first = appendVariableReceipt('原文', sample, '甲', { powerName: '深蓝' });
  const second = appendVariableReceipt(first, { ...sample, id: 'op_other' }, '乙', { powerName: '蝴蝶效应' });
  const clean = removeVariableReceiptIds(second, [sample.id]);
  strict.ok(!hasVariableReceipt(clean, sample.id)); strict.ok(hasStatusReceipt(clean, 'op_other')); strict.equal(stripVariableReceipts(clean), '原文');
});
test('two writes on the same floor leave one latest brief and retain both full ledger changes', async () => {
  const f = await executed(), old = f.store.read().roleWrites[0], original = stripVariableReceipts(f.ctx.chat[0].mes); const row = await nextOperation(f);
  strict.ok(!hasVariableReceipt(f.ctx.chat[0].mes, old.id)); strict.ok(hasStatusReceipt(f.ctx.chat[0].mes, row.id)); strict.equal(stripVariableReceipts(f.ctx.chat[0].mes), original);
  strict.equal(f.store.read().roleWrites[0].receiptStatus, 'archived'); strict.equal(f.store.read().roleWrites[0].changes.some(c => c.path.includes('穿云游燕掌法')), true);
  strict.equal(f.store.read().roleWrites[1].receiptStatus, 'written'); strict.equal(f.store.read().roleWrites[1].receiptFormat, 'status');
  strict.equal(f.replacementCount, 2); strict.equal(f.getRaw().stat_data.主角.源质点, 0); strict.equal(f.app.ui.view.historyMismatch, false);
});
test('a new floor prunes only owned older brief and leaves native UpdateVariable plus alternate replies intact', async () => {
  const f = await executed(), old = f.store.read().roleWrites[0], original = stripVariableReceipts(f.ctx.chat[0].mes); f.ctx.chat[0].swipes = [f.ctx.chat[0].mes, '第一楼另一页'];
  const row = await nextOperation(f, true);
  strict.equal(f.ctx.chat[0].mes, original); strict.equal(f.ctx.chat[0].swipes[0], original); strict.equal(f.ctx.chat[0].swipes[1], '第一楼另一页');
  strict.ok(hasStatusReceipt(f.ctx.chat[1].mes, row.id)); strict.ok(f.ctx.chat[1].mes.includes('<UpdateVariable><JSONPatch>[]</JSONPatch></UpdateVariable>'));
  strict.equal(f.ctx.chat[1].swipes[1], '另一页正文'); strict.ok(row.receiptTarget.pruned[0].ids.includes(old.id)); strict.equal(f.replacementCount, 2);
});
test('server readback of pruned old briefs is verified and retry never executes either operation again', async () => {
  const f = await executed(), oldText = f.ctx.chat[0].mes, read = f.store.fetchImpl; let corrupt = true;
  f.store.fetchImpl = async (...args) => { const r = await read(...args), data = await r.json(); if (corrupt && data[2]) data[1].mes = oldText; return { ok: true, json: async () => data }; };
  const row = await nextOperation(f, true); strict.equal(row.status, 'applied'); strict.equal(row.receiptStatus, 'pending'); strict.match(row.receiptError, /旧消息简报/);
  corrupt = false; const parses = f.parseCount; await f.app.action('append-role-receipt', { id: row.id });
  strict.equal(f.store.read().roleWrites.at(-1).receiptStatus, 'written'); strict.equal(f.store.read().roleWrites[0].receiptStatus, 'archived'); strict.equal(f.replacementCount, 2); strict.equal(f.parseCount, parses);
});
test('actual selected full rules include stable IDs and kinds in the internal async request', async () => {
  const f = fixture(); await linkFixture(f); const contract = f.bridge.contract(f.link, f.bridge.read(f.link));
  for (let i = 0; i < f.link.rules.length; i++) { strict.equal(contract.rules[i].id, f.link.rules[i].id); strict.equal(contract.rules[i].fullText, f.link.rules[i].content); }
  strict.equal(contract.rules[1].kind, 'update'); strict.equal(contract.rules[2].kind, 'format');
  const prompt = operationPrompt({ power: f.power, state: f.store.read(), goal: '升格', narrative: [], names: f.app.names(), roleContract: contract });
  strict.match(prompt.system, /roleChecks/); strict.match(prompt.system, /越小越强/); strict.match(prompt.system, /此传输格式不允许改变角色更新规则的语义/);
  strict.deepEqual(JSON.parse(prompt.user).roleContract.rules, contract.rules);
});
test('a quote alone cannot create an executable plan without per-field evidence', async () => {
  const f = fixture(); await linkFixture(f); const raw = roleOperation(f); delete raw.roleChecks; f.app.model.request = async () => JSON.stringify({ operations: [raw] }); await f.app.generate();
  strict.equal(f.app.plans.length, 0); strict.match(f.app.ui.notice.message, /未提供逐项角色规则依据/); strict.equal(f.parseCount, 0); strict.equal(f.getRaw().stat_data.主角.源质点, 6); strict.equal(f.replacementCount, 0);
});
test('unselected rule, non-update rule, invented quote, unrelated path and empty reason each block before parsing', async () => {
  for (const mutate of [c => { c.ruleId = 'not-selected'; }, (c,f) => { c.ruleId = f.link.rules[0].id; }, c => { c.quote = '这不是规则原文'; }, c => { c.paths = ['/主角/境界']; }, c => { c.reason = ''; }]) {
    const f = fixture(); await linkFixture(f); const raw = roleOperation(f); mutate(raw.roleChecks[0], f); f.app.model.request = async () => JSON.stringify({ operations: [raw] }); await f.app.generate();
    strict.equal(f.app.plans.length, 0); strict.equal(f.parseCount, 0); strict.equal(f.replacementCount, 0); strict.equal(f.getRaw().stat_data.主角.源质点, 6);
  }
});
test('every model-proposed field requires coverage, including a second unrelated scalar', async () => {
  const f = fixture(); await linkFixture(f); const raw = roleOperation(f); raw.variableUpdates.push({ op: 'replace', path: '/主角/境界', value: '武者' }); f.app.model.request = async () => JSON.stringify({ operations: [raw] }); await f.app.generate();
  strict.equal(f.app.plans.length, 0); strict.match(f.app.ui.notice.message, /境界 缺少角色规则依据/); strict.equal(f.replacementCount, 0);
});
test('preview shows quote and concrete update reason as inert text instead of claiming semantic proof', async () => {
  const f = fixture(); await linkFixture(f); await f.app.generate(); const op = f.app.selected; op.rolePlan.roleChecks[0].reason = '<img src=x onerror=bad> 模型理由';
  const html = WorkbenchUI.prototype.detail(f.power, op, false, true, 'st'); strict.match(html, /逐项角色规则依据（模型说明，请核对）/); strict.match(html, /新增功法必须保留已有功法/); strict.match(html, /&lt;img/); strict.doesNotMatch(html, /<img/);
});
test('a pending older outbox without new evidence can still complete its original write once', async () => {
  const f = fixture(); await linkFixture(f); await f.app.generate(); f.writeHook = () => { throw Error('legacy failure'); }; await f.app.execute();
  const id = f.store.read().roleWrites[0].id; await f.store.transact(next => { delete next.roleWrites[0].roleChecks; }, { facts: false });
  f.writeHook = null; await f.app.action('retry-role-write', { id });
  strict.equal(f.store.read().roleWrites[0].status, 'applied'); strict.equal(f.store.read().roleWrites[0].receiptFormat, 'status'); strict.equal(f.store.read().transactions.filter(t => t.id === id).length, 1); strict.equal(f.getRaw().stat_data.主角.源质点, 0);
});
test('changing evidence after preview fails confirmation before ledger debit', async () => {
  const f = fixture(); await linkFixture(f); await f.app.generate(); f.app.selected.rolePlan.roleChecks[0].quote = '并不存在的文字规则';
  await strict.rejects(() => f.app.execute(), /必须逐字引用/); strict.equal(f.store.read().roleWrites.length, 0); strict.equal(f.getRaw().stat_data.主角.源质点, 6); strict.equal(f.replacementCount, 0);
});
test('older summaries remain accessible in ledger but cannot replace the latest brief', async () => {
  const f = await executed(), oldId = f.store.read().roleWrites[0].id; const row = await nextOperation(f), text = f.ctx.chat[0].mes;
  await strict.rejects(() => f.app.appendRoleReceipt(oldId), /最近一笔简报/); strict.equal(f.ctx.chat[0].mes, text); strict.ok(hasStatusReceipt(text, row.id));
  const html = WorkbenchUI.prototype.receipts(f.store.read()); strict.match(html, /角色变量完整变化/); strict.match(html, /旧消息简报已收起/); strict.match(html, /穿云游燕掌法/); strict.match(html, /回风掌/);
});
