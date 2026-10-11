// 自用版 · 双面玫瑰面板：解析每楼 <WJWK-settle>，只读，不改 MVU 与正文。
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
export const ROSE_KEY = 'wanjie_wuku_ziyong_rose';
export const AXES = {
  淫乱度: { max:100, stages:[[0,'青涩'],[10,'敏感'],[25,'舒展'],[45,'共鸣'],[70,'圆融']] },
  渴慕值: { max:100, stages:[[0,'雏形期'],[10,'初绽期'],[30,'盛放期'],[60,'迷醉期'],[100,'玫瑰之主']] },
  沉溺值: { max:100, stages:[[0,'平稳'],[40,'想念'],[60,'依恋'],[80,'沉溺']] },
  禁欲蓄能: { max:5, stages:[[0,'无'],[3,'易被撩动']] },
};
const NUM = '(-?\\d+(?:\\.\\d+)?)';
const ARROW = '\\s*(?:->|→|－>|—>)\\s*';
export function extractSettle(text) {
  const m = String(text || '').match(/<WJWK-settle>([\s\S]*?)<\/WJWK-settle>/i); if (!m) return null;
  const body = m[1], grab = (a, b) => { const r = new RegExp(a + '[:：]\\s*([\\s\\S]*?)\\s*(?=' + b + '|$)'); const x = body.match(r); return x ? x[1].trim() : ''; };
  return { gains: grab('本轮收益', '状态变化[:：]'), changes: grab('状态变化', '新增解锁[:：]'), unlocks: grab('新增解锁', '后续机会[:：]'), chances: grab('后续机会', '$a') };
}
export function parseSettle(text) {
  const s = extractSettle(text); if (!s) return null;
  const out = { raw: s, deltas: [], progress: {}, full: {}, overflow: null, timers: [], marks: [], pattern: null, rose: null, anon: 0 };
  for (const line of s.changes.split('\n').map(l => l.trim()).filter(Boolean)) {
    if (/^进度[:：]/.test(line)) {
      for (const part of line.replace(/^进度[:：]/, '').split(/[｜|]/)) {
        const p = part.trim(), axis = Object.keys(AXES).find(a => p.startsWith(a)); if (!axis) continue;
        let x = p.match(new RegExp(axis + '\\s*' + NUM + '\\s*/\\s*' + NUM)); if (x) out.progress[axis] = +x[1];
        if (/已满/.test(p)) { out.full[axis] = true; out.progress[axis] = AXES[axis].max; const o = p.match(/溢出\s*(\d+)\s*\/\s*20/); if (o) out.overflow = +o[1]; }
      }
      continue;
    }
    const axis = Object.keys(AXES).find(a => line.startsWith(a));
    if (axis) { const x = line.match(new RegExp(axis + '\\s*' + NUM + ARROW + NUM)); if (x) out.deltas.push({ axis, from: +x[1], to: +x[2] }); const o = line.match(/溢出\s*(\d+)\s*\/\s*20/); if (o) out.overflow = +o[1]; continue; }
    let t = line.match(/^(锁痕|潮印)[·・]\s*([^\s剩已]+)\s*(?:剩\s*(\d+)\s*天|(已消退))/); if (t) { out.timers.push({ kind: t[1], who: t[2], days: t[4] ? 0 : +t[3] }); continue; }
    let b = line.match(/^(?:当前)?身体印记[:：]\s*(.+)$/); if (b) { for (const item of b[1].split(/[；;、，,]/)) { const q = item.trim().match(/^([^·・]+)[·・]([^·・]+)(?:[·・]\D*?(\d+)\s*天)?/); if (q) out.marks.push({ part: q[1], style: q[2], days: q[3] ? +q[3] : null }); } continue; }
    let r = line.match(/^玫瑰印记[:：]\s*(.+)$/); if (r) { out.rose = r[1]; continue; }
    let pt = line.match(/^(?:印纹样式|印记装饰|已选样式)[:：]\s*(.+)$/); if (pt) { out.pattern = pt[1].trim(); continue; }
    if (/渴慕\s*\+\s*1（有人在想着你）/.test(line)) out.anon++;
  }
  const choose = (s.unlocks + '\n' + s.changes).match(/(?:选定|已选)[:：]?\s*([^\s，。；]+纹|[^\s，。；]+蔷薇)/); if (choose && !out.pattern) out.pattern = choose[1];
  return out;
}
export function buildTimeline(chat = []) {
  const floors = [], warnings = [], cur = { 淫乱度: null, 渴慕值: null, 沉溺值: null, 禁欲蓄能: null }, timers = new Map(), marks = new Map();
  let overflow = 0, pattern = null, rose = null, anon = 0;
  chat.forEach((m, i) => {
    if (!m || m.is_user || m.is_system) return; const p = parseSettle(m.mes ?? m.content ?? ''); if (!p) return;
    for (const d of p.deltas) {
      if (cur[d.axis] !== null && cur[d.axis] !== d.from) warnings.push(`第${i}楼：${d.axis} 上一楼是 ${cur[d.axis]}，这里写的起点却是 ${d.from}`);
      if (d.to > AXES[d.axis].max || d.to < 0) warnings.push(`第${i}楼：${d.axis} ${d.to} 超出范围 0—${AXES[d.axis].max}`);
      cur[d.axis] = d.to;
    }
    for (const [axis, v] of Object.entries(p.progress)) {
      if (cur[axis] !== null && cur[axis] !== v && !p.deltas.some(d => d.axis === axis)) warnings.push(`第${i}楼：进度行 ${axis}=${v}，但上一楼是 ${cur[axis]}，状态变化里也没写这项变动`);
      else if (p.deltas.some(d => d.axis === axis && d.to !== v)) warnings.push(`第${i}楼：进度行 ${axis}=${v} 与状态变化 ${p.deltas.find(d => d.axis === axis).to} 不一致`);
      cur[axis] = v;
    }
    if (p.overflow !== null) overflow = p.overflow; if (p.pattern) pattern = p.pattern; if (p.rose) rose = p.rose; anon += p.anon;
    for (const t of p.timers) { const k = t.kind + '·' + t.who; if (t.days === 0) timers.delete(k); else timers.set(k, { ...t, floor: i }); }
    for (const b of p.marks) marks.set(b.part, { ...b, floor: i });
    floors.push({ floor: i, values: { ...cur }, overflow, deltas: p.deltas });
  });
  return { floors, warnings, current: { ...cur }, overflow, pattern, rose, anon, timers: [...timers.values()], marks: [...marks.values()] };
}
export function stageOf(axis, v) { const st = AXES[axis].stages; let s = st[0], next = null; for (let k = 0; k < st.length; k++) if (v >= st[k][0]) { s = st[k]; next = st[k + 1] || null; } return { name: s[1], from: s[0], next }; }
// ---- 玫瑰印记 SVG ----
const lerp = (a, b, t) => a + (b - a) * t;
const hex = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
const mix = (a, b, t) => '#' + hex(a).map((c, i) => Math.round(lerp(c, hex(b)[i], t)).toString(16).padStart(2, '0')).join('');
export function roseColor(v) { v = Math.max(0, Math.min(100, v)); return v < 50 ? mix('#ffb3d1', '#ff2f92', v / 50) : mix('#ff2f92', '#9e0f3c', (v - 50) / 50); }
export function roseMarkSVG(value = 0, { overflow = 0, pattern = '', size = 220 } = {}) {
  const v = Math.max(0, Math.min(100, Number(value) || 0)), col = roseColor(v), deco = /金/.test(pattern) ? '#f4c86a' : /蝶|翼/.test(pattern) ? '#ff9ad0' : /露|坠/.test(pattern) ? '#ffd6ec' : null;
  const st = v >= 100 ? 4 : v >= 60 ? 3 : v >= 30 ? 2 : v >= 10 ? 1 : 0, ranges = [[0, 10], [10, 30], [30, 60], [60, 100], [100, 101]], t = Math.min(1, (v - ranges[st][0]) / (ranges[st][1] - ranges[st][0]));
  const P = st + t; // 0..5 连续成长度
  const op = lerp(0.35, 1, Math.min(1, P / 3)), sw = lerp(0.8, 2.4, Math.min(1, P / 4));
  const petals = [];
  const openK = Math.max(0, Math.min(1, P - 1)); // 花瓣张开
  const nOuter = P < 1 ? 0 : Math.round(lerp(2, 6, Math.min(1, (P - 1) / 2.5)));
  for (let k = 0; k < nOuter; k++) {
    const a = (k / Math.max(1, nOuter)) * 360 + 15, r = lerp(9, 30, openK);
    petals.push(`<path transform="rotate(${a.toFixed(1)} 110 92)" d="M110 92 C${(110 - r * 0.55).toFixed(1)} ${(92 - r * 0.4).toFixed(1)} ${(110 - r * 0.35).toFixed(1)} ${(92 - r * 1.05).toFixed(1)} 110 ${(92 - r).toFixed(1)} C${(110 + r * 0.35).toFixed(1)} ${(92 - r * 1.05).toFixed(1)} ${(110 + r * 0.55).toFixed(1)} ${(92 - r * 0.4).toFixed(1)} 110 92Z" fill="${col}" fill-opacity="${lerp(0.08, 0.32, openK).toFixed(2)}" stroke="${col}" stroke-width="${sw.toFixed(2)}"/>`);
  }
  const bud = P < 1 ? '' : `<path d="M110 ${lerp(84, 78, openK)} C${lerp(104, 98, openK)} ${lerp(88, 86, openK)} 102 98 110 101 C118 98 ${lerp(116, 122, openK)} ${lerp(88, 86, openK)} 110 ${lerp(84, 78, openK)}Z" fill="${col}" fill-opacity=".55" stroke="${col}" stroke-width="${sw}"/><path d="M110 86 c3 2 3 6 0 8 c-3-2-3-6 0-8" fill="none" stroke="#fff" stroke-opacity=".35" stroke-width=".8"/>`;
  const stemLen = lerp(20, 50, Math.min(1, P / 2));
  const stem = `<path d="M110 ${P < 1 ? 80 : 101} C${110 - 4} ${110} ${110 + 4} ${110 + stemLen * 0.6} 110 ${101 + stemLen}" fill="none" stroke="${col}" stroke-width="${sw}" stroke-linecap="round" opacity="${op}"/>`;
  const leaves = P < 1.5 ? '' : `<path d="M110 ${118} c-10-6-18-2-20 4 c8 2 14 0 20-4Z M110 ${128} c10-6 18-2 20 4 c-8 2-14 0-20-4Z" fill="${col}" fill-opacity=".35" stroke="${col}" stroke-width="${sw * 0.7}"/>`;
  const vineK = Math.max(0, Math.min(1, P - 3 + (st >= 3 ? t : 0) * 0)); const vineDraw = st >= 3 ? (st === 4 ? 1 : t) : (st === 2 ? t * 0.35 : 0);
  const vines = vineDraw <= 0 ? '' : `<g fill="none" stroke="${col}" stroke-width="${sw * 0.8}" stroke-linecap="round" pathLength="100" stroke-dasharray="${(vineDraw * 100).toFixed(1)} 100"><path pathLength="100" d="M95 108 C70 110 55 96 40 104 C30 110 26 122 34 128 M60 100 c-4-8 2-14 8-12"/><path pathLength="100" d="M125 108 C150 110 165 96 180 104 C190 110 194 122 186 128 M160 100 c4-8-2-14-8-12"/><path pathLength="100" d="M100 140 C86 150 70 148 62 158 M120 140 C134 150 150 148 158 158"/></g>`;
  const crown = st < 4 ? '' : `<g fill="${deco || col}" opacity=".9">${[0, 1, 2, 3, 4].map(k => `<circle cx="${80 + k * 15}" cy="${48 - Math.abs(k - 2) * 4}" r="2.4"/>`).join('')}</g><path d="M78 56 C90 46 130 46 142 56" fill="none" stroke="${deco || col}" stroke-width="1.6"/>`;
  const decoMark = !deco ? '' : /蝶|翼/.test(pattern) ? `<path d="M110 92 C90 70 70 74 74 90 C78 102 96 98 110 92 C124 98 142 102 146 90 C150 74 130 70 110 92Z" fill="none" stroke="${deco}" stroke-width="1" opacity=".7"/>` : /露|坠/.test(pattern) ? `<g fill="${deco}" opacity=".8"><circle cx="86" cy="118" r="2.2"/><circle cx="134" cy="118" r="2.2"/><circle cx="110" cy="160" r="2.6"/></g>` : `<circle cx="110" cy="92" r="${lerp(16, 36, openK)}" fill="none" stroke="${deco}" stroke-width=".8" stroke-dasharray="2 3" opacity=".8"/>`;
  const thread = P >= 1 ? '' : `<path d="M${lerp(104, 98, t)} 92 C104 80 116 80 116 92 C116 100 106 102 104 94" fill="none" stroke="${col}" stroke-width="${sw}" stroke-linecap="round" opacity="${op}"/>`;
  const glow = lerp(0, 9, Math.max(0, (P - 2) / 3)), ovr = Math.max(0, Math.min(20, overflow || 0));
  const ring = v >= 100 && ovr > 0 ? `<circle cx="110" cy="92" r="58" fill="none" stroke="${col}" stroke-opacity=".5" stroke-width="2" pathLength="20" stroke-dasharray="${ovr} 20" transform="rotate(-90 110 92)"/>` : '';
  return `<svg class="wjwk-rose-mark" viewBox="0 0 220 190" width="${size}" height="${Math.round(size * 190 / 220)}" role="img" aria-label="玫瑰印记 渴慕值 ${v}"><defs><filter id="rg${Math.round(v)}" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="${glow.toFixed(1)}" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter><radialGradient id="sk${Math.round(v)}" cx="50%" cy="45%" r="60%"><stop offset="0" stop-color="#3a1530"/><stop offset="1" stop-color="#1a0b16" stop-opacity="0"/></radialGradient></defs><ellipse cx="110" cy="100" rx="100" ry="82" fill="url(#sk${Math.round(v)})"/><path d="M30 20 C40 60 34 120 46 186 M190 20 C180 60 186 120 174 186" fill="none" stroke="#5a2547" stroke-width="1.2" opacity=".6"/><g filter="url(#rg${Math.round(v)})">${ring}${vines}${stem}${leaves}${thread}${petals.join('')}${bud}${crown}${decoMark}</g></svg>`;
}
// ---- 面板 HTML ----
function spark(series, max) { if (series.length < 2) return ''; const w = 120, h = 24, pts = series.map((y, i) => `${(i / (series.length - 1) * w).toFixed(1)},${(h - (y / max) * h).toFixed(1)}`).join(' '); return `<svg class="wjwk-rose-spark" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}"><polyline points="${pts}" fill="none" stroke="#ff7cc0" stroke-width="1.5"/></svg>`; }
const MARK_ICON = '<svg viewBox="0 0 20 20" width="18" height="18"><path d="M10 16 C5 12 4 8 7 6 C8.6 5 9.6 6 10 7 C10.4 6 11.4 5 13 6 C16 8 15 12 10 16Z" fill="#ff4fa3" fill-opacity=".6" stroke="#ff7cc0"/></svg>';
export function rosePanelHTML(tl) {
  const c = tl.current, kv = c.渴慕值 ?? 0;
  const bar = axis => { const v = c[axis], max = AXES[axis].max; if (v === null) return `<div class="wjwk-rose-row"><b>${axis}</b><span class="wjwk-muted">还没有记录</span></div>`; const s = stageOf(axis, v), lines = AXES[axis].stages.slice(1).map(([x, n]) => `<i style="left:${x / max * 100}%" title="${n}"></i>`).join('');
    const extra = axis === '渴慕值' && v >= 100 ? `（溢出 ${tl.overflow || 0}/20）` : ''; const nx = s.next ? `下一档 ${s.next[1]}：${s.next[0]}（还差 ${s.next[0] - v}）` : '已满';
    return `<div class="wjwk-rose-row"><div class="wjwk-rose-head"><b>${axis}</b><span>${v}/${max} · ${esc(s.name)}${extra}</span>${spark(tl.floors.map(f => f.values[axis]).filter(x => x !== null), max)}</div><div class="wjwk-rose-bar"><span style="width:${Math.min(100, v / max * 100)}%"></span>${lines}</div><small>${nx}</small></div>`; };
  const timers = tl.timers.length ? tl.timers.sort((a, b) => a.days - b.days).map(t => `<li class="${t.days <= 1 ? 'is-urgent' : ''}"><b>${esc(t.kind)}</b> · ${esc(t.who)} <span>剩 ${t.days} 天</span></li>`).join('') : '<li class="wjwk-muted">没有生效中的锁痕或潮印</li>';
  const marks = tl.marks.length ? tl.marks.map(m => `<li>${MARK_ICON}<span>${esc(m.part)} · ${esc(m.style)}</span>${m.days !== null ? `<em class="${m.days <= 1 ? 'is-urgent' : ''}">${m.days} 天</em>` : ''}</li>`).join('') : '<li class="wjwk-muted">暂无身体印记</li>';
  const warn = tl.warnings.length ? `<details class="wjwk-rose-warn" open><summary>账目可能不一致（${tl.warnings.length}）</summary><ul>${tl.warnings.slice(-12).map(w => `<li>${esc(w)}</li>`).join('')}</ul></details>` : '';
  return `<div class="wjwk-rose"><section class="wjwk-rose-hero">${roseMarkSVG(kv, { overflow: tl.overflow, pattern: tl.pattern || '' })}<div><h3>玫瑰印记</h3><p>${esc(tl.rose || '小腹·淡玫瑰细线（可见）')}</p><p>阶段：<b>${esc(stageOf('渴慕值', kv).name)}</b>${tl.pattern ? ` · 样式：${esc(tl.pattern)}` : ''}</p><p class="wjwk-muted">已解析 ${tl.floors.length} 楼结算 · 匿名“有人在想着你” ${tl.anon} 次</p><ul class="wjwk-rose-marks">${marks}</ul></div></section>${warn}<section><h3>成长进度</h3>${['淫乱度', '渴慕值', '沉溺值', '禁欲蓄能'].map(bar).join('')}</section><section><h3>锁痕 / 潮印</h3><ul class="wjwk-rose-timers">${timers}</ul></section><p class="wjwk-muted">数据只从每楼的 &lt;WJWK-settle&gt; 读取，不改角色变量和正文。</p></div>`;
}
export function saveTimeline(ctx, tl) { try { if (ctx?.chatMetadata) { ctx.chatMetadata[ROSE_KEY] = { savedAt: Date.now(), current: tl.current, overflow: tl.overflow, timers: tl.timers, marks: tl.marks, pattern: tl.pattern, floors: tl.floors.slice(-300) }; (ctx.saveMetadataDebounced || ctx.saveMetadata)?.call(ctx); } } catch { /* 只读面板，保存失败不影响显示 */ } }
