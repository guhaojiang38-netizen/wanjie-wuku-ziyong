// Dependency-free value helpers shared by state and configuration validators.
export function assert(condition, message) { if (!condition) throw new Error(message); }
export function clone(value) { return JSON.parse(JSON.stringify(value)); }
export function text(value, max = 12000) {
  assert(typeof value === 'string' && value.length <= max, '文本字段无效或过长');
  return value.trim();
}
export function stable(value) {
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.keys(value).sort().map(k => `${JSON.stringify(k)}:${stable(value[k])}`).join(',')}}`;
  return JSON.stringify(value);
}
export function hash(s) {
  let a = 2166136261, b = 2246822519;
  for (let i = 0; i < s.length; i++) { a = Math.imul(a ^ s.charCodeAt(i), 16777619); b = Math.imul(b ^ s.charCodeAt(i), 3266489917); }
  return `${(a >>> 0).toString(16).padStart(8, '0')}${(b >>> 0).toString(16).padStart(8, '0')}`;
}
