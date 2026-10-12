import {foreignArchiveOwner} from './archive-ownership.js';
import {builtinWorldbookInfo} from './builtin-worldbook.js';
import { runtimeLogUIMethods } from './runtime-log-ui.js';
import { referenceUIMethods } from './ai-worldbooks-ui.js';
import { mmlcDashboard, mmlcFacts, mmlcLinked, mmlcRelations } from './mmlc-view.js';
import { THEMES, themeId } from './preferences.js';
import { matchingAdapters } from './adapter-library.js';
import { specializedGroups, statisticsDashboard, specificRows, specificDiff } from './specialized-records.js';
import { CREATION_PROGRESS, creationProgressCurrent } from './creation-results.js';
import { primaryHash, adapterBindingCurrent, ADAPTER_OPERATIONS } from './adapters.js';
import { currentOverview, overviewHighlights } from './current-overview.js';
import { TERMINAL_PROGRESS, terminalProgressCurrent } from './terminal-results.js';
import { creationCurrent } from './creation.js';
import { outboxSummary } from './outbox.js';
import { TERMINAL_KINDS, terminalSubjects, terminalOrderCurrent } from './terminal.js';
import { archiveRangeLabel, normalizeArchiveAuto } from './archive-scope.js';
import {isTaishi,TAISHI_SECTIONS} from './taishi.js';
import {AI_TASKS} from './task-routing.js';
import { isMmlc, MMLC_MODULES, mmlcModule } from './mmlc.js';
import { managementProfile } from './management-profiles.js';
import { profilePanel, coveragePanel, coverageResults } from './profile-view.js';
import { renderWorkflows, workflowForm } from './workflow.js';
import { MANAGEMENT_CATEGORIES } from './management.js';
import { SCENE_KINDS, storyEvidenceCurrent } from './narrative.js';
import { archiveIdentity, terminalMemoryIdentity, terminalMemoryCurrent } from './archive-memory.js';
import { currentPlayerGuide, playerTimeline } from './player-home.js';
import { archiveChangeTarget } from './archive-review.js';
import { ARCHIVE_TYPES, ARCHIVE_STATUS, ARCHIVE_FIELDS, archiveCurrent, isMotherNest, archivePanel, archiveUpdateSummary, archiveJourney } from './archives.js';
import { canAfford, inferResources, VERSION, workflowText, managementRecordCurrent } from './core.js';

// Presentation only; never determines archive ownership or gameplay routing.
export const workbenchAppearance = power => isMmlc(power) ? 'journey' : isTaishi(power)?'taishi': /^太始天(?:[（(·].*)?$/.test(String(power?.name || '').trim()) ? 'taishi' : 'arsenal';
const appearanceLabels = { arsenal:'能力藏馆', journey:'修行道场', taishi:'诸界观测台' };
const moduleMarks = {land:'山',sect:'宗',arts:'经',body:'修',items:'器',spirits:'灵',fleet:'舟',projects:'研'};

export const requiresFormValidation = action => ['archive-correct-draft', 'creation-draft', 'creation-refine', 'terminal-draft', 'terminal-confirm', 'save-archive-range', 'register', 'save-baseline', 'save-balances', 'save-settings', 'save-api-profile', 'role-save', 'save-management', 'save-workflow', 'save-archive', 'save-manual-story', 'save-memory', 'preview-memory'].includes(action);

const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const archiveStatus = r => r.status === 'active' ? ({ member: '在册', skill: '已掌握', bond: '有效' })[r.type] || ARCHIVE_STATUS.active : ARCHIVE_STATUS[r.status];
const icon = name => `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${({ arsenal: 'M12 3 4 7v10l8 4 8-4V7ZM4 7l8 4 8-4M12 11v10', close: 'm6 6 12 12M6 18 18 6', settings: 'M4 7h16M4 17h16M8 4v6M16 14v6', arrow: 'M4 12h16m-6-6 6 6-6 6', plus: 'M12 5v14M5 12h14', theme:'M12 3a9 9 0 1 0 0 18h1a2 2 0 0 0 0-4h-1a2 2 0 0 1 0-4h4a5 5 0 0 0 0-10ZM7 9h.01M12 7h.01M17 9h.01' })[name] || 'M5 12h14'}" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
const btn = (action, label, cls = '', disabled = false) => `<button type="button" class="${cls}" data-action="${action}" ${disabled ? 'disabled' : ''}>${label}</button>`;
const empty = message => `<div class="wjwk-empty">${esc(message)}</div>`;
const resText = (power, cost) => `${(cost.kind === 'resource' ? power.resources : power.assets)[cost.id]?.name || cost.id} × ${cost.amount}`;
const effectText = e => e.type === 'asset_grant' ? `${e.name} × ${e.quantity}｜${e.description}` : e.type === 'resource_credit' ? `资源收入 +${e.amount}` : e.type === 'field_set' ? `${e.label}：${e.value}` : e.description;

export class WorkbenchUI {
  constructor({ action, settings }) {
    this.action = action; this.settings = settings; this.goal = ''; this.storyNote = ''; this.tab = 'management'; this.open = false;
    this.root = document.createElement('div'); this.root.className = 'wjwk'; this.root.id = 'wjwk-root';
    this.root.innerHTML = `<button type="button" class="wjwk-fab" data-action="toggle" title="万界武库（可拖动）" aria-label="打开万界武库">${icon('arsenal')}<span>武库</span></button><section class="wjwk-window" hidden aria-label="万界武库操作台"></section><div class="wjwk-modal" hidden></div><aside class="wjwk-ai-activity" hidden aria-label="武库 AI 任务状态"><div class="wjwk-ai-heading"><strong data-ai-title></strong><span data-ai-time aria-hidden="true"></span><button type="button" data-action="ai-status-close" aria-label="关闭任务提示（不会取消任务）">×</button></div><div data-ai-message role="status" aria-live="polite"></div></aside>`;
    document.body.append(this.root); this.panel = this.root.querySelector('.wjwk-window'); this.modal = this.root.querySelector('.wjwk-modal');
    this.eventController = new AbortController();
    const listen = (name, handler, capture = false) => this.root.addEventListener(name, handler, { capture, signal: this.eventController.signal });
    listen('click', event => {
      // Isolate native form clicks from the host's document-level handlers.
      // Do not cancel defaults: labels, checkbox clicks and Space stay native.
      event.stopPropagation();
      const button = event.target.closest('[data-action]'); if (!button || button.disabled) return;
      const name = button.dataset.action;
      if(name==='ai-ref-all'||name==='ai-ref-none'){this.selectReferenceRows(name==='ai-ref-all');return;}
      if (name === 'archive-history-more') { this.renderArchiveJourney(this.journeyLimit + 20); return; }
      if (name === 'ai-status-close') { this.hideAIActivity(); return; }
      if (name === 'toggle') { if (this.dragged) { this.dragged = false; return; } this.setOpen(!this.open); return; }
      if (name === 'new-api-profile') { this.newConnectionProfile(); return; }
      if (name === 'close') { this.setOpen(false); return; }
      if (name === 'dialog-close') { if(this.modal.querySelector('[data-outbox-dialog]')) this.action('outbox-dismiss',{}); if(this.modal.querySelector('[data-ai-reference-dialog]')) this.action('ai-ref-dismiss',{}); if(this.modal.querySelector('[data-archive-tool-dialog]')) this.action('archive-tool-dismiss',{}); if(this.modal.querySelector('[data-creation-dialog]')) this.action('creation-dismiss',{}); if(this.modal.querySelector('[data-terminal-dialog]')) this.action('terminal-dismiss',{}); if (this.modal.querySelector('[data-scene-dialog]')) this.action('cancel-scene', {}); this.action('cancel-model-list', {}); this.closeDialog(); return; }
      if (name === 'mmlc-section') { this.mmlcSection = button.dataset.section || null; this.tab = 'management'; this.render(this.view); this.panel.querySelector('.wjwk-main')?.scrollTo(0, 0); return; }
      if (name === 'tab') { this.tab = button.dataset.tab; this.render(this.view); return; }
      let data = { ...button.dataset };
      if (button.closest('form')) { const form = button.closest('form'); if (requiresFormValidation(name) && !form.reportValidity()) return; data.form = form; data.values = Object.fromEntries(new FormData(form)); }
      Promise.resolve(this.action(name, data)).catch(error => this.setNotice(error.message, true));
    });
    listen('submit', event => event.preventDefault());
    listen('keydown', event => { if (event.target.matches('input,select,textarea')) event.stopPropagation(); });
    listen('input', event => {
      if(event.target.matches('[data-ai-ref-search]')) this.filterReferenceRows(event.target.value,event.target.dataset.aiRefSearch);
      if (event.target.matches('[data-coverage-search]')) { this.coverageQuery = event.target.value; this.updateCoverage(); }
      if (event.target.matches('[data-scene-focus]')) this.sceneFocus = event.target.value;
      if (event.target.matches('[data-goal]')) this.goal = event.target.value;
      if (event.target.matches('[data-story-note]')) this.storyNote = event.target.value;
      if (event.target.matches('[data-model-search]')) this.filterModels(event.target.value);
      if (event.target.matches('[data-entry-search]')) this.filterEntries(event.target.value);
    });
    listen('change', event => {
      if(event.target.matches('[data-runtime-detail]'))this.action('runtime-log-detail',{enabled:event.target.checked});
      if(event.target.matches('[data-ai-ref-entry]')) this.updateReferenceCounts();
      if(event.target.matches('[data-api-profile]') && event.target.value) Promise.resolve(this.action('apply-api-profile',{id:event.target.value})).catch(e=>this.setNotice(e.message,true));
      if (event.target.matches('[data-power-picker]')) { Promise.resolve(this.action('select-power', { id: event.target.value })).catch(error => this.setNotice(error.message, true)); }
      if (event.target.matches('[data-terminal-kind]')) this.terminalSubjectVisibility(event.target.value);
      if (event.target.matches('[data-archive-target]')) this.updateArchiveDiff(Number(event.target.dataset.archiveTarget), event.target.value);
      if (event.target.matches('[data-archive-type]')) this.archiveFields(event.target.value);
      if (event.target.matches('[data-manual-story-source]')) this.manualStoryExcerpt(event.target.value);
      if (event.target.matches('[data-coverage-filter]')) { this.coverageFilter = event.target.value; this.updateCoverage(); }
      if (event.target.matches('[data-workflow-source]')) { const m = this.view.managementChat?.[Number(event.target.value)], body = workflowText(m?.mes ?? m?.content ?? ''); event.target.closest('form').elements.quote.value = body.length <= 4000 ? body : ''; if (body.length > 4000) this.setNotice('该消息超过4000字，请逐字摘录本次相关证据。'); }
      if (event.target.matches('[name="role-rule"]')) this.updateRoleSelection(event.target.closest('form'));
      if (event.target.matches('[data-primary]')) this.previewRule(event.target.value);
      if (event.target.matches('[data-archive-range-mode]')) this.archiveRangeVisibility(event.target.value);
      else if (event.target.matches('[name="mode"]')) this.connectionVisibility(event.target.value);
      if (event.target.matches('[data-model-list]')) { const field = event.target.closest('form').querySelector('[name="model"]'); if (event.target.value) field.value = event.target.value; }
      if (event.target.matches('[data-adapter-file]') && event.target.files?.[0]) Promise.resolve(this.action('adapter-import', { file:event.target.files[0] })).catch(error=>this.setNotice(error.message,true));
      if (event.target.matches('[data-book-file]') && event.target.files?.[0]) Promise.resolve(this.action('import-book', { file: event.target.files[0] })).catch(error => this.setNotice(error.message, true));
      if (event.target.matches('[data-backup-file]') && event.target.files?.[0]) Promise.resolve(this.action('import-backup', { file: event.target.files[0] })).catch(error => this.setNotice(error.message, true));
    });
    listen('toggle', event => {
      const node=event.target;if(!node.matches('[data-legacy-management]') || !node.open)return;
      this.fillLegacy(node);
    },true);
    this.applyTheme();
    this.setupDrag();
  }
  destroy() {
    if (this.destroyed) return;
    this.destroyed = true; this.eventController.abort();
    clearInterval(this.aiTick); clearTimeout(this.aiHide); cancelAnimationFrame(this.positionFrame);
    this.aiTick = this.aiHide = this.positionFrame = null;
    this.action = () => {}; this.view = this.aiState = null; this.root.remove();
  }
  fillLegacy(node) {
    const content = node.querySelector('[data-legacy-content]'), v = this.view;
    if (!content || content.dataset.loaded || !v?.power) return;
    const blocked = v.busy || v.historyMismatch || (v.state.roleWrites || []).some(w => w.status === 'pending');
    content.innerHTML = this.legacyManagement(v.state, v.power, blocked, v.settings.mode, v.roleManagement, v.managementChat);
    content.dataset.loaded = 'true';
  }
  panelIdentity(node) {
    const summaries = [];
    for (let parent = node; parent && parent !== this.panel; parent = parent.parentElement) {
      if (parent.tagName === 'DETAILS') summaries.unshift(parent.querySelector(':scope > summary')?.textContent.trim() || '');
    }
    return JSON.stringify([node.tagName, node.getAttribute('name'), node.getAttribute('type'), Object.entries(node.dataset).filter(([k]) => k !== 'loaded').sort(), summaries]);
  }
  capturePanel() {
    if (!this.panel?.querySelectorAll) return null;
    const active = this.panel.ownerDocument.activeElement;
    let focused = this.panel.contains(active) && active.matches('button,input,textarea,select,summary') ? active : null;
    if (focused && [...this.panel.querySelectorAll('button,input,textarea,select,summary')].filter(n => this.panelIdentity(n) === this.panelIdentity(focused)).length !== 1) focused = null;
    return {
      details: [...this.panel.querySelectorAll('details')].map(n => ({ id: this.panelIdentity(n), open: n.open })).filter((item, _, all) => all.filter(other => other.id === item.id).length === 1),
      scroll: ['.wjwk-main', '.wjwk-sidebar'].map(selector => { const n = this.panel.querySelector(selector); return { selector, top: n?.scrollTop || 0, left: n?.scrollLeft || 0 }; }),
      focus: focused && { id: this.panelIdentity(focused), value: focused.matches('textarea,input:not([type]),input[type="text"],input[type="search"]') ? focused.value : undefined, start: focused.selectionStart, end: focused.selectionEnd, direction: focused.selectionDirection, top: focused.scrollTop },
    };
  }
  restorePanel(saved) {
    if (!saved) return;
    const unique = (selector, id) => { const matches = [...this.panel.querySelectorAll(selector)].filter(n => this.panelIdentity(n) === id); return matches.length === 1 ? matches[0] : null; };
    for (const item of saved.details) {
      const node = unique('details', item.id); if (!node) continue;
      node.open = item.open;
      if (item.open && node.matches('[data-legacy-management]')) this.fillLegacy(node);
    }
    if (saved.focus) {
      const item = saved.focus, node = unique('button,input,textarea,select,summary', item.id);
      if (node && !node.disabled && !node.closest('[hidden]')) {
        if (item.value !== undefined) node.value = item.value;
        node.focus({ preventScroll: true });
        if (typeof item.start === 'number' && node.setSelectionRange) node.setSelectionRange(item.start, item.end, item.direction);
        node.scrollTop = item.top;
      }
    }
    for (const item of saved.scroll) { const node = this.panel.querySelector(item.selector); if (node) { node.scrollTop = item.top; node.scrollLeft = item.left; } }
  }
  updateCoverage() { const node = this.panel.querySelector('[data-coverage-results]'); if (node) node.innerHTML = coverageResults(this.view.settings.catalog || [], this.view.state, this.coverageQuery || '', this.coverageFilter || 'all'); }
  setOpen(value) { this.open = value; this.panel.hidden = !value; if (value) this.action('refresh', {}); }
  hideAIActivity() {
    clearInterval(this.aiTick); clearTimeout(this.aiHide);
    this.aiTick = this.aiHide = null;
    this.aiHiddenId = this.aiState?.id;
    this.root.querySelector('.wjwk-ai-activity').hidden = true;
  }
  setAIActivity(state) {
    if (this.destroyed) return;
    this.aiState = state;
    const node = this.root.querySelector('.wjwk-ai-activity');
    clearInterval(this.aiTick); clearTimeout(this.aiHide); this.aiTick = this.aiHide = null;
    if (this.aiHiddenId === state.id) return;
    node.hidden = false; node.dataset.status = state.status;
    node.querySelector('[data-ai-title]').textContent = state.label;
    const prefix = { running: '进行中', success: '成功', partial:'部分完成', error: '未完成', cancelled: '已取消' }[state.status];
    node.querySelector('[data-ai-message]').textContent = `${prefix} · ${state.phase}`;
    const tick = () => {
      if (!this.root.isConnected) { clearInterval(this.aiTick); return; }
      const elapsed = state.status === 'running' ? performance.now() - state.startedAt : state.elapsed;
      const seconds = Math.max(0, elapsed / 1000);
      node.querySelector('[data-ai-time]').textContent = seconds < 60 ? `${seconds.toFixed(1)} 秒` : `${Math.floor(seconds / 60)} 分 ${(seconds % 60).toFixed(0)} 秒`;
    };
    tick();
    if (state.status === 'running') this.aiTick = setInterval(tick, 200);
    else if (state.status !== 'error') this.aiHide = setTimeout(() => {
      if (this.aiState?.id === state.id) this.hideAIActivity();
    }, 6000);
  }
  setNotice(message, error = false) {
    if (this.destroyed) return;
    this.notice = { message, error };
    for (const node of this.root.querySelectorAll('.wjwk-notice')) { node.textContent = message; node.classList.toggle('wjwk-error', error); }
  }
  render(view) {
    if (this.destroyed) return;
    this.view = view; if (!view) return; this.applyTheme(view.settings);
    if (this.root) this.root.dataset.appearance = workbenchAppearance(view.state ? view.power : null);
    const { state, power, operations = [], selected, busy, querying, committing, continuing, settings, save, historyMismatch, bridge, error, roleError } = view;
    if (!state) { this.panelContext = null; this.renderWelcome(view); return; }
    if ((isMmlc(power)||isTaishi(power)) && ['operations', 'assets'].includes(this.tab)) this.tab = 'management';
    const context = JSON.stringify([view.chatKey, state.id, power?.id, this.space, this.tab, this.mmlcSection, this.taishiSection]);
    const saved = context === this.panelContext ? this.capturePanel() : null;
    this.panelContext = context;
    const powers = Object.values(state?.powers || {}).filter(p => !isMmlc(p)&&!isTaishi(p)), resources = Object.values(power?.resources || {});
    const roleLinked = Boolean(state?.roleLink), pending = (state?.roleWrites || []).filter(w => w.status === 'pending');
    const connection = { off: '异步关闭', st: '酒馆连接', custom: '独立连接' }[settings.mode];
    const appearance = workbenchAppearance(power);
    const status = error || (historyMismatch ? '剧情历史发生改写。请先处理账本接续，再执行或同步。' : querying ? '正在查询模型，账目尚未变化…' : committing ? save?.note || '正在提交账目…' : continuing ? '正在承接续写与角色变量…' : busy ? '主叙事正在生成…' : save?.note || '词条与账目随当前聊天保存');
    this.panel.innerHTML = `<header class="wjwk-header"><div class="wjwk-brand">${icon('arsenal')}<div><strong>${isMmlc(power) ? '漫漫长路' : isTaishi(power)?'太始天':'万界武库'}</strong><small>${appearanceLabels[appearance]} · 当前聊天 · v${VERSION}</small></div></div><div class="wjwk-header-actions"><span class="wjwk-chip">${connection}</span>${btn('theme', icon('theme'), 'wjwk-icon-button').replace('<button ', '<button title="切换界面主题" aria-label="切换界面主题" ')}${btn('rose-open', '<svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true"><path d="M10 16 C5 12 4 8 7 6 C8.6 5 9.6 6 10 7 C10.4 6 11.4 5 13 6 C16 8 15 12 10 16Z" fill="currentColor"/></svg>', 'wjwk-icon-button')}${btn('settings', icon('settings'), 'wjwk-icon-button')}${btn('close', icon('close'), 'wjwk-icon-button')}</div></header>${this.outboxButton(state,busy)}
      <div class="wjwk-layout ${isMmlc(power) ? 'wjwk-mmlc-layout' : isTaishi(power)?'wjwk-taishi-layout':''} ${this.tab !== 'operations' || !selected ? 'wjwk-management-layout' : ''}"><aside class="wjwk-sidebar">${isTaishi(power)?`<nav class="wjwk-mmlc-nav" aria-label="太始天模块"><button data-action="taishi-section" data-section="" class="${!this.taishiSection?'is-selected':''}">诸界总览</button>${TAISHI_SECTIONS.map(s=>`<button data-action="taishi-section" data-section="${s.id}" class="${this.taishiSection===s.id?'is-selected':''}">${s.title}</button>`).join('')}</nav>`:isMmlc(power) ? `<nav class="wjwk-mmlc-nav" aria-label="漫漫长路模块"><button data-action="mmlc-section" data-section="" class="${!this.mmlcSection ? 'is-selected' : ''}">道场总览</button>${MMLC_MODULES.map(m => `<button data-action="mmlc-section" data-section="${m.id}" class="${this.mmlcSection === m.id ? 'is-selected' : ''}">${m.title}</button>`).join('')}</nav>` : `<div class="wjwk-section-heading"><span>我的金手指</span>${btn('manage', icon('plus'), 'wjwk-icon-button', busy)}</div>
      <label class="wjwk-mobile-power">当前金手指<select data-power-picker>${powers.map(p => `<option value="${esc(p.id)}" ${p.id === power?.id ? 'selected' : ''}>${esc(p.name)}${p.active ? '' : '（已暂停）'}</option>`).join('') || '<option>尚未接入</option>'}</select></label>
      <div class="wjwk-power-list">${powers.map(p => `<button type="button" data-action="select-power" data-id="${esc(p.id)}" class="wjwk-power ${power?.id === p.id ? 'is-selected' : ''}"><span class="wjwk-orb ${p.active ? '' : 'is-paused'}"></span><span>${esc(p.name)}<small>${p.active ? '已接入' : '已暂停'} · ${esc(p.source?.book || '导入词条')}</small></span></button>`).join('') || empty('先接入一个金手指词条')}</div>`}
      ${resources.length ? `<div class="wjwk-resource-heading">${esc(power?.name || '当前词条')} · 资源</div>` : ''}${resources.map(r => `<div class="wjwk-resource"><span>${esc(r.name)}</span><strong>${r.balance === null ? '未确认' : esc(r.balance)}</strong></div>`).join('')}
      <details class="wjwk-sidebar-tools"><summary>管理与备份</summary>${btn('runtime-log-open','运行日志','wjwk-link')}${btn('prune-backups','清理旧备份','wjwk-link')}${btn('ai-ref-open','插件 AI 参考世界书','wjwk-link',busy)}${power ? btn('adapter-open','词条适配配置','wjwk-link',busy) : ''}${power && !isMmlc(power)&&!isTaishi(power) ? '<details><summary>余额与接入</summary>' + btn('baseline', resources.some(r => r.balance === null) ? '确认余额 · 开始使用' : resources.length ? '调整余额与已有能力' : '补录已有能力与物资', 'wjwk-primary wjwk-setup-button', busy) + (resources.length ? btn('balances', '查看全部词条余额', 'wjwk-link', busy) : '') + btn('toggle-power', power.active ? '暂停接入' : '恢复接入', 'wjwk-link', busy) + '</details>' : ''}
      <details class="wjwk-role-status"><summary>角色变量接入</summary><strong>${roleLinked ? '角色 MVU 已接入' : '角色变量（可选）'}</strong><p>${roleLinked ? `绑定 ${Object.keys(state.roleLink.bindings).length} 项余额 · ${state.roleLink.roots.length} 个区域` : '无需接入也能管理记录；已有变量可绑定读取。'}</p>${btn('manage', '金手指与角色接入', 'wjwk-link', busy)}${roleLinked ? btn('role-refresh', '刷新角色余额', 'wjwk-link', busy || pending.length > 0) : ''}</details>
      <details class="wjwk-sidebar-bottom"><summary>档案备份</summary>${btn('export', '导出档案', 'wjwk-link', !state)}${btn('backup', '恢复档案', 'wjwk-link', busy)}${save && !save.verified ? btn('retry-save', '重试酒馆保存', 'wjwk-link', busy || !state) : ''}</details></details></aside>
      <main class="wjwk-main ${this.tab === 'management' ? 'wjwk-player-main' : ''}"><div class="wjwk-context-line"><span class="wjwk-eyebrow">${esc(power?.name || '等待接入')}</span><span class="wjwk-muted">${esc(view.managementChat?.some(m => !m.is_user && !m.is_system) ? `当前正文：第${view.managementChat.findLastIndex(m => !m.is_user && !m.is_system) + 1}条` : '暂无正文')}</span></div>

      ${pending.map(w => `<div class="wjwk-setup-banner"><strong>角色写回待完成</strong><p>武库投入已记账。重试这一笔写回会使用原回执，不再次扣费。完成前请暂停推进正文。</p><button type="button" data-action="retry-role-write" data-id="${esc(w.id)}" class="wjwk-primary" ${busy ? 'disabled' : ''}>重试这笔写回</button></div>`).join('')}${roleError ? `<p class="wjwk-error">${esc(roleError)}</p>` : ''}
      ${!power ? `<div class="wjwk-setup-banner"><strong>先选择你正在使用的金手指</strong><p>读取世界书，选择词条，确认余额后就能开始。</p>${btn('manage', '接入金手指', 'wjwk-primary', busy)}</div>` : resources.some(r => r.balance === null) ? `<div class="wjwk-setup-banner"><strong>还差一步：确认${esc(resources.filter(r => r.balance === null).map(r => r.name).join('、'))}余额</strong><p>自动从现有聊天找数值；没找到时，直接填入当前余额。</p>${btn('baseline', '确认余额并开始', 'wjwk-primary', busy)}</div>` : ''}
      ${isMmlc(power)||isTaishi(power) ? '' : this.narratives(state, busy, settings.mode, view.manualStoryBusy)}<section ${this.tab !== 'operations' ? 'hidden' : ''}><h2>这一次，你想做什么？</h2><p class="wjwk-muted">兑换、推演、强化、合成、存取……由当前词条决定。</p>
      <textarea data-goal rows="3" maxlength="8000" placeholder="例如：基于已掌握的呼吸法，推演适合当前身体的下一阶段。" ${busy ? 'disabled' : ''}>${esc(this.goal)}</textarea>
      <div class="wjwk-toolbar">${btn('generate', `${icon('arrow')}生成可执行方案`, 'wjwk-primary', busy || pending.length > 0 || !power?.active || settings.mode === 'off' || historyMismatch)}${querying ? btn('cancel', '取消查询', 'wjwk-secondary') : btn('sync', '同步新增剧情', 'wjwk-secondary', busy || pending.length > 0 || !powers.some(p => p.active) || settings.mode === 'off' || historyMismatch)}${settings.mode === 'off' && power ? btn('settings', '连接模型', 'wjwk-secondary', busy) : ''}</div>
      ${this.actionEntrances(state, power, view.sceneCandidates || [], busy || historyMismatch || pending.length > 0, settings.mode)}</section><nav class="wjwk-tabs ${isMmlc(power)||isTaishi(power) ? 'wjwk-mmlc-hidden' : ''}" aria-label="武库内容">${(isMmlc(power) ? [['management', '成果统计'], ['receipts', '历史']] : [['management', '总览'], ['operations', '交易'], ['assets', '能力与物资'], ['receipts', '历史']]).map(([id, label]) => `<button type="button" data-action="tab" data-tab="${id}" class="${this.tab === id ? 'is-active' : ''}" aria-current="${this.tab === id ? 'page' : 'false'}">${label}</button>`).join('')}</nav>
      <div class="wjwk-content">${this.tab === 'management' ? this.management(state, power, busy || historyMismatch || pending.length > 0, settings.mode, view.roleManagement, view.managementChat) : this.tab === 'operations' ? operations.map(op => `<button type="button" class="wjwk-operation ${selected?.id === op.id ? 'is-selected' : ''}" data-action="select-operation" data-id="${esc(op.id)}"><div><strong>${esc(op.label)}</strong><span class="wjwk-chip">${op.reused ? '沿用报价' : op.builtIn ? '词条固定操作' : '待确认'}</span></div><p>${esc(op.description)}</p><small>${esc(op.costs.map(c => resText(power, c)).join(' + ') || '无资源消耗')}</small></button>`).join('') || empty(settings.mode === 'off' ? '异步模型未启用。符合正文的固定操作仍可直接使用。' : '填写目标生成方案；浏览方案不会扣除资源。') : this.tab === 'assets' ? this.assets(power) : this.receipts(isMmlc(power) ? { ...state, transactions: state.transactions.filter(t => t.powerId === power.id) } : state)}
      </div></main>
      <aside class="wjwk-detail" ${this.tab !== 'operations' || !selected ? 'hidden' : ''}><div class="wjwk-section-heading">执行预览</div>${selected && power ? this.detail(power, selected, busy || historyMismatch || !bridge || pending.length > 0, roleLinked, settings.mode) : empty('选择一个操作，核对投入与所得后执行。')}<div class="wjwk-detail-bottom"><span class="wjwk-dot ${bridge ? '' : 'is-off'}"></span>${bridge ? '已接入主叙事请求' : '主叙事接口不可用，执行已停用'}<p>${roleLinked ? '先结算并写回角色变量，再把本次行动交给主叙事呈现。' : '确认后结算账本并展开正文。接入角色状态后可写回 MVU。'}</p></div></aside></div>
      <footer class="wjwk-footer"><span class="wjwk-notice ${error || historyMismatch ? 'wjwk-error' : ''}" role="status">${esc(this.notice?.message || status)}</span><small>${state ? `账本版本 ${state.revision}` : '未打开聊天'}</small></footer>`;
    this.restorePanel(saved);
  }
  renderWelcome(view) {
    const noChat = view.noChat !== false;
    this.panel.innerHTML = `<header class="wjwk-header"><div class="wjwk-brand">${icon('arsenal')}<div><strong>万界武库</strong><small>${noChat ? '尚未进入聊天' : '档案暂不可读取'} · v${VERSION}</small></div></div><div class="wjwk-header-actions">${btn('theme',icon('theme'),'wjwk-icon-button').replace('<button ', '<button title="切换界面主题" aria-label="切换界面主题" ')}${btn('close',icon('close'),'wjwk-icon-button')}</div></header><main class="wjwk-main wjwk-welcome" data-no-chat-home><span class="wjwk-eyebrow">${noChat?'插件已就绪':'请检查当前档案'}</span><h1>${noChat?'先打开一个角色聊天':'当前档案暂不可读取'}</h1><p>${noChat?'在酒馆角色列表中选择角色，再打开聊天。这里会自动显示该聊天的金手指与长期成果。':'插件入口仍可使用。请保留当前数据，重试读取；不要重新接入来覆盖已有档案。'}</p>${noChat?`<div class="wjwk-welcome-grid"><article><h2>万界武库</h2><p>这个金手指能做什么、已经做过什么、留下了哪些成果，一眼查看。</p></article><article><h2>漫漫长路</h2><p>${MMLC_MODULES.map(m=>esc(m.title)).join('、')}，分模块统计。</p></article><article><h2>太始天</h2><p>个人诸界、眷属行动、发展事项与界主所得，保留长期变化。</p></article></div><p class="wjwk-muted">成果跟随当前聊天保存；尚未进入聊天时，这里不会显示其他角色的数据。</p>`:`<p class="wjwk-error">${esc(view.error||'暂时无法读取，请重试。')}</p>`}<div class="wjwk-toolbar">${btn('refresh','重新检查聊天','wjwk-secondary')}</div><details><summary>提前设置 AI 连接（可选）</summary><p class="wjwk-muted">连接设置由当前酒馆账户共用，也可以进入聊天后再设置。</p>${btn('settings','设置 AI 连接','wjwk-secondary')}</details></main><footer class="wjwk-footer"><span role="status">${noChat?'进入聊天后自动显示，无需重新安装插件':'读取失败；已有数据未被覆盖'}</span></footer>`;
  }

  management(state, power, blocked, mode, roleView = null, chat = []) {
    if (!power) return empty('先选择你正在使用的金手指。');
    if (isMmlc(power)) return this.mmlcStatistics(power, blocked, mode, chat);
    const guide = currentPlayerGuide(power), archives = Object.values(power.archives || {}), valid = archives.filter(r => archiveCurrent(r, chat));
    const pending = this.view?.pendingArchiveReview?.powerId === power.id ? this.view.pendingArchiveReview : null;
    const canAI = !blocked && power.active && mode !== 'off', timeline = playerTimeline(power, chat);
    const groups = Object.entries(ARCHIVE_TYPES).filter(([type]) => archives.some(r => r.type === type&&!r.specific));
    const stale = archives.length - valid.length, active = valid.filter(r => r.status === 'active').length;
    const appearance = workbenchAppearance(power);
    return `<section class="wjwk-player-hero"><div><span class="wjwk-eyebrow">${appearanceLabels[appearance]} · ${isMotherNest(power) ? '我的母巢' : '我的金手指'}</span><h1>${esc(power.name)}</h1><p>${esc(guide?.summary || (isMotherNest(power) ? '种群、生态、设施与研究，积累在同一个地方。' : '了解它的玩法，留下你的经历与成果。'))}</p>${this.savedStatStrip(valid)}</div><div class="wjwk-home-primary">${btn(archives.length ? 'review-archives' : 'player-initial', archives.length ? 'AI 整理最近剧情' : 'AI 整理当前情况', 'wjwk-primary', !canAI)}<small>${mode === 'off' ? '连接模型后可使用AI整理' : '手动重查正文，确认后保存'}</small>${btn('delete-power', '删除此词条', 'wjwk-link', blocked)}</div></section>
    ${this.currentOverviewPanel(power,chat)}${this.archiveUpdatePanel(power,chat,blocked)}${this.memoryStatusPanel(power,blocked)}
    ${this.creationPanel(power,chat,blocked,mode)}${this.automaticArchiveControls(power,blocked,mode)}${this.terminalPanel(power,chat,blocked,mode)}
    ${pending ? `<div class="wjwk-home-pending"><span>AI已整理：${pending.changes.length+(pending.creationResults?.length||0)+(pending.terminalResults?.length||0)} 项更新${pending.guide ? '，附玩法说明' : ''}</span>${btn('player-pending', '查看并接受', 'wjwk-primary', blocked)}</div>` : ''}
    <section class="wjwk-home-section"><div class="wjwk-section-heading"><h2>能做什么</h2>${guide ? btn('view-rule', '原文规则', 'wjwk-link') : ''}</div>${guide ? `<div class="wjwk-ability-grid">${guide.abilities.map(a => `<article><strong>${esc(a.name)}</strong><p>${esc(a.description)}</p><details><summary>规则依据</summary><blockquote>${esc(a.ruleQuote)}</blockquote></details></article>`).join('')}</div>` : `<div class="wjwk-home-empty"><strong>先让AI把这个金手指讲清楚</strong><p>点击上方AI整理，解释玩法与限制，并从近期正文中找到已有成果。</p></div>`}<div class="wjwk-home-next"><span>想看看眼下可以尝试什么？</span>${btn('scene-open', '给我几个行动方向', 'wjwk-secondary', !canAI)}</div></section>
    <div class="wjwk-home-columns"><section class="wjwk-home-section"><div class="wjwk-section-heading"><h2>现在有什么</h2><small>${active ? `${active} 个当前成果` : '随剧情积累'}</small></div>${valid.length ? `<div class="wjwk-home-counts">${groups.map(([type, label]) => { const count = valid.filter(r => r.type === type && r.status === 'active').length; return count ? `<span>${esc(label)} <strong>${count}</strong></span>` : ''; }).join('')}<span>进行中 <strong>${valid.filter(r => r.status === 'working').length}</strong></span><span>计划 <strong>${valid.filter(r => r.status === 'planned').length}</strong></span></div>` : ''}${stale ? `<p class="wjwk-error">${stale} 项成果的来源已变化，暂不计入现状，打开后可纠正。</p>` : ''}${this.specializedStatistics(power,chat,blocked)}${groups.length ? groups.map(([type, label]) => `<section class="wjwk-archive-section"><h3>${esc(label)}</h3><div class="wjwk-archive-grid">${archives.filter(r => r.type === type&&!r.specific).map(r => this.archiveCard(r, chat, blocked || !power.active, true)).join('')}</div></section>`).join('') : archives.some(r=>r.specific)?'':`<div class="wjwk-home-empty"><strong>你的成果会出现在这里</strong><p>${isMotherNest(power) ? '建立的种群、改造过的环境、建成的设施与研究进展，都会分别展示。' : 'AI会从剧情中找出已经获得的能力、对象和持续成果。'}不用先填写表格。</p></div>`}</section>
    <section class="wjwk-home-section wjwk-home-history"><h2>最近做过什么</h2>${timeline.length ? `<ol class="wjwk-home-timeline">${timeline.map(row => `<li><strong>${esc(row.name)} <small>${esc(archiveStatus(row))}</small></strong><p>${esc(row.text || '状态已更新')}</p><details><summary>${row.source.type === 'story' ? `正文第${row.source.anchor.index + 1}条 · 已确认` : '玩家确认的补充'}</summary><blockquote>${esc(row.source.quote || row.source.note)}</blockquote></details></li>`).join('')}</ol>` : `<p class="wjwk-muted">整理并接受剧情变化后，这里会留下经历。计划与研究进展会单独标明。</p>`}</section></div>
    <section class="wjwk-home-supplement"><h3>有遗漏？告诉AI一句话</h3><form><textarea name="playerNote" rows="2" maxlength="4000" placeholder="${isMotherNest(power) ? '例如：耐寒工蜂现在负责北坡巡视；或者：我打算培育夜行侦察蜂。' : '说说已经发生的变化，或你准备做的计划……'}" ${!canAI ? 'disabled' : ''}></textarea>${btn('player-supplement', 'AI 帮我整理', 'wjwk-secondary', !canAI)}</form></section>
    <details class="wjwk-home-tools"><summary>从正文整理档案</summary><p>正文写完后，让插件 AI 把新成果和进展记入档案。会调用当前配置的 API。</p><p class="wjwk-muted">确认模式：整理当前词条，由你确认保存。自动更新模式：后台整理所有已开启词条并保存。</p>${btn('player-auto', power.autoArchiveReview ? '关闭正文后自动整理' : '开启正文后自动整理（消耗API）', 'wjwk-secondary', blocked || !power.active || mode === 'off')}</details>
    <details class="wjwk-home-tools" data-legacy-management><summary>纠错与其他记录</summary>${btn('archive-tools','一句话纠错与阶段回顾','wjwk-link',blocked || !power.active || mode === 'off')}${btn('open-archive', '手工添加或纠正', 'wjwk-link', blocked || !power.active)}${btn('view-rule', '完整规则', 'wjwk-link')}<div data-legacy-content></div></details>`;
  }
  overviewCountLine(counts) {
    return `已建立 ${counts.active} · 进行中 ${counts.working} · 计划 ${counts.planned} · 已结束 ${counts.ended}`;
  }
  savedStatStrip(rows) {
    const stats = [['active','当前成果'],['working','正在进行'],['planned','待执行计划']];
    return `<div class="wjwk-saved-stats" aria-label="已保存档案统计">${stats.map(([status,label])=>`<span><strong>${rows.filter(r=>r.status===status).length}</strong><small>${label}</small></span>`).join('')}</div>`;
  }
  overviewFacts(row) {
    return row.facts.map(f=>`${esc(f.label)}：${f.compact ? esc(f.value) : '内容较长，查看详情'}`).join('；') || '查看当前档案';
  }
  archiveUpdatePanel(power, chat, blocked, module = null) {
    const batch = archiveUpdateSummary(power,chat,module); if (!batch) return '';
    const row = r => {
      const title = r.kind==='created' ? ({active:'新增成果',planned:'新计划',working:'开始进行',ended:'登记已结束对象'})[r.status] : r.kind==='recovered'?'重新核对':'更新';
      const status = r.previousStatus && r.previousStatus!==r.status ? `${ARCHIVE_STATUS[r.previousStatus]} → ${ARCHIVE_STATUS[r.status]}` : ARCHIVE_STATUS[r.status];
      const facts = r.details.slice(0,2).map(f=>`${f.label}：${f.value.length<=160?esc(f.value):'内容较长，查看档案'}`).join('；');
      return `<li><strong>${title} · ${esc(r.name)}</strong><span>${esc(status)}${r.previousName && r.previousName!==r.name?' · 曾用名：'+esc(r.previousName):''}</span>${facts?`<p>${facts}</p>`:''}<details><summary>变化详情</summary><dl>${r.details.map(f=>`<div><dt>${esc(f.label)}</dt><dd>${r.kind==='updated'?esc(f.before)+' → ':''}${esc(f.value)}</dd></div>`).join('')}</dl>${btn('open-archive','查看对象档案','wjwk-link',blocked||!power.active).replace('data-action="open-archive"',`data-action="open-archive" data-id="${esc(r.id)}"`)}</details></li>`;
    };
    const floor = batch.sourceIndices.length ? `核对第${Math.min(...batch.sourceIndices)+1}—${Math.max(...batch.sourceIndices)+1}层` : '玩家补充或手动保存';
    return `<section class="wjwk-update-summary" data-archive-update><header><strong>最近一次整理</strong><small>${batch.automatic?'自动保存':'已确认保存'} · ${esc(new Date(batch.at).toLocaleString())} · ${floor}</small></header>${batch.rows.length?`<ul>${batch.rows.slice(0,3).map(row).join('')}</ul>${batch.rows.length>3?`<details><summary>其余${batch.rows.length-3}项变化</summary><ul>${batch.rows.slice(3).map(row).join('')}</ul></details>`:''}`:`<p>${batch.unavailable?'本批记录已有后续更新，当前情况见下方成果。':module&&batch.records.length?'本次没有该模块的保存变化。':'本次没有新增或更新的成果。'}</p>`}${power.archiveUndo?btn('archive-undo','撤销本次整理 / 纠错','wjwk-link',blocked||!power.active):''}${batch.unavailable&&batch.rows.length?`<small>${batch.unavailable}项已有后续更新，未展示旧摘要。</small>`:''}${batch.arrangements?`<small>另保存${batch.arrangements}项安排进展，见安排面板。</small>`:''}</section>`;
  }
  memoryDiagnosticLabel(d) {
    if (!d) return '尚无本页请求记录';
    const observed = d.readback || d.request;
    if (d.readError) return '请求回读失败，单次提醒保留';
    if (observed?.status === 'matched') return `请求钩子已带入 · ${d.items.length}项 / ${observed.chars}字符`;
    return ({invalid:'旧记忆已撤回',missing:'请求回读未找到记忆',different:'请求回读内容有变化',unexpected:'请求中有非本次记忆',empty:'本次未带入记忆'})[observed?.status] || (d.outcome==='running'?'等待正文请求钩子':'未观察到正文请求钩子');
  }
  memoryStatusPanel(power, blocked) {
    const config = this.view?.state?.archiveMemory, manual = Object.values(config?.selections || {}).some(s=>s.mode==='pinned'||s.mode==='next');
    return `<div class="wjwk-toolbar wjwk-memory-status"><small>发送档案给正文 AI · ${config?.auto ? '自动选择' : manual ? '仅发送手动指定项' : '未开启'}</small>${btn('open-memory','发送设置与预览','wjwk-link',blocked || !power.active)}${btn('memory-report','最近发送记录','wjwk-link')}</div>`;
  }
  memoryReport(d, available = true) {
    if (!d) return `<p>${available ? '本页还没有正文请求记录。生成一次正文后可在这里查看。' : '当前接口没有可用的正文请求钩子，无法核对带入。'}</p><small>预览只是下一次请求的候选内容，不是实际带入记录。</small>`;
    const request = d.request, readback = d.readback;
    const result = d.generated ? `已生成新正文 · 第${d.index+1}条消息` : d.outcome==='stopped' ? '生成已停止，单次提醒未消费' : d.outcome==='ended' ? '生成已结束，尚未确认有新正文' : '正文生成中';
    return `<p><strong>${esc(this.memoryDiagnosticLabel(d))}</strong></p><p>${esc(result)}${d.saved===false?'；本地保存失败，单次提醒保留':''}</p><small>这是本页当前聊天最近一次的记录，刷新页面后清除。仅核对酒馆请求钩子中的本插件记忆，不能证明最终网络请求、模型收到或遵循。</small>${d.reason?`<p>${esc(d.reason)}</p>`:''}${request?`<p>接口：${request.kind==='chat'?'聊天补全':'文本补全'} · ${new Date(request.at).toLocaleTimeString()} · ${request.chars}字符 · ${request.blocks}个记忆包</p>`:'<p>没有观察到请求钩子；不能将预览视为已经带入。</p>'}${readback?`<p>结束时回读：${({matched:'记忆与计划一致',empty:'没有记忆包',missing:'记忆包已不在请求对象中',different:'记忆包内容或份数变化',invalid:'旧记忆失效',unexpected:'出现非本次记忆'})[readback.status] || '无法确认'}。这是结束时请求对象的状态，不是网络抓包。</p>`:''}${d.items.length?`<details><summary>本次计划条目 · ${d.items.length}项</summary><ul>${d.items.map(r=>`<li>${esc(r.name)} · ${esc(({next:'单次提醒',pinned:'固定提醒',auto:'自动记忆'})[r.mode]||r.mode)}</li>`).join('')}</ul></details>`:''}${d.omitted.length?`<details><summary>未带入及原因 · ${d.omitted.length}项</summary><ul>${d.omitted.map(r=>`<li>${esc(r.name)}：${esc(r.reason)}</li>`).join('')}</ul></details>`:''}${request?.packet?`<details><summary>请求钩子回读的记忆原文</summary><pre class="wjwk-full-rule">${esc(request.packet)}</pre></details>`:''}${readback?.packet && readback.signature!==request?.signature?`<details><summary>结束时回读的记忆原文</summary><pre class="wjwk-full-rule">${esc(readback.packet)}</pre></details>`:''}<p class="wjwk-muted">生成新正文不等于模型遵循记忆；事实变化仍由原有成果整理核对。</p>`;
  }
  showMemoryReport(d, available) { this.dialog('发送给正文 AI · 最近记录', this.memoryReport(d, available)); }
  currentOverviewPanel(power,chat,moduleId=null) {
    const overview=currentOverview(power,chat), groups=moduleId?overview.groups.filter(g=>g.id===moduleId):overview.groups.filter(g=>g.records.length||g.stale);
    const counts=moduleId?groups[0]?.counts||{active:0,working:0,planned:0,ended:0}:overview.counts;
    const stale=moduleId?groups[0]?.stale||0:overview.stale;
    return `<section class="wjwk-current-overview" aria-label="当前概况"><header><h2>当前概况</h2><small>${overview.paused?'已暂停统计 · 保留上次记录':'随已保存档案自动更新'}</small></header><p class="wjwk-overview-counts">${this.overviewCountLine(counts)}</p>${stale?`<p class="wjwk-error">${stale} 项来源待核对，未计入现状</p>`:''}${groups.length?`<div class="wjwk-overview-groups">${groups.map(group=>`<div><h3>${esc(group.title)}</h3>${overviewHighlights(group).map(row=>`<p><strong>${esc(row.name)}</strong><small>${esc(ARCHIVE_STATUS[row.status])}</small><span>${this.overviewFacts(row)}</span><button type="button" class="wjwk-link" data-action="open-archive" data-id="${esc(row.id)}">查看详情</button></p>`).join('')||'<p class="wjwk-muted">暂无当前成果</p>'}${group.records.filter(r=>r.status!=='ended').length>2?'<small>其余对象见下方档案</small>':''}</div>`).join('')}</div>`:'<p class="wjwk-muted">AI整理并保存剧情后，已有成果和进展会自动汇总到这里。</p>'}</section>`;
  }
  mmlcStatistics(power, blocked, mode, chat) {
    const all = Object.values(power.archives || {}), valid = all.filter(r => archiveCurrent(r, chat));
    const canAI = !blocked && power.active && mode !== 'off', section = MMLC_MODULES.find(m => m.id === this.mmlcSection);
    const pending = this.view?.pendingArchiveReview?.powerId === power.id ? this.view.pendingArchiveReview : null;
    const overview = currentOverview(power,chat), modules=mmlcDashboard(power,chat), module=modules.find(m=>m.id===section?.id);
    const rowsFor = id => valid.filter(r => mmlcModule(r) === id), active = rows => rows.filter(r => r.status === 'active');
    const summary = r => Object.values(r.fields).filter(Boolean).join(' · ');
    const rows = section ? rowsFor(section.id) : valid;
    const relations=mmlcRelations(power,chat), linked=new Map();
    for(const e of relations)for(const [from,to]of [[e.from,e.to],[e.to,e.from]]){if(!linked.has(from))linked.set(from,new Set());linked.get(from).add(to);}
    const links=r=>[...(linked.get(r.id)||[])].map(id=>power.archives[id]).map(other=>`<button type="button" class="wjwk-link" data-action="open-archive" data-id="${esc(other.id)}">${esc(other.name)} · ${esc(ARCHIVE_STATUS[other.status])}</button>`).join('');
    const card = r => `<article class="wjwk-mmlc-record" data-mmlc-record="${esc(r.id)}"><header><strong>${esc(r.name)}</strong><span>${archiveCurrent(r,chat)?esc(archiveStatus(r)):'来源待核对'}</span></header><dl>${mmlcFacts(r).slice(0,5).map(f=>`<div><dt>${esc(f.label)}</dt><dd>${esc(f.value.length>180?f.value.slice(0,180)+'…':f.value)}</dd></div>`).join('')}</dl>${archiveCurrent(r,chat)&&links(r)?`<div class="wjwk-mmlc-relations"><small>关联成果（含历史状态）</small>${links(r)}</div>`:''}<div>${btn('open-archive','详情与成长记录','wjwk-link',blocked || !power.active).replace('data-action="open-archive"', `data-action="open-archive" data-id="${esc(r.id)}"`)}${btn('open-memory','带入正文','wjwk-link',blocked || !power.active || !archiveCurrent(r,chat)).replace('data-action="open-memory"', `data-action="open-memory" data-id="${esc(r.id)}"`)}</div></article>`;
    return `<section class="wjwk-mmlc-hero"><div><span class="wjwk-eyebrow">随身道场</span><h1>${section ? section.title : '漫漫长路'}</h1><p>${section ? section.hint : '福地、宗门、修行与造物，一眼查看当前家底。'}</p>${this.savedStatStrip(rows)}</div><div class="wjwk-mmlc-controls">${section?btn('creation-open',esc(module.operation.label),'wjwk-primary',!canAI).replace('data-action="creation-open"',`data-action="creation-open" data-section="${section.id}"`):''}${btn(all.length ? 'review-archives' : 'player-initial', 'AI 整理剧情', section?'wjwk-secondary':'wjwk-primary', !canAI)}</div></section>

    ${this.archiveUpdatePanel(power,chat,blocked,section?.id)}${pending ? `<div class="wjwk-home-pending"><span>AI已整理 ${pending.changes.length+(pending.creationResults?.length||0)+(pending.terminalResults?.length||0)} 项更新</span>${btn('player-pending','查看并保存','wjwk-primary',blocked)}</div>` : ''}
    ${this.memoryStatusPanel(power,blocked)}${!section ? `<div class="wjwk-mmlc-grid">${overview.groups.map(group => `<button type="button" data-action="mmlc-section" data-section="${group.id}" class="wjwk-mmlc-tile"><header><strong><i class="wjwk-module-mark" aria-hidden="true">${moduleMarks[group.id] || '录'}</i>${group.title}</strong><span>${group.counts.active} 项成果</span></header><small>${this.overviewCountLine(group.counts)}</small><ul>${(modules.find(m=>m.id===group.id)?.records||[]).filter(r=>r.status!=='ended').slice(0,2).map(row=>`<li><b>${esc(row.name)} · ${esc(ARCHIVE_STATUS[row.status])}</b><span>${mmlcFacts(row).slice(0,2).map(f=>esc(f.label)+'：'+esc(f.value.length>100?f.value.slice(0,100)+'…':f.value)).join(' · ')}</span></li>`).join('') || '<li class="wjwk-muted">尚无当前成果，AI整理后自动汇总</li>'}</ul><footer>${group.stale?group.stale+' 项待核对 · ':''}查看${group.title} →</footer></button>`).join('')}</div>` : `<div class="wjwk-mmlc-back">${btn('mmlc-section','← 道场总览','wjwk-link')}</div><section class="wjwk-mmlc-current"><h2>当前家底</h2>${module.stale?`<p class="wjwk-muted">${module.stale} 项来源待核对，未计入当前家底</p>`:''}<div class="wjwk-mmlc-records">${active(module.records).slice(0,6).map(card).join('') || '<p class="wjwk-muted">尚无已确认成果。点击 AI 整理剧情，已有内容会自动归入；无需填写表格。</p>'}</div>${active(module.records).length>6?`<details><summary>其余成果 · ${active(module.records).length-6} 项</summary><div class="wjwk-mmlc-records">${active(module.records).slice(6).map(card).join('')}</div></details>`:''}</section>${rows.some(r=>['planned','working'].includes(r.status)) ? `<section><h2>正在推进与计划</h2><div class="wjwk-mmlc-records">${module.records.filter(r=>['planned','working'].includes(r.status)).slice(0,4).map(card).join('')}</div>${module.records.filter(r=>['planned','working'].includes(r.status)).length>4?`<details><summary>其余计划与进展</summary><div class="wjwk-mmlc-records">${module.records.filter(r=>['planned','working'].includes(r.status)).slice(4).map(card).join('')}</div></details>`:''}</section>`:''}`}
    ${!section && valid.some(r=>r.status==='working') ? `<section class="wjwk-mmlc-progress"><h2>正在推进</h2>${valid.filter(r=>r.status==='working').slice(0,4).map(r=>`<p><strong>${esc(r.name)}</strong> · ${esc(summary(r).slice(0,140))}</p>`).join('')}</section>`:''}
    ${this.creationPanel(power,chat,blocked,mode)}${this.automaticArchiveControls(power,blocked,mode)}${this.terminalPanel(power,chat,blocked,mode)}
    <details class="wjwk-home-tools"><summary>近期变化与历史</summary>${btn('archive-tools','一句话纠错与阶段回顾','wjwk-link',!canAI)}${playerTimeline(power,chat).filter(r=>!section || mmlcModule(r)===section.id).map(r=>`<p><strong>${esc(r.name)}</strong> · ${esc(r.text || '状态已更新')}</p>`).join('') || '<p>确认保存后，变化会留在这里。</p>'}</details>
    <details class="wjwk-home-tools"><summary>补充与记忆</summary><form><textarea name="playerNote" rows="2" maxlength="4000" placeholder="有遗漏？告诉AI一句话。" ${!canAI?'disabled':''}></textarea>${btn('player-supplement','AI 帮我整理','wjwk-secondary',!canAI)}</form>${btn('open-memory','正文记忆','wjwk-link',blocked || !power.active)}${btn('player-auto',power.autoArchiveReview?'关闭正文后自动整理':'开启正文后自动整理（消耗API）','wjwk-link',!canAI)}${btn('toggle-power',power.active?'暂停统计':'恢复统计','wjwk-link',blocked)}${btn('delete-power','删除统计数据','wjwk-link',blocked)}${all.some(r=>!archiveCurrent(r,chat))?`<details><summary>来源待核对</summary>${all.filter(r=>!archiveCurrent(r,chat)).map(card).join('')}</details>`:''}${rows.some(r=>r.status==='ended')?`<details><summary>已结束的内容</summary>${rows.filter(r=>r.status==='ended').map(card).join('')}</details>`:''}</details>`;
  }
  legacyManagement(state, power, blocked, mode, roleView = null, chat = []) {
    if (!power) return empty('接入金手指后，已有成果会保存在这里。');
    const records = Object.values(power.managementRecords || {});
    const profile = managementProfile(power), kinds = profile.verified ? profile.workflows : isMotherNest(power) ? [] : ['cycle', 'simulation'];
    const workflows = renderWorkflows(power, chat || [], blocked || !power.active, kinds);
    const history = (state.transactions || []).filter(t => t.powerId === power.id || t.type === 'management' && !t.powerId).slice(-5).reverse();
    return `<div class="wjwk-legacy-tools">
    ${records.length ? `<section><h3>已有记录</h3>${records.map(r => `<article class="wjwk-asset"><strong>${esc(r.label)}</strong><p>${esc(r.value)}</p><small>${r.status === 'ended' ? '已结束' : '当前有效'}</small>${chat && r.source.type === 'story' && !managementRecordCurrent(r, chat) ? '<p class="wjwk-error">来源正文已变化，待核对。</p>' : ''}<details><summary>来源</summary><p>${esc(r.source.quote || r.source.note)}</p></details><button type="button" data-action="manual-management" data-id="${esc(r.id)}" ${blocked ? 'disabled' : ''}>编辑记录</button></article>`).join('')}</section>` : ''}
    <details class="wjwk-record-tools"><summary>补充记录与正文核对</summary><div class="wjwk-toolbar">${btn('view-rule', '查看完整规则', 'wjwk-link')}${btn('manual-management', '补录管理记录', 'wjwk-secondary', blocked || !power.active)}${btn('review-management', '核对新增正文记录', 'wjwk-secondary', blocked || mode === 'off' || !power.active)}</div><p class="wjwk-muted">现有核对保存为文字记录；经营对象请用上方“核对正文变化”；此处保留旧版文字记录。</p></details>
    ${workflows ? `<details><summary>周期与模拟记录</summary>${workflows}</details>` : ''}
    ${roleView ? `<details><summary>角色变量</summary>${roleView.error ? `<p class="wjwk-error">${esc(roleView.error)}</p>` : roleView.roots.map(r => `<pre class="wjwk-full-rule">${esc(JSON.stringify(r.value, null, 2))}</pre>`).join('')}</details>` : ''}
    ${history.length ? `<details><summary>最近变化</summary>${history.map(t => `<article class="wjwk-receipt"><strong>${esc(t.label)}</strong><p>${esc((t.changes || []).join(' · '))}</p></article>`).join('')}</details>` : ''}</div>`;
  }
  archiveCard(record, chat, blocked, compact = false) {
    const current = archiveCurrent(record, chat), labels = ARCHIVE_FIELDS[record.type];
    return `<article class="wjwk-archive-card"><header><strong>${esc(record.name)}</strong><span class="wjwk-chip">${current ? esc(archiveStatus(record)) : '待核对'}</span></header><dl>${Object.entries(record.fields).filter(([, value]) => value).slice(0, compact ? 3 : 10).map(([field, value]) => `<div><dt>${esc(labels[field] || field)}</dt><dd>${esc(compact ? String(value).slice(0, 180) : value)}</dd></div>`).join('')}</dl><button type="button" data-action="open-archive" data-id="${esc(record.id)}" ${blocked ? 'disabled' : ''}>${compact ? '查看详情' : '查看与编辑'}</button><button type="button" data-action="open-memory" data-id="${esc(record.id)}" ${blocked || !current ? 'disabled' : ''}>带入正文</button></article>`;
  }
  statisticsDashboard(power,chat,blocked,dashboard){
    const button=r=>`<button type="button" class="wjwk-link" data-action="open-archive" data-id="${esc(r.id)}" ${blocked?'disabled':''}>${esc(r.name)} · ${archiveCurrent(r,chat)?esc(archiveStatus(r)):'待核对'} →</button>`;
    return `<section class="wjwk-statistics-dashboard" aria-label="${esc(dashboard.title)}"><h3>${esc(dashboard.title)}</h3><p class="wjwk-muted">${esc(dashboard.summary)}</p><div class="wjwk-statistics-dashboard-grid">${dashboard.sections.map(section=>{
      const visible=section.records.filter(r=>r.status!=='ended'),preview=visible.slice(0,2),remaining=visible.slice(2),ended=section.records.filter(r=>r.status==='ended'),c=section.counts;
      return `<article data-dashboard-section="${esc(section.id)}"><h4>${esc(section.label)}</h4><small>已建立 ${c.active} · 进行中 ${c.working} · 计划 ${c.planned}${c.stale?' · 待核对 '+c.stale:''}</small>${preview.map(r=>`<div class="wjwk-dashboard-object">${button(r)}<dl>${specificRows(r).slice(0,3).map(f=>`<div><dt>${esc(f.label)}</dt><dd>${esc(f.value.length>140?f.value.slice(0,140)+'…':f.value)}</dd></div>`).join('')}</dl></div>`).join('')||`<p class="wjwk-muted">${esc(section.description)}</p>`}${remaining.length?`<details><summary>其余 ${remaining.length} 项</summary>${remaining.map(button).join('')}</details>`:''}${ended.length?`<details><summary>已结束 ${ended.length} 项</summary>${ended.map(button).join('')}</details>`:''}</article>`;
    }).join('')}</div></section>`;
  }
  specializedStatistics(power,chat,blocked){
    const dashboard=statisticsDashboard(power,chat),covered=new Set(dashboard?.sections.flatMap(s=>s.records.map(r=>r.id))||[]);
    return (dashboard?this.statisticsDashboard(power,chat,blocked,dashboard):'')+specializedGroups(power,chat).filter(g=>g.records.some(r=>!covered.has(r.id))).map(g=>`<section class="wjwk-archive-section" data-specific-group="${esc(g.id)}"><h3>${esc(g.label)}</h3><small>已建立 ${g.active} · 进行中 ${g.working} · 计划 ${g.planned}${g.stale?' · 待核对 '+g.stale:''}</small><div class="wjwk-archive-grid">${g.records.filter(r=>r.status!=='ended').map(r=>`<article class="wjwk-archive-card"><header><strong>${esc(r.name)}</strong><span>${archiveCurrent(r,chat)?esc(archiveStatus(r)):'来源待核对'}</span></header><dl>${specificRows(r).slice(0,4).map(f=>`<div><dt>${esc(f.label)}</dt><dd>${esc(f.value.length>180?f.value.slice(0,180)+'…':f.value)}</dd></div>`).join('')}</dl>${specificRows(r).length>4?`<details><summary>更多情况 · ${specificRows(r).length-4} 项</summary><dl>${specificRows(r).slice(4).map(f=>`<div><dt>${esc(f.label)}</dt><dd>${esc(f.value.length>180?f.value.slice(0,180)+'…':f.value)}</dd></div>`).join('')}</dl></details>`:''}<button type="button" data-action="open-archive" data-id="${esc(r.id)}" ${blocked?'disabled':''}>查看详情</button></article>`).join('')}</div>${g.records.some(r=>r.status==='ended')?`<details><summary>已结束 · ${g.records.filter(r=>r.status==='ended').length}</summary>${g.records.filter(r=>r.status==='ended').map(r=>`<button type="button" class="wjwk-link" data-action="open-archive" data-id="${esc(r.id)}">${esc(r.name)}</button>`).join('')}</details>`:''}</section>`).join('');
  }
  outboxButton(state,blocked){
    const count=(state.creations||[]).filter(o=>o.status==='queued').length+(state.terminalOrders||[]).filter(o=>o.status==='queued').length;
    return count?`<div class="wjwk-outbox-strip">${btn('outbox-open',`下轮待发 · ${count}　查看内容 →`,'wjwk-outbox-button',blocked)}</div>`:'';
  }
  showOutbox(state,chat,bridge){
    const summary=outboxSummary(state,chat,{bridge});
    this.dialog('下一轮正文会收到什么',`<section data-outbox-dialog><p>继续在酒馆输入并发送消息即可带入。这里是拟议行动；实际进展由正文产生后再整理。</p>${summary.blocked?`<p role="status">${esc(summary.blocked)}</p>`:''}${summary.rows.map(o=>`<article class="wjwk-receipt" data-outbox-item="${esc(o.id)}"><header><strong>${esc(o.title)}</strong><span class="wjwk-chip">${esc(o.status)}</span></header><small>${esc(o.power)} · ${o.kind==='creation'?'AI拟定':'终端安排'}</small><details><summary>查看发送内容</summary><pre class="wjwk-full-rule">${esc(o.content)}</pre><p>${esc(o.conditions)}</p></details>${o.cancellable?`<button type="button" class="wjwk-link" data-action="outbox-cancel" data-kind="${o.kind}" data-id="${esc(o.id)}">撤回这项</button>`:''}</article>`).join('')||empty('没有待发送的方案或安排。')}<div class="wjwk-outbox-actions">${btn('outbox-return','回到酒馆输入并发送','wjwk-primary')}<small>保留输入框原有草稿，不会自动发送或调用模型。已保存成果的自动记忆仍在“发送档案给正文 AI”中预览。</small></div></section>`);
  }
  creationPanel(power,chat,blocked,mode){
    const section=isMmlc(power)?this.mmlcSection:null;
    const rows=(this.view?.state?.creations||[]).filter(o=>o.powerId===power.id&&(!section||o.operationId===section)).slice().reverse();
    if(section&&!rows.length)return '';
    const card=o=>`<article><strong>${esc(o.title)}</strong><small> · ${o.status==='queued'?(creationCurrent(o,power,chat)?'下一轮正文承接':'依据已变化，请撤销后重新拟定'):o.status==='cancelled'?'已撤销':!terminalOrderCurrent(o,chat)?'对应正文已变化 · 待重新核对':o.progress?(creationProgressCurrent(o,chat)?CREATION_PROGRESS[o.progress.status]:'进展来源待核对'):'已交正文 · 等待实际进展'}</small>${o.progress?`<p>${esc(o.progress.summary)}</p>${(o.progress.archiveIds||[]).filter(id=>power.archives?.[id]).map(id=>`<button type="button" class="wjwk-link" data-action="open-archive" data-id="${esc(id)}">查看成果：${esc(power.archives[id].name)}</button>`).join('')}`:''}<details><summary>查看拟定内容</summary><pre class="wjwk-full-rule">${esc(o.content)}</pre><p>${esc(o.conditions)}</p>${o.resultHistory?.length?`<details><summary>进展记录 · ${o.resultHistory.length} 次</summary>${o.resultHistory.slice().reverse().map(p=>`<article><strong>${esc(CREATION_PROGRESS[p.status])}</strong><p>${esc(p.summary)}</p><small>正文第 ${p.anchor.index+1} 层${archiveCurrent({source:{anchor:p.anchor}},chat)?'':' · 来源已变化'}</small><blockquote>${esc(p.quote)}</blockquote></article>`).join('')}</details>`:''}</details>${o.status==='queued'?btn('creation-cancel','撤销','wjwk-link',blocked).replace('data-action="creation-cancel"',`data-action="creation-cancel" data-id="${esc(o.id)}"`):''}</article>`;
    return `<section class="wjwk-terminal-panel"><div class="wjwk-section-heading"><h3>${isMmlc(power)?'行动方案与进展':'想尝试新内容？'}</h3>${section?'':btn('creation-open','AI 拟定','wjwk-secondary',blocked||!power.active||mode==='off').replace('data-action="creation-open"',`data-action="creation-open"${section?` data-section="${section}"`:''}`)}</div>${rows.length?rows.slice(0,2).map(card).join('')+ (rows.length>2?`<details><summary>更早的拟定 · ${rows.length-2} 项</summary>${rows.slice(2).map(card).join('')}</details>`:''):'<small>说一句目标，AI依照这个金手指拟定；采用后下一轮正文自动收到。</small>'}</section>`;
  }
  showCreation(power,operations,goal='',operationId=''){
    this.dialog(`${power.name} · AI 拟定`,`<form data-creation-dialog>${operations.length>1?`<label>想拟定什么<select name="operationId"><option value="">按我的目标判断</option>${operations.map(o=>`<option value="${esc(o.id)}" ${o.id===operationId?'selected':''}>${esc(o.label)}</option>`).join('')}</select></label>`:operations.length?`<input type="hidden" name="operationId" value="${esc(operations[0].id)}">`:''}<label>你想做什么？<textarea name="goal" required maxlength="1500" rows="3" placeholder="说说目标、想法或希望解决的问题……">${esc(goal)}</textarea></label><p class="wjwk-muted">AI 会参考已有成果与所选世界书。先看方案，可继续提修改意见，再决定采用。</p>${btn('creation-draft','让 AI 拟定','wjwk-primary')}</form>`);
  }
  showCreationPreview(draft,power,feedback=''){
    const o=draft.item;
    this.dialog(`${power.name} · ${o.title}`,`<form data-creation-dialog><p class="wjwk-muted">拟定 → 按需调整 → 采用 → 下一轮正文</p><pre class="wjwk-full-rule">${esc(o.content)}</pre><p><strong>条件与限制</strong></p><p>${esc(o.conditions)}</p><details><summary>词条依据</summary><blockquote>${esc(o.ruleQuote)}</blockquote></details><p class="wjwk-muted">采用后交给下一轮正文，生成设计本身不会增加能力或库存。</p>${btn('creation-adopt','采用，交给下一轮正文','wjwk-primary')}<input type="hidden" name="goal" value="${esc(o.goal)}"><input type="hidden" name="operationId" value="${esc(o.operationId)}"><details ${feedback?'open':''}><summary>想调整？告诉 AI 改哪里</summary><label>修改意见<textarea name="feedback" required maxlength="1500" rows="2" placeholder="例如：保留整体方案，减少投入，改用已有的人手……">${esc(feedback)}</textarea></label>${btn('creation-refine','按这条意见修改','wjwk-secondary')}<small>会参考上一稿修改；失败时保留原稿。</small></details></form>`);
  }
  terminalOrderCard(o,chat,blocked){
    const current=o.progress&&terminalProgressCurrent(o,chat),status=o.status==='queued'?(this.view.state.roleWrites.some(w=>w.id===o.id&&w.status==='pending')?'变量待同步':'待正文承接'):o.status==='cancelled'?'已撤销':!terminalOrderCurrent(o,chat)?'对应正文已变化':o.progress?(current?TERMINAL_PROGRESS[o.progress.status]:'结果待核对'):'已交正文 · 待结果';
    return `<article data-terminal-order="${esc(o.id)}"><strong>${esc(o.title)}</strong><span>${esc(status)}</span><p>${esc(o.subjects.map(r=>r.name).join('、'))} → ${esc(o.target)}</p>${o.progress?`<p class="${current?'':'wjwk-muted'}">${esc(o.progress.summary)}${current?'':'（原记录，尚未重新核对）'}</p>`:''}<details><summary>安排与历史${o.resultHistory?.length?' · '+o.resultHistory.length+' 次进展':''}</summary><p>${esc(o.task)}</p>${(o.resultHistory||[]).slice().reverse().map(p=>`<div class="wjwk-terminal-history"><strong>${esc(TERMINAL_PROGRESS[p.status])}</strong> · ${esc(p.summary)}<small>第 ${p.anchor.index+1} 层／回复 ${p.anchor.swipeId+1}</small><blockquote>${esc(p.quote)}</blockquote></div>`).join('')}</details>${terminalMemoryCurrent(o,chat)?btn('terminal-memory',this.view.state.archiveMemory?.selections?.[terminalMemoryIdentity(o)]?.mode==='pinned'?'固定带入中':this.view.state.archiveMemory?.selections?.[terminalMemoryIdentity(o)]?'下一轮已选':'带入正文','wjwk-link',blocked).replace('data-action="terminal-memory"',`data-action="terminal-memory" data-id="${esc(o.id)}"`):''}${o.status==='queued'&&!this.view.state.roleWrites.some(w=>w.id===o.id)?btn('terminal-cancel','撤销安排','wjwk-link',blocked).replace('data-action="terminal-cancel"',`data-action="terminal-cancel" data-id="${esc(o.id)}"`):''}</article>`;
  }
  terminalPanel(power,chat,blocked,mode){
    const inModule=kind=>!isMmlc(power)||!this.mmlcSection||({deploy:'land',assign:'sect',transfer:'items',fleet:'fleet'})[kind]===this.mmlcSection;
    const available=Object.entries(TERMINAL_KINDS).filter(([kind])=>terminalSubjects(power,chat,kind).length&&inModule(kind)),orders=(this.view?.state?.terminalOrders||[]).filter(o=>o.powerId===power.id&&inModule(o.kind)).slice().reverse();
    if(!available.length&&!orders.length)return '';
    const completed=orders.filter(o=>o.progress?.status==='completed'&&terminalProgressCurrent(o,chat)).length,active=orders.filter(o=>o.status==='queued'||o.status==='presented'&&terminalOrderCurrent(o,chat)&&(!o.progress||terminalProgressCurrent(o,chat)&&['working','blocked'].includes(o.progress.status))).length;
    return `<section class="wjwk-terminal-panel"><h3>安排事务${orders.length?`<small>待办 ${active} · 已完成 ${completed}</small>`:''}</h3><div class="wjwk-terminal-actions">${available.map(([kind,label])=>btn('terminal-open',label,'wjwk-secondary',blocked||mode==='off').replace('data-action="terminal-open"',`data-action="terminal-open" data-kind="${kind}"`)).join('')}${orders.some(o=>o.status==='presented')?btn('terminal-review','更新进展','wjwk-link',blocked||mode==='off'):''}</div><small>AI拟好安排，你确认后交给下一轮正文；整理剧情时一并追踪实际进展。</small>${orders.slice(0,6).map(o=>this.terminalOrderCard(o,chat,blocked)).join('')}${orders.length>6?`<details><summary>更早的安排 · ${orders.length-6} 项</summary>${orders.slice(6).map(o=>this.terminalOrderCard(o,chat,blocked)).join('')}</details>`:''}</section>`;
  }
  terminalSubjectVisibility(kind){for(const label of this.modal.querySelectorAll('[data-terminal-subject]')){const show=label.dataset.kinds.split(',').includes(kind);label.hidden=!show;label.querySelector('input').disabled=!show;}}
  showTerminal(power,chat,request){
    const all=Object.values(power.archives||{}).filter(r=>Object.keys(TERMINAL_KINDS).some(k=>terminalSubjects(power,chat,k).some(s=>s.id===r.id)));
    this.dialog(`${power.name} · 安排事务`,`<form data-terminal-dialog><label>安排什么<select name="kind" data-terminal-kind>${Object.entries(TERMINAL_KINDS).map(([kind,label])=>`<option value="${kind}" ${kind===request.kind?'selected':''} ${!terminalSubjects(power,chat,kind).length?'disabled':''}>${label}</option>`).join('')}</select></label><p>选择参与对象；不选则由AI从当前列表推荐。</p><div class="wjwk-terminal-subjects">${all.map(r=>`<label class="wjwk-checkbox" data-terminal-subject data-kinds="${Object.keys(TERMINAL_KINDS).filter(k=>terminalSubjects(power,chat,k).some(s=>s.id===r.id)).join(',')}"><input type="checkbox" name="subject" value="${esc(r.id)}" ${request.subjectIds.includes(r.id)?'checked':''}><span><strong>${esc(r.name)}</strong><small>${esc(Object.values(r.fields).filter(Boolean).join(' · ').slice(0,180))}</small></span></label>`).join('')}</div><details><summary>我有具体想法（可选）</summary><textarea name="goal" maxlength="1000" rows="2" placeholder="例如：让工蜂负责北坡巡视；把玉佩交给内门弟子。留空让AI推荐。"></textarea></details>${btn('terminal-draft','AI 帮我拟好安排','wjwk-primary',!all.length)}</form>`);this.terminalSubjectVisibility(request.kind);
  }
  showTerminalPreview(draft,power){const o=draft.order;
    this.dialog(`${power.name} · 确认安排`,`<form data-terminal-dialog><h3>${esc(o.title)}</h3><p><strong>${esc(o.subjects.map(r=>r.name).join('、'))}</strong> → ${esc(o.target)}</p><p>${esc(o.task)}</p><p class="wjwk-muted">确认后保存安排，并交给下一轮正文。尚未发生的移动、交接、消耗与收益不会提前记成事实。</p>${draft.rolePlan?`<label class="wjwk-checkbox"><input type="checkbox" name="syncVariables" value="yes" checked>同时同步角色中的安排字段</label><dl>${draft.rolePlan.changes.map(c=>`<div><dt>${esc(c.path)}</dt><dd>${esc(c.before)} → ${esc(c.after)}</dd></div>`).join('')}</dl>`:`<small>${draft.variableWarning?'变量预览未通过：'+esc(draft.variableWarning)+'。本次只保存安排并交正文。':'没有匹配的可写变量，本次保存安排并交正文。'}</small>`}<details><summary>规则依据</summary><blockquote>${esc(o.ruleQuote)}</blockquote></details>${btn('terminal-confirm','确认安排，交给下一轮正文','wjwk-primary')}</form>`);
  }
  archiveRangeVisibility(mode) {
    for(const field of this.modal.querySelectorAll('[data-archive-range-fields]')){field.hidden=field.dataset.archiveRangeFields!==mode;field.disabled=field.hidden;}
  }
  automaticArchiveControls(power, blocked, mode) {
    const config=normalizeArchiveAuto(power.archiveAuto), latest=Math.max(-1,...(power.archiveReviewed||[]).map(a=>a.index));
    const status=this.view?.pendingArchiveReview?.powerId===power.id?'等待你确认':this.view?.archiveAutoStatus?.[power.id] || (power.autoArchiveSave?'等待新正文':'尚未开启');
    return `<div class="wjwk-auto-controls"><div>${btn('player-auto-save',power.autoArchiveSave?'自动更新：开':'开启自动更新（消耗API）','wjwk-secondary',blocked||!power.active||mode==='off')}${btn('archive-range','更新设置','wjwk-link',blocked)}</div><small>${esc(status)} · 每${config.every}条角色回复更新 · 参考前文${config.context}条${latest>=0?' · 最近核对第'+(latest+1)+'层':''}</small><small>${isMmlc(power)?'八个统计模块一起更新；':isTaishi(power)?'诸界、眷属与发展事项一起更新；':'已开启的词条在后台更新；'}无需保持面板打开，酒馆页面需保持运行。读取范围只用于手动补漏。</small></div>`;
  }
  showArchiveRange(power, length) {
    const r=power.archiveReadRange||{mode:'recent',recent:24,from:1,to:null},auto=normalizeArchiveAuto(power.archiveAuto);
    this.dialog(`${power.name} · 更新设置`, `<form><h3>自动更新</h3><p>开启后，回复完成会自动整理并保存。所有已开启的词条独立更新，漫漫长路八个模块一起整理。</p><label>每几条角色回复更新一次<input type="number" name="every" min="1" max="12" required value="${auto.every}"></label><label>参考多少条前文<input type="number" name="context" min="0" max="80" required value="${auto.context}"></label><small>参考前文用于理解上下文，不重复计入新增成果。积压正文会分批接着处理，失败暂停。</small><details><summary>手动补漏的读取范围</summary><p>当前共${length}层；此处按聊天楼层编号，包含用户楼层计数，只读取角色正文。自动更新另行追踪未处理内容。</p><label>读取方式<select name="mode" data-archive-range-mode><option value="recent" ${r.mode==='recent'?'selected':''}>最近N层，随正文增长</option><option value="range" ${r.mode==='range'?'selected':''}>指定起止楼层</option></select></label><fieldset data-archive-range-fields="recent"><label>最近多少层<input type="number" name="recent" min="1" max="10000" required value="${r.recent}"></label></fieldset><fieldset data-archive-range-fields="range"><label>开始楼层<input type="number" name="from" min="1" max="1000000" required value="${r.from}"></label><label>结束楼层（留空跟随最新正文）<input type="number" name="to" min="1" max="1000000" value="${r.to??''}"></label></fieldset><p class="wjwk-muted">手动重查最多80条角色正文；自动每批最多12条，成功后继续下一批。每批调用一次API。</p></details>${btn('save-archive-range','保存更新设置','wjwk-primary')}</form>`);
    this.archiveRangeVisibility(r.mode);
  }
  showArchiveTools(power) {
    this.dialog(`${power.name} · 整理工具`, `<form data-archive-tool-dialog><h3>哪里不对？说一句即可</h3><textarea name="note" required minlength="6" maxlength="1500" rows="3" placeholder="例如：这两个是同一个对象，保留当前名字；或者：这个项目只是计划，还没有完成。"></textarea>${btn('archive-correct-draft','AI 拟好纠错，先看预览','wjwk-primary')}<p class="wjwk-muted">只修改已有记录。合并保留历史，数量不会自动相加。</p><details><summary>看看这段剧情发展了什么</summary><p>沿用更新设置中的手动正文读取范围；只回顾有有效来源的已保存记录，不重新读取整段剧情。</p>${btn('archive-recap','AI 生成阶段回顾','wjwk-secondary')}</details></form>`);
  }
  showArchiveCorrection(draft,power) {
    const {updates,merges,message}=draft.proposal;
    this.dialog(`${power.name} · 确认纠错`, `<div data-archive-tool-dialog><p>${esc(draft.note)}</p><p class="wjwk-muted">这是你确认的档案修正，不会改变正文、资源或角色变量。</p>${updates.map(u=>`<article class="wjwk-receipt"><h3>${esc(u.before.name)}${u.name!==u.before.name?' → '+esc(u.name):''}</h3>${this.archiveDiff({before:u.before,patch:u.fields,specific:u.specific,type:u.before.type,status:u.status})}</article>`).join('')}${merges.map(m=>`<article class="wjwk-receipt"><h3>合并：${esc(m.duplicate.name)} → ${esc(m.before.name)}</h3><p>保留两个对象的历史和来源，今后统计为同一个对象。旧待执行方案需要重新拟定。</p>${this.archiveDiff({before:m.before,patch:m.fields,specific:m.specific,type:m.before.type,status:m.status})}<details><summary>被合并对象的原情况</summary><dl>${Object.entries(m.duplicate.fields).filter(([,v])=>v).map(([k,v])=>`<div><dt>${esc(ARCHIVE_FIELDS[m.before.type][k])}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl></details></article>`).join('')}${message?`<p>${esc(message)}</p>`:''}${updates.length+merges.length?btn('archive-correct-apply','确认保存，可撤销','wjwk-primary'):empty('没有可保存的修改，可关闭后补充更明确的说明。')}</div>`);
  }
  showArchiveUndo(j,power) {
    const rows=j.entries.filter(e=>e.kind==='archives');
    this.dialog(`${power.name} · 撤销${j.label}`, `<div data-archive-tool-dialog><p>恢复 ${esc(new Date(j.at).toLocaleString())} 这次操作之前的记录。</p><ul>${rows.map(e=>`<li>${esc(power.archives[e.id]?.name||e.before?.name||e.id)}：${e.before?'恢复之前的档案与历史':'移除本次新建档案'}</li>`).join('')}</ul><p>同时恢复本次涉及的核对进度与安排结果。正文、余额、已写入的角色变量和历史操作日志不会回滚；本次撤销只可执行一次。</p>${btn('archive-undo-confirm','确认撤销这一次','wjwk-primary')}</div>`);
  }
  showArchiveRecap(power,evidence,points) {
    this.dialog(`${power.name} · 阶段回顾`, `<div data-archive-tool-dialog><p class="wjwk-muted">第 ${evidence.from}—${evidence.to} 层关联的 ${evidence.items.length} 条有效发展记录；AI总结仅供阅读，不新增事实或注入正文。</p>${points.map(p=>`<article class="wjwk-receipt"><p>${esc(p.text)}</p><details><summary>查看出处</summary>${p.refs.map(e=>`<p><strong>${esc(e.name)}</strong> · ${esc(ARCHIVE_STATUS[e.status])} · 第 ${e.floor} 层${e.sourceType==='manual'?'附近的玩家确认记录':''}</p><blockquote>${esc(e.quote)}</blockquote>${e.changes.map(c=>`<p>${esc(c.label)}：${esc(c.before||'未登记')} → ${esc(c.value||'清空')}</p>`).join('')}`).join('')}</details></article>`).join('')||empty('本范围没有适合总结的变化。')}</div>`);
  }
  showArchiveReview(pending, power, chat) {
    this.archiveReviewView = { pending, power, chat };
    this.dialog(`${power.name} · 档案变化`, `<form>${pending.issues?.length?`<section role="status"><p>${pending.issues.length} 项未通过校验，未记入成果；有效更新可以单独接受。</p><details><summary>查看未通过的条目</summary>${pending.issues.map(i=>`<p>${esc(i.name)}：${esc(i.reason)}</p>`).join('')}</details>${btn('runtime-log-open','查看运行日志','wjwk-link')}</section>`:''}${pending.guide ? `<section><h3>这个金手指能做什么</h3><p>${esc(pending.guide.summary)}</p>${pending.guide.abilities.map(a => `<p><strong>${esc(a.name)}</strong> · ${esc(a.description)}</p><details><summary>规则依据</summary><blockquote>${esc(a.ruleQuote)}</blockquote></details>`).join('')}</section>` : ''}${pending.setupReferences?'<p role="status">这是世界书设定底稿，尚未成为正文事实。仅确认当前实际采用的内容；保存后保留历史，可撤销。</p>':''}<p class="wjwk-muted">AI已拟好更新，确认正确即可整批接受；不接受的项取消勾选。</p>${pending.changes.map((c, i) => `<article class="wjwk-receipt"><label class="wjwk-checkbox"><input type="checkbox" name="archive-change" value="${i}" checked><strong>${esc(c.name)} · ${esc(isMmlc(power) ? MMLC_MODULES.find(m => m.id === c.module)?.title || '待分类' : c.specific?.label||ARCHIVE_TYPES[c.type])}</strong></label>${c.recovery ? '<p class="wjwk-muted">旧来源已变化：确认后用当前正文重建完整情况，保留原对象和历史。旧字段与旧来源不再继承。</p>' : ''}<details><summary>更正归属对象</summary><label>保存到<select name="target:${i}" data-archive-target="${i}">${c.recovery ? '' : '<option value="">新建对象</option>'}${Object.values(power.archives || {}).filter(r => r.type === c.type && (archiveCurrent(r, chat) || c.recovery && r.id === c.id)).map(r => `<option value="${esc(r.id)}" ${r.id === c.id ? 'selected' : ''}>${esc(r.name)}</option>`).join('')}</select></label></details><div data-archive-diff="${i}">${this.archiveDiff(c)}</div><details><summary>查看正文与规则证据</summary><p>${c.source.type === 'story' ? `第${c.source.anchor.index + 1}条消息／回复${c.source.anchor.swipeId + 1}` : '你补充的情况 · 待确认'}</p><blockquote>${esc(c.source.quote)}</blockquote><p>${esc(c.source.ruleQuote)}</p></details></article>`).join('') || empty(pending.readOnly?'本次没有可接受更新，未推进读取进度。':'本批没有确定的经营档案变化。确认后仅记录本批已核对。')}${(pending.terminalResults||[]).length?`<h3>安排进展</h3>${pending.terminalResults.map((c,i)=>`<article class="wjwk-receipt"><label class="wjwk-checkbox"><input type="checkbox" name="terminal-result" value="${i}" checked><strong>${esc(c.title)} · ${esc(TERMINAL_PROGRESS[c.progress.status])}</strong></label><p>${esc(c.progress.summary)}</p>${c.recovery?'<p class="wjwk-muted">旧结果来源已变化；确认后以这次正文核对的结果为准，历史保留。</p>':''}<details><summary>正文证据 · 第 ${c.progress.anchor.index+1} 层</summary><blockquote>${esc(c.progress.quote)}</blockquote></details></article>`).join('')}`:''}${(pending.creationResults||[]).length?`<h3>拟定内容的实际进展</h3>${pending.creationResults.map((c,i)=>`<article class="wjwk-receipt"><label class="wjwk-checkbox"><input type="checkbox" name="creation-result" value="${i}" checked><strong>${esc(c.title)} · ${esc(CREATION_PROGRESS[c.progress.status])}</strong></label><p>${esc(c.progress.summary)}</p><small>关联成果随所选档案一起保存；取消关联档案时，此进展留待下次。</small>${c.recovery?'<p class="wjwk-error">旧结果来源已变化，请确认本次正文重新证实的情况。</p>':''}<details><summary>正文依据 · 第 ${c.progress.anchor.index+1} 层</summary><blockquote>${esc(c.progress.quote)}</blockquote></details></article>`).join('')}`:''}${pending.readOnly?'':btn('apply-archive-review', pending.changes.length || pending.terminalResults?.length || pending.creationResults?.length ? '接受这些更新' : pending.guide ? '保存玩法说明' : '确认本批无变化', 'wjwk-primary')}</form>`);
  }
  archiveDiff(c) {
    const before = c.before, after = c.recovery ? { ...c.patch } : { ...before?.fields, ...c.patch };
    const rows = Object.keys(after).filter(k => !before || before.fields[k] !== after[k]);
    const conflict = before && (rows.some(k => before.fields[k]) || before.status !== c.status);
    return `${conflict ? '<p class="wjwk-muted">已有情况将按下方差异更新；未提及的内容保留。</p>' : ''}<p>${before ? `更新：${esc(before.name)}` : '新建对象'} · ${before ? esc(archiveStatus(before)) + ' → ' : ''}${esc(archiveStatus(c))}</p><dl>${rows.map(k => `<div><dt>${esc(ARCHIVE_FIELDS[c.type][k])}</dt><dd>${esc(before?.fields[k] || '未登记')} → ${esc(after[k] || '清空')}</dd></div>`).join('')}</dl>${specificDiff(before?.specific,c.specific).length?`<dl>${specificDiff(before?.specific,c.specific).map(f=>`<div><dt>${esc(f.label)}</dt><dd>${esc(f.before||'未登记')} → ${esc(f.value||'清空')}</dd></div>`).join('')}</dl>`:''}${before && !c.recovery ? '<small>未列出的字段保留。</small>' : ''}`;
  }
  updateArchiveDiff(index, target) {
    const v = this.archiveReviewView, row = this.modal.querySelector(`[data-archive-diff="${index}"]`);
    if (row && v) { try { row.innerHTML = this.archiveDiff(archiveChangeTarget(v.pending.changes[index], v.power, target || null, v.chat)); } catch (e) { row.textContent = e.message; } }
  }
  showMemory(power, config, plan, chat, state = this.view?.state, focusOrderId = null, diagnostic = null) {
    const orders=(state?.terminalOrders||[]).filter(o=>o.powerId===power.id&&o.status==='presented');
    const options=(id)=>[['','自动选择'],['exclude','从不发送'],['next','仅发送一次'],['pinned','每次都发送']].map(([mode,label])=>`<option value="${mode}" ${(config.selections[id]?.mode||'')===mode?'selected':''}>${label}</option>`).join('');
    const archiveRows=Object.values(power.archives||{}).map(r=>`<label>${esc(r.name)}${archiveCurrent(r,chat)?'':' · 来源待核对（暂不发送）'}<select name="memory:${esc(r.id)}">${options(archiveIdentity(power,r))}</select></label>`).join('');
    const orderRow=o=>`<label>${esc(o.title)} · ${esc(o.progress?TERMINAL_PROGRESS[o.progress.status]:'待结果')}${terminalMemoryCurrent(o,chat)?'':' · 来源待核对（暂不发送）'}<select name="terminal-memory:${esc(o.id)}">${options(terminalMemoryIdentity(o))}</select></label>`;
    const focused=orders.find(o=>o.id===focusOrderId),explanation='<small>发送安排的最新进展，供正文接着写；不会重新下达同一任务。已完成或失败的安排默认不再发送。</small>';
    const choices=focused?`<h3>安排与进展</h3>${orderRow(focused)}${explanation}<details><summary>其他成果与安排</summary>${archiveRows}${orders.filter(o=>o.id!==focused.id).map(orderRow).join('')}</details>`:`${archiveRows||(!orders.length?empty('还没有已保存档案。先用“AI 整理当前情况”整理已有剧情。'):'')}${orders.length?`<h3>安排与进展</h3>${orders.map(orderRow).join('')}${explanation}`:''}`;
    const modes={auto:'自动选择',next:'仅发送一次',pinned:'每次都发送'};
    const preview=plan.included.length?`<ul class="wjwk-memory-items">${plan.included.map(item=>`<li><span>${esc(item.name)}</span><small>${esc(modes[item.mode]||item.mode)}</small></li>`).join('')}</ul>`:`<p class="wjwk-muted">${config.auto?'暂时没有可发送的档案。先整理并保存剧情成果；已有档案未出现时，展开下方原因查看。':'自动发送未开启，且本次没有有效的手动指定项。'}</p>`;
    this.dialog(`${power.name} · 发送给正文 AI`, `<form data-memory-settings>
      <p>把已保存的成果和进展附在下一次正文请求里，让正文 AI 参考这些长期记录继续写。</p>
      <section class="wjwk-memory-setting"><label class="wjwk-checkbox"><input type="checkbox" name="auto" ${config.auto ? 'checked' : ''}>自动发送相关档案</label><small>开启后不用逐条选择。修改后点击“保存发送设置”生效；仅影响当前聊天。</small></section>
      <dl class="wjwk-memory-explainer"><div><dt>什么时候发送</dt><dd>你在酒馆生成下一次正文时，随正文请求一起发送。</dd></div><div><dt>自动发送什么</dt><dd>已保存档案的概况、与当前输入或近期剧情相关的详情，以及未结束安排的进展。覆盖本聊天全部已启用金手指和漫漫长路。</dd></div><div><dt>会不会额外调用 AI</dt><dd>这里不会单独调用 API；发送的文字会占用正文模型的上下文和输入额度。</dd></div></dl>
      <h3>下次预计发送 · ${plan.included.length} 项</h3><small>按当前输入与近期剧情预览；发送前会重新选择相关内容，并检查来源与长度。</small>${preview}
      ${plan.omitted.length?`<details><summary>未发送的条目与原因 · ${plan.omitted.length} 项</summary><ul>${plan.omitted.map(r=>`<li>${esc(r.name)}：${esc(r.reason)}</li>`).join('')}</ul></details>`:''}
      <details><summary>查看将附加的完整文字 · ${plan.packet.length} / ${plan.budget} 字符</summary><pre class="wjwk-full-rule">${esc(plan.packet || '本次没有可发送的内容。')}</pre></details>
      ${focusOrderId?choices:`<details><summary>例外设置 · 指定哪些档案发送</summary><p>以下只设置“${esc(power.name)}”的例外；其他词条的选择保留。</p>${choices}<small>通常保持“自动选择”即可。“每次都发送”和“仅发送一次”在关闭自动发送后仍有效；仅发送一次会在确认生成新正文后清除。</small></details>`}
      <details><summary>高级设置 · 发送长度</summary><label>本聊天所有金手指合计字符上限<input type="number" name="budget" min="750" max="12000" required value="${config.budget}"></label><small>概况、详情和安排共享此上限，最多发送 16 项；超出时整项跳过。不会把计划当成已完成成果。</small></details>
      <div class="wjwk-toolbar">${btn('preview-memory','刷新发送预览','wjwk-secondary')}${btn('save-memory','保存发送设置','wjwk-primary')}</div>
    </form><details><summary>最近发送记录 · 与上述预览分开</summary>${this.memoryReport(diagnostic,this.view?.bridge!==false)}</details>${state?.archiveMemory?.last?`<details><summary>上次保存的发送内容</summary><p class="wjwk-muted">这是上次写入正文请求的内容，不代表正文 AI 已遵循。</p><pre class="wjwk-full-rule">${esc(state.archiveMemory.last.packet)}</pre></details>`:''}`);
  }
  showRule(power) { this.dialog(`${power.name} · 规则`, `<pre class="wjwk-full-rule">${esc(power.rules)}</pre>`); }
  showAdapter(power,library={schemaVersion:1,revision:0,configs:[]}) {
    const binding=power.adapterBinding,candidates=matchingAdapters(power,library).filter(c=>!binding||c.id===binding.config.id);
    this.dialog(`${power.name} · 词条适配配置`,`<p>适配包导入一次，同一酒馆账户的新聊天自动关联匹配词条；已有聊天保留自己的版本。</p><p class="wjwk-muted">配置操作已接入 AI 拟定和下一轮正文承接；专用统计字段已接入 AI 整理，按正文证据保存。</p>${binding?`<p><strong>${esc(binding.config.name)} · ${esc(binding.config.version)}</strong></p><p>${adapterBindingCurrent(power)?'已关联，可在 AI 拟定中使用':'词条规则已变化，原适配须重新核对'}</p>`:'<p>当前尚未登记适配配置，继续使用现有通用功能。</p>'}${binding&&adapterBindingCurrent(power)&&!library.configs.some(c=>c.id===binding.config.id)?btn('adapter-share','供其他聊天复用','wjwk-secondary'):''}<p>账户适配库：${new Set(library.configs.map(c=>c.id)).size}种适配。${candidates.length>1&&!binding?'当前有多个匹配方案，沿用通用功能；需要时可在下方选择。':''}</p>${candidates.length?`<details><summary>可用适配${binding?'与更新':''}</summary>${candidates.map(c=>`<p><strong>${esc(c.name)} · ${esc(c.version)}</strong> <button type="button" data-action="adapter-library-use" data-id="${esc(c.id)}">查看${binding?.config.id===c.id?'与核对更新':''}</button></p>`).join('')}</details>`:''}<label>导入适配文件<input type="file" accept=".json,application/json" data-adapter-file></label><details><summary>作者接入信息</summary><p>原文指纹：<code>${primaryHash(power)}</code></p><p>身份使用作者命名空间与固定词条ID，版本采用数字三段；匹配原文，不依赖文件名或显示名称。</p></details>`);
  }
  showAdapterPreview(power, preview) {
    const c=preview.config;
    this.dialog(`${power.name} · 适配预览`,`<p><strong>${esc(c.name)} · ${esc(c.version)}</strong></p><p>${esc(c.description)}</p><small>ID：${esc(c.id)} · ${({new:'首次接入',update:'更新原适配',recheck:'重新核对规则',unchanged:'已登记此版本'})[preview.mode]}</small><h3>适用操作</h3>${c.operations.map(o=>`<article><strong>${esc(o.label)} · ${esc(ADAPTER_OPERATIONS[o.kind])}</strong><p>${esc(o.instruction)}</p><details><summary>词条依据</summary><blockquote>${esc(o.ruleQuote)}</blockquote></details></article>`).join('')}<h3>长期统计结构</h3>${c.records.map(r=>`<article><strong>${esc(r.label)}</strong><p>${esc(r.description)}</p><ul>${r.fields.map(f=>`<li>${esc(f.label)}：${esc(f.description)}</li>`).join('')}</ul></article>`).join('')}<p class="wjwk-muted">保存到当前账户适配库，并关联当前词条；其他已有聊天的版本不变。操作用于 AI 拟定与正文承接；专用字段用于 AI 整理后的成果展示。</p>${btn('adapter-confirm',preview.mode==='unchanged'?'保存到适配库':'保存并关联','wjwk-primary')}`);
  }
  archiveJourneyRows(rows) {
    return rows.map(row=>{
      const source=row.source||{}, anchors=[source.anchor,...(source.anchors||[])].filter(Boolean);
      const floors=[...new Set(anchors.map(a=>a.index+1))];
      const status=row.previousStatus&&row.previousStatus!==row.status ? `${archiveStatus({type:row.type,status:row.previousStatus})} → ${archiveStatus(row)}` : archiveStatus(row);
      const moduleName=id=>MMLC_MODULES.find(m=>m.id===id)?.title||id||'未分类';
      return `<li><strong>${row.first?'首次登记':'更新'} · ${esc(row.name)}</strong><small>${esc(new Date(row.at).toLocaleString())} · ${esc(status)}</small>${!row.current?'<p class="wjwk-error">历史来源待核对，不作为当前事实</p>':''}${row.previousName&&row.previousName!==row.name?`<p>名称：${esc(row.previousName)} → ${esc(row.name)}</p>`:''}${row.previousModule!==undefined&&row.previousModule!==row.module?`<p>模块：${esc(moduleName(row.previousModule))} → ${esc(moduleName(row.module))}</p>`:''}<dl>${row.changes.map(f=>`<div><dt>${esc(f.label)}</dt><dd>${row.first?esc(f.value):`${esc(f.before||'未登记')} → ${esc(f.value||'已清空')}`}</dd></div>`).join('')}</dl><details><summary>${source.type==='story'?'正文依据':'玩家确认的补充'}${floors.length?' · 第'+floors.join('、')+'层':''}</summary><p>${esc(source.note)}</p>${source.quote?`<blockquote>${esc(source.quote)}</blockquote>`:''}</details></li>`;
    }).join('');
  }
  renderArchiveJourney(limit = 5) {
    const node=this.modal.querySelector('[data-archive-journey]'); if(!node||!this.journey)return;
    this.journeyLimit=limit;
    const {entries,rechecks}=this.journey, shown=entries.slice(0,limit);
    node.innerHTML=`<h3>发展记录</h3><small>按保存顺序，最近在前；${entries.length}次实际内容登记${rechecks?'，另有'+rechecks+'次来源核对':''}。不是剧情时间线。</small><ol>${this.archiveJourneyRows(shown)}</ol>${entries.length>limit?btn('archive-history-more',`查看更早记录（剩余${entries.length-limit}条）`,'wjwk-link'):''}`;
  }
  showArchive(power, record = null, chat = [], state = this.view?.state || {}) {
    const type = record?.type || archivePanel(power).defaultType;
    const form = `<form><label>类型<select name="type" data-archive-type ${record ? 'disabled' : ''}>${Object.entries(ARCHIVE_TYPES).map(([id, label]) => `<option value="${id}" ${type === id ? 'selected' : ''}>${label}</option>`).join('')}</select>${record ? `<input type="hidden" name="type" value="${type}">` : ''}</label><label>名称<input name="name" required maxlength="200" value="${esc(record?.name || '')}"></label><label>状态<select name="status">${Object.entries(ARCHIVE_STATUS).map(([id, label]) => `<option value="${id}" ${(record?.status || 'active') === id ? 'selected' : ''}>${label}</option>`).join('')}</select></label><div data-archive-fields></div>${record?.specific?specificRows(record).map(f=>`<label>${esc(f.label)}<textarea name="specific:${esc(f.id)}" maxlength="4000" rows="2">${esc(f.value)}</textarea></label>`).join(''):''}<p class="wjwk-muted">只填写已有依据的情况；没有明确数量时可以填“少量”，未知字段留空。</p><label>核对依据<input name="note" maxlength="600" value="${esc(record?.source.note || '')}" placeholder="例如：已核对当前剧情中的育种成果"></label>${btn('save-archive', record ? '保存更新' : '保存档案', 'wjwk-primary')}</form>`;
    const current=record&&archiveCurrent(record,chat);
    const floors=record?[...new Set([record.source.anchor,...(record.source.anchors||[])].filter(Boolean).map(a=>a.index+1))]:[];
    const overview=record?`<section class="wjwk-object-current" data-archive-current><h3>${esc(record.name)}</h3><span class="wjwk-chip">${current?esc(archiveStatus(record)):'来源待核对'}</span>${!current?'<p class="wjwk-error">当前来源已变化；以下是上次保存的情况，暂不计入当前成果或正文记忆。</p>':''}<dl>${Object.entries(record.fields).filter(([,v])=>v).map(([k,v])=>`<div><dt>${esc(ARCHIVE_FIELDS[type][k]||k)}</dt><dd>${esc(v)}</dd></div>`).join('')}${specificRows(record).map(f=>`<div><dt>${esc(f.label)}</dt><dd>${esc(f.value)}</dd></div>`).join('')}</dl><details><summary>当前核对依据${floors.length?' · 第'+floors.join('、')+'层':''}</summary><p>${esc(record.source.note)}</p>${record.source.quote?`<blockquote>${esc(record.source.quote)}</blockquote>`:''}</details></section><section class="wjwk-object-journey" data-archive-journey></section>`:'';
    const targets=record?Object.values(state?.powers||{}).filter(p=>p.active&&p.id!==power.id):[];
    const suggested=record?foreignArchiveOwner(record,power,state):null;
    const ownership=targets.length?`<details data-archive-ownership><summary>更正所属金手指</summary><form><p class="wjwk-muted">选对归属后移动这条档案，内容与历史保留；目标已有同名档案时合并历史，保留目标当前情况，不叠加数量。不会执行能力或修改角色变量。</p><label>移动到<select name="targetPowerId" required><option value="">请选择</option>${targets.map(p=>`<option value="${esc(p.id)}" ${suggested?.id===p.id?'selected':''}>${esc(p.name)}</option>`).join('')}</select></label>${btn('move-archive','确认更正归属','wjwk-primary')}</form></details>`:'';
    const prior=record?.previousSpecific?`<details><summary>原分类统计（保留内容）</summary>${specificRows({specific:record.previousSpecific}).map(f=>`<p>${esc(f.label)}：${esc(f.value)}</p>`).join('')}</details>`:'';
    this.dialog(`${power.name} · ${record?'对象详情':'添加档案'}`,overview+(record&&isMmlc(power)&&current?`<section class="wjwk-mmlc-relations"><h3>关联成果</h3>${mmlcLinked(power,chat,record.id).map(r=>`<button type="button" data-action="open-archive" data-id="${esc(r.id)}" class="wjwk-link">${esc(r.name)} · ${esc(ARCHIVE_STATUS[r.status])}</button>`).join('')||'<p class="wjwk-muted">尚无已确认关联，不按名字相似推断。</p>'}</section>`:'')+(record?`<details data-archive-edit><summary>手工纠正</summary>${form}</details>`:form)+prior+ownership);
    this.archiveFields(type, record?.fields);
    this.journey=record?archiveJourney(record,chat):null;
    if(record)this.renderArchiveJourney();
  }
  archiveFields(type, fields = {}) {
    const active = this.modal.querySelector('[name="status"] option[value="active"]');
    if (active) active.textContent = archiveStatus({ type, status: 'active' });
    const node = this.modal.querySelector('[data-archive-fields]');
    if (node) node.innerHTML = Object.entries(ARCHIVE_FIELDS[type] || {}).map(([key, label]) => `<label>${esc(label)}<textarea name="field:${key}" maxlength="4000" rows="2">${esc(fields[key] || '')}</textarea></label>`).join('');
  }
  showManualStory(action, chat, minimum) {
    this.manualStoryChat = chat;
    const sources = chat.flatMap((m, index) => index >= minimum && !m.is_user && !m.is_system && workflowText(m.mes ?? m.content ?? '') ? [{ index, m }] : []);
    this.dialog('手动确认正文承接', `<form><p>${esc(action.label)} · ${esc(action.intent)}</p><label>已有模型回复<select name="sourceIndex" data-manual-story-source>${sources.map(({ index, m }) => `<option value="${index}">第${index + 1}条消息 · 回复${(m.swipe_id ?? 0) + 1}</option>`).join('')}</select></label><details><summary>查看所选正文</summary><pre class="wjwk-full-rule" data-manual-story-body></pre></details><label>承接证据<textarea name="quote" required minlength="6" maxlength="6000" rows="5" placeholder="从所选正文逐字摘录实际承接这笔行动的段落"></textarea></label><p class="wjwk-muted">由你确认所选段落已承接行动。这里只登记对应关系；不会生成正文、结算或写入角色变量。</p>${sources.length ? btn('save-manual-story', '确认此段正文已承接', 'wjwk-primary') : empty('尚无可选择的模型回复，请先完成正文。')}</form>`);
    this.manualStoryExcerpt(sources[0]?.index);
  }
  manualStoryExcerpt(index) {
    const node = this.modal.querySelector('[data-manual-story-body]');
    if (node) node.textContent = workflowText(this.manualStoryChat?.[Number(index)]?.mes ?? this.manualStoryChat?.[Number(index)]?.content ?? '');
  }
  showWorkflow(power, draft, chat) { this.dialog('剧情周期与模拟档案 · 玩家核对', workflowForm(power, draft, chat)); }
  showManagementReview(pending, state) {
    this.dialog('正文管理变化 · 请逐项核对', `<form><p>${esc(pending.message)}</p><p class="wjwk-muted">只登记长期事实，不结算收益。取消不推进核对位置；确认后本批未勾选项也视为已核对。</p>${pending.changes.map((c, i) => `<article class="wjwk-receipt"><label class="wjwk-checkbox"><input type="checkbox" name="management-change" value="${i}" checked><span><strong>${esc(state.powers[c.powerId].name)} · ${esc(c.label)}</strong><small>${esc(MANAGEMENT_CATEGORIES[c.category])} · ${c.status === 'ended' ? '已结束' : '当前有效'}</small></span></label><p>原状态：${esc(c.before?.value || '未知')}</p><p>新状态：${esc(c.value)}</p><details><summary>第${c.source.index + 1}条正文证据与词条依据</summary><blockquote>${esc(c.source.quote)}</blockquote><p>${esc(c.source.ruleQuote)}</p></details></article>`).join('') || empty('没有确定变化，确认后仅记录本批已核对。')}${btn('apply-management', '确认所选变化并完成本批核对', 'wjwk-primary')}</form>`);
  }
  showManagementRecord(power, record, template = null) {
    this.dialog(`${power.name} · ${record ? '校准' : '补录'}管理记录`, `<form><p class="wjwk-muted">仅保存武库管理事实。余额和库存数量请使用原有账本，角色变量不在这里修改。</p><label>类型<select name="category" ${record ? 'disabled' : ''}>${Object.entries(MANAGEMENT_CATEGORIES).map(([id, label]) => `<option value="${id}" ${(record?.category || template?.category) === id ? 'selected' : ''}>${label}</option>`).join('')}</select>${record ? `<input type="hidden" name="category" value="${esc(record.category)}">` : ''}</label><label>事项名称<input name="label" required maxlength="200" value="${esc(record?.label || template?.label || '')}"></label>${template ? `<p class="wjwk-muted">模板只预填名称与类型，事实内容保持空白；按对象或地点调整名称。模板依据：${esc(template.ruleQuote || '通用记录，请自行核对完整规则')}</p>` : ''}<label>当前完整状态<textarea name="value" required maxlength="8000" rows="4">${esc(record?.value || '')}</textarea></label><label>状态<select name="status"><option value="active">当前有效</option><option value="ended" ${record?.status === 'ended' ? 'selected' : ''}>已结束</option></select></label><label>校准依据<input name="note" maxlength="600" placeholder="例如：核对当前正文中的领域安排"></label>${btn('save-management', '确认保存管理记录', 'wjwk-primary')}</form>`);
  }
  detail(power, op, blocked, roleLinked = false, mode = 'off') {
    const affordable = canAfford(power, op);
    const changes = op.rolePlan?.changes || [], fmt = v => typeof v === 'string' ? v : JSON.stringify(v);
    const checks = op.rolePlan?.roleChecks || [];
    const evidence = checks.map(c => `<section class="wjwk-rule-evidence"><strong>${esc(c.ruleName)}</strong><p>${esc(c.paths.join('；'))}</p><p class="wjwk-rule-quote">${esc(c.quote)}</p><p>${esc(c.reason)}</p></section>`).join('') || `<p>${esc(op.rolePlan?.roleRuleQuote || '绑定余额由插件按确认投入计算')}</p>`;
    const roleHTML = roleLinked ? op.rolePlan ? `<div class="wjwk-detail-label">角色变量将这样变化</div><ul class="wjwk-role-changes">${changes.map(c => `<li><strong>${esc(c.path)}</strong><span>${c.added ? '新增' : esc(fmt(c.before))} → ${esc(fmt(c.after))}</span></li>`).join('')}</ul><details><summary>逐项角色规则依据（模型说明，请核对）</summary>${evidence}</details><p class="wjwk-muted">字段已通过 MVU 预检。请核对品级含义、触发条件和上述理由；结构通过不代表文字规则全部被正确理解。</p>` : `<p class="wjwk-resource-hint">该操作需要先映射到角色字段。</p>${btn('prepare-role', '生成角色写回预览', 'wjwk-primary', blocked || mode === 'off' || !affordable.ok)}${mode === 'off' ? '<p class="wjwk-muted">连接异步模型后可按角色规则生成字段映射。</p>' : ''}` : '';
    return `<h3>${esc(op.label)}</h3><div class="wjwk-detail-label">投入</div><ul>${op.costs.map(c => `<li>${esc(resText(power, c))}</li>`).join('') || '<li>无资源消耗</li>'}</ul><div class="wjwk-detail-label">所得与实际效力</div><ul>${op.effects.map(e => `<li>${esc(effectText(e))}${e.permanent ? '<span class="wjwk-permanent">永久所得</span>' : ''}</li>`).join('')}</ul>${op.requirements.length ? `<div class="wjwk-detail-label">成立条件</div><ul>${op.requirements.map(r => `<li>${esc(r)}</li>`).join('')}</ul>` : ''}<details><summary>词条依据</summary><p class="wjwk-rule-quote">${esc(op.ruleQuote)}</p></details>${roleHTML}${op.intent ? `<div class="wjwk-detail-label">玩家确认的行动意图</div><p>${esc(op.intent)}</p>` : ''}<label>正文呈现偏好（可留空）<textarea data-story-note rows="2" maxlength="2000" placeholder="例如：在院中试演新掌法，着重写身体感受。" ${blocked ? 'disabled' : ''}>${esc(this.storyNote || '')}</textarea></label>${btn('execute', '确认并展开剧情', 'wjwk-execute', blocked || !affordable.ok || (roleLinked && !op.rolePlan))}${btn('execute-later', '随下一轮正文承接', 'wjwk-secondary', blocked || !affordable.ok || (roleLinked && !op.rolePlan))}<p class="wjwk-muted">${esc(affordable.ok ? roleLinked ? '投入与成果将记账，并写回预览中的角色字段。' : '投入与成果会写入当前聊天账本。' : affordable.reason)}</p>`;
  }
  assets(power) {
    if (!power) return empty('尚未接入词条');
    return Object.values(power.assets).map(a => `<article class="wjwk-asset"><div><strong>${esc(a.name)}</strong><span>× ${esc(a.quantity)}</span></div><small>${esc(a.kind)}${a.permanent ? ' · 永久' : ''}</small><p>${esc(a.description)}</p></article>`).join('') + Object.values(power.fields).map(f => `<article class="wjwk-asset"><strong>${esc(f.label)}</strong><p>${esc(f.value)}</p></article>`).join('') || empty('所得、已有能力与持久状态会在这里完整记录。');
  }
  actionEntrances(state, power, candidates, blocked, mode) {
    const favorites = (state?.favoriteActions || []).filter(a => a.powerId === power?.id);
    return `<section class="wjwk-action-entrances"><div class="wjwk-toolbar">${btn('scene-open', '场景建议', 'wjwk-secondary', blocked || !power?.active || mode === 'off')}${btn('save-favorite', '收藏当前交易意图', 'wjwk-link', blocked || !power?.active || !this.goal.trim())}</div>${favorites.length ? `<details><summary>常用交易意图 · ${favorites.length}</summary>${favorites.map(a => `<div class="wjwk-favorite"><button type="button" data-action="use-favorite" data-id="${esc(a.id)}" class="wjwk-link" ${blocked ? 'disabled' : ''}>${esc(a.label)}</button><button type="button" data-action="delete-favorite" data-id="${esc(a.id)}" class="wjwk-link" ${blocked ? 'disabled' : ''}>删除</button></div>`).join('')}</details>` : ''}</section>`;
  }
  showSceneSuggestions(power, candidates = null) {
    const a = candidates?.actions || [], coverage = candidates?.coverage;
    this.dialog(`${power.name} · 场景建议`, `<form data-scene-dialog><label>这次想解决什么？<input name="focus" data-scene-focus maxlength="1000" value="${esc(this.sceneFocus || '')}" placeholder="可留空，例如：应对粮食短缺，优先利用已有种群"></label>${btn('scene-actions', candidates ? '重新生成建议' : '生成建议', 'wjwk-primary', this.view?.busy || this.view?.settings.mode === 'off')}<p class="wjwk-muted">结合当前正文、未发送草稿和已有档案。点选只写入草稿，由你修改后发送。</p>${candidates?.roleUnavailable ? `<p class="wjwk-muted">${esc(candidates.roleUnavailable)}</p>` : ''}${coverage && (coverage.omittedCount || coverage.excludedStaleCount) ? `<p class="wjwk-muted">此次提供${coverage.items.length}项档案；${coverage.omittedCount}项因上下文预算未提供，${coverage.excludedStaleCount}项来源待核对。</p>` : ''}${a.length ? `<div class="wjwk-scene-actions">${a.map((s, i) => `<article class="wjwk-scene-card"><header><span class="wjwk-chip">${esc(SCENE_KINDS[s.kind])}</span><h3>${esc(s.label)}</h3></header><label class="wjwk-checkbox"><input type="checkbox" name="keep-scene" value="${i}" ${(candidates.keptIndices||[]).includes(i)?'checked':''}>保留这条路线</label><p>${esc(s.goal)}</p><p class="wjwk-scene-reason">${esc(s.benefit)}</p>${s.uncertainty ? `<p class="wjwk-muted">关键未知：${esc(s.uncertainty)}</p>` : ''}${s.provisional.length ? `<p class="wjwk-muted">${esc(s.provisional.join('、'))}仍是计划、进行中或已结束档案，不能视为已获得能力。</p>` : ''}<details><summary>依据${s.archiveNames.length ? ' · ' + esc(s.archiveNames.join('、')) : ''}</summary><p>第${s.sourceIndex + 1}条消息${s.sourceIsIntent ? '（玩家意向，不代表已发生）' : ''}</p><blockquote>${esc(s.sceneQuote)}</blockquote><p>${esc(s.ruleQuote)}</p></details><button type="button" class="wjwk-primary" data-action="select-scene" data-index="${i}">写入正文输入框</button></article>`).join('')}</div>${btn('scene-regenerate-others','保留勾选路线，重生成其他方向','wjwk-secondary',this.view?.busy||this.view?.settings.mode==='off')}` : candidates ? empty(candidates.message || '当前证据不足，请补充这次的目标或正文信息。') : ''}</form>`);
  }
  setSceneBusy(busy) {
    const form = this.modal.querySelector('[data-scene-dialog]');
    if (form) for (const input of form.querySelectorAll('button,input,select')) input.disabled = busy;
  }

  narratives(state, busy, mode, manualBusy = busy) {
    const chat = this.view?.managementChat;
    const actions = (state?.narrativeActions || []).filter(a => ['waiting', 'generating', 'presented'].includes(a.status) || a.status === 'confirmed' && chat && !storyEvidenceCurrent(a, chat));
    if (!actions.length) return '';
    const pendingWrite = state.roleWrites?.some(w => w.status === 'pending');
    return actions.slice(-8).map(a => {
      const stale = a.result && chat && !storyEvidenceCurrent(a, chat);
      const presented = a.status === 'presented' && !stale, actionButton = (name, label, cls = 'wjwk-secondary', disabled = busy) => `<button type="button" data-action="${name}" data-id="${esc(a.id)}" class="${cls}" ${disabled ? 'disabled' : ''}>${label}</button>`;
      const review = a.review ? `<details><summary>模型辅助核对：${a.review.covered ? '已有逐项证据，仍需玩家核对' : '存在缺失项'}</summary>${a.review.checks.map(c => `<p><strong>${esc(c.item)} · ${c.ok ? '有证据' : '未覆盖'}</strong> ${esc(c.reason)}</p>${c.quotes.map(q => `<blockquote>${esc(q)}</blockquote>`).join('')}`).join('')}</details>` : '';
      return `<section class="wjwk-story-action"><div><strong>${esc(a.label)}</strong><span class="wjwk-chip">${stale ? '正文依据已变化 · 待重新核对' : presented ? '正文已生成 · 待核对' : busy && a.status === 'generating' ? '正在展开' : '已结算 · 待承接'}</span></div><p>${esc(a.intent)}</p>${a.error ? `<p class="wjwk-muted">${esc(a.error)}</p>` : ''}${presented ? `<details><summary>查看对应正文 · 第${a.result.index + 1}条消息</summary><p class="wjwk-story-excerpt">${esc(a.result.excerpt)}</p></details>${review}<div class="wjwk-toolbar">${actionButton('confirm-story', '正文已承接', 'wjwk-primary', manualBusy)}${actionButton('review-story', '检查正文覆盖', 'wjwk-secondary', busy || mode === 'off')}${actionButton('retry-story', '缺少呈现 · 待补写')}</div>` : `<p class="wjwk-muted">下一轮正常正文会承接。重试只补剧情，不再扣费或写变量。</p><div class="wjwk-toolbar">${a.status === 'confirmed' ? '' : actionButton('unfold-story', '展开待承接行动', 'wjwk-primary', busy || pendingWrite)}${actionButton('confirm-story', '手动确认正文已承接', 'wjwk-secondary', manualBusy)}${actionButton('stop-story', '停止自动承接', 'wjwk-link')}</div>`}</section>`;
    }).join('');
  }
  receipts(state) {
    const byId = new Map((state?.transactions || []).map(t => [t.id, t])), latest = new Map();
    for (const w of state?.roleWrites || []) if (w.status === 'applied' && byId.has(w.id)) latest.set(byId.get(w.id).powerId, w.id);
    const fmt = v => typeof v === 'string' ? v : JSON.stringify(v);
    return (state?.transactions || []).slice(-50).reverse().map(t => {
      const write = state.roleWrites?.find(w => w.id === t.id), needsReceipt = write?.status === 'applied' && latest.get(t.powerId) === t.id && (write.receiptStatus !== 'written' || write.receiptFormat !== 'status');
      const story = state.narrativeActions?.find(a => a.id === t.id);
      const narrative = story ? `<p class="wjwk-muted">正文：${{ waiting: '待承接', generating: '正在承接／中断后可重试', presented: '已生成，待核对', confirmed: '玩家已确认承接', stopped: '已停止自动承接' }[story.status]}</p><details><summary>行动意图与正文记录</summary><p>${esc(story.intent)}</p><p>${esc(story.result?.excerpt || '尚无对应正文')}</p></details>` : '';
      const variables = write?.changes?.length ? `<details><summary>角色变量完整变化</summary><ul>${write.changes.map(c => `<li><strong>${esc(c.path)}</strong><p>${c.added ? '新增' : esc(fmt(c.before))} → ${esc(fmt(c.after))}</p></li>`).join('')}</ul></details>` : '';
      return `<article class="wjwk-receipt"><div><strong>${esc(t.label)}</strong><small>${esc(new Date(t.at).toLocaleString())}</small></div>${t.roleWrite ? `<p class="${t.roleWrite === 'applied' ? 'wjwk-muted' : 'wjwk-error'}">${{ applied: '角色已写回并读回核对', pending: '角色写回待完成；武库已记账', abandoned: '角色写回已停止；武库账目保留' }[t.roleWrite]}</p>` : ''}${needsReceipt ? `<p class="wjwk-muted">${esc(write.receiptError || '可将最近一笔整理为状态栏简报，并收起旧版独立回执。')}</p><button type="button" data-action="append-role-receipt" data-id="${esc(t.id)}" class="wjwk-secondary">整理状态栏简报（不再扣费）</button>` : write?.receiptStatus === 'written' ? '<p class="wjwk-muted">状态栏简报已保存</p>' : write?.receiptStatus === 'archived' ? '<p class="wjwk-muted">旧消息简报已收起，完整变化保留在下方</p>' : ''}<ul>${(t.changes || []).map(c => `<li>${esc(c)}</li>`).join('')}</ul>${variables}${narrative}${t.evidence?.length ? `<details><summary>剧情证据</summary>${t.evidence.map(e => `<p>${esc(e)}</p>`).join('')}</details>` : ''}</article>`;
    }).join('') || empty('尚无执行回执');
  }
  dialog(title, body) {
    this.modal.hidden = false; this.modal.innerHTML = `<section class="wjwk-dialog" role="dialog" aria-modal="true" aria-label="${esc(title)}"><header><h2>${esc(title)}</h2>${btn('dialog-close', icon('close'), 'wjwk-icon-button')}</header><div class="wjwk-dialog-body">${body}</div><p class="wjwk-notice" role="status">${esc(this.notice?.message || '')}</p></section>`;
    this.modal.querySelector('input,select,textarea,button')?.focus();
  }
  closeDialog() { this.modal.hidden = true; this.modal.innerHTML = ''; this.journey = null; }
  showSettings(settings, { keyPresent = false, currentModel = '', profiles = [] } = {}) {
    this.modelIds = [];
    this.dialog('AI连接与方案', `<form><section class="wjwk-api-profiles"><label>已保存的连接方案<select name="connectionProfile" data-api-profile><option value="">当前未命名连接</option>${profiles.map(p=>`<option value="${esc(p.id)}" ${p.id===settings.activeConnectionProfile?'selected':''}>${esc(p.name)} · ${p.mode==='custom'?esc(p.model):p.mode==='st'?'酒馆连接':'已关闭'}</option>`).join('')}</select></label><div class="wjwk-toolbar">${btn('new-api-profile','＋ 新建方案','wjwk-secondary')}${btn('delete-api-profile','删除所选方案','wjwk-link',!settings.activeConnectionProfile)}</div><input type="hidden" name="profileKeyPolicy" value="current"><label>方案名称<input name="profileName" maxlength="60" value="${esc(profiles.find(p=>p.id===settings.activeConnectionProfile)?.name || '')}" placeholder="例如：日常整理 / 深度推演"></label><small>选择已有方案立即切换；新建后填写地址、Key和模型，再保存。</small></section><label>1. 选择连接方式<select name="mode"><option value="off" ${settings.mode === 'off' ? 'selected' : ''}>暂不启用异步模型</option><option value="st" ${settings.mode === 'st' ? 'selected' : ''}>沿用酒馆当前连接（无需另填）</option><option value="custom" ${settings.mode === 'custom' ? 'selected' : ''}>独立 API 连接</option></select></label><p class="wjwk-muted" data-st-info>已沿用酒馆的连接和预设${currentModel ? `，当前模型：${esc(currentModel)}` : ''}。模型切换沿用酒馆主界面的选择。</p><div data-custom-settings><label>2. API 地址<input name="baseUrl" value="${esc(settings.baseUrl)}" placeholder="https://你的接口/v1" autocomplete="off"></label><label>API Key<input name="apiKey" type="password" placeholder="${keyPresent ? '已保存到酒馆；留空沿用' : '粘贴你的 Key；无需先填写模型名'}" autocomplete="new-password"></label><label class="wjwk-checkbox"><input type="checkbox" name="clearKey">清除已填写的 Key</label><div class="wjwk-model-tools">${btn('fetch-models', '3. 获取／刷新模型列表', 'wjwk-primary')}<span data-model-status class="wjwk-muted" role="status">填写地址和 Key 后点这里。</span></div><label>搜索模型<input data-model-search placeholder="按模型名称筛选，如 deepseek / gemini" autocomplete="off"></label><label>从列表选择<select data-model-list><option value="">先获取列表，也可在下方手动填写</option></select></label><label>当前使用的模型<input name="model" value="${esc(settings.model)}" placeholder="获取列表后自动填入，可切换或手动输入" autocomplete="off"></label><p class="wjwk-muted">首次获取会填入首个可能的聊天模型，保留你已有的选择。列表中出现的模型不一定支持文本生成。</p></div><details><summary>高级设置与自动核算（可跳过）</summary><div class="wjwk-form-grid"><label>查询超时（秒）<input name="timeoutSeconds" type="number" min="10" max="300" value="${settings.timeoutSeconds}"></label><label>输出上限（独立连接）<input name="maxTokens" type="number" min="256" max="32768" value="${settings.maxTokens}"></label><label>温度（独立连接）<input name="temperature" type="number" min="0" max="2" step="0.1" value="${settings.temperature}"></label><label>近期剧情条数<input name="contextMessages" type="number" min="1" max="100" value="${settings.contextMessages}"></label></div><label class="wjwk-checkbox"><input name="autoSync" type="checkbox" ${settings.autoSync ? 'checked' : ''}>主叙事结束后自动核算并提交新增剧情收益</label></details><p class="wjwk-muted">连接与 Key 保存到当前酒馆账户，所有聊天共用；刷新后保留，勾选清除可删除 Key。启用后，完整词条与选定剧情会发送给所选模型。</p><div class="wjwk-toolbar">${btn('save-api-profile','保存方案并使用','wjwk-primary')}${btn('save-settings', '仅保存当前连接', 'wjwk-secondary')}</div></form><details data-task-routing><summary>按任务选择模型（可选）</summary><p>先保存连接方案，再为任务选择。留空沿用当前连接；总开关关闭时所有任务暂停。失败不自动换模型或重试。</p><form>${Object.entries(AI_TASKS).map(([id,label])=>`<label>${label}<select name="route:${id}"><option value="">沿用当前连接</option>${profiles.filter(p=>p.mode!=='off').map(p=>`<option value="${esc(p.id)}" ${settings.taskRoutes?.[id]===p.id?'selected':''}>${esc(p.name)} · ${esc(p.model||'酒馆连接')}</option>`).join('')}</select></label>`).join('')}${btn('save-task-routes','保存任务分流','wjwk-primary')}</form></details><details><summary>插件 AI 参考世界书</summary><p>为本聊天的整理、拟定等请求附加所选设定。</p>${btn('ai-ref-open','选择世界书条目','wjwk-secondary',!this.view?.state)}</details>${btn('runtime-log-open','运行日志','wjwk-link')}`);
    this.connectionVisibility(settings.mode);
  }
  applyTheme(settings=this.settings?.() || this.view?.settings) { if(this.root)this.root.dataset.theme=themeId(settings?.theme); }
  showThemes() {
    const selected=themeId(this.settings()?.theme);
    this.dialog('界面主题',`<p class="wjwk-muted">主题控制明暗与纸色，模块各有自己的视觉风格；当前酒馆账户的聊天共用。</p><div class="wjwk-theme-grid">${Object.entries(THEMES).map(([id,label])=>`<button type="button" data-action="set-theme" data-theme="${id}" aria-pressed="${selected===id}">${esc(label)}</button>`).join('')}</div>`);
  }
  newConnectionProfile() {
    const f=this.modal.querySelector('form');if(!f)return;
    f.elements.connectionProfile.value='';f.elements.profileName.value='';f.elements.profileKeyPolicy.value='new';
    f.elements.mode.value='custom';for(const name of ['baseUrl','model','apiKey'])f.elements[name].value='';
    f.elements.apiKey.placeholder='新Key；免鉴权接口可留空';f.elements.clearKey.checked=false;
    this.modelIds=[];this.filterModels('');this.connectionVisibility('custom');
    this.modal.querySelector('[data-action="delete-api-profile"]').disabled=true;
    f.elements.profileName.focus();
  }
  connectionVisibility(mode) { const custom = this.modal.querySelector('[data-custom-settings]'), st = this.modal.querySelector('[data-st-info]'); if (custom) custom.hidden = mode !== 'custom'; if (st) st.hidden = mode !== 'st'; }
  setModelLoading(loading, message = '') { const button = this.modal.querySelector('[data-action="fetch-models"]'); if (button) { button.disabled = loading; button.textContent = loading ? '正在获取模型…' : '获取／刷新模型列表'; } const status = this.modal.querySelector('[data-model-status]'); if (status) status.textContent = message; }
  setModels(ids, selected) { this.modelIds = ids; const input = this.modal.querySelector('[name="model"]'); if (input) input.value = selected; this.filterModels(this.modal.querySelector('[data-model-search]')?.value || ''); }
  filterModels(query) { const select = this.modal.querySelector('[data-model-list]'); if (!select) return; const current = this.modal.querySelector('[name="model"]')?.value || ''; const matches = (this.modelIds || []).filter(id => id.toLowerCase().includes(query.trim().toLowerCase())); select.innerHTML = `<option value="">${matches.length ? `找到 ${matches.length} 个模型，点选切换` : '没有匹配项，可修改搜索或手动填写'}</option>` + (!matches.includes(current) && current ? `<option value="${esc(current)}" selected>${esc(current)}（当前使用）</option>` : '') + matches.map(id => `<option value="${esc(id)}" ${id === current ? 'selected' : ''}>${esc(id)}</option>`).join(''); }
  showManage(catalog, names = [], role = {}) {
    this.catalog = catalog;
    this.dialog('金手指与角色接入', `<section class="wjwk-access-panel"><h3>① 选择金手指</h3><p class="wjwk-muted">自用版不带内置规则，请在下方读取你的万界武库世界书（自动选中最新版本）。</p><div class="wjwk-import-row"><form><select name="book">${names.map(n => `<option value="${esc(n)}"${n === ziyongBestBook(names)?" selected":""}>${esc(n)}</option>`).join('') || '<option value="">暂无可读取的世界书</option>'}</select>${btn('read-book', '读取酒馆世界书', 'wjwk-secondary', !names.length)}</form><label class="wjwk-file-button">导入世界书 JSON<input type="file" accept=".json,application/json" data-book-file></label></div><p class="wjwk-muted">选择玩家当前实际使用的词条；接入后自动进入余额确认。</p>${catalog.length ? `<form><label>查找金手指<input data-entry-search placeholder="输入名称，如 蝴蝶 / 深蓝 / 升变"></label><label>主词条<select name="primary" data-primary>${catalog.map(e => this.entryOption(e, ziyongPrimary(e, catalog))).join('')}</select></label><p data-resource-hint class="wjwk-resource-hint"></p><details${catalog.some(e => ziyongCompanion(e, catalog)) ? ' open' : ''}><summary>附加约束词条（例如全局结算思维链）${catalog.some(e => ziyongCompanion(e, catalog)) ? ' · 已按自用配置预选，可修改' : ''}</summary><div class="wjwk-companions">${[...catalog].sort((a, b) => (ziyongCompanion(b, catalog) && !ziyongPrimary(b, catalog)) - (ziyongCompanion(a, catalog) && !ziyongPrimary(a, catalog))).map(e => `<label class="wjwk-checkbox"><input type="checkbox" name="companion" value="${esc(e.id)}"${ziyongCompanion(e, catalog) && !ziyongPrimary(e, catalog) ? ' checked' : ''}>${esc(e.name)}</label>`).join('')}</div></details><details><summary>查看主词条完整正文</summary><pre class="wjwk-full-rule" data-rule-preview></pre></details>${btn('register', '接入并确认余额', 'wjwk-primary')}</form>` : empty('读取或导入世界书后，可从完整词条中选择。')}</section>${this.rolePanel(role, names)}`);
    { const pre = catalog.find(e => ziyongPrimary(e, catalog)) || catalog[0]; if (pre) this.previewRule(pre.id); }
    this.updateRoleSelection(this.modal.querySelector('[data-role-form]'));
  }
  updateRoleSelection(form) {
    if (!form) return;
    const checked = [...form.querySelectorAll('[name="role-rule"]:checked')], valid = checked.some(input => input.dataset.roleKind === 'update');
    const status = form.querySelector('[data-role-selected-count]'), save = form.querySelector('[data-action="role-save"]');
    if (status) { status.textContent = `已选择 ${checked.length} 条规则${valid ? '，包含变量更新规则。' : '；请勾选至少一条变量更新规则。'}`; status.classList.toggle('wjwk-error', !valid); }
    if (save) save.disabled = !valid;
  }
  rolePanel({ state, draft, error } = {}, names = []) {
    const linked = Boolean(state?.roleLink), powers = Object.values(state?.powers || {});
    let body = `<p class="wjwk-muted">读取当前单角色聊天的 MVU 变量，以及绑定世界书中的变量结构、更新规则和输出格式。无需上传角色卡或手写路径。</p>${btn('role-read', draft ? '重新读取当前角色' : '读取当前角色变量与规则', 'wjwk-primary')}${linked ? btn('role-detach', '解除接入并停止待写回', 'wjwk-secondary') : ''}${error ? `<p class="wjwk-error">${esc(error)}</p>` : ''}`;
    if (draft) {
      const scopeText = draft.capture.option.type === 'message' ? `第 ${draft.capture.option.message_id + 1} 条消息 · 回复 ${draft.capture.swipeId + 1}` : '聊天变量';
      const roots = draft.fields.filter(f => draft.roots.includes(f.path) || (f.path.split('/').length <= 4 && (['object', 'array'].includes(f.type) || f.path.split('/').length === 2))).slice(0, 100);
      const numeric = draft.fields.filter(f => f.numeric), selected = new Set(draft.selectedRules || []), value = v => JSON.stringify(v);
      body += `<div class="wjwk-resource-hint">${esc(draft.characterName)} · ${esc(scopeText)}<br>读取于 ${esc(new Date(draft.readAt).toLocaleTimeString())} · ${draft.fields.length} 个已显示字段</div>${draft.warnings.map(w => `<p class="wjwk-error">${esc(w)}</p>`).join('')}<form data-role-form><h4>1. 核对角色规则</h4><p data-role-selected-count class="wjwk-resource-hint" role="status">核对下方勾选；选择规则与展开正文是两个独立操作。</p><p class="wjwk-muted">至少选择一条变量更新规则。下列正文完整保留；原书停用的条目默认不选。</p>${draft.rules.map(r => `<article class="wjwk-rule-choice"><label class="wjwk-checkbox"><input type="checkbox" name="role-rule" data-role-kind="${esc(r.kind)}" value="${esc(r.id)}" ${selected.has(r.id) ? 'checked' : ''}><span><strong>${esc(r.name)}</strong><small>${esc(r.book)}${r.enabledInBook ? '' : '（原书停用，仍可手动勾选）'}</small></span></label><details><summary>查看完整规则正文</summary><pre class="wjwk-full-rule">${esc(r.content)}</pre></details></article>`).join('') || '<p class="wjwk-error">没有识别到规则；可在下方补充读取角色实际使用的世界书。</p>'}<h4>2. 选择允许写回的区域</h4><p class="wjwk-muted">默认建议主角区域。只勾选此次金手指需要影响的字段；绑定余额可独立于这些区域写回。</p><div class="wjwk-root-options">${roots.map(f => `<label class="wjwk-checkbox"><input type="checkbox" name="role-root" value="${esc(f.path)}" ${draft.roots.includes(f.path) ? 'checked' : ''}>${esc(f.label)} <small>${esc(f.type)}</small></label>`).join('')}</div><h4>3. 绑定资源余额</h4><p class="wjwk-muted">名称唯一匹配时预选。核对下拉框中当前值即可；无对应字段则保留由武库管理。</p>${powers.map(p => `<div class="wjwk-balance-group"><strong>${esc(p.name)}</strong>${Object.values(p.resources).map(r => { const current = draft.bindings[`${p.id}:${r.id}`]; return `<label>${esc(r.name)}<select name="role-balance:${esc(p.id)}:${esc(r.id)}"><option value="">由武库管理，不绑定角色字段</option>${numeric.map(f => `<option value="${esc(f.path)}" ${current === f.path ? 'selected' : ''}>${esc(f.label)} = ${esc(f.value)}</option>`).join('')}</select></label>`; }).join('') || '<p class="wjwk-muted">此词条无数值资源。</p>'}</div>`).join('') || '<p class="wjwk-muted">先在上方接入金手指，再重新读取角色，可自动建议余额绑定。</p>'}<details><summary>检查实际变量字段（只读）</summary><div class="wjwk-variable-tree">${draft.fields.map(f => `<div><strong>${esc(f.label)}</strong><small>${esc(f.type)} · ${esc(f.path)}</small><span>${esc(value(f.value).slice(0, 350))}${value(f.value).length > 350 ? '…（展示缩略）' : ''}</span></div>`).join('')}</div></details><details><summary>MVU 提供的运行时结构</summary><pre class="wjwk-full-rule">${esc(draft.schema ? JSON.stringify(draft.schema, null, 2) : '当前 MVU 未提供可展示的 schema。上方字段类型来自实际变量；执行时仍通过安装的 MVU 解析和角色校验流程。')}</pre></details><p class="wjwk-muted">保存接入会将绑定余额读入武库。生成方案时，所选角色规则、变量区域和金手指全文会发送给你选择的异步模型。</p>${btn('role-save', '保存角色接入与余额绑定', 'wjwk-primary')}</form><details><summary>没有找到规则？补充读取已有世界书</summary><form><select name="roleBook">${names.map(n => `<option value="${esc(n)}">${esc(n)}</option>`).join('')}</select>${btn('role-extra-book', '补充读取此世界书', 'wjwk-secondary', !names.length)}</form></details>`;
    } else if (linked) body += `<p class="wjwk-resource-hint">当前聊天已保存角色接入：${state.roleLink.rules.length} 条规则，${Object.keys(state.roleLink.bindings).length} 项绑定。读取后可检查并修改。</p>`;
    return `<section class="wjwk-access-panel"><h3>② 角色状态 · MVU</h3>${body}</section>`;
  }
  entryOption(entry, sel = false) { const resources = inferResources(entry), profile = managementProfile(entry); return `<option ${sel ? 'selected ' : ''}${profile.verified && profile.role === 'support' ? 'disabled' : ''} value="${esc(entry.id)}">${esc(entry.name)}${profile.verified && profile.role === 'support' ? ' · 辅助规则，请选入附加约束' : ''}${resources.length ? ` · ${esc(resources.map(r => r.name).join('、'))}` : ''} · ${esc(entry.book)}</option>`; }
  filterEntries(query) { const select = this.modal.querySelector('[data-primary]'); if (!select) return; const current = select.value; const entries = (this.catalog || []).filter(e => e.name.includes(query.trim()) || e.book.includes(query.trim())); select.innerHTML = entries.map(e => this.entryOption(e)).join(''); select.value = entries.some(e => e.id === current) ? current : entries[0]?.id || ''; this.previewRule(select.value); }
  previewRule(id) { const entry = this.catalog?.find(e => e.id === id); const preview = this.modal.querySelector('[data-rule-preview]'); if (preview) preview.textContent = entry?.content || ''; const hint = this.modal.querySelector('[data-resource-hint]'); if (hint) { const resources = entry ? inferResources(entry) : []; hint.textContent = !entry ? '没有匹配的词条' : resources.length ? `已识别资源：${resources.map(r => r.name).join('、')}。接入后核对当前余额。` : '没有识别到固定数值资源，可直接接入；物品与能力按正文登记。'; if (entry) { const profile = managementProfile(entry); hint.textContent += ` 管理：${profile.verified ? '原文匹配配置' : '通用回退'}；${profile.templates.length}项模板。${profile.note}`; } } }
  showBaseline(power, findings = {}, link = null) {
    const resources = Object.values(power.resources), found = resources.filter(r => r.balance === null && findings[r.id]);
    this.dialog(`${power.name} · 确认当前余额`, `<form><p>${resources.length ? `已识别 ${resources.length} 项资源，聊天中找到 ${found.length} 项可用于初始化的数值。核对下方即可开始。` : '此词条没有识别到固定数值资源，可直接开始使用。'}</p>${resources.map(r => this.balanceRow(r, findings[r.id], `balance:${r.id}`, link?.bindings[`${power.id}:${r.id}`])).join('')}<div class="wjwk-toolbar">${btn('extract-balances', '重新扫描聊天余额', 'wjwk-secondary')}${resources.some(r => r.balance === null) ? btn('zero-balances', '空白余额设为 0', 'wjwk-secondary') : ''}</div><p class="wjwk-muted">已有账本余额优先。找不到的数值可直接填写；留空继续保持未确认。“空白余额设为 0”只填写空白项，候选值和已有值保持原样；确认后才保存。</p><details><summary>已有能力与物资（按需要补录）</summary><label>名称<input name="assetName" maxlength="200" placeholder="例如：基础呼吸法"></label><label>类别<input name="assetKind" maxlength="100" placeholder="能力 / 物资 / 起始事实"></label><label>数量<input name="assetQuantity" value="1" inputmode="decimal"></label><label>完整规格与当前掌握程度<textarea name="assetDescription" maxlength="8000" rows="3"></textarea></label><label class="wjwk-checkbox"><input type="checkbox" name="assetPermanent">永久持有的成果</label></details><details><summary>高级：资源补充、预支规则与校准备注</summary>${resources.map(r => `<label>${esc(r.name)}允许的最低余额<input name="floor:${esc(r.id)}" ${link?.bindings[`${power.id}:${r.id}`] ? 'readonly' : ''} value="${esc(r.floor ?? '0')}" inputmode="decimal"></label>`).join('')}<label>新增正文定义的资源名<input name="resourceName" maxlength="200" placeholder="没有自动识别到的实际货币或次数"></label><label>新增资源余额<input name="resourceBalance" inputmode="decimal" placeholder="留空为未知"></label><label>校准备注（可不填）<input name="reason" maxlength="600" placeholder="自动记录为玩家确认当前余额"></label></details>${btn('save-baseline', resources.length ? '确认这些余额并开始' : '保存并返回操作台', 'wjwk-primary')}</form>`);
  }
  balanceRow(resource, finding, inputName, boundPath = null) {
    const value = resource.balance ?? finding?.balance ?? '';
    return `<article class="wjwk-balance-row"><label>${esc(resource.name)}<input name="${esc(inputName)}" value="${esc(value)}" inputmode="decimal" placeholder="直接填入当前余额" data-balance-unknown="${resource.balance === null}" ${boundPath ? 'readonly aria-readonly="true"' : ''}></label><p class="wjwk-muted">${boundPath ? `已绑定角色字段 ${esc(boundPath)}，此处只读；点“刷新角色余额”更新。` : resource.balance !== null ? `当前账本：${esc(resource.balance)}${finding ? `；聊天候选：${esc(finding.balance)}（不自动覆盖）` : ''}` : finding ? `来源：${esc(finding.source)} · 原文：${esc(finding.evidence || finding.balance)}` : '聊天中未找到明确数值，请填写实际余额。'}</p></article>`;
  }
  fillZeroBalances(form) { for (const field of form.querySelectorAll('[data-balance-unknown="true"]')) if (!field.value.trim()) field.value = '0'; const reason = form.querySelector('[name="reason"]'); if (reason && !reason.value) reason.value = '玩家明确将空白的未确认余额设为0'; }
  applyBalanceFindings(power, findings, form) {
    for (const r of Object.values(power.resources)) {
      const finding = findings[r.id], field = [...form.querySelectorAll('input')].find(input => input.name === `balance:${r.id}`);
      if (field && finding && !field.value.trim()) field.value = finding.balance;
      const source = field?.closest('.wjwk-balance-row')?.querySelector('p');
      if (source && finding) source.textContent = `聊天候选 ${finding.balance} · ${finding.source} · 原文：${finding.evidence || finding.balance}；已有输入不自动覆盖。`;
    }
  }
  showBalances(powers, findings, link = null) { this.dialog('全部已接入词条 · 当前余额', `<form><p class="wjwk-muted">一起核对当前聊天的全部资源；已有账本优先，尚未确认的资源自动显示聊天候选。</p>${powers.map(p => `<section class="wjwk-balance-group"><h3>${esc(p.name)}</h3>${Object.values(p.resources).map(r => this.balanceRow(r, findings[p.id]?.[r.id], `balance:${p.id}:${r.id}`, link?.bindings[`${p.id}:${r.id}`])).join('') || '<p class="wjwk-muted">无固定数值资源，不需要配置货币。</p>'}</section>`).join('')}${btn('save-balances', '确认并保存这些余额', 'wjwk-primary')}</form>`); }
  showSync(events, state, message) {
    this.dialog('新增剧情 · 核算预览', `<p>${esc(message || '请核对新增事实、投入与收益。')}</p>${events.map(op => `<article class="wjwk-receipt"><strong>${esc(state.powers[op.powerId].name)} · ${esc(op.label)}</strong><ul>${op.costs.map(c => `<li>投入：${esc(resText(state.powers[op.powerId], c))}</li>`).join('')}${op.effects.map(e => `<li>${esc(effectText(e))}</li>`).join('')}</ul><details><summary>新增叙事证据</summary>${op.evidence.map(e => `<p>${esc(e)}</p>`).join('')}</details></article>`).join('') || empty('没有可结算的新增事实。确认后仅更新核算进度。')}${btn('apply-sync', '确认此次核算', 'wjwk-primary')}`);
  }
  showBackup() { this.dialog('恢复聊天档案', `<p>恢复会替换当前聊天的武库账本。请先导出现有档案。不会改动聊天文本或原始世界书。</p>${btn('export', '先导出现有档案', 'wjwk-secondary')}<label class="wjwk-file-button">选择武库备份 JSON<input type="file" accept=".json,application/json" data-backup-file></label>`); }
  showDeletePower(power) {
    this.dialog('删除已接入词条', `<p>删除当前聊天中的「${esc(power.name)}」？</p><p>该词条的余额、能力与物资、长期成果档案和常用行动将被移除，自动整理与正文承接停止。历史回执保留；世界书、正文、其他聊天和角色变量不受影响。</p><p>重新接入不会恢复上述记录，需要恢复删除前的档案备份。</p>${btn('export', '先导出档案备份', 'wjwk-secondary')}${btn('dialog-close', '取消', 'wjwk-secondary')}${btn('confirm-delete-power', '确认删除此词条', 'wjwk-warning')}`);
  }
  showRestorePreview(data) { this.dialog('确认恢复档案', `<p>备份包含 ${Object.keys(data.powers).length} 个词条、${data.transactions.length} 条回执。恢复后沿用这些武库事实，从当前剧情位置继续核算；角色接入解除，待写回停止。备份不会恢复或修改 MVU 变量，请重新接入核对。</p>${btn('confirm-restore', '替换当前武库档案', 'wjwk-warning')}`); }
  setupDrag() {
    const fab = this.root.querySelector('.wjwk-fab'); let start = null;
    const place = pos => { if (!pos) return; const x = Math.max(8, Math.min(innerWidth - fab.offsetWidth - 8, pos.x)), y = Math.max(8, Math.min(innerHeight - fab.offsetHeight - 8, pos.y)); fab.style.left = `${x}px`; fab.style.top = `${y}px`; fab.style.right = 'auto'; fab.style.bottom = 'auto'; };
    this.positionFrame = requestAnimationFrame(() => place(this.settings().position));
    const options = { signal: this.eventController.signal };
    fab.addEventListener('pointerdown', event => { if (event.button !== 0) return; const r = fab.getBoundingClientRect(); start = { x: event.clientX, y: event.clientY, left: r.left, top: r.top }; this.dragged = false; fab.setPointerCapture(event.pointerId); }, options);
    fab.addEventListener('pointermove', event => { if (!start) return; const dx = event.clientX - start.x, dy = event.clientY - start.y; if (Math.hypot(dx, dy) > 6) this.dragged = true; if (this.dragged) place({ x: start.left + dx, y: start.top + dy }); }, options);
    const end = () => { if (start && this.dragged) { const r = fab.getBoundingClientRect(); this.action('save-position', { x: r.left, y: r.top }); } start = null; };
    fab.addEventListener('pointerup', end, options); fab.addEventListener('pointercancel', end, options);
    addEventListener('resize', () => { if (fab.style.left) { const r = fab.getBoundingClientRect(); place({ x: r.left, y: r.top }); } }, options);
  }
}

Object.assign(WorkbenchUI.prototype,referenceUIMethods);

Object.assign(WorkbenchUI.prototype,runtimeLogUIMethods);

// 自用版：默认勾选玩家实际启用的 15 条（按词条名匹配，不依赖 uid 或书名）；仍可手动修改。
// 世界书优先级：万界武库v6/V6 > 最高 vN > 万界武库_fixed > 其他含“万界武库”的书。
export function ziyongBookRank(name) { const n = String(name || ''); if (!n.includes('万界武库')) return -1; if (/万界武库\s*[_\-·]?\s*v6(?!\d)/i.test(n)) return 100000; const v = n.match(/v(\d+(?:\.\d+)?)/i); if (v) return 1000 + Math.round(parseFloat(v[1]) * 10); if (/万界武库_fixed/.test(n)) return 500; return 1; }
export function ziyongBestBook(names) { let best = null, r = 0; for (const n of names || []) { const k = ziyongBookRank(n); if (k > r) { r = k; best = n; } } return best; }
const ZIYONG_PRIMARY = /^双面玫瑰·金手指总则/;
const ZIYONG_ENTRIES = [/^万界武库思维链/, /^(?:永续|不凋)/, /^心相武装/, /^钟灵毓秀/, /^万界武库·使用说明/, /^(?:帝王技艺|御极之术)/, /^(?:大贤者|智冕)/, /^(?:上位替代|僭位)/, /^(?:八风编织|八风织命)/, ZIYONG_PRIMARY, /^(?:淫乱度|绽度)与身体进化/, /^双生体质·(?:媚肉锁|缠枝印)/, /^双生体质·(?:逆潮|月汐痕)/, /^双面玫瑰·催情执行提醒/, /^双面玫瑰·暗潮出口/];
const nameHit = e => ZIYONG_ENTRIES.some(r => r.test(String(e?.name || '').trim()));
let ziyongCache = { catalog: null, book: null };
function ziyongBook(catalog) { if (!catalog) return null; if (ziyongCache.catalog === catalog) return ziyongCache.book; const books = [...new Set(catalog.filter(nameHit).map(e => e.book))]; const book = books.sort((a, b) => ziyongBookRank(b) - ziyongBookRank(a))[0] ?? null; ziyongCache = { catalog, book }; return book; }
export function ziyongCompanion(e, catalog) { return nameHit(e) && (!catalog || e.book === ziyongBook(catalog)); }
export function ziyongPrimary(e, catalog) { const book = ziyongBook(catalog); const first = (catalog || []).find(x => x.book === book && ZIYONG_PRIMARY.test(String(x.name || '').trim())); return !!first && first === e; }
