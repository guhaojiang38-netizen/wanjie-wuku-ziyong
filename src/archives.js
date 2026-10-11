import {moveArchiveOwnership} from './archive-ownership.js';
import { journalSnapshot, saveArchiveUndo } from './archive-journal.js';
import { validateSpecific } from './state-validation.js';
import { specificDiff } from './specific-values.js';
import { assert, clone, key, text, uid, hash, stable, storyText, archiveText, archiveReadText, ARCHIVE_READ_FORMAT, ARCHIVE_TEXT_FORMAT } from './core.js';
import { getContext } from './host.js';
import { isMmlc, mmlcModule, MMLC_MODULES } from './mmlc.js';
import { managementProfile } from './management-profiles.js';

export const ARCHIVE_TYPES = Object.freeze({ population: '种群', environment: '环境区域', facility: '设施', research: '研究项目', member: '成员与分身', skill: '成长与技艺', bond: '关系与契约', record: '其他成果' });
export const ARCHIVE_STATUS = Object.freeze({ active: '已建立', planned: '计划中', working: '进行中', ended: '已结束' });
export const ARCHIVE_FIELDS = Object.freeze({
  population: { scale: '数量或规模', traits: '特性与改造', purpose: '用途', location: '所在区域', limits: '条件与限制' },
  environment: { location: '位置', changes: '已完成改造', conditions: '生态条件', scale: '覆盖范围', related: '关联种群与设施' },
  facility: { purpose: '功能', location: '位置', scale: '容量或规模', condition: '运行情况', limits: '条件与限制' },
  research: { goal: '研究目标', progress: '当前进展', outcome: '已取得成果', limits: '未解决条件' },
  member: { role: '身份与职责', traits: '已有能力与特性', location: '所在位置与部署', condition: '当前状况', limits: '条件与限制' },
  skill: { level: '已达程度', progress: '当前进展', effect: '已掌握效果', limits: '未解决条件' },
  bond: { participants: '关联人物', terms: '已成立条款', obligations: '双方义务', condition: '履行情况', limits: '条件与限制' },
  record: { description: '当前完整情况', limits: '条件与限制' },
});
export const isMotherNest = power => /母巢/.test(power?.name || '');
export function archivePanel(power) {
  if (isMotherNest(power)) return { title: '母巢概览', defaultType: 'population' };
  const p = managementProfile(power);
  return p.verified && ({ domain: { title: '领域概览', defaultType: 'environment' }, member: { title: '成员概览', defaultType: 'member' }, growth: { title: '成长概览', defaultType: 'skill' }, relationship: { title: '契约概览', defaultType: 'bond' } })[p.family] || { title: '当前成果', defaultType: 'record' };
}
export function sceneArchiveContext(power, chat, query = '') {
  const all = Object.values(power.archives || {}), valid = all.filter(r => archiveCurrent(r, chat));
  const q = query.normalize('NFKC').toLowerCase(), items = []; let used = 0;
  const score = r => q.includes(r.name.normalize('NFKC').toLowerCase()) ? 2 : r.fields.location && q.includes(r.fields.location.toLowerCase()) ? 1 : 0;
  for (const r of [...valid].sort((a, b) => score(b) - score(a) || b.updatedAt - a.updatedAt || a.id.localeCompare(b.id))) {
    const item = { id: r.id, name: r.name, type: r.type, status: r.status, fields: clone(r.fields),...(r.specific?{specific:clone(r.specific)}:{}) }, size = JSON.stringify(item).length;
    if (items.length >= 24 || used + size > 16000) continue;
    items.push(item); used += size;
  }
  return { items, validTotal: valid.length, omittedCount: valid.length - items.length, excludedStaleCount: all.length - valid.length };
}
const normalizedName = name => name.normalize('NFKC').replace(/\s/g, '').toLowerCase();
export const archiveNames = record => [...new Set([record.name, ...(record.history || []).map(r=>r.name)].map(normalizedName))];
export function findArchiveObject(power, name, module) {
  const matches = Object.values(power.archives || {}).filter(r=>archiveNames(r).includes(normalizedName(name)));
  assert(matches.length <= 1, `「${name}」当前名或旧名对应多个档案；请重新AI整理并明确原archiveId，不会自动合并`);
  const found = matches[0];
  assert(!found || !isMmlc(power) || !module || module===mmlcModule(found), `「${name}」与原档案模块归属不同；请重新AI整理并明确原archiveId，不会另建重复对象`);
  return found;
}
const archiveFacts = r => ({ownerPowerId:r.ownerPowerId||null,name:r.name,type:r.type,status:r.status,fields:r.fields,module:r.module||null,...(r.specific?{specific:{adapterId:r.specific.adapterId,recordId:r.specific.recordId,fields:r.specific.fields}}:{})});
export const archiveStamp = r => hash(stable({ ...archiveFacts(r), source:r.source }));
export function saveArchiveUpdate(power, before, saved, sources, {automatic=false, arrangements=0, chat=[]} = {}) {
  const records = saved.filter(r=>!before[r.id] || stable(archiveFacts(before[r.id]))!==stable(archiveFacts(r)) || !archiveCurrent(before[r.id],chat)).map(r=>({id:r.id,signature:archiveStamp(r),kind:!before[r.id]?'created':!archiveCurrent(before[r.id],chat)?'recovered':'updated'}));
  power.lastArchiveUpdate = { at:Date.now(), automatic, arrangements, sourceIndices:[...new Set(sources.map(s=>s.index))], records };
}
export function archiveUpdateSummary(power, chat, module = null) {
  const batch = power.lastArchiveUpdate; if (!batch) return null;
  const rows = []; let unavailable = 0;
  for (const entry of batch.records) {
    const r=power.archives?.[entry.id];
    if (!r || archiveStamp(r)!==entry.signature || !archiveCurrent(r,chat)) { unavailable++; continue; }
    if (module && mmlcModule(r)!==module) continue;
    const old=entry.kind==='created'?null:r.history.at(-1);
    const fields=Object.keys(ARCHIVE_FIELDS[r.type]).filter(k=>entry.kind!=='updated'?r.fields[k]:r.fields[k]!==old?.fields[k]);
    rows.push({id:r.id,name:r.name,status:r.status,kind:entry.kind,previousStatus:old?.status,previousName:old?.name,details:fields.map(k=>({label:ARCHIVE_FIELDS[r.type][k],value:r.fields[k]||'已清空',before:old?.fields[k]||'未登记'})).concat(specificDiff(old?.specific,r.specific).map(f=>({...f,value:f.value||'已清空',before:f.before||'未登记'})))});
  }
  return { ...batch, rows, unavailable };
}
// Saved order is archival history, not inferred in-world time. Source-only checks are not growth.
export function archiveJourney(record, chat) {
  const snapshots = [...(record.history || []), record], entries = []; let rechecks = 0;
  for (const [index, row] of snapshots.entries()) {
    const before = snapshots[index - 1];
    if (before && stable(archiveFacts(before)) === stable(archiveFacts(row))) { rechecks++; continue; }
    const fields = Object.keys(ARCHIVE_FIELDS[row.type]).filter(k => before ? row.fields[k] !== before.fields[k] : row.fields[k]);
    entries.push({ name:row.name, type:row.type, status:row.status, at:row.updatedAt,
      first:!before, current:archiveCurrent(row,chat), source:row.source,
      previousName:before?.name, previousStatus:before?.status,
      previousModule:before?.module, module:row.module,
      changes:fields.map(k=>({label:ARCHIVE_FIELDS[row.type][k],before:before?.fields[k]||'',value:row.fields[k]||''})).concat(specificDiff(before?.specific,row.specific)) });
  }
  return { entries:entries.reverse(), first:snapshots[0], rechecks, current:archiveCurrent(record,chat) };
}
export function archiveEvidenceText(value, anchor = {}) {
  return anchor.format === ARCHIVE_READ_FORMAT ? archiveReadText(value) : anchor.format === ARCHIVE_TEXT_FORMAT ? archiveText(value) : storyText(value);
}
// BaiBai hidden originals remain dialogue; ordinary system messages do not.
export const isArchiveDialogue = message => Boolean(message && !message.is_user && (!message.is_system || message.extra?.bbs_hidden === true));
// Saved records are player data. Source metadata never expires or hides them.
export function archiveCurrent(record, _chat) { return Boolean(record); }
export function archiveSource(chat, note) {
  const index = chat.findLastIndex(isArchiveDialogue);
  const m = chat[index];
  const body = storyText(m?.mes ?? m?.content ?? '');
  return { type: 'manual', note, anchor: m ? { index, swipeId: m.swipe_id ?? 0, length: body.length, textHash: hash(body) } : null };
}
export function saveArchive(power, input, source) {
  const type = key(input.type), name = text(input.name, 200).trim(), status = input.status;
  assert(Object.hasOwn(ARCHIVE_TYPES, type) && Object.hasOwn(ARCHIVE_STATUS, status) && name, '请填写档案类型、名称和状态');
  power.archives ||= {};
  const previous = input.id ? power.archives[key(input.id)] : null;
  assert(!input.id || previous, '档案不存在');
  assert(!previous || previous.type === type, '已有档案不能改换类型');
  if (!previous || normalizedName(previous.name)!==normalizedName(name)) assert(!Object.values(power.archives).some(r => r.id !== previous?.id && archiveNames(r).includes(normalizedName(name))), '已有同名档案（含旧名档案），请编辑原对象，避免重复统计');
  assert(previous || Object.keys(power.archives).length < 512, '单词条档案超过512项，请先导出整理');
  const fields = Object.fromEntries(Object.keys(ARCHIVE_FIELDS[type]).map(k => [k, text(input.fields?.[k] || '', 4000).trim()]));
  assert(Object.values(fields).some(Boolean), '请填写至少一项实际情况；未明确的字段可以留空');
  const at = Date.now(), id = previous?.id || uid('archive');
  const module = isMmlc(power) ? input.module ?? mmlcModule(previous || { type, name }) : undefined;
  assert(!module || MMLC_MODULES.some(m => m.id === module), '漫漫长路模块归属无效');
  const originalSpecific=input.specific===undefined?previous?.specific:input.specific,specific=originalSpecific===undefined?undefined:clone(originalSpecific);validateSpecific(specific);
   const next = { ...((input.ownerPowerId||previous?.ownerPowerId)?{ownerPowerId:input.ownerPowerId||previous.ownerPowerId}:{}),...(previous?.ownershipHistory?{ownershipHistory:clone(previous.ownershipHistory)}:{}),...(previous?.previousModule?{previousModule:previous.previousModule}:{}),...(previous?.previousSpecific?{previousSpecific:clone(previous.previousSpecific)}:{}), id, type, name, status, fields, ...(specific?{specific}:{}), source: clone(source), updatedAt: at, ...(module ? { module } : {}) };
  if (previous && (!isMmlc(power) || module === mmlcModule(previous)) && stable({ name, status, fields, source,specific }) === stable({ name: previous.name, status: previous.status, fields: previous.fields, source: previous.source,specific:previous.specific })) return previous;
  const history = clone(previous?.history || []);
  assert(history.length < 1000, '此档案历史超过1000次，请导出整理后再操作');
  if (previous) { const { history: _history, ...snapshot } = previous; history.push(snapshot); }
  power.archives[id] = { ...next, history };
  return power.archives[id];
}
export const archiveMethods = {
  openArchive(id = null) {
    const snapshot = this.ensureStable(), power = snapshot.state.powers[this.powerId];
    assert(power?.active, '请先选择已启用的金手指');
    const record = id ? power.archives?.[id] : null;
    assert(!id || record, '档案不存在');
    this.archiveDraft = { powerId: power.id, id, contextHash: hash(stable(snapshot.hashes)), captured: { chatKey: snapshot.chatKey, stateId: snapshot.state.id, revision: snapshot.state.revision } };
    this.ui.showArchive(power, record, getContext().chat, snapshot.state);
  },
  async moveArchive(data) {
    assert(!this.busy&&!this.mainBusy&&!this.committing,'请等待当前操作完成');
    const draft=this.archiveDraft;assert(draft?.id,'请重新打开需要更正归属的档案');this.ensureStable();
    const targetId=key(data.values?.targetPowerId);this.committing=true;this.refresh();
    try{
      await this.store.transact(next=>{
        const moved=moveArchiveOwnership(next,draft.powerId,draft.id,targetId);
        this.record(next,'更正成果所属金手指',[moved.name,next.powers[draft.powerId].name+' → '+next.powers[targetId].name],'archive',targetId);
      },{captured:draft.captured});
      this.archiveDraft=null;this.ui.closeDialog();this.notice('已更正归属，内容和历史保留；后续从对应金手指查看。');
    }finally{this.committing=false;this.refresh();}
  },
  async saveArchive(data) {
    assert(!this.busy && !this.mainBusy && !this.committing, '请等待当前操作完成');
    const draft = this.archiveDraft; assert(draft, '档案表单已失效，请重新打开');
    const snapshot = this.ensureStable();
    const v = data.values, note = text(v.note || '玩家核对当前实际情况', 600).trim();
    assert(note, '请填写核对依据');
    this.committing = true; this.refresh();
    try {
      await this.store.transact(next => {
        const power = next.powers[draft.powerId]; assert(power?.active, '金手指接入已变化');
        const fields = Object.fromEntries(Object.keys(ARCHIVE_FIELDS[v.type] || {}).map(k => [k, v[`field:${k}`] || '']));
        const undoBefore=journalSnapshot(next,power.id);
        const before = { ...power.archives };
        const old=power.archives?.[draft.id],specific=old?.specific?clone(old.specific):undefined;if(specific)for(const k of Object.keys(specific.fields))if(Object.hasOwn(v,'specific:'+k))specific.fields[k]=text(v['specific:'+k],4000).trim();
        const record = saveArchive(power, { id: draft.id, type: v.type, name: v.name, status: v.status, ownerPowerId:power.id, fields,...(specific?{specific}:{}) }, archiveSource(getContext().chat, note));
        saveArchiveUpdate(power,before,[record],[],{chat:getContext().chat});
        saveArchiveUndo(next,power.id,undoBefore,'手工纠错');
        this.record(next, `${power.name} · ${draft.id ? '更新' : '建立'}${ARCHIVE_TYPES[record.type]}`, [record.name, ARCHIVE_STATUS[record.status]], 'archive', power.id);
      }, { captured: draft.captured });
      this.archiveDraft = null; this.ui.closeDialog(); this.notice('档案已保存。');
    } finally { this.committing = false; this.refresh(); }
  },
};
