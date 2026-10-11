import {assert,clone,hash,stable} from './primitives.js';
export const ADAPTER_FORMAT='wjwk-adapter';
export const ADAPTER_OPERATIONS=Object.freeze({create:'创造',plan:'筹划',investigate:'调查',develop:'培养与修炼',transform:'改造',simulate:'模拟',negotiate:'契约协商',arrange:'安排事务'});
const object=(v,keys,label)=>{assert(v&&typeof v==='object'&&!Array.isArray(v),label+'必须是对象');assert(Object.keys(v).every(k=>keys.includes(k)),label+'含不支持字段');};
const string=(v,max,label)=>{assert(typeof v==='string'&&v.trim()&&v.length<=max,label+'为空或过长');return v;};
const id=(v,label)=>{string(v,64,label);assert(/^[a-z][a-z0-9_-]{0,63}$/.test(v)&&!['constructor','prototype','__proto__'].includes(v),label+'格式无效');};
const list=(v,max,label)=>{assert(Array.isArray(v)&&v.length>0&&v.length<=max,label+'数量无效');};
const unique=(rows,label)=>assert(new Set(rows.map(r=>r?.id)).size===rows.length,label+'ID重复');
const digest=v=>hash(stable(v));
export function adapterVersion(v){string(v,32,'配置版本');assert(/^(0|[1-9]\d{0,5})\.(0|[1-9]\d{0,5})\.(0|[1-9]\d{0,5})$/.test(v),'配置版本须为数字三段，例如1.0.0');return v.split('.').map(Number);}
export function compareAdapterVersions(a,b){const x=adapterVersion(a),y=adapterVersion(b);for(let i=0;i<3;i++)if(x[i]!==y[i])return Math.sign(x[i]-y[i]);return 0;}
export function validateAdapter(config){
  assert(JSON.stringify(config)?.length<=128000,'适配配置超过128000字符');
  object(config,['format','schemaVersion','id','version','name','description','target','operations','records','dashboard'],'适配配置');
  assert(config.format===ADAPTER_FORMAT&&config.schemaVersion===1,'适配配置格式或schemaVersion不支持');
  string(config.id,160,'适配ID');assert(/^[a-z][a-z0-9_-]{0,63}\.[a-z][a-z0-9_.-]{0,94}$/.test(config.id),'适配ID须为作者命名空间.词条ID');
  adapterVersion(config.version);string(config.name,200,'适配名称');string(config.description,2000,'适配说明');
  object(config.target,['primaryHashes'],'适用原文');list(config.target.primaryHashes,16,'原文版本');assert(new Set(config.target.primaryHashes).size===config.target.primaryHashes.length&&config.target.primaryHashes.every(h=>typeof h==='string'&&/^[a-f0-9]{16}$/.test(h)),'原文版本指纹无效');
  list(config.records,16,'统计对象');unique(config.records,'统计对象');
  for(const r of config.records){object(r,['id','label','description','fields'],'统计对象');id(r.id,'统计对象ID');string(r.label,100,'统计对象名称');string(r.description,1000,'统计对象说明');list(r.fields,16,'统计字段');unique(r.fields,'统计字段');for(const f of r.fields){object(f,['id','label','type','description'],'统计字段');id(f.id,'字段ID');string(f.label,100,'字段名称');string(f.description,1000,'字段说明');assert(f.type==='text','当前接入协议仅支持保留原文的text字段');}}
  list(config.operations,12,'适用操作');unique(config.operations,'适用操作');
  for(const o of config.operations){object(o,['id','kind','label','instruction','ruleQuote','output','recordIds'],'操作');id(o.id,'操作ID');assert(Object.hasOwn(ADAPTER_OPERATIONS,o.kind),'操作类型暂不支持');string(o.label,100,'操作名称');string(o.instruction,4000,'生成要求');assert(string(o.ruleQuote,1200,'原文依据').length>=6,'原文依据至少6字');assert(['design','plan','information','options'].includes(o.output),'生成结果类型无效');list(o.recordIds,16,'关联统计对象');assert(new Set(o.recordIds).size===o.recordIds.length&&o.recordIds.every(id=>config.records.some(r=>r.id===id)),'操作引用不存在或重复的统计对象');}
  if(config.dashboard!==undefined){
    const d=config.dashboard;object(d,['title','summary','sections'],'成果总览');string(d.title,100,'总览名称');string(d.summary,400,'总览简介');list(d.sections,16,'总览模块');unique(d.sections,'总览模块');const assigned=new Set();
    for(const section of d.sections){object(section,['id','label','description','recordIds'],'总览模块');id(section.id,'模块ID');string(section.label,100,'模块名称');string(section.description,400,'模块简介');list(section.recordIds,16,'模块分类');for(const ref of section.recordIds){assert(config.records.some(r=>r.id===ref)&&!assigned.has(ref),'总览引用不存在或重复的统计分类');assigned.add(ref);}}
  }
  return clone(config);
}
export const primaryHash=power=>hash(power.primaryRules??power.rules??'');
export function validateAdapterBinding(binding){
  object(binding,['config','digest','boundPrimaryHash','boundRuleVersion','at','history','status'],'适配绑定');validateAdapter(binding.config);
  assert(binding.digest===digest(binding.config)&&binding.config.target.primaryHashes.includes(binding.boundPrimaryHash),'适配绑定指纹无效');assert(/^[a-f0-9]{16}$/.test(binding.boundRuleVersion)&&binding.status==='staged'&&Number.isSafeInteger(binding.at)&&binding.at>=0,'适配绑定状态无效');
  assert(Array.isArray(binding.history)&&binding.history.length<=32,'适配更新历史无效');for(const h of binding.history){object(h,['version','digest','at'],'适配更新历史');adapterVersion(h.version);assert(/^[a-f0-9]{16}$/.test(h.digest)&&Number.isSafeInteger(h.at)&&h.at>=0,'适配历史指纹无效');}
}
export const adapterBindingCurrent=power=>Boolean(power.adapterBinding&&primaryHash(power)===power.adapterBinding.boundPrimaryHash&&power.ruleVersion===power.adapterBinding.boundRuleVersion);
export function assertAdapterFields(previous,next){
  for(const r of previous.records){const target=next.records.find(n=>n.id===r.id);assert(target,'更新删除了原统计对象，须先设计迁移');for(const f of r.fields){const nf=target.fields.find(n=>n.id===f.id);assert(nf&&nf.type===f.type,'更新删除或改型了原字段，须先设计迁移');}}
}
export function previewAdapter(power,input){
  const config=validateAdapter(input),body=power.primaryRules??power.rules??'',sourceHash=primaryHash(power);
  assert(config.target.primaryHashes.includes(sourceHash),'适配包与当前词条原文版本不匹配；不能只凭名称绑定');
  assert(config.operations.every(o=>body.includes(o.ruleQuote)),'操作原文依据不在当前词条内');
  const old=power.adapterBinding;let mode='new';
  if(old){validateAdapterBinding(old);assert(old.config.id===config.id,'适配ID不同，不能作为原适配的更新');const cmp=compareAdapterVersions(config.version,old.config.version);assert(cmp>=0,'不允许降级适配版本');assert(cmp!==0||old.digest===digest(config),'同一版本内容已改变，请提高版本号');mode=cmp===0?(adapterBindingCurrent(power)?'unchanged':'recheck'):'update';
    assertAdapterFields(old.config,config);
  }
  return {config,digest:digest(config),sourceHash,mode};
}
export function applyAdapter(power,input){
  const p=previewAdapter(power,input);if(p.mode==='unchanged')return false;
  const old=power.adapterBinding,history=old?[...old.history,{version:old.config.version,digest:old.digest,at:old.at}]:[];
  assert(history.length<=32,'适配更新历史已满，请先导出整理');
  power.adapterBinding={config:p.config,digest:p.digest,boundPrimaryHash:p.sourceHash,boundRuleVersion:power.ruleVersion,at:Date.now(),history,status:'staged'};return true;
}
export const adapterMethods={
  openAdapter(){this.adapterDraft=null;this.adapterImportSequence=(this.adapterImportSequence||0)+1;const s=this.ensureStable(),p=s.state.powers[this.powerId];assert(p,'请先选择已接入词条');this.ui.setNotice('');this.ui.showAdapter(p,this.adapterLibrary());},
  async importAdapter(file){
    assert(!this.busy&&!this.mainBusy&&!this.committing,'请等待当前操作完成');assert(file&&file.size<=512000,'适配文件超过512KB');
    const s=this.ensureStable(),powerId=this.powerId,p=s.state.powers[powerId];assert(p,'请先选择已接入词条');
    const captured={chatKey:s.chatKey,stateId:s.state.id,revision:s.state.revision};
    this.adapterDraft=null;const sequence=this.adapterImportSequence=(this.adapterImportSequence||0)+1;
    const input=JSON.parse(await file.text());assert(sequence===this.adapterImportSequence,'已有更新的导入操作，请使用最新预览');this.store.assertCapture(captured);assert(this.powerId===powerId,'导入期间所选词条已变化');
    const preview=previewAdapter(this.store.read().powers[powerId],input);this.adapterDraft={...preview,powerId,captured};this.ui.setNotice('');this.ui.showAdapterPreview(p,preview);
  },
  async confirmAdapter(){
    assert(!this.busy&&!this.mainBusy&&!this.committing,'请等待当前操作完成');const draft=this.adapterDraft;assert(draft,'请重新导入适配文件');const s=this.ensureStable();assert(this.powerId===draft.powerId,'所选词条已变化，请重新导入');this.store.assertCapture(draft.captured);
    this.committing=true;this.refresh();let librarySaved=false;try{await this.saveLibraryAdapter(draft.config);librarySaved=true;await this.store.transact(next=>{const p=next.powers[draft.powerId];assert(p&&primaryHash(p)===draft.sourceHash,'适用原文已变化');applyAdapter(p,draft.config);},{captured:draft.captured});this.adapterDraft=null;this.ui.closeDialog();this.notice('已保存到当前酒馆账户，新聊天将自动关联；配置操作可用于 AI 拟定；专用统计字段可由 AI 整理并保存。');}catch(error){if(librarySaved)throw new Error('适配库已保存，当前聊天尚未关联：'+error.message+'；可重试确认。');throw error;}finally{this.committing=false;this.refresh();}
  },
};
