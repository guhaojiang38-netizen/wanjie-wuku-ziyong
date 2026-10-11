import { createServer } from 'node:http';
import { readFile,writeFile,mkdir } from 'node:fs/promises';
import { resolve,extname } from 'node:path';
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
const require=createRequire(process.env.WJWK_NODE_MODULES+'/package.json');const {chromium}=require('playwright');
const server=createServer(async(req,res)=>{try{const path=resolve('.','.'+new URL(req.url,'http://local').pathname);if(!path.startsWith(process.cwd()))throw Error('path');res.setHeader('Content-Type',{'.js':'text/javascript','.css':'text/css','.html':'text/html'}[extname(path)]||'application/octet-stream');res.end(await readFile(path));}catch{res.writeHead(404);res.end();}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const out=process.env.WJWK_SCREENSHOTS;await mkdir(out,{recursive:true});let browser;
try{
 browser=await chromium.launch({headless:true,executablePath:process.env.WJWK_BROWSER_EXECUTABLE});const page=await browser.newPage({viewport:{width:1400,height:980}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(`http://127.0.0.1:${server.address().port}/tests/preview.html`);await page.locator('[data-action="toggle"]').click();
 await page.evaluate(async()=>{
  const app=globalThis.wanjie_wuku_general_instance;await app.action('add-mmlc',{});window.mmlcId=app.powerId;
  const {MMLC_CONFIG}=await import('/src/mmlc-config.js'),{saveArchive,archiveSource}=await import('/src/archives.js');
  await app.store.transact(n=>{const p=n.powers[mmlcId],chat=SillyTavern.getContext().chat;
   for(const [name,module,fields,links]of [['北坡福地','land',{environment:'温润林地',capacity:'二十亩'},''],['道韵试验炉','land',{facilities:'可进行材料试验',condition:'运行正常'},'北坡福地'],['北海玄黄舰','fleet',{quantity:'两艘',availability:'一艘可用，一艘维修',deployment:'北海'},''],['万象参真经','arts',{mastery:'已掌握',effect:'融入新领悟'},'']]){
    const d=MMLC_CONFIG.records.find(d=>d.id===module);saveArchive(p,{type:'record',name,status:'active',module,fields:{description:Object.values(fields).join('；')},specific:{adapterId:MMLC_CONFIG.id,recordId:module,version:'1.0.0',label:d.label,labels:Object.fromEntries(d.fields.map(f=>[f.id,f.label])),fields:{...fields,links}}},archiveSource(chat,'玩家确认已有成果'));
   }
  });app.settings.mode='st';app.model.request=async prompt=>{const input=JSON.parse(prompt.user);window.lastModule=input.operation.id;return JSON.stringify({draft:{title:'玄黄舰维修方案',content:'路线一：在北海维护可修部件。路线二：召回道场集中维修。推荐先确认舰体损伤，再决定是否回场。',conditions:'舰体损伤和已解析修复方法待正文判定，不宣称已完成维修。',ruleQuote:input.rules.slice(0,20)}});};app.refresh();
 });
 await page.locator('[data-action="space-mmlc"]').click();await page.locator('.wjwk-mmlc-grid').waitFor();assert.equal(await page.locator('.wjwk-mmlc-tile').count(),8);
 await page.screenshot({path:out+'/mmlc-overview-desktop.png'});
 await page.locator('.wjwk-mmlc-nav [data-section="land"]').click();await page.getByText('当前家底',{exact:true}).waitFor();assert.ok((await page.locator('.wjwk-mmlc-current').textContent()).includes('二十亩'));
 const relation=page.locator('[data-mmlc-record]').filter({hasText:'道韵试验炉'}).getByRole('button',{name:'北坡福地 · 已建立',exact:true});await relation.click();await page.locator('.wjwk-modal').getByText('关联成果',{exact:true}).waitFor();assert.ok((await page.locator('.wjwk-modal').textContent()).includes('道韵试验炉'));await page.locator('.wjwk-modal [data-action="dialog-close"]').click();
 await page.locator('.wjwk-mmlc-nav [data-section="fleet"]').click();await page.getByText('当前家底',{exact:true}).waitFor();assert.ok((await page.locator('.wjwk-mmlc-current').textContent()).includes('两艘'));
 await page.locator('.wjwk-mmlc-hero [data-action="creation-open"]').click();assert.ok((await page.locator('textarea[name="goal"]').inputValue()).includes('规划舰船部署'));assert.equal(await page.locator('select[name="operationId"]').count(),0);await page.locator('[data-action="creation-draft"]').click();await page.locator('[data-action="creation-adopt"]').waitFor();assert.equal(await page.evaluate(()=>lastModule),'fleet');await page.locator('[data-action="creation-adopt"]').click();await page.waitForFunction(()=>document.querySelector('.wjwk-modal').hidden);
 assert.equal(await page.evaluate(()=>globalThis.wanjie_wuku_general_instance.store.read().creations.at(-1).status),'queued');
 // Exercise the real extension injection path using the mocked host generation context.
 const packet=await page.evaluate(()=>{const app=globalThis.wanjie_wuku_general_instance;app.beginCreation('normal');app.mainBusy=true;const packet=app.creationInjection(app.store.read());app.mainBusy=false;return packet;});assert.match(packet,/玄黄舰维修方案/);assert.match(packet,/不是已经发生/);
 await page.setViewportSize({width:390,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);await page.screenshot({path:out+'/mmlc-fleet-mobile.png'});
 await page.locator('.wjwk-mmlc-back [data-action="mmlc-section"]').click();await page.locator('.wjwk-mmlc-tile[data-section="land"]').click();await page.screenshot({path:out+'/mmlc-land-mobile.png'});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
 const roundtrip=await page.evaluate(async()=>{
  const app=globalThis.wanjie_wuku_general_instance,ctx=SillyTavern.getContext(),packet=app.creationAttempt.packet;
  app.observeCreationRequest({read:()=>({packet:packet.trim()})});
  ctx.chat.push({is_user:false,is_system:false,swipe_id:0,mes:'北海玄黄舰完成维修，两艘均可用，仍部署在北海。'});
  app.creationAttempt.ended=true;app.creationAttempt.rendered=ctx.chat.length-1;await app.completeCreation();
  const delivered=app.store.read().creations.at(-1).status;
  await app.store.transact(n=>{n.powers[mmlcId].autoArchiveReview=true;n.powers[mmlcId].autoArchiveSave=true;});
  app.model.request=async prompt=>{const input=JSON.parse(prompt.user),source=input.sources.find(s=>s.content.includes('两艘均可用')),r=input.current.find(r=>r.name==='北海玄黄舰');return JSON.stringify({changes:[{archiveId:r.id,name:r.name,type:r.type,module:'fleet',status:'active',fields:{description:source.content},recordId:'fleet',details:{availability:'两艘均可用'},sourceIndex:source.index,quote:source.content,ruleQuote:input.rules.slice(0,20)}],creationResults:[{creationId:input.creationItems[0].id,status:'completed',summary:'舰船维修完成',sourceIndex:source.index,quote:source.content,archiveRefs:[{changeIndex:0}]}],message:''});};
  await app.reviewArchives({powerId:mmlcId,autoSave:true,automatic:true});
  const state=app.store.read(),r=Object.values(state.powers[mmlcId].archives).find(r=>r.name==='北海玄黄舰');
  return {delivered,availability:r.specific.fields.availability,history:r.history.length,progress:state.creations.at(-1).progress?.status,count:Object.keys(state.powers[mmlcId].archives).length};
 });assert.deepEqual(roundtrip,{delivered:'delivered',availability:'两艘均可用',history:1,progress:'completed',count:4});
 assert.deepEqual(errors,[]);await writeFile(out+'/browser-evidence.json',JSON.stringify({mockHost:true,modules:8,desktop:true,mobile390:true,relations:true,automaticGoal:true,adoptionQueued:true,narrativeInjection:true,automaticResultRoundtrip:roundtrip,realModelCalls:0,errors},null,2));console.log('MMLC browser checks passed');
}finally{await browser?.close();server.close();}
