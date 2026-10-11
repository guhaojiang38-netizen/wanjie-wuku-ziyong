import { CREATION_PROGRESS } from './state-validation.js';
export { CREATION_PROGRESS } from './state-validation.js';
export { validateCreationProgress } from './state-validation.js';
import {assert,clone,hash,stable,text,ARCHIVE_TEXT_FORMAT} from './core.js';
import {archiveCurrent,findArchiveObject} from './archives.js';
import {resolveArchiveEvidence} from './archive-evidence.js';
import {terminalDeliveryCurrent} from './terminal-results.js';

const final=s=>['completed','failed'].includes(s);
export function creationProgressCurrent(item,chat){return Boolean(terminalDeliveryCurrent(item,chat)&&item.progress&&archiveCurrent({source:{anchor:item.progress.anchor}},chat));}
export function creationReviewItems(state,power,chat){return (state.creations||[]).filter(o=>o.powerId===power.id&&o.status==='delivered'&&o.ruleVersion===power.ruleVersion&&terminalDeliveryCurrent(o,chat)&&(!o.progress||!creationProgressCurrent(o,chat)||!final(o.progress.status))).slice(0,24).map(o=>({id:o.id,title:o.title,goal:o.goal,content:o.content,deliveredAt:o.story.index,progress:o.progress||null}));}
export const CREATION_RESULTS_PROMPT=`
若creationItems非空，可额外返回creationResults:[{creationId:"拟定id",status:"working/completed/blocked/failed",summary:"本次实际进展",sourceIndex:0,quote:"参考片段或简短说明，可省略",archiveRefs:[{changeIndex:0}或{archiveId:"已有档案id"}]}]。creationItems是已交给正文的拟议设计，不是事实证据。只根据sources识别确实发生的进展，不从拟定文本补结果。参考片段可以省略，不要求逐字匹配；根据本次正文语义关联成果及进展。完成必须关联至少一个active成果；开始尝试仅working，条件不够为blocked，明确失败才failed。archiveRefs只能引用本批changes的数组序号（从0开始）或current已有的档案id；不能引用其他词条或新造id。关联对象必须直接体现该设计实际推进/完成的结果，不把无关已有能力关联进来凑完成。引用新变化时采用该变化原始数组序号，不是楼层号。未出现明确进展不返回；每项最多一个结果，不重报已结束结果。`;
export function normalizeCreationResults(raw,state,power,sources,chat,changes){
 if(raw===undefined)return [];assert(Array.isArray(raw)&&raw.length<=24,'拟定进展列表无效');const seen=new Set();
 return raw.map(item=>{
  assert(item&&Object.keys(item).every(k=>['creationId','status','summary','sourceIndex','quote','archiveRefs'].includes(k)),'拟定进展包含不允许的操作');
  const o=state.creations?.find(o=>o.id===item.creationId);assert(o&&o.powerId===power.id&&o.status==='delivered'&&o.ruleVersion===power.ruleVersion&&terminalDeliveryCurrent(o,chat),'拟定尚未交正文，或规则/对应正文已变化');assert(!seen.has(o.id),'拟定进展重复');seen.add(o.id);
  assert(Object.hasOwn(CREATION_PROGRESS,item.status)&&typeof item.summary==='string'&&item.summary.trim()&&item.summary.length<=1000,'拟定进展状态或说明无效');
  const e=resolveArchiveEvidence(item.sourceIndex,text(item.quote ?? '',4000),sources,'');
  assert(Array.isArray(item.archiveRefs)&&item.archiveRefs.length<=8,'关联成果列表无效');const ids=new Set();
  const refs=item.archiveRefs.map(ref=>{
   assert(ref&&typeof ref==='object'&&!Array.isArray(ref)&&Object.keys(ref).length===1,'关联成果格式无效');let r,normalized;
   if(Object.hasOwn(ref,'changeIndex')){assert(Number.isSafeInteger(ref.changeIndex)&&ref.changeIndex>=0,'关联变化序号无效');r=changes.find(c=>c.inputIndex===ref.changeIndex);assert(r,'关联变化不存在');normalized={changeIndex:changes.indexOf(r)};}
   else {assert(typeof ref.archiveId==='string','关联档案ID无效');r=power.archives?.[ref.archiveId];assert(r,'关联成果不存在或来源无效');normalized={archiveId:r.id};}
   const names=[r.name,r.before?.name,...(r.history||r.before?.history||[]).map(h=>h.name)].filter(Boolean);assert(item.status!=='completed'||r.status==='active','完成不能关联计划或未完成成果');const id=stable(normalized);assert(!ids.has(id),'关联成果重复');ids.add(id);return normalized;
  });
  assert(item.status!=='completed'||refs.length,'完成必须关联实际已建立成果');
  const recovery=Boolean(o.progress&&!creationProgressCurrent(o,chat));
  if(o.progress&&!recovery){assert(!final(o.progress.status)||item.status===o.progress.status,'已结束拟定不能改回进行中');assert(e.source.index!==o.progress.anchor.index||e.source.textHash!==o.progress.anchor.textHash||item.status===o.progress.status,'同一正文不能重复改判拟定状态');}
  const {index,swipeId,length,textHash,format}=e.source;
  return {creationId:o.id,title:o.title,refs,recovery,beforeHash:hash(stable(o.progress||null)),progress:{status:item.status,summary:item.summary.trim(),quote:e.quote,anchor:{index,swipeId,length,textHash,...(format?{format}:{})},at:Date.now()}};
 });
}
export function applyCreationResults(state,changes,chosen,power,archiveChanges,archiveChosen,chat){
 const saved=[];for(const i of chosen){const c=changes[i],o=state.creations?.find(o=>o.id===c?.creationId);assert(o?.powerId===power.id&&o.status==='delivered'&&o.ruleVersion===power.ruleVersion&&terminalDeliveryCurrent(o,chat)&&hash(stable(o.progress||null))===c.beforeHash,'拟定进展已变化，请重新整理');assert(archiveCurrent({source:{anchor:c.progress.anchor}},chat),'拟定进展正文已变化');
  const archiveIds=c.refs.map(ref=>{if(ref.archiveId)return ref.archiveId;assert(archiveChosen.has(ref.changeIndex),'关联成果尚未接受');const ac=archiveChanges[ref.changeIndex],target=archiveChosen.get(ref.changeIndex);return target||findArchiveObject(power,ac.name,ac.module)?.id;});
  assert(archiveIds.every(id=>power.archives[id]&&archiveCurrent(power.archives[id],chat)&&(c.progress.status!=='completed'||power.archives[id].status==='active')),'关联成果已变化');
  const progress={...clone(c.progress),archiveIds:[...new Set(archiveIds)]};const equal=p=>p&&stable({status:p.status,quote:p.quote,anchor:p.anchor,archiveIds:p.archiveIds})===stable({status:progress.status,quote:progress.quote,anchor:progress.anchor,archiveIds:progress.archiveIds});if(equal(o.progress))continue;
  o.resultHistory||=[];assert(o.resultHistory.length<128,'拟定进展历史已满，请先导出整理');o.progress=progress;o.resultHistory.push(clone(progress));saved.push(o);
 }return saved;
}

