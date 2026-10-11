import test from 'node:test';
import strict from 'node:assert/strict';
import { fixture } from './mvu-fixture.js';
import { saveArchive, archiveSource, archiveCurrent } from '../src/archives.js';
import { archiveSources, archivePrompt, normalizeArchiveChanges, applyArchiveChanges } from '../src/archive-review.js';
import { clone, validateState, chatHashes } from '../src/core.js';
import { ModelConnection } from '../src/model.js';

function setup() {
  const f = fixture();
  const r = saveArchive(f.power, { type: 'population', name: '耐寒工蜂', status: 'active', fields: { scale: '一小群', traits: '耐寒', location: '北坡' } }, archiveSource(f.ctx.chat, '人工确认'));
  f.ctx.chat.push({ mes: '耐寒工蜂完成夜视改造，现在具备耐寒和夜视能力。北坡菌毯已铺设完成。', is_user: false });
  const sources = archiveSources(f.ctx.chat, f.state, f.power);
  const raw = { archiveId: r.id, type: 'population', name: '工蜂', status: 'active', fields: { traits: '耐寒、夜视' }, sourceIndex: 1, quote: '耐寒工蜂完成夜视改造', ruleQuote: f.power.rules.slice(0, 12) };
  return { ...f, r, raw, sources };
}
test('incremental object review preserves identity, omitted fields and cumulative provenance', () => {
  const f = setup(), changes = normalizeArchiveChanges({ changes: [f.raw] }, f.power, f.sources, f.ctx.chat);
  strict.equal(changes[0].name, '耐寒工蜂');
  const saved = applyArchiveChanges(f.power, changes, f.sources, new Map([[0, f.r.id]]), f.ctx.chat)[0];
  strict.equal(saved.id, f.r.id); strict.equal(saved.fields.scale, '一小群'); strict.equal(saved.fields.location, '北坡');
  strict.equal(saved.fields.traits, '耐寒、夜视'); strict.equal(saved.history.length, 1); strict.equal(saved.source.anchors.length, 2);
  validateState(f.state); strict.equal(archiveCurrent(saved, f.ctx.chat), true);
  strict.equal(archiveSources(f.ctx.chat, f.state, f.power).some(s => s.index === 1), false);
  f.ctx.chat[1].mes += '耐寒工蜂又增加了搬运能力。';
  const next = archiveSources(f.ctx.chat, f.state, f.power).find(s => s.index === 1); strict.equal(next.content, '耐寒工蜂又增加了搬运能力。');
  strict.equal(archiveCurrent(saved, f.ctx.chat), true);
  f.ctx.chat[0].swipe_id = 1; strict.equal(archiveCurrent(saved, f.ctx.chat), true);
});
test('unchecked changes never advance a partially accepted floor; no-op retries create no duplicates', () => {
  const f = setup(), raw2 = { type: 'environment', name: '北坡菌毯', status: 'active', fields: { changes: '已铺设' }, sourceIndex: 1, quote: '北坡菌毯已铺设完成', ruleQuote: f.raw.ruleQuote };
  const changes = normalizeArchiveChanges({ changes: [f.raw, raw2] }, f.power, f.sources, f.ctx.chat);
  applyArchiveChanges(f.power, changes, f.sources, new Map([[0, f.r.id]]), f.ctx.chat);
  strict.ok(archiveSources(f.ctx.chat, f.state, f.power).some(s => s.index === 1));
  const retry = normalizeArchiveChanges({ changes: [f.raw, raw2] }, f.power, f.sources, f.ctx.chat);
  applyArchiveChanges(f.power, retry, f.sources, new Map([[0, f.r.id], [1, null]]), f.ctx.chat);
  strict.equal(Object.keys(f.power.archives).length, 2); strict.equal(f.power.archives[f.r.id].history.length, 1);
  strict.equal(archiveSources(f.ctx.chat, f.state, f.power).length, 0);
});
test('same normalized name matches existing record; manual alias assignment merges only once', () => {
  const f = setup(), raw = { ...f.raw, archiveId: undefined, name: '耐寒 工蜂' };
  strict.equal(normalizeArchiveChanges({ changes: [raw] }, f.power, f.sources, f.ctx.chat)[0].id, f.r.id);
  raw.name = '北坡蜂群'; const changes = normalizeArchiveChanges({ changes: [raw] }, f.power, f.sources, f.ctx.chat);
  applyArchiveChanges(f.power, changes, f.sources, new Map([[0, f.r.id]]), f.ctx.chat);
  strict.equal(Object.keys(f.power.archives).length, 1); strict.equal(f.power.archives[f.r.id].name, '耐寒工蜂');
});
test('model review queries selected power only and confirmation uses captured chat and revision', async () => {
  const f = setup(); await f.store.transact(next => { next.powers[f.power.id] = clone(f.power); next.historyAnchor = chatHashes(f.ctx.chat); });
  f.app.settings.mode = 'st'; let calls = 0, pending;
  f.app.ui.showArchiveReview = p => { pending = p; };
  f.app.model.request = async prompt => { calls++; strict.match(prompt.user, /耐寒工蜂/); strict.doesNotMatch(prompt.user, /roleContract/); return JSON.stringify({ changes: [f.raw] }); };
  await f.app.reviewArchives(); strict.equal(calls, 1); strict.equal(pending.changes.length, 1); strict.equal(f.replacementCount, 0);
  strict.equal(f.store.read().powers[f.power.id].archives[f.r.id].fields.traits, '耐寒');
  await f.store.transact(next => { next.powers[f.power.id].archives[f.r.id].fields.location = '南坡'; });
  f.app.refresh(); strict.equal(f.app.pendingArchiveReview, null);
  strict.ok(archivePrompt(f.power, f.sources, f.ctx.chat).system.includes('仅返回JSON'));
});
test('archive prompt passes the real ST and independent API adapters without changing their contract', async () => {
  const f = setup(), prompt = archivePrompt(f.power, f.sources, f.ctx.chat);
  f.ctx.generateRaw = async params => {
    strict.equal(typeof params.systemPrompt, 'string'); strict.equal(JSON.parse(params.prompt).task, '核对经营档案变化');
    return JSON.stringify({ changes: [f.raw] });
  };
  f.app.settings.mode = 'st';
  strict.equal(JSON.parse(await f.app.model.request(prompt)).changes[0].archiveId, f.r.id);
  const model = new ModelConnection({ context: () => f.ctx, settings: () => ({ mode: 'custom', baseUrl: 'https://offline.example.test/v1', model: 'fixture', timeoutSeconds: 10, maxTokens: 512, temperature: 0 }), getKey: () => '', fetchImpl: async (_url, options) => {
    const body = JSON.parse(options.body); strict.equal(typeof body.messages[0].content, 'string'); strict.equal(JSON.parse(body.messages[1].content).task, '核对经营档案变化');
    return { ok: true, json: async () => ({ choices: [{ message: { content: '{"changes":[]}' } }] }) };
  } });
  strict.equal(await model.request(prompt), '{"changes":[]}');
});
