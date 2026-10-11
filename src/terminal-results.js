import { TERMINAL_PROGRESS } from './state-validation.js';
export { TERMINAL_PROGRESS } from './state-validation.js';
export { validateTerminalProgress } from './state-validation.js';
import { assert, clone, hash, stable, text, archiveText, ARCHIVE_TEXT_FORMAT } from './core.js';
import { isArchiveDialogue, archiveEvidenceText } from './archives.js';
import { resolveArchiveEvidence } from './archive-evidence.js';


const final = status => ['completed', 'failed'].includes(status);
export function terminalDeliveryCurrent(order, _chat) { return Boolean(order?.story); }
export function terminalProgressCurrent(order, _chat) { return Boolean(order?.story&&order?.progress); }
export function terminalReviewOrders(state, power, chat) {
  return (state.terminalOrders||[]).filter(o=>o.powerId===power.id&&o.status==='presented'&&terminalDeliveryCurrent(o,chat)&&(!o.progress||!terminalProgressCurrent(o,chat)||!final(o.progress.status)))
    .slice(0,24).map(o=>({id:o.id,title:o.title,subjects:o.subjects.map(r=>r.name),target:o.target,task:o.task,deliveredAt:o.story.index,progress:o.progress?{status:o.progress.status,summary:o.progress.summary,sourceIndex:o.progress.anchor.index,sourceCurrent:terminalProgressCurrent(o,chat)}:null}));
}
export const TERMINAL_RESULT_PROMPT = `
若terminalOrders非空，额外返回terminalResults:[{orderId:"给定安排id",status:"working/completed/blocked/failed",summary:"正文明确支持的简短进展",sourceIndex:0,quote:"参考片段或简短说明，可省略"}]；没有明确结果返回空数组。只追踪已经交给正文的安排，不另造安排。working表示已开始尚未完成，blocked表示遭遇阻碍且仍可能继续，failed表示正文明确失败，completed表示安排任务明确完成。收到命令、表示打算、准备出发不等于完成；未提到结果时不要猜测或自动视为失败。参考片段用于记录，不要求逐字匹配或包含对象完整名称；根据正文语义判断实际进展。不得把安排文本、context、旧progress、玩家口述作为新结果证据；sourceIndex不得早于deliveredAt，也不得回退已有进度来源。不得在这里提出奖励、扣资源、变量补丁；实际成果仍由changes提取。每项安排最多一条结果，不重复已经记录的结果。`;
export function normalizeTerminalResults(raw, state, power, sources, chat) {
  if(raw===undefined)return [];
  assert(Array.isArray(raw)&&raw.length<=24,'安排结果列表无效');const seen=new Set();
  return raw.map(item=>{
    assert(item&&typeof item==='object'&&!Array.isArray(item)&&Object.keys(item).every(k=>['orderId','status','summary','sourceIndex','quote'].includes(k)),'安排结果包含不允许的操作');
    const o=(state.terminalOrders||[]).find(o=>o.id===item.orderId);
    assert(o&&o.powerId===power.id&&o.status==='presented'&&terminalDeliveryCurrent(o,chat),'安排尚未交正文或来源已变化');
    assert(!seen.has(o.id),'同一安排的结果重复');seen.add(o.id);
    const summary=text(item.summary,1000).trim();assert(Object.hasOwn(TERMINAL_PROGRESS,item.status)&&summary,'安排结果状态或说明无效');
    const evidence=resolveArchiveEvidence(item.sourceIndex,text(item.quote ?? '',4000),sources,'');
    const quote=evidence.quote;
    const recovery=Boolean(o.progress&&!terminalProgressCurrent(o,chat));
    if(o.progress&&!recovery){assert(!final(o.progress.status)||item.status===o.progress.status,'已结束安排不能由AI改回执行中，请另建新安排');assert(evidence.source.index!==o.progress.anchor.index||evidence.source.textHash!==o.progress.anchor.textHash||item.status===o.progress.status,'同一段正文不能重复改判安排状态');}
    const {index,swipeId,length,textHash,format}=evidence.source;
    const progress={status:item.status,summary,quote,anchor:{index,swipeId,length,textHash,...(format?{format}:{})},at:Date.now()};
    return {orderId:o.id,title:o.title,progress,beforeHash:hash(stable(o.progress||null)),recovery};
  });
}
export function applyTerminalResults(state, changes, chosen, powerId, chat) {
  const saved=[];
  for(const i of chosen){
    const c=changes[i];assert(c,'所选安排结果无效');const o=state.terminalOrders?.find(o=>o.id===c.orderId);
    assert(o?.powerId===powerId&&o.status==='presented'&&terminalDeliveryCurrent(o,chat),'安排已变化，请重新整理');
    assert(hash(stable(o.progress||null))===c.beforeHash,'安排结果已经变化，请重新整理');
    assert(terminalProgressCurrent({...o,progress:c.progress},chat),'安排结果的正文证据已变化');
    const equivalent=p=>p&&stable({status:p.status,quote:p.quote,anchor:p.anchor})===stable({status:c.progress.status,quote:c.progress.quote,anchor:c.progress.anchor});
    if(equivalent(o.progress))continue;
    o.resultHistory ||= [];assert(o.resultHistory.length<128,'安排结果历史已满，请导出后整理');
    o.progress=clone(c.progress);o.resultHistory.push(clone(c.progress));saved.push(o);
  }
  return saved;
}

