import { assert, clone, hash, stable, chatHashes, historyChanged, storyText, narrativeMessages, text } from './core.js';
import { getContext, scope, composerDraft, appendComposerIntent } from './host.js';
import { sceneArchiveContext } from './archives.js';
import { sceneActionsPrompt } from './model.js';
import { actionReady, pendingActions, narrativePacket, resultText, storyEvidenceCurrent, reviewPrompt, validateReview, normalizeCandidates, favoriteIntent } from './narrative.js';

export const narrativeMethods = {
  openManualStory(id) {
    assert(!this.busy && !this.mainBusy && !this.committing && !this.narrativeLaunching, '请等待当前操作完成');
    const snapshot = this.contextSnapshot(), action = snapshot.state.narrativeActions?.find(a => a.id === id);
    assert(action && (['waiting', 'generating', 'presented'].includes(action.status) || action.status === 'confirmed' && !storyEvidenceCurrent(action, snapshot.ctx.chat)), '这笔行动当前不需要确认');
    const minimum = Math.max(0, (snapshot.state.transactions.find(t => t.id === id)?.atMessage || 1) - 1);
    this.manualStoryDraft = { id, minimum, actionHash: hash(stable(action)), contextHash: hash(stable(snapshot.hashes)), captured: { chatKey: snapshot.chatKey, stateId: snapshot.state.id, revision: snapshot.state.revision } };
    this.ui.showManualStory(action, snapshot.ctx.chat, minimum);
  },
  async saveManualStory(data) {
    assert(!this.busy && !this.mainBusy && !this.committing && !this.narrativeLaunching, '请等待当前操作完成');
    const draft = this.manualStoryDraft; assert(draft, '手动承接表单已失效');
    const snapshot = this.contextSnapshot(), index = Number(data.values.sourceIndex), floor = snapshot.ctx.chat[index];
    assert(hash(stable(snapshot.hashes)) === draft.contextHash, '正文已变化，请重新选择承接依据');
    const quote = text(data.values.quote, 6000).trim(), body = storyText(floor?.mes ?? floor?.content ?? ''), offset = body.indexOf(quote);
    assert(Number.isSafeInteger(index) && index >= draft.minimum && floor && !floor.is_user && !floor.is_system && quote.length >= 6 && offset >= 0, '请选择已有模型回复，并逐字摘录至少6字承接证据');
    const result = { index, swipeId: floor.swipe_id ?? 0, offset, length: quote.length, textHash: hash(quote), excerpt: quote, at: Date.now(), manual: true };
    this.committing = true; this.refresh();
    try {
      await this.store.transact(next => {
        assert(hash(stable(chatHashes(getContext().chat))) === draft.contextHash, '保存期间正文已变化');
        const a = next.narrativeActions?.find(a => a.id === draft.id);
        assert(a && hash(stable(a)) === draft.actionHash && ['waiting', 'generating', 'presented', 'confirmed'].includes(a.status), '行动状态已变化，请重新核对');
        a.presentations ||= [];
        if (a.result && !a.presentations.some(r => stable(r) === stable(a.result))) a.presentations.push(clone(a.result));
        a.presentations.push(result); a.result = result; a.status = 'confirmed'; a.confirmedAt = Date.now(); delete a.review; delete a.error;
        // An interrupted multi-action attempt must not leave its other actions stuck.
        if (this.narrativeAttempt?.ids.includes(a.id)) for (const other of next.narrativeActions) if (other.id !== a.id && this.narrativeAttempt.ids.includes(other.id) && other.status === 'generating') other.status = 'waiting';
      }, { captured: draft.captured, facts: false });
      if (this.narrativeAttempt?.ids.includes(draft.id)) this.narrativeAttempt = null;
      this.manualStoryDraft = null; this.ui.closeDialog();
      this.notice('已按所选正文登记承接；角色写回状态仍独立保留，没有再次结算。');
    } finally { this.committing = false; this.refresh(); }
  },
  narrativeInjection(state) {
    const attempt = this.narrativeAttempt;
    if (!attempt || attempt.stopped || attempt.chatKey !== scope(getContext()).key || attempt.stateId !== state.id || !this.mainBusy || this.narrativeGenerationType !== attempt.type) return '';
    const actions = attempt.ids.map(id => state.narrativeActions?.find(a => a.id === id)).filter(a => a && actionReady(state, a));
    if (actions.length !== attempt.ids.length) return '';
    attempt.prompted = true;
    return narrativePacket(actions, this.names());
  },
  async beginNarrative(type) {
    if (!['normal', 'continue', 'regenerate', 'swipe'].includes(type)) return;
    const snapshot = this.contextSnapshot();
    if (this.narrativeAttempt?.chatKey === snapshot.chatKey) {
      if (this.narrativeAttempt.ended && !this.narrativeAttempt.finishing) await this.stopNarrative('上次未完成呈现，本轮重新承接同一行动');
      else return;
    }
    if (snapshot.state.roleWrites?.some(w => w.status === 'pending')) return;
    const lastIndex = snapshot.ctx.chat.length - 1;
    let actions;
    if (['regenerate', 'swipe'].includes(type)) {
      actions = (snapshot.state.narrativeActions || []).filter(a => ['presented', 'confirmed'].includes(a.status) && a.result?.index === lastIndex);
      actions = actions.filter(a => { try { resultText(snapshot.ctx, a); return true; } catch { return false; } });
    } else actions = pendingActions(snapshot.state);
    actions = actions.filter(a => actionReady(snapshot.state, a));
    if (!actions.length) return;
    const attempt = { ids: actions.map(a => a.id), chatKey: snapshot.chatKey, stateId: snapshot.state.id,
      beforeHashes: snapshot.hashes, lastIndex, type, prompted: false, rendered: null, ended: false,
      beforeText: storyText(snapshot.ctx.chat[lastIndex]?.mes ?? ''), stopped: false };
    this.narrativeAttempt = attempt;
    try {
      await this.store.transact(next => { for (const id of attempt.ids) { const a = next.narrativeActions.find(a => a.id === id); assert(a && actionReady(next, a), '行动尚未完成写回'); a.status = 'generating'; a.attempts++; delete a.error; } }, { facts: false, captured: { chatKey: snapshot.chatKey, stateId: snapshot.state.id, revision: snapshot.state.revision } });
    } catch (error) { if (this.narrativeAttempt === attempt) this.narrativeAttempt = null; this.notice(`行动仍待承接：${error.message}`, true); }
  },
  async stopNarrative(reason = '生成中断，行动仍待承接') {
    const attempt = this.narrativeAttempt; if (!attempt) return;
    attempt.stopped = true;
    if (scope(getContext()).key === attempt.chatKey && this.store.read().id === attempt.stateId) {
      await this.store.transact(next => { for (const a of next.narrativeActions || []) if (attempt.ids.includes(a.id)) { a.status = 'waiting'; a.error = reason; } }, { facts: false });
    }
    if (this.narrativeAttempt === attempt) this.narrativeAttempt = null;
    this.refresh();
  },
  async completeNarrative() {
    const attempt = this.narrativeAttempt;
    if (!attempt || attempt.finishing || attempt.stopped || !attempt.ended || !attempt.prompted || !Number.isInteger(attempt.rendered)) return;
    const snapshot = this.contextSnapshot();
    if (snapshot.chatKey !== attempt.chatKey || snapshot.state.id !== attempt.stateId) return;
    const index = attempt.rendered, floor = snapshot.ctx.chat[index];
    if (!floor || floor.is_user || floor.is_system) return;
    const replacing = ['continue', 'regenerate', 'swipe'].includes(attempt.type);
    const prefix = replacing ? attempt.beforeHashes.slice(0, attempt.lastIndex) : attempt.beforeHashes;
    if (replacing ? index !== attempt.lastIndex : index < attempt.beforeHashes.length) return;
    const body = storyText(floor.mes ?? floor.content ?? ''), offset = attempt.type === 'continue' && body.startsWith(attempt.beforeText) ? attempt.beforeText.length : 0, text = body.slice(offset).trim();
    if (!text || text === '...') return this.stopNarrative('没有得到完整的行动正文，请重试承接');
    // Keep the exact offset; whitespace belongs to the hashed source too.
    const result = { index, swipeId: floor.swipe_id ?? 0, offset, length: body.length - offset, textHash: hash(body.slice(offset)), excerpt: text.slice(0, 6000), at: Date.now() };
    attempt.finishing = true;
    try {
      await this.store.transact(next => {
        assert(this.narrativeAttempt === attempt && scope(getContext()).key === attempt.chatKey && next.id === attempt.stateId && hash(storyText(getContext().chat[index]?.mes ?? '').slice(offset)) === result.textHash, '正文在保存承接记录时变化');
        for (const a of next.narrativeActions || []) if (attempt.ids.includes(a.id)) {
          a.presentations ||= [];
          if (a.result && !a.presentations.some(r => stable(r) === stable(a.result))) a.presentations.push(clone(a.result));
          a.presentations.push(clone(result));
          a.status = 'presented'; a.result = clone(result); delete a.review; delete a.confirmedAt;
        }
        // Only the floor explicitly regenerated with this same event can move its
        // existing anchor. Other history edits still require the old rebase flow.
        if (replacing && attempt.type !== 'continue' && next.historyAnchor.length > index && !historyChanged({ historyAnchor: next.historyAnchor }, attempt.beforeHashes)) next.historyAnchor[index] = snapshot.hashes[index];
      }, { facts: false });
      if (this.narrativeAttempt === attempt) this.narrativeAttempt = null;
      this.notice('行动正文已生成，待核对实际呈现。可查看正文证据或确认已承接；账目没有再次结算。');
    } catch (error) { attempt.finishing = false; this.notice(`正文已生成，承接记录未保存：${error.message}`, true); }
    this.refresh();
  },
  async unfoldStory(id = null) {
    assert(!this.busy && !this.mainBusy && !this.committing && !this.narrativeLaunching, '请等待当前操作完成');
    this.ensureStable();
    const state = this.store.read(), actions = pendingActions(state);
    if (id) assert(actions.some(a => a.id === id), '该行动没有等待承接');
    assert(actions.length && actions.every(a => actionReady(state, a)), '行动写回尚未完成，请先重试角色写回');
    const ctx = getContext(); assert(typeof ctx.generate === 'function', '此酒馆未提供正常剧情生成接口。行动已保留，发送下一条消息时会承接。');
    // Normal Generate reads the native composer. Never consume a player's draft.
    const draft = globalThis.document?.querySelector?.('#send_textarea')?.value;
    if (String(draft || '').trim()) { this.notice('行动已保留。输入框有草稿，请发送该条消息来承接，或清空草稿后点“展开待承接行动”。'); return; }
    assert(ctx.onlineStatus !== 'no_connection', '酒馆主模型尚未连接，行动已保留，可连接后重试');
    const launch = { chatKey: scope(ctx).key, stateId: state.id };
    const sameChat = () => scope(getContext()).key === launch.chatKey && this.store.read().id === launch.stateId;
    this.narrativeLaunching = launch; this.refresh();
    try {
      await ctx.generate('normal', { automatic_trigger: true, quiet_prompt: '承接玩家已确认的万界武库行动，按行动数据展开下一段正文。', quietToLoud: true, skipWIAN: false });
      if (sameChat() && this.narrativeAttempt) { this.narrativeAttempt.ended = true; await this.completeNarrative(); }
      if (sameChat() && this.narrativeAttempt) await this.stopNarrative('本次未得到已完成且已注入行动的正文，请重试承接');
    } catch (error) { if (sameChat()) { await this.stopNarrative(`生成未完成：${error.message}`); this.notice(`账目已保存，剧情仍待承接：${error.message}`, true); } }
    finally { if (this.narrativeLaunching === launch) this.narrativeLaunching = false; if (sameChat()) this.mainBusy = false; this.refresh(); this.scheduleRoleRead(); }
  },
  async reviewStory(id) {
    const snapshot = this.ensureStable({ model: true }), action = snapshot.state.narrativeActions?.find(a => a.id === id);
    assert(action?.status === 'presented', '请先生成这次行动对应的正文');
    const text = resultText(snapshot.ctx, action), { data } = await this.query(reviewPrompt(action, text), snapshot);
    const review = validateReview(data, action, text);
    await this.store.transact(next => { const current = next.narrativeActions.find(a => a.id === id); assert(current?.status === 'presented' && resultText(getContext(), current) === text, '正文已变化，请重新核对'); current.review = review; }, { facts: false });
    this.notice(review.covered ? '模型已给出逐项正文证据，请核对后确认承接。' : '正文存在缺失项；可查看核对说明，重试时只补呈现。'); this.refresh();
  },
  async setStoryStatus(id, status) {
    assert(!this.busy && !this.mainBusy && !this.committing && !this.narrativeLaunching, '请等待当前操作完成');
    if (status === 'confirmed') this.ensureStable();
    await this.store.transact(next => {
      const a = next.narrativeActions?.find(a => a.id === id); assert(a, '行动记录不存在');
      if (status === 'confirmed') { assert(a.status === 'presented', '请先展开正文'); resultText(getContext(), a); a.confirmedAt = Date.now(); }
      if (status === 'waiting') { assert(a.status !== 'stopped', '该行动已停止自动承接'); delete a.review; }
      a.status = status;
    }, { facts: false });
    this.refresh(); this.notice(status === 'confirmed' ? '已由玩家确认本次正文承接。' : status === 'stopped' ? '已停止这笔行动的自动承接；已结算所得保留，投入不会自动返还。' : '已保留同一行动等待补写；无需重新生成方案或扣费。');
  },
  openSceneSuggestions() {
    const s = this.ensureStable(), p = s.state.powers[this.powerId]; assert(p?.active, '请先选择已接入的金手指');
    const c = this.sceneCandidates;
    if (c && (c.powerId !== p.id || c.stateId !== s.state.id || c.revision !== s.state.revision || c.contextHash !== hash(stable(s.hashes)))) this.sceneCandidates = null;
    this.refresh(); this.ui.showSceneSuggestions(p, this.sceneCandidates);
  },
  async sceneActions(data = {}) {
    let snapshot = this.ensureStable({ model: true }), power = snapshot.state.powers[this.powerId]; assert(power?.active, '请先选择接入词条');
    const focus = text(data.values?.focus ?? this.ui.sceneFocus ?? '', 1000), draft = composerDraft().slice(-2000);
    const previous=this.sceneCandidates;
    let kept=[];
    if(data.regenerateOnly){
      assert(previous&&previous.powerId===power.id&&previous.stateId===snapshot.state.id&&previous.revision===snapshot.state.revision&&previous.contextHash===hash(stable(snapshot.hashes))&&previous.focus===focus&&previous.draftHash===hash(draft),'场景、目标或草稿已变化，请重新生成建议');
      const indices=[...new Set(new FormData(data.form).getAll('keep-scene').map(Number))];
      assert(indices.every(i=>Number.isInteger(i)&&i>=0&&i<previous.actions.length),'保留路线选择无效');
      kept=indices.map(i=>previous.actions[i]);
      if(kept.length===previous.actions.length)return this.notice('所有路线都已保留，无需调用AI；取消勾选后可替换其他方向。');
    }
    this.ui.sceneFocus = focus;
    let roleUnavailable = '';
    // Advice does not need an MVU write or a wallet refresh. Optional read-only
    // role context is used only when it comes from the latest assistant floor.
    if (snapshot.state.roleLink) {
      try {
        snapshot = this.roleSnapshot(snapshot);
        const latest = snapshot.ctx.chat.findLastIndex(m => !m.is_user && !m.is_system);
        assert(snapshot.roleView.capture.option.type === 'chat' || snapshot.roleView.capture.option.message_id >= latest, '当前角色变量仍在更新');
      } catch (e) { roleUnavailable = '角色变量未能读取；只依据正文与已确认档案'; delete snapshot.roleView; delete snapshot.roleContract; }
    }
    const count = Math.max(1, Math.min(12, Number(this.settings.contextMessages) || 8));
    const narrative = narrativeMessages(snapshot.ctx.chat, Math.max(0, snapshot.ctx.chat.length - count)).map(m => ({ ...m, content: m.content.slice(-10000), truncated: m.content.length > 10000 }));
    const archives = sceneArchiveContext(power, snapshot.ctx.chat, focus + '\n' + draft + '\n' + narrative.slice(-3).map(m => m.content).join('\n'));
    this.sceneQuery = true; this.ui.setSceneBusy(true);
    try {
      const { data: result, contextHash } = await this.query(sceneActionsPrompt({ power, narrative, archives, requestedGoal: focus, draft, roleContract: snapshot.roleContract, roleUnavailable, keptActions:kept, previousActions:data.regenerateOnly?previous.actions.filter(a=>!kept.includes(a)):[], names: this.names() }), snapshot);
      assert(composerDraft().slice(-2000) === draft && this.ui.sceneFocus === focus, '生成建议期间输入草稿已变化，请按新意向重新生成');
      const rawKept=kept.map(a=>Object.fromEntries(['kind','label','goal','benefit','uncertainty','archiveIds','sourceIndex','sceneQuote','ruleQuote'].map(k=>[k,a[k]])));
      assert(Array.isArray(result.actions)&&result.actions.length<=5-kept.length,'新路线超过剩余数量');
      const actions=normalizeCandidates({actions:[...rawKept,...result.actions]},power,{archives,narrative});
      this.sceneCandidates = { powerId: power.id, stateId: snapshot.state.id, revision: snapshot.state.revision, contextHash, focus, draftHash:hash(draft), keptIndices:kept.map((_,i)=>i), roleUnavailable, coverage: archives, message: String(result.message || '').slice(0, 1000), actions };
      this.refresh(); this.ui.showSceneSuggestions(power, this.sceneCandidates);
    } finally { this.sceneQuery = false; this.ui.setSceneBusy(false); }
  },
  useSceneSuggestion(index) {
    const s = this.ensureStable(), c = this.sceneCandidates, a = c?.actions[Number(index)];
    assert(!this.busy && a && c.powerId === this.powerId && c.stateId === s.state.id && c.revision === s.state.revision && c.contextHash === hash(stable(s.hashes)), '建议已失效，请按当前场景重新生成');
    appendComposerIntent(a.goal); this.ui.closeDialog(); this.ui.setOpen(false); this.notice('建议已写入正文草稿，已有输入保留。修改后由你发送。');
  },
  async saveFavorite() {
    const snapshot = this.ensureStable(), power = snapshot.state.powers[this.powerId];
    await this.store.transact(next => favoriteIntent(next, power, this.ui.goal), { facts: false }); this.refresh(); this.notice('已收藏行动意图。下次按当时状态重新报价和映射角色字段。');
  },
};
