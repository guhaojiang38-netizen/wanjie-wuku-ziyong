import test from 'node:test';
import strict from 'node:assert/strict';
import { fixture } from './mvu-fixture.js';
import { hash, chatHashes, validateState, clone } from '../src/core.js';
import { archiveSource, saveArchive } from '../src/archives.js';
import { archivePrompt, normalizeArchiveChanges, applyArchiveChanges } from '../src/archive-review.js';
import { normalizePlayerGuide, currentPlayerGuide, playerTimeline } from '../src/player-home.js';
import { WorkbenchUI } from '../src/ui.js';

function setup() {
  const f = fixture(), quote = f.power.rules.slice(0, 30);
  const guide = { summary: '依据原文条件发展已有能力。', abilities: [{ name: '能力方向', description: '按原文条件使用，不意味着已经成功。', ruleQuote: quote }] };
  const note = '这群工蜂现在负责北坡巡视。';
  const raw = { type: 'population', name: '耐寒工蜂', status: 'active', fields: { purpose: '北坡巡视' }, sourceIndex: -1, quote: note, ruleQuote: quote };
  return { ...f, guide, note, raw };
}
test('rule guide requires literal references, bounded directions and rejects executable fields', () => {
  const f = setup(); f.power.playerGuide = normalizePlayerGuide(f.guide, f.power);
  strict.equal(currentPlayerGuide(f.power).abilities.length, 1);
  strict.throws(() => normalizePlayerGuide({ ...f.guide, costs: [] }, f.power));
  strict.throws(() => normalizePlayerGuide({ ...f.guide, abilities: [{ ...f.guide.abilities[0], ruleQuote: '不存在的规则依据' }] }, f.power));
  strict.throws(() => normalizePlayerGuide({ ...f.guide, abilities: [] }, f.power));
  f.power.ruleVersion = hash('另一版本'); strict.equal(currentPlayerGuide(f.power), null);
});
test('AI oral supplement preserves original object and provenance without pretending to be narrative', () => {
  const f = setup(), r = saveArchive(f.power, { type: 'population', name: '耐寒工蜂', status: 'active', fields: { traits: '耐寒', scale: '三十只' } }, archiveSource(f.ctx.chat, '人工核对'));
  const changes = normalizeArchiveChanges({ changes: [{ ...f.raw, archiveId: r.id }] }, f.power, [], f.ctx.chat, f.note);
  strict.equal(changes[0].source.type, 'manual'); strict.equal(changes[0].source.quote, f.note);
  applyArchiveChanges(f.power, changes, [], new Map([[0, r.id]]), f.ctx.chat);
  strict.equal(f.power.archives[r.id].fields.purpose, '北坡巡视'); strict.equal(f.power.archives[r.id].fields.scale, '三十只');
  strict.equal(f.power.archives[r.id].history.length, 1); strict.equal(f.power.archiveReviewed.length, 0);
  validateState(f.state); strict.equal(playerTimeline(f.power, f.ctx.chat)[0].text, '北坡巡视');
});
test('initial AI review scans recent pre-registration narrative and caches only after confirmation', async () => {
  const f = setup(); await f.store.transact(next => { next.powers[f.power.id].archiveStart = f.ctx.chat.length; next.historyAnchor = chatHashes(f.ctx.chat); });
  f.app.settings.mode = 'st'; f.app.ui.showArchiveReview = () => {};
  f.app.model.request = async prompt => { const input = JSON.parse(prompt.user); strict.equal(input.sources.length, 1); strict.equal(input.explainRules, true); return JSON.stringify({ guide: f.guide, changes: [] }); };
  await f.app.reviewArchives({ initial: true }); strict.equal(f.store.read().powers[f.power.id].playerGuide, undefined);
  const NativeFormData = globalThis.FormData, form = new NativeFormData();
  globalThis.FormData = class { constructor(value) { return value; } };
  try { await f.app.applyArchiveReview({ form }); } finally { globalThis.FormData = NativeFormData; }
  strict.equal(currentPlayerGuide(f.store.read().powers[f.power.id]).summary, f.guide.summary); strict.equal(f.replacementCount, 0);
  const backed = clone(f.store.read()); await f.store.restore(backed, chatHashes(f.ctx.chat)); strict.ok(currentPlayerGuide(f.store.read().powers[f.power.id]));
});
test('silent review leaves a proposal without interrupting or saving facts', async () => {
  const f = setup(); f.app.settings.mode = 'st'; let opened = 0; f.app.ui.showArchiveReview = () => opened++;
  f.app.model.request = async () => JSON.stringify({ guide: f.guide, changes: [] });
  await f.app.reviewArchives({ silent: true }); strict.equal(opened, 0); strict.ok(f.app.pendingArchiveReview.guide);
  strict.equal(f.store.read().powers[f.power.id].playerGuide, undefined); f.app.openPlayerReview(); strict.equal(opened, 1);
  await f.store.transact(next => { next.powers[f.power.id].active = false; }); strict.throws(() => f.app.openPlayerReview());
});
test('automatic review is opt in, once per unchanged conversation, and skips quiet or switched chats', async () => {
  const f = setup(); f.app.settings.mode = 'st'; let calls = 0; f.app.reviewArchives = async () => { calls++; };
  f.app.schedulePlayerReview('normal'); await new Promise(r => setTimeout(r, 480)); strict.equal(calls, 0);
  await f.store.transact(next => { next.powers[f.power.id].autoArchiveReview = true; });
  f.app.schedulePlayerReview('quiet'); await new Promise(r => setTimeout(r, 480)); strict.equal(calls, 0);
  f.app.schedulePlayerReview('normal'); await new Promise(r => setTimeout(r, 480)); strict.equal(calls, 1);
  f.app.schedulePlayerReview('normal'); await new Promise(r => setTimeout(r, 480)); strict.equal(calls, 1);
  f.ctx.chat.push({ is_user: false, mes: '自编新的正文已经完成。' }); f.app.schedulePlayerReview('normal'); f.ctx.chatId = 'changed';
  await new Promise(r => setTimeout(r, 480)); strict.equal(calls, 1);
});
test('home shows possibilities, current results and history before advanced tools; empty home needs no form', () => {
  const f = setup(), ui = Object.create(WorkbenchUI.prototype); ui.view = {}; f.power.name = '母巢';
  const empty = ui.management(f.state, f.power, false, 'st', null, f.ctx.chat);
  strict.ok(empty.indexOf('能做什么') < empty.indexOf('现在有什么')); strict.ok(empty.indexOf('现在有什么') < empty.indexOf('最近做过什么'));
  strict.match(empty, /AI 整理当前情况|不用先填写表格/); strict.match(empty, /name="playerNote"/); strict.doesNotMatch(empty, /name="field:/);
  f.power.playerGuide = normalizePlayerGuide({ ...f.guide, summary: '<img src=x>' }, f.power);
  const populated = ui.management(f.state, f.power, false, 'st', null, f.ctx.chat); strict.doesNotMatch(populated, /<img src=x>/); strict.match(populated, /&lt;img/);
  strict.match(archivePrompt(f.power, [], f.ctx.chat, f.note).system, /愿望记录为planned/);
});
