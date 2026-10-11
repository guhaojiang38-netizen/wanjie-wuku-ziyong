export function normalizeArchiveRange(raw) {
 if (!raw || !['recent','range'].includes(raw.mode)) throw new Error('正文读取范围无效');
 const recent=raw.mode==='recent'?Number(raw.recent ?? 24):24, from=raw.mode==='range'?Number(raw.from ?? 1):1, to=raw.mode!=='range'||raw.to === '' || raw.to == null ? null : Number(raw.to);
 if (!Number.isSafeInteger(recent)||recent<1||recent>10000||!Number.isSafeInteger(from)||from<1||from>1000000||to!==null&&(!Number.isSafeInteger(to)||to<from||to>1000000)) throw new Error('请输入有效范围：最近1—10000层；起止楼层从1开始，结束不能早于开始');
 return {mode:raw.mode,recent,from,to};
}
export function archiveRangeBounds(power, length, {rescan=false}={}) {
 if (!power.archiveReadRange) return {from:Math.max(0,length-24),to:length};
 const r=normalizeArchiveRange(power.archiveReadRange);
 return r.mode==='recent'?{from:Math.max(0,length-r.recent),to:length}:{from:Math.min(length,r.from-1),to:Math.min(length,r.to??length)};
}
export function archiveRangeLabel(power) {
 if (!power?.archiveReadRange) return '读取范围：最近24层';
 const r=normalizeArchiveRange(power.archiveReadRange);
 return r.mode==='recent'?`读取范围：最近${r.recent}层`:`读取范围：第${r.from}—${r.to??'最新'}层`;
}

export function normalizeArchiveAuto(raw = {}) {
 const every=Number(raw.every ?? 1), context=Number(raw.context ?? 6);
 if(!Number.isSafeInteger(every)||every<1||every>12||!Number.isSafeInteger(context)||context<0||context>80)throw Error('更新间隔须为1—12条角色回复，参考前文须为0—80条角色回复');
 return {every,context};
}
