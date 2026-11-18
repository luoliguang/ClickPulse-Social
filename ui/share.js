'use strict';
const ClickPulseShare=(()=>{
  const SIZES={portrait:{width:1080,height:1350,label:'4:5'},square:{width:1080,height:1080,label:'1:1'},story:{width:1080,height:1920,label:'9:16'}};
  const THEMES={
    blue:{background:'#eef5ff',ink:'#102543',accent:'#2563eb',secondary:'#67c9f4',muted:'#607795',paper:'#ffffff'},
    teal:{background:'#edf8f6',ink:'#102d2e',accent:'#0f8177',secondary:'#64c9bc',muted:'#557a78',paper:'#ffffff'},
    violet:{background:'#f3effc',ink:'#251e3c',accent:'#7c3aed',secondary:'#b49ae8',muted:'#74688a',paper:'#ffffff'},
    graphite:{background:'#eef1f5',ink:'#182330',accent:'#52667e',secondary:'#95aabd',muted:'#687789',paper:'#ffffff'},
    pink:{background:'#fdf0f6',ink:'#2b1522',accent:'#db2777',secondary:'#f9a8d4',muted:'#8d6075',paper:'#ffffff'}
  };
  const QR_PATH='M0 0h7v1h-7zM9 0h3v1h-3zM15 0h2v1h-2zM18 0h3v1h-3zM22 0h7v1h-7zM0 1h1v1h-1zM6 1h1v1h-1zM10 1h1v1h-1zM12 1h1v1h-1zM17 1h1v1h-1zM22 1h1v1h-1zM28 1h1v1h-1zM0 2h1v1h-1zM2 2h3v1h-3zM6 2h1v1h-1zM8 2h1v1h-1zM10 2h1v1h-1zM12 2h1v1h-1zM14 2h1v1h-1zM16 2h1v1h-1zM19 2h2v1h-2zM22 2h1v1h-1zM24 2h3v1h-3zM28 2h1v1h-1zM0 3h1v1h-1zM2 3h3v1h-3zM6 3h1v1h-1zM8 3h2v1h-2zM11 3h1v1h-1zM16 3h2v1h-2zM19 3h1v1h-1zM22 3h1v1h-1zM24 3h3v1h-3zM28 3h1v1h-1zM0 4h1v1h-1zM2 4h3v1h-3zM6 4h1v1h-1zM8 4h2v1h-2zM13 4h3v1h-3zM18 4h3v1h-3zM22 4h1v1h-1zM24 4h3v1h-3zM28 4h1v1h-1zM0 5h1v1h-1zM6 5h1v1h-1zM8 5h1v1h-1zM11 5h6v1h-6zM20 5h1v1h-1zM22 5h1v1h-1zM28 5h1v1h-1zM0 6h7v1h-7zM8 6h1v1h-1zM10 6h1v1h-1zM12 6h1v1h-1zM14 6h1v1h-1zM16 6h1v1h-1zM18 6h1v1h-1zM20 6h1v1h-1zM22 6h7v1h-7zM8 7h2v1h-2zM13 7h1v1h-1zM15 7h1v1h-1zM18 7h1v1h-1zM0 8h1v1h-1zM2 8h5v1h-5zM9 8h1v1h-1zM12 8h1v1h-1zM14 8h2v1h-2zM17 8h1v1h-1zM22 8h5v1h-5zM1 9h1v1h-1zM3 9h1v1h-1zM10 9h2v1h-2zM15 9h2v1h-2zM19 9h6v1h-6zM28 9h1v1h-1zM1 10h1v1h-1zM3 10h4v1h-4zM8 10h4v1h-4zM21 10h3v1h-3zM0 11h3v1h-3zM4 11h1v1h-1zM7 11h5v1h-5zM14 11h1v1h-1zM16 11h1v1h-1zM19 11h2v1h-2zM22 11h1v1h-1zM24 11h2v1h-2zM27 11h1v1h-1zM2 12h3v1h-3zM6 12h1v1h-1zM8 12h3v1h-3zM12 12h1v1h-1zM16 12h2v1h-2zM25 12h2v1h-2zM1 13h2v1h-2zM5 13h1v1h-1zM7 13h4v1h-4zM13 13h3v1h-3zM19 13h2v1h-2zM22 13h3v1h-3zM28 13h1v1h-1zM1 14h1v1h-1zM3 14h2v1h-2zM6 14h1v1h-1zM8 14h1v1h-1zM12 14h5v1h-5zM21 14h1v1h-1zM23 14h4v1h-4zM1 15h5v1h-5zM7 15h1v1h-1zM9 15h2v1h-2zM12 15h2v1h-2zM15 15h1v1h-1zM18 15h4v1h-4zM27 15h1v1h-1zM4 16h1v1h-1zM6 16h2v1h-2zM12 16h1v1h-1zM14 16h2v1h-2zM17 16h1v1h-1zM19 16h1v1h-1zM25 16h2v1h-2zM0 17h1v1h-1zM2 17h1v1h-1zM4 17h1v1h-1zM7 17h4v1h-4zM15 17h2v1h-2zM18 17h2v1h-2zM22 17h3v1h-3zM26 17h1v1h-1zM28 17h1v1h-1zM0 18h1v1h-1zM2 18h1v1h-1zM4 18h1v1h-1zM6 18h1v1h-1zM8 18h1v1h-1zM10 18h2v1h-2zM20 18h1v1h-1zM24 18h1v1h-1zM26 18h1v1h-1zM0 19h1v1h-1zM2 19h2v1h-2zM7 19h6v1h-6zM14 19h1v1h-1zM16 19h1v1h-1zM20 19h1v1h-1zM23 19h1v1h-1zM27 19h1v1h-1zM0 20h1v1h-1zM4 20h5v1h-5zM11 20h2v1h-2zM17 20h1v1h-1zM20 20h5v1h-5zM26 20h3v1h-3zM8 21h1v1h-1zM10 21h1v1h-1zM13 21h3v1h-3zM17 21h1v1h-1zM20 21h1v1h-1zM24 21h5v1h-5zM0 22h7v1h-7zM9 22h3v1h-3zM13 22h3v1h-3zM18 22h3v1h-3zM22 22h1v1h-1zM24 22h3v1h-3zM0 23h1v1h-1zM6 23h1v1h-1zM8 23h1v1h-1zM10 23h4v1h-4zM16 23h1v1h-1zM18 23h3v1h-3zM24 23h1v1h-1zM28 23h1v1h-1zM0 24h1v1h-1zM2 24h3v1h-3zM6 24h1v1h-1zM8 24h2v1h-2zM11 24h1v1h-1zM14 24h1v1h-1zM17 24h2v1h-2zM20 24h5v1h-5zM26 24h1v1h-1zM28 24h1v1h-1zM0 25h1v1h-1zM2 25h3v1h-3zM6 25h1v1h-1zM8 25h6v1h-6zM16 25h5v1h-5zM25 25h2v1h-2zM0 26h1v1h-1zM2 26h3v1h-3zM6 26h1v1h-1zM8 26h2v1h-2zM12 26h1v1h-1zM14 26h4v1h-4zM21 26h7v1h-7zM0 27h1v1h-1zM6 27h1v1h-1zM10 27h1v1h-1zM13 27h2v1h-2zM18 27h3v1h-3zM22 27h2v1h-2zM25 27h1v1h-1zM27 27h1v1h-1zM0 28h7v1h-7zM8 28h1v1h-1zM10 28h1v1h-1zM12 28h1v1h-1zM14 28h2v1h-2zM17 28h1v1h-1zM19 28h1v1h-1zM21 28h1v1h-1zM24 28h1v1h-1zM26 28h1v1h-1z';
  const DEFAULTS={version:1,template:'fingerprint',theme:'blue',ratio:'portrait',show_keyboard:true,show_mouse:true,show_peak:true,show_qr:true,show_brand:true,privacy:false};
  const count=c=>(Number(c?.keyboard)||0)+(Number(c?.mouse)||0);
  function normalizeSettings(value={}){
    const next={...DEFAULTS,...value,version:1};
    if(!Object.prototype.hasOwnProperty.call(THEMES,next.theme))next.theme='blue';
    if(!Object.prototype.hasOwnProperty.call(SIZES,next.ratio))next.ratio='portrait';
    next.template='fingerprint';
    for(const key of ['show_keyboard','show_mouse','show_peak','show_qr','show_brand','privacy'])next[key]=!!next[key];
    return next;
  }
  function dayStamp(value){return Date.parse(value+'T00:00:00Z');}
  function streak(records,selected){
    const active=new Set((records||[]).filter(row=>count(row.counts)>0).map(row=>row.day));
    let cursor=dayStamp(selected),days=0;
    while(active.has(new Date(cursor).toISOString().slice(0,10))){days++;cursor-=86400000;}
    return days;
  }
  function seededSignal(seed,total){
    let state=2166136261;
    for(const char of seed+':'+total){state^=char.charCodeAt(0);state=Math.imul(state,16777619);}
    return Array.from({length:24},(_,index)=>{
      state^=state<<13;state^=state>>>17;state^=state<<5;
      const noise=(state>>>0)/4294967295;
      return .12+noise*.58+Math.sin((index/23)*Math.PI)*.3;
    });
  }
  function build(snapshot,selectedDay){
    const today=String(snapshot?.now||'').slice(0,10),history=snapshot?.history_days||[];
    const row=history.find(item=>item.day===selectedDay);
    const counts=selectedDay===today?snapshot?.today:(row?.counts||{keyboard:0,mouse:0});
    const live=selectedDay===today&&Array.isArray(snapshot?.hourly)&&snapshot.hourly.length;
    const hourly=live?snapshot.hourly.map(item=>({value:count(item.counts),start_ms:item.start_ms,end_ms:item.end_ms})):[];
    const signal=live?hourly.map(item=>item.value):seededSignal(selectedDay,count(counts));
    const peak=hourly.length?hourly.reduce((best,item)=>item.value>best.value?item:best,hourly[0]):null;
    return {day:selectedDay,today,counts:{keyboard:Number(counts?.keyboard)||0,mouse:Number(counts?.mouse)||0},total:count(counts),signal,peak,streak:streak(history,selectedDay),live:!!live};
  }
  const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[char]));
  function smooth(points){
    if(!points.length)return '';
    let path=`M${points[0][0].toFixed(1)} ${points[0][1].toFixed(1)}`;
    for(let i=1;i<points.length;i++){
      const prev=points[i-1],point=points[i],mx=(prev[0]+point[0])/2;
      path+=` C${mx.toFixed(1)} ${prev[1].toFixed(1)},${mx.toFixed(1)} ${point[1].toFixed(1)},${point[0].toFixed(1)} ${point[1].toFixed(1)}`;
    }
    return path;
  }
  function fingerprint(signal,x,y,width,height){
    const values=signal.length?signal:[0],max=Math.max(1,...values),step=values.length>1?width/(values.length-1):width;
    const top=values.map((value,index)=>[x+index*step,y-height*(.12+.78*value/max)/2]);
    const bottom=values.map((value,index)=>[x+index*step,y+height*(.12+.78*value/max)/2]).reverse(),bottomPath=smooth(bottom),curve=bottomPath.indexOf(' C');
    return `${smooth(top)} ${bottom.length?'L'+bottom[0][0].toFixed(1)+' '+bottom[0][1].toFixed(1)+(curve>=0?bottomPath.slice(curve):''):''} Z`;
  }
  function render(model,rawSettings,copy){
    const settings=normalizeSettings(rawSettings),size=SIZES[settings.ratio],theme=THEMES[settings.theme];
    const width=size.width,height=size.height,pad=settings.ratio==='story'?88:72;
    const visualTop=settings.ratio==='story'?420:310,visualHeight=settings.ratio==='square'?280:settings.ratio==='story'?520:390;
    const statsY=settings.ratio==='story'?1350:settings.ratio==='square'?790:1015;
    const formatNumber=copy.number||String,privateText=esc(copy.private_total||'Private activity');
    const totalText=settings.privacy?privateText:esc(formatNumber(model.total));
    const totalLabel=settings.privacy?esc(copy.private_hint):esc(copy.total_label);
    const peakText=model.peak&&settings.show_peak&&!settings.privacy?esc(copy.peak(model.peak.start_ms,model.peak.end_ms)):'';
    const stats=[];
    if(settings.show_keyboard)stats.push([copy.keyboard,settings.privacy?'—':formatNumber(model.counts.keyboard)]);
    if(settings.show_mouse)stats.push([copy.mouse,settings.privacy?'—':formatNumber(model.counts.mouse)]);
    if(model.streak)stats.push([copy.streak,copy.days(model.streak)]);
    const colWidth=(width-pad*2)/(Math.min(3,Math.max(1,stats.length))),statMarkup=stats.slice(0,3).map((item,index)=>`<g transform="translate(${pad+index*colWidth} ${statsY})"><text class="label">${esc(item[0])}</text><text y="48" class="stat">${esc(item[1])}</text></g>`).join('');
    const qrSize=settings.ratio==='story'?174:150,qrX=width-pad-qrSize,qrY=height-pad-qrSize;
    const qr=settings.show_qr?`<g transform="translate(${qrX} ${qrY})"><rect width="${qrSize}" height="${qrSize}" rx="18" fill="${theme.paper}"/><g transform="translate(${qrSize*.12} ${qrSize*.12}) scale(${qrSize*.76/29})"><path d="${QR_PATH}" fill="${theme.ink}"/></g></g><text x="${qrX-18}" y="${qrY+qrSize-8}" text-anchor="end" class="tiny">${esc(copy.scan)}</text>`:'';
    const brand=settings.show_brand?`<g transform="translate(${pad} ${pad})"><circle cx="18" cy="18" r="18" fill="${theme.accent}"/><path d="M8 20h6l3-10 4 17 3-9h5" fill="none" stroke="white" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/><text x="54" y="26" class="brand">ClickPulse Social</text></g>`:'';
    const descriptor=peakText||esc(model.live?copy.live_signature:copy.daily_signature);
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="${esc(copy.aria)}"><rect width="${width}" height="${height}" fill="${theme.background}"/><style>text{font-family:Inter,'Noto Sans SC','Segoe UI',sans-serif;fill:${theme.ink}}.brand{font-size:30px;font-weight:700;letter-spacing:-.5px}.date{font-size:24px;font-weight:600;fill:${theme.muted}}.total{font-size:86px;font-weight:720;letter-spacing:-4px;font-variant-numeric:tabular-nums}.total-label{font-size:24px;font-weight:560;fill:${theme.muted}}.caption{font-size:22px;font-weight:560;fill:${theme.muted}}.label{font-size:19px;font-weight:560;fill:${theme.muted}}.stat{font-size:34px;font-weight:680;font-variant-numeric:tabular-nums}.tiny{font-size:17px;font-weight:560;fill:${theme.muted}}</style>${brand}<text x="${width-pad}" y="${pad+27}" text-anchor="end" class="date">${esc(copy.date(model.day))}</text><g><path d="${fingerprint(model.signal,pad,visualTop+visualHeight/2,width-pad*2,visualHeight)}" fill="${theme.accent}" opacity=".13"/><path d="${smooth(model.signal.map((value,index)=>[pad+index*(width-pad*2)/Math.max(1,model.signal.length-1),visualTop+visualHeight/2-(value/Math.max(1,...model.signal))*visualHeight*.3]))}" fill="none" stroke="${theme.accent}" stroke-width="8" stroke-linecap="round" opacity=".9"/><line x1="${pad}" y1="${visualTop+visualHeight/2}" x2="${width-pad}" y2="${visualTop+visualHeight/2}" stroke="${theme.secondary}" stroke-width="2" opacity=".7"/></g><text x="${pad}" y="${visualTop+visualHeight+112}" class="total">${totalText}</text><text x="${pad}" y="${visualTop+visualHeight+154}" class="total-label">${totalLabel}</text><text x="${width-pad}" y="${visualTop+visualHeight+148}" text-anchor="end" class="caption">${descriptor}</text>${statMarkup}${qr}<text x="${pad}" y="${height-pad+5}" class="tiny">${esc(copy.local_only)}</text></svg>`;
  }
  function svgBase64(svg){
    const bytes=new TextEncoder().encode(svg);let binary='';
    for(let i=0;i<bytes.length;i+=8192)binary+=String.fromCharCode(...bytes.subarray(i,i+8192));
    return btoa(binary);
  }
  function toPng(svg,ratio){
    const size=SIZES[ratio]||SIZES.portrait;
    return new Promise((resolve,reject)=>{
      const image=new Image();
      image.onload=()=>{try{const canvas=document.createElement('canvas');canvas.width=size.width;canvas.height=size.height;const context=canvas.getContext('2d');context.drawImage(image,0,0,size.width,size.height);resolve(canvas.toDataURL('image/png').split(',')[1]);}catch(error){reject(error);}};
      image.onerror=()=>reject(new Error('Could not render share card'));
      image.src='data:image/svg+xml;base64,'+svgBase64(svg);
    });
  }
  return {SIZES,THEMES,DEFAULTS,normalizeSettings,build,render,toPng};
})();
if(typeof module!=='undefined')module.exports=ClickPulseShare;
