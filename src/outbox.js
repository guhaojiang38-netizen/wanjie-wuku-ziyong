import { creationCurrent, creationQueue } from './creation.js';
import { terminalQueue } from './terminal.js';

// Derived view only. No second queue, persisted settings or generation task.
export function outboxSummary(state, chat, { bridge = true } = {}) {
  const pendingWrite = state.roleWrites.some(w => w.status === 'pending');
  const blocked = pendingWrite ? '有角色变量等待同步，处理完成后才能带入。' : !bridge ? '当前正文连接缺少承接接口；内容仍保留，恢复连接后再发送。' : '';
  const creations = creationQueue(state, chat), orders = terminalQueue(state, chat);
  const creationIds = new Set(creations.map(o => o.id)), orderIds = new Set(orders.map(o => o.id));
  const rows = [];
  for (const kind of ['creation', 'terminal']) {
    for (const item of (kind === 'creation' ? state.creations : state.terminalOrders) || []) {
      if (item.status !== 'queued') continue;
      const power = state.powers[item.powerId];
      const eligible = kind === 'creation' ? creationCurrent(item, power, chat) : Boolean(power?.active && item.subjectIds.every(id => power.archives?.[id]));
      const selected = (kind === 'creation' ? creationIds : orderIds).has(item.id);
      const cancellable = kind === 'creation' || !state.roleWrites.some(w => w.id === item.id);
      rows.push({ id:item.id, kind, title:item.title, power:power?.name || '已移除的词条',
        content:kind === 'creation' ? item.content : item.task,
        conditions:kind === 'creation' ? item.conditions : '参与对象：' + item.subjects.map(r => r.name).join('、') + '；目标：' + item.target,
        status:!eligible ? '暂不带入 · 词条或依据需重新拟定' : blocked ? '暂不带入 · 等待连接或变量同步' : selected ? '下一轮带入' : '超出单轮预算 · 留待后续',
        selected:eligible && selected && !blocked, cancellable });
    }
  }
  return { rows, blocked, selectedCount:rows.filter(r => r.selected).length };
}
