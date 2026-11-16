import { createHmac, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

const SESSION_SECONDS = 8 * 60 * 60;
const SCRYPT_MAXMEM = 64 * 1024 * 1024;

export function createPasswordHash(password: string): string {
  if (password.length < 12 || password.length > 256) throw new Error('Password must contain 12 to 256 characters');
  const salt = randomBytes(16);
  const derived = scryptSync(password, salt, 32, { N: 16_384, r: 8, p: 1, maxmem: SCRYPT_MAXMEM });
  return `scrypt$16384$8$1$${salt.toString('base64url')}$${derived.toString('base64url')}`;
}

export function verifyPassword(password: unknown, encoded: string | undefined): boolean {
  if (typeof password !== 'string' || password.length > 256 || !encoded) return false;
  const parts = encoded.split('$');
  if (parts.length !== 6 || parts[0] !== 'scrypt') return false;
  const [n, r, p] = parts.slice(1, 4).map(Number);
  if (n !== 16_384 || r !== 8 || p !== 1) return false;
  try {
    const salt = Buffer.from(parts[4], 'base64url');
    const expected = Buffer.from(parts[5], 'base64url');
    if (salt.length !== 16 || expected.length !== 32) return false;
    const actual = scryptSync(password, salt, expected.length, { N: n, r, p, maxmem: SCRYPT_MAXMEM });
    return timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}

function signature(expires: number, secret: string): string {
  return createHmac('sha256', secret).update(String(expires)).digest('base64url');
}

export function createAdminSession(secret: string, now = Date.now()): string {
  const expires = Math.floor(now / 1000) + SESSION_SECONDS;
  return `${expires}.${signature(expires, secret)}`;
}

export function verifyAdminSession(value: string | undefined, secret: string | undefined, now = Date.now()): boolean {
  if (!value || !secret) return false;
  const [expiresText, supplied, extra] = value.split('.');
  if (extra !== undefined || !/^\d{10}$/.test(expiresText) || !supplied) return false;
  const expires = Number(expiresText);
  if (!Number.isSafeInteger(expires) || expires <= Math.floor(now / 1000)) return false;
  const expected = Buffer.from(signature(expires, secret));
  const actual = Buffer.from(supplied);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

export function cookieValue(header: string | undefined, name: string): string | undefined {
  for (const pair of (header || '').split(';')) {
    const [key, ...parts] = pair.trim().split('=');
    if (key === name) return parts.join('=');
  }
  return undefined;
}

export function generateInviteCode(): string {
  const alphabet = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  const body = [...randomBytes(16)].map(value => alphabet[value & 31]).join('');
  return `CP-${body.match(/.{4}/g)?.join('-')}`;
}

export const ADMIN_APP_JS = String.raw`'use strict';
const $=id=>document.getElementById(id);
const api=async(path,options={})=>{
  const response=await fetch(path,{credentials:'same-origin',headers:{'Content-Type':'application/json',...(options.headers||{})},...options});
  const data=await response.json().catch(()=>({}));
  if(!response.ok){const error=new Error(data?.error?.message||'请求失败');error.status=response.status;throw error;}return data;
};
const message=(text,error=false)=>{const node=$('message');node.textContent=text||'';node.className=error?'message error':'message';node.hidden=!text;};
const showLogin=()=>{$('login').hidden=false;$('dashboard').hidden=true;$('password').focus();};
const showDashboard=()=>{$('login').hidden=true;$('dashboard').hidden=false;};
const formatDate=value=>value?new Intl.DateTimeFormat('zh-CN',{month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date(value)):'永久';
const invitationStatus=item=>item.revoked_at?['已停用','revoked']:item.expired?['已过期','expired']:item.remaining===0?['已满','full']:['可使用','active'];
function renderSummary(rows){
  const active=rows.filter(item=>invitationStatus(item)[1]==='active');
  $('summary-active').textContent=String(active.length);
  $('summary-members').textContent=String(rows.reduce((sum,item)=>sum+item.uses,0));
  $('summary-slots').textContent=String(active.reduce((sum,item)=>sum+item.remaining,0));
}
function render(rows){
  renderSummary(rows);const body=$('invitation-list');body.replaceChildren();
  $('empty').hidden=rows.length!==0;
  for(const item of rows){
    const [status,statusClass]=invitationStatus(item),row=document.createElement('tr');
    const created=document.createElement('td');created.dataset.label='创建';created.textContent=formatDate(item.created_at);
    const occupancy=document.createElement('td');occupancy.dataset.label='当前加入';
    const count=document.createElement('strong');count.className='occupancy';count.textContent=String(item.uses);
    const capacity=document.createElement('span');capacity.textContent=' / '+item.max_uses;occupancy.append(count,capacity);
    const remaining=document.createElement('td');remaining.dataset.label='剩余';remaining.textContent=String(item.remaining);
    const expires=document.createElement('td');expires.dataset.label='有效至';expires.textContent=formatDate(item.expires_at);
    const state=document.createElement('td');state.dataset.label='状态';const chip=document.createElement('span');chip.className='status '+statusClass;chip.textContent=status;state.append(chip);
    const action=document.createElement('td');action.className='row-action';
    if(statusClass==='active'){const button=document.createElement('button');button.type='button';button.className='quiet-button danger';button.textContent='停用';button.addEventListener('click',()=>openRevoke(item.id,button));action.append(button);}
    row.append(created,occupancy,remaining,expires,state,action);body.append(row);
  }
}
function showCodes(codes){
  const list=$('code-list');list.replaceChildren();
  for(const value of codes){const row=document.createElement('div'),code=document.createElement('code'),copy=document.createElement('button');row.className='code-row';code.textContent=value;copy.type='button';copy.className='copy-one';copy.textContent='复制';copy.addEventListener('click',async()=>{await navigator.clipboard.writeText(value);copy.textContent='已复制';setTimeout(()=>copy.textContent='复制',1200);});row.append(code,copy);list.append(row);}
  $('generated').hidden=false;$('copy-all').onclick=async()=>{await navigator.clipboard.writeText(codes.join('\n'));message('已复制全部邀请码');};
}
async function load(){try{const data=await api('/admin/api/invitations');showDashboard();render(data.invitations);message('');}catch(error){if(error.status===401)showLogin();else message(error.message,true);}}
let revokeId=null,revokeFocus=null;
function openRevoke(id,trigger){revokeId=id;revokeFocus=trigger;$('revoke-dialog').hidden=false;$('dashboard').inert=true;$('revoke-confirm').focus();}
function closeRevoke(){revokeId=null;$('revoke-dialog').hidden=true;$('dashboard').inert=false;revokeFocus?.focus();}
async function revoke(){if(!revokeId)return;const id=revokeId,button=$('revoke-confirm');button.disabled=true;try{await api('/admin/api/invitations/'+encodeURIComponent(id),{method:'DELETE'});closeRevoke();message('邀请码已停用');await load();}catch(error){message(error.message,true);}finally{button.disabled=false;}}
$('revoke-cancel').addEventListener('click',closeRevoke);$('revoke-close').addEventListener('click',closeRevoke);$('revoke-confirm').addEventListener('click',revoke);
$('revoke-dialog').addEventListener('click',event=>{if(event.target===$('revoke-dialog'))closeRevoke();});
$('revoke-dialog').addEventListener('keydown',event=>{if(event.key==='Escape'){event.preventDefault();closeRevoke();}if(event.key==='Tab'){const focusable=[$('revoke-close'),$('revoke-cancel'),$('revoke-confirm')],index=focusable.indexOf(document.activeElement);event.preventDefault();focusable[(index+(event.shiftKey?-1:1)+focusable.length)%focusable.length].focus();}});
$('login-form').addEventListener('submit',async event=>{event.preventDefault();const button=$('login-button');button.disabled=true;try{await api('/admin/api/session',{method:'POST',body:JSON.stringify({password:$('password').value})});$('password').value='';await load();}catch(error){message(error.message,true);}finally{button.disabled=false;}});
$('generate-form').addEventListener('submit',async event=>{event.preventDefault();const button=$('generate-button');button.disabled=true;button.textContent='生成中…';try{const data=await api('/admin/api/invitations',{method:'POST',body:JSON.stringify({max_uses:Number($('max-uses').value),valid_days:Number($('valid-days').value),count:Number($('count').value)})});showCodes(data.codes);message('邀请码已生成。原始邀请码只显示这一次，请立即保存。');await load();}catch(error){message(error.message,true);}finally{button.disabled=false;button.textContent='生成邀请码';}});
$('logout').addEventListener('click',async()=>{try{await api('/admin/api/session',{method:'DELETE'});}finally{showLogin();}});
load();`;

export const ADMIN_HTML = `<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>ClickPulse 邀请码管理</title>
<style>
:root{font-family:"Segoe UI","PingFang SC","Microsoft YaHei",system-ui,sans-serif;color:#17253a;background:#edf2f8;--navy:#102947;--blue:#2d6cdf;--cyan:#149b96;--line:#dce4ef;--muted:#6d7d91}*{box-sizing:border-box}body{margin:0;min-height:100vh}button,input{font:inherit}button{cursor:pointer}button:focus-visible,input:focus-visible{outline:3px solid #77a7ff;outline-offset:2px}button:disabled{opacity:.55;cursor:default}[hidden]{display:none!important}.shell{width:min(1160px,calc(100% - 32px));margin:28px auto 48px}.masthead{position:relative;overflow:hidden;display:flex;align-items:center;justify-content:space-between;gap:24px;min-height:138px;padding:28px 32px;border-radius:22px;background:var(--navy);color:#fff;box-shadow:0 18px 45px #10294721}.masthead:after{content:"";position:absolute;right:-20px;bottom:25px;width:340px;height:1px;background:#6fd8d1;box-shadow:54px -18px 0 #6fd8d1,-42px -7px 0 #6fd8d1;transform:rotate(-7deg);opacity:.4}.brand{position:relative;z-index:1;display:flex;align-items:center;gap:15px}.brand-mark{display:grid;place-items:center;width:48px;height:48px;border-radius:14px;background:#fff;color:var(--blue);box-shadow:inset 0 0 0 1px #ffffff80}.brand-mark svg{width:27px;height:27px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}.brand h1{margin:0 0 5px;font-size:25px;letter-spacing:-.5px}.brand p{margin:0;color:#bbcadc;font-size:13px}.logout{position:relative;z-index:1;border:1px solid #ffffff33;background:#ffffff0d;color:#e6eef7;border-radius:9px;padding:9px 14px}.logout:hover{background:#ffffff18}.summary{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:1px;margin:0 22px;background:var(--line);border:1px solid var(--line);border-top:0;border-radius:0 0 15px 15px;overflow:hidden}.summary div{background:#fff;padding:17px 20px}.summary span{display:block;color:var(--muted);font-size:12px}.summary strong{display:block;margin-top:5px;font-size:22px;font-variant-numeric:tabular-nums}.workspace{display:grid;grid-template-columns:minmax(280px,350px) minmax(0,1fr);gap:18px;margin-top:22px}.panel{background:#fff;border:1px solid var(--line);border-radius:15px;box-shadow:0 8px 24px #1431520a}.generator{align-self:start;padding:24px}.panel-heading{display:flex;align-items:flex-start;justify-content:space-between;gap:16px}.panel h2{margin:0;font-size:17px;letter-spacing:-.2px}.panel-heading p{margin:7px 0 0;color:var(--muted);font-size:12px;line-height:1.55}.generate-form{display:grid;gap:15px;margin-top:22px}.field{display:grid;gap:7px;color:#4f6177;font-size:12px;font-weight:600}.field small{font-weight:400;color:#8492a3}.field input{width:100%;height:43px;padding:0 12px;border:1px solid #ccd7e5;border-radius:9px;background:#fdfefe;color:#17253a}.field input:focus{border-color:var(--blue)}.primary{height:44px;border:0;border-radius:9px;background:var(--blue);color:#fff;font-weight:650;box-shadow:0 7px 16px #2d6cdf2b;transition:background .16s,transform .14s}.primary:hover{background:#245fc8}.primary:active,.copy-one:active{transform:scale(.98)}.generated{margin-top:22px;padding-top:20px;border-top:1px solid var(--line)}.generated-head{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:11px}.generated-head strong{font-size:13px}.generated-head span{color:#a56113;font-size:11px}.code-list{display:grid;gap:8px}.code-row{display:flex;align-items:center;gap:8px;padding:9px 9px 9px 12px;border:1px solid #cfdceb;border-radius:9px;background:#f4f8fd}.code-row code{min-width:0;flex:1;overflow-wrap:anywhere;color:#163d70;font:600 12px/1.5 "Cascadia Mono","SFMono-Regular",Consolas,monospace}.copy-one,.copy-all,.quiet-button{border:0;border-radius:7px;background:#e4edfa;color:#285f9f;padding:7px 10px;font-size:12px;font-weight:600}.copy-all{width:100%;margin-top:9px}.ledger{min-width:0;padding:24px}.table-wrap{overflow:auto;margin-top:18px;border:1px solid var(--line);border-radius:10px}table{width:100%;border-collapse:collapse;font-size:12px;white-space:nowrap}th{padding:11px 13px;background:#f5f8fc;color:#718198;text-align:left;font-weight:600}td{padding:13px;border-top:1px solid #e7edf5;color:#4f6177;font-variant-numeric:tabular-nums}.occupancy{color:#17253a;font-size:14px}.status{display:inline-flex;align-items:center;gap:7px;padding:5px 8px;border-radius:999px;font-size:11px;font-weight:650}.status:before{content:"";width:6px;height:6px;border-radius:50%;background:currentColor}.status.active{background:#e6f6f3;color:#11736e}.status.full{background:#fff3dc;color:#99620d}.status.expired{background:#edf1f6;color:#657487}.status.revoked{background:#fdebec;color:#a63e45}.row-action{text-align:right}.quiet-button{padding:6px 9px}.quiet-button.danger{background:transparent;color:#a5474d}.quiet-button.danger:hover{background:#fdeced}.empty{padding:40px 16px;text-align:center;color:var(--muted);font-size:13px}.message{position:fixed;z-index:20;left:50%;bottom:24px;transform:translateX(-50%);max-width:min(460px,calc(100% - 28px));padding:11px 16px;border-radius:9px;background:#153454;color:#fff;box-shadow:0 12px 30px #10294735;font-size:12px}.message.error{background:#9d343c}.login{width:min(430px,calc(100% - 28px));margin:12vh auto;padding:30px;background:#fff;border:1px solid var(--line);border-radius:18px;box-shadow:0 20px 55px #10294718}.login .brand{color:var(--navy);margin-bottom:24px}.login .brand p{color:var(--muted)}.login-form{display:grid;gap:15px}.modal{position:fixed;inset:0;z-index:30;display:grid;place-items:center;padding:18px;background:#10294780}.modal-card{width:min(400px,100%);padding:23px;border-radius:16px;background:#fff;box-shadow:0 24px 70px #07182f55}.modal-top{display:flex;align-items:center;justify-content:space-between;gap:12px}.modal h2{margin:0;font-size:18px}.modal p{margin:11px 0 18px;color:var(--muted);font-size:13px;line-height:1.65}.icon-button{display:grid;place-items:center;width:30px;height:30px;border:0;border-radius:8px;background:#edf2f7;color:#607087;font-size:20px}.modal-actions{display:flex;justify-content:flex-end;gap:9px}.modal-actions button{min-width:92px;min-height:40px;border:0;border-radius:8px;font-weight:650}.secondary{background:#e9eef5;color:#40536b}.destructive{background:#ad3d45;color:#fff}.destructive:hover{background:#92323a}
@media(max-width:760px){.shell{width:min(100% - 20px,620px);margin:10px auto 30px}.masthead{min-height:122px;padding:23px 20px;border-radius:17px}.masthead:after{display:none}.brand h1{font-size:21px}.summary{margin:0 10px}.summary div{padding:14px 12px}.summary strong{font-size:19px}.workspace{grid-template-columns:1fr;margin-top:14px}.generator,.ledger{padding:19px}.table-wrap{border:0;overflow:visible}table,tbody{display:block}thead{display:none}tr{display:grid;grid-template-columns:1fr 1fr 1fr;gap:11px 14px;padding:14px 0;border-top:1px solid var(--line)}tr:first-child{border-top:0}td{display:grid;gap:4px;padding:0;border:0;white-space:normal}td:before{content:attr(data-label);font-size:10px;color:#8a97a7}.row-action{text-align:left;align-content:end}.status{width:max-content}.masthead .logout{padding:8px 10px}}
@media(max-width:430px){.summary span{font-size:10px}.workspace{gap:12px}.masthead .brand-mark{display:none}.ledger{padding-left:15px;padding-right:15px}.modal-actions{display:grid;grid-template-columns:1fr 1fr}.modal-actions button{width:100%}}
@media(prefers-reduced-motion:reduce){button{transition:none!important}}
</style></head>
<body><main class="shell"><section id="login" class="login" hidden><div class="brand"><span class="brand-mark"><svg viewBox="0 0 24 24"><path d="M3 12h4l2-5 4 10 2-5h6"/></svg></span><div><h1>ClickPulse</h1><p>邀请码管理</p></div></div><form id="login-form" class="login-form"><label class="field">管理员密码<input id="password" type="password" autocomplete="current-password" required maxlength="256"></label><button id="login-button" class="primary">进入管理台</button></form></section><p id="message" class="message" role="status" hidden></p>
<section id="dashboard" hidden><header class="masthead"><div class="brand"><span class="brand-mark"><svg viewBox="0 0 24 24"><path d="M3 12h4l2-5 4 10 2-5h6"/></svg></span><div><h1>邀请码管理</h1><p>管理排行榜成员的加入凭证</p></div></div><button id="logout" class="logout">安全退出</button></header>
<section class="summary" aria-label="邀请码概览"><div><span>可使用的邀请码</span><strong id="summary-active">0</strong></div><div><span>当前加入人数</span><strong id="summary-members">0</strong></div><div><span>剩余可用名额</span><strong id="summary-slots">0</strong></div></section>
<div class="workspace"><section class="panel generator"><div class="panel-heading"><div><h2>生成邀请码</h2><p>按使用人数和有效期创建加入凭证。</p></div></div><form id="generate-form" class="generate-form"><label class="field">可加入人数<input id="max-uses" type="number" min="1" max="1000" value="1" required><small>成员退出后会自动释放名额</small></label><label class="field">有效天数<input id="valid-days" type="number" min="1" max="3650" value="30" required></label><label class="field">生成数量<input id="count" type="number" min="1" max="20" value="1" required></label><button id="generate-button" class="primary">生成邀请码</button></form><div id="generated" class="generated" hidden><div class="generated-head"><strong>新邀请码</strong><span>仅本次显示</span></div><div id="code-list" class="code-list"></div><button id="copy-all" type="button" class="copy-all">复制全部</button></div></section>
<section class="panel ledger"><div class="panel-heading"><div><h2>邀请码台账</h2><p>“当前加入”是正在占用名额的成员数。</p></div></div><div class="table-wrap"><table><thead><tr><th>创建时间</th><th>当前加入 / 容量</th><th>剩余</th><th>有效至</th><th>状态</th><th></th></tr></thead><tbody id="invitation-list"></tbody></table><div id="empty" class="empty" hidden>还没有邀请码，先从左侧生成一个。</div></div></section></div></section></main>
<div id="revoke-dialog" class="modal" hidden><section class="modal-card" role="dialog" aria-modal="true" aria-labelledby="revoke-title" aria-describedby="revoke-description"><div class="modal-top"><h2 id="revoke-title">停用邀请码？</h2><button id="revoke-close" class="icon-button" aria-label="关闭">×</button></div><p id="revoke-description">停用后将不能再使用剩余名额，已经加入的成员不会受到影响。</p><div class="modal-actions"><button id="revoke-cancel" class="secondary">取消</button><button id="revoke-confirm" class="destructive">确认停用</button></div></section></div>
<script src="/admin/app.js" defer></script></body></html>`;
