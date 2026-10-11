// New read format only; old evidence hashes retain their original readers.
export { ARCHIVE_READ_FORMAT } from './state-validation.js';
export function withoutThoughts(value){
 const raw=String(value??'');let out='',cursor=0,depth=0;
 // A small delimiter scanner handles nested/unclosed blocks without evaluating HTML.
 for(const m of raw.matchAll(/<(\/?)(think|thinking|analysis|reasoning|konatan_planning~?|WJWK-think|WJWK-option)(?=[\s>])[^>]*>/gi)){
  if(!depth)out+=raw.slice(cursor,m.index);
  if(m[1]){if(depth)depth--;else if(/^konatan_planning/i.test(m[2]))out='';}
  else depth++;
  cursor=m.index+m[0].length;
 }
 if(!depth)out+=raw.slice(cursor);return out.trim();
}
export function statusSnapshots(value){
 return [...String(value??'').matchAll(/<WJWK-status\b[^>]*>([\s\S]*?)<\/WJWK-status\s*>/gi)].map(m=>withoutThoughts(m[1])).filter(Boolean);
}
export function readerReport(raw,content){return {rawCharacters:String(raw).length,readCharacters:content.length,thoughtBlocks:[...String(raw).matchAll(/<(?:think|thinking|analysis|reasoning|konatan_planning~?|WJWK-think)\b/gi)].length+( /<\/konatan_planning~?\s*>/i.test(raw)&&!/<konatan_planning/i.test(raw)?1:0),statusBlocks:statusSnapshots(raw).length,optionBlocks:[...String(raw).matchAll(/<WJWK-option\b/gi)].length,variableBlocks:[...String(raw).matchAll(/<UpdateVariable\b/gi)].length};}
