// Rule explanations are independent from automatic archive review.
import { assert, text } from './primitives.js';
export function normalizePlayerGuide(raw, power) {
  assert(raw && Object.keys(raw).every(k => ['summary', 'abilities'].includes(k)), '玩法说明格式无效');
  const summary = text(raw.summary, 400).trim();
  assert(summary && Array.isArray(raw.abilities) && raw.abilities.length > 0 && raw.abilities.length <= 6, '玩法说明缺少能力方向');
  const abilities = raw.abilities.map(a => {
    assert(a && Object.keys(a).every(k => ['name', 'description', 'ruleQuote'].includes(k)), '能力说明包含多余操作');
    const name = text(a.name, 80).trim(), description = text(a.description, 400).trim(), ruleQuote = text(a.ruleQuote, 1200);
    assert(name && description && ruleQuote.length >= 6 && power.rules.includes(ruleQuote), '能力说明缺少逐字规则依据');
    return { name, description, ruleQuote };
  });
  return { ruleVersion: power.ruleVersion, summary, abilities };
}
export function currentPlayerGuide(power) {
  try { if (power.playerGuide?.ruleVersion === power.ruleVersion) return normalizePlayerGuide({ summary: power.playerGuide.summary, abilities: power.playerGuide.abilities }, power); } catch {}
  return null;
}
