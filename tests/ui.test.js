import test from 'node:test';
import strict from 'node:assert/strict';
import { WorkbenchUI, requiresFormValidation } from '../src/ui.js';
import { importBook, createPower, emptyState, hash, stable, builtInOperations } from '../src/core.js';
test('untrusted rule names and asset descriptions are rendered as text, never executable markup', () => {
  const p = createPower(importBook({ entries: { 1: { comment: '<img src=x onerror=alert(1)>', content: '完整的测试正文。' } } })[0]);
  p.assets.a = { id: 'a', name: '<script>alert(1)</script>', quantity: '1', description: '<img src=x onerror=alert(1)>', kind: '物品', permanent: true };
  const html = WorkbenchUI.prototype.assets(p); strict.equal(html.includes('<script>'), false); strict.equal(html.includes('<img'), false); strict.match(html, /&lt;img/);
});
test('fixed-operation preview disables execution until balance is explicitly known', () => {
  const p = createPower(importBook({ entries: { 1: { comment: '蝴蝶效应', content: '{{user}}能够直接消耗1因果点，将一份固定基准底蕴永久叠加到自身' } } })[0]); const s = emptyState(); s.powers[p.id] = p;
  const op = builtInOperations(p, s, hash(stable([])))[0]; const html = WorkbenchUI.prototype.detail(p, op, false); strict.match(html, /data-action="execute" disabled/); strict.match(html, /余额尚未确定/);
  Object.values(p.resources)[0].balance = '1'; strict.doesNotMatch(WorkbenchUI.prototype.detail(p, op, false), /data-action="execute" disabled/);
});
test('rendered workbench keeps settings, receipts, backups and explicit confirmation reachable', () => {
  const ui = Object.create(WorkbenchUI.prototype); ui.panel = { innerHTML: '' }; ui.tab = 'operations'; ui.goal = '玩家目标';
  ui.render({ state: emptyState(), power: null, selected: null, operations: [], settings: { mode: 'off' }, bridge: true });
  for (const action of ['settings', 'manage', 'generate', 'sync', 'export', 'backup']) strict.match(ui.panel.innerHTML, new RegExp(`data-action="${action}"`));
  strict.match(ui.panel.innerHTML, /异步关闭/); strict.match(ui.panel.innerHTML, /玩家目标/);
});
test('read-only discovery buttons bypass required-field checks, saves still validate', () => { for (const action of ['extract-balances', 'read-book', 'fetch-models', 'zero-balances']) strict.equal(requiresFormValidation(action), false, action); for (const action of ['save-baseline','save-balances','save-settings']) strict.equal(requiresFormValidation(action), true, action); });
test('balance confirmation auto-prefills unknown resources, preserves known ledger values and has no mandatory note', () => {
  const ui = Object.create(WorkbenchUI.prototype); let html; ui.dialog = (_title, body) => { html = body; };
  const power = { name: '蝴蝶效应', resources: { a: { id:'a',name:'因果点',balance:null,floor:'0' }, b: { id:'b',name:'已有点数',balance:'8',floor:'0' } } };
  ui.showBaseline(power, { a: { balance:'12',source:'第2条模型回复',evidence:'因果点余额：12' }, b: { balance:'100',source:'旧面板' } });
  strict.match(html, /name="balance:a" value="12"/); strict.match(html, /name="balance:b" value="8"/); strict.match(html, /原文：因果点余额：12/); strict.doesNotMatch(html, /required/); strict.match(html, /确认这些余额并开始/);
});
test('model selector renders hostile IDs as inert option text', () => { const ui = Object.create(WorkbenchUI.prototype), select = { innerHTML:'' }; ui.modelIds = ['chat-model','<img src=x onerror=alert(1)>']; ui.modal = { querySelector: s => s === '[data-model-list]' ? select : { value:'chat-model' } }; ui.filterModels(''); strict.doesNotMatch(select.innerHTML, /<img/); strict.match(select.innerHTML, /&lt;img/); strict.match(select.innerHTML, /selected/); });
test('action preview separates immediate story from deferred settlement and preserves the selected intent', () => {
  const p=createPower(importBook({entries:{1:{comment:'蝴蝶效应',content:'{{user}}能够直接消耗1因果点，将一份固定基准底蕴永久叠加到自身'}}})[0]), s=emptyState(); s.powers[p.id]=p; Object.values(p.resources)[0].balance='2'; const op=builtInOperations(p,s,hash(stable([])))[0];op.intent='在院中试演';
  const html=WorkbenchUI.prototype.detail(p,op,false);strict.match(html,/确认并展开剧情/);strict.match(html,/data-action="execute-later"/);strict.match(html,/在院中试演/);strict.match(html,/data-story-note/);
});
test('narrative panel exposes retry and evidence without treating any reply as confirmed',()=>{
  const state=emptyState();state.narrativeActions=[{id:'op_test',label:'<script>测试</script>',intent:'玩家选择',status:'waiting'}];const ui=Object.create(WorkbenchUI.prototype);let html=ui.narratives(state,false,'st');strict.match(html,/展开待承接行动/);strict.doesNotMatch(html,/<script>/);strict.match(html,/不再扣费/);
  Object.assign(state.narrativeActions[0],{status:'presented',result:{index:1,excerpt:'<img src=x>正文'}});html=ui.narratives(state,false,'st');strict.match(html,/待核对/);strict.match(html,/检查正文覆盖/);strict.match(html,/正文已承接/);strict.doesNotMatch(html,/<img/);
});
