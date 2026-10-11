// Real production code with a local fake transport; never calls an external API.
import {createServer} from 'node:http';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {resolve,relative,isAbsolute,extname} from 'node:path';
import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
const {chromium}=createRequire(process.env.WJWK_NODE_MODULES+'/package.json')('playwright');
const out=process.env.WJWK_SCREENSHOTS;await mkdir(out,{recursive:true});
const server=createServer(async(req,res)=>{try{const path=resolve('.','.'+decodeURIComponent(new URL(req.url,'http://local').pathname)),rel=relative(process.cwd(),path);if(rel.startsWith('..')||isAbsolute(rel))throw Error('path');res.setHeader('Content-Type',{'.js':'text/javascript','.css':'text/css','.html':'text/html'}[extname(path)]||'application/octet-stream');res.end(await readFile(path));}catch{res.writeHead(404);res.end();}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;
try{
 browser=await chromium.launch({headless:true,executablePath:process.env.WJWK_BROWSER_EXECUTABLE});
 const page=await browser.newPage({viewport:{width:1440,height:1000},reducedMotion:'reduce'}),errors=[];let externalRequests=0;
 page.on('pageerror',e=>errors.push(e.message));await page.route('**/*',r=>{if(new URL(r.request().url()).hostname==='127.0.0.1')return r.continue();externalRequests++;return r.abort();});
 await page.goto(`http://127.0.0.1:${server.address().port}/tests/preview.html`);await page.waitForFunction(()=>globalThis.wanjie_wuku_general_instance);await page.locator('[data-action="toggle"]').click();
 await page.locator('[data-action="space-taishi"]').click();await page.getByRole('heading',{name:'太始天',exact:true}).waitFor();
 assert.equal(await page.locator('.wjwk-mmlc-tile').count(),7);
 const ids=await page.evaluate(async()=>{
  const app=wanjie_wuku_general_instance,ctx=SillyTavern.getContext(),host=await import('/src/host.js');
  const settings={...host.DEFAULT_SETTINGS,mode:'custom',baseUrl:'https://fake-model.test/v1',model:'record-model'};
  const a=host.saveConnectionProfile({name:'便捷整理',settings,apiKey:'FAKE-RECORD-SECRET'});
  const b=host.saveConnectionProfile({name:'设定与拟定',settings:{...settings,model:'design-model'},apiKey:'FAKE-DESIGN-SECRET'});
  app.settings=host.getSettings();app.apiKey=host.getApiKey();window.mockCalls=[];
  ctx.loadWorldInfo=async()=>({entries:{1:{uid:1,comment:'个人诸界',content:'海蓝界和赤砂界已为成熟世界。眷属云岚在海蓝界主持灵圃。'}}});
  await app.store.transact(s=>{s.aiWorldbooks={mode:'manual',books:[{name:'个人诸界',entryIds:['1']}]};});
  app.model.fetchImpl=async(url,options)=>{
    const body=JSON.parse(options.body),input=JSON.parse(body.messages[1].content);window.mockCalls.push({model:body.model,url,key:options.headers.Authorization,setup:Boolean(input.setupReferences)});
    let result;
    if(input.task==='核对经营档案变化'){
      const existing=input.current.find(r=>r.name==='海蓝界');
      result=input.setupReferences?{changes:[
        ...['海蓝界','赤砂界'].map(name=>({name,type:'environment',status:'active',fields:{conditions:'成熟世界'},recordId:'world',details:{stage:'成熟',clock:'个人内历初始时点'},sourceIndex:-1})),
        {name:'云岚',type:'member',status:'working',fields:{role:'太始天眷属',location:'海蓝界'},recordId:'companion',details:{world:'海蓝界',role:'主持灵圃',action:'建设灵圃',progress:'正在进行'},sourceIndex:-1}
      ]}:{changes:[{archiveId:existing.id,name:existing.name,type:existing.type,status:existing.status,fields:{conditions:'灵圃建设已推进百年，既有生态保留'},recordId:'world',details:{clock:'主世界确认推进百年'},sourceIndex:input.sources.at(-1).index}]};
    }else result={draft:{title:'灵圃后续发展方案',content:'先核对已建区域，安排云岚继续完善现有灵圃，不新增未经确认的资源。',conditions:'尚未执行；结果交正文落实。',ruleQuote:input.rules.slice(0,20)}};
    return {ok:true,json:async()=>({choices:[{message:{content:JSON.stringify(result)}}]})};
  };app.refresh();return {a,b,powerId:app.powerId};
 });
 await page.locator('.wjwk-header [data-action="settings"]').click();await page.locator('[data-task-routing] summary').click();
 await page.locator('[name="route:archive"]').selectOption(ids.a);await page.locator('[name="route:setup"]').selectOption(ids.b);await page.locator('[name="route:creation"]').selectOption(ids.b);
 await page.locator('[data-action="save-task-routes"]').click();await page.waitForFunction(()=>wanjie_wuku_general_instance.ui.modal.hidden);
 await page.locator('[data-action="taishi-setup"]').click();await page.locator('[data-action="apply-archive-review"]').waitFor();
 assert.match(await page.locator('.wjwk-modal').textContent(),/世界书设定底稿/);
 assert.equal(await page.evaluate(()=>Object.keys(wanjie_wuku_general_instance.store.read().powers[wanjie_wuku_general_instance.powerId].archives||{}).length),0);
 await page.locator('[data-action="apply-archive-review"]').click();await page.waitForFunction(()=>wanjie_wuku_general_instance.ui.modal.hidden);
 assert.equal(await page.evaluate(()=>Object.keys(wanjie_wuku_general_instance.store.read().powers[wanjie_wuku_general_instance.powerId].archives).length),3);
 await page.locator('.wjwk-mmlc-tile[data-section="worlds"]').click();assert.equal(await page.locator('[data-taishi-record]').count(),2);
 await page.screenshot({path:out+'/taishi-worlds-desktop.png'});
 await page.setViewportSize({width:390,height:844});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));assert.equal(await page.locator('.wjwk-sidebar').isVisible(),false);await page.evaluate(()=>wanjie_wuku_general_instance.ui.hideAIActivity());await page.screenshot({path:out+'/taishi-worlds-mobile.png'});
 await page.setViewportSize({width:1440,height:1000});await page.locator('.wjwk-content [data-action="taishi-section"]').first().click();
 await page.locator('[data-action="player-auto-save"]').click();await page.waitForFunction(()=>wanjie_wuku_general_instance.store.read().powers[wanjie_wuku_general_instance.powerId].autoArchiveSave);
 await page.locator('[data-action="space-wuku"]').click();
 await page.evaluate(()=>{const app=wanjie_wuku_general_instance,ctx=SillyTavern.getContext();ctx.chat.push({name:'旅人',is_user:false,swipe_id:0,mes:'海蓝界的灵圃建设推进百年，云岚继续维护原有生态。'});app.schedulePlayerReview('normal');});
 await page.waitForFunction(id=>Object.values(wanjie_wuku_general_instance.store.read().powers[id].archives).some(r=>r.specific?.fields.clock==='主世界确认推进百年'),ids.powerId);
 await page.waitForFunction(()=>!wanjie_wuku_general_instance.busy&&!wanjie_wuku_general_instance.playerAutoRunning);
 await page.locator('[data-action="space-taishi"]').click();await page.locator('[data-action="creation-open"]').click();await page.locator('[name="goal"]').fill('安排云岚推进灵圃建设，结合现有成果给一份后续方案。');await page.locator('[data-action="creation-draft"]').click();await page.locator('[data-action="creation-adopt"]').waitFor();
 await page.locator('[data-action="dialog-close"]').click();
 await page.locator('[data-action="archive-undo"]').click();await page.locator('[data-action="archive-undo-confirm"]').click();await page.waitForFunction(()=>wanjie_wuku_general_instance.ui.modal.hidden);
 const evidence=await page.evaluate(id=>{const app=wanjie_wuku_general_instance,p=app.store.read().powers[id];return {calls:window.mockCalls.map(({key,...r})=>({...r,keyCorrect:key===`Bearer ${r.model==='record-model'?'FAKE-RECORD-SECRET':'FAKE-DESIGN-SECRET'}`})),records:Object.keys(p.archives).length,clock:Object.values(p.archives).find(r=>r.name==='海蓝界').specific.fields.clock,logs:app.runtimeLog.export()};},ids.powerId);
 assert.deepEqual(evidence.calls.map(r=>r.model),['design-model','record-model','design-model']);assert(evidence.calls.every(r=>r.keyCorrect));assert.equal(evidence.records,3);assert.equal(evidence.clock,'个人内历初始时点');assert(!JSON.stringify(evidence.logs).includes('SECRET'));assert(evidence.logs.records.some(r=>r.steps.some(s=>JSON.stringify(s).includes('便捷整理'))));
 assert.deepEqual(errors,[]);assert.equal(externalRequests,0);
 await writeFile(out+'/taishi-flow.json',JSON.stringify({...evidence,errors,externalRequests,realHostTested:false,installed:false},null,2));console.log('PASS independent Taishi UI, task routing, setting preview/save, background update, creation, undo, desktop/mobile; mock host, zero external calls.');
}finally{await browser?.close();server.close();}
