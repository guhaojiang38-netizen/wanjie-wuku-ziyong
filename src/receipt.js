// Human-only summaries use the existing status renderer. No update commands.
export const RECEIPT_TAG = 'WJWK-status';
const legacyBlocks = () => /(?:\r?\n){0,2}<WJWK-variable-receipt\b[^>]*>[\s\S]*?<\/WJWK-variable-receipt>/gi;
const statusBlocks = () => /(?:\r?\n){0,2}<!--WJWK-receipt:begin\b[^>]*-->[\s\S]*?<!--WJWK-receipt:end-->/gi;
const escape = value => String(value ?? '').replace(/[&<>"'_]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;', '_': '&#95;' }[c]));
const hasId = (block, id) => block.slice(0, block.indexOf('>')).includes(`data-wjwk-id="${escape(id)}"`);
export function stripVariableReceipts(text) { return String(text ?? '').replace(legacyBlocks(), '').replace(statusBlocks(), ''); }
export function removeVariableReceiptIds(text, ids) {
  const remove = new Set(ids);
  const strip = block => [...remove].some(id => hasId(block, id)) ? '' : block;
  return String(text ?? '').replace(legacyBlocks(), strip).replace(statusBlocks(), strip);
}
export function hasStatusReceipt(text, id) { return [...String(text ?? '').matchAll(statusBlocks())].some(m => hasId(m[0], id)); }
export function hasVariableReceipt(text, id) {
  return hasStatusReceipt(text, id) || [...String(text ?? '').matchAll(legacyBlocks())].some(m => hasId(m[0], id));
}
function receiptContent(write, label) {
  if (!Array.isArray(write.changes) || !write.changes.length) throw new Error('消息简报没有可展示的变量变化');
  const value = v => {
    const text = typeof v === 'string' ? v : JSON.stringify(v);
    return text?.length > 600 ? `${text.slice(0, 600)}…（展示缩略，完整值见武库回执）` : text;
  };
  const pathLabel = path => path.replace(/^\//, '').split('/').map(s => s.replace(/~1/g, '/').replace(/~0/g, '~')).join(' › ');
  const rows = write.changes.map(c => `<wjwk-field>${escape(pathLabel(c.path))}：${c.added ? '新增' : escape(value(c.before))} → ${escape(value(c.after))}</wjwk-field>`).join('\n');
  const content = `<wjwk-section>本次插件更新 · 已写回</wjwk-section>\n<wjwk-field>操作：${escape(label)}</wjwk-field>\n${rows}`;
  if (content.length > 250000) throw new Error('消息简报过长，请在武库回执中核对完整变量变化');
  return content;
}
const marked = (write, content) => `<!--WJWK-receipt:begin data-wjwk-id="${escape(write.id)}"-->${content}<!--WJWK-receipt:end-->`;
export function buildVariableReceipt(write, label, { powerName = '万界武库' } = {}) {
  return marked(write, `<WJWK-status>\n【${escape(powerName)} · 更新简报】\n${receiptContent(write, label)}\n</WJWK-status>`);
}
export function appendVariableReceipt(text, write, label, { powerName = '万界武库' } = {}) {
  const original = String(text ?? ''); if (hasStatusReceipt(original, write.id)) return original;
  // Migrate our old block, never modify an author's UpdateVariable commands.
  const clean = removeVariableReceiptIds(original, [write.id]);
  const owned = [...clean.matchAll(statusBlocks())];
  const status = [...clean.matchAll(/<WJWK-status>([\s\S]*?)<\/WJWK-status>/gi)].filter(s => !owned.some(m => s.index >= m.index && s.index + s[0].length <= m.index + m[0].length));
  const title = block => block[1].match(/^\s*【([^\r\n】]+)】/)?.[1] || '';
  const selected = status.find(block => title(block) === powerName || title(block).startsWith(powerName + ' ·'))
    || (status.length === 1 && (!title(status[0]) || /^(?:当前状态|角色状态|万界武库)$/.test(title(status[0]))) ? status[0] : null);
  if (!selected) return `${clean}\n\n${buildVariableReceipt(write, label, { powerName })}`;
  const insertAt = selected.index + selected[0].lastIndexOf('</');
  return clean.slice(0, insertAt) + '\n\n' + marked(write, receiptContent(write, label)) + clean.slice(insertAt);
}
