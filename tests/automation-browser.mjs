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
 await page.evaluate(async()=>{
  const app=globalThis.wanjie_wuku_general_instance;window.parsing=true;window.calls=0;
  Mvu.isDuringExtraAnalysis=()=>window.parsing;app.attachRoleHooks();app.settings.mode='st';
  app.model.request=async()=>{window.calls++;return JSON.stringify({changes:[]});};
  await app.store.transact(next=>{const p=next.powers.builtin_mmlc_statistics;p.autoArchiveReview=true;p.autoArchiveSave=true;p.autoArchiveStart=0;});
  await demoEmit('CHARACTER_MESSAGE_RENDERED',0,'normal');await demoEmit('GENERATION_ENDED',1);
 });
 await page.waitForFunction(()=>globalThis.wanjie_wuku_general_instance.archiveAutoStatus.builtin_mmlc_statistics==='等待变量更新完成');
 assert.equal(await page.evaluate(()=>window.calls),0);assert.equal(await page.evaluate(()=>Boolean(globalThis.wanjie_wuku_general_instance.playerAutoQueued)),true);
 await page.evaluate(async()=>{window.parsing=false;await SillyTavern.getContext().eventSource.emit(Mvu.events.VARIABLE_UPDATE_ENDED);});
 await page.waitForFunction(()=>window.calls===1&&!globalThis.wanjie_wuku_general_instance.archiveReviewJob);
 assert.equal(await page.evaluate(()=>globalThis.wanjie_wuku_general_instance.store.read().powers.builtin_mmlc_statistics.archiveReviewed.length),1);
 await page.evaluate(async()=>{await demoEmit('CHARACTER_MESSAGE_RENDERED',0,'normal');await demoEmit('GENERATION_ENDED',1);});
 await new Promise(r=>setTimeout(r,600));assert.equal(await page.evaluate(()=>window.calls),1);
 await page.setViewportSize({width:390,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
 assert.deepEqual(errors,[]);console.log('PASS: mock host MVU wait/completion, duplicate rendered/ended events issue one request, archive-only save and mobile layout; no real model calls');
}finally{await browser?.close();server.close();}
