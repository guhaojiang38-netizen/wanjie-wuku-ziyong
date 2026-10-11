// Persisted data contract only. No host, controller, UI or model dependencies.
import { assert, text, stable } from './primitives.js';
const object=v=>v&&typeof v==='object'&&!Array.isArray(v);
const identifier=s=>typeof s==='string'&&/^[a-z][a-z0-9_-]{0,63}$/.test(s)&&!['constructor','prototype','__proto__'].includes(s);
export const ARCHIVE_TEXT_FORMAT = 'settlement-v1';
export const ARCHIVE_READ_FORMAT = 'archive-read-v2';
export const CREATION_PROGRESS=Object.freeze({working:'进行中',completed:'已完成',blocked:'受阻',failed:'失败'});
export const TERMINAL_PROGRESS = Object.freeze({ working: '进行中', completed: '已完成', blocked: '受阻', failed: '失败' });
export const TERMINAL_KINDS = Object.freeze({deploy:'种群部署',assign:'弟子分工',transfer:'物资分配',fleet:'舰队安排'});

export function validateSpecific(s){
 if(s===undefined)return;
 assert(object(s)&&Object.keys(s).every(k=>['adapterId','recordId','version','label','labels','fields'].includes(k)),'专用统计结构无效');
 assert(typeof s.adapterId==='string'&&s.adapterId.length<=160&&identifier(s.recordId)&&/^\d+\.\d+\.\d+$/.test(s.version)&&text(s.label,100).trim(),'专用统计身份无效');
 assert(object(s.labels)&&object(s.fields)&&Object.keys(s.labels).length<=16&&Object.keys(s.fields).length>0&&Object.values(s.fields).some(Boolean),'专用统计字段无效');
 for(const [k,v]of Object.entries(s.labels))assert(identifier(k)&&typeof v==='string'&&v.trim()&&v.length<=100,'专用统计标签无效');
 for(const [k,v]of Object.entries(s.fields))assert(Object.hasOwn(s.labels,k)&&typeof v==='string'&&v.length<=4000,'专用统计内容无效');
}

export function validateCreationProgress(o){
 const rows=o.resultHistory||[];assert(Array.isArray(rows)&&rows.length<=128,'拟定进展历史无效');if(o.progress)assert(o.status==='delivered'&&rows.length&&stable(rows.at(-1))===stable(o.progress),'拟定进展缺少历史');assert(!rows.length||o.progress,'拟定历史缺少现状');
 for(const p of rows){assert(p&&Object.keys(p).every(k=>['status','summary','quote','anchor','at','archiveIds'].includes(k))&&Object.hasOwn(CREATION_PROGRESS,p.status)&&typeof p.summary==='string'&&p.summary.trim()&&p.summary.length<=1000&&typeof p.quote==='string'&&p.quote.length<=4000,'拟定进展内容无效');const a=p.anchor;assert(a&&Object.keys(a).every(k=>['index','swipeId','length','textHash','format'].includes(k))&&Number.isSafeInteger(a.index)&&a.index>=0&&Number.isSafeInteger(a.swipeId)&&a.swipeId>=0&&Number.isSafeInteger(a.length)&&a.length>=0&&/^[a-f0-9]{16}$/.test(a.textHash)&&(!a.format||a.format===ARCHIVE_TEXT_FORMAT||a.format===ARCHIVE_READ_FORMAT)&&Number.isSafeInteger(p.at)&&p.at>0,'拟定进展来源无效');assert(Array.isArray(p.archiveIds)&&p.archiveIds.length<=8&&new Set(p.archiveIds).size===p.archiveIds.length&&p.archiveIds.every(id=>typeof id==='string'&&id.length<=200)&&(p.status!=='completed'||p.archiveIds.length),'拟定关联成果无效');}
}

export function validateTerminalProgress(order) {
  const history=order.resultHistory||[];assert(Array.isArray(history)&&history.length<=128,'安排结果历史无效');
  if(order.progress)assert(order.status==='presented'&&history.length&&stable(history.at(-1))===stable(order.progress),'安排结果缺少对应历史');
  assert(!history.length||order.progress,'安排结果历史缺少现状');
  for(const p of history){
    assert(p&&typeof p==='object'&&Object.keys(p).every(k=>['status','summary','quote','anchor','at'].includes(k))&&Object.hasOwn(TERMINAL_PROGRESS,p.status)&&text(p.summary,1000).trim()&&typeof p.quote==='string'&&p.quote.length<=4000,'安排结果内容无效');
    const a=p.anchor;assert(a&&Object.keys(a).every(k=>['index','swipeId','length','textHash','format'].includes(k))&&Number.isSafeInteger(a.index)&&a.index>=0&&Number.isSafeInteger(a.swipeId)&&a.swipeId>=0&&Number.isSafeInteger(a.length)&&a.length>=0&&/^[a-f0-9]{16}$/.test(a.textHash)&&(!a.format||a.format===ARCHIVE_TEXT_FORMAT||a.format===ARCHIVE_READ_FORMAT),'安排结果来源无效');
    assert(Number.isSafeInteger(p.at)&&p.at>0,'安排结果对象或时间无效');
  }
}

export function validateCreations(state){
 if(state.creations===undefined)return;
 assert(Array.isArray(state.creations)&&state.creations.length<=1000,'拟定内容数量无效');const ids=new Set();
 for(const o of state.creations){
  assert(o&&typeof o.id==='string'&&!ids.has(o.id)&&['queued','delivered','cancelled'].includes(o.status),'拟定内容状态无效');ids.add(o.id);validateCreationProgress(o);if(o.operationDigest!==undefined)assert(/^[a-f0-9]{16}$/.test(o.operationDigest),'拟定操作版本无效');
  assert(state.transactions.some(t=>t.id===o.id&&t.powerId===o.powerId&&t.type==='creation'),'拟定内容缺少采用记录');
  for(const [k,max] of Object.entries({goal:1500,title:120,content:6000,conditions:2000,ruleQuote:1200}))assert(typeof o[k]==='string'&&o[k].trim()&&o[k].length<=max,'拟定内容无效');
  assert(/^[a-f0-9]{16}$/.test(o.ruleVersion)&&(o.adapterDigest===null||/^[a-f0-9]{16}$/.test(o.adapterDigest))&&typeof o.operationId==='string'&&Number.isSafeInteger(o.createdAt)&&o.createdAt>0,'拟定内容版本无效');
  assert(o.sourceHashes&&typeof o.sourceHashes==='object'&&!Array.isArray(o.sourceHashes)&&Object.keys(o.sourceHashes).length<=24&&Object.values(o.sourceHashes).every(h=>/^[a-f0-9]{16}$/.test(h)),'拟定依据无效');
  if(o.status==='delivered')assert(o.story&&Number.isSafeInteger(o.story.index)&&o.story.index>=0&&Number.isSafeInteger(o.story.swipeId)&&o.story.swipeId>=0&&Number.isSafeInteger(o.story.length)&&o.story.length>0&&/^[a-f0-9]{16}$/.test(o.story.textHash),'拟定正文位置无效');
 }
}

export function validateTerminalState(state){
 state.terminalOrders ||= [];assert(Array.isArray(state.terminalOrders)&&state.terminalOrders.length<=1000,'终端安排数量无效');const seen=new Set();
 for(const o of state.terminalOrders){assert(o&&typeof o.id==='string'&&!seen.has(o.id)&&Object.hasOwn(TERMINAL_KINDS,o.kind)&&['queued','presented','cancelled'].includes(o.status),'终端安排状态无效');seen.add(o.id);assert(state.transactions.some(t=>t.id===o.id&&t.powerId===o.powerId),'终端安排缺少确认记录');assert(text(o.title,120)&&text(o.target,300)&&text(o.task,2000)&&text(o.ruleQuote,1200),'终端安排内容无效');assert(Array.isArray(o.subjectIds)&&o.subjectIds.length>0&&o.subjectIds.length<=8&&Array.isArray(o.subjects)&&o.subjects.length===o.subjectIds.length&&new Set(o.subjectIds).size===o.subjectIds.length,'终端安排参与对象无效');for(const r of o.subjects)assert(o.subjectIds.includes(r.id)&&text(r.name,200)&&r.fields&&typeof r.fields==='object','终端对象快照无效');assert(Number.isSafeInteger(o.createdAt)&&o.createdAt>0,'终端安排时间无效');if(o.story)assert(Number.isSafeInteger(o.story.index)&&o.story.index>=0&&Number.isSafeInteger(o.story.swipeId)&&o.story.swipeId>=0&&typeof o.story.textHash==='string','终端正文位置无效');if(o.status==='presented')assert(o.story,'终端安排缺少正文');validateTerminalProgress(o);}
}
