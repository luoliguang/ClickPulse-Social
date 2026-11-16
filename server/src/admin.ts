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
  return `CP_${randomBytes(12).toString('base64url')}`;
}

export const ADMIN_APP_JS = String.raw`'use strict';
const $=id=>document.getElementById(id);
const api=async(path,options={})=>{
  const response=await fetch(path,{credentials:'same-origin',headers:{'Content-Type':'application/json',...(options.headers||{})},...options});
  const data=await response.json().catch(()=>({}));
  if(!response.ok){const error=new Error(data?.error?.message||'请求失败');error.status=response.status;throw error;}return data;
};
const message=(text,error=false)=>{const node=$('message');node.textContent=text||'';node.className=error?'error':'';};
const showLogin=()=>{$('login').hidden=false;$('dashboard').hidden=true;$('password').focus();};
const showDashboard=()=>{$('login').hidden=true;$('dashboard').hidden=false;};
function render(rows){
  const body=$('invitation-list');body.replaceChildren();
  if(!rows.length){const row=body.insertRow();const cell=row.insertCell();cell.colSpan=5;cell.textContent='还没有邀请码';return;}
  for(const item of rows){
    const row=body.insertRow();
    const status=item.revoked_at?'已禁用':item.remaining===0?'已用完':item.expired?'已过期':'可使用';
    for(const value of [new Date(item.created_at).toLocaleString(),item.uses+' / '+item.max_uses,item.remaining,String(item.expires_at?new Date(item.expires_at).toLocaleString():'永久')])row.insertCell().textContent=value;
    const action=row.insertCell();
    if(status==='可使用'){const button=document.createElement('button');button.type='button';button.className='danger small';button.textContent='禁用';button.addEventListener('click',()=>revoke(item.id));action.append(button);}else action.textContent=status;
  }
}
async function load(){try{const data=await api('/admin/api/invitations');showDashboard();render(data.invitations);message('');}catch(error){if(error.status===401)showLogin();else message(error.message,true);}}
async function revoke(id){if(!confirm('确定禁用这个邀请码吗？此操作不会影响已经加入的成员。'))return;try{await api('/admin/api/invitations/'+encodeURIComponent(id),{method:'DELETE'});await load();}catch(error){message(error.message,true);}}
$('login-form').addEventListener('submit',async event=>{event.preventDefault();const button=$('login-button');button.disabled=true;try{await api('/admin/api/session',{method:'POST',body:JSON.stringify({password:$('password').value})});$('password').value='';await load();}catch(error){message(error.message,true);}finally{button.disabled=false;}});
$('generate-form').addEventListener('submit',async event=>{event.preventDefault();const button=$('generate-button');button.disabled=true;try{const data=await api('/admin/api/invitations',{method:'POST',body:JSON.stringify({max_uses:Number($('max-uses').value),valid_days:Number($('valid-days').value),count:Number($('count').value)})});$('codes').value=data.codes.join('\n');$('generated').hidden=false;message('邀请码已生成。原始邀请码只显示这一次，请立即复制。');await load();}catch(error){message(error.message,true);}finally{button.disabled=false;}});
$('copy').addEventListener('click',async()=>{await navigator.clipboard.writeText($('codes').value);message('已复制到剪贴板');});
$('logout').addEventListener('click',async()=>{try{await api('/admin/api/session',{method:'DELETE'});}finally{showLogin();}});
load();`;

export const ADMIN_HTML = `<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>ClickPulse 邀请码管理</title>
<style>:root{font-family:system-ui,-apple-system,"Segoe UI",sans-serif;color:#202124;background:#f5f3ef}*{box-sizing:border-box}body{margin:0}main{width:min(920px,calc(100% - 28px));margin:32px auto}.top{display:flex;align-items:center;justify-content:space-between;gap:16px}h1{font-size:24px;margin:0 0 6px}h2{font-size:18px;margin:0 0 18px}.muted{color:#6d6b66;margin:0}.card{background:#fff;border:1px solid #dedbd4;border-radius:16px;padding:22px;margin-top:18px;box-shadow:0 8px 28px rgba(49,43,34,.06)}form.grid{display:grid;grid-template-columns:repeat(3,minmax(110px,1fr)) auto;gap:12px;align-items:end}label{display:grid;gap:7px;font-size:13px;color:#5f5b54}input,textarea{font:inherit;border:1px solid #cbc7bf;border-radius:9px;padding:10px 12px;background:#fff}button{font:inherit;border:0;border-radius:9px;padding:10px 15px;background:#be5a22;color:#fff;cursor:pointer}button.secondary{background:#ece8e1;color:#332f2a}button.danger{background:#8c2f2f}.small{padding:7px 10px;font-size:13px}button:disabled{opacity:.55}#message{min-height:24px;margin:14px 0 0;color:#267047}.error{color:#a32929!important}.login{max-width:430px;margin:12vh auto}.login form{display:grid;gap:14px}.generated{display:grid;gap:10px;margin-top:18px}textarea{min-height:100px;resize:vertical;font-family:ui-monospace,monospace}table{width:100%;border-collapse:collapse;font-size:14px}th,td{text-align:left;padding:11px 9px;border-bottom:1px solid #ebe8e2}th{color:#6b665f;font-weight:600}.scroll{overflow:auto}@media(max-width:680px){main{margin:18px auto}.card{padding:17px}form.grid{grid-template-columns:1fr 1fr}.grid button{grid-column:1/-1}.top{align-items:flex-start}th:nth-child(1),td:nth-child(1){display:none}}</style></head>
<body><main><section id="login" class="card login" hidden><h1>ClickPulse 邀请码管理</h1><p class="muted">请输入管理员密码。</p><form id="login-form"><label>管理员密码<input id="password" type="password" autocomplete="current-password" required maxlength="256"></label><button id="login-button">登录</button></form></section>
<section id="dashboard" hidden><div class="top"><div><h1>邀请码管理</h1><p class="muted">生成、复制和禁用排行榜邀请码。</p></div><button id="logout" class="secondary">退出</button></div><p id="message" role="status"></p>
<div class="card"><h2>生成邀请码</h2><form id="generate-form" class="grid"><label>每个码可用次数<input id="max-uses" type="number" min="1" max="1000" value="1" required></label><label>有效天数<input id="valid-days" type="number" min="1" max="3650" value="30" required></label><label>生成数量<input id="count" type="number" min="1" max="20" value="1" required></label><button id="generate-button">生成并显示</button></form><div id="generated" class="generated" hidden><label>原始邀请码（只显示一次）<textarea id="codes" readonly></textarea></label><button id="copy" type="button" class="secondary">复制全部</button></div></div>
<div class="card"><h2>最近的邀请码</h2><div class="scroll"><table><thead><tr><th>创建时间</th><th>已用 / 总数</th><th>剩余</th><th>过期时间</th><th>状态</th></tr></thead><tbody id="invitation-list"></tbody></table></div></div></section></main><script src="/admin/app.js" defer></script></body></html>`;
