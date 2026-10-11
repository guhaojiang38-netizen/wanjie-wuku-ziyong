import { CONNECTION_FIELDS, themeId, connectionValues } from './preferences.js';
import { MODULE_ID, ASYNC_MARKER, STATE_MARKER, assert, text, buildInjection, clone, emptyState, hash, stable, uid, validateState, stripVariableReceipts } from './core.js';
import { hasVariableReceipt, hasStatusReceipt } from './receipt.js';

import { normalizeTaskRoutes, taskConnection } from './task-routing.js';
export const DEFAULT_SETTINGS = Object.freeze({ mode: 'st', baseUrl: '', model: '', temperature: 0.4, maxTokens: 4096, timeoutSeconds: 90, autoSync: false, catalog: [], position: null, contextMessages: 8, theme:'succubus', activeConnectionProfile:'' });
export function getContext() {
  try { return globalThis.SillyTavern?.getContext?.() || null; } catch { return null; }
}
export function events(ctx) { return { source: ctx?.eventSource || globalThis.eventSource, types: ctx?.eventTypes || ctx?.event_types || globalThis.event_types || {} }; }
let resolvedAccount = null;
function account(ctx) { const handle = ctx?.userHandle || resolvedAccount; assert(typeof handle === 'string' && handle, '当前酒馆账户尚未识别，不能提交本机档案'); return handle; }
export async function resolveAccount(ctx = getContext()) {
  if (ctx?.userHandle) { resolvedAccount = String(ctx.userHandle); return resolvedAccount; }
  try { const users = await import('/scripts/user.js'); if (typeof users.getCurrentUserHandle === 'function') { const handle = users.getCurrentUserHandle(); if (handle && handle !== 'default-user') { resolvedAccount = handle; return resolvedAccount; } } } catch { /* Older clients may expose only the endpoint. */ }
  assert(typeof ctx?.getRequestHeaders === 'function', '当前环境缺少账户识别接口');
  const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 5000);
  try {
    const response = await fetch('/api/users/me', { headers: ctx.getRequestHeaders(), signal: controller.signal });
    // A genuinely absent account route belongs to pre-account single-user clients.
    if (response.status === 404) { resolvedAccount = 'legacy-single-user'; return resolvedAccount; }
    assert(response.ok, '酒馆账户识别失败，请确认当前登录与服务连接');
    const user = await response.json(); assert(typeof user.handle === 'string' && user.handle, '酒馆未返回有效账户标识'); resolvedAccount = user.handle; return resolvedAccount;
  } finally { clearTimeout(timer); }
}
function settingsKey(ctx) { return `${MODULE_ID}:user:${hash(account(ctx))}:settings`; }
export function scope(ctx) {
  assert(ctx?.chatMetadata && Array.isArray(ctx.chat), '请先打开一个酒馆聊天');
  const chatId = ctx.chatId ?? ctx.getCurrentChatId?.();
  assert(chatId !== undefined && chatId !== null && String(chatId), '当前聊天尚无稳定标识，请先保存或打开已有聊天');
  const character = ctx.characters?.[ctx.characterId];
  const owner = ctx.groupId ? `group:${ctx.groupId}` : `character:${character?.avatar || ctx.characterId}`;
  return { key: `user:${hash(account(ctx))}|${owner}|${chatId}`, chatId: String(chatId), owner, character, groupId: ctx.groupId };
}
// Official accountStorage is an in-memory map plus debounced settings save.
// Only native localStorage is an immediate checkpoint; never substitute it here.
function storage() { return globalThis.localStorage; }
function savedSettings(ctx) {
  const settings = ctx?.extensionSettings || globalThis.extension_settings || {};
  let saved = settings[MODULE_ID] || {};
  try { const local = storage()?.getItem(settingsKey(ctx)); if (local) saved = JSON.parse(local); } catch { /* Host settings remain available. */ }
  return saved;
}
export function getApiKey(ctx = getContext()) {
  return String(savedSettings(ctx).apiKey || '').trim();
}
export function getSettings(ctx = getContext()) {
  const result = { ...clone(DEFAULT_SETTINGS), ...savedSettings(ctx) };
  if (!['off', 'st', 'custom'].includes(result.mode)) result.mode = 'off';
  if (!Array.isArray(result.catalog)) result.catalog = [];
  delete result.adapterLibrary; // Managed separately so cached connection forms cannot overwrite it.
  delete result.connectionProfiles;
  result.theme = themeId(result.theme);
  delete result.apiKey; // Keep credentials out of ordinary settings consumers and chat exports.
  return result;
}
function persistAccountSettings(clean,ctx) {
  const settings=ctx?.extensionSettings||globalThis.extension_settings;let durable=false;
  try { storage().setItem(settingsKey(ctx),JSON.stringify(clean));durable=true; } catch { /* Host settings remain the fallback. */ }
  if(settings){settings[MODULE_ID]=clean;const save=ctx?.saveSettingsDebounced||globalThis.saveSettingsDebounced;if(typeof save==='function'){save();durable=true;}}
  assert(durable,'设置无法保存，请检查浏览器存储和酒馆连接');
}
export async function saveSettings(value, ctx = getContext(), apiKey = getApiKey(ctx)) {
  const clean=clone(value);delete clean.apiKey;delete clean.adapterLibrary;
  const latest=savedSettings(ctx);if(latest.adapterLibrary!==undefined)clean.adapterLibrary=clone(latest.adapterLibrary);
  if(latest.connectionProfiles!==undefined)clean.connectionProfiles=clone(latest.connectionProfiles);
  else delete clean.connectionProfiles;
  if(latest.taskRoutes!==undefined)clean.taskRoutes=clone(latest.taskRoutes);
  clean.theme=themeId(clean.theme);
  clean.apiKey=String(apiKey||'').trim();persistAccountSettings(clean,ctx);
}
// Return metadata only: keys never enter ordinary UI settings or chat exports.
export function getConnectionProfiles(ctx=getContext()) {
  const list=savedSettings(ctx).connectionProfiles;
  return Array.isArray(list) ? list.map(p=>({id:p.id,name:p.name,mode:p.mode,model:p.model,keyPresent:Boolean(p.apiKey)})) : [];
}
export function saveConnectionProfile({id='',name,settings,apiKey},ctx=getContext()) {
  const clean=clone(savedSettings(ctx)), list=clone(clean.connectionProfiles || []);
  const label=String(name || '').trim();assert(label && label.length<=60,'方案名称需为1—60字');
  assert(!list.some(p=>p.name===label && p.id!==id),'已有同名方案，请更换名称或选择它后更新');
  assert(!id || list.some(p=>p.id===id),'原方案已不存在，请新建');
  assert(id || list.length<30,'最多保存30个连接方案');
  const normalized=connectionValues(settings,DEFAULT_SETTINGS);
  const profile={id:id || uid('api'),name:label,...Object.fromEntries(CONNECTION_FIELDS.map(k=>[k,normalized[k]])),apiKey:String(apiKey||'').trim()};
  const index=list.findIndex(p=>p.id===profile.id);if(index<0)list.push(profile);else list[index]=profile;
  Object.assign(clean,Object.fromEntries(CONNECTION_FIELDS.map(k=>[k,normalized[k]])),{apiKey:profile.apiKey,connectionProfiles:list,activeConnectionProfile:profile.id});
  if(settings.autoSync!==undefined)clean.autoSync=Boolean(settings.autoSync);
  persistAccountSettings(clean,ctx);return profile.id;
}
export function applyConnectionProfile(id,ctx=getContext()) {
  const clean=clone(savedSettings(ctx)), p=(clean.connectionProfiles || []).find(p=>p.id===id);assert(p,'连接方案已不存在');
  const normalized=connectionValues(p,DEFAULT_SETTINGS);
  Object.assign(clean,Object.fromEntries(CONNECTION_FIELDS.map(k=>[k,normalized[k]])),{apiKey:p.apiKey || '',activeConnectionProfile:id});
  persistAccountSettings(clean,ctx);
}
export function accountSecrets(ctx=getContext()){const s=savedSettings(ctx);return [s.apiKey,...(s.connectionProfiles||[]).map(p=>p.apiKey)].filter(Boolean);}
export function resolveTaskConnection(task,ctx=getContext(),settings=getSettings(ctx),apiKey=getApiKey(ctx)){return taskConnection(task,settings,apiKey,savedSettings(ctx).connectionProfiles||[]);}
export function saveTaskRoutes(routes,ctx=getContext()){const clean=clone(savedSettings(ctx));clean.taskRoutes=normalizeTaskRoutes(routes,getConnectionProfiles(ctx));persistAccountSettings(clean,ctx);}
export function deleteConnectionProfile(id,ctx=getContext()) {
  const clean=clone(savedSettings(ctx));assert((clean.connectionProfiles || []).some(p=>p.id===id),'连接方案已不存在');
  clean.connectionProfiles=clean.connectionProfiles.filter(p=>p.id!==id);
  if(clean.taskRoutes)for(const task of Object.keys(clean.taskRoutes))if(clean.taskRoutes[task]===id)clean.taskRoutes[task]='';
  // Keep the running connection intact when its saved shortcut is removed.
  if(clean.activeConnectionProfile===id)clean.activeConnectionProfile='';
  persistAccountSettings(clean,ctx);
}
export function getAdapterLibrary(ctx=getContext()) {
  return clone(savedSettings(ctx).adapterLibrary??{schemaVersion:1,revision:0,configs:[]});
}
export async function updateAdapterLibrary(mutator,ctx=getContext()) {
  const identity=settingsKey(ctx),work=()=>{
    assert(settingsKey(getContext())===identity,'酒馆账户已切换，适配库操作已取消');
    const latest=savedSettings(ctx),before=clone(latest.adapterLibrary??{schemaVersion:1,revision:0,configs:[]});
    const next=mutator(clone(before));if(stable(next)===stable(before))return before;
    // Read settings inside the lock, and preserve credentials and unrelated account fields.
    const clean=clone(savedSettings(ctx));clean.adapterLibrary=clone(next);persistAccountSettings(clean,ctx);return clone(next);
  };
  return globalThis.navigator?.locks?.request?globalThis.navigator.locks.request(identity+':adapter-library',work):work();
}
export async function worldInfoNames(ctx = getContext()) {
  if (typeof ctx?.getWorldInfoNames === 'function') return ctx.getWorldInfoNames();
  try { const m = await import('/scripts/world-info.js'); return [...(m.world_names || [])]; }
  catch { throw new Error('当前环境未提供世界书列表接口；可以改用导入世界书 JSON'); }
}
export async function loadBook(name, ctx = getContext()) {
  if (typeof ctx?.loadWorldInfo === 'function') { const data = await ctx.loadWorldInfo(name); assert(data, '世界书读取失败'); return data; }
  if (typeof ctx?.getRequestHeaders === 'function') {
    const r = await fetch('/api/worldinfo/get', { method: 'POST', headers: ctx.getRequestHeaders(), body: JSON.stringify({ name }), cache: 'no-cache' });
    assert(r.ok, `世界书读取失败（HTTP ${r.status}）`); return r.json();
  }
  throw new Error('当前环境不支持直接读取世界书，请导入 JSON');
}
function timeout(promise, ms, message) {
  let timer; return Promise.race([promise, new Promise((_, reject) => { timer = setTimeout(() => reject(new Error(message)), ms); })]).finally(() => clearTimeout(timer));
}
async function readSavedMetadata(ctx, captured, fetchImpl, full = false) {
  assert(typeof ctx.getRequestHeaders === 'function', '无服务端核对接口');
  const route = captured.groupId ? '/api/chats/group/get' : '/api/chats/get';
  const body = captured.groupId ? { id: captured.chatId } : { ch_name: captured.character?.name, file_name: captured.chatId, avatar_url: captured.character?.avatar };
  const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 5000);
  try {
    const r = await fetchImpl(route, { method: 'POST', headers: ctx.getRequestHeaders(), body: JSON.stringify(body), cache: 'no-cache', signal: controller.signal });
    assert(r.ok, '酒馆落盘核对失败'); const data = await r.json();
    if (full) return data;
    const header = Array.isArray(data) ? data[0] : data;
    return header?.chat_metadata?.extensions?.[MODULE_ID] || header?.chatMetadata?.extensions?.[MODULE_ID];
  } finally { clearTimeout(timer); }
}
export async function verifyRoleSaved(capture, expectedHash, commitId, { context = getContext, fetchImpl = globalThis.fetch, observedHash = expectedHash } = {}) {
  const ctx = context(), identity = scope(ctx); assert(identity.key === capture.chatKey, '聊天已切换，不能核对旧变量落盘');
  const data = await readSavedMetadata(ctx, identity, fetchImpl, true), header = Array.isArray(data) ? data[0] : data;
  const raw = capture.option.type === 'chat' ? (header?.chat_metadata || header?.chatMetadata)?.variables : Array.isArray(data) ? data[capture.option.message_id + 1]?.variables?.[capture.swipeId] : null;
  assert(raw?.wanjie_wuku_ziyong_commits?.[commitId] === expectedHash && hash(stable(raw.stat_data)) === observedHash, '角色变量的酒馆落盘未通过核对；请保持当前聊天并重试同一笔写回');
  return true;
}
export async function verifyReceiptSaved(capture, target, id, { context = getContext, fetchImpl = globalThis.fetch } = {}) {
  const ctx = context(), identity = scope(ctx); assert(identity.key === capture.chatKey, '聊天已切换，不能核对旧消息回执');
  const data = await readSavedMetadata(ctx, identity, fetchImpl, true), message = Array.isArray(data) ? data[target.messageId + 1] : null;
  assert(message && (message.swipe_id ?? 0) === target.swipeId && hasStatusReceipt(message.mes ?? message.content ?? '', id), '状态栏简报的保存尚未核对，请在武库回执页补充；角色变量不重复执行');
  for (const p of target.pruned || []) {
    const floor = data[p.messageId + 1];
    assert(floor && (floor.swipe_id ?? 0) === p.swipeId && p.ids.every(old => !hasVariableReceipt(floor.mes ?? floor.content ?? '', old)), '旧消息简报收起尚未通过保存核对，请重试整理简报；角色变量不重复执行');
  }
  return true;
}
export class ChatStore {
  constructor({ context = getContext, fetchImpl = globalThis.fetch, lockManager = globalThis.navigator?.locks, storageImpl = storage() } = {}) {
    this.context = context; this.fetchImpl = fetchImpl; this.lockManager = lockManager; this.storageImpl = storageImpl; this.queue = Promise.resolve(); this.lastSave = null; this.listeners = new Set();
  }
  backupKey(captured) { return `${MODULE_ID}:chat:${captured.key}`; }
  read() {
    const ctx = this.context(), captured = scope(ctx);
    const host = ctx.chatMetadata.extensions?.[MODULE_ID];
    let local = null;
    try { const raw = this.storageImpl?.getItem(this.backupKey(captured)); if (raw) { const backup = JSON.parse(raw); if (backup.chatKey === captured.key) local = validateState(backup.state); } } catch { /* A malformed backup never replaces a working host state. */ }
    let selected = host;
    if (local && (!host || local.writeVersion > (host.writeVersion || 0))) selected = local;
    if (!selected) selected = emptyState();
    validateState(selected);
    ctx.chatMetadata.extensions ||= {}; ctx.chatMetadata.extensions[MODULE_ID] = selected;
    return clone(selected);
  }
  capture() { const ctx = this.context(), state = this.read(); return { chatKey: scope(ctx).key, stateId: state.id, revision: state.revision }; }
  assertCapture(captured, state = this.read()) {
    assert(scope(this.context()).key === captured.chatKey, '聊天已经切换，本次结果不会写入其他聊天');
    assert(state.id === captured.stateId && state.revision === captured.revision, '档案已经变化，本次旧结果已丢弃');
  }
  async persist(state) {
    const ctx = this.context(), captured = scope(ctx);
    // A synchronous durable checkpoint comes first. If it fails, no ledger mutation is installed.
    try { this.storageImpl.setItem(this.backupKey(captured), JSON.stringify({ chatKey: captured.key, state })); }
    catch { throw new Error('本机备份写入失败，本次操作未提交；请释放存储空间或导出档案'); }
    ctx.chatMetadata.extensions ||= {}; ctx.chatMetadata.extensions[MODULE_ID] = clone(state);
    // Let the UI show the committed local result while server verification runs.
    this.lastSave = { verified: false, note: '已提交本机账本，正在核对酒馆保存…', at: Date.now(), chatKey: captured.key };
    for (const listener of this.listeners) { try { listener(); } catch { /* Preserve the committed checkpoint. */ } }
    const save = ctx.saveChat || ctx.saveMetadata || globalThis.saveChatConditional;
    let verified = false, note = '已保存本机备份；当前环境未提供酒馆保存接口';
    if (typeof save === 'function') {
      try {
        await timeout(Promise.resolve(save.call(ctx)), 12000, '酒馆保存超时');
        const saved = await readSavedMetadata(ctx, captured, this.fetchImpl);
        verified = saved?.id === state.id && saved.writeVersion === state.writeVersion && stable(saved) === stable(state);
        note = verified ? '已保存，并核对酒馆落盘' : '已保存本机备份；酒馆落盘尚未核对，请保持备份';
      } catch { note = '已保存本机备份；酒馆落盘未核实，可稍后重试保存'; }
    }
    this.lastSave = { verified, note, at: Date.now(), chatKey: captured.key };
    return this.lastSave;
  }
  transact(mutator, { captured = null, facts = true } = {}) {
    const identity = scope(this.context()).key;
    const work = async () => {
      assert(scope(this.context()).key === identity, '聊天已切换，操作已取消');
      const before = this.read(); if (captured) this.assertCapture(captured, before);
      const next = clone(before), result = await mutator(next);
      assert(scope(this.context()).key === identity, '聊天已切换，操作已取消');
      if (stable(next) === stable(before)) return { result, state: before, save: this.lastSave };
      if (facts) next.revision = before.revision + 1;
      next.writeVersion = before.writeVersion + 1; next.updatedAt = Date.now();
      const save = await this.persist(next);
      for (const listener of this.listeners) { try { listener(); } catch { /* A UI error cannot undo the saved transaction. */ } }
      return { result, state: next, save };
    };
    const run = () => this.lockManager?.request ? this.lockManager.request(`${MODULE_ID}:${identity}`, work) : work();
    const promise = this.queue.then(run, run); this.queue = promise.catch(() => {}); return promise;
  }
  async restore(data, currentHashes) {
    const validated = validateState(clone(data));
    return this.transact(next => {
      const writeVersion = next.writeVersion, revision = next.revision;
      Object.assign(next, validated, { id: uid('chat'), revision, writeVersion, historyAnchor: [...currentHashes], syncCursor: currentHashes.length, managementStart: currentHashes.length, managementReviewed: [] });
      delete next.syncTail;
      // A ledger backup is not an MVU floor backup. Restoring it never executes
      // old variable patches against a different chat or a newer card state.
      next.roleLink = null;
      for (const w of next.roleWrites || []) if (w.status === 'pending') w.status = 'abandoned';
      for (const a of next.narrativeActions || []) a.status = 'stopped';
      for (const o of next.creations || []) if(o.status==='queued')o.status='cancelled';
      delete next.archiveMemory;
      for (const p of Object.values(next.powers)) { p.quotes = []; p.archiveReviewed = []; p.archiveStart = currentHashes.length; delete p.archiveUndo; }
    });
  }
}
// Inspect only this extension's bounded memory blocks, never retain/log the full request.
export function requestMemorySnapshot(value, marker = 'WJWK_ARCHIVE_MEMORY_V1') {
  assert(['WJWK_ARCHIVE_MEMORY_V1','WJWK_CREATION_INTENTS_V1','WJWK_TERMINAL_ORDERS_V1'].includes(marker),'未知武库请求块');
  const blocks = String(value || '').match(new RegExp('\\['+marker+'\\][\\s\\S]*?\\[\\/'+marker+'\\]','g')) || [];
  const packet = blocks.join('\n');
  return { packet: packet.slice(0,marker==='WJWK_ARCHIVE_MEMORY_V1'?12000:14000), chars: packet.length, blocks: blocks.length, signature: hash(packet) };
}
export function installInjection({ context = getContext, store, onStatus = () => {}, extraInjection = () => '', onRequest = () => {} }) {
  const ctx = context(), { source, types } = events(ctx);
  const cleanup = [];
  const observe = (kind, read) => { try { onRequest({ kind, read }); } catch { /* Diagnostics must never block generation. */ } };
  const injection = () => { try { const c = context(); const state = store.read(); return buildInjection(state, { user: c.name1, character: c.name2, chat: c.chat }) + extraInjection(state); } catch { return ''; } };
  const listen = (event, handler) => { if (!source?.on || !event) return false; source.on(event, handler); cleanup.push(() => source.removeListener?.(event, handler)); return true; };
  const chat = listen(types.CHAT_COMPLETION_PROMPT_READY, data => {
    if (data?.dryRun || !Array.isArray(data?.chat) || data.chat.some(m => (typeof m.content === 'string' ? m.content : Array.isArray(m.content) ? m.content.filter(p => p.type === 'text').map(p => p.text).join('\n') : '').includes(ASYNC_MARKER))) return;
    for (const message of data.chat) {
      if (typeof message.content === 'string') message.content = stripVariableReceipts(message.content);
      else if (Array.isArray(message.content)) for (const part of message.content) if (part.type === 'text' && typeof part.text === 'string') part.text = stripVariableReceipts(part.text);
    }
    const value = injection();
    // ST keeps a reference to this array after the event; assigning data.chat
    // would leave its actual request unchanged. Mutate the supplied array.
    for (let i = data.chat.length - 1; i >= 0; i--) if (String(data.chat[i].content || '').startsWith(`[${STATE_MARKER}]`)) data.chat.splice(i, 1);
    if (value) { data.chat.push({ role: 'system', content: value }); onStatus('已同步到聊天请求'); }
    const supplied = data.chat;
    observe('chat', marker => requestMemorySnapshot(supplied.map(m => typeof m.content === 'string' ? m.content : Array.isArray(m.content) ? m.content.filter(p=>p.type==='text').map(p=>p.text).join('\n') : '').join('\n'),marker));
  });
  const plainPackets = new WeakMap();
  const plain = listen(types.GENERATE_AFTER_COMBINE_PROMPTS, data => {
    if (data?.dryRun || typeof data?.prompt !== 'string' || data.prompt.includes(ASYNC_MARKER)) return;
    const prior = plainPackets.get(data);
    if (prior && data.prompt.endsWith(prior)) data.prompt = data.prompt.slice(0, -prior.length);
    data.prompt = stripVariableReceipts(data.prompt);
    const value = injection(); if (value) { const suffix = `\n\n${value}`; data.prompt += suffix; plainPackets.set(data, suffix); onStatus('已同步到文本请求'); }
    observe('plain', marker => requestMemorySnapshot(data.prompt,marker));
  });
  return { available: chat || plain, chat, plain, cleanup: () => cleanup.forEach(fn => fn()) };
}

// SillyTavern 1.18.0 uses #send_textarea with a bubbling input event.
// This edits only the unsent composer; it never calls send/generate.
export function composerDraft(doc = globalThis.document) { return doc?.getElementById?.('send_textarea')?.value || ''; }
export function appendComposerIntent(intent, doc = globalThis.document) {
  const input = doc?.getElementById?.('send_textarea');
  assert(input && typeof input.value === 'string' && !input.disabled && !input.readOnly, '正文输入框暂不可用，请稍后再写入建议');
  const value = text(intent, 600); const before = input.value;
  assert(value && before.length + value.length + 2 <= 32000, '输入草稿过长，请先整理正文输入框');
  if (before.trim() !== value && !before.endsWith('\n\n' + value)) input.value = before ? before + '\n\n' + value : value;
  input.dispatchEvent(new Event('input', { bubbles: true })); input.focus?.();
}
