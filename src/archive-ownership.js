// Ownership is separate from presentation modules and optional source annotations.
import {assert,clone} from './primitives.js';
import {isMmlc} from './mmlc.js';
import {isTaishi} from './taishi.js';
const nameKey=v=>String(v||'').normalize('NFKC').replace(/\s/g,'').toLowerCase();
export function ownershipContext(state={},power){
 const powers=Object.values(state.powers||{});let budget=14000,omitted=0;
 const otherPowers=[];
 for(const p of powers){if(p.id===power.id)continue;const row={id:p.id,name:p.name,objects:[]};
  for(const r of Object.values(p.archives||{})){if(row.objects.length>=48){omitted++;continue;}const n={name:r.name,type:r.type};const size=JSON.stringify(n).length;if(budget<size){omitted++;continue;}row.objects.push(n);budget-=size;}
  const size=JSON.stringify({id:row.id,name:row.name}).length;if(budget<size){omitted++;continue;}budget-=size;otherPowers.push(row);
 }
 return {currentPower:{id:power.id,name:power.name},otherPowers,omitted,policy:'先确定所属金手指，再在当前词条内部分类。其他金手指和对象仅用于区分归属，不是当前词条资产。未列出不等于不存在。协作不转移所有权。'};
}
export function foreignArchiveOwner(raw,power,state={}){
 const others=Object.values(state.powers||{}).filter(p=>p.id!==power.id),declared=raw?.ownerPowerId;
 if(declared && declared!==power.id)return {id:declared,name:state.powers?.[declared]?.name||'其他或未明归属',reason:'AI标明属于其他金手指'};
 if(!isMmlc(power)&&!isTaishi(power))return null;
 const name=nameKey(raw?.name);if(!name)return null;
 // The goldfinger itself is not an estate; no prose/hash/quote validation here.
 const identity=raw.type==='research'||raw.module==='projects'?[]:others.filter(p=>nameKey(p.name).length>=2&&(name===nameKey(p.name)||name.endsWith(nameKey(p.name))));
 if(identity.length===1)return {id:identity[0].id,name:identity[0].name,reason:'对象名称指向已接入的其他金手指本身'};
 if(declared===power.id)return null; // One person can have distinct, explicit roles in two systems.
 const matches=others.filter(p=>Object.values(p.archives||{}).some(r=>[r.name,...(r.history||[]).map(h=>h.name)].some(n=>nameKey(n)===name)));
 return matches.length?{id:matches.length===1?matches[0].id:'',name:matches.map(p=>p.name).join('／'),reason:'同名对象已记录在其他金手指，未说明漫漫长路中的独立身份'}:null;
}
export function moveArchiveOwnership(state,fromId,id,toId){
 const from=state.powers?.[fromId],to=state.powers?.[toId],record=from?.archives?.[id];
 assert(record&&to?.active&&fromId!==toId,'请选择另一项已接入的金手指');
 to.archives||={};const existing=to.archives[id]||Object.values(to.archives).find(r=>nameKey(r.name)===nameKey(record.name));
 assert(!existing||existing.type===record.type,'目标同名对象类型不同，请先核对类型再更正归属');
 assert(existing||Object.keys(to.archives).length<512,'目标档案已满');
 const moved=clone(record);
 // Preserve dedicated values and original module in history metadata; render current values generically.
 const convert=row=>{if(row.module){row.previousModule=row.module;delete row.module;}if(row.specific){row.previousSpecific=clone(row.specific);delete row.specific;}};
 for(const row of [moved,...moved.history])convert(row);
 moved.ownershipHistory=[...(moved.ownershipHistory||[]),{from:fromId,to:toId,at:Date.now()}];
 assert(moved.ownershipHistory.length<=128,'归属更正记录已满');
 let result=moved;
 if(existing){
  const snapshots=[...moved.history,(({history,...row})=>row)(moved)].map(row=>({...row,id:existing.id,originalArchiveId:row.originalArchiveId||id}));
  assert(existing.history.length+snapshots.length<=1000,'目标档案历史已满');
  result={...clone(existing),history:[...clone(existing.history),...snapshots],ownershipHistory:[...(existing.ownershipHistory||[]),...moved.ownershipHistory]};
 }
 assert(result.ownershipHistory.length<=128,'归属更正记录已满');
 result.ownerPowerId=toId;
 to.archives[result.id]=result;delete from.archives[id];
 for(const p of [from,to]){delete p.archiveUndo;if(p.lastArchiveUpdate)p.lastArchiveUpdate.records=p.lastArchiveUpdate.records.filter(r=>Boolean(p.archives[r.id]));}
 const selections=state.archiveMemory?.selections;if(selections){const old=fromId+'/'+id;if(Object.hasOwn(selections,old)){const next=toId+'/'+result.id;if(!Object.hasOwn(selections,next))selections[next]=selections[old];delete selections[old];}}
 return result;
}
