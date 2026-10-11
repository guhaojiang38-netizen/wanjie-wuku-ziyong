import test from 'node:test';
import strict from 'node:assert/strict';
import { fixture } from './mvu-fixture.js';
import { saveArchive, archiveSource, archiveCurrent } from '../src/archives.js';
import { clone, validateState, buildInjection, chatHashes, MODULE_ID } from '../src/core.js';
import { WorkbenchUI, requiresFormValidation } from '../src/ui.js';

const input = { type: 'population', name: '耐寒工蜂', status: 'active', fields: { scale: '一小群', traits: '耐寒', location: '北坡' } };
test('one population keeps its identity, qualitative scale and complete previous state after repeated edits', () => {
  const f = fixture(), source = archiveSource(f.ctx.chat, '玩家核对种群');
  const first = saveArchive(f.power, input, source), id = first.id;
  const second = saveArchive(f.power, { ...input, id, fields: { ...input.fields, traits: '耐寒、夜视' } }, source);
  const third = saveArchive(f.power, { ...input, id, status: 'working', fields: { scale: '数十只', traits: '耐寒、夜视' } }, source);
  strict.equal(Object.keys(f.power.archives).length, 1); strict.equal(third.id, id); strict.equal(third.history.length, 2);
  strict.equal(second.history[0].fields.scale, '一小群'); strict.equal(third.history[1].fields.traits, '耐寒、夜视');
  strict.equal(third.fields.purpose, ''); strict.equal(Object.keys(f.power.assets).length, 0);
  strict.equal(validateState(f.state).powers[f.power.id].archives[id].fields.scale, '数十只');
  strict.throws(() => saveArchive(f.power, { ...input, name: '耐寒 工蜂' }, source), /同名档案/);
});
test('plans remain separate, invalid values fail and edited or swiped provenance is quarantined', () => {
  const f = fixture(), source = archiveSource(f.ctx.chat, '人工确认');
  const r = saveArchive(f.power, { ...input, status: 'planned' }, source);
  strict.equal(r.status, 'planned'); strict.equal(archiveCurrent(r, f.ctx.chat), true);
  f.ctx.chat.push({ is_user: true, mes: '继续探索' }); strict.equal(archiveCurrent(r, f.ctx.chat), true);
  f.ctx.chat[0].swipe_id = 1; strict.equal(archiveCurrent(r, f.ctx.chat), true);
  f.ctx.chat[0].swipe_id = 0; f.ctx.chat[0].mes += '旧层续写'; strict.equal(archiveCurrent(r, f.ctx.chat), true);
  f.ctx.chat[0].mes = '改写原始正文'; strict.equal(archiveCurrent(r, f.ctx.chat), true);
  strict.throws(() => saveArchive(f.power, { ...input, name: '空档案', fields: {} }, source), /至少一项/);
  strict.throws(() => saveArchive(f.power, { ...input, type: '__proto__' }, source));
  const broken = clone(f.state); broken.powers[f.power.id].archives[r.id].history.push({ ...clone(r), history: [] });
  strict.throws(() => validateState(broken), /不可嵌套/);
});
test('old backups gain empty archive storage without modifying or converting their old records', () => {
  const f = fixture(); const before = clone(f.state); delete before.powers[f.power.id].archives;
  const migrated = validateState(before); strict.deepEqual(migrated.powers[f.power.id].archives, {});
  const restored = clone(migrated); restored.powers[f.power.id].archives.bad = { id: 'bad', type: 'population', name: '伪造', status: 'active', fields: { scale: '一群' }, updatedAt: 1, source: { type: 'manual', note: '' }, history: [] };
  strict.throws(() => validateState(restored), /来源/);
});
