// Local, bounded diagnostics. Kept separate from chat facts, prompts and backups.
import {hash} from './primitives.js';
export function redactLog(value,secrets=[],{limit=100000}={}){
 const cleanString=s=>{for(const secret of secrets)if(secret)s=s.split(secret).join('[已隐藏]');return s.replace(/Bearer\s+[^\s"'<>]+/gi,'Bearer [已隐藏]').replace(/sk-[\w-]+/g,'[已隐藏]').replace(/((?:api[-_]?key|(?:access[-_]?)?token|authorization|password)["']?\s*[=:]\s*["']?)[^\s"'&,}]+/gi,'$1[已隐藏]');};
 const walk=(v,depth=0)=>{if(depth>12)return '[层级过深]';if(typeof v==='string')return cleanString(v).slice(0,limit);if(Array.isArray(v))return v.slice(0,200).map(x=>walk(x,depth+1));if(v&&typeof v==='object')return Object.fromEntries(Object.entries(v).filter(([k])=>!['__proto__','constructor','prototype'].includes(k)).map(([k,x])=>[k,/api[-_]?key|token|authorization|password|secret/i.test(k)?'[已隐藏]':walk(x,depth+1)]));return v;};return walk(value);
}
export class RuntimeLog{
 constructor({storage,scope=()=>'',secret=()=>[],version='',now=()=>Date.now()}={}){if(storage===undefined){try{storage=globalThis.localStorage;}catch{storage=null;}}this.storage=storage;this.scope=scope;this.secret=secret;this.version=version;this.now=now;this.accounts=new Map();this.detail=false;this.sequence=0;this.storageFailed=!storage;}
 account(scope=this.scope()){return scope.split('|')[0]||'unavailable';}
 key(account){return 'wanjie_wuku_ziyong:diagnostics:'+hash(account);}
 rows(account=this.account()){
  if(!this.accounts.has(account)){let rows=[];try{const raw=this.storage?.getItem(this.key(account));if(raw&&raw.length<=1000000){const parsed=JSON.parse(raw);if(Array.isArray(parsed))rows=parsed.filter(r=>r&&typeof r.id==='string'&&Array.isArray(r.steps)).slice(-40).map(r=>r.status==='运行中'?{...r,status:'页面已关闭，任务未完成'}:r);}}catch{this.storageFailed=true;}this.accounts.set(account,rows);}return this.accounts.get(account);
 }
 persist(account){const rows=this.rows(account);while(rows.length>40||JSON.stringify(rows).length>900000){if(rows.length===1){rows[0].steps=[];rows[0].detailOmitted=true;break;}rows.shift();}try{this.storage?.setItem(this.key(account),JSON.stringify(rows));}catch{this.storageFailed=true;}}
 begin(label,metadata={}){const scope=this.scope(),account=this.account(scope);const id=this.now().toString(36)+'-'+(++this.sequence);const ticket={account,id};const row=redactLog({id,version:this.version,scopeHash:hash(scope),label,startedAt:this.now(),status:'运行中',steps:[],detail:this.detail,...metadata},this.secret());this.rows(account).push(row);this.persist(account);return ticket;}
 find(ticket){return ticket&&this.rows(ticket.account).find(r=>r.id===ticket.id);}
 patch(ticket,data){const row=this.find(ticket);if(!row)return;Object.assign(row,redactLog(data,this.secret()));this.persist(ticket.account);}
 step(ticket,phase,data={}){const row=this.find(ticket);if(!row)return;row.steps.push(redactLog({phase,at:this.now(),...data},this.secret()));if(row.steps.length>30)row.steps.shift();this.persist(ticket.account);}
 capture(ticket,phase,value){if(this.find(ticket)?.detail){const characters=(typeof value==='string'?value:JSON.stringify(value)).length,clean=redactLog(value,this.secret(),{limit:220000}),body=typeof clean==='string'?clean:JSON.stringify(clean);this.step(ticket,phase,{content:body.slice(0,100000),characters,truncated:characters>100000||body.length>100000});}}
 finish(ticket,status,error=''){const row=this.find(ticket);if(!row)return;this.patch(ticket,{status:row.noUpdates&&status==='成功'?'未更新':row.partial&&status==='成功'?'部分完成':status,error,endedAt:this.now(),durationMs:Math.max(0,this.now()-row.startedAt)});}
 list(){return redactLog([...this.rows()].reverse(),this.secret());}
 export(){return {format:'wjwk-runtime-log-v1',version:this.version,exportedAt:this.now(),detailEnabled:this.detail,storageFailed:this.storageFailed,records:this.list()};}
 clear(){const account=this.account();this.accounts.set(account,[]);this.persist(account);}
}
