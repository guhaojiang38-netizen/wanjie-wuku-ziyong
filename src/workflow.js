import { assert, hash, stable, chatHashes, workflowText, applyWorkflow, workflowCurrent } from './core.js';
import { getContext } from './host.js';

const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
const button = (label, action, id = '', candidateId = '', disabled = false) => `<button type="button" data-action="open-workflow" data-kind="${action}" data-id="${esc(id)}" data-candidate-id="${esc(candidateId)}" ${disabled ? 'disabled' : ''}>${label}</button>`;
const evidence = source => source ? `<details><summary>第${source.index + 1}条消息／回复${source.swipeId + 1} · 参考正文</summary><blockquote>${esc(source.quote)}</blockquote><p>词条依据：${esc(source.ruleQuote)}</p></details>` : '';
export function renderWorkflows(power, chat, blocked, kinds = ['cycle', 'simulation']) {
  const warning = '<p class="wjwk-error">档案来源已变化，待核对；暂停选择与到账确认。保留原档案，不自动重发。</p>';
  const cycles = `<h3>剧情周期与事件</h3><p class="wjwk-muted">周期由剧情中的明确标识决定；同一触发事项＋周期只登记一次。这里不计算连续天数、不补发奖励。</p>${button('登记剧情周期／事件', 'cycle', '', '', blocked)}${Object.values(power.cycles || {}).map(r => {
    const current = workflowCurrent(r, chat, power);
    return `<article class="wjwk-asset"><strong>${esc(r.label)} · ${r.status === 'recorded' ? '正文已结算' : '待正文结算'}</strong><p>${esc(r.trigger)} · ${esc(r.cycleKey)}</p>${current ? '' : warning}${r.result ? `<p>正文结果：${esc(r.result)}</p>` : button('核对正文已结算', 'cycle-receipt', r.id, '', blocked || !current)}${evidence(r.source)}${evidence(r.receipt)}</article>`;
  }).join('')}`;
  const simulations = `<h3>模拟成果档案</h3><p class="wjwk-muted">只保存正文已经形成的成果。按规则填写可选数量；选择随下一轮正文承接，到账须再核对正文。数量与资产仍由原账本／MVU管理。</p>${button('登记模拟成果候选', 'simulation', '', '', blocked)}${Object.values(power.simulations || {}).map(r => {
    const current = workflowCurrent(r, chat, power), used = Object.values(r.candidates).filter(c => c.status !== 'available').length;
    return `<article class="wjwk-asset"><strong>${esc(r.label)}</strong><p>${esc(r.trigger)} · ${esc(r.cycleKey)} · 已选 ${used}/${r.limit}</p>${current ? '' : warning}${evidence(r.source)}${Object.values(r.candidates).map(c => `<section><h4>${esc(c.name)} · ${c.status === 'received' ? '正文已到账' : c.status === 'selected' ? '已选择，待正文到账' : c.availability === 'waiting' ? '等待条件' : used >= r.limit ? '本次名额已用完' : '可选择'}</h4><p>${esc(c.description)}</p>${c.status === 'available' ? c.availability === 'waiting' ? button('核对条件已满足', 'ready', r.id, c.id, blocked || !current) : button('确认选择，交正文承接', 'select', r.id, c.id, blocked || !current || used >= r.limit) : c.status === 'selected' ? button('核对正文已到账', 'simulation-receipt', r.id, c.id, blocked || !current) : ''}${evidence(c.readySource)}${evidence(c.receipt)}</section>`).join('')}</article>`;
  }).join('')}`;
  return (kinds.includes('cycle') || Object.keys(power.cycles || {}).length ? cycles : '') + (kinds.includes('simulation') || Object.keys(power.simulations || {}).length ? simulations : '');
}
export function workflowForm(power, draft, chat) {
  const create = ['cycle', 'simulation'].includes(draft.kind), simulation = draft.kind === 'simulation';
  const lastIndex = chat.findLastIndex(m => !m.is_user && !m.is_system && workflowText(m.mes ?? m.content ?? ''));
  const initialQuote = lastIndex >= 0 ? workflowText(chat[lastIndex].mes ?? chat[lastIndex].content ?? '') : '';
  const r = (draft.kind === 'cycle-receipt' ? power.cycles : power.simulations)?.[draft.id], c = r?.candidates?.[draft.candidateId];
  return `<form><p>当前词条：${esc(power.name)}。请核对规则与正文；保存不会扣次数、发奖或修改角色变量。</p><details><summary>完整词条规则</summary><pre class="wjwk-full-rule">${esc(power.rules)}</pre></details>${create ? `<label>档案名称<input name="label" required maxlength="200"></label><label>触发事项（同一事项沿用同一名称）<input name="trigger" required maxlength="200" placeholder="例如：日常签到／书房首次深入／模拟第1轮"></label><label>剧情周期／事件标识<input name="cycleKey" required maxlength="200" placeholder="例如：玄历三年五月初一／首次进入古塔"></label>` : `<h3>${esc(r?.label)} ${esc(c?.name)}</h3><p>${esc(r?.cycleKey)} · ${esc(c?.description || '')}</p>`}${simulation ? `<label>正文成果（每行：名称｜描述｜可选或等待条件）<textarea name="candidates" required maxlength="16000" rows="5"></textarea></label><label>本次最多可选数量（按原规则和正文；并非固定选一）<input name="limit" type="number" min="1" max="32" required></label>` : ''}${draft.kind !== 'select' ? `<label>正文来源<select name="sourceIndex" data-workflow-source required>${chat.flatMap((m, index) => m.is_user || m.is_system || !workflowText(m.mes ?? m.content ?? '') ? [] : [`<option value="${index}" ${index === lastIndex ? 'selected' : ''}>第${index + 1}条 · ${esc(workflowText(m.mes ?? m.content ?? '').slice(0, 90))}</option>`]).join('')}</select></label><label>正文备注（选填）<textarea name="quote" maxlength="4000" rows="4">${esc(initialQuote.length <= 4000 ? initialQuote : '')}</textarea></label><label>规则备注（选填）<textarea name="ruleQuote" maxlength="1200" rows="3">${esc(power.rules.length <= 1200 ? power.rules : '')}</textarea></label>${draft.kind === 'cycle-receipt' ? '<label>本次正文结算结果<textarea name="result" required maxlength="4000"></textarea></label>' : ''}` : '<p>确认后锁定本项选择，计入本次可选数量。仅交给下一轮正文承接，尚未到账。</p>'}<button type="button" class="wjwk-primary" data-action="save-workflow">${draft.kind === 'select' ? '确认选择' : '确认核对并保存'}</button></form>`;
}
export const workflowMethods = {
  openWorkflow(data) {
    assert(!this.busy && !this.mainBusy && !this.committing, '请等待当前操作完成');
    const snapshot = this.ensureStable(), p = snapshot.state.powers[this.powerId]; assert(p?.active, '请先选择启用的词条');
    assert(['cycle', 'simulation', 'cycle-receipt', 'select', 'ready', 'simulation-receipt'].includes(data.kind), '未知管理操作');
    this.workflowDraft = { kind:data.kind, id:data.id, candidateId:data.candidateId, powerId:p.id, captured:{chatKey:snapshot.chatKey, stateId:snapshot.state.id, revision:snapshot.state.revision}, contextHash:hash(stable(chatHashes(snapshot.ctx.chat))) };
    this.ui.showWorkflow(p, this.workflowDraft, snapshot.ctx.chat);
  },
  async saveWorkflow(data) {
    assert(!this.busy && !this.mainBusy && !this.committing, '请等待当前操作完成');
    const snapshot = this.ensureStable(), draft = this.workflowDraft; assert(draft, '管理表单已失效，请重新打开');
    const values = { ...data.values, id:draft.id, candidateId:draft.candidateId };
    this.committing = true; this.refresh();
    try {
      await this.store.transact(next => {
        const result = applyWorkflow(next.powers[draft.powerId], draft.kind, values, getContext().chat);
        this.record(next, `${next.powers[draft.powerId].name} · 周期与模拟管理`, [result], 'workflow', draft.powerId);
        next.historyAnchor = chatHashes(getContext().chat);
      }, { captured:draft.captured });
      this.workflowDraft = null; this.ui.closeDialog(); this.notice(`已保存管理状态；未发奖或修改角色变量。${this.store.lastSave?.note || ''}`);
    } finally { this.committing = false; this.refresh(); }
  },
};
