export { normalizePlayerGuide, currentPlayerGuide } from './player-guide.js';
import { archiveSources } from './archive-review.js';
import { normalizeArchiveAuto } from './archive-scope.js';
import { assert, text, stable, hash, chatHashes } from './core.js';
import { archiveCurrent } from './archives.js';

// Rule explanations describe possibilities, never ownership or completed events.


export function playerTimeline(power, chat) {
  const rows = [];
  for (const r of Object.values(power.archives || {})) {
    if (!archiveCurrent(r, chat)) continue;
    const versions = [...r.history, r];
    versions.forEach((row, i) => {
      if (!archiveCurrent(row, chat)) return;
      const previous = versions[i - 1], changes = Object.entries(row.fields).filter(([k, v]) => v && (!previous || previous.fields[k] !== v));
      if (!changes.length && previous?.status === row.status) return;
      rows.push({ ...(row.module ? { module: row.module } : {}), id: row.id, version: i, name: row.name, type: row.type, status: row.status, at: row.updatedAt, source: row.source,
        text: changes.map(([, v]) => v).join('；').slice(0, 500), first: !previous });
    });
  }
  return rows.sort((a, b) => b.at - a.at || a.id.localeCompare(b.id) || b.version - a.version).slice(0, 8);
}
export const playerHomeMethods = {
  openPlayerReview() {
    const s = this.ensureStable(), p = s.state.powers[this.powerId], pending = this.pendingArchiveReview;
    assert(pending && p?.active && pending.powerId === p.id && pending.captured.stateId === s.state.id && pending.captured.revision === s.state.revision, '整理结果已变化，请重新整理');
    this.ui.showArchiveReview(pending, p, s.ctx.chat);
  },
  async togglePlayerAuto() {
    const s = this.ensureStable(), p = s.state.powers[this.powerId]; assert(p?.active, '请先选择当前金手指');
    assert(!this.busy && !this.mainBusy && !this.committing, '请等待当前操作完成');
    await this.store.transact(next => { next.powers[p.id].autoArchiveReview = !p.autoArchiveReview; if (p.autoArchiveReview) next.powers[p.id].autoArchiveSave = false; }, { facts: false, captured: { chatKey: s.chatKey, stateId: s.state.id, revision: s.state.revision } });
    this.refresh(); this.notice(p.autoArchiveReview ? '已关闭正文后自动整理。' : '已开启：当前选中的金手指在正文完成后调用一次已配置的API整理变化，确认后保存。');
  },
  async togglePlayerAutoSave() {
    const s = this.ensureStable(), p = s.state.powers[this.powerId]; assert(p?.active, '请先选择当前金手指');
    assert(!this.busy && !this.mainBusy && !this.committing, '请等待当前操作完成');
    const enabled = !p.autoArchiveSave;
    await this.store.transact(next => { next.powers[p.id].autoArchiveSave = enabled; if (enabled) { next.powers[p.id].autoArchiveReview = true; next.powers[p.id].autoArchiveStart ??= Math.max(0,s.ctx.chat.length-1); } }, { facts: false, captured: { chatKey: s.chatKey, stateId: s.state.id, revision: s.state.revision } });
    this.refresh(); this.notice(enabled ? '已开启自动整理并保存：正文完成后调用已配置API，整理出的成果按字段格式保存并保留历史；无需保持打开该词条，漫漫长路八个模块一并更新；已有待确认结果先由你处理。' : '已关闭自动保存，后续整理结果由你确认。');
  },
  schedulePlayerReview(type) {
    if (!['normal', 'continue', 'regenerate', 'swipe'].includes(type)) return;
    const s = this.contextSnapshot(); if(this.settings.mode === 'off')return;
    const powerIds=Object.values(s.state.powers).filter(p=>p.active&&p.autoArchiveReview&&(p.autoArchiveSave||p.id===this.powerId)).map(p=>p.id);
    if(!powerIds.length)return;
    const capture = { chatKey:s.chatKey, powerId:powerIds[0], powerIds, stateId:s.state.id, hash:hash(stable(chatHashes(s.ctx.chat))) };
    if(this.lastPlayerAuto === stable(capture))return;
    this.playerAutoQueued = capture;
    clearTimeout(this.playerReviewTimer); this.playerReviewTimer = null; this.resumePlayerReview();
  },
  archiveUpdateWaiting() {
    if (this.role?.rawPending) return true;
    try { return this.role?.engine?.()?.isDuringExtraAnalysis?.() === true; }
    catch { return true; } // An available but unreadable parser must not be treated as ready.
  },
  resumePlayerReview() {
    if (!this.playerAutoQueued || this.playerAutoRunning || this.playerReviewTimer || this.busy || this.mainBusy || this.committing || this.continuation || this.pendingArchiveReview || this.archiveReviewJob || this.terminalDraft || this.terminalRequest || this.creationDraft || this.creationRequest || this.archiveToolRequest || this.referenceDraft) return;
    if (this.archiveUpdateWaiting()) {
      this.archiveAutoStatus ||= {};
      let changed = false;
      for (const id of this.playerAutoQueued.powerIds || [this.playerAutoQueued.powerId]) { if (this.archiveAutoStatus[id] !== '等待变量更新完成') changed = true; this.archiveAutoStatus[id] = '等待变量更新完成'; }
      if (changed) this.refresh();
      return;
    }
    this.playerReviewTimer = setTimeout(() => { this.playerReviewTimer = null; void this.runPlayerReview(); }, 450);
  },
  async runPlayerReview() {
    const capture = this.playerAutoQueued; if (!capture || this.playerAutoRunning) return;
    const now = this.contextSnapshot();
    if(this.settings.mode==='off'||now.chatKey!==capture.chatKey||now.state.id!==capture.stateId){this.playerAutoQueued=null;return;}
    // Keep queued work while other operations finish; refresh resumes it when idle.
    if (this.busy || this.mainBusy || this.committing || this.continuation || this.pendingArchiveReview || this.archiveReviewJob || this.terminalDraft || this.terminalRequest || this.creationDraft || this.creationRequest || this.archiveToolRequest || this.referenceDraft) return;
    if (this.archiveUpdateWaiting()) { this.resumePlayerReview(); return; }
    const id = stable(capture); this.playerAutoQueued = null;
    if (this.lastPlayerAuto === id) return;
    const run = {}; this.lastPlayerAuto = id; this.playerAutoRunning = run;
    try {
      for(const powerId of capture.powerIds || [capture.powerId]){
        let first=capture.drainingPowerId!==powerId;
        while(true){
          const snapshot=this.contextSnapshot(),p=snapshot.state.powers[powerId];
          if(this.playerAutoRunning!==run||snapshot.chatKey!==capture.chatKey||snapshot.state.id!==capture.stateId||!p?.active||!p.autoArchiveReview||this.settings.mode==='off'||(!p.autoArchiveSave&&this.powerId!==powerId)||this.pendingArchiveReview)break;
          if (this.archiveUpdateWaiting()) {
            this.playerAutoQueued ||= { ...capture, drainingPowerId: powerId };
            if (this.lastPlayerAuto === id) this.lastPlayerAuto = null;
            break;
          }
          if(p.autoArchiveSave&&p.autoArchiveStart===undefined){
            await this.store.transact(next=>{next.powers[powerId].autoArchiveStart=Math.max(p.archiveStart??snapshot.state.managementStart??0,snapshot.ctx.chat.length-24);},{facts:false,captured:{chatKey:snapshot.chatKey,stateId:snapshot.state.id,revision:snapshot.state.revision}});
            continue;
          }
          const sources=archiveSources(snapshot.ctx.chat,snapshot.state,p,{automatic:true});
          if(!sources.length||first&&sources.length<normalizeArchiveAuto(p.archiveAuto).every)break;
          first=false;this.archiveAutoStatus ||= {};this.archiveAutoStatus[powerId]='正在更新';this.refresh();
          try { await this.reviewArchives({silent:true,autoSave:Boolean(p.autoArchiveSave),automatic:true,powerId}); }
          catch(error){const current=this.contextSnapshot();if(this.playerAutoRunning!==run||current.chatKey!==capture.chatKey||current.state.id!==capture.stateId||error?.name==='AbortError')break;this.archiveAutoStatus[powerId]=`更新暂停：${error.message}`;this.notice(`${p.name}自动更新未完成：${error.message}。可手动重查，失败不会自动重试API。`,true);break;}
          if (this.playerAutoRunning !== run) break;
          if(!p.autoArchiveSave||this.pendingArchiveReview){this.archiveAutoStatus[powerId]='等待确认';break;}
          const after=this.contextSnapshot(),next=archiveSources(after.ctx.chat,after.state,after.state.powers[powerId] || p,{automatic:true});
          if(next.length&&stable(next)===stable(sources)){this.archiveAutoStatus[powerId]='本批进度未前进，请手动重查';break;}
        }
      }
    }
    finally { if (this.playerAutoRunning === run) { this.playerAutoRunning = null; this.resumePlayerReview(); } }
  },
};
