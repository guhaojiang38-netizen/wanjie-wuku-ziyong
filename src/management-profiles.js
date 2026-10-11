import { PROFILE_DATA } from './management-profiles-data.js';
import { assert, clone, hash } from './primitives.js';
export const PROFILE_FAMILIES = Object.freeze({ domain:'领域与经营', member:'成员与分身', archive:'档案与持续设定', relationship:'关系与契约', inventory:'库存与交易', cycle:'周期与等待', simulation:'模拟成果', modifier:'结算修正', narrative:'正文效果', growth:'成长与技艺', support:'辅助规则' });
const byName = new Map(PROFILE_DATA.entries.map(p=>[p.name,p]));
const byContent = new Map(PROFILE_DATA.entries.map(p=>[p.contentHash,p]));
const generic = [{id:'generic_progress',category:'progress',label:'已形成的成长',ruleQuote:''},{id:'generic_arrangement',category:'arrangement',label:'持续安排',ruleQuote:''},{id:'generic_record',category:'record',label:'重要记录',ruleQuote:''}];
export function managementProfile(entity) {
  const body = entity?.primaryRules ?? entity?.content ?? entity?.rules ?? '', digest = hash(body);
  const named = byName.get(entity?.name), matched = named?.contentHash === digest ? named : byContent.get(digest);
  if (matched) return { ...clone(matched), match:matched.name === entity.name ? 'exact' : 'renamed', verified:true };
  return { name:entity?.name || '未知词条', role:'primary', family:'archive', templates:clone(generic), workflows:['cycle','simulation'], variantGroup:null, verified:false, match:named ? 'changed' : 'unknown', note:named ? '同名词条正文与已配置版本不同，使用通用记录；不套用旧版专用字段。' : '尚无专用配置，仍可查看完整规则、补录记录与核对正文；专用机制待核对。' };
}
export function configuredProfiles() { return clone(PROFILE_DATA); }
export function assertProfileRegistration(entry, companions, powers) {
  const main = managementProfile(entry); assert(!main.verified || main.role !== 'support', '这是一条辅助规则，请随所属主词条选入附加规则，不单独接入');
  const incoming = [entry, ...companions].map(managementProfile).filter(p=>p.verified && p.variantGroup);
  const groups = new Set(); for (const p of incoming) { assert(!groups.has(p.variantGroup), '两个太始天版本须择一，不能在同次接入中组合'); groups.add(p.variantGroup); }
  for (const p of Object.values(powers)) {
    if (!p.active || p.id === entry.id) continue;
    const existing = [managementProfile(p), ...(p.companions || []).map(c=>byName.get(c.name))];
    assert(!existing.some(profile=>profile?.variantGroup && groups.has(profile.variantGroup)), '已有另一太始天版本启用，请先暂停原版本再接入');
  }
}
export function coverageRows(catalog = [], powers = {}) {
  const entries = PROFILE_DATA.entries.map(p => ({ ...clone(p), matches:[], status:'unread' })), rows = new Map(entries.map(p=>[p.name,p]));
  for (const e of catalog) {
    const profile = managementProfile(e), row = rows.get(profile.verified ? profile.name : e.name);
    const instance = { id:e.id, name:e.name, book:e.book, match:profile.match, active:Boolean(powers[e.id]?.active) };
    if (row) { row.matches.push(instance); row.status = row.matches.some(m=>['exact','renamed'].includes(m.match)) ? 'verified' : 'changed'; }
    else entries.push({ ...profile, matches:[instance], status:'unknown' });
  }
  return entries;
}
