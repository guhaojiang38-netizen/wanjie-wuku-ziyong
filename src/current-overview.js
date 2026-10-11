import { ARCHIVE_TYPES, ARCHIVE_FIELDS, archiveCurrent } from './archives.js';
import { isMmlc, MMLC_MODULES, mmlcModule } from './mmlc.js';

// Derived from saved records only: no second summary store, parsing, or numerical inference.
const states = ['active', 'working', 'planned', 'ended'];
const priority = {
  population: ['scale', 'purpose', 'location', 'traits'],
  environment: ['changes', 'conditions', 'scale', 'location', 'related'],
  facility: ['condition', 'purpose', 'scale', 'location'],
  research: ['progress', 'outcome', 'goal'],
  member: ['role', 'condition', 'location', 'traits'],
  skill: ['level', 'progress', 'effect'],
  bond: ['participants', 'condition', 'terms', 'obligations'],
  record: ['description'],
};
export function overviewRecord(record) {
  const labels = ARCHIVE_FIELDS[record.type] || {};
  const fields = Object.keys(labels).filter(k => typeof record.fields?.[k] === 'string' && record.fields[k].trim());
  const preferred = priority[record.type] || fields;
  // Preserve limits alongside the most useful facts; never slice a quantity or condition into a different claim.
  const selected = [...preferred.filter(k => fields.includes(k)).slice(0, fields.includes('limits') ? 2 : 3), ...(fields.includes('limits') ? ['limits'] : [])];
  const facts = selected.map(k => ({ key: k, label: labels[k], value: record.fields[k], compact: record.fields[k].length <= 240 }));
  return { id: record.id, name: record.name, type: record.type, status: record.status, updatedAt: record.updatedAt || 0, facts, omittedFields: fields.length - selected.length };
}
export function overviewHighlights(group, limit = 2) {
  const rows = group.records.filter(r => r.status !== 'ended');
  const firsts = states.slice(0,3).map(status => rows.find(r=>r.status===status)).filter(Boolean);
  const selected = firsts.slice(0,limit);
  for (const row of rows) if (selected.length < limit && !selected.some(r=>r.id===row.id)) selected.push(row);
  return selected;
}
export function currentOverview(power, chat = []) {
  const all = Object.values(power?.archives || {});
  const valid = all.filter(r => archiveCurrent(r, chat));
  const definitions = isMmlc(power) ? MMLC_MODULES.map(m=>({id:m.id,title:m.title})) : Object.entries(ARCHIVE_TYPES).map(([id,title])=>({id,title}));
  const groupOf = r => isMmlc(power) ? mmlcModule(r) : r.type;
  const counts = rows => Object.fromEntries(states.map(status=>[status,rows.filter(r=>r.status===status).length]));
  const groups = definitions.map(def=>{
    const rows = valid.filter(r=>groupOf(r)===def.id).map(overviewRecord).sort((a,b)=>states.indexOf(a.status)-states.indexOf(b.status)||b.updatedAt-a.updatedAt||a.id.localeCompare(b.id));
    return { ...def, counts: counts(rows), records: rows, stale: all.filter(r=>groupOf(r)===def.id && !valid.includes(r)).length };
  });
  return { powerId: power?.id, paused: power?.active === false, counts: counts(valid), stale: all.length-valid.length, groups, updatedAt: Math.max(0,...valid.map(r=>r.updatedAt || 0)) };
}
