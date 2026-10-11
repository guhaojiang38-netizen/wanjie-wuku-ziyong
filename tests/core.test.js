import test from 'node:test';
import strict from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { amount, decimal, normAmount, stable, hash, emptyState, importBook, createPower, inferResources, upgradeResources, normalizeOperation, applyOperation, canAfford, builtInOperations, chatHashes, historyChanged, validateState, parseJSON, buildInjection, extractPanelBalances } from '../src/core.js';

const rules = '按完整效果规格兑换所得，每次消耗资源。{{user}}能够直接消耗1因果点，将一份固定基准底蕴永久叠加到自身';
export function fixture(name = '蝴蝶效应') {
  const entry = importBook({ entries: { 1: { uid: 1, comment: name, content: name === '深蓝' ? '根据已掌握能力锚点和当前状态推演实际缺口，消耗源质点。' : rules } } }, '测试规则')[0];
  const p = createPower(entry), s = emptyState(); s.powers[p.id] = p; const r = Object.values(p.resources)[0]; r.balance = '3';
  return { p, s, r, hashes: [], contextHash: hash(stable([])) };
}
function op(f, changes = {}) { return normalizeOperation({ label: '测试所得', ruleQuote: f.p.rules.slice(0, 12), ready: true, requirements: [], costs: [{ kind: 'resource', id: f.r.id, amount: '1' }], effects: [{ type: 'asset_grant', name: '成果', description: '明确完整的测试成果规格', kind: '能力', quantity: '1', permanent: true }], ...changes }, f.p, f.s, f.contextHash); }
test('decimal arithmetic preserves large values and decimal precision', () => {
  strict.equal(decimal(amount('90071992547409931234567890.123456') + amount('0.000001')), '90071992547409931234567890.123457');
  strict.equal(normAmount('-000.100000'), '-0.1'); strict.throws(() => amount('1e3')); strict.throws(() => amount('0.1234567'));
});
test('unknown balances remain unknown and cannot fund operations', () => { const f = fixture(); f.r.balance = null; strict.equal(canAfford(f.p, op(f)).ok, false); strict.throws(() => applyOperation(f.s, op(f), f.contextHash, [])); strict.equal(f.r.balance, null); });
test('duplicate costs are aggregated; insufficient operation changes nothing', () => {
  const f = fixture(); const operation = op(f, { costs: [1, 2].map(() => ({ kind: 'resource', id: f.r.id, amount: '2' })) }); const before = stable(f.s);
  strict.equal(canAfford(f.p, operation).ok, false); strict.throws(() => applyOperation(f.s, operation, f.contextHash, [])); strict.equal(stable(f.s), before);
});
test('confirmed operation creates one permanent effect and deducts exactly once', () => {
  const f = fixture(), operation = builtInOperations(f.p, f.s, f.contextHash)[0];
  applyOperation(f.s, operation, f.contextHash, []); const after = stable(f.s); const repeated = applyOperation(f.s, operation, 'changed-history', []);
  strict.equal(repeated.duplicate, true); strict.equal(stable(f.s), after); strict.equal(f.r.balance, '2'); strict.equal(Object.values(f.p.assets)[0].permanent, true); strict.equal(f.s.transactions.length, 1);
  strict.match(buildInjection(f.s), /无需再次扣付/); strict.match(buildInjection(f.s), /固定基准本源增益/);
});
test('an unknown income balance blocks the entire operation before any debit', () => {
  const f = fixture(); f.p.resources.other = { id: 'other', name: '未知收益资源', balance: null, floor: '0' };
  const operation = op(f, { effects: [{ type: 'resource_credit', id: 'other', amount: '1' }] }), before = stable(f.s);
  strict.throws(() => applyOperation(f.s, operation, f.contextHash, [])); strict.equal(stable(f.s), before);
});
test('explicit debt floor is honored and never inferred', () => { const f = fixture(); f.r.floor = '-2'; applyOperation(f.s, op(f, { costs: [{ kind: 'resource', id: f.r.id, amount: '5' }] }), f.contextHash, []); strict.equal(f.r.balance, '-2'); strict.equal(canAfford(f.p, op(f)).ok, false); });
test('stale state, revision, rules and narrative each block execution', () => {
  for (const mutate of [f => { f.s.id = 'another'; }, f => { f.s.revision++; }, f => { f.p.ruleVersion = 'changed'; }, f => { f.contextHash = 'new'; }, f => { f.p.active = false; }]) { const f = fixture(), operation = op(f); mutate(f); strict.throws(() => applyOperation(f.s, operation, f.contextHash, [])); strict.equal(f.r.balance, '3'); }
});
test('butterfly same exact effect specification reuses confirmed price; deepblue recalculates', () => {
  for (const name of ['蝴蝶效应', '深蓝']) { const f = fixture(name); const first = op(f); applyOperation(f.s, first, f.contextHash, []); const second = op(f, { label: '不同显示名', costs: [{ kind: 'resource', id: f.r.id, amount: '99' }] }); strict.equal(second.costs[0].amount, name === '蝴蝶效应' ? '1' : '99'); }
});
test('narrative evidence must occur literally in new model prose', () => {
  const f = fixture(); const raw = { label: '奖励', ruleQuote: rules.slice(0, 12), ready: true, costs: [], effects: [{ type: 'resource_credit', id: f.r.id, amount: '1' }], evidence: ['你完成了今天的签到。'] };
  strict.throws(() => normalizeOperation(raw, f.p, f.s, f.contextHash, { event: true, evidenceText: '尚未开始签到。' }));
  const event = normalizeOperation(raw, f.p, f.s, f.contextHash, { event: true, evidenceText: '你完成了今天的签到。' }); strict.throws(() => applyOperation(f.s, event, f.contextHash, [])); applyOperation(f.s, event, f.contextHash, [], { allowEvent: true }); strict.equal(f.r.balance, '4');
});
test('history anchors detect deletion, edits and swipe changes but allow appended messages', () => { const f = fixture(); const chat = [{ mes: '旧消息', swipe_id: 0 }]; f.s.historyAnchor = chatHashes(chat); strict.equal(historyChanged(f.s, chatHashes([...chat, { mes: '新消息' }])), false); strict.equal(historyChanged(f.s, []), true); strict.equal(historyChanged(f.s, chatHashes([{ mes: '旧消息', swipe_id: 1 }])), true); });
test('JSON parser does not evaluate code and accepts fenced or prefixed objects', () => { strict.deepEqual(parseJSON('说明\n```json\n{"a":"}\\\"","b":1}\n```'), { a: '}"', b: 1 }); strict.throws(() => parseJSON('{broken')); strict.throws(() => parseJSON('(()=>123)()')); });
test('backup validation rejects malformed prices and prototype keys; pending proposals removed', () => {
  const f = fixture(); f.p.quotes = [{ arbitrary: true }]; strict.equal(validateState(f.s).powers[f.p.id].quotes.length, 0);
  const operation = op(f); applyOperation(f.s, operation, f.contextHash, []); f.p.fixedQuotes[0].costs[0].amount = '-1'; strict.throws(() => validateState(f.s));
  const other = fixture(); other.p.fields = JSON.parse('{"__proto__":{"label":"X","value":"Y"}}'); strict.throws(() => validateState(other.s));
});
test('state panel extraction keeps powers and exact labels separate', () => { const f = fixture(); const values = extractPanelBalances(f.p, [{ mes: '<WJWK-status>深蓝\n源质点余额：999</WJWK-status>\n<WJWK-status>蝴蝶效应\n因果点余额：12.5</WJWK-status>' }]); strict.equal(values[f.r.id].balance, '12.5'); });
test('provided V4.1 book imports all entries and finds the literal fixed butterfly rule', async t => {
  const path = process.env.WJWK_TEST_BOOK; if (!path) return t.skip('Set WJWK_TEST_BOOK for private worldbook integration');
  const entries = importBook(JSON.parse(await readFile(path, 'utf8')), '实际V4.1'); strict.equal(entries.length, 119); const entry = entries.find(e => e.name === '蝴蝶效应'); strict.ok(entry); const p = createPower(entry), s = emptyState(); s.powers[p.id] = p; strict.equal(builtInOperations(p, s, hash(stable([]))).length, 1);
});
test('explicit point and storage fields are detected without inventing currency for inventories or cumulative totals', () => {
  const resources = inferResources({ name: '自定义金手指', content: '<状态栏>\n当前升变点：[X点]\n恋爱点数：[X点]\n火焰储量：[X/上限]\n重要物资：[来源与余额]\n累计完成次数：[X]\n当前持有奖品：[X件]\n<结算与回执>' });
  strict.deepEqual(resources.map(r => r.name), ['升变点', '恋爱点数', '火焰']); strict.ok(resources.every(r => r.balance === null));
});
test('V4.1 spendable resources include points, daily opportunities and energy', async t => {
  if (!process.env.WJWK_TEST_BOOK) return t.skip('Private input not supplied');
  const entries = importBook(JSON.parse(await readFile(process.env.WJWK_TEST_BOOK, 'utf8')), 'V4.1');
  for (const [name, resource] of [['故事点','故事点'],['升变之印','升变点'],['攻略系统','恋爱点数'],['无龙心法','心能'],['念气体系','念气'],['人生模拟','模拟次数'],['抽奖系统','今日抽奖次数'],['置物栏',null]]) { const actual = inferResources(entries.find(e => e.name === name)); strict.equal(actual[0]?.name || null, resource); }
});
test('resource upgrade preserves old balances and does not use unrelated companion currencies', () => {
  const f = fixture(); f.p.primaryRules = f.p.rules; f.p.rules += '\n附加约束：<状态栏>\n其他币余额：[X]\n<结算与回执>'; upgradeResources(f.p); strict.equal(Object.values(f.p.resources)[0].balance, '3'); strict.equal(Object.keys(f.p.resources).length, 1);
  const legacy = createPower(importBook({ entries: { 1: { comment: '升变之印', content: '<升变之印>完整规则</升变之印>' } } })[0]); legacy.resources = {}; upgradeResources(legacy); strict.equal(Object.values(legacy.resources)[0].name, '升变点'); strict.equal(Object.values(legacy.resources)[0].balance, null);
});
test('balance scan supports HTML breaks, Markdown, commas, daily ratios and post-change balances', () => {
  const f = fixture();
  for (const [mes, expected] of [
    ['<WJWK-status>【蝴蝶效应·概览】<br>**因果点余额**：[1,234.5点]</WJWK-status>', '1234.5'],
    ['### 蝴蝶效应\n| 因果点余额 | 12 |', '12'],
    ['<WJWK-status>【蝴蝶效应】\n因果点余额：10 -> 8</WJWK-status>', '8'],
    ['<WJWK-status>【蝴蝶效应】\n因果点余额：0</WJWK-status>', '0'],
    ['<WJWK-status>【蝴蝶效应】<table><tr><td>因果点余额</td><td>9</td></tr></table></WJWK-status>', '9'],
    ['<WJWK-status>【蝴蝶效应】因果点余额：[4]</WJWK-status>', '4'],
  ]) strict.equal(extractPanelBalances(f.p, [{ mes }])[f.r.id]?.balance, expected, mes);
  const p = createPower(importBook({ entries: { 1: { comment: '抽奖系统', content: '<抽奖系统>完整规则</抽奖系统>' } } })[0]); const id = Object.keys(p.resources)[0]; strict.equal(extractPanelBalances(p, [{ mes: '<WJWK-status>【抽奖系统】\n今日剩余抽奖：[3/5]</WJWK-status>' }])[id].balance, '3');
});
test('balance scan chooses newest evidence and isolates each power heading', () => {
  const f = fixture(); const messages = [{ mes: '<WJWK-status>【蝴蝶效应】\n因果点余额：99</WJWK-status>' }, { mes: '<WJWK-status>【蝴蝶效应】\n因果点余额：7\n【其他词条】\n因果点余额：999</WJWK-status>' }];
  const finding = extractPanelBalances(f.p, messages)[f.r.id]; strict.equal(finding.balance, '7'); strict.equal(finding.messageIndex, 1); strict.match(finding.evidence, /7/);
  strict.deepEqual(extractPanelBalances(f.p, [{ is_user: true, mes: messages[0].mes }]), {});
  strict.deepEqual(extractPanelBalances(f.p, [{ mes: '<WJWK-think>蝴蝶效应\n因果点余额：500</WJWK-think>' }]), {});
});
