const test=require('node:test');
const assert=require('node:assert/strict');
const Share=require('../ui/share.js');

const snapshot={
  now:'2026-03-15T16:20:00+08:00',
  today:{keyboard:1200,mouse:340},
  history_days:[
    {day:'2026-03-13',counts:{keyboard:40,mouse:10}},
    {day:'2026-03-14',counts:{keyboard:80,mouse:20}},
    {day:'2026-03-15',counts:{keyboard:1200,mouse:340}},
  ],
  hourly:[
    {start_ms:1,end_ms:2,counts:{keyboard:10,mouse:3}},
    {start_ms:2,end_ms:3,counts:{keyboard:90,mouse:7}},
  ],
};
const copy={number:String,date:String,keyboard:'Keyboard',mouse:'Mouse',peak:(start,end)=>`Peak ${start}-${end}`,streak:'Streak',days:value=>`${value} days`,scan:'Scan',local_only:'Local',total_label:'inputs',private_total:'Private',private_hint:'Hidden',live_signature:'Live',daily_signature:'Daily',aria:'Card'};

test('build uses measured hourly activity only for today',()=>{
  const today=Share.build(snapshot,'2026-03-15');
  assert.equal(today.total,1540);
  assert.equal(today.live,true);
  assert.equal(today.peak.start_ms,2);
  assert.equal(today.streak,3);

  const history=Share.build(snapshot,'2026-03-14');
  assert.deepEqual(history.counts,{keyboard:80,mouse:20});
  assert.equal(history.live,false);
  assert.equal(history.peak,null);
  assert.equal(history.signal.length,24);
  assert.deepEqual(history.signal,Share.build(snapshot,'2026-03-14').signal);
});

test('settings reject unknown theme and ratio values',()=>{
  const settings=Share.normalizeSettings({version:99,theme:'unknown',ratio:'wide',show_qr:0,privacy:1});
  assert.equal(settings.version,1);
  assert.equal(settings.theme,'blue');
  assert.equal(settings.ratio,'portrait');
  assert.equal(settings.show_qr,false);
  assert.equal(settings.privacy,true);
});

test('one SVG renderer supports ratios, privacy, branding, and QR options',()=>{
  const model=Share.build(snapshot,'2026-03-15');
  const full=Share.render(model,{theme:'pink',ratio:'story'},copy);
  assert.match(full,/width="1080" height="1920"/);
  assert.match(full,/ClickPulse/);
  assert.match(full,/1540/);
  assert.match(full,/M0 0h7v1h-7z/);

  const privateCard=Share.render(model,{ratio:'square',privacy:true,show_qr:false,show_brand:false},copy);
  assert.match(privateCard,/width="1080" height="1080"/);
  assert.match(privateCard,/Private/);
  assert.doesNotMatch(privateCard,/1540/);
  assert.doesNotMatch(privateCard,/M0 0h7v1h-7z/);
  assert.doesNotMatch(privateCard,/>ClickPulse</);
});

test('copy is escaped before it enters SVG',()=>{
  const svg=Share.render(Share.build(snapshot,'2026-03-15'),{}, {...copy,total_label:'<unsafe & value>'});
  assert.match(svg,/&lt;unsafe &amp; value&gt;/);
  assert.doesNotMatch(svg,/<unsafe/);
});
