import { assert, clone, hash, stable, text, publicPower, storyText } from './core.js';

export const ACTION_MARKER = 'WJWK_NARRATIVE_ACTION_V1';
export const pendingActions = state => (state.narrativeActions || []).filter(a => ['waiting', 'generating'].includes(a.status));

// A settlement and its narrative outbox are saved in the same ledger transaction.
// No price, patch or settlement is ever replayed by the narrative lifecycle.
export function queueAction(state, operation, beforePower, { intent, note = '' } = {}) {
  state.narrativeActions ||= [];
  if (state.narrativeActions.some(a => a.id === operation.id)) return;
  state.narrativeActions.push({ id: operation.id, powerId: operation.powerId, label: operation.label,
    intent: String(intent || operation.label).slice(0, 8000), note: String(note).slice(0, 2000),
    description: operation.description || '', ruleQuote: operation.ruleQuote,
    costs: clone(operation.costs), effects: clone(operation.effects), requirements: clone(operation.requirements),
    before: publicPower(beforePower), after: publicPower(state.powers[operation.powerId]),
    variableChanges: clone(operation.rolePlan?.changes || []), status: 'waiting', attempts: 0, at: Date.now() });
}

export function actionReady(state, action) {
  const write = state.roleWrites?.find(w => w.id === action.id);
  return state.transactions.some(t => t.id === action.id) && (!write || write.status === 'applied');
}

export function narrativePacket(actions, names = {}) {
  if (!actions.length) return '';
  return `\n[${ACTION_MARKER}]\n玩家 ${names.user || '{{user}}'} 已确认以下行动；这次请在角色卡、世界书、当前情节与叙事预设下承接它们。
这是已经一次性结算的事件，不是待购买方案。账本和角色变量已是发动后的状态；before 是本次发动前的真实状态，须把二者之间的过程写出来，避免把新增能力当成一直存在。
按确认顺序写发动契机、动作与感受、所得实际效力的具体表现，以及场景中合理的反馈。不要只复述面板或宣布数值变动。不得重报价、再次扣款、再次领取、削弱已确认规格，或在 UpdateVariable 中再次执行这些 variableChanges。新的剧情事件仍按角色原有规则更新。
intent 是玩家这一次明确授权的行动，note 是呈现偏好；两者都不授权下一次决定、台词或额外花费。只展开选择范围，不代替玩家作下一步选择。不从能力提升推定所有敌人必败或NPC必服从。未经确认的新收益、战果和他人反应依实际情节成立。
若是重生成、swipe 或补写，只重新呈现这同一事件。previousPresentation 若存在，是同一行动上次的正文；补写只补其缺失的呈现，不能把它当作新一轮发动。不要再发动、再次提升或把旧结算当新收益。
已确认行动数据：\n${JSON.stringify(actions.map(a => ({ id: a.id, label: a.label, intent: a.intent, note: a.note, description: a.description, requirements: a.requirements, ruleQuote: a.ruleQuote, costs: a.costs, effects: a.effects, before: a.before, after: a.after, variableChanges: a.variableChanges, previousPresentation: a.result ? {index:a.result.index,excerpt:a.result.excerpt} : null })))}\n[/${ACTION_MARKER}]`;
}

export function resultText(ctx, action) {
  const r = action.result, floor = ctx.chat[r?.index];
  assert(floor && !floor.is_user && !floor.is_system && (floor.swipe_id ?? 0) === r.swipeId, '对应正文已删除或切换分支，请重新承接');
  const text = storyText(floor.mes ?? floor.content ?? '').slice(r.offset || 0, (r.offset || 0) + r.length);
  assert(text && hash(text) === r.textHash, '对应正文已改写，请重新承接或重生成后核对');
  return text;
}

export function storyEvidenceCurrent(action, chat) {
  try { resultText({ chat }, action); return true; } catch { return false; }
}

// The main reply that presents a settled action cannot award that action again.
// Genuine later continuations remain visible to the existing reconciliation.
export function unsettledNarrative(chat, state, messages) {
  return messages.map(m => {
    if (m.is_user) return m;
    const body = storyText(chat[m.index]?.mes ?? ''), start = state.syncTail?.index === m.index && m.index < state.syncCursor ? state.syncTail.offset : 0;
    const ranges = (state.narrativeActions || []).flatMap(a => a.presentations?.length ? a.presentations : a.result ? [a.result] : []).filter(r => r.index === m.index && r.swipeId === (chat[m.index]?.swipe_id ?? 0) && hash(body.slice(r.offset, r.offset + r.length)) === r.textHash).map(r => [Math.max(start, r.offset), r.offset + r.length]).filter(([from, to]) => to > from).sort((a, b) => a[0] - b[0]);
    let cursor = start, content = '';
    for (const [from, to] of ranges) { if (from > cursor) content += body.slice(cursor, from) + '\n'; cursor = Math.max(cursor, to); }
    content += body.slice(cursor); return { ...m, content: content.trim() };
  }).filter(m => m.content);
}

export function reviewPrompt(action, text) {
  return { system: 'WJWK_ASYNC_REQUEST_V1\n只核对所提供正文是否呈现已确认行动。不得生成剧情、改变量、执行交易或补写缺失内容。逐项核对 intent 的实际动作、发动或承接过程、effects 的实际表现，以及是否重复付费或越过玩家选择。仅输出 {"checks":[{"item":"intent或activation或effect:0等或agency或settlement","ok":true,"quotes":["正文逐字证据，至少6字"],"reason":"具体说明"}],"message":"简短说明"}。每个 effect 都要单列；缺失、不明确、仅面板宣布均为 ok:false。所有证据必须出自正文，不能引用行动数据冒充证据。agency/settlement 的判定同样说明实际情况。这是模型辅助核对，不是完成证明。', user: JSON.stringify({ task: '核对行动正文', action, narrative: text }) };
}

export function validateReview(data, action, text) {
  assert(Array.isArray(data?.checks) && data.checks.length <= 40, '正文核对格式无效');
  const required = ['intent', 'activation', ...action.effects.map((_, i) => `effect:${i}`), 'agency', 'settlement'];
  const checks = required.map(item => {
    const candidates = data.checks.filter(c => c.item === item);
    assert(candidates.length === 1, `缺少或重复核对项：${item}`);
    const c = candidates[0]; assert(typeof c.ok === 'boolean' && typeof c.reason === 'string' && c.reason.length <= 2000 && Array.isArray(c.quotes) && c.quotes.length <= 8, '正文核对项格式无效');
    for (const quote of c.quotes) assert(typeof quote === 'string' && quote.trim().length >= 6 && text.includes(quote) && quote.length <= 4000, '核对证据不在对应正文中');
    assert(!c.ok || c.quotes.length > 0, '通过的核对项缺少正文证据');
    return { item, ok: c.ok, quotes: clone(c.quotes), reason: c.reason };
  });
  return { checks, covered: checks.every(c => c.ok), message: String(data.message || '').slice(0, 2000), at: Date.now() };
}

export const SCENE_KINDS = Object.freeze({ respond: '处理眼前问题', develop: '利用已有成果', investigate: '查明关键未知', prepare: '为后续布置', alternative: '换一条路线' });
export function normalizeCandidates(data, power, context = null) {
  assert(Array.isArray(data?.actions) && data.actions.length <= (context ? 5 : 6), '场景动作数量或格式无效');
  const kinds = new Set(), goals = new Set();
  return data.actions.map(a => {
    assert(a && typeof a.label === 'string' && a.label.trim() && a.label.length <= 120 && typeof a.goal === 'string' && a.goal.trim() && a.goal.length <= (context ? 600 : 2000), '场景动作文本无效');
    assert(typeof a.ruleQuote === 'string' && a.ruleQuote.trim().length >= 6 && power.rules.includes(a.ruleQuote), '场景动作缺少真实词条依据');
    if (!context) return { label: a.label, goal: a.goal, ruleQuote: a.ruleQuote };
    assert(Object.keys(a).every(k => ['kind', 'label', 'goal', 'benefit', 'uncertainty', 'archiveIds', 'sourceIndex', 'sceneQuote', 'ruleQuote'].includes(k)), '建议包含不允许的操作字段');
    assert(Object.hasOwn(SCENE_KINDS, a.kind) && !kinds.has(a.kind), '建议方向重复或无效，请重新生成'); kinds.add(a.kind);
    const identity = a.goal.normalize('NFKC').replace(/[\s，。！？、,.!?]/g, '').toLowerCase();
    assert(!goals.has(identity), '行动意图重复，请重新生成'); goals.add(identity);
    const benefit = text(a.benefit, 240), uncertainty = text(a.uncertainty, 240);
    assert(benefit && Array.isArray(a.archiveIds) && a.archiveIds.length <= 8 && new Set(a.archiveIds).size === a.archiveIds.length, '建议理由或档案引用无效');
    const records = a.archiveIds.map(id => context.archives.items.find(r => r.id === id));
    assert(records.every(Boolean), '建议引用了未提供或失效的档案');
    const source = context.narrative.find(m => m.index === a.sourceIndex), sceneQuote = text(a.sceneQuote, 1200);
    assert(source && sceneQuote.length >= 6 && source.content.includes(sceneQuote), '建议缺少当前场景的逐字依据');
    return { kind: a.kind, label: a.label.trim(), goal: a.goal.trim(), benefit, uncertainty, archiveIds: clone(a.archiveIds), sourceIndex: a.sourceIndex, sceneQuote, ruleQuote: a.ruleQuote, archiveNames: records.map(r => r.name), provisional: records.filter(r => r.status !== 'active').map(r => r.name), sourceIsIntent: Boolean(source.is_user) };
  });
}

export function favoriteIntent(state, power, goal, label = goal) {
  assert(power?.active && typeof goal === 'string' && goal.trim() && goal.length <= 8000, '请填写想收藏的行动意图');
  state.favoriteActions ||= [];
  const existing = state.favoriteActions.find(a => a.powerId === power.id && a.goal === goal.trim());
  if (existing) return existing;
  assert(state.favoriteActions.length < 100, '常用行动最多100项，请先删除不需要的项');
  const favorite = { id: `fav_${hash(stable([power.id, goal.trim()]))}`, powerId: power.id, label: String(label).slice(0, 120), goal: goal.trim(), at: Date.now() };
  state.favoriteActions.push(favorite); return favorite;
}
