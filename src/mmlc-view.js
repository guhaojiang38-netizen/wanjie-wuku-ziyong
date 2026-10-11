// Derived views only. No extra store, inferred quantity totals, or name guessing.
import { isMmlc, mmlcModule, MMLC_MODULES } from './mmlc.js';
import { MMLC_CONFIG } from './mmlc-config.js';
import { archiveCurrent, ARCHIVE_FIELDS } from './archives.js';
const normalize = s => String(s || '').normalize('NFKC').trim().toLowerCase();
export function mmlcFacts(record) {
 const definition=MMLC_CONFIG.records.find(d=>d.id===mmlcModule(record));
 if(record.specific?.adapterId===MMLC_CONFIG.id && record.specific.recordId===definition?.id){
  const facts=definition.fields.filter(f=>f.id!=='links'&&record.specific.fields[f.id]).map(f=>({label:f.label,value:record.specific.fields[f.id]}));
  if(facts.length)return facts;
 }
 return Object.entries(record.fields||{}).filter(([,v])=>v).map(([k,v])=>({label:ARCHIVE_FIELDS[record.type]?.[k]||k,value:v}));
}
export function mmlcRelations(power, chat) {
 if(!isMmlc(power))return [];
 const records=Object.values(power.archives||{}).filter(r=>archiveCurrent(r,chat)), aliases=new Map();
 for(const r of records)for(const name of new Set([r.name,...(r.history||[]).map(h=>h.name)].map(normalize))){
  if(!aliases.has(name))aliases.set(name,new Set());aliases.get(name).add(r.id);
 }
 const edges=[];
 for(const r of records){
  if(r.specific?.adapterId!==MMLC_CONFIG.id)continue;
  const names=String(r.specific.fields.links||'').split(/[;；、\n]/).map(normalize).filter(Boolean);
  for(const name of new Set(names)){
   const matches=aliases.get(name);if(matches?.size!==1)continue;
   const id=[...matches][0];if(id===r.id||edges.some(e=>e.from===r.id&&e.to===id))continue;
   edges.push({from:r.id,to:id,text:r.specific.fields.links,source:r.source});
  }
 }
 return edges;
}
export function mmlcLinked(power, chat, id) {
 const ids=new Set(mmlcRelations(power,chat).flatMap(e=>e.from===id?[e.to]:e.to===id?[e.from]:[]));
 return [...ids].map(key=>power.archives[key]);
}
export function mmlcDashboard(power,chat,moduleId=null){
 const all=Object.values(power.archives||{}), valid=all.filter(r=>archiveCurrent(r,chat));
 return MMLC_MODULES.filter(m=>!moduleId||m.id===moduleId).map(m=>({
  ...m,operation:MMLC_CONFIG.operations.find(o=>o.id===m.id),
  stale:all.filter(r=>mmlcModule(r)===m.id&&!archiveCurrent(r,chat)).length,
  records:valid.filter(r=>mmlcModule(r)===m.id).sort((a,b)=>({active:0,working:1,planned:2,ended:3}[a.status]-{active:0,working:1,planned:2,ended:3}[b.status])||b.updatedAt-a.updatedAt)
 }));
}
