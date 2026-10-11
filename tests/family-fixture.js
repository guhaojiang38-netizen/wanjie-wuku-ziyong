// Original narrative examples; worldbook supplied locally by the test runner, never packaged.
import {createPower} from '../src/core.js';
export function familyCases(entries){
 const cases=[
 {name:'每日情报',kind:'investigate',story:'每日情报已交付北港线索：商队明日可能经过北港，取决于道路是否解封。你锁定北港商队，尚未取得商队货物。同行阿原有一枚银币，与你无关。',rows:[['record','北港商队','active',{description:'已得到条件性线索，尚未取得货物'},'leads',{finding:'商队明日可能经过，取决于道路是否解封',target:'北港商队',window:'明日，道路解封是条件',tracking:'已锁定',outcome:'尚未取得商队货物'}]]},
 {name:'人生模拟',kind:'simulate',story:'人生模拟北港分支已经结束：模拟中你修成金丹后遇袭死亡。模拟已实际结算金丹实力、永久天赋与次数；所得矿场线索尚需现实抵达，矿石未自动复制。你设想下一次模拟成为城主，尚未开始。',rows:[['record','北港模拟','active',{description:'已完成模拟档案，死亡只发生在模拟中'},'runs',{starting_point:'现实凡人',branch:'北港分支',events:'模拟中修成金丹后遇袭',ending:'模拟死亡，现实已继承实力'}],['research','矿场线索','working',{progress:'已知矿场位置，尚未实际采矿',limits:'尚未抵达现实矿场'},'settlements',{origin:'北港模拟',deposited:'矿场位置与采矿方法',conditions:'尚未抵达现实矿场',realized:''}]]},
 {name:'一言为定',kind:'negotiate',story:'商会给你北港护送诺契：送达药箱后付百金。药箱仍在路上，尚未履约，也未交付百金。你再次读到同一告示，没有产生第二份诺契；当前已投入车资两银，尚未成本补足。',rows:[['bond','北港护送诺契','active',{participants:'你与商会',terms:'送达药箱后付百金',condition:'仍在路上，未履约未到账'},'promises',{promisor:'商会',terms:'送达药箱后付百金',fulfillment:'仍在路上，尚未履约',delivered:'未交付百金',costs:'已投入车资两银，尚未成本补足'}]]},
 {name:'战争天网',kind:'arrange',story:'战争天网已建成北港工厂，使用废铁供料，反应炉供能，每日能制造两台侦察机，目前只完成两台，三台仍为计划。天网已渗入敌方霜号的散热器，只控制散热器，舰桥与动力尚未控制，整舰仍属敌方。另一金手指为你创造了玉剑，阿原的炮艇仍归阿原。',rows:[['facility','北港工厂','active',{condition:'已建成',purpose:'制造侦察机',location:'北港'},'industry',{location:'北港',capacity:'每日能制造两台侦察机，目前只完成两台',inputs:'废铁供料，反应炉供能',orders:'制造侦察机'}],['population','北港侦察机','active',{scale:'已完成两台',purpose:'侦察'},'assets',{scale:'两台，三台仍为计划',capabilities:'侦察'}],['research','霜号渗透','working',{progress:'控制散热器',limits:'舰桥与动力尚未控制'},'infiltration',{foothold:'散热器',controlled:'只控制散热器',remaining:'舰桥与动力尚未控制',result:''}]]}
 ];
 return cases.map(c=>({...c,power:createPower(entries.find(e=>e.name===c.name))}));
}
export function familyProposals(c,index=1){return c.rows.map(([type,name,status,fields,recordId,details])=>({type,name,status,fields,recordId,details,sourceIndex:index,quote:c.story,ruleQuote:c.power.primaryRules.slice(0,30)}));}
