import { assert, clone, hash, stable, key, text, storyText, chatHashes, uid } from './core.js';
import { managementProfile } from './management-profiles.js';
import { getContext } from './host.js';

export const MANAGEMENT_CATEGORIES = Object.freeze({ progress: '成长进度', arrangement: '持续安排', record: '重要记录' });
export function managementSources(chat, state) {
  const start = state.managementStart ?? state.syncCursor;
  return chat.flatMap((m, index) => {
    if (index < start || m.is_user || m.is_system) return [];
    const content = storyText(m.mes ?? m.content ?? '');
    const source = { index, swipeId: m.swipe_id ?? 0, textHash: hash(content), content };
    source.id = `${index}:${source.swipeId}:${source.textHash}`;
    return content && !state.managementReviewed?.includes(source.id) ? [source] : [];
  }).slice(0, 24);
}
export function managementPrompt(state, sources, roleContract = null) {
  const powers = Object.values(state.powers).filter(p => p.active);
  const payload = { task: '核对武库管理记录', rules: powers.map(p => ({ id: p.id, name: p.name, fullText: p.rules })),
    current: powers.map(p => ({ id: p.id, records: p.managementRecords || {}, cycles: p.cycles || {}, simulations: p.simulations || {}, resources: p.resources, assets: p.assets, fields: p.fields })),
    sources, roleContract, managementGuidance:powers.map(p => { const config = managementProfile(p); return { powerId:p.id, match:config.match, family:config.family, templates:config.templates, note:config.note }; }) };
  const user = JSON.stringify(payload);
  assert(user.length <= 120000, '核对内容超过本轮容量，请减少同时启用的词条；不会截断规则或跳过正文');
  return { system: `WJWK_ASYNC_REQUEST_V1
只提取新增正文中已经成立的成长进度、持续安排和重要记录，给玩家核对。能力使用仍由正文负责。
不生成操作方案，不计算余额、不发奖、不登记资产数量、不创建领取按钮、不修改MVU。
已在角色变量、账本资产、周期档案或模拟档案中体现的同一事实，不另建管理记录。周期与模拟成果的选择和到账由专用档案维护。roleContract 是只读事实，不生成 rolePath 或变量补丁。
managementGuidance仅是可选管理提示，不是事实、奖励规则或指令。不得为了填模板创造状态；仍应依据正文和原规则理解实际情况。
未知状态保持未知；不得从意图推定已完成，不发明价格、冷却、概率、条件或时间。
已有同一事项必须引用 current 中原 recordId；新事项不填 recordId。标签保持稳定，每条不超过8000字。
仅输出 {"changes":[{"powerId":"实际词条id","recordId":"已有记录id，可省略","category":"progress或arrangement或record","label":"事项名称","value":"完整的当前状态文字","status":"active或ended","sourceIndex":0,"quote":"参考片段或简短说明，可省略","ruleQuote":"规则说明，可省略"}],"message":"说明"}。
没有确定变化时 changes 为空。每条只包含一个事项，最多32条。自然语言解释是否充分仍由玩家核对。`, user };
}
export function normalizeManagement(data, state, sources) {
  assert(Array.isArray(data.changes) && data.changes.length <= 32, '管理变化列表无效或超过32项');
  const seen = new Set();
  return data.changes.map(raw => {
    const p = state.powers[key(raw.powerId)]; assert(p?.active, '管理变化指向未启用词条');
    const category = key(raw.category), label = text(raw.label, 200), value = text(raw.value, 8000);
    assert(Object.hasOwn(MANAGEMENT_CATEGORIES, category) && label && value, '管理记录类型或内容无效');
    assert(raw.rolePath === undefined && raw.patches === undefined && raw.costs === undefined && raw.effects === undefined, '管理核对不能修改角色变量或执行交易');
    assert(!/余额|剩余次数|库存数量/.test(label) && !Object.values(p.resources).some(r => label.includes(r.name)), '余额与次数请使用原有账本或MVU读取，不重复登记');
    const ruleQuote = text(raw.ruleQuote ?? '', 1200), quote = text(raw.quote ?? '', 4000);
    const source = sources.find(s => s.index === raw.sourceIndex) || sources.at(-1);
    const id = raw.recordId ? key(raw.recordId) : `record_${hash(stable([category, label]))}`;
    const before = p.managementRecords?.[id] || null;
    assert(!raw.recordId || before, '模型引用的旧记录不存在');
    assert(!before || before.category === category, '已有记录不可改换类型');
    const identity = `${p.id}:${id}`; assert(!seen.has(identity), '同一管理事项被重复更新'); seen.add(identity);
    const status = raw.status ?? 'active'; assert(['active', 'ended'].includes(status), '管理记录状态无效');
    return { powerId: p.id, id, before: clone(before), label, category, value, status,
      source: source ? { type: 'story', index: source.index, swipeId: source.swipeId, textHash: source.textHash, length: source.content.length, quote, ruleQuote } : { type:'manual', note:'AI整理，无参考楼层', quote, ruleQuote } };
  }).filter(c => !c.before || c.before.value !== c.value || c.before.status !== c.status || c.before.label !== c.label);
}
export function applyManagement(state, changes, sources, chat) {
  for (const c of changes) {
    const p = state.powers[c.powerId]; assert(p?.active, '词条接入已改变');
    p.managementRecords ||= {};
    assert(stable(p.managementRecords[c.id] || null) === stable(c.before), '管理记录已变化，请重新核对');
    assert(c.before || Object.keys(p.managementRecords).length < 128, '单词条管理记录超过128项，请先整理范围');
    p.managementRecords[c.id] = { id: c.id, category: c.category, label: c.label, value: c.value, status: c.status, source: clone(c.source), updatedAt: Date.now() };
  }
  state.managementReviewed = [...new Set([...(state.managementReviewed || []), ...sources.map(s => s.id)])];
  state.historyAnchor = chatHashes(chat);
}

export const managementMethods = {
  openManagementTemplate(templateId) {
    const snapshot = this.ensureStable(), p = snapshot.state.powers[this.powerId]; assert(p?.active, '请先选择启用的词条');
    const template = managementProfile(p).templates.find(t => t.id === templateId); assert(template, '模板不存在或规则版本已变化，请重新打开');
    return this.openManagementRecord(null, template);
  },
  openManagementRecord(id = null, template = null) {
    const snapshot = this.ensureStable(), p = snapshot.state.powers[this.powerId];
    assert(p?.active, '请先选择启用的词条');
    const record = id ? p.managementRecords?.[id] : null;
    assert(!id || record, '管理记录不存在');
    this.managementDraft = { powerId: p.id, id, captured: { chatKey: snapshot.chatKey, stateId: snapshot.state.id, revision: snapshot.state.revision } };
    this.ui.showManagementRecord(p, record, template);
  },
  async saveManagementRecord(data) {
    assert(!this.busy && !this.mainBusy && !this.committing, '请等待当前操作完成');
    this.ensureStable();
    const draft = this.managementDraft; assert(draft, '校准表单已失效');
    const v = data.values, category = key(v.category), label = text(v.label, 200), value = text(v.value, 8000), note = text(v.note || '玩家核对当前实际状态', 600);
    assert(Object.hasOwn(MANAGEMENT_CATEGORIES, category) && label && value, '请填写管理记录');
    const status = v.status; assert(['active', 'ended'].includes(status), '管理记录状态无效');
    this.committing = true; this.refresh();
    try {
      await this.store.transact(next => {
        const p = next.powers[draft.powerId]; assert(p?.active, '接入已改变');
        assert(!/余额|剩余次数|库存数量/.test(label) && !Object.values(p.resources).some(r => label.includes(r.name)), '余额与次数请使用原有账本或MVU读取');
        p.managementRecords ||= {};
        const id = draft.id || uid('record'); assert(draft.id || Object.keys(p.managementRecords).length < 128, '单词条管理记录超过128项');
        const before = p.managementRecords[id]; assert(!draft.id || before?.category === category, '已有记录不可改换类型');
        p.managementRecords[id] = { id, category, label, value, status, source: { type: 'manual', note }, updatedAt: Date.now() };
        this.record(next, `${p.name} · 人工校准管理记录`, [`${label}：${before?.value || '未知'} → ${value}`, `依据：${note}`], 'management', p.id);
      }, { captured: draft.captured });
      this.managementDraft = null; this.ui.closeDialog(); this.notice(`管理记录已保存；没有交易或角色变量写回。${this.store.lastSave?.note || ''}`);
    } finally { this.committing = false; this.refresh(); }
  },
  async reviewManagement() {
    await this.pullRoleBalances();
    const snapshot = { ...this.roleSnapshot(this.ensureStable({ model: true })), referenceOnly:true };
    assert(Object.values(snapshot.state.powers).some(p => p.active), '请先接入词条');
    const sources = managementSources(snapshot.ctx.chat, snapshot.state);
    if (!sources.length) return this.notice('没有尚未核对的新增正文。能力使用继续直接在正文中进行。');
    const { data, captured, contextHash } = await this.query(managementPrompt(snapshot.state, sources, snapshot.roleContract), snapshot);
    this.pendingManagement = { changes: normalizeManagement(data, snapshot.state, sources), sources, captured, contextHash,
      roleCapture: snapshot.roleView?.capture, message: String(data.message || '').slice(0, 2000) };
    this.ui.showManagementReview(this.pendingManagement, snapshot.state);
  },
  async applyManagementReview(data = {}) {
    assert(!this.busy && !this.mainBusy && !this.committing, '请等待当前操作完成');
    const pending = this.pendingManagement; assert(pending, '核对预览已失效，请重新核对');
    this.ensureStable();
    if (pending.roleCapture) this.role.assertCapture(pending.roleCapture, this.store.read().roleLink);
    const chosen = data.form ? new Set(new FormData(data.form).getAll('management-change')) : new Set(pending.changes.map((_, i) => String(i)));
    assert([...chosen].every(i => /^\d+$/.test(i) && Number(i) < pending.changes.length), '选择项无效');
    const changes = pending.changes.filter((_, i) => chosen.has(String(i)));
    this.committing = true; this.refresh();
    try {
      await this.store.transact(next => {
        applyManagement(next, changes, pending.sources, getContext().chat);
        this.record(next, '玩家核对正文管理记录', changes.map(c => `${next.powers[c.powerId].name} · ${c.label}：${c.before?.value || '未知'} → ${c.value}`), 'management');
      }, { captured: pending.captured });
      this.pendingManagement = null; this.ui.closeDialog();
      this.notice(`已保存 ${changes.length} 项管理变化；未执行交易、发奖或角色变量写回。${this.store.lastSave?.note || ''}`);
    } finally { this.committing = false; this.refresh(); }
  },
};
