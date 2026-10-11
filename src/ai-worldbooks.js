import { assert, clone } from './core.js';
import { getContext, worldInfoNames, loadBook } from './host.js';
import { validateAIWorldbooks, referenceEntries, referenceSelection, packReferences } from './ai-worldbooks-data.js';
// ST 1.18.0: public read-only /getcharbook type=all create=false, verified in installed world-info.js.
export async function characterReferenceBooks(ctx=getContext()){
 assert(!ctx.groupId,'群聊请使用手动选择世界书');
 assert(typeof ctx.executeSlashCommandsWithOptions==='function','当前酒馆不支持读取角色附加世界书，请改用手动选择');
 const result=await ctx.executeSlashCommandsWithOptions('/getcharbook type=all create=false',{handleParserErrors:false,handleExecutionErrors:false});
 let names;try{names=JSON.parse(result?.pipe||'[]');}catch{throw Error('角色世界书列表无效，请改用手动选择');}
 assert(Array.isArray(names)&&names.every(n=>typeof n==='string'&&n.length>0&&n.length<=300),'角色世界书列表无效');return [...new Set(names)];
}
export async function readReferencePacket(config,{ctx=getContext(),read=name=>loadBook(name,ctx),cardNames,signal}={}){
 const check=()=>{if(signal?.aborted)throw new DOMException('查询已取消','AbortError');};check();
 validateAIWorldbooks(config);if(!config)return packReferences([],new Map());
 if(config.mode==='card'&&cardNames===undefined){cardNames=await characterReferenceBooks(ctx);check();}
 const selection=referenceSelection(config,cardNames),loaded=new Map();
 for(const book of selection){
  if(book.entryIds?.length===0){loaded.set(book.name,[]);continue;}
  const raw=await read(book.name);check();loaded.set(book.name,referenceEntries(raw,book.name));
 }
 return packReferences(selection,loaded);
}
export const aiWorldbookMethods={
 captureReferenceChoices(){const d=this.referenceDraft;if(!d)return;const choices=this.ui.readReferenceChoices();for(const book of d.config.books)if(choices.has(book.name))book.entryIds=choices.get(book.name);},
 assertReferenceDraft(d){assert(d&&this.referenceDraft===d,'世界书选择窗口已失效');this.ensureStable();this.store.assertCapture(d.captured);},
 async openAIWorldbooks(){
  const s=this.ensureStable();assert(!this.busy&&!this.mainBusy,'请等待当前AI操作完成');
  const d={captured:{chatKey:s.chatKey,stateId:s.state.id,revision:s.state.revision},config:clone(s.state.aiWorldbooks||{mode:'manual',books:[]}),loaded:new Map(),names:[],error:'',loading:false};this.referenceDraft=d;
  try{d.names=await worldInfoNames(s.ctx);this.assertReferenceDraft(d);await this.refreshReferenceDraft(d);}catch(e){if(this.referenceDraft===d){d.error=e.message;this.ui.showAIWorldbooks(d,this.referenceLast);}}
 },
 async refreshReferenceDraft(d){
  this.assertReferenceDraft(d);d.loading=true;this.ui.showAIWorldbooks(d,this.referenceLast);
  try{
   if(d.config.mode==='card'){
    const names=await characterReferenceBooks();this.assertReferenceDraft(d);
    d.newBooks=new Set(names.filter(name=>!d.config.books.some(b=>b.name===name)));
    d.config.books=names.map(name=>d.config.books.find(b=>b.name===name)||{name,entryIds:[]});
   }
   validateAIWorldbooks(d.config);
   for(const book of d.config.books){if(!d.loaded.has(book.name)){
    const rows=referenceEntries(await loadBook(book.name),book.name);this.assertReferenceDraft(d);d.loaded.set(book.name,rows);
    // Explicitly selected books start with enabled entries; existing saved empty selections stay empty.
    }
    if(d.newBooks?.has(book.name))book.entryIds=d.loaded.get(book.name).filter(e=>e.enabled).map(e=>e.id);
   }d.newBooks=new Set();d.preview=null;d.error='';
  }catch(e){if(this.referenceDraft===d)d.error=e.message;}
  finally{if(this.referenceDraft===d){d.loading=false;this.ui.showAIWorldbooks(d,this.referenceLast);}}
 },
 async referenceMode(mode){const d=this.referenceDraft;this.assertReferenceDraft(d);assert(!d.loading&&['card','manual'].includes(mode),'请等待世界书读取完成');this.captureReferenceChoices();d.config.mode=mode;await this.refreshReferenceDraft(d);},
 async referenceBook(name){const d=this.referenceDraft;this.assertReferenceDraft(d);assert(!d.loading&&d.config.mode==='manual'&&d.names.includes(name),'请等待读取完成并选择列表中的世界书');this.captureReferenceChoices();const i=d.config.books.findIndex(b=>b.name===name);if(i>=0)d.config.books.splice(i,1);else{assert(d.config.books.length<8,'最多选择8本世界书');d.config.books.push({name,entryIds:[]});d.newBooks=new Set([name]);}await this.refreshReferenceDraft(d);},
 async referencePacketAction(save=false){
  const d=this.referenceDraft;this.assertReferenceDraft(d);assert(!d.loading,'请等待读取完成');this.captureReferenceChoices();const config=clone(d.config);d.loading=true;d.error='';this.ui.showAIWorldbooks(d,this.referenceLast);
  try{const packet=await readReferencePacket(config);this.assertReferenceDraft(d);d.preview=packet;
   if(save){await this.store.transact(n=>{n.aiWorldbooks=config;validateAIWorldbooks(n.aiWorldbooks);},{captured:d.captured,facts:false});this.referenceDraft=null;this.ui.closeDialog();this.refresh();this.notice('已保存本聊天的插件 AI 参考世界书；下次请求自动读取所选条目的最新内容。');this.resumePlayerReview();}
  }catch(e){if(this.referenceDraft===d)d.error=e.message;}
  finally{if(this.referenceDraft===d){d.loading=false;this.ui.showAIWorldbooks(d,this.referenceLast);}}
 },
 previewAIWorldbooks(){return this.referencePacketAction(false);},
 saveAIWorldbooks(){return this.referencePacketAction(true);},
 async clearAIWorldbooks(){const d=this.referenceDraft;this.assertReferenceDraft(d);assert(!d.loading,'请等待世界书读取完成');d.config={mode:'manual',books:[]};d.preview=null;d.error='';this.ui.showAIWorldbooks(d,this.referenceLast);},
 dismissAIWorldbooks(){this.referenceDraft=null;this.resumePlayerReview();},
};
