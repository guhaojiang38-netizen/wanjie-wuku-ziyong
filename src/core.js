import { ARCHIVE_READ_FORMAT, withoutThoughts, statusSnapshots } from './archive-reader.js';
export { ARCHIVE_READ_FORMAT } from './archive-reader.js';
import { validateAIWorldbooks } from './ai-worldbooks-data.js';
import { validateArchiveUndo } from './archive-journal.js';
import { validateSpecific, validateCreations, validateTerminalState } from './state-validation.js';
import { ARCHIVE_TEXT_FORMAT } from './state-validation.js';
export { ARCHIVE_TEXT_FORMAT } from './state-validation.js';
import { assert, clone, text, stable, hash } from './primitives.js';
export { assert, clone, text, stable, hash } from './primitives.js';
import { validateAdapterBinding } from './adapters.js';
// Original implementation. No third-party code or artwork is embedded.
import { normalizeArchiveRange, normalizeArchiveAuto } from './archive-scope.js';
import { isMmlc, MMLC_ID, MMLC_MODULES } from './mmlc.js';
import { stripVariableReceipts } from './receipt.js';
export { stripVariableReceipts } from './receipt.js';
export const VERSION = '1.0.0';
export const MODULE_ID = 'wanjie_wuku_ziyong';
export const ASYNC_MARKER = 'WJWK_ASYNC_REQUEST_V1';
export const STATE_MARKER = 'WJWK_COMMITTED_STATE_V1';
const SCALE = 1000000n;
const BAD_KEYS = new Set(['__proto__', 'prototype', 'constructor']);



export function uid(prefix = 'id') {
  return `${prefix}_${globalThis.crypto?.randomUUID?.() || `${Date.now().toString(36)}_${Math.random().toString(36).slice(2)}`}`;
}

export function key(value) {
  const s = text(value, 160);
  assert(s && !BAD_KEYS.has(s) && !/[\u0000-\u001f]/.test(s), '字段标识无效');
  return s;
}
export function amount(value) {
  const s = String(value ?? '').trim();
  assert(/^-?\d{1,120}(?:\.\d{1,6})?$/.test(s), '数量须为有效数字，最多六位小数');
  const negative = s.startsWith('-');
  const [whole, fraction = ''] = (negative ? s.slice(1) : s).split('.');
  const n = BigInt(whole) * SCALE + BigInt(fraction.padEnd(6, '0'));
  return negative ? -n : n;
}
export function decimal(n) {
  const negative = n < 0n, a = negative ? -n : n;
  const tail = String(a % SCALE).padStart(6, '0').replace(/0+$/, '');
  return `${negative ? '-' : ''}${a / SCALE}${tail ? `.${tail}` : ''}`;
}
export function normAmount(value) { return decimal(amount(value)); }


const variableBlocks = () => /(?:\r?\n){0,2}<UpdateVariable\b[^>]*>[\s\S]*?<\/UpdateVariable>/gi;
const historyCache = new WeakMap();
function withoutMvuDisplay(value) {
  return stripVariableReceipts(String(value)).replace(/(?:\r?\n){0,2}<StatusPlaceHolderImpl\s*\/>/gi, '').replace(/(?:\r?\n){0,2}<status_current_variable\b[^>]*>[\s\S]*?<\/status_current_variable>/gi, '');
}
export function storyText(value) {
  return withoutMvuDisplay(value).replace(variableBlocks(), '').replace(/<WJWK-(think|option|status|settle)>[\s\S]*?<\/WJWK-\1>/gi, '').trim();
}
// Archive evidence includes confirmed settlement text; narrative/action readers keep storyText.

export function archiveText(value) {
  return withoutMvuDisplay(value).replace(variableBlocks(), '').replace(/<WJWK-(think|option|status)\b[^>]*>[\s\S]*?<\/WJWK-\1>/gi, '').trim();
}
// Versioned reader: body/settlement and explicitly marked status snapshots; no planning.
export function archiveReadText(value){
 const clean=withoutThoughts(value),body=archiveText(clean),snapshots=statusSnapshots(withoutMvuDisplay(clean).replace(variableBlocks(),''));
 return [body,...snapshots.map(s=>'<WJWK-status>\n'+s+'\n</WJWK-status>')].filter(Boolean).join('\n\n').trim();
}
export function chatHashes(chat = []) {
  return chat.map(m => {
    const signature = [m.is_user, m.is_system, m.name, m.swipe_id ?? 0, m.mes ?? m.content ?? '', m.extra?.bbs_hidden], cached = historyCache.get(m);
    if (cached && signature.every((v, i) => v === cached.signature[i])) return cached.value;
    const mes = stripVariableReceipts(m.mes ?? m.content ?? '');
    const identity = { user: Boolean(m.is_user), system: Boolean(m.is_system), name: m.name || '', swipe: m.swipe_id ?? 0 };
    const patches = [...mes.matchAll(variableBlocks())].map(x => hash(x[0].trim()));
    const full = hash(stable({ ...identity, mes })), body = hash(stable({ ...identity, system: m.extra?.bbs_hidden === true ? false : identity.system, mes: withoutMvuDisplay(mes).replace(variableBlocks(), '') }));
    // Keep the old null-swipe hash for verified migration, rather than trusting
    // the current text as a new baseline when an old anchor no longer matches.
    const legacy = [...new Set([mes, withoutMvuDisplay(mes)].flatMap(value => [value, `${value}\n\n<StatusPlaceHolderImpl/>`]).flatMap(value => [identity.swipe, ...(identity.swipe === 0 ? [null] : [])].map(swipe => hash(stable({ ...identity, mes: value, swipe })))) )];
    // Branch/hide tools turn existing dialogue into system messages. This is
    // presentation state, provided their explicit boolean hidden marker exists.
    // Preserve user/name/swipe/text and variable-patch comparisons unchanged.
    if (typeof m.extra?.bbs_hidden === 'boolean') {
      for (const system of [false, true]) {
        const visible = { ...identity, system };
        legacy.push(hash(stable({ ...visible, mes })), hash(stable({ ...visible, mes: withoutMvuDisplay(mes).replace(variableBlocks(), '') })));
      }
    }
    const value = `h2.${full}.${body}.${legacy.join('_')}.${patches.join('_')}`;
    historyCache.set(m, { signature, value }); return value;
  });
}
export function historyCompatible(before, after) {
  if (before === after) return true;
  const current = String(after).split('.');
  if (current.length !== 5 || current[0] !== 'h2') return false;
  if (/^[a-f0-9]{16}$/.test(before)) return before === current[1] || current[3].split('_').includes(before);
  const old = String(before).split('.');
  if (old.length !== 5 || old[0] !== 'h2' || old[2] !== current[2] && !current[3].split('_').includes(old[2])) return false;
  // Native update instructions may be removed for context cleanup; changing or
  // adding instructions on an anchored floor still counts as a history edit.
  const original = old[4] ? old[4].split('_') : []; let cursor = 0;
  return (current[4] ? current[4].split('_') : []).every(patch => {
    const found = original.indexOf(patch, cursor); if (found < 0) return false; cursor = found + 1; return true;
  });
}
export function historyChanged(state, hashes) {
  const anchor = state.historyAnchor || [];
  return hashes.length < anchor.length || anchor.some((v, i) => !historyCompatible(v, hashes[i]));
}
export function continuesMessage(before, after) {
  if (Boolean(before.is_user) !== Boolean(after.is_user) || Boolean(before.is_system) !== Boolean(after.is_system) || (before.name || '') !== (after.name || '') || (before.swipe_id ?? 0) !== (after.swipe_id ?? 0)) return false;
  const old = withoutMvuDisplay(before.mes ?? before.content ?? ''), current = withoutMvuDisplay(after.mes ?? after.content ?? '');
  let source = 0, target = 0;
  for (const block of old.matchAll(variableBlocks())) {
    const literal = old.slice(source, block.index); if (!current.startsWith(literal, target)) return false; target += literal.length;
    if (current.startsWith(block[0], target)) target += block[0].length;
    else if (/^\s*<UpdateVariable\b/i.test(current.slice(target))) return false;
    source = block.index + block[0].length;
  }
  return current.startsWith(old.slice(source), target);
}
export function emptyState() {
  return { schemaVersion: 1, id: uid('chat'), revision: 0, writeVersion: 0, powers: {}, transactions: [], roleLink: null, roleWrites: [], archiveMemory: { auto: true, budget: 3000, selections: {} }, syncCursor: 0, managementStart: 0, managementReviewed: [], historyAnchor: [], createdAt: Date.now(), updatedAt: Date.now() };
}
export function importBook(data, name = '导入世界书') {
  const source = data?.entries || data?.character_book?.entries || data?.data?.character_book?.entries;
  assert(source && typeof source === 'object', '未找到世界书 entries；请导入世界书 JSON 原文件');
  const entries = Object.entries(source).map(([index, e]) => {
    assert(e && typeof e.content === 'string', '世界书条目缺少正文');
    const entryId = String(e.uid ?? e.id ?? index);
    const label = String(e.comment || e.name || e.key?.[0] || e.keys?.[0] || `词条 ${entryId}`).slice(0, 200);
    assert(e.content.length <= 200000, '单条正文过长');
    return { id: `entry_${hash(`${name}\n${entryId}`)}`, entryId, book: name, name: label, content: e.content, enabledInBook: e.disable !== undefined ? !e.disable : e.enabled !== false, auxiliary: /思维链|选项栏|·/.test(label) };
  });
  assert(entries.length && entries.length <= 2000, '世界书条目数量无效');
  return entries;
}
export function inferResources(entry) {
  const bindings = [
    ['蝴蝶效应', '因果点', ['因果点余额']], ['深蓝', '源质点', ['源质点余额']],
    ['万界网购', '兑换点', ['兑换点余额']], ['指数增长', '势差值Δ', ['势差值Δ']],
    ['故事点', '故事点', ['故事点余额']], ['升变之印', '升变点', ['当前升变点', '升变点余额']],
    ['攻略系统', '恋爱点数', ['恋爱点数', '恋爱点余额']], ['无龙心法', '心能', ['心能', '心能储量']],
    ['念气体系', '念气', ['念气储量', '念气余额']], ['人生模拟', '模拟次数', ['可用模拟次数', '模拟次数余额', '今日模拟', '今日剩余模拟', '今日模拟次数']],
    ['抽奖系统', '今日抽奖次数', ['今日剩余抽奖', '今日剩余次数']],
  ];
  const match = bindings.find(([name]) => entry.name === name || entry.content.trimStart().startsWith(`<${name}>`));
  const found = new Map();
  const add = (name, labels) => { if (!name || name.length > 30) return; const old = found.get(name); found.set(name, { id: `res_${hash(name === '模拟次数' ? '今日模拟次数' : name)}`, name, balance: null, floor: '0', labels: [...new Set([...(old?.labels || []), ...labels, `${name}余额`, name])] }); };
  if (match) add(match[1], match[2]);
  // Read only explicit spendable fields in the primary entry's status template.
  // General inventories, cumulative counts and capability summaries aren't currency.
  const status = entry.content.match(/<状态栏>([\s\S]*?)(?:<结算与回执>|<必要边界>|<终极指向>|<\/状态栏>|$)/)?.[1] || '';
  for (const line of status.split('\n')) {
    const m = line.match(/^\s*(?:[-*]\s*)?(?:【)?([^\n：:【】]{1,40})(?:】)?\s*[：:]/); if (!m) continue;
    const label = m[1].trim().replace(/\*\*/g, '');
    // A multi-currency overview is not a currency named "主要".
    if (/^(?:主要|各类|多币种)余额$/.test(label)) continue;
    if (match?.[2].includes(label)) continue;
    if (/余额$/.test(label)) add(label.replace(/^(?:当前|可用|剩余)/, '').replace(/余额$/, ''), [label]);
    else if (/点数$/.test(label) || /^(?:当前|可用|剩余).+点$/.test(label) && !/(?:重点|节点|落点|锚点|起点|终点)$/.test(label)) add(label.replace(/^(?:当前|可用|剩余)/, ''), [label]);
    else if (/储量$/.test(label) && !/共同|总|库存/.test(label)) add(label.replace(/^(?:当前|可用)/, '').replace(/储量$/, ''), [label]);
  }
  return [...found.values()];
}
export function resourcesForPower(power, catalog = []) {
  const entry = catalog.find(e => e.id === power.id);
  const content = power.primaryRules || entry?.content || power.rules;
  return inferResources({ name: power.name, content });
}
export function upgradeResources(power, catalog = []) {
  for (const detected of resourcesForPower(power, catalog)) {
    const old = power.resources[detected.id];
    power.resources[detected.id] = old ? { ...detected, ...old, labels: [...new Set([...(old.labels || []), ...detected.labels])] } : detected;
  }
  return power;
}
export function createPower(entry, companions = []) {
  const resources = inferResources(entry);
  const rules = [entry.content, ...companions.map(e => e.content)].join('\n\n');
  return {
    id: entry.id, name: entry.name, source: { book: entry.book, entryId: entry.entryId },
    rules, primaryRules: entry.content, ruleVersion: hash(rules), companions: companions.map(e => ({ id: e.entryId, name: e.name })),
    active: true, resources: Object.fromEntries(resources.map(r => [r.id, r])), fields: {}, assets: {},
    cycles: {}, simulations: {}, managementRecords: {}, quotes: [], fixedQuotes: [], pricing: entry.name === '蝴蝶效应' ? 'fixed_effect' : 'stateful', createdAt: Date.now(),
  };
}
export function extractPanelBalances(power, chat) {
  const findings = {};
  const names = [...new Set([power.name, power.name.replace(/（.*?）|\(.*?\)/g, '').trim()])].filter(Boolean);
  const escape = value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const plainText = value => value.replace(/<\/t[dh]>\s*<t[dh]\b[^>]*>/gi, ': ').replace(/<(?:table|tr|p|div|h[1-6])\b[^>]*>/gi, '\n').replace(/<br\s*\/?\s*>/gi, '\n').replace(/<\/(?:p|div|li|tr|h[1-6])>/gi, '\n').replace(/<[^>]*>/g, '').replace(/&nbsp;|&#160;/gi, ' ').replace(/&minus;|&#8722;/gi, '-').replace(/\*\*|__/g, '').replace(/[\u2212\uff0d]/g, '-').replace(/】(?=[^\n])/g, '】\n');
  for (let i = chat.length - 1; i >= 0; i--) {
    const message = chat[i];
    if (message.is_user || message.is_system) continue;
    const raw = String(message.mes ?? message.content ?? '');
    const clean = raw.replace(/<WJWK-(think|option|settle)>[\s\S]*?<\/WJWK-\1>/gi, '');
    const tagged = [...clean.matchAll(/<WJWK-status\b[^>]*>([\s\S]*?)<\/WJWK-status>/gi)].map(m => m[1]);
    // Also support visible Markdown/HTML panels when no WJWK wrapper survives.
    const panels = (tagged.length ? tagged : [clean]).reverse();
    for (const panel of panels) {
      const all = plainText(panel);
      const headers = [...all.matchAll(/(?:^|\n)\s*(?:#{1,6}\s*)?【([^】]+)】[^\n]*|(?:^|\n)\s*#{1,6}\s+([^\n]+)/g)];
      const related = headers.filter(h => names.some(name => new RegExp(`^${escape(name)}(?:[·・\\s:：|｜-]|$)`).test((h[1] || h[2] || '').trim())));
      let sections;
      if (related.length) sections = related.map(h => { const next = headers.find(n => n.index > h.index); return all.slice(h.index, next?.index ?? all.length); });
      else if (names.some(name => all.includes(name))) sections = [all];
      else if (tagged.length) continue;
      else {
        // An unwrapped balance is usable only beside a nearby exact power name.
        const at = names.map(name => all.indexOf(name)).find(n => n >= 0); if (at === undefined) continue;
        sections = [all.slice(at, at + 2000)];
      }
      const plain = sections.join('\n').replace(/[【】]/g, '');
      for (const resource of Object.values(power.resources)) {
        if (findings[resource.id]) continue;
        const labels = [...new Set([...(resource.labels || []), `${resource.name}余额`, resource.name])];
        for (const label of labels) {
          const number = '-?(?:\\d{1,3}(?:,\\d{3})+|\\d{1,120})(?:\\.\\d{1,6})?';
          const m = plain.match(new RegExp(`(?:^|\\n)\\s*(?:[-*|]\\s*)?(?:当前|可用|剩余)?${escape(label)}\\s*[：:|]\\s*[\\[［(（]?\\s*(?:剩余|当前|现有|可用)?\\s*(${number})(?=[\\s;；,，\\]］)）点次个份/／|]|$)(?:\\s*(?:点|次)?\\s*[\\]］]?\\s*(?:->|→|=>)\\s*[\\[［]?\\s*(${number})(?=[\\s;；,，\\]］)）点次个份/／|]|$))?`));
          if (m) { try { findings[resource.id] = { balance: normAmount((m[2] || m[1]).replace(/,/g, '')), source: `第 ${i + 1} 条模型回复 · ${power.name}`, messageIndex: i, evidence: m[0].trim() }; } catch { /* Ignore unparseable amounts; never substitute zero. */ } break; }
        }
      }
    }
  }
  return findings;
}
export function narrativeMessages(chat, start = 0, tail = null) {
  const indexes = chat.slice(start).map((_m, offset) => start + offset);
  if (tail && tail.index < start && chat[tail.index]) indexes.unshift(tail.index);
  return indexes.map(index => {
    const m = chat[index], content = storyText(m.mes ?? m.content ?? '');
    return { index, is_user: Boolean(m.is_user), name: m.name || '', content: tail?.index === index && index < start ? content.slice(tail.offset).trim() : content, is_system: Boolean(m.is_system) };
  }).filter(m => !m.is_system && m.content);
}
export function parseJSON(raw) {
  assert(typeof raw === 'string' && raw.length <= 500000, '模型返回为空或过长');
  const clean = raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  try { return JSON.parse(clean); } catch { /* Locate a complete JSON object without evaluating code. */ }
  const start = clean.indexOf('{');
  assert(start >= 0, '模型没有返回 JSON 对象');
  let quoted = false, escaped = false, depth = 0;
  for (let i = start; i < clean.length; i++) {
    const c = clean[i];
    if (quoted) { if (escaped) escaped = false; else if (c === '\\') escaped = true; else if (c === '"') quoted = false; continue; }
    if (c === '"') quoted = true;
    else if (c === '{') depth++;
    else if (c === '}' && --depth === 0) return JSON.parse(clean.slice(start, i + 1));
  }
  throw new Error('模型返回的 JSON 不完整；本次没有改变账目');
}
function list(value, max, label) { assert(Array.isArray(value) && value.length <= max, `${label}格式无效`); return value; }
function positive(value) { const n = amount(value); assert(n > 0n, '投入或取得数量必须大于零'); return decimal(n); }
export function consumableAsset(asset) {
  return Boolean(asset) && asset.permanent !== true && !/能力|功法|技艺|技能|强化|血脉|体质/.test(asset.kind || '');
}
export function normalizeOperation(raw, power, state, contextHash, { event = false, evidenceText = '' } = {}) {
  assert(!isMmlc(power), '漫漫长路只统计成果，不参与执行或结算');
  assert(raw && typeof raw === 'object', '操作格式无效');
  const ruleQuote = text(raw.ruleQuote, 1200);
  assert(ruleQuote.length >= 6 && power.rules.includes(ruleQuote), '操作缺少可在词条正文核对的规则依据');
  const costs = list(raw.costs || [], 24, '投入').map(c => {
    assert(c.kind === 'resource' || c.kind === 'asset', '不支持的投入类别');
    const id = key(c.id); assert((c.kind === 'resource' ? power.resources : power.assets)[id], '投入指向了不存在的资源或物品');
    if (c.kind === 'asset') assert(consumableAsset(power.assets[id]), '永久成果或可复用能力不能作为消耗品');
    return { kind: c.kind, id, amount: positive(c.amount) };
  });
  const effects = list(raw.effects || [], 30, '效果').map(e => {
    const type = key(e.type);
    if (type === 'resource_credit') { const id = key(e.id); assert(power.resources[id], '收益指向了不存在的资源'); return { type, id, amount: positive(e.amount) }; }
    if (type === 'asset_grant') return { type, name: text(e.name, 200), kind: text(e.kind || '成果', 100), description: text(e.description, 8000), quantity: positive(e.quantity || '1'), permanent: e.permanent === true };
    if (type === 'field_set') return { type, key: key(e.key), label: text(e.label || e.key, 200), value: text(String(e.value), 8000) };
    if (type === 'asset_update') { const id = key(e.id); assert(power.assets[id], '更新指向了不存在的物品或能力'); return { type, id, description: text(e.description, 8000) }; }
    throw new Error('模型返回了首版不支持的效果类别');
  });
  assert(effects.length || costs.length, '没有实际变化的操作不需要执行');
  assert(effects.every(e => e.type !== 'asset_grant' || (e.name && e.description)), '所得名称或效果为空');
  const requirements = list(raw.requirements || [], 20, '条件').map(r => text(r, 600));
  // Require the model to resolve factual prerequisites before offering execution.
  assert(raw.ready === true, text(String(raw.unavailableReason || '成立条件尚未确定，请补充目标或当前事实'), 1000));
  const evidence = event ? list(raw.evidence || [], 12, '事件证据').map(e => text(e, 1600)) : [];
  if (event) assert(evidence.length && evidence.every(e => e.length >= 6 && evidenceText.includes(e)), '剧情结算缺少可核对的新增叙事证据');
  const spec = stable({ effects: effects.map(e => { const x = { ...e }; delete x.name; return x; }), requirements });
  let actualCosts = costs, reused = false;
  if (!event && power.pricing === 'fixed_effect') {
    const known = power.fixedQuotes.find(q => q.spec === spec);
    if (known) { actualCosts = clone(known.costs); reused = true; }
  }
  return { id: uid(event ? 'event' : 'op'), powerId: power.id, label: text(raw.label, 200), description: text(raw.description || '', 8000), ruleQuote, costs: actualCosts, effects, requirements, evidence, spec, reused, baseRevision: state.revision, stateId: state.id, ruleVersion: power.ruleVersion, contextHash, createdAt: Date.now(), event };
}
export function builtInOperations(power, state, contextHash) {
  const resource = Object.values(power.resources).find(r => r.name === '因果点');
  if (power.name !== '蝴蝶效应' || !resource) return [];
  const ruleQuote = '{{user}}能够直接消耗1因果点，将一份固定基准底蕴永久叠加到自身';
  if (!power.rules.includes(ruleQuote)) return [];
  return [normalizeOperation({ label: '基准本源增益', description: '肉体、灵魂与相应承载能力永久增加一份固定基准底蕴。保留自身种族、人格、记忆与主观连续性。', ruleQuote, ready: true, costs: [{ kind: 'resource', id: resource.id, amount: '1' }], effects: [{ type: 'asset_grant', name: '固定基准本源增益', kind: '永久强化', description: '一份健康、完整、未超凡成年人本源模板对应的完整肉体与灵魂底蕴，永久叠加，增加相应承载能力；保留自身种族、人格、记忆与主观连续性。', quantity: '1', permanent: true }], requirements: [] }, power, state, contextHash)];
}
export function costTotals(operation) {
  const totals = new Map();
  for (const c of operation.costs) { const k = `${c.kind}:${c.id}`; totals.set(k, (totals.get(k) || 0n) + amount(c.amount)); }
  return totals;
}
export function canAfford(power, operation) {
  for (const [k, total] of costTotals(operation)) {
    const colon = k.indexOf(':'), kind = k.slice(0, colon), id = k.slice(colon + 1);
    const item = (kind === 'resource' ? power.resources : power.assets)[id];
    if (!item) return { ok: false, reason: '投入对象已不存在' };
    if (kind === 'asset' && !consumableAsset(item)) return { ok: false, reason: '永久成果或可复用能力不能作为消耗品' };
    const balance = kind === 'resource' ? item.balance : item.quantity;
    if (balance === null || balance === undefined) return { ok: false, reason: `${item.name}余额尚未确定` };
    const floor = kind === 'resource' ? amount(item.floor ?? '0') : 0n;
    if (amount(balance) - total < floor) return { ok: false, reason: `${item.name}不足，差额 ${decimal(floor + total - amount(balance))}` };
  }
  return { ok: true, reason: '' };
}
export function applyOperation(state, operation, contextHash, anchor, { allowEvent = false } = {}) {
  const previous = state.transactions.find(t => t.id === operation.id);
  if (previous) return { duplicate: true, transaction: previous };
  assert(operation.stateId === state.id, '档案已更换，旧方案不能执行');
  assert(operation.baseRevision === state.revision, '账目已经变化，请重新生成或重新选择操作');
  assert(operation.contextHash === contextHash, '剧情已经变化，请重新生成或重新选择操作');
  const power = state.powers[operation.powerId];
  assert(power?.active, '该词条尚未接入或已经暂停');
  assert(!isMmlc(power), '漫漫长路只统计成果，不参与执行或结算');
  assert(operation.ruleVersion === power.ruleVersion, '词条正文已经变化，请重新生成方案');
  assert(!operation.event || allowEvent, '剧情核算不能从普通执行入口提交');
  const affordable = canAfford(power, operation); assert(affordable.ok, affordable.reason);
  // Validate the entire effect list before changing a single balance.
  for (const e of operation.effects) {
    if (e.type === 'resource_credit') assert(power.resources[e.id]?.balance !== null && power.resources[e.id]?.balance !== undefined, '收益资源缺少原余额，不能猜测入账');
    if (e.type === 'asset_update') assert(power.assets[e.id], '待更新资产已经不存在');
  }
  const changes = [];
  for (const [k, total] of costTotals(operation)) {
    const colon = k.indexOf(':'), kind = k.slice(0, colon), id = k.slice(colon + 1);
    const item = (kind === 'resource' ? power.resources : power.assets)[id];
    const field = kind === 'resource' ? 'balance' : 'quantity', before = item[field];
    item[field] = decimal(amount(before) - total); changes.push(`${item.name}：${before} → ${item[field]}`);
  }
  for (const e of operation.effects) {
    if (e.type === 'resource_credit') { const r = power.resources[e.id]; assert(r.balance !== null, `${r.name}缺少原余额，不能猜测入账`); const before = r.balance; r.balance = decimal(amount(before) + amount(e.amount)); changes.push(`${r.name}：${before} → ${r.balance}`); }
    else if (e.type === 'asset_grant') {
      const specification = stable({ name: e.name, kind: e.kind, description: e.description, permanent: e.permanent });
      const existing = Object.values(power.assets).find(a => a.specification === specification);
      if (existing) existing.quantity = decimal(amount(existing.quantity) + amount(e.quantity));
      else { const id = uid('asset'); power.assets[id] = { id, name: e.name, kind: e.kind, description: e.description, quantity: e.quantity, permanent: e.permanent, specification }; }
      changes.push(`${e.name} +${e.quantity}；${e.description}`);
    } else if (e.type === 'field_set') { power.fields[e.key] = { label: e.label, value: e.value }; changes.push(`${e.label}：${e.value}`); }
    else if (e.type === 'asset_update') { power.assets[e.id].description = e.description; delete power.assets[e.id].specification; changes.push(`${power.assets[e.id].name}：${e.description}`); }
  }
  if (!operation.event && power.pricing === 'fixed_effect' && !power.fixedQuotes.some(q => q.spec === operation.spec)) power.fixedQuotes.push({ spec: operation.spec, label: operation.label, costs: clone(operation.costs), effects: clone(operation.effects), requirements: clone(operation.requirements), createdAt: Date.now() });
  const transaction = { id: operation.id, powerId: power.id, label: operation.label, type: operation.event ? 'story' : 'operation', changes, ruleQuote: operation.ruleQuote, evidence: clone(operation.evidence), costs: clone(operation.costs), effects: clone(operation.effects), at: Date.now(), atMessage: anchor.length };
  state.transactions.push(transaction); state.historyAnchor = [...anchor];
  return { duplicate: false, transaction };
}
export function managementRecordCurrent(record, _chat) {
  return Boolean(record);
}
export function publicPower(power, chat = null) {
  return { id: power.id, name: power.name, active: power.active, ...publicWorkflows(power, chat), resources: clone(power.resources), fields: clone(power.fields), assets: clone(power.assets), managementRecords: Object.fromEntries(Object.entries(power.managementRecords || {}).filter(([, r]) => r.status === 'active' && (!Array.isArray(chat) || managementRecordCurrent(r, chat))).map(([id, r]) => [id, { label: r.label, category: r.category, value: r.value }])), fixedQuotes: clone(power.fixedQuotes) };
}
export function buildInjection(state, names = {}) {
  const powers = Object.values(state.powers).filter(p => !isMmlc(p)), enabled = powers.filter(p => p.active);
  if (!powers.length) return '';
  return `[${STATE_MARKER}]\n这是万界武库插件已保存的当前事实，适用人物：${names.user || '{{user}}'}。版本：${state.revision}。\n已完成操作无需再次扣付、领取或重新裁定。按所得完整规格描写其实际效力。过去面板与本记录冲突时，以本记录及其后真正新增的事实为准。插件接入暂停不回收永久所得。\n本轮新发生的金手指收益可在原有 WJWK 回执中展示，作为待核对的新事件；不要把已经记账的操作再次当成新收益。\n周期 pending 仅表示待正文处理；recorded 是玩家核对正文已结算。模拟 available 为候选，selected 为玩家选择且尚未到账，received 为玩家核对正文已到账。waiting 条件未满足，不可兑现。只承接已启用词条的有效选择，严格按原规则和现实条件处理；登记不授予额外次数或收益，不因插件选择而默认已发奖。\n当前档案：\n${JSON.stringify(powers.map(p => publicPower(p, names.chat)))}\n近期已完成记录：\n${JSON.stringify(state.transactions.filter(t => t.type !== 'workflow' && t.powerId !== MMLC_ID).slice(-8).map(t => ({ label: t.label, powerId: t.powerId, changes: t.changes, atMessage: t.atMessage })))}\n当前接入的完整规则（保留原词条能力与边界）：\n${enabled.map(p => `【${p.name}】\n${p.rules.replaceAll('{{user}}', names.user || '{{user}}').replaceAll('{{char}}', names.character || '{{char}}')}`).join('\n\n')}\n[/${STATE_MARKER}]`;
}
export function validateState(data) {
  validateAIWorldbooks(data?.aiWorldbooks);
  assert(data?.schemaVersion === 1 && typeof data.id === 'string', '档案格式或版本不受支持');
  assert(Number.isSafeInteger(data.revision) && data.revision >= 0 && Number.isSafeInteger(data.writeVersion) && data.writeVersion >= 0, '档案版本无效');
  assert(data.powers && typeof data.powers === 'object' && !Array.isArray(data.powers) && Object.keys(data.powers).length <= 200, '词条档案无效');
  list(data.transactions, 100000, '结算记录'); list(data.historyAnchor, 1000000, '剧情锚点');
  assert(Number.isSafeInteger(data.syncCursor) && data.syncCursor >= 0, '剧情同步游标无效');
  if (data.syncTail) assert(Number.isSafeInteger(data.syncTail.index) && data.syncTail.index >= 0 && data.syncTail.index < data.syncCursor && Number.isSafeInteger(data.syncTail.offset) && data.syncTail.offset >= 0, '续写同步位置无效');
  data.managementStart ??= data.syncCursor; data.managementReviewed ||= [];
  assert(Number.isSafeInteger(data.managementStart) && data.managementStart >= 0, '管理核对起点无效');
  list(data.managementReviewed, 100000, '管理来源记录').forEach(s => assert(typeof s === 'string' && /^\d+:\d+:[a-f0-9]{16}$/.test(s), '管理来源标识无效'));
  validateTerminalState(data);
  validateCreations(data);
  data.roleWrites ||= []; list(data.roleWrites, 100000, '角色写回记录');
  data.narrativeActions ||= []; list(data.narrativeActions, 100000, '叙事行动');
  const actionIds = new Set();
  for (const a of data.narrativeActions) {
    key(a.id); key(a.powerId); assert(!actionIds.has(a.id) && data.transactions.some(t => t.id === a.id && t.powerId === a.powerId), '叙事行动缺少唯一结算依据'); actionIds.add(a.id);
    assert(['waiting', 'generating', 'presented', 'confirmed', 'stopped'].includes(a.status), '叙事行动状态无效');
    text(a.label, 200); text(a.intent, 8000); text(a.note, 2000); text(a.description, 12000); text(a.ruleQuote, 12000);
    assert(Number.isSafeInteger(a.attempts) && a.attempts >= 0, '叙事行动次数无效');
    list(a.costs, 24, '行动投入'); list(a.effects, 30, '行动所得'); list(a.requirements, 20, '行动条件'); list(a.variableChanges, 200, '行动变量差异');
    assert(a.before?.id === a.powerId && a.after?.id === a.powerId && stable(a.effects) === stable(data.transactions.find(t => t.id === a.id).effects) && stable(a.costs) === stable(data.transactions.find(t => t.id === a.id).costs), '叙事行动与结算不一致');
    if (['presented', 'confirmed'].includes(a.status)) assert(a.result, '行动缺少对应正文');
    if (a.review) { assert(typeof a.review.covered === 'boolean', '正文核对状态无效'); for (const c of list(a.review.checks, 40, '正文核对项')) { text(c.item, 100); text(c.reason, 2000); assert(typeof c.ok === 'boolean', '正文核对项无效'); list(c.quotes, 8, '正文证据').forEach(q => text(q, 4000)); } }
    for (const r of list(a.presentations || (a.result ? [a.result] : []), 10000, '正文呈现记录')) { assert(Number.isSafeInteger(r.index) && r.index >= 0 && Number.isSafeInteger(r.swipeId) && r.swipeId >= 0 && Number.isSafeInteger(r.offset) && r.offset >= 0 && Number.isSafeInteger(r.length) && r.length > 0, '历史正文位置无效'); text(r.textHash, 100); text(r.excerpt, 6000); }
    if (a.result) { const r = a.result; assert(Number.isSafeInteger(r.index) && r.index >= 0 && Number.isSafeInteger(r.swipeId) && r.swipeId >= 0 && Number.isSafeInteger(r.offset) && r.offset >= 0 && Number.isSafeInteger(r.length) && r.length > 0, '行动正文位置无效'); text(r.textHash, 100); text(r.excerpt, 6000); }
  }
  data.favoriteActions ||= []; list(data.favoriteActions, 100, '常用行动');
  for (const a of data.favoriteActions) { key(a.id); key(a.powerId); text(a.label, 120); assert(text(a.goal, 8000), '常用行动意图为空'); assert(!('costs' in a) && !('patches' in a) && !('effects' in a), '常用行动不能携带旧交易或变量补丁'); }
  for (const w of data.roleWrites) { key(w.id); assert(['pending', 'applied', 'abandoned'].includes(w.status), '角色写回状态无效'); list(w.patches, 64, '角色变化'); list(w.changes, 200, '角色变化预览'); text(w.afterStatHash, 100); text(w.linkVersion, 100); assert(w.capture && typeof w.capture === 'object', '角色写回目标无效'); }
  if (data.roleLink) {
    const l = data.roleLink; assert(l.enabled === true && ['chat', 'message'].includes(l.scope), '角色接入状态无效'); text(l.character, 500); list(l.roots, 100, '角色区域').forEach(p => text(p, 2000));
    for (const r of list(l.rules, 100, '角色规则')) { text(r.name, 200); text(r.content, 200000); }
    assert(hash(stable(l.rules)) === l.ruleVersion && l.bindings && typeof l.bindings === 'object' && !Array.isArray(l.bindings), '角色接入规则无效');
    Object.values(l.bindings).forEach(p => text(p, 2000));
  }
  if (data.archiveMemory) {
    const m = data.archiveMemory;
    assert(typeof m.auto === 'boolean' && Number.isSafeInteger(m.budget) && m.budget >= 750 && m.budget <= 12000 && m.selections && typeof m.selections === 'object' && !Array.isArray(m.selections) && Object.keys(m.selections).length <= 64, '正文记忆设置无效');
    for (const [identity, selection] of Object.entries(m.selections)) {
      const parts = identity.split('/');
      const archive = parts.length === 2 && data.powers[parts[0]]?.archives?.[parts[1]];
      const order = parts.length === 3 && parts[1] === 'terminal' && data.powers[parts[0]] && data.terminalOrders?.some(o=>o.id===parts[2]&&o.powerId===parts[0]&&o.status==='presented');
      assert(archive || order, '正文记忆对应档案或已交正文安排不存在');
      assert(['next', 'pinned', 'exclude'].includes(selection.mode) && text(selection.token, 200), '正文记忆方式无效');
    }
    if (m.last) assert(text(m.last.packet, 12000) && Number.isSafeInteger(m.last.at) && Number.isSafeInteger(m.last.index) && m.last.index >= 0 && Number.isInteger(m.last.count) && m.last.count > 0 && m.last.count <= 16, '上次正文记忆无效');
  }
  for (const [id, p] of Object.entries(data.powers)) {
    validateWorkflows(p);
    if (p.adapterBinding !== undefined) validateAdapterBinding(p.adapterBinding);
    p.archiveStart ??= data.managementStart;
    assert(Number.isSafeInteger(p.archiveStart) && p.archiveStart >= 0, '档案核对起点无效');
    p.archiveReviewed ||= [];
    for (const a of list(p.archiveReviewed, 100000, '档案核对进度')) assert(Number.isSafeInteger(a.index) && a.index >= 0 && Number.isSafeInteger(a.swipeId) && a.swipeId >= 0 && Number.isSafeInteger(a.length) && a.length >= 0 && /^[a-f0-9]{16}$/.test(a.textHash) && (a.format === undefined || a.format === ARCHIVE_TEXT_FORMAT || a.format === ARCHIVE_READ_FORMAT), '档案核对进度无效');
    if (p.archiveAuto !== undefined) p.archiveAuto = normalizeArchiveAuto(p.archiveAuto);
    if (p.autoArchiveStart !== undefined) assert(Number.isSafeInteger(p.autoArchiveStart) && p.autoArchiveStart >= 0, '自动更新起点无效');
    if (p.archiveReadRange !== undefined) p.archiveReadRange = normalizeArchiveRange(p.archiveReadRange);
    if (p.autoArchiveSave !== undefined) assert(typeof p.autoArchiveSave === 'boolean', '自动保存设置无效');
    if (p.autoArchiveReview !== undefined) assert(typeof p.autoArchiveReview === 'boolean', '自动整理设置无效');
    if (p.playerGuide) {
      assert(typeof p.playerGuide.ruleVersion === 'string' && /^[a-f0-9]{16}$/.test(p.playerGuide.ruleVersion) && text(p.playerGuide.summary, 400).trim(), '玩法说明无效');
      const abilities = list(p.playerGuide.abilities, 6, '玩法方向'); assert(abilities.length, '玩法方向为空');
      for (const a of abilities) assert(text(a.name, 80).trim() && text(a.description, 400).trim() && text(a.ruleQuote, 1200).length >= 6 && (p.playerGuide.ruleVersion !== p.ruleVersion || p.rules.includes(a.ruleQuote)), '玩法说明依据无效');
    }
    validateArchiveUndo(p.archiveUndo);
    p.archives ||= {};
    assert(typeof p.archives === 'object' && !Array.isArray(p.archives) && Object.keys(p.archives).length <= 512, '经营档案无效');
    for (const [archiveId, r] of Object.entries(p.archives)) {
      key(archiveId);
      for (const row of [r, ...list(r.history, 1000, '档案历史')]) {
        validateSpecific(row.specific);
        assert(row!==r||row.ownerPowerId===undefined||row.ownerPowerId===p.id,'当前档案所属金手指不一致');
        if (row.module !== undefined) assert(isMmlc(p) && MMLC_MODULES.some(m => m.id === row.module), '统计模块归属无效');
        assert(row.id === archiveId && ['population', 'environment', 'facility', 'research', 'member', 'skill', 'bond', 'record'].includes(row.type) && row.type === r.type && ['active', 'planned', 'working', 'ended'].includes(row.status), '经营档案身份或状态无效');
        assert(text(row.name, 200).trim() && Number.isSafeInteger(row.updatedAt) && row.updatedAt >= 0, '经营档案名称或时间无效');
        assert(row.fields && typeof row.fields === 'object' && !Array.isArray(row.fields) && Object.keys(row.fields).length <= 10 && Object.values(row.fields).some(Boolean), '经营档案缺少实际内容');
        for (const [field, value] of Object.entries(row.fields)) { key(field); text(value, 4000); }
        assert(['manual', 'story'].includes(row.source?.type) && text(row.source.note, 600).trim(), '经营档案缺少人工核对来源');
        if (row.source.type === 'story') { text(row.source.quote || '', 4000); text(row.source.ruleQuote || '', 1200); }
        for (const a of [row.source.anchor, ...list(row.source.anchors || [], 1000, '档案来源')].filter(Boolean)) assert(Number.isSafeInteger(a.index) && a.index >= 0 && Number.isSafeInteger(a.swipeId) && a.swipeId >= 0 && (a.length === undefined || Number.isSafeInteger(a.length) && a.length >= 0) && /^[a-f0-9]{16}$/.test(a.textHash) && (a.format === undefined || a.format === ARCHIVE_TEXT_FORMAT || a.format === ARCHIVE_READ_FORMAT), '经营档案剧情位置无效');
        assert(row === r || row.history === undefined, '档案历史不可嵌套');
      }
    }
    if (p.lastArchiveUpdate !== undefined) {
      const u=p.lastArchiveUpdate;
      assert(u && Number.isSafeInteger(u.at) && u.at>=0 && typeof u.automatic==='boolean' && Number.isInteger(u.arrangements) && u.arrangements>=0 && u.arrangements<=64, '最近成果整理记录无效');
      assert(Array.isArray(u.sourceIndices) && u.sourceIndices.length<=80 && u.sourceIndices.every(i=>Number.isSafeInteger(i)&&i>=0) && new Set(u.sourceIndices).size===u.sourceIndices.length, '最近整理楼层无效');
      assert(Array.isArray(u.records) && u.records.length<=64 && new Set(u.records.map(r=>r.id)).size===u.records.length, '最近整理对象无效');
      for (const row of u.records) assert(row && p.archives[row.id] && /^[a-f0-9]{16}$/.test(row.signature) && ['created','updated','recovered'].includes(row.kind), '最近整理对象来源无效');
    }
    p.managementRecords ||= {};
    assert(typeof p.managementRecords === 'object' && !Array.isArray(p.managementRecords) && Object.keys(p.managementRecords).length <= 128, '管理记录无效');
    for (const [recordId, r] of Object.entries(p.managementRecords)) {
      key(recordId); assert(r.id === recordId && ['progress', 'arrangement', 'record'].includes(r.category) && ['active', 'ended'].includes(r.status), '管理记录身份或类型无效');
      assert(text(r.label, 200) && text(r.value, 8000), '管理记录缺少内容');
      assert(Number.isSafeInteger(r.updatedAt) && r.updatedAt >= 0 && r.source && ['story', 'manual'].includes(r.source.type), '管理记录来源无效');
      if (r.source.type === 'story') { assert(Number.isSafeInteger(r.source.index) && r.source.index >= 0 && Number.isSafeInteger(r.source.swipeId) && r.source.swipeId >= 0 && /^[a-f0-9]{16}$/.test(r.source.textHash), '正文来源位置无效'); assert(Number.isSafeInteger(r.source.length) && r.source.length > 0 && typeof text(r.source.quote ?? '', 4000) === 'string' && typeof text(r.source.ruleQuote ?? '', 1200) === 'string', '正文来源证据无效'); }
      else assert(text(r.source.note, 600), '人工校准缺少说明');
    }
    key(id); assert(id === p.id, '词条标识不一致'); text(p.name, 200); text(p.rules, 2000000); assert(hash(p.rules) === p.ruleVersion, '正文版本校验不一致');
    assert(p.pricing === 'fixed_effect' || p.pricing === 'stateful', '报价方式无效');
    for (const map of [p.resources, p.fields, p.assets]) assert(map && typeof map === 'object' && !Array.isArray(map), '词条状态无效');
    for (const [rId, r] of Object.entries(p.resources)) { key(rId); assert(r.id === rId, '资源标识不一致'); text(r.name, 200); const floor = amount(r.floor ?? '0'); if (r.balance !== null) assert(amount(r.balance) >= floor, '资源余额低于允许的最低余额'); }
    for (const [fieldId, f] of Object.entries(p.fields)) { key(fieldId); text(f.label, 200); text(f.value, 8000); }
    for (const [assetId, a] of Object.entries(p.assets)) { key(assetId); assert(a.id === assetId, '所得标识不一致'); text(a.name, 200); text(a.description, 8000); assert(amount(a.quantity) >= 0n, '库存数量无效'); }
    list(p.quotes || [], 1000, '方案'); list(p.fixedQuotes || [], 10000, '已定报价');
    assert(typeof p.active === 'boolean', '接入状态无效');
    p.fixedQuotes ||= [];
    for (const quote of p.fixedQuotes) {
      text(quote.spec, 500000); text(quote.label, 200);
      for (const c of list(quote.costs, 24, '已定报价投入')) { assert(c.kind === 'resource' || c.kind === 'asset', '已定报价投入类别无效'); key(c.id); assert((c.kind === 'resource' ? p.resources : p.assets)[c.id], '已定报价引用不存在的资源'); positive(c.amount); }
      list(quote.effects, 30, '已定报价效果'); list(quote.requirements, 20, '已定报价条件').forEach(r => text(r, 600));
      assert(quote.spec === stable({ effects: quote.effects.map(e => { const x = { ...e }; delete x.name; return x; }), requirements: quote.requirements }), '已定报价规格不一致');
    }
    // Untrusted backup proposals are never executable: the UI regenerates/normalizes them.
    p.quotes = [];
  }
  return data;
}


// Story identifiers are explicit player input; wall-clock timestamps never grant eligibility.
export function workflowIdentity(value) {
  const s = text(value, 200).normalize('NFKC').replace(/\s+/g, ' ').trim();
  assert(s, '请填写明确的剧情周期／事件标识'); return s;
}
export function workflowText(value) {
  return withoutMvuDisplay(value).replace(variableBlocks(), '').replace(/<WJWK-(think|option|status)>[\s\S]*?<\/WJWK-\1>/gi, '').trim();
}
export function workflowSource(power, chat, values) {
  const index = Number(values.sourceIndex), m = chat[index];
  assert(Number.isSafeInteger(index) && index >= 0 && m && !m.is_user && !m.is_system, '请选择实际角色正文的消息序号');
  const body = workflowText(m.mes ?? m.content ?? ''), quote = text(values.quote ?? '', 4000), ruleQuote = text(values.ruleQuote ?? '', 1200);
  return { type: 'story', index, swipeId: m.swipe_id ?? 0, textHash: hash(body), length: body.length, quote, ruleQuote, ruleVersion:power.ruleVersion };
}
export function workflowCurrent(record, _chat, _power = null) {
  return Boolean(record);
}
export function applyWorkflow(power, action, values, chat) {
  assert(power?.active, '请先选择启用的词条'); power.cycles ||= {}; power.simulations ||= {};
  if (action === 'cycle' || action === 'simulation') {
    const cycleKey = workflowIdentity(values.cycleKey), trigger = workflowIdentity(values.trigger);
    const map = action === 'cycle' ? power.cycles : power.simulations, id = `workflow_${hash(stable([trigger, cycleKey]))}`;
    assert(!map[id], '该触发事项在这个剧情周期已有记录，请沿用原记录');
    assert(Object.keys(map).length < 128, '单词条此类档案已达128项');
    const source = workflowSource(power, chat, values), label = text(values.label, 200); assert(label, '请填写档案名称');
    const record = { id, cycleKey, trigger, label, source, status: 'pending' };
    if (action === 'simulation') {
      const lines = text(values.candidates, 16000).split('\n').map(s => s.trim()).filter(Boolean);
      assert(lines.length > 0 && lines.length <= 32, '每份模拟须有1至32项已在正文出现的成果');
      record.limit = Number(values.limit); assert(Number.isSafeInteger(record.limit) && record.limit >= 1 && record.limit <= lines.length, '可选数量须在1与成果项数之间，按原规则填写');
      record.candidates = {};
      for (const [i, line] of lines.entries()) {
        const parts = line.split('｜'); assert(parts.length >= 2 && parts.length <= 3, '成果格式：名称｜描述｜可选或等待条件');
        const name = text(parts[0], 200), description = text(parts[1], 4000), availability = parts[2]?.trim() || '可选';
        assert(name && description, '成果名称与描述不能为空');
        assert(['可选', '等待条件'].includes(availability), '成果状态只能填可选或等待条件');
        assert(!Object.values(record.candidates).some(c => c.name === name), '同份档案的成果名称不可重复');
        const cid = `candidate_${i}`; record.candidates[cid] = { id: cid, name, description, status: 'available', availability: availability === '可选' ? 'ready' : 'waiting' };
      }
    }
    map[id] = record; return `${label}：已登记，等待正文后续承接`;
  }
  const record = (action === 'cycle-receipt' ? power.cycles : power.simulations)[key(values.id)];
  assert(record, '档案不存在');
  if (action === 'cycle-receipt') {
    assert(record.status === 'pending', '该周期已确认，不能重复确认');
    const receipt = workflowSource(power, chat, values), result = text(values.result, 4000);
    assert(result, '请填写结算结果');
    record.receipt = receipt; record.result = result; record.status = 'recorded'; return `${record.label}：正文已结算（仅登记）`;
  }
  const candidate = record.candidates[key(values.candidateId)]; assert(candidate, '候选成果不存在');
  if (action === 'select') {
    assert(candidate.status === 'available' && candidate.availability === 'ready', '成果已选择或仍在等待条件');
    assert(Object.values(record.candidates).filter(c => c.status !== 'available').length < record.limit, '本次可选数量已用完');
    candidate.status = 'selected'; return `${record.label}：已选择 ${candidate.name}，等待正文承接，尚未到账`;
  }
  const receipt = workflowSource(power, chat, values);
  if (action === 'ready') {
    assert(candidate.status === 'available' && candidate.availability === 'waiting', '该成果无需再次确认条件');
    candidate.availability = 'ready'; candidate.readySource = receipt; return `${candidate.name}：玩家核对条件已满足，可选择`;
  }
  assert(action === 'simulation-receipt' && candidate.status === 'selected', '只可确认已选择且尚未到账的成果');
  candidate.status = 'received'; candidate.receipt = receipt; return `${candidate.name}：正文已到账（仅登记，不再次发奖）`;
}
function validateWorkflowSource(source, power) {
  assert(source?.type === 'story' && Number.isSafeInteger(source.index) && source.index >= 0 && Number.isSafeInteger(source.swipeId) && source.swipeId >= 0 && /^[a-f0-9]{16}$/.test(source.textHash) && Number.isSafeInteger(source.length) && source.length > 0, '周期／模拟正文来源无效');
  text(source.quote ?? '', 4000); text(source.ruleQuote ?? '', 1200); assert(/^[a-f0-9]{16}$/.test(source.ruleVersion), '周期／模拟规则标识无效');
}
export function validateWorkflows(power) {
  for (const type of ['cycles', 'simulations']) {
    power[type] ??= {}; const map = power[type];
    assert(map && typeof map === 'object' && !Array.isArray(map) && Object.keys(map).length <= 128, '周期／模拟档案格式或容量无效');
    for (const [id, r] of Object.entries(map)) {
      key(id); assert(r.id === id && text(r.label, 200), '周期／模拟身份无效');
      assert(workflowIdentity(r.cycleKey) === r.cycleKey && workflowIdentity(r.trigger) === r.trigger && id === `workflow_${hash(stable([r.trigger, r.cycleKey]))}`, '周期／模拟标识不一致');
      validateWorkflowSource(r.source, power);
      if (type === 'cycles') {
        assert(['pending', 'recorded'].includes(r.status), '周期状态无效');
        if (r.status === 'recorded') { validateWorkflowSource(r.receipt, power); assert(text(r.result, 4000), '周期到账依据无效'); }
        else assert(!r.receipt && !r.result, '待结算周期不能携带到账结果');
      } else {
        assert(r.status === 'pending' && r.candidates && typeof r.candidates === 'object' && !Array.isArray(r.candidates), '模拟候选无效');
        const candidates = Object.entries(r.candidates); assert(candidates.length >= 1 && candidates.length <= 32 && Number.isSafeInteger(r.limit) && r.limit >= 1 && r.limit <= candidates.length, '模拟可选数量无效');
        const names = new Set(); let selected = 0;
        for (const [cid, c] of candidates) {
          key(cid); assert(c.id === cid && text(c.name, 200) && text(c.description, 4000) && !names.has(c.name), '模拟成果内容或身份无效'); names.add(c.name);
          assert(['available', 'selected', 'received'].includes(c.status) && ['ready', 'waiting'].includes(c.availability), '模拟成果状态无效');
          if (c.readySource) { validateWorkflowSource(c.readySource, power); assert(c.availability === 'ready', '模拟条件证据无效'); }
          if (c.status !== 'available') { selected++; assert(c.availability === 'ready', '等待条件成果不可选择'); }
          if (c.status === 'received') { validateWorkflowSource(c.receipt, power); }
          else assert(!c.receipt, '未到账成果不可携带到账证据');
        }
        assert(selected <= r.limit, '模拟选择超过规则数量');
      }
    }
  }
}
export function publicWorkflows(power, chat) {
  const current = r => workflowCurrent(r, chat, power);
  return { cycles: Object.values(power.cycles || {}).filter(current).map(r => ({ cycleKey:r.cycleKey, trigger:r.trigger, label:r.label, status:r.status, result:r.result })),
    simulations: Object.values(power.simulations || {}).filter(current).map(r => ({ cycleKey:r.cycleKey, trigger:r.trigger, label:r.label, limit:r.limit, candidates:Object.values(r.candidates).map(c => ({ name:c.name, description:c.description, status:c.status, availability:c.availability })) })) };
}
