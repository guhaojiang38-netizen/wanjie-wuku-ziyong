import {assert} from './primitives.js';
export const AI_TASKS=Object.freeze({archive:'整理与自动更新',creation:'拟定新内容',terminal:'终端安排',setup:'世界书初始化',general:'其他核对与建议'});
export function normalizeTaskRoutes(routes={},profiles=[]){
  assert(routes&&typeof routes==='object'&&!Array.isArray(routes)&&Object.keys(routes).every(k=>Object.hasOwn(AI_TASKS,k)),'AI任务分流格式无效');
  return Object.fromEntries(Object.keys(AI_TASKS).map(task=>{
    const id=routes[task]??'';assert(typeof id==='string'&&(!id||profiles.some(p=>p.id===id&&p.mode!=='off')),'任务方案不存在或已关闭：'+AI_TASKS[task]);return [task,id];
  }));
}
// Pure resolution; no credential persistence, fallback billing, or global switch.
export function taskConnection(task,settings,apiKey,profiles=[]){
  assert(Object.hasOwn(AI_TASKS,task),'未知AI任务');
  assert(settings.mode!=='off','异步模型已关闭');
  const id=settings.taskRoutes?.[task]||'',p=id?profiles.find(p=>p.id===id):null;
  assert(!id||p&&p.mode!=='off','指定任务的连接方案已不存在或已关闭，请重新选择');
  return p?{settings:{...settings,...p},apiKey:p.apiKey||'',profileId:id,profileName:p.name,task}:{settings,apiKey,profileId:'',profileName:'当前连接',task};
}
