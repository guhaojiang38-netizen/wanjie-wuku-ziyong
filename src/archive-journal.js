// Bounded, one-step undo. No host or controller dependencies.
import { assert, clone, stable, hash } from './primitives.js';
const META = ['archiveReviewed', 'playerGuide', 'lastArchiveUpdate', 'autoArchiveStart'];
const safe = s => typeof s === 'string' && s.length > 0 && s.length <= 200 && !['__proto__','constructor','prototype'].includes(s);
const digest = v => hash(stable(v === undefined ? null : v));
const selections = (state, id) => Object.fromEntries(Object.entries(state.archiveMemory?.selections || {}).filter(([k]) => k.startsWith(id + '/')));
const related = (state,id) => ({ terminalOrders:(state.terminalOrders||[]).filter(o=>o.powerId===id), creations:(state.creations||[]).filter(o=>o.powerId===id), selections:selections(state,id) });
export function journalSnapshot(state, id) {
 const p=state.powers[id]; assert(p,'词条不存在');
 return clone({archives:p.archives||{}, meta:Object.fromEntries(META.map(k=>[k,p[k]??null])), ...related(state,id)});
}
export function validateArchiveUndo(j) {
 if(j===undefined)return;
 assert(j && typeof j==='object' && !Array.isArray(j) && Object.keys(j).every(k=>['label','at','ruleVersion','guard','entries'].includes(k)), '撤销记录格式无效');
 assert(typeof j.label==='string'&&j.label.length<=120&&Number.isSafeInteger(j.at)&&j.at>0&&/^[a-f0-9]{16}$/.test(j.ruleVersion)&&/^[a-f0-9]{16}$/.test(j.guard),'撤销记录标识无效');
 assert(Array.isArray(j.entries)&&j.entries.length>0&&j.entries.length<=2600&&JSON.stringify(j).length<=3000000,'撤销记录过大或为空');
 const seen=new Set();
 for(const e of j.entries){assert(e&&Object.keys(e).every(k=>['kind','id','before','after'].includes(k))&&['archives','meta','terminalOrders','creations','selections'].includes(e.kind)&&safe(e.id)&&/^[a-f0-9]{16}$/.test(e.after)&&Object.hasOwn(e,'before'),'撤销项目无效');assert(e.kind!=='meta'||META.includes(e.id),'撤销字段无效');const k=e.kind+'/'+e.id;assert(!seen.has(k),'撤销项目重复');seen.add(k);}
}
export function saveArchiveUndo(state,id,before,label) {
 const p=state.powers[id],after=journalSnapshot(state,id),entries=[];
 for(const kind of ['archives','meta','terminalOrders','creations','selections']){
  const map=v=>Array.isArray(v)?Object.fromEntries(v.map(o=>[o.id,o])):v;
  const a=map(before[kind]),b=map(after[kind]);
  for(const key of new Set([...Object.keys(a),...Object.keys(b)]))if(digest(a[key])!==digest(b[key]))entries.push({kind,id:key,before:clone(a[key]??null),after:digest(b[key])});
 }
 if(!entries.length)return;
 const journal={label,at:Date.now(),ruleVersion:p.ruleVersion,guard:digest(related(state,id)),entries};validateArchiveUndo(journal);p.archiveUndo=journal;
}
function current(state,id,e){const p=state.powers[id];return e.kind==='meta'?p[e.id]:e.kind==='archives'?p.archives?.[e.id]:e.kind==='selections'?state.archiveMemory?.selections?.[e.id]:state[e.kind]?.find(o=>o.id===e.id);}
export function assertArchiveUndo(state,id) {
 const p=state.powers[id],j=p?.archiveUndo;assert(j,'没有可撤销的整理或纠错');validateArchiveUndo(j);
 assert(j.ruleVersion===p.ruleVersion&&j.guard===digest(related(state,id))&&j.entries.every(e=>digest(current(state,id,e))===e.after),'本次涉及的档案、安排或记忆已有后续变化，不能覆盖；请用一句话纠正当前情况');
 return j;
}
export function undoArchiveUpdate(state,id){
 const j=assertArchiveUndo(state,id),p=state.powers[id];
 for(const e of j.entries){
  if(['archives','meta','selections'].includes(e.kind)){
   const target=e.kind==='meta'?p:e.kind==='archives'?p.archives:state.archiveMemory.selections;
   if(e.before===null)delete target[e.id];else target[e.id]=clone(e.before);
  }else{const rows=state[e.kind]||[],at=rows.findIndex(o=>o.id===e.id);if(e.before===null){if(at>=0)rows.splice(at,1);}else if(at>=0)rows[at]=clone(e.before);else rows.push(clone(e.before));}
 }
 delete p.archiveUndo;return j.label;
}
