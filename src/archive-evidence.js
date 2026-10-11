function literalSpan(content, quote) {
 const exact=content.indexOf(quote);if(exact>=0)return content.slice(exact,exact+quote.length);
 const needle=quote.replace(/\s/gu,'');if(needle.length<6)return null;
 let plain='',positions=[];for(let i=0;i<content.length;i++)if(!/\s/u.test(content[i])){plain+=content[i];positions.push(i);}
 const index=plain.indexOf(needle);if(index<0)return null;
 return content.slice(positions[index],positions[index+needle.length-1]+1);
}

// Optional provenance for display/logging. Never reject an AI update on literal matching.
export function resolveArchiveEvidence(rawIndex, quote, sources, playerNote='') {
 const index=Number(rawIndex),reference=typeof quote==='string'?quote.trim():'';
 if(playerNote)return {manual:true,source:{content:playerNote},quote:reference||playerNote.slice(0,4000),index:-1};
 const source=sources.find(s=>s.index===index)||sources.find(s=>reference&&s.content.includes(reference))||sources.at(-1);
 if(!source)return {manual:true,source:{content:''},quote:reference,index:-1};
 return {manual:false,source,quote:literalSpan(source.content,reference)||reference,index:source.index};
}
