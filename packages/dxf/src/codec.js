/** Lossless tag values and bounded ASCII/binary transport. DXF R13+ uses
 * two-byte group codes; R12 uses one-byte codes with a 255 escape. */
const SIGNATURE = 'AutoCAD Binary DXF\r\n\x1a\0';
const between = (c, a, b) => c >= a && c <= b;
export function groupType(c) {
    if (!Number.isInteger(c) || c < 0 || c > 1071) throw new Error(`Invalid DXF group code ${c}`);
    if (between(c, 310, 319) || c === 1004) return 'binary';
    if (between(c, 10, 59) || between(c, 110, 149) || between(c, 210, 239) || between(c, 460, 469) || between(c, 1010, 1059)) return 'double';
    if (between(c, 60, 79) || between(c, 170, 179) || between(c, 270, 289) || between(c, 370, 389) || between(c, 400, 409) || between(c, 1060, 1070)) return 'int16';
    if (between(c, 90, 99) || between(c, 420, 429) || between(c, 440, 459) || c === 1071) return 'int32';
    if (between(c, 160, 169)) return 'int64';
    if (between(c, 290, 299)) return 'byte';
    return 'string';
}
export function checkedValue(c, value) {
    const type = groupType(c);
    if (type === 'string') { const s=String(value); if (/[\r\n\0]/.test(s)) throw new Error(`Control character in DXF group ${c}`); return s; }
    if (type === 'binary') { const s=String(value).trim(); if (!/^(?:[\da-f]{2}){0,127}$/i.test(s)) throw new Error(`Invalid binary chunk in group ${c}`); return s; }
    const s=String(value).trim();
    if (!s || !(type !== 'int64' ? /^[-+]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][-+]?\d+)?$/ : /^[-+]?\d+$/).test(s)) throw new Error(`Invalid ${type} in group ${c}`);
    if (type === 'int64') { const n=BigInt(s); if(n<-(1n<<63n)||n>=(1n<<63n))throw new Error(`Int64 overflow in group ${c}`);return s; }
    const n=Number(s); if(!Number.isFinite(n))throw new Error(`Non-finite DXF value in group ${c}`);
    if (type!=='double') { const lo=type==='byte'?0:type==='int16'?-32768:-2147483648, hi=type==='byte'?1:type==='int16'?32767:2147483647;
        if(!Number.isInteger(n)||n<lo||n>hi)throw new Error(`DXF ${type} overflow in group ${c}`); }
    return n;
}
function limitOptions(options) {
    const n=options.maxPairs??8000000;
    if(!Number.isSafeInteger(n)||n<1||n>8000000)throw new Error('Invalid DXF maxPairs limit');
    return n;
}
export function readAsciiTags(source, options={}) {
    if(typeof source!=='string'||source.length>128*1024*1024)throw new Error('DXF input exceeds 128 MiB text limit');
    const max=limitOptions(options), lines=source.replace(/^\uFEFF/,'').split(/\r\n|\n|\r/), pairs=[];
    while(lines.length&&lines.at(-1)==='')lines.pop();
    if(lines.length%2)throw new Error('Truncated DXF group/value pair');
    let eof=false;
    for(let i=0;i<lines.length;i+=2) {
        if(pairs.length>=max)throw new Error('DXF group-code safety limit exceeded');
        if(!/^\s*\d+\s*$/.test(lines[i]))throw new Error(`Invalid DXF group code at line ${i+1}`);
        const c=Number(lines[i]), value=checkedValue(c,lines[i+1]);
        if(eof) { if(c!==999)throw new Error('Data after DXF EOF marker'); else {pairs.push([c,value]);continue;} }
        pairs.push([c,value]); if(c===0&&String(value).trim()==='EOF')eof=true;
    }
    if(!eof)throw new Error('DXF EOF marker missing (file may be truncated)');
    return pairs;
}
export function decodeCodePage(page='ANSI_1252') {
    const p=String(page).toUpperCase().replace(/^ANSI_/, '');
    const names={'874':'windows-874','932':'shift_jis','936':'gbk','949':'euc-kr','950':'big5','1361':'euc-kr','UTF-8':'utf-8','UTF8':'utf-8'};
    return names[p] || (/^125[0-8]$/.test(p)?'windows-'+p:/^DOS(?:_|)(\d+)$/.test(p)?'ibm'+p.match(/\d+/)[0]:'windows-1252');
}
export function readBinaryTags(input, options={}) {
    const u=input instanceof Uint8Array?input:new Uint8Array(input);
    if(u.length>128*1024*1024)throw new Error('DXF input exceeds 128 MiB limit');
    if(u.length<24 || SIGNATURE.split('').some((s,i)=>u[i]!==s.charCodeAt(0)))throw new Error('Invalid binary DXF signature');
    const v=new DataView(u.buffer,u.byteOffset,u.byteLength), max=limitOptions(options), result=[];
    // Structural SECTION/999 tag at the beginning disambiguates the code width.
    const r12=options.r12??(u[23]!==0); let pos=22,eof=false;
    const need=n=>{if(pos+n>u.length)throw new Error('Truncated binary DXF');};
    const strings=[];
    while(pos<u.length) {
        if(result.length>=max)throw new Error('DXF group-code safety limit exceeded');
        need(r12?1:2);let c;
        if(r12) {c=u[pos++];if(c===255){need(2);c=v.getUint16(pos,true);pos+=2;}}else {c=v.getUint16(pos,true);pos+=2;}
        const t=groupType(c);let value;
        if(t==='string') {const start=pos;while(pos<u.length&&u[pos])pos++;need(1);value=new TextDecoder('windows-1252').decode(u.subarray(start,pos));strings.push([result.length,start,pos]);pos++;}
        else if(t==='binary'){need(1);const n=u[pos++];need(n);value=Array.from(u.subarray(pos,pos+n),b=>b.toString(16).padStart(2,'0')).join('');pos+=n;}
        else if(t==='double'){need(8);value=v.getFloat64(pos,true);pos+=8;}
        else if(t==='int16'){need(2);value=v.getInt16(pos,true);pos+=2;}
        else if(t==='int32'){need(4);value=v.getInt32(pos,true);pos+=4;}
        else if(t==='int64'){need(8);value=v.getBigInt64(pos,true).toString();pos+=8;}
        else {need(1);value=u[pos++];}
        checkedValue(c,value);result.push([c,value]);
        if(c===0&&value==='EOF'){eof=true;break;}
    }
    if(!eof)throw new Error('Binary DXF EOF marker missing');
    if(pos!==u.length)throw new Error('Data after binary DXF EOF marker');
    // Decode *after* scanning the header, including strings preceding $DWGCODEPAGE.
    let key='',ver='AC1009',page='ANSI_1252';
    for(const [c,x] of result){if(c===9)key=x;else if(key==='$ACADVER'&&c===1)ver=x;else if(key==='$DWGCODEPAGE'&&c===3)page=x;}
    const decoder=new TextDecoder(options.encoding || (ver>='AC1021'?'utf-8':decodeCodePage(page)),{fatal:true});
    for(const [i,a,b] of strings)result[i][1]=decoder.decode(u.subarray(a,b));
    return result;
}
export function writeAsciiTags(pairs,{version='AC1024'}={}) {
    return pairs.map(([c,v])=>{let s=String(checkedValue(c,v));if(version<'AC1021')s=s.replace(/[\u0080-\uffff]/g,x=>'\\U+'+x.charCodeAt(0).toString(16).toUpperCase().padStart(4,'0'));return `${c}\r\n${s}\r\n`;}).join('');
}
export function writeBinaryTags(pairs,{version='AC1024',r12=version<='AC1009'}={}) {
    const bytes=[],encoder=new TextEncoder();let size=22;
    for(const [c,v] of pairs) {
        if(c===999)continue; // Binary DXF does not carry ASCII comments.
        const value=checkedValue(c,v),t=groupType(c),codeSize=r12?(c<255?1:3):2;
        let payload;
        if(t==='string') {let s=String(value);if(version<'AC1021')s=s.replace(/[\u0080-\uffff]/g,x=>'\\U+'+x.charCodeAt(0).toString(16).toUpperCase().padStart(4,'0'));payload=encoder.encode(s+'\0');}
        else if(t==='binary'){const s=String(value);payload=new Uint8Array(1+s.length/2);payload[0]=s.length/2;for(let i=0;i<s.length;i+=2)payload[1+i/2]=parseInt(s.slice(i,i+2),16);}
        else {payload=new Uint8Array(t==='double'||t==='int64'?8:t==='int32'?4:t==='int16'?2:1);const d=new DataView(payload.buffer);if(t==='double')d.setFloat64(0,value,true);else if(t==='int64')d.setBigInt64(0,BigInt(value),true);else if(t==='int32')d.setInt32(0,value,true);else if(t==='int16')d.setInt16(0,value,true);else payload[0]=value;}
        size+=codeSize+payload.length;if(size>128*1024*1024)throw new Error('Binary DXF output exceeds safety limit');bytes.push([c,codeSize,payload]);
    }
    const out=new Uint8Array(size),view=new DataView(out.buffer);out.set(encoder.encode(SIGNATURE));let i=22;
    for(const [c,n,p] of bytes){if(n===1)out[i++]=c;else {if(n===3)out[i++]=255;view.setUint16(i,c,true);i+=2;}out.set(p,i);i+=p.length;}return out;
}
export function splitSections(pairs) {
    const sections=Object.create(null);let name=null,ended=false;
    for(let i=0;i<pairs.length;i++) {const [c,v]=pairs[i];
        if(c===0&&v==='SECTION'){if(name!==null||pairs[i+1]?.[0]!==2)throw new Error('Malformed DXF SECTION nesting');name=String(pairs[++i][1]).trim();if(Object.hasOwn(sections,name))throw new Error('Duplicate DXF section '+name);sections[name]=[];}
        else if(c===0&&v==='ENDSEC'){if(name===null)throw new Error('Unmatched DXF ENDSEC');name=null;}
        else if(c===0&&v==='EOF'){if(name!==null)throw new Error('Unclosed DXF section '+name);ended=true;break;}
        else if(name!==null)sections[name].push(pairs[i]);else if(c!==999)throw new Error('DXF tag outside section');
    }
    if(!ended)throw new Error('DXF EOF marker missing');return sections;
}
export function splitRecords(pairs) {
    const result=[];let r=[];for(const p of pairs){if(p[0]===0&&r.length){result.push(r);r=[];}r.push(p);}if(r.length)result.push(r);return result;
}

/** Semantic string decoding; raw transport tags remain unchanged for preservation. */
export function decodeTextEscapes(value) {
    return typeof value === 'string' ? value.replace(/\\U\+([0-9a-f]{4})/gi,(_,hex)=>String.fromCharCode(parseInt(hex,16))) : value;
}
