import { assert, amount, normAmount, clone, hash, stable, importBook, chatHashes, historyChanged, historyCompatible, stripVariableReceipts } from './core.js';
import { getContext, scope, loadBook } from './host.js';
import { appendVariableReceipt, hasStatusReceipt, hasVariableReceipt, removeVariableReceiptIds } from './receipt.js';

// Use the installed framework's public API. Never load or execute card scripts.
export const COMMIT_KEY = 'wanjie_wuku_ziyong_commits';
const own = (value, key) => value != null && Object.hasOwn(value, key);
const forbidden = segment => ['__proto__', 'prototype', 'constructor'].includes(segment) || segment.startsWith('$');
export const pointer = parts => '/' + parts.map(s => String(s).replace(/~/g, '~0').replace(/\//g, '~1')).join('/');
export function segments(path) {
  assert(typeof path === 'string' && path.startsWith('/') && path.length <= 2000 && path !== '/', '变量路径须指向 stat_data 内的具体字段');
  const parts = path.slice(1).split('/').map(s => s.replace(/~1/g, '/').replace(/~0/g, '~'));
  assert(parts.length <= 40 && parts.every(s => s && !forbidden(s)), '变量路径包含不允许的字段'); return parts;
}
export function at(value, path) { let current = value; for (const p of segments(path)) { if (!own(current, p)) return undefined; current = current[p]; } return current; }
function json(value, depth = 0) {
  assert(depth <= 40, '变量嵌套过深');
  if (value === null || typeof value === 'boolean' || typeof value === 'string') return;
  if (typeof value === 'number') { assert(Number.isFinite(value), '变量数值不是有限数'); return; }
  assert(value && typeof value === 'object', '变量更新只接受 JSON 数据');
  for (const [k, v] of Object.entries(value)) { assert(!['__proto__', 'prototype', 'constructor'].includes(k), '变量数据包含危险字段'); json(v, depth + 1); }
}
export function variableFields(stat) {
  const rows = [];
  const walk = (v, parts, depth) => {
    if (depth > 20 || rows.length >= 1500) return;
    const type = v === null ? 'null' : Array.isArray(v) ? 'array' : typeof v;
    if (parts.length) rows.push({ path: pointer(parts), label: parts.join(' › '), type, value: v, numeric: typeof v === 'number' || (typeof v === 'string' && /^-?\d+(?:\.\d{1,6})?$/.test(v)) });
    if (v && typeof v === 'object') for (const [k, child] of Object.entries(v)) if (!forbidden(k)) walk(child, [...parts, k], depth + 1);
  }; walk(stat, [], 0); return rows;
}
export function ruleKind(name) {
  if (/变量更新规则|更新规则|variable.?update.?rules/i.test(name)) return 'update';
  if (/变量结构|变量列表|schema|initvar|初始化变量|初始变量/i.test(name)) return 'structure';
  if (/变量输出格式|输出格式|update.?format/i.test(name)) return 'format';
  return '';
}
export function normalizeRoleChecks(checks, updates, link) {
  if (!updates.length) return [];
  assert(Array.isArray(checks) && checks.length > 0 && checks.length <= 64, '模型未提供逐项角色规则依据；请重新生成，本次没有扣付');
  const result = checks.map(c => {
    const rule = link.rules.find(r => r.id === c?.ruleId);
    assert(rule && ruleKind(rule.name) === 'update', '角色依据引用了未选中或非更新规则的条目');
    assert(typeof c.quote === 'string' && c.quote.length >= 6 && c.quote.length <= 1200 && rule.content.includes(c.quote), '角色依据必须逐字引用已选变量更新规则');
    assert(Array.isArray(c.paths) && c.paths.length > 0 && c.paths.length <= 64 && c.paths.every(path => updates.some(u => u.path === path)), '规则依据须对应本次实际更新的字段');
    assert(typeof c.reason === 'string' && c.reason.trim().length >= 6 && c.reason.length <= 3000, '角色依据缺少本次条件、目标值和规则限制的具体说明');
    return { ruleId: rule.id, ruleName: rule.name, quote: c.quote, paths: [...new Set(c.paths)], reason: c.reason.trim() };
  });
  for (const u of updates) assert(result.some(c => c.paths.includes(u.path)), `字段 ${u.path} 缺少角色规则依据；本次没有扣付`);
  return result;
}
export const bindingKey = (powerId, resourceId) => `${powerId}:${resourceId}`;
export function suggestedBindings(powers, fields, preferredRoots = []) {
  const bindings = {};
  for (const p of powers) for (const r of Object.values(p.resources)) {
    const aliases = new Set([r.name, `${r.name}余额`, ...(r.labels || [])].map(s => s.replace(/^(?:当前|可用|剩余)/, '')));
    let matches = fields.filter(f => f.numeric && aliases.has(segments(f.path).filter(s => !/^\d+$/.test(s)).at(-1)?.replace(/^(?:当前|可用|剩余)/, '')));
    const preferred = matches.filter(f => preferredRoots.some(root => f.path === root || f.path.startsWith(root + '/'))); if (preferred.length) matches = preferred;
    if (matches.length === 1) bindings[bindingKey(p.id, r.id)] = matches[0].path;
  } return bindings;
}
export function suggestedRoots(stat, player = '') {
  const rows = variableFields(stat).filter(r => segments(r.path).length <= 3);
  const players = rows.filter(r => r.type === 'object' && (['主角', '玩家', '{{user}}', player].filter(Boolean).includes(segments(r.path).at(-1))));
  if (players.length) return players.map(r => r.path);
  return rows.filter(r => /功法|武学|技能|能力|物品|背包|资源|属性|体质|境界|因果点|源质点/.test(segments(r.path).at(-1))).map(r => r.path).filter((p, _i, a) => !a.some(other => p !== other && p.startsWith(other + '/')));
}
export function resourceValue(value) {
  if (typeof value === 'number') { assert(Number.isFinite(value) && Math.abs(value) <= Number.MAX_SAFE_INTEGER && Number(value.toFixed(6)) === value, '角色余额超出可精确核对的范围，请使用六位以内小数或十进制字符串'); return normAmount(value.toFixed(6)); }
  assert(typeof value === 'string', '角色余额须为数值或十进制字符串'); return normAmount(value);
}
function typedAmount(balance, old) {
  if (typeof old === 'string') return normAmount(balance);
  assert(typeof old === 'number', '绑定的资源字段不再是数值'); const n = Number(balance);
  assert(Number.isFinite(n) && Math.abs(n) <= Number.MAX_SAFE_INTEGER && resourceValue(n) === normAmount(balance), '余额超出角色数值字段可精确表示的范围'); return n;
}
const beneath = (path, root) => path === root || path.startsWith(root + '/');
function put(stat, patch) {
  const parts = segments(patch.path), leaf = parts.pop(); let parent = stat;
  for (const p of parts) { assert(own(parent, p), '变量更新的父级不存在'); parent = parent[p]; }
  assert(parent && typeof parent === 'object', '变量父级不是容器');
  let actual = patch.path;
  if (patch.op === 'replace') {
    assert(own(parent, leaf), '只能替换已存在的变量字段');
    assert(parent[leaf] === null || typeof parent[leaf] !== 'object', '不能整块替换功法、物品或变量容器；请更新具体字段');
    assert(parent[leaf] === null || typeof parent[leaf] === typeof patch.value, '变量类型与当前字段不一致'); parent[leaf] = clone(patch.value);
  } else if (Array.isArray(parent)) {
    assert(leaf === '-' || leaf === String(parent.length), '新增数组记录只能追加到末尾'); actual = pointer([...parts, String(parent.length)]); parent.push(clone(patch.value));
  } else { assert(!own(parent, leaf), '新增变量不能覆盖已有记录'); parent[leaf] = clone(patch.value); }
  return actual;
}
export function normalizeUpdates(updates, stat, roots, protectedPaths = []) {
  assert(Array.isArray(updates) && updates.length <= 64, '角色变量更新须为不超过64项的列表');
  const simulated = clone(stat), targets = [];
  const patches = updates.map(u => {
    assert(u && ['add', 'replace'].includes(u.op) && own(u, 'value'), '只允许新增记录或替换具体变量值'); segments(u.path); json(u.value);
    assert(JSON.stringify(u.value).length <= 64000, '单项角色更新过长');
    assert(roots.some(root => beneath(u.path, root)), '变量更新超出玩家接入的区域');
    assert(!protectedPaths.some(p => beneath(u.path, p) || beneath(p, u.path)), '绑定余额由插件按已确认投入计算，模型不能重复改余额');
    const patch = { op: u.op, path: u.path, value: clone(u.value) }; targets.push({ path: put(simulated, patch), value: clone(patch.value) }); return patch;
  }); return { patches, targets, simulated };
}
export function differences(before, after, parts = [], result = []) {
  if (stable(before) === stable(after)) return result;
  if (before && after && typeof before === 'object' && typeof after === 'object' && Array.isArray(before) === Array.isArray(after)) {
    for (const k of new Set([...Object.keys(before), ...Object.keys(after)])) if (!forbidden(k)) differences(before[k], after[k], [...parts, k], result);
  } else if (parts.length) result.push({ path: pointer(parts), before: before === undefined ? null : clone(before), after: after === undefined ? null : clone(after), added: before === undefined, removed: after === undefined });
  return result;
}
function contains(actual, expected) {
  if (expected && typeof expected === 'object') return actual && typeof actual === 'object' && Object.entries(expected).every(([k, v]) => own(actual, k) && contains(actual[k], v));
  return stable(actual) === stable(expected);
}
function fingerprint(data) { return hash(stable({ stat: data.stat_data, schema: data.schema ?? null, initialized: data.initialized_lorebooks ?? null })); }
export function validateRoleLink(link) {
  if (!link) return;
  assert(link.enabled === true && typeof link.character === 'string' && link.character && ['message', 'chat'].includes(link.scope), '角色接入信息无效');
  assert(Array.isArray(link.roots) && link.roots.length && link.roots.length <= 100, '角色写回区域无效'); link.roots.forEach(segments);
  assert(Array.isArray(link.rules) && link.rules.length && link.rules.length <= 100, '角色规则无效');
  for (const r of link.rules) assert(typeof r.content === 'string' && r.content.length <= 200000 && typeof r.name === 'string', '角色规则正文无效');
  assert(link.rules.some(r => ruleKind(r.name) === 'update'), '请选中角色的变量更新规则');
  assert(link.ruleVersion === hash(stable(link.rules)), '角色规则版本无效');
  assert(link.bindings && typeof link.bindings === 'object' && !Array.isArray(link.bindings), '角色资源绑定无效'); Object.values(link.bindings).forEach(segments);
}

export class RoleBridge {
  constructor({ context = getContext, engine = () => globalThis.Mvu, helper = () => globalThis.TavernHelper, bookLoader = loadBook } = {}) { this.context = context; this.engine = engine; this.helper = helper; this.bookLoader = bookLoader; }
  runtime() {
    assert(!this.rawPending, '上一笔 MVU 调用仍在结束中，请等待角色脚本完成后重试');
    const mvu = this.engine(); assert(mvu && ['getMvuData'].every(k => typeof mvu[k] === 'function'), '未检测到可用 MVU 接口；请启用该卡的 MVU 脚本，等待初始化后重新读取');
    assert(!mvu.isDuringExtraAnalysis?.(), 'MVU 正在解析正文，请稍后读取或执行'); return mvu;
  }
  read(link = null, target = null) {
    const ctx = this.context(), identity = scope(ctx), character = identity.character;
    assert(!identity.groupId && character?.avatar, '0.3 的角色变量接入用于单角色聊天，请先打开角色卡');
    if (link) { validateRoleLink(link); assert(link.character === character.avatar, '接入的角色已经改变，请重新读取角色'); }
    if (target) assert(target.chatKey === identity.key && target.character === character.avatar, '聊天或角色已切换，旧变量写回已停止');
    const mvu = this.runtime(); let raw, option;
    if (target) {
      option = clone(target.option); if (option.type === 'message') { const m = ctx.chat[option.message_id]; assert(m && (m.swipe_id ?? 0) === target.swipeId && (hash(stripVariableReceipts(m.mes ?? m.content ?? '')) === target.messageHash || target.historyHash && historyCompatible(target.historyHash, chatHashes([m])[0])), '目标楼层被编辑或切换，不能写回旧变量'); }
      raw = mvu.getMvuData(option);
    } else {
      if (!link || link.scope === 'message') for (let i = ctx.chat.length - 1; i >= 0; i--) {
        try { const data = mvu.getMvuData({ type: 'message', message_id: i }); if (data?.stat_data && typeof data.stat_data === 'object' && !Array.isArray(data.stat_data)) { raw = data; option = { type: 'message', message_id: i }; break; } } catch { /* A floor without MVU data is not initialized. */ }
      }
      if (!raw && (!link || link.scope === 'chat')) { raw = mvu.getMvuData({ type: 'chat' }); option = { type: 'chat' }; }
    }
    assert(raw?.stat_data && typeof raw.stat_data === 'object' && !Array.isArray(raw.stat_data), 'MVU 尚无已初始化的 stat_data；请完成开场变量初始化再读取');
    assert(JSON.stringify(raw).length <= 2000000, '角色变量超过2MB，当前版本不能完整核对'); json(raw.stat_data); raw = clone(raw);
    const m = option.type === 'message' ? ctx.chat[option.message_id] : null;
    const capture = { chatKey: identity.key, character: character.avatar, option, swipeId: m?.swipe_id ?? 0, messageHash: m ? hash(stripVariableReceipts(m.mes ?? m.content ?? '')) : '', historyHash: m ? chatHashes([m])[0] : '', fingerprint: fingerprint(raw), statHash: hash(stable(raw.stat_data)) };
    return { raw, stat: raw.stat_data, schema: raw.schema ?? null, capture, characterName: character.name || ctx.name2, fields: variableFields(raw.stat_data) };
  }
  assertCapture(capture, link) {
    const latest = this.read(link); assert(latest.capture.chatKey === capture.chatKey && latest.capture.character === capture.character && stable(latest.capture.option) === stable(capture.option) && latest.capture.swipeId === capture.swipeId && latest.capture.messageHash === capture.messageHash && latest.capture.fingerprint === capture.fingerprint, '角色变量或聊天已变化，请重新生成写回预览'); return latest;
  }
  async discover() {
    const view = this.read(), ctx = this.context(), h = this.helper(), names = new Set(), warnings = [];
    try { const books = h?.getCharWorldbookNames?.('current'); if (books?.primary) names.add(books.primary); for (const n of books?.additional || []) names.add(n); } catch (e) { warnings.push(e.message); }
    const character = scope(ctx).character;
    if (character.data?.extensions?.world) names.add(character.data.extensions.world);
    try { const chatBook = h?.getChatWorldbookName?.('current'); if (chatBook) names.add(chatBook); } catch { /* Optional chat binding. */ }
    if (ctx.chatMetadata.world_info) names.add(ctx.chatMetadata.world_info);
    for (const n of Object.keys(view.raw.initialized_lorebooks || {})) names.add(n);
    const entries = [];
    if (character.data?.character_book?.entries) entries.push(...importBook({ entries: character.data.character_book.entries }, `${view.characterName} · 内嵌世界书`));
    const loaded = await Promise.allSettled([...names].map(async name => {
      if (typeof h?.getWorldbook === 'function') { const data = await h.getWorldbook(name); return importBook({ entries: data }, name); }
      return importBook(await this.bookLoader(name, ctx), name);
    }));
    loaded.forEach((r, i) => r.status === 'fulfilled' ? entries.push(...r.value) : warnings.push(`${[...names][i]}：${r.reason?.message || '读取失败'}`));
    this.assertCapture(view.capture, null);
    const rules = entries.map(r => ({ ...r, kind: ruleKind(r.name) })).filter(r => r.kind);
    return { ...view, rules, warnings, roots: suggestedRoots(view.stat, ctx.name1), bindings: {}, readAt: Date.now() };
  }
  async extraBook(draft, name) {
    this.assertCapture(draft.capture, null); const entries = importBook(await this.bookLoader(name, this.context()), name);
    this.assertCapture(draft.capture, null);
    return { ...draft, rules: [...draft.rules.filter(r => r.book !== name), ...entries.map(r => ({ ...r, kind: ruleKind(r.name) }))] };
  }
  contract(link, view) {
    for (const path of link.roots) assert(at(view.stat, path) !== undefined, `已接入的变量区域不存在：${path}；请重新读取角色`);
    const selected = link.roots.map(path => ({ path, value: clone(at(view.stat, path)), observedType: typeof at(view.stat, path) }));
    const schema = view.schema && typeof view.schema === 'object' ? link.roots.map(path => { let node = view.schema; for (const p of segments(path)) node = node?.type === 'array' ? node.elementType : node?.properties?.[p]; return { path, schema: node ?? null }; }) : null;
    const result = { character: view.characterName, scope: view.capture.option, currentVariables: selected, runtimeSchema: schema, rules: link.rules.map(r => ({ id: r.id, name: r.name, book: r.book, kind: ruleKind(r.name), fullText: r.content })), balanceBindings: clone(link.bindings), writableRoots: clone(link.roots) };
    assert(JSON.stringify(result).length <= 300000, '已选变量与规则过长，请缩小角色接入区域；本次未截断正文'); return result;
  }
  balances(state, link, view) {
    const changes = [];
    for (const p of Object.values(state.powers)) for (const r of Object.values(p.resources)) {
      const path = link.bindings[bindingKey(p.id, r.id)]; if (!path) continue;
      const balance = resourceValue(at(view.stat, path)); assert(amount(balance) >= amount(r.floor ?? '0'), `${r.name}的角色余额低于已设置下限`);
      if (r.balance !== balance) { changes.push(`${p.name} · ${r.name}：${r.balance ?? '未确认'} → ${balance}（读取角色变量）`); r.balance = balance; }
    } return changes;
  }
  async prepare({ updates = [], roleRuleQuote = '', roleChecks, operation, link, view, resultingPower }) {
    validateRoleLink(link); this.assertCapture(view.capture, link);
    const bound = Object.values(link.bindings), { patches, targets } = normalizeUpdates(updates, view.stat, link.roots, bound);
    if (operation.effects.some(e => e.type !== 'resource_credit') || operation.costs.some(c => c.kind === 'asset')) {
      assert(patches.length, '该操作还没有角色变量变化；请生成角色写回预览');
      assert(typeof roleRuleQuote === 'string' && roleRuleQuote.length >= 6 && link.rules.some(r => ruleKind(r.name) === 'update' && r.content.includes(roleRuleQuote)), '角色更新缺少可逐字核对的变量规则依据');
      for (const e of operation.effects.filter(e => e.type === 'asset_grant')) {
        const name = e.name.replace(/（[^）]*）|\([^)]*\)/g, '').trim();
        assert(name && updates.some(u => [...segments(u.path), JSON.stringify(u.value)].some(v => v.includes(name))), `所得“${e.name}”未在角色更新中体现；本次没有扣付`);
      }
    }
    const checks = normalizeRoleChecks(roleChecks, updates, link);
    const totals = new Set([...operation.costs.filter(c => c.kind === 'resource').map(c => c.id), ...operation.effects.filter(e => e.type === 'resource_credit').map(e => e.id)]);
    const protectedTargets = [];
    for (const id of totals) {
      const path = link.bindings[bindingKey(operation.powerId, id)]; if (!path) continue;
      const patch = { op: 'replace', path, value: typedAmount(resultingPower.resources[id].balance, at(view.stat, path)) };
      patches.push(patch); targets.push({ path, value: patch.value }); protectedTargets.push(path);
    }
    assert(patches.length, '该操作没有可写回的变量；请核对资源绑定或角色字段');
    assert(patches.length <= 64, '角色更新与余额合计超过64项，请拆分操作');
    const next = await this.parse(view.raw, patches);
    this.assertCapture(view.capture, link);
    for (const t of targets) assert(contains(at(next.stat_data, t.path), t.value), `MVU 未接受预期变化：${t.path}；本次没有扣付`);
    const changes = differences(view.stat, next.stat_data); assert(changes.length && changes.length <= 200, '角色更新没有成立或变化过多');
    for (const c of changes) assert(!c.removed && (link.roots.some(root => beneath(c.path, root)) || protectedTargets.includes(c.path)), '角色规则改动了未接入区域或删除了已有状态，请扩大接入区域并核对');
    return { capture: clone(view.capture), patches, changes, afterStatHash: hash(stable(next.stat_data)), ruleVersion: link.ruleVersion, linkVersion: hash(stable(link)), roleRuleQuote, roleChecks: checks };
  }
  async parse(raw, patches) {
    // MVU also scans legacy _.set/_.insert commands across the whole message.
    // Escape underscores at the JSON layer so text values cannot be mistaken
    // for commands; JSON decoding restores the exact original data.
    const text = JSON.stringify(patches).replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/_/g, '\\u005f');
    const next = await this.invoke('parseMessage', [`<UpdateVariable><JSONPatch>${text}</JSONPatch></UpdateVariable>`, clone(raw)], 'MVU 解析超时；请等待角色脚本结束后重试');
    assert(next?.stat_data && typeof next.stat_data === 'object', 'MVU 没有返回更新后的变量'); json(next.stat_data); return clone(next);
  }
  async preflight(write, link) {
    validateRoleLink(link); assert(hash(stable(link)) === write.linkVersion, '角色接入已改变，请重新预览');
    const current = this.assertCapture(write.capture, link);
    normalizeUpdates(write.patches, current.stat, [...link.roots, ...Object.values(link.bindings)]);
    if (write.roleChecks) normalizeRoleChecks(write.roleChecks, write.patches.filter(p => !Object.values(link.bindings).includes(p.path)), link);
    const next = await this.parse(current.raw, write.patches); this.assertCapture(write.capture, link);
    assert(hash(stable(next.stat_data)) === write.afterStatHash, '角色重新校验结果与确认预览不同，请重新生成；本次没有扣付');
    return next;
  }
  async write(write, link, prechecked = null) {
    throw new Error('自用版只读：不会写回角色卡变量，请在正文里按角色卡规则更新');
    validateRoleLink(link); assert(hash(stable(link)) === write.linkVersion, '角色接入规则或绑定已改变，不能应用旧写回');
    assert(typeof write.id === 'string' && Array.isArray(write.patches) && write.patches.length <= 64 && Array.isArray(write.history), '待写回记录无效');
    let current = this.read(link, write.capture);
    if (current.raw[COMMIT_KEY]?.[write.id] === write.afterStatHash) return { alreadyApplied: true, verified: true };
    assert(!historyChanged({ historyAnchor: write.history }, chatHashes(this.context().chat)), '剧情历史已改变，请先核对待写回记录');
    this.assertCapture(write.capture, link);
    const wallet = Object.values(link.bindings);
    // Recheck the stored outbox as well as the model response. Wallet writes are
    // literal replacements; all other changes remain inside selected roots.
    normalizeUpdates(write.patches, current.stat, [...link.roots, ...wallet]);
    const next = prechecked ? clone(prechecked) : await this.parse(current.raw, write.patches);
    assert(hash(stable(next.stat_data)) === write.afterStatHash, '角色校验结果与确认预览不同，写回已暂停');
    this.assertCapture(write.capture, link);
    const commits = { ...(current.raw[COMMIT_KEY] || {}), [write.id]: write.afterStatHash };
    next[COMMIT_KEY] = Object.fromEntries(Object.entries(commits).slice(-512));
    await this.invoke('replaceMvuData', [next, write.capture.option], 'MVU 写回超时；结果暂未确认，请等待脚本结束后重试同一笔写回');
    current = this.read(link, write.capture);
    assert(current.raw[COMMIT_KEY]?.[write.id] === write.afterStatHash && hash(stable(current.stat)) === write.afterStatHash, '角色写回未通过读回核对；请重试同一笔记录，不要再次执行');
    return { alreadyApplied: false, verified: true };
  }
  async redraw(capture, target = null) {
    return false; // 自用版：不改写聊天正文
    const ctx = this.context(); assert(scope(ctx).key === capture.chatKey, '聊天已切换');
    if (target && typeof this.helper()?.setChatMessages === 'function') {
      const ids = [...new Set([target.messageId, ...(target.pruned || []).map(p => p.messageId)])];
      await this.helper().setChatMessages(ids.map(message_id => ({ message_id })), { refresh: 'affected' }); return true;
    }
    if (capture.option.type === 'message' && typeof this.helper()?.setChatMessages === 'function') { await this.helper().setChatMessages([{ message_id: capture.option.message_id }], { refresh: 'affected' }); return true; }
    return false;
  }
  async appendReceipt(write, label, { powerName = '万界武库', previousIds = [], previousTargets = [] } = {}) {
    throw new Error('自用版只读：不会往聊天楼层追加回执');
    const ctx = this.context(), identity = scope(ctx);
    assert(identity.key === write.capture.chatKey && identity.character?.avatar === write.capture.character, '聊天或角色已切换，不能补充旧消息回执');
    const data = this.read(null, write.capture);
    assert(data.raw[COMMIT_KEY]?.[write.id] === write.afterStatHash, '当前角色数据没有这笔写回标记，请先核对角色变量');
    let index = write.capture.option.message_id;
    if (write.capture.option.type === 'chat') {
      assert(!historyChanged({ historyAnchor: write.history }, chatHashes(ctx.chat)), '原消息已改变，不能将旧回执附加到新剧情');
      index = -1; for (let i = Math.min(write.history.length, ctx.chat.length) - 1; i >= 0; i--) if (!ctx.chat[i].is_user && !ctx.chat[i].is_system) { index = i; break; }
    }
    const message = ctx.chat[index]; assert(message && !message.is_user && !message.is_system, '这笔操作没有可附加回执的模型楼层；变量已写回，请在武库回执核对');
    const older = previousIds.filter(id => id !== write.id), edits = [], pruned = [];
    for (let i = 0; i < ctx.chat.length; i++) {
      const floor = ctx.chat[i]; if (floor.is_user || floor.is_system) continue;
      const before = String(floor.mes ?? floor.content ?? ''), swipe = floor.swipe_id ?? 0;
      const ids = [...new Set([...older.filter(id => hasVariableReceipt(before, id)), ...previousTargets.filter(p => p.messageId === i && p.swipeId === swipe && older.includes(p.id)).map(p => p.id)])];
      let next = removeVariableReceiptIds(before, ids);
      if (i === index) next = appendVariableReceipt(next, write, label, { powerName });
      if (ids.length) pruned.push({ messageId: i, swipeId: swipe, ids });
      if (next !== before) edits.push({ index: i, floor, swipe, before, next });
    }
    if (edits.length && typeof this.helper()?.setChatMessages === 'function') await this.helper().setChatMessages(edits.map(e => ({ message_id: e.index, message: e.next })), { refresh: 'none' });
    else for (const e of edits) { e.floor.mes = e.next; if (Array.isArray(e.floor.swipes)) e.floor.swipes[e.swipe] = e.next; }
    assert(scope(this.context()).key === write.capture.chatKey, '聊天已切换，消息简报尚未核对');
    for (const e of edits) assert(this.context().chat[e.index] === e.floor && (e.floor.swipe_id ?? 0) === e.swipe && (e.floor.mes ?? e.floor.content ?? '') === e.next && stripVariableReceipts(e.next) === stripVariableReceipts(e.before), '消息简报未通过读回核对，角色变量不会再次执行');
    assert(this.context().chat[index] === message && hasStatusReceipt(message.mes ?? message.content ?? '', write.id), '状态栏简报未写入，角色变量不会再次执行');
    const target = { messageId: index, swipeId: message.swipe_id ?? 0 }; if (pruned.length) target.pruned = pruned;
    return target;
  }
  async invoke(method, args, message) {
    const engine = this.runtime(); this.rawPending = true;
    const raw = Promise.resolve().then(() => engine[method](...args));
    raw.finally(() => { this.rawPending = false; }).catch(() => {});
    return boundedCall(() => raw, message);
  }
}
function boundedCall(call, message) {
  let timer; return Promise.race([Promise.resolve().then(call), new Promise((_, reject) => { timer = setTimeout(() => reject(new Error(message)), 30000); })]).finally(() => clearTimeout(timer));
}
