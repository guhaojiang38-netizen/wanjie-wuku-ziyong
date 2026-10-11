// Independent space, shared archive storage. No demo worlds or second ledger.
import { hash, clone } from './primitives.js';
import { CREATION_PRESETS } from './creation-presets.js';
const preset = CREATION_PRESETS.find(c => c.id === 'wuku.primordial_world');
export const isTaishi = power => Boolean(power && preset.target.primaryHashes.includes(hash(power.primaryRules ?? power.rules ?? '')));
export const TAISHI_SECTIONS = Object.freeze([
  {id:'worlds',title:'诸界',hint:'每个世界自己的格局、时间与变化'},
  {id:'companions',title:'眷属',hint:'人物的所在、职责、行动与关系'},
  {id:'civilizations',title:'众生与文明',hint:'区域、族群、组织与文明成果'},
  {id:'development',title:'发展事项',hint:'正在推进的建设、研究与跨界安排'},
  {id:'available',title:'可调用成果',hint:'世界内现存的资源、知识与支持'},
  {id:'growth',title:'界主所得',hint:'已经归身的成长、神通与历次反哺'},
  {id:'other',title:'其他记录',hint:'保留旧档案与尚未归类的对象'}
]);
const field = (id,label,description=label+'；仅记明确现状，不猜数值') => ({id,label,type:'text',description});
// Keep original adapter and record IDs so old values/history need no migration.
export function taishiConfig(base = preset) {
  const c=clone(base);
  if(c.version==='1.0.0')c.version='1.1.0';
  const additions={
    world:[field('connections','界域联通'),field('limits','世界边界与禁制')],
    inhabitants:[field('world','所属世界')],
    available:[field('world','所属世界')],
    growth:[field('world','反馈来路与所属世界')]
  };
  for(const r of c.records)for(const f of additions[r.id]||[])if(!r.fields.some(x=>x.id===f.id))r.fields.push(f);
  const world=c.records.find(r=>r.id==='world');
  if(world){
    world.description='每个实际世界独立建档；个人初始成熟世界无需重走历史。内历、联通、主从定位以已采用设定及剧情为准。';
    const clock=world.fields.find(f=>f.id==='clock');if(clock){clock.label='本世界内历';clock.description='这个世界的已确认历时与本轮推进依据；不同世界不混算，不使用电脑时间。';}
    const rates=world.fields.find(f=>f.id==='rates');if(rates)rates.label='本世界与局部时速';
    const reset=world.fields.find(f=>f.id==='reset');if(reset)reset.description='仅主世界记录千年改设资格；其他世界不自行生成资格，未知留空。';
  }
  for(const r of [
    {id:'companion',label:'眷属与行动',description:'仅记录具有明确太始天身份的人物；同伴不自动成为眷属。',fields:[field('world','所在世界'),field('location','具体所在'),field('role','身份与职责'),field('action','当前行动'),field('progress','行动进展'),field('relationship','关系与约定'),field('limits','限制与未决事项')]},
    {id:'development',label:'发展事项',description:'每项建设、研究或跨界安排独立追踪，计划和已完成分开。',fields:[field('world','所属世界'),field('participants','参与者'),field('goal','目标'),field('progress','实际进展'),field('result','已形成成果'),field('next','后续事项'),field('limits','限制与阻碍')]}
  ])if(!c.records.some(x=>x.id===r.id))c.records.push(r);
  return c;
}
export function taishiSection(record) {
  const id=record.specific?.recordId;
  const declared={world:'worlds',companion:'companions',development:'development',inhabitants:'civilizations',available:'available',growth:'growth'}[id];
  if(declared)return declared;
  if(record.type==='member'||record.type==='bond')return 'companions';
  return record.type==='research'?'development':'other';
}
// Initial setting imports may fill gaps, never overwrite later saved facts.
export function protectTaishiBaseline(batch) {
  batch.changes=batch.changes.filter(c=>{
    if(!c.before)return true;
    const conflicts=[];
    for(const [k,v] of Object.entries(c.patch))if(c.before.fields[k]){
      if(c.before.fields[k]!==v)conflicts.push(k);
      delete c.patch[k];
    }
    let newSpecific=false;
    if(c.specific){
      for(const [k,v]of Object.entries(c.specific.fields)){
        const old=c.before.specific?.fields[k];
        if(old){if(old!==v)conflicts.push(k);c.specific.fields[k]=old;}
        else if(v)newSpecific=true;
      }
    }
    if(c.status!==c.before.status)conflicts.push('status');
    c.status=c.before.status;
    if(conflicts.length)batch.issues.push({kind:'设定冲突',name:c.name,reason:'已有现状保留；底稿未覆盖字段：'+[...new Set(conflicts)].join('、')});
    return Object.keys(c.patch).length>0||newSpecific;
  });
  return batch;
}
export const TAISHI_REVIEW = `这是独立太始天记录任务。先确认实际归属，再分类；其他金手指的领域、人物和成果不得搬入。每个实际世界独立建档，既有成熟世界可直接记录当前成熟状态，不要求从荒地重走历史。世界名、世界数量、眷属和规则由玩家设定与正文决定，不套用固定示例。
世界记录使用world，眷属使用companion，建设研究与跨界安排使用development；众生文明inhabitants、可调用成果available、永久反馈growth分开。旧对象沿用原archiveId、type和recordId。眷属的所在、职责、行动和进展分别填入details，不把意向写成完成。关联世界使用已知完整名称；未知留空。
各世界内历、主世界历时、局部倍率分开保留，变速不倒改历史；不用电脑时钟推进剧情。世界引擎已写入的变化只登记一次，不进行第二轮后台演化。世界资产可调用不等于已取出，知识或权能调用不自动消耗本体；实物仅按明确交付记现状。万象可用、本源同升与神通归身不得互相替代，永久归身只记已成立反馈。`;
