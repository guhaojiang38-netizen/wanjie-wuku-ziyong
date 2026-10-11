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
 await page.evaluate(async()=>{const app=globalThis.wanjie_wuku_general_instance;await app.action('add-mmlc',{});window.pid=app.powerId;const ctx=SillyTavern.getContext();ctx.chat.push({is_user:false,is_system:false,mes:'玄黄舰已经完成制造，两艘均可用。<WJWK-status>当前舰队：玄黄舰两艘，部署北海。</WJWK-status>'});app.refresh();app.settings.mode='st';app.runtimeLog.detail=true;app.apiKey='test-private-credential';app.model.request=async prompt=>{window.sentPrompt=JSON.parse(prompt.user);return JSON.stringify({changes:[{name:'玄黄舰',type:'record',module:'fleet',recordId:'fleet',status:'active',fields:{description:'两艘均可用'},details:{quantity:'两艘',availability:'均可用'},sourceIndex:ctx.chat.length-1,quote:'玄黄舰已经完成制造，两艘均可用。',ruleQuote:sentPrompt.rules.slice(0,20)},{name:'错误舰船',type:'record',module:'fleet',status:'active',fields:{description:'虚构事实'},sourceIndex:ctx.chat.length-1,quote:'不存在的神器已经获得，不应保存。',ruleQuote:sentPrompt.rules.slice(0,20)}],message:'test-private-credential'});};await app.reviewArchives({rescan:true});});
 await page.locator('[name="archive-change"]').waitFor();assert.equal(await page.locator('[name="archive-change"]').count(),1);assert.ok((await page.locator('.wjwk-modal').textContent()).includes('1 项未通过校验'));
 await page.screenshot({path:out+'/partial-review-desktop.png'});
 await page.locator('[data-action="apply-archive-review"]').click();await page.waitForFunction(()=>document.querySelector('.wjwk-modal').hidden);
 assert.equal(await page.evaluate(()=>Object.keys(globalThis.wanjie_wuku_general_instance.store.read().powers[pid].archives).length),1);
 await page.evaluate(()=>globalThis.wanjie_wuku_general_instance.action('runtime-log-open',{}));
 await page.locator('[data-runtime-log]').waitFor();assert.ok((await page.locator('[data-runtime-log]').textContent()).includes('部分保存'));assert.ok((await page.locator('[data-runtime-log]').textContent()).includes('校验结果'));assert.equal((await page.locator('[data-runtime-log]').textContent()).includes('test-private-credential'),false);
 await page.locator('[data-runtime-log] details').first().evaluate(e=>e.open=true);await page.screenshot({path:out+'/runtime-log-desktop.png'});
 const downloadWait=page.waitForEvent('download');await page.locator('[data-action="runtime-log-export"]').click();const download=await downloadWait;await download.saveAs(out+'/exported-log.json');const report=JSON.parse(await readFile(out+'/exported-log.json','utf8'));assert.equal(report.format,'wjwk-runtime-log-v1');assert.equal(report.records[0].steps.some(s=>s.phase==='完整请求'),true);
 await page.setViewportSize({width:390,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);await page.screenshot({path:out+'/runtime-log-mobile.png'});
 await page.locator('[data-action="dialog-close"]').click();await page.reload();await page.waitForFunction(()=>globalThis.wanjie_wuku_general_instance);assert.equal(await page.evaluate(()=>globalThis.wanjie_wuku_general_instance.runtimeLog.detail),false);assert.ok(await page.evaluate(()=>globalThis.wanjie_wuku_general_instance.runtimeLog.list().length>0));
 assert.deepEqual(errors,[]);await writeFile(out+'/browser-evidence.json',JSON.stringify({mockHost:true,partialReview:true,partialSave:true,logDownload:true,logRedaction:true,logReload:true,detailReset:true,mobile390:true,realModelCalls:0,errors},null,2));console.log('Diagnostics browser checks passed');
}finally{await browser?.close();server.close();}
