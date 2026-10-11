// Account preferences contain no game state. Schemes are kept out of chat exports.
export const THEMES = Object.freeze({ succubus:'魅魔纹（自用版默认）', follow:'跟随酒馆', light:'浅色', dark:'深色', night:'夜读', parchment:'羊皮纸', green:'护眼绿' });
export const themeId = value => Object.hasOwn(THEMES, value) ? value : 'succubus';
export const CONNECTION_FIELDS = ['mode','baseUrl','model','temperature','maxTokens','timeoutSeconds','contextMessages'];
export function connectionValues(values, base = {}) {
  const next = { ...base, mode:values.mode, baseUrl:String(values.baseUrl || '').trim(), model:String(values.model || '').trim() };
  if (!['off','st','custom'].includes(next.mode)) throw Error('连接方式无效');
  if (next.mode === 'custom') {
    let url; try { url = new URL(next.baseUrl); } catch { throw Error('API地址无效'); }
    if (!['https:','http:'].includes(url.protocol) || url.username || url.password) throw Error('API地址无效');
    if (!next.model) throw Error('独立模型名不能为空');
  }
  for (const [key,min,max] of [['temperature',0,2],['maxTokens',256,32768],['timeoutSeconds',10,300],['contextMessages',1,100]]) {
    const n=Number(values[key] ?? base[key]);
    if (!Number.isFinite(n) || n<min || n>max || (key!=='temperature' && !Number.isInteger(n))) throw Error('连接参数超出范围');
    next[key]=n;
  }
  return next;
}
export function connectionKey(values, current) {
  return values.clearKey ? '' : String(values.apiKey || '').trim() || (values.profileKeyPolicy==='new' ? '' : current);
}
