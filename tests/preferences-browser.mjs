import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { resolve, relative, extname, isAbsolute } from 'node:path';
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
const require=createRequire(process.env.WJWK_NODE_MODULES+'/package.json');
const {chromium}=require('playwright');
const out=process.env.WJWK_SCREENSHOTS;await mkdir(out,{recursive:true});
const server=createServer(async(req,res)=>{try{
 const path=resolve('.','.'+decodeURIComponent(new URL(req.url,'http://local').pathname)),rel=relative(process.cwd(),path);
 if(rel.startsWith('..')||isAbsolute(rel))throw Error('path');
 res.setHeader('Content-Type',{'.js':'text/javascript','.css':'text/css','.html':'text/html'}[extname(path)]||'application/octet-stream');res.end(await readFile(path));
}catch{res.writeHead(404);res.end();}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
let browser;
try{
 browser=await chromium.launch({headless:true,executablePath:process.env.WJWK_BROWSER_EXECUTABLE});
 const page=await browser.newPage({viewport:{width:1400,height:980},reducedMotion:'reduce'}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/*',r=>new URL(r.request().url()).hostname==='127.0.0.1'?r.continue():r.abort());
 await page.goto(`http://127.0.0.1:${server.address().port}/tests/preview.html`);
 await page.locator('[data-action="toggle"]').click();
 await page.locator('[data-action="theme"]').click();await page.locator('[data-action="set-theme"][data-theme="green"]').click();
 assert.equal(await page.locator('#wjwk-root').getAttribute('data-theme'),'green');
 await page.reload();await page.locator('[data-action="toggle"]').click();assert.equal(await page.locator('#wjwk-root').getAttribute('data-theme'),'green');
 for(const theme of ['follow','light','dark','night','parchment','green']){
  await page.locator('[data-action="theme"]').click();await page.locator(`[data-action="set-theme"][data-theme="${theme}"]`).click();
  assert.equal(await page.locator('#wjwk-root').getAttribute('data-theme'),theme);
 }
 await page.locator('[data-action="settings"]').click();
 const create=async(name,url,key,model)=>{
  await page.locator('[data-action="new-api-profile"]').click();
  await page.locator('[name="profileName"]').fill(name);await page.locator('[name="baseUrl"]').fill(url);
  await page.locator('[name="apiKey"]').fill(key);await page.locator('[name="model"]').fill(model);
  await page.locator('[data-action="save-api-profile"]').click();await page.waitForFunction(()=>document.querySelector('.wjwk-modal').hidden);
 };
 await create('日常整理','https://a.example.test/v1','synthetic-key-a','model-a');
 await page.locator('[data-action="settings"]').click();
 await page.locator('[data-action="new-api-profile"]').click();
 assert.equal(await page.evaluate(()=>{const a=wanjie_wuku_general_instance;return a.apiKey==='synthetic-key-a' && a.settings.model==='model-a';}),true,'new draft does not change running connection');
 await page.locator('[data-action="dialog-close"]').click();await page.locator('[data-action="settings"]').click();
 await create('深度推演','https://b.example.test/v1','synthetic-key-b','model-b');
 await page.reload();await page.locator('[data-action="toggle"]').click();await page.locator('[data-action="settings"]').click();
 const a=await page.locator('[data-api-profile] option').filter({hasText:'日常整理'}).getAttribute('value');
 await page.locator('[data-api-profile]').selectOption(a);
 await page.waitForFunction(()=>document.querySelector('[name="model"]').value==='model-a');
 assert.equal(await page.evaluate(()=>wanjie_wuku_general_instance.apiKey==='synthetic-key-a'),true);
 assert.equal(await page.locator('[name="apiKey"]').inputValue(),'');
 assert.ok(!(await page.locator('.wjwk-modal').innerHTML()).includes('synthetic-key'));
 assert.equal(await page.evaluate(async()=>{const {getSettings,getConnectionProfiles}=await import('/src/host.js');return !JSON.stringify([getSettings(),getConnectionProfiles(),wanjie_wuku_general_instance.store.read()]).includes('synthetic-key');}),true);
 await page.locator('[data-action="delete-api-profile"]').click();
 assert.equal(await page.evaluate(()=>wanjie_wuku_general_instance.apiKey==='synthetic-key-a'),true,'delete shortcut keeps active connection');
 assert.equal(await page.locator('[data-api-profile] option').count(),2);
 await page.screenshot({path:resolve(out,'api-profiles-desktop.png')});
 await page.setViewportSize({width:390,height:844});
 assert.equal(await page.evaluate(()=>{const d=document.querySelector('.wjwk-dialog');return d.scrollWidth<=d.clientWidth+1;}),true);
 await page.screenshot({path:resolve(out,'api-profiles-mobile.png')});
 await page.locator('[data-action="dialog-close"]').click();
 await page.evaluate(async()=>{
  const {createPower,importBook}=await import('/src/core.js'),{saveArchive,archiveSource}=await import('/src/archives.js');
  const app=wanjie_wuku_general_instance,p=createPower(importBook({entries:{1:{comment:'行旅纪事',content:'记录旅途中建立的长期成果，只有正文已经完成的事实才能计入。'}}},'测试书')[0]);
  saveArchive(p,{type:'record',name:'青石驿站',status:'active',fields:{description:'已建成的休息点'}},archiveSource(SillyTavern.getContext().chat,'固定演示'));
  p.managementRecords.old={id:'old',category:'record',status:'active',label:'旧版旅行记录',value:'已保留的旧内容',updatedAt:1,source:{type:'manual',note:'测试确认'}};
  await app.store.transact(s=>{s.powers[p.id]=p;});await app.action('space-wuku',{});await app.action('select-power',{id:p.id});
 });
 assert.equal(await page.locator('[data-legacy-content]').innerHTML(),'');
 const count=await page.locator('.wjwk-archive-card').count();
 await page.locator('[data-legacy-management]>summary').click();
 await page.getByText('已保留的旧内容',{exact:true}).waitFor();
 assert.equal(await page.locator('.wjwk-archive-card').count(),count);
 await page.locator('[data-legacy-management]>summary').click();await page.locator('[data-legacy-management]>summary').click();
 assert.equal(await page.getByText('已保留的旧内容',{exact:true}).count(),1);
 assert.deepEqual(errors,[]);
 console.log('PASS: theme button and reload; two named API schemes, independent keys, switching, delete shortcut, no credential in UI metadata/chat; new drafts do not alter running connection; lazy legacy records load without archive duplication; 390px dialog. Mock only.');
}finally{await browser?.close();server.close();}
