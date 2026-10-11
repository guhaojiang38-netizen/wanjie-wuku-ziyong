import { BUILTIN_WORLDBOOK as book } from './builtin-worldbook-data.js';
import { clone, hash, stable } from './primitives.js';
const byName = new Map(book.entries.map(e=>[e.name,e]));
const byHash = new Map(book.entries.map(e=>[hash(e.content),e]));
const previous = new Map(book.legacy.map(e=>[e.contentHash,e]));
const oldBindings = new Set(book.legacyAdapterDigests);
const targetFor = body => byHash.get(hash(body)) || byName.get(previous.get(hash(body))?.target);
export const builtinWorldbookInfo = () => ({version:book.version,sourceSha256:book.sourceSha256,authorEntries:book.authorEntries,entries:book.entries.length});
export const builtinEntries = () => clone(book.entries);
// Reading the renamed author file must not create a second copy of the same power.
export function builtinPowerId(entry, powers = {}) {
  const target=targetFor(entry.content || '');
  if(!target)return entry.id;
  return Object.values(powers).find(p=>targetFor(p.primaryRules ?? p.rules ?? '')?.entryId===target.entryId)?.id || entry.id;
}

// Preserve imported identities and custom material; supply missing official rules.
export function withBuiltinCatalog(catalog = []) {
  const result = [], seen = new Set(), available = new Set();
  for (const entry of catalog) {
    const target = targetFor(entry.content || '');
    if (!target) { result.push(clone(entry)); continue; }
    const key = entry.book+'\n'+target.name;
    if (seen.has(key)) continue;
    seen.add(key); available.add(target.name);
    result.push({...clone(entry),name:target.name,entryId:target.entryId,content:target.content,auxiliary:target.auxiliary});
  }
  result.push(...builtinEntries().filter(e=>!available.has(e.name)));
  return result;
}

// Update rules only. IDs, balances, archives, history and memory selections survive.
// Hashes here identify unmodified shipped rules, never expire narrative records.
export function upgradeBuiltinPower(power) {
  const body = power.primaryRules ?? power.rules ?? '', target = targetFor(body);
  if (!target || !power.rules.startsWith(body)) return false;
  let suffix = power.rules.slice(body.length), nextSuffix = '', offset = 0;
  const companions = clone(power.companions || []);
  for (const companion of companions) {
    if (!suffix.startsWith('\n\n',offset)) break;
    const start=offset+2;
    const candidate=book.legacy.find(e=>e.name===companion.name && hash(suffix.slice(start,start+e.length))===e.contentHash);
    if (!candidate) break;
    const replacement=byName.get(candidate.target);
    if (!replacement) break;
    nextSuffix+='\n\n'+replacement.content;offset=start+candidate.length;
    companion.name=replacement.name;companion.id=replacement.entryId;
  }
  const rules=target.content+nextSuffix+suffix.slice(offset);
  const changed=rules!==power.rules || power.name!==target.name;
  if (!changed) return false;
  power.name=target.name;power.primaryRules=target.content;power.rules=rules;power.ruleVersion=hash(rules);power.companions=companions;
  power.source={...power.source,entryId:target.entryId};
  // Only a byte-identical shipped binding can be replaced automatically.
  // Player-authored bindings remain available for explicit review.
  if(power.adapterBinding && oldBindings.has(hash(stable(power.adapterBinding.config))))delete power.adapterBinding;
  if(target.name==='人生模拟')for(const resource of Object.values(power.resources || {}))if(resource.name==='今日模拟次数'){
    resource.name='模拟次数';resource.labels=[...new Set([...(resource.labels || []),'可用模拟次数','模拟次数','模拟次数余额'])];
  }
  return true;
}
