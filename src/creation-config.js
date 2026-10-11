import { isTaishi, taishiConfig } from './taishi.js';
import { isMmlc } from './mmlc.js';
import { MMLC_CONFIG, MMLC_GAMEPLAY, MMLC_REFERENCES } from './mmlc-config.js';
// Resolve declared adapters without loading a generation controller.
import { CREATION_PRESETS } from './creation-presets.js';
import { adapterBindingCurrent, primaryHash } from './adapters.js';
export function creationConfig(power){
 if(isMmlc(power))return MMLC_CONFIG;
 if(power.adapterBinding){const c=adapterBindingCurrent(power)?power.adapterBinding.config:null;return c&&isTaishi(power)&&c.id==='wuku.primordial_world'?taishiConfig(c):c;}
 if(isTaishi(power))return taishiConfig();
 return CREATION_PRESETS.find(c=>c.target.primaryHashes.includes(primaryHash(power))&&c.operations.every(o=>(power.primaryRules??power.rules).includes(o.ruleQuote)))||null;
}

export const creationRules = (power,operationId='') => isMmlc(power) ? power.rules+"\n\n以下是漫漫长路玩法参考，仅用于拟定，不作为已拥有成果：\n"+(MMLC_REFERENCES[operationId]||MMLC_GAMEPLAY) : power.rules;
