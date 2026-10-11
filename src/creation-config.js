// Resolve declared adapters without loading a generation controller.
import { CREATION_PRESETS } from './creation-presets.js';
import { adapterBindingCurrent, primaryHash } from './adapters.js';
export function creationConfig(power){
 if(power.adapterBinding){const c=adapterBindingCurrent(power)?power.adapterBinding.config:null; return c;}
 return CREATION_PRESETS.find(c=>c.target.primaryHashes.includes(primaryHash(power))&&c.operations.every(o=>(power.primaryRules??power.rules).includes(o.ruleQuote)))||null;
}

export const creationRules = (power) => power.rules;
