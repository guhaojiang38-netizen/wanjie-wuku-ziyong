import { isMmlc, mmlcModule } from './mmlc.js';
export { specificRows, specificDiff } from './specific-values.js';
import { validateSpecific } from './state-validation.js';
export { validateSpecific } from './state-validation.js';
import {assert,clone,stable,text} from './core.js';
import {creationConfig} from './creation-config.js';
import {archiveCurrent} from './archives.js';
const object=v=>v&&typeof v==='object'&&!Array.isArray(v);

export function normalizeSpecific(raw,power,before,{recovery=false}={}){
 if(isMmlc(power)&&before?.specific)assert((raw.module||mmlcModule(before))===before.specific.recordId,'已有漫漫长路专用档案不能自动改换模块身份');
 if(raw.recordId===undefined&&raw.details===undefined){assert(!recovery||!before?.specific,'旧专用统计来源失效，需AI重新确认专用字段');return before?.specific?clone(before.specific):undefined;}
 const config=creationConfig(power),definition=config?.records.find(r=>r.id===raw.recordId);
 assert(definition&&object(raw.details)&&Object.keys(raw.details).length&&Object.keys(raw.details).every(k=>definition.fields.some(f=>f.id===k)),'专用统计分类或字段不在当前适配声明中');
 assert(!before?.specific||before.specific.adapterId===config.id&&before.specific.recordId===definition.id,'已有对象不能自动换成另一种专用统计身份');
 if(isMmlc(power))assert(definition.id===(raw.module||mmlcModule(before||raw)),'漫漫长路专用字段必须归入同一个模块');
 const patch={};for(const [k,v]of Object.entries(raw.details)){assert(typeof v==='string'&&v.length<=4000,'专用统计只接收正文中的文字，不推算数值');patch[k]=v.trim();}
 if(recovery)assert(Object.entries(before?.specific?.fields||{}).every(([k,v])=>!v||patch[k]),'旧专用统计来源失效，需AI从当前正文重新确认全部已有字段');
 const fields=recovery?patch:{...before?.specific?.fields,...patch};
 const labels={...before?.specific?.labels,...Object.fromEntries(definition.fields.map(f=>[f.id,f.label]))};
 const result={adapterId:config.id,recordId:definition.id,version:config.version,label:definition.label,labels,fields};validateSpecific(result);return result;
}


export function specializedGroups(power,chat){
 const groups=new Map();for(const r of Object.values(power.archives||{})){if(!r.specific)continue;const id=r.specific.adapterId+'/'+r.specific.recordId;if(!groups.has(id))groups.set(id,{id,label:r.specific.label,records:[],active:0,working:0,planned:0,stale:0});const g=groups.get(id);g.records.push(r);if(!archiveCurrent(r,chat))g.stale++;else if(Object.hasOwn(g,r.status))g[r.status]++;}
 return [...groups.values()];
}

// Optional data-declared overview; no entry-name branches or new storage.
export function statisticsDashboard(power,chat){
 const config=creationConfig(power);if(!config?.dashboard)return null;
 const sections=config.dashboard.sections.map(section=>{
  const records=Object.values(power.archives||{}).filter(r=>r.specific?.adapterId===config.id&&section.recordIds.includes(r.specific.recordId));
  const counts={active:0,working:0,planned:0,ended:0,stale:0};for(const r of records){if(!archiveCurrent(r,chat))counts.stale++;else counts[r.status]++;}
  return {...section,records,counts};
 });
 return {...config.dashboard,adapterId:config.id,sections};
}
