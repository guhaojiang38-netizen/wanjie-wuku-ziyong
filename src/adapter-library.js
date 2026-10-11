import {assert,clone,stable} from './core.js';
import {validateAdapter,compareAdapterVersions,primaryHash,adapterBindingCurrent,applyAdapter,previewAdapter,assertAdapterFields} from './adapters.js';
import {getAdapterLibrary,updateAdapterLibrary} from './host.js';
export function validateAdapterLibrary(input){
  assert(input&&input.schemaVersion===1&&Number.isSafeInteger(input.revision)&&input.revision>=0&&Array.isArray(input.configs)&&input.configs.length<=512,'账户适配库格式无效');
  assert(Object.keys(input).every(k=>['schemaVersion','revision','configs'].includes(k))&&JSON.stringify(input).length<=4000000,'账户适配库过大或含未知字段');
  const seen=new Set();for(const c of input.configs){validateAdapter(c);const id=c.id+'@'+c.version;assert(!seen.has(id),'适配库版本重复');seen.add(id);}
  return clone(input);
}
export function addLibraryAdapter(library,input){
  const next=validateAdapterLibrary(library),config=validateAdapter(input),same=next.configs.find(c=>c.id===config.id&&c.version===config.version);
  if(same){assert(stable(same)===stable(config),'适配库已有同版本不同内容，请提高版本号');return next;}
  const previous=next.configs.filter(c=>c.id===config.id).sort((a,b)=>compareAdapterVersions(b.version,a.version))[0];
  if(previous){assert(compareAdapterVersions(config.version,previous.version)>0,'适配库已有更高版本，不允许降级导入');assertAdapterFields(previous,config);}
  next.configs.push(config);next.revision++;return validateAdapterLibrary(next);
}
function matchingConfigs(power,configs){
  const body=power.primaryRules??power.rules??'',source=primaryHash(power),byId=new Map();
  for(const c of configs){if(!c.target.primaryHashes.includes(source)||!c.operations.every(o=>body.includes(o.ruleQuote)))continue;const old=byId.get(c.id);if(!old||compareAdapterVersions(c.version,old.version)>0)byId.set(c.id,c);}
  return [...byId.values()].sort((a,b)=>a.id.localeCompare(b.id));
}
export function matchingAdapters(power,library){return matchingConfigs(power,validateAdapterLibrary(library).configs);}
export function autoAssociateAdapters(powers,library){
  if(!library)return;const configs=validateAdapterLibrary(library).configs;
  for(const p of powers){if(p.adapterBinding)continue;const candidates=matchingConfigs(p,configs);if(candidates.length===1)applyAdapter(p,candidates[0]);}
}
export function autoAssociateAdapter(power,library){
  if(!library||power.adapterBinding)return false;const candidates=matchingAdapters(power,library);
  return candidates.length===1?applyAdapter(power,candidates[0]):false;
}
export const adapterLibraryMethods={
  associationLibrary(){try{const library=this.adapterLibrary();this.adapterLibraryError='';return library;}catch(error){this.adapterLibraryError=error.message;return null;}},
  adapterLibrary(){return validateAdapterLibrary(getAdapterLibrary());},
  async saveLibraryAdapter(config){return updateAdapterLibrary(latest=>addLibraryAdapter(latest,config));},
  async shareAdapter(){
    assert(!this.busy&&!this.mainBusy&&!this.committing,'请等待当前操作完成');const s=this.ensureStable(),p=s.state.powers[this.powerId];assert(p&&adapterBindingCurrent(p),'请先核对当前词条适配');
    this.committing=true;this.refresh();try{await this.saveLibraryAdapter(p.adapterBinding.config);let current;try{current=this.contextSnapshot().chatKey;}catch{return;}if(current!==s.chatKey)return;this.ui.closeDialog();this.notice('已加入账户适配库，其他聊天接入相同规则时自动关联。');}finally{this.committing=false;this.refresh();}
  },
  openLibraryAdapter(id){
    const s=this.ensureStable(),p=s.state.powers[this.powerId];assert(p,'请先选择已接入词条');
    const config=matchingAdapters(p,this.adapterLibrary()).find(c=>c.id===id);assert(config,'没有与当前规则匹配的适配版本');
    const preview=previewAdapter(p,config);this.adapterDraft={...preview,powerId:p.id,captured:{chatKey:s.chatKey,stateId:s.state.id,revision:s.state.revision}};
    this.ui.setNotice('');this.ui.showAdapterPreview(p,preview);
  },
};
