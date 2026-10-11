import test from 'node:test';
import strict from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fixture } from './mvu-fixture.js';
import { clone, stable, hash, chatHashes, narrativeMessages, validateState, importBook, createPower } from '../src/core.js';
import { saveArchive, archiveSource, archiveCurrent, archivePanel, sceneArchiveContext, ARCHIVE_FIELDS } from '../src/archives.js';
import { sceneActionsPrompt, ModelConnection } from '../src/model.js';
import { normalizeCandidates } from '../src/narrative.js';
import { composerDraft, appendComposerIntent } from '../src/host.js';
import { memoryPlan, memoryDefaults } from '../src/archive-memory.js';
import { archivePrompt, normalizeArchiveChanges, applyArchiveChanges } from '../src/archive-review.js';
import { configuredProfiles } from '../src/management-profiles.js';
import { WorkbenchUI } from '../src/ui.js';

function setup() {
  const f = fixture();
  const r = saveArchive(f.power, { type: 'population', name: '耐寒工蜂', status: 'active', fields: { traits: '耐寒', location: '北坡', scale: '一小群' } }, archiveSource(f.ctx.chat, '人工核对'));
  const narrative = narrativeMessages(f.ctx.chat), archives = sceneArchiveContext(f.power, f.ctx.chat, '耐寒工蜂');
  const raw = { kind: 'investigate', label: '观察已有工蜂', goal: '我观察耐寒工蜂在北坡的行动，先了解活动范围，再决定下一步部署。', benefit: '用已有种群降低部署的不确定性。', uncertainty: '活动范围尚不明确。', archiveIds: [r.id], sourceIndex: 0, sceneQuote: narrative[0].content.slice(0, 12), ruleQuote: f.power.rules.slice(0, 12) };
  f.app.ui.setSceneBusy = () => {}; f.app.ui.showSceneSuggestions = () => {}; f.app.ui.setOpen = () => {};
  return { ...f, r, narrative, archives, raw };
}
test('scene prompt supplies confirmed objects, intent and limitations without promoting plans to capabilities', () => {
  const f = setup(); const p = sceneActionsPrompt({ power: f.power, narrative: f.narrative, names: { user: '玩家' }, archives: f.archives, requestedGoal: '应对粮食短缺', draft: '先保留巡视力量' });
  const data = JSON.parse(p.user); strict.equal(data.archiveContext.items[0].id, f.r.id); strict.equal(data.requestedGoal, '应对粮食短缺'); strict.equal(data.unsentDraft, '先保留巡视力量');
  strict.match(p.system, /同一手段换个名称/); strict.match(p.system, /不转成插件交易/); strict.match(p.system, /planned是计划/); strict.match(p.system, /不替正文宣布成功/);
  strict.throws(() => sceneActionsPrompt({ power: { ...f.power, rules: '字'.repeat(120000) }, narrative: f.narrative, names: {}, archives: f.archives }), /120000字符/);
});
test('new suggestions require scene and rule quotes, existing archive IDs, distinct kinds and distinct intents', () => {
  const f = setup(), normalize = actions => normalizeCandidates({ actions }, f.power, f);
  const valid = normalize([f.raw]); strict.deepEqual(valid[0].archiveNames, ['耐寒工蜂']);
  for (const raw of [{ ...f.raw, archiveIds: ['missing'] }, { ...f.raw, sceneQuote: '当前场景没有这句证据' }, { ...f.raw, sourceIndex: 9 }, { ...f.raw, ruleQuote: '原文中没有这条规则' }, { ...f.raw, effects: [] }, { ...f.raw, benefit: '' }]) strict.throws(() => normalize([raw]));
  strict.throws(() => normalize([f.raw, { ...f.raw, goal: '我观察另一处。' }]), /方向重复/);
  strict.throws(() => normalize([f.raw, { ...f.raw, kind: 'prepare', goal: f.raw.goal.replaceAll('。', '') }]), /意图重复/);
  f.archives.items[0].status = 'planned'; strict.deepEqual(normalize([f.raw])[0].provisional, ['耐寒工蜂']);
  f.narrative[0].is_user = true; strict.equal(normalize([f.raw])[0].sourceIsIntent, true);
});
test('composer append preserves unsent text, emits input, avoids repeated appends and never sends', () => {
  let events = 0, focused = 0;
  const input = { value: '先保留这段草稿', dispatchEvent(e) { strict.equal(e.type, 'input'); strict.equal(e.bubbles, true); events++; }, focus() { focused++; } };
  const doc = { getElementById: id => { strict.equal(id, 'send_textarea'); return input; } };
  appendComposerIntent('我先观察周边。', doc); appendComposerIntent('我先观察周边。', doc);
  strict.equal(input.value, '先保留这段草稿\n\n我先观察周边。'); strict.equal(events, 2); strict.equal(focused, 2); strict.equal(composerDraft(doc), input.value);
  strict.throws(() => appendComposerIntent('我先观察。', { getElementById: () => null }), /不可用/);
  input.readOnly = true; strict.throws(() => appendComposerIntent('我先观察。', doc), /不可用/);
});
test('controller uses optional MVU read, preserves ledger and writes a suggestion only to the composer', async () => {
  const f = setup(), previous = globalThis.document, input = { value: '保留草稿', dispatchEvent() {}, focus() {} };
  globalThis.document = { getElementById: () => input };
  try {
    await f.store.transact(next => { next.powers[f.power.id] = clone(f.power); next.roleLink = clone(f.link); });
    f.app.settings.mode = 'st'; f.app.roleSnapshot = () => { throw new Error('MVU unavailable'); };
    f.app.pullRoleBalances = () => { throw new Error('advice must not refresh wallet'); };
    f.ctx.generate = () => { throw new Error('must not generate'); };
    const before = stable(f.store.read()); let requested;
    f.app.model.request = async prompt => { requested = JSON.parse(prompt.user); return JSON.stringify({ actions: [f.raw] }); };
    await f.app.sceneActions({ values: { focus: '检验工蜂活动' } }); strict.ok(requested.roleUnavailable); strict.equal(requested.roleContract, undefined); strict.equal(requested.archiveContext.items[0].name, '耐寒工蜂');
    f.app.useSceneSuggestion(0); strict.match(input.value, /^保留草稿/); strict.match(input.value, /耐寒工蜂/); strict.equal(stable(f.store.read()), before); strict.equal(f.replacementCount, 0);
    f.ctx.chat[0].mes += '意外改写'; strict.throws(() => f.app.useSceneSuggestion(0), /历史|失效/);
  } finally { globalThis.document = previous; }
});
test('changing the draft while the request runs rejects the old suggestions; reopening drops old revision results', async () => {
  const f = setup(), previous = globalThis.document, input = { value: '旧草稿' }; globalThis.document = { getElementById: () => input };
  try {
    f.app.settings.mode = 'st'; f.app.model.request = async () => { input.value = '新意向'; return JSON.stringify({ actions: [f.raw] }); };
    await strict.rejects(f.app.sceneActions(), /草稿已变化/); strict.equal(f.app.sceneQuery, false);
    f.app.sceneCandidates = { stateId: f.state.id, powerId: f.power.id, revision: -1, contextHash: hash(stable(chatHashes(f.ctx.chat))), actions: [f.raw] };
    f.app.openSceneSuggestions(); strict.equal(f.app.sceneCandidates, null);
  } finally { globalThis.document = previous; }
});
test('member, skill and bond records preserve history, survive backup and participate in memory and model updates', async () => {
  const f = setup();
  for (const type of ['member', 'skill', 'bond']) {
    const field = Object.keys(ARCHIVE_FIELDS[type])[0], r = saveArchive(f.power, { type, name: `自编${type}`, status: 'active', fields: { [field]: '已有事实' } }, archiveSource(f.ctx.chat, '人工核对'));
    saveArchive(f.power, { type, id: r.id, name: r.name, status: 'active', fields: { ...r.fields, [field]: '更新后的已有事实' } }, archiveSource(f.ctx.chat, '人工核对'));
    strict.equal(f.power.archives[r.id].history.length, 1);
  }
  validateState(f.state); const restored = JSON.parse(JSON.stringify(f.state)); await f.store.restore(restored, chatHashes(f.ctx.chat));
  const p = f.store.read().powers[f.power.id]; strict.ok(Object.values(p.archives).some(r => r.type === 'bond'));
  const config = { ...memoryDefaults(), auto: true };
  strict.match(memoryPlan(f.store.read(), f.ctx.chat, '自编member 自编skill 自编bond', config).packet, /双方义务|已达程度|身份与职责/);
  const member = Object.values(p.archives).find(r => r.type === 'member'), sources = [{ index: 0, swipeId: 0, content: f.narrative[0].content, length: f.narrative[0].content.length, textHash: hash(f.narrative[0].content) }];
  const raw = { archiveId: member.id, type: 'member', name: member.name, fields: { condition: '已完成巡查' }, sourceIndex: 0, quote: sources[0].content.slice(0, 10), ruleQuote: f.power.rules.slice(0, 12) };
  const changes = normalizeArchiveChanges({ changes: [raw] }, p, sources, f.ctx.chat); applyArchiveChanges(p, changes, sources, new Map([[0, member.id]]), f.ctx.chat);
  strict.equal(p.archives[member.id].fields.condition, '已完成巡查'); strict.equal(archiveCurrent(p.archives[member.id], f.ctx.chat), true);
  strict.match(archivePrompt(p, sources, f.ctx.chat).system, /member\/skill\/bond/);
});
test('verified families select their overview; unknown and changed versions stay generic', { skip: !process.env.WJWK_TEST_BOOK }, () => {
  const entries = importBook(JSON.parse(readFileSync(process.env.WJWK_TEST_BOOK, 'utf8')), '原始世界书');
  for (const [family, type, title] of [['domain', 'environment', '领域概览'], ['member', 'member', '成员概览'], ['growth', 'skill', '成长概览'], ['relationship', 'bond', '契约概览']]) {
    const profile = configuredProfiles().entries.find(p => p.family === family && p.role === 'primary' && p.name !== '母巢'), entry = entries.find(e => e.name === profile.name);
    const p = createPower(entry); strict.deepEqual(archivePanel(p), { title, defaultType: type });
    p.primaryRules += '修改版本'; strict.equal(archivePanel(p).title, '当前成果');
  }
  strict.equal(archivePanel({ name: '自编未知', rules: '任意新版本' }).defaultType, 'record');
});
test('suggestion UI escapes hostile values, keeps evidence collapsed and uses draft wording', () => {
  const f = setup(), ui = Object.create(WorkbenchUI.prototype); let html;
  ui.dialog = (_title, body) => { html = body; }; ui.view = { settings: { mode: 'st' } }; ui.sceneFocus = '<img src=x>';
  const a = normalizeCandidates({ actions: [{ ...f.raw, label: '<svg onload=alert(1)>' }] }, f.power, f)[0];
  ui.showSceneSuggestions(f.power, { actions: [a], coverage: f.archives });
  strict.doesNotMatch(html, /<svg|<img|尚未报价|核对价格/); strict.match(html, /&lt;svg/); strict.match(html, /写入正文输入框/); strict.match(html, /关键未知/); strict.doesNotMatch(html, /<details open/);
});
test('scene prompt works through the existing adapter without a live request', async () => {
  const f = setup(); let calls = 0;
  const model = new ModelConnection({ context: () => ({ generateRaw: async params => { calls++; strict.equal(JSON.parse(params.prompt).archiveContext.items[0].id, f.r.id); return JSON.stringify({ actions: [f.raw] }); } }), settings: () => ({ mode: 'st', timeoutSeconds: 10 }), getKey: () => '' });
  const prompt = sceneActionsPrompt({ power: f.power, narrative: f.narrative, archives: f.archives, names: {} });
  strict.equal(normalizeCandidates(JSON.parse(await model.request(prompt)), f.power, f).length, 1); strict.equal(calls, 1);
});
