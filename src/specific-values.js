// Pure projections of persisted specialized fields.
export function specificRows(record){return Object.entries(record?.specific?.fields||{}).filter(([,v])=>v).map(([id,value])=>({id,label:record.specific.labels[id],value}));}
export function specificDiff(before,after){
 const ids=new Set([...Object.keys(before?.fields||{}),...Object.keys(after?.fields||{})]);
 return [...ids].filter(id=>(before?.fields[id]||'')!==(after?.fields[id]||'')).map(id=>({label:after?.labels[id]||before?.labels[id]||id,before:before?.fields[id]||'',value:after?.fields[id]||''}));
}
