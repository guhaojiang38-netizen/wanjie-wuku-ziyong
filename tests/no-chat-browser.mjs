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
 await page.goto(`http://127.0.0.1:${server.address().port}/tests/no-chat-preview.html`);
 await page.waitForFunction(()=>Boolean(globalThis.wanjie_wuku_general_instance));
 assert.equal(await page.locator('#wjwk-root').count(),1);await page.locator('[data-action="toggle"]').click();
 await page.getByRole('heading',{name:'先打开一个角色聊天',exact:true}).waitFor();
 assert.match(await page.locator('[data-no-chat-home]').textContent(),/插件已就绪/);
 assert.equal(await page.locator('[data-action="manage"]').count(),0);
 assert.equal(await page.evaluate(()=>Object.keys(SillyTavern.getContext().chatMetadata).length),0);
 await page.screenshot({path:process.env.WJWK_SCREENSHOTS+'/no-chat-desktop.png',fullPage:true});
 await page.setViewportSize({width:390,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
 await page.screenshot({path:process.env.WJWK_SCREENSHOTS+'/no-chat-mobile.png',fullPage:true});
 await page.locator('[data-no-chat-home] summary').click();await page.locator('[data-action="settings"]').click();await page.getByRole('heading',{name:'连接模型 · 三步完成',exact:true}).waitFor();await page.locator('[data-action="dialog-close"]').click();
 await page.evaluate(async()=>{Object.assign(SillyTavern.getContext(),chatContextBefore);await demoEmit('CHAT_CHANGED');});
 await page.waitForFunction(()=>!document.querySelector('[data-no-chat-home]'));
 assert.equal(await page.locator('#wjwk-root').count(),1);assert.equal(await page.locator('[data-action="manage"]').count()>0,true);
 await page.evaluate(async()=>{const c=SillyTavern.getContext();c.chatId=null;c.chat=[];c.chatMetadata={};await demoEmit('CHAT_CHANGED');});
 await page.getByRole('heading',{name:'先打开一个角色聊天',exact:true}).waitFor();assert.equal(await page.locator('#wjwk-root').count(),1);
 assert.equal(await page.evaluate(()=>Object.keys(SillyTavern.getContext().chatMetadata).length),0);
 assert.deepEqual(errors,[]);console.log('PASS: fresh no-chat initialization, visible welcome and optional settings, desktop/mobile, enter/leave chat without duplicate root or unbound writes; no model calls');
}finally{await browser?.close();server.close();}
