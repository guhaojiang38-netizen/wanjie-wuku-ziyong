import { createServer } from 'node:http';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve, extname } from 'node:path';
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
const require=createRequire(process.env.WJWK_NODE_MODULES+'/package.json');const {chromium}=require('playwright');
const server=createServer(async(req,res)=>{try{const path=resolve('.','.'+new URL(req.url,'http://local').pathname);if(!path.startsWith(process.cwd()))throw Error('path');res.setHeader('Content-Type',{'.js':'text/javascript','.css':'text/css','.html':'text/html'}[extname(path)]||'application/octet-stream');res.end(await readFile(path));}catch{res.writeHead(404);res.end();}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
let browser;try{
 browser=await chromium.launch({headless:true,executablePath:process.env.WJWK_BROWSER_EXECUTABLE});const page=await browser.newPage({viewport:{width:1400,height:980}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(`http://127.0.0.1:${server.address().port}/tests/preview.html`);await page.locator('[data-action="toggle"]').click();await page.locator('[data-action="manage"]').first().click();await page.locator('[data-action="add-mmlc"]').click();await page.getByRole('heading',{name:'漫漫长路',exact:true}).waitFor();
 assert.equal(await page.locator('.wjwk-tabs').isVisible(),false);assert.equal(await page.locator('.wjwk-mmlc-tile').count(),8);assert.equal(await page.locator('[data-action="generate"]').isVisible(),false);assert.equal(await page.locator('[data-action="baseline"]').count(),0);
 await page.evaluate(async()=>{const {saveArchive,archiveSource}=await import('/src/archives.js');const app=globalThis.wanjie_wuku_general_instance;await app.store.transact(next=>{const p=next.powers.builtin_mmlc_statistics;for(const [type,name,status,fields]of [['bond','道场内门弟子传承','active',{participants:'十二名内门弟子',terms:'传承万象参真经'}],['record','传讯储物玉佩','active',{description:'2枚，完好，用于联络与携带物资'}],['skill','金丹修为','active',{level:'金丹',effect:'真元循环稳定'}],['record','本命剑','active',{description:'修复完成，原剑继续使用'}],['population','巡航舰队','active',{scale:'巡航舰12艘；可用11艘、待修1艘'}],['research','玄黄舰图纸','working',{outcome:'仅完成图纸，实体尚未制造'}]])saveArchive(p,{type,name,status,fields},archiveSource(SillyTavern.getContext().chat,'离线固定演示数据'));});app.refresh();});

 await page.evaluate(async()=>{const {saveArchive,archiveSource}=await import('/src/archives.js');const app=globalThis.wanjie_wuku_general_instance;await app.store.transact(next=>saveArchive(next.powers.builtin_mmlc_statistics,{type:'population',module:'land',name:'耐寒工蜂',status:'active',fields:{scale:'二十只',traits:'耐寒',location:'北坡'}},archiveSource(SillyTavern.getContext().chat,'固定演示')));app.settings.mode='st';app.model.request=async prompt=>{const data=JSON.parse(prompt.user);const r=data.subjects[0];return JSON.stringify({plan:{title:r.name+'事务安排',subjectIds:data.chosenIds.length?data.chosenIds:[r.id],target:'道场北部',task:'安排已有对象承担道场北部的相关职责，实际过程与结果等待正文判断。',ruleQuote:data.rules.slice(0,25),variableUpdates:[],roleChecks:[]}});};app.refresh();});
 const originalArchives=await page.evaluate(()=>JSON.stringify(globalThis.wanjie_wuku_general_instance.store.read().powers.builtin_mmlc_statistics.archives));
 for(const kind of ['deploy','assign','transfer','fleet']){await page.locator(`[data-action="terminal-open"][data-kind="${kind}"]`).click();await page.locator('[data-action="terminal-draft"]').click();await page.locator('[data-action="terminal-confirm"]').waitFor();await page.locator('[data-action="terminal-confirm"]').click();await page.waitForFunction(()=>!globalThis.wanjie_wuku_general_instance.terminalDraft);}
 assert.equal(await page.evaluate(()=>globalThis.wanjie_wuku_general_instance.store.read().terminalOrders.length),4);assert.equal(await page.evaluate(()=>JSON.stringify(globalThis.wanjie_wuku_general_instance.store.read().powers.builtin_mmlc_statistics.archives)),originalArchives);
 await page.evaluate(async()=>{const app=globalThis.wanjie_wuku_general_instance;app.beginTerminal('normal');app.mainBusy=true;const packet=app.terminalInjection(app.store.read());if(!packet.includes('WJWK_TERMINAL_ORDERS_V1'))throw Error('missing packet');SillyTavern.getContext().chat.push({is_user:false,mes:'道场收到了这些部署与分工安排，相关人员正在做出发准备，任务尚未完成。'});app.terminalAttempt.rendered=SillyTavern.getContext().chat.length-1;app.terminalAttempt.ended=true;app.mainBusy=false;await app.completeTerminal();app.refresh();});assert.equal(await page.evaluate(()=>globalThis.wanjie_wuku_general_instance.store.read().terminalOrders.filter(o=>o.status==='presented').length),4);

 await page.evaluate(()=>{
  const app=globalThis.wanjie_wuku_general_instance,chat=SillyTavern.getContext().chat,orders=app.store.read().terminalOrders;
  const states=['completed','blocked','failed','working'];const lines=orders.map((o,i)=>`${o.subjects[0].name}：${['已经完成本次安排并回报。','遇到道路阻断，本次安排暂时受阻。','本次安排遭遇袭击并明确失败。','已经出发，正在执行本次安排。'][i]}`);
  chat.push({is_user:false,mes:lines.join('\n')});window.rawResults=orders.map((o,i)=>({orderId:o.id,status:states[i],summary:lines[i],sourceIndex:chat.length-1,quote:lines[i]}));
  app.settings.mode='st';app.model.request=async()=>JSON.stringify({changes:[],terminalResults:rawResults});app.refresh();
 });
 await page.locator('[data-action="terminal-review"]').click();await page.locator('[name="terminal-result"]').first().waitFor();assert.equal(await page.locator('[name="terminal-result"]').count(),4);
 await page.locator('[name="terminal-result"][value="1"]').uncheck();await page.locator('[data-action="apply-archive-review"]').click();
 await page.waitForFunction(()=>!globalThis.wanjie_wuku_general_instance.pendingArchiveReview);
 assert.equal(await page.evaluate(()=>globalThis.wanjie_wuku_general_instance.store.read().terminalOrders.filter(o=>o.progress).length),3);
 assert.equal(await page.evaluate(()=>globalThis.wanjie_wuku_general_instance.store.read().powers.builtin_mmlc_statistics.archiveReviewed.some(a=>a.index===rawResults[0].sourceIndex)),false);
 await page.locator('[data-action="terminal-review"]').click();await page.locator('[name="terminal-result"]').first().waitFor();await page.locator('[data-action="apply-archive-review"]').click();await page.waitForFunction(()=>!globalThis.wanjie_wuku_general_instance.pendingArchiveReview);
 assert.equal(await page.evaluate(()=>globalThis.wanjie_wuku_general_instance.store.read().terminalOrders.every(o=>o.resultHistory.length===1)),true);
 assert.equal(await page.locator('[data-terminal-order]').count(),4);assert.match(await page.locator('.wjwk-terminal-panel').textContent(),/已完成 1/);
 await page.locator('[data-terminal-order]').first().locator('summary').click();assert.equal(await page.locator('.wjwk-terminal-history').first().isVisible(),true);
 await page.screenshot({path:process.env.WJWK_SCREENSHOTS+'/terminal-results-desktop.png',fullPage:true});
 await page.setViewportSize({width:390,height:844});await page.locator('[data-terminal-order]').first().scrollIntoViewIfNeeded();assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
 await page.screenshot({path:process.env.WJWK_SCREENSHOTS+'/terminal-results-mobile.png',fullPage:true});
 await page.evaluate(async()=>{const app=globalThis.wanjie_wuku_general_instance,chat=SillyTavern.getContext().chat,index=rawResults[0].sourceIndex;chat[index].is_system=true;chat[index].extra={bbs_hidden:true};app.refresh();const {terminalProgressCurrent}=await import('/src/terminal-results.js');if(!app.store.read().terminalOrders.every(o=>terminalProgressCurrent(o,chat)))throw Error('hidden invalidated results');chat[index].mes='原来的执行结果被替换成了其他剧情。';app.refresh();});
 assert.equal(await page.getByText('结果待核对',{exact:true}).count(),4);assert.deepEqual(errors,[]);
 console.log('PASS: four operations and result states, selective acceptance/cursor retention, dedupe, history, mobile layout, BBS hide compatibility and changed-source quarantine; mock model only');
}finally{await browser?.close();server.close();}
