'use strict';
const $=id=>document.getElementById(id);
function setSelectableText(node,value){
  value=String(value);
  if(node.textContent===value)return;
  const selection=window.getSelection?.();
  const text=node.firstChild;
  if(text?.nodeType!==3||node.childNodes.length!==1){node.textContent=value;return;}
  if(!selection||selection.isCollapsed||!selection.rangeCount||!selection.setBaseAndExtent||!selection.getRangeAt(0).intersectsNode(node)){text.data=value;return;}
  // Retain selection (including backwards selections) without freezing live counts.
  const {anchorNode,anchorOffset,focusNode,focusOffset}=selection,oldLength=text.data.length;
  const offset=(container,position)=>container===text?(position===oldLength?value.length:Math.min(position,value.length)):position;
  text.data=value;
  selection.setBaseAndExtent(anchorNode,offset(anchorNode,anchorOffset),focusNode,offset(focusNode,focusOffset));
}
window.setSelectableText=setSelectableText;
const I=ClickPulseI18n;
const T=ClickPulseThemes;
let currentTheme=T.get(window.clickpulseTheme).name;
T.apply(document.documentElement,currentTheme);
const t=(key,values={})=>I.t(key,values);
const n=value=>I.number(value);
I.apply(document);
$('theme-select').value=currentTheme;
for(const option of $('theme-select').options)option.dataset.swatch=T.get(option.value).accent;
const Dropdowns=ClickPulseDropdowns.create(document,window);
const total=c=>(c?.keyboard||0)+(c?.mouse||0);
const send=(action,values={})=>window.ipc?.postMessage(JSON.stringify({action,...values}));
let miniData=null;
let data=null,page='overview',range=14,toastTimer;
let recordingPaused=null;
let dataOperationBusy=false;
let updateState={status:'idle',current:'',version:null,can_install:false,update_command:null,automatic:true,received:0,total:0};
let updateSnoozeTimer=null;
const updateBusy=()=>['downloading','verifying','preparing','installing'].includes(updateState.status);
const updateInstalling=()=>['preparing','installing'].includes(updateState.status);
function closeMiniUpdate(){
  const panel=$('mini-update-panel'),trigger=$('mini-update');
  if(!panel||!trigger)return;
  panel.hidden=true;trigger.setAttribute('aria-expanded','false');
}
function renderMiniUpdate(){
  const trigger=$('mini-update'),panel=$('mini-update-panel');
  if(!trigger||!panel)return;
  if(updateSnoozeTimer!==null){clearTimeout(updateSnoozeTimer);updateSnoozeTimer=null;}
  const version=updateState.version,view=window.presentationView||{};
  const until=Number(view.update_snoozed_until),sameVersion=view.update_snoozed_version===version;
  const snoozed=sameVersion&&Number.isFinite(until)&&Date.now()/1000<until;
  const offered=['available','ready'].includes(updateState.status)&&!!version&&updateState.automatic!==false&&!snoozed;
  trigger.hidden=!offered;
  if(!offered){closeMiniUpdate();if(snoozed){const delay=Math.min(2147483647,Math.max(0,until*1000-Date.now()));updateSnoozeTimer=setTimeout(()=>{updateSnoozeTimer=null;renderMiniUpdate();},delay);}return;}
  $('mini-update-title').textContent=t('update.mini_title',{version});
  const install=$('mini-update-install'),manual=!!updateState.update_command||!updateState.can_install;
  install.textContent=t(manual?'update.details':'update.install');
  install.dataset.action=manual?'details':'install';
}
function renderUpdateState(){
  const button=$('check-updates'),status=$('update-status'),details=$('update-details');
  if(!button||!status||!details)return;
  const state=updateState,available=['available','ready'].includes(state.status),managed=!!state.update_command;
  const currentVersion=$('update-current-version');
  if(currentVersion)setSelectableText(currentVersion,state.current?t('update.current_version',{version:state.current}):'');
  const key={checking:'update.checking',current:'update.current',ready:'update.ready',available:managed||state.can_install?'update.available':'update.manual',error:'update.failed',verifying:'update.verifying',preparing:'update.preparing',installing:'update.restarting'}[state.status];
  const percent=state.total>0?Math.min(100,Math.floor(state.received/state.total*100)):0;
  const text=state.status==='downloading'?t('update.downloading',{percent}):key?t(key,{version:state.version||state.current}):state.current?t('update.version',{version:state.current}):'';
  setSelectableText(status,text);
  const managedHint=$('update-managed');
  if(managedHint){managedHint.hidden=!managed;setSelectableText(managedHint,managed?t('update.managed',{manager:state.update_command.startsWith('winget ')?'WinGet':'Scoop',command:state.update_command}):'');}
  const installHelp=$('update-install-help');
  if(installHelp){installHelp.hidden=!available||managed||state.can_install||state.automatic===false;setSelectableText(installHelp,t('update.install_help'));}
  // Demo, read-only and independent sessions cannot schedule checks or change
  // the installed app's preference, so show why the switch is unavailable.
  const scheduled=state.automatic!==false;
  const automatic=$('automatic-updates'),last=$('update-last-checked');
  if(automatic){automatic.checked=scheduled&&window.presentationView?.auto_check_updates!==false;automatic.disabled=!scheduled||updateInstalling();}
  const unavailable=$('update-automatic-unavailable');
  if(unavailable)unavailable.hidden=scheduled;
  const checked=window.presentationView?.last_update_check;
  const valid=scheduled&&Number.isFinite(checked)&&Math.abs(checked)<=8640000000000;
  if(last){last.hidden=!valid;setSelectableText(last,valid?t('update.last_checked',{time:I.date(checked*1000,{year:'numeric',month:'short',day:'numeric',hour:'numeric',minute:'2-digit'})}):'');}
  button.textContent=t(state.status==='checking'?'update.checking':updateBusy()?'update.updating':available&&!managed?'update.install':'update.check');
  button.disabled=dataOperationBusy||state.status==='checking'||updateBusy();
  button.setAttribute('aria-busy',String(state.status==='checking'||updateBusy()));
  details.hidden=!available&&state.status!=='error';
  renderMiniUpdate();
}
window.renderUpdatePreferences=renderUpdateState;
window.receiveUpdateState=state=>{Object.assign(updateState,state);renderDataOperation();};
window.receiveUpdateAvailable=version=>window.toast(t(updateState.update_command?'update.found_managed':'update.found',{version,command:updateState.update_command}),8000);
const updateCompleteOverlay=$('update-complete-overlay');
const updateCompleteSurfaces=[document.querySelector('main'),document.querySelector('.sidebar'),$('mini-widget')];
let updateCompletePreviousFocus=null;
function closeUpdateComplete(){
  if(!updateCompleteOverlay||updateCompleteOverlay.hidden)return;
  updateCompleteOverlay.hidden=true;for(const surface of updateCompleteSurfaces)surface.inert=false;updateCompletePreviousFocus?.focus();
}
function openUpdateComplete(notice){
  if(!updateCompleteOverlay)return;
  Dropdowns.closeAll();updateCompletePreviousFocus=document.activeElement;
  $('update-complete-description').textContent=t('update.completed_description',{version:notice.version});
  const chinese=String(I.locale||'').toLowerCase().startsWith('zh');
  const localized=chinese&&Array.isArray(notice.notes_zh_cn)&&notice.notes_zh_cn.length?notice.notes_zh_cn:notice.notes;
  const notes=Array.isArray(localized)&&localized.length?localized:[t('update.notes_unavailable')];
  $('update-complete-list').replaceChildren(...notes.map(note=>{const item=document.createElement('li');item.textContent=String(note);return item;}));
  updateCompleteOverlay.hidden=false;for(const surface of updateCompleteSurfaces)surface.inert=true;$('update-complete-done').focus();
}
$('update-complete-close')?.addEventListener('click',closeUpdateComplete);
$('update-complete-done')?.addEventListener('click',closeUpdateComplete);
updateCompleteOverlay?.addEventListener('click',event=>{if(event.target===updateCompleteOverlay)closeUpdateComplete();});
updateCompleteOverlay?.addEventListener('keydown',event=>{
  if(event.key==='Escape'){event.preventDefault();closeUpdateComplete();}
  if(event.key==='Tab'){
    const focusable=[$('update-complete-close'),$('update-complete-done')],index=focusable.indexOf(document.activeElement);
    event.preventDefault();focusable[(index+(event.shiftKey?-1:1)+focusable.length)%focusable.length].focus();
  }
});
// An ad-hoc signed update can leave macOS showing a stale, ineffective grant.
let updatedThisLaunch=false;
window.receiveUpdateNotice=notice=>{
  updatedThisLaunch=updatedThisLaunch||!!notice.success;
  if(notice.success)openUpdateComplete(notice);else window.toast(t('update.failed_last',{version:notice.version}));
  if(data)renderPermission();
};
$('check-updates')?.addEventListener('click',()=>{
  if(dataOperationBusy||updateBusy()||updateState.status==='checking')return;
  send(['available','ready'].includes(updateState.status)&&!updateState.update_command?'install_update':'check_updates');
});
$('update-details')?.addEventListener('click',event=>{event.preventDefault();send('update_release');});
$('automatic-updates')?.addEventListener('change',event=>{
  if(updateInstalling()||updateState.automatic===false)return;
  send('automatic_updates',{enabled:event.target.checked});
});
$('mini-update')?.addEventListener('click',()=>{
  const panel=$('mini-update-panel'),opening=panel.hidden;
  panel.hidden=!opening;$('mini-update').setAttribute('aria-expanded',String(opening));
  if(opening)$('mini-update-install').focus();
});
$('mini-update-close')?.addEventListener('click',()=>{closeMiniUpdate();$('mini-update').focus();});
$('mini-update-panel')?.addEventListener('keydown',event=>{if(event.key==='Escape'){event.preventDefault();closeMiniUpdate();$('mini-update').focus();}});
$('mini-update-install')?.addEventListener('click',()=>{
  closeMiniUpdate();send($('mini-update-install').dataset.action==='details'?'update_release':'install_update');
});
$('mini-update-defer')?.addEventListener('click',()=>{
  if(!updateState.version)return;
  const now=Math.floor(Date.now()/1000),version=updateState.version;
  Object.assign(window.presentationView,{update_snoozed_version:version,update_snoozed_until:now+3*24*60*60});
  closeMiniUpdate();renderMiniUpdate();send('defer_update',{version});
});

// Feedback dialog: scan the WeChat QR to join the feedback group.
const feedbackOverlay=$('feedback-overlay');
let feedbackPreviousFocus=null;
function openFeedback(){
  if(!feedbackOverlay||!feedbackOverlay.hidden)return;
  Dropdowns.closeAll();
  feedbackPreviousFocus=document.activeElement;
  for(const surface of [document.querySelector('main'),document.querySelector('.sidebar'),$('mini-widget')])surface.inert=true;
  feedbackOverlay.hidden=false;
  $('feedback-done').focus();
}
function closeFeedback(){
  feedbackOverlay.hidden=true;
  for(const surface of [document.querySelector('main'),document.querySelector('.sidebar'),$('mini-widget')])surface.inert=false;
  feedbackPreviousFocus?.focus();
}
$('feedback-nav')?.addEventListener('click',openFeedback);
$('feedback-open')?.addEventListener('click',openFeedback);
$('feedback-done')?.addEventListener('click',closeFeedback);
feedbackOverlay?.addEventListener('click',event=>{if(event.target===feedbackOverlay)closeFeedback();});
feedbackOverlay?.addEventListener('keydown',event=>{if(event.key==='Escape'){event.preventDefault();closeFeedback();}});

let leaderboardPeriod='today',leaderboardBusy=false,leaderboardEditing=false,leaderboardRenamePending=false,leaderboardRenameValue='',demoLeaderboardRole=null,leaderboardState={profile:{joined:false},board:null};
const LEADERBOARD_ROLES=['developer','designer','product_manager','operations','marketing','data','engineer','researcher','teacher','writer','student','office','finance','sales','hr','customer_support','legal','medical','freelancer','other'];
function leaderboardRoleLabel(role){return t('leaderboard.role.'+(role||'other'));}
function buildRoleOptions(select,selected){select.replaceChildren(...LEADERBOARD_ROLES.map(role=>{const option=document.createElement('option');option.value=role;option.textContent=leaderboardRoleLabel(role);return option;}));select.value=selected||'other';Dropdowns.sync(select);}
function applyDemoLeaderboardRole(state){
  if(!state.profile?.demo)return state;
  demoLeaderboardRole=demoLeaderboardRole||state.profile.role||'other';state.profile.role=demoLeaderboardRole;
  const self=state.board?.entries?.find(entry=>entry.is_self||entry.member_id===state.profile.member_id);
  if(self)self.role=demoLeaderboardRole;
  return state;
}
function leaderboardAvatar(node,avatar,nickname){
  const url=typeof avatar?.url==='string'?avatar.url.trim():'';
  const hasImage=!!url;
  node.replaceChildren();node.textContent='';
  node.classList.toggle('has-image',hasImage);
  node.dataset.avatar=hasImage?'image':'default';
  if(!hasImage)node.textContent=avatar?.initial||[...String(nickname||'?')][0]?.toUpperCase()||'?';
  node.style.backgroundColor=hasImage?'transparent':(avatar?.color||'var(--blue)');
  node.style.backgroundImage=hasImage?`url("${url.replace(/["\\]/g,'')}")`:'';
}
function setLeaderboardBusy(busy){
  leaderboardBusy=busy;$('leaderboard-loading').hidden=!busy;
  $('leaderboard-board').classList.toggle('is-refreshing',busy);$('leaderboard-board').setAttribute('aria-busy',String(busy));
  $('leaderboard-sync').classList.toggle('is-loading',busy);
  for(const id of ['leaderboard-join-button','leaderboard-sync','leaderboard-name-edit','leaderboard-name-input','leaderboard-name-save','leaderboard-name-cancel','leaderboard-avatar-change','leaderboard-avatar-delete','leaderboard-leave','leaderboard-role','leaderboard-role-edit'])$(id).disabled=busy;
  Dropdowns.sync('leaderboard-role');Dropdowns.sync('leaderboard-role-edit');
  for(const button of document.querySelectorAll('[data-leaderboard-period]'))button.disabled=busy;
}
function setLeaderboardEditing(editing){
  leaderboardEditing=editing;
  $('leaderboard-name-display').hidden=editing;$('leaderboard-name-form').hidden=!editing;
  if(editing){const input=$('leaderboard-name-input');input.value=leaderboardState.profile?.nickname||'';input.focus();input.select?.();}
}
function requestLeaderboard(sync=false){
  setLeaderboardBusy(true);$('leaderboard-error').hidden=true;
  send(sync&&leaderboardState.profile?.joined&&!leaderboardState.profile?.demo?'leaderboard_sync':'leaderboard',{period:leaderboardPeriod});
}
function renderLeaderboard(){
  const {profile={joined:false},board}=leaderboardState,joined=!!profile.joined;
  if(!joined&&leaderboardEditing)setLeaderboardEditing(false);
  $('leaderboard-join').hidden=joined;$('leaderboard-profile').hidden=!joined;
  $('leaderboard-profile-actions').hidden=!!profile.demo;$('leaderboard-name-edit').hidden=!!profile.demo;$('leaderboard-role-edit').disabled=leaderboardBusy;
  $('leaderboard-sync').textContent=t(joined&&!profile.demo?'leaderboard.sync':'leaderboard.refresh');
  if(joined){
    $('leaderboard-profile-name').textContent=profile.nickname;
    $('leaderboard-role-edit').value=profile.role||'other';Dropdowns.sync('leaderboard-role-edit');
    const self=board?.entries?.find(entry=>entry.is_self||entry.member_id===profile.member_id);
    leaderboardAvatar($('leaderboard-avatar'),self?.avatar,profile.nickname);
    $('leaderboard-avatar-delete').hidden=!self?.avatar?.url;
    $('leaderboard-sync-status').textContent=board?.self_rank?t('leaderboard.my_rank',{rank:n(board.self_rank)}):t('leaderboard.not_ranked');
  }
  const rows=(board?.entries||[]).map(entry=>{
    const row=document.createElement('tr');row.classList.toggle('leaderboard-self',!!entry.is_self||entry.member_id===profile.member_id);
    const rank=document.createElement('td');rank.textContent=n(entry.rank);
    const member=document.createElement('td'),wrap=document.createElement('div'),avatar=document.createElement('span'),name=document.createElement('span'),role=document.createElement('span');
    wrap.className='leaderboard-member';avatar.className='leaderboard-avatar';leaderboardAvatar(avatar,entry.avatar,entry.nickname);name.textContent=entry.nickname;role.className='leaderboard-role';role.textContent=leaderboardRoleLabel(entry.role);wrap.append(avatar,name,role);member.append(wrap);
    const keyboard=document.createElement('td'),mouse=document.createElement('td'),sum=document.createElement('td');keyboard.textContent=n(entry.keyboard);mouse.textContent=n(entry.mouse);sum.textContent=n(entry.total);row.append(rank,member,keyboard,mouse,sum);return row;
  });
  const body=$('leaderboard-rows');body.replaceChildren(...rows);$('leaderboard-empty').hidden=rows.length!==0;
  $('leaderboard-range').textContent=board?`${board.starts_on} — ${board.ends_on}`:'';
  if(body.animate&&!window.matchMedia('(prefers-reduced-motion: reduce)').matches)body.animate([{opacity:.25},{opacity:1}],{duration:160,easing:'ease-out'});
}
window.receiveLeaderboard=state=>{
  if(state.board?.period&&state.board.period!==leaderboardPeriod)return;
  const renamed=leaderboardRenamePending&&state.profile?.nickname===leaderboardRenameValue;
  if(leaderboardRenamePending&&!renamed)return;
  const joinedBefore=!!leaderboardState.profile?.joined;leaderboardRenamePending=false;leaderboardRenameValue='';leaderboardState=applyDemoLeaderboardRole(state);setLeaderboardBusy(false);if(renamed)setLeaderboardEditing(false);renderLeaderboard();if(!joinedBefore&&state.profile?.joined)requestLeaderboard(true);
};
window.receiveLeaderboardBackground=state=>{if(leaderboardBusy||(state.board?.period&&state.board.period!==leaderboardPeriod))return;leaderboardState=applyDemoLeaderboardRole(state);renderLeaderboard();};
window.receiveLeaderboardError=message=>{leaderboardRenamePending=false;leaderboardRenameValue='';setLeaderboardBusy(false);renderLeaderboard();$('leaderboard-error').textContent=message;$('leaderboard-error').hidden=false;};
window.receiveLeaderboardCancelled=()=>setLeaderboardBusy(false);
const leaderboardConfirmOverlay=$('leaderboard-confirm-overlay');
const leaderboardConfirmSurfaces=[document.querySelector('main'),document.querySelector('.sidebar'),$('mini-widget')];
let leaderboardConfirmAction=null,leaderboardConfirmPreviousFocus=null;
function closeLeaderboardConfirm(){
  if(leaderboardConfirmOverlay.hidden)return;
  leaderboardConfirmOverlay.hidden=true;leaderboardConfirmAction=null;
  for(const surface of leaderboardConfirmSurfaces)surface.inert=false;
  leaderboardConfirmPreviousFocus?.focus();
}
function openLeaderboardConfirm(kind,action,values={}){
  Dropdowns.closeAll();leaderboardConfirmPreviousFocus=document.activeElement;leaderboardConfirmAction=action;
  const leaving=kind==='leave';
  $('leaderboard-confirm-title').textContent=t(leaving?'leaderboard.leave_confirm_title':'leaderboard.join_confirm_title');
  $('leaderboard-confirm-description').textContent=t(leaving?'leaderboard.leave_confirm':'leaderboard.join_confirm',{nickname:values.nickname||''});
  $('leaderboard-confirm-note').textContent=t(leaving?'leaderboard.leave_confirm_note':'leaderboard.join_confirm_note');
  const submit=$('leaderboard-confirm-submit');submit.textContent=t(leaving?'leaderboard.leave':'leaderboard.join');
  submit.classList.toggle('danger',leaving);submit.classList.toggle('solid',leaving);submit.classList.toggle('primary',!leaving);
  leaderboardConfirmOverlay.hidden=false;for(const surface of leaderboardConfirmSurfaces)surface.inert=true;submit.focus();
}
$('leaderboard-confirm-close')?.addEventListener('click',closeLeaderboardConfirm);
$('leaderboard-confirm-cancel')?.addEventListener('click',closeLeaderboardConfirm);
$('leaderboard-confirm-submit')?.addEventListener('click',()=>{const action=leaderboardConfirmAction;closeLeaderboardConfirm();action?.();});
leaderboardConfirmOverlay?.addEventListener('click',event=>{if(event.target===leaderboardConfirmOverlay)closeLeaderboardConfirm();});
leaderboardConfirmOverlay?.addEventListener('keydown',event=>{
  if(event.key==='Escape'){event.preventDefault();closeLeaderboardConfirm();}
  if(event.key==='Tab'){
    const focusable=[$('leaderboard-confirm-close'),$('leaderboard-confirm-cancel'),$('leaderboard-confirm-submit')],index=focusable.indexOf(document.activeElement);
    event.preventDefault();focusable[(index+(event.shiftKey?-1:1)+focusable.length)%focusable.length].focus();
  }
});
$('leaderboard-join-button')?.addEventListener('click',()=>{
  const invite_code=$('leaderboard-invite').value.trim(),nickname=$('leaderboard-nickname').value.trim(),role=$('leaderboard-role').value;
  if(!invite_code||!nickname){window.toast(t('leaderboard.required'));return;}
  openLeaderboardConfirm('join',()=>{setLeaderboardBusy(true);send('leaderboard_join',{invite_code,nickname,role});},{nickname});
});
for(const button of document.querySelectorAll('[data-leaderboard-period]'))button.addEventListener('click',()=>{
  if(leaderboardBusy||button.dataset.leaderboardPeriod===leaderboardPeriod)return;
  leaderboardPeriod=button.dataset.leaderboardPeriod;$('leaderboard-period-segments').dataset.period=leaderboardPeriod;document.querySelectorAll('[data-leaderboard-period]').forEach(item=>item.classList.toggle('selected',item===button));requestLeaderboard(false);
});
$('leaderboard-sync')?.addEventListener('click',()=>requestLeaderboard(true));
$('leaderboard-name-edit')?.addEventListener('click',()=>setLeaderboardEditing(true));
$('leaderboard-name-cancel')?.addEventListener('click',()=>setLeaderboardEditing(false));
$('leaderboard-name-save')?.addEventListener('click',()=>{
  const nickname=$('leaderboard-name-input').value.trim();
  if(!nickname){window.toast(t('leaderboard.nickname_required'));return;}
  if(nickname===leaderboardState.profile?.nickname){setLeaderboardEditing(false);return;}
  leaderboardRenamePending=true;leaderboardRenameValue=nickname.replace(/\s+/g,' ');setLeaderboardBusy(true);$('leaderboard-error').hidden=true;send('leaderboard_rename',{nickname,period:leaderboardPeriod});
});
$('leaderboard-name-input')?.addEventListener('keydown',event=>{if(event.key==='Enter'){event.preventDefault();$('leaderboard-name-save').click();}else if(event.key==='Escape'){event.preventDefault();setLeaderboardEditing(false);}});
$('leaderboard-role-edit')?.addEventListener('change',()=>{
  const role=$('leaderboard-role-edit').value;
  if(!role||role===leaderboardState.profile?.role)return;
  if(leaderboardState.profile?.demo){demoLeaderboardRole=role;applyDemoLeaderboardRole(leaderboardState);renderLeaderboard();return;}
  setLeaderboardBusy(true);$('leaderboard-error').hidden=true;send('leaderboard_role',{role,period:leaderboardPeriod});
});
$('leaderboard-avatar-change')?.addEventListener('click',()=>{setLeaderboardBusy(true);send('leaderboard_avatar',{period:leaderboardPeriod});});
$('leaderboard-avatar-delete')?.addEventListener('click',()=>{setLeaderboardBusy(true);send('leaderboard_avatar_delete',{period:leaderboardPeriod});});
$('leaderboard-leave')?.addEventListener('click',()=>{
  openLeaderboardConfirm('leave',()=>{setLeaderboardBusy(true);send('leaderboard_leave');});
});
buildRoleOptions($('leaderboard-role'),'other');
buildRoleOptions($('leaderboard-role-edit'),'other');

function renderDataOperation(){
  $('data-operation-status').hidden=!dataOperationBusy;
  $('data-operation-message').textContent=t('storage.processing');
  for(const id of ['storage-directory','import-history','reveal'])$(id).disabled=dataOperationBusy||updateInstalling()||(id==='reveal'&&!!data?.demo);
  $('takeover').disabled=dataOperationBusy||!data?.capture?.listening||!!data?.capture?.permission_needed;
  renderUpdateState();
}
window.receiveDataBusy=busy=>{
  dataOperationBusy=!!busy;
  renderDataOperation();
};
let calendarRange='all',historyRange='all',historyPage=0,calendarLayout='',historySignature='';
let calendarCells=new Map();
const H=ClickPulseHistory;
const titles={overview:'page.overview',history:'page.history',keys:'page.keys',leaderboard:'page.leaderboard',settings:'page.settings'};
const sportView=typeof ClickPulseSport==='undefined'?null:ClickPulseSport.createView({document,window,translate:t,formatSpeed:value=>I.decimal(value,1),send});
window.receiveSport=sample=>sportView?.receive(recordingPaused===null?sample:{...sample,paused:recordingPaused});
window.receivePaused=paused=>{
  const changed=recordingPaused!==paused;recordingPaused=paused;
  if(miniData)miniData={...miniData,paused};
  if(data){data={...data,paused};renderRecordingState();}
  if(window.presentationView?.compact&&miniData)window.presentationStats?.(miniData);
  else if(data)window.presentationStats?.(data);
  else{
    $('pause').textContent=t(paused?'action.resume':'action.pause');
    window.presentationRecordingState?.({paused,capture:{listening:!paused}});
  }
  if(changed)sportView?.setPaused(paused);
};
window.updateSportActivity=()=>sportView?.sync(window.presentationView);
function updateHeading(){
  $('page-title').textContent=t(titles[page]);
  $('page-description').hidden=page==='settings';
  $('page-description').textContent=page==='settings'?'':t(titles[page]+'.description');
}
window.setInterfaceLanguage=(locale,preference)=>{
  $('language-select').value=preference||'system';
  Dropdowns.sync('language-select');
  if(I.locale===locale)return;
  I.setLocale(locale);I.apply(document);updateHeading();renderDataOperation();
  buildRoleOptions($('leaderboard-role'),$('leaderboard-role').value);buildRoleOptions($('leaderboard-role-edit'),leaderboardState.profile?.role||$('leaderboard-role-edit').value);renderLeaderboard();
  renderTimeZoneOptions();Dropdowns.syncAll();
  calendarLayout='';historySignature='';
  sportView?.render();
  for(const id of ['calendar-range-select','history-range-select'])delete $(id).dataset.options;
};
let timezoneNames=[],timezoneChoicesSignature='';
function renderTimeZoneOptions(){
  const select=$('timezone-select'),value=window.presentationView?.timezone||'system';
  const options=['system',...timezoneNames].map(value=>{
    const option=document.createElement('option');option.value=value;
    option.textContent=value==='system'?t('settings.timezone_system'):value.replace(/_/g,' ');return option;
  });
  select.replaceChildren(...options);select.value=value;Dropdowns.sync('timezone-select');
}
window.setTimeZoneChoices=names=>{
  const signature=JSON.stringify(names);if(signature===timezoneChoicesSignature)return;timezoneChoicesSignature=signature;
  timezoneNames=names.filter(name=>{try{new Intl.DateTimeFormat('en',{timeZone:name});return true;}catch{return false;}});
  renderTimeZoneOptions();
};
window.setInterfaceTimeZone=value=>{
  try{
    if(I.setTimeZone(value)){renderSignatures.clear();calendarLayout='';historySignature='';}
    $('timezone-select').value=value;Dropdowns.sync('timezone-select');return true;
  }catch{window.toast(t('settings.timezone_unavailable'));return false;}
};
$('timezone-select').addEventListener('change',event=>send('timezone',{timezone:event.target.value}));
$('language-select').addEventListener('change',event=>send('language',{language:event.target.value}));
$('theme-select').addEventListener('change',event=>send('theme',{theme:event.target.value}));
const K=ClickPulseKeyboard;
const onWindows=window.clickpulsePlatform==='windows',onLinux=window.clickpulsePlatform==='linux';
const keyboardCells=new Map();
let keyboardLayoutSignature='';
let keyboardView='layout',keyboardDistribution=null;
const keyboardBlocks=new Map();
function updateKeyboardView(){
  const blocks=keyboardView==='treemap';
  $('keyboard-layout').parentElement.hidden=blocks;
  $('keyboard-treemap').hidden=!blocks;
  $('keyboard-view-toggle').setAttribute('aria-pressed',String(blocks));
  $('keyboard-blocks-icon').hidden=blocks;$('keyboard-layout-icon').hidden=!blocks;
  for(const [id,key]of [['keyboard-view-label',blocks?'keys.show_layout':'keys.show_treemap'],['keyboard-description',blocks?'keys.treemap_description':'keys.description']]){
    $(id).dataset.i18n=key;$(id).textContent=t(key);
  }
}
$('keyboard-view-toggle').addEventListener('click',()=>{
  keyboardView=keyboardView==='layout'?'treemap':'layout';updateKeyboardView();
  if(data)renderKeyboard();
});
if(typeof ResizeObserver==='function')new ResizeObserver(()=>{
  if(page==='keys'&&keyboardView==='treemap'&&!window.presentationView?.compact&&keyboardDistribution)renderKeyboardTreemap(keyboardDistribution);
}).observe($('keyboard-treemap'));
const renderSignatures=new Map();
window.setInterfaceTheme=name=>{
  const next=T.get(name).name;$('theme-select').value=next;Dropdowns.sync('theme-select');
  if(next===currentTheme)return;
  currentTheme=next;T.apply(document.documentElement,currentTheme);
  renderSignatures.clear();historySignature='';
};
function renderChanged(name,values,render){
  const signature=JSON.stringify([I.locale,currentTheme,values]);
  if(renderSignatures.get(name)===signature)return;
  render();renderSignatures.set(name,signature);
}
const settingsLinks=[...document.querySelectorAll('[data-settings-section]')];
let settingsSection='personalization-settings';
function syncSettingsNavigation(){
  $('settings-subnav').hidden=page!=='settings';
  $('settings-nav').setAttribute('aria-expanded',String(page==='settings'));
  for(const link of settingsLinks)link.hidden=$(link.dataset.settingsSection).hidden;
  if(!settingsLinks.some(link=>!link.hidden&&link.dataset.settingsSection===settingsSection))
    settingsSection=settingsLinks.find(link=>!link.hidden)?.dataset.settingsSection;
  for(const link of settingsLinks){
    const active=link.dataset.settingsSection===settingsSection;
    link.classList.toggle('current-section',active);
    link.setAttribute('aria-current',active?'location':'false');
  }
}
for(const link of settingsLinks)link.addEventListener('click',()=>{
  const target=$(link.dataset.settingsSection);
  if(page!=='settings'||target.hidden)return;
  Dropdowns.closeAll();settingsSection=link.dataset.settingsSection;syncSettingsNavigation();
  target.focus({preventScroll:true});
  target.scrollIntoView({block:'start',behavior:window.matchMedia?.('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});
});
document.querySelectorAll('nav button[data-page]').forEach(button=>button.addEventListener('click',()=>{
  Dropdowns.closeAll();
  page=button.dataset.page;
  document.querySelectorAll('nav button[data-page]').forEach(b=>b.classList.toggle('selected',b===button));
  document.querySelectorAll('.page').forEach(el=>el.hidden=el.id!==page);
  updateHeading();syncSettingsNavigation();
  document.querySelector('main').scrollTop=0;
  window.updateSportActivity();
  if(page==='leaderboard')requestLeaderboard(false);
  if(data)window.receive(data);
}));
document.querySelectorAll('[data-range]').forEach(button=>button.addEventListener('click',()=>{
  range=Number(button.dataset.range);document.querySelectorAll('[data-range]').forEach(b=>b.classList.toggle('selected',b===button));if(data)renderTrend($('trend-chart'),data.days.slice(-range));
}));
$('pause').addEventListener('click',()=>send('pause'));
for(const id of ['permission','settings-permission'])$(id).addEventListener('click',()=>send('permission'));
$('storage-directory').addEventListener('click',()=>send('storage_directory'));
$('import-history').addEventListener('click',()=>send('import_history'));
$('reveal').addEventListener('click',()=>send('reveal'));
$('calendar-range-select').addEventListener('change',event=>{calendarRange=event.target.value;if(data)renderCalendar()});
$('history-range-select').addEventListener('change',event=>{historyRange=event.target.value;historyPage=0;if(data)renderHistory()});
$('history-prev').addEventListener('click',()=>{historyPage--;if(data)renderHistory()});
$('history-next').addEventListener('click',()=>{historyPage++;if(data)renderHistory()});
window.toast=(message,duration=4500)=>{$('toast').textContent=message;$('toast').hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').hidden=true,duration)};
window.failure=message=>{
  sportView?.receive({available:false});
  $('error-banner').hidden=false;$('error-banner').textContent=message;$('status').className='status error';$('status').lastElementChild.textContent=t('status.unavailable');
  const failed=snapshot=>({...snapshot,capture:{...snapshot.capture,listening:false,error:message,error_code:'error.stats'}});
  if(data)data=failed(data);
  if(miniData)miniData=failed(miniData);
  const current=window.presentationView?.compact?(miniData||data):data;
  if(current){
    window.presentationStats?.(current);
  }else{
    $('mini-status').textContent=t('status.unavailable');$('mini-status').classList.toggle('error',true);
  }
};
window.receiveMini=snapshot=>{
  if(!window.presentationView?.compact||snapshot.timezone!==(window.presentationView?.timezone||'system'))return;
  miniData=recordingPaused===null?snapshot:{...snapshot,paused:recordingPaused};
  window.presentationStats?.(miniData);
};
window.renderMiniSnapshot=()=>{
  if(miniData&&miniData.timezone===(window.presentationView?.timezone||'system'))window.presentationStats?.(miniData);
};
window.receive=snapshot=>{
  if(snapshot.timezone && snapshot.timezone!==(window.presentationView?.timezone||'system'))return;
  if(!window.setInterfaceTimeZone(snapshot.timezone||window.presentationView?.timezone||'system'))return;
  data=recordingPaused===null?snapshot:{...snapshot,paused:recordingPaused};
  window.presentationStats?.(data);
  if(window.presentationView?.compact){miniData={...data,timezone:data.timezone||'system'};return;}
  const now=new Date(data.now);$('date').textContent=I.date(now,{year:'numeric',month:'long',day:'numeric',weekday:'long'});
  const demo=!!data.demo;$('demo-badge').hidden=!demo;
  renderRecordingState();
  renderPermission();
  $('error-banner').hidden=!data.capture.error;
  if(data.capture.error)$('error-banner').textContent=t(data.capture.error_code||'error.recording');
  if(page==='settings')renderSettings();
  if(page==='overview'){
    for(const key of ['today','week','lifetime']){setSelectableText($(key),n(total(data[key])));setSelectableText($(key+'-detail'),`${t('common.keyboard')} ${n(data[key].keyboard)} / ${t('common.mouse')} ${n(data[key].mouse)}`);}
    $('legacy-note').textContent=t(data.source_mode?'metric.readonly':data.legacy_imported?'metric.imported':'metric.all');
    renderChanged('windows',data.windows,()=>$('windows').replaceChildren(...data.windows.map(w=>{
      const node=document.createElement('div');node.className='window';const count=document.createElement('strong'),label=document.createElement('span');count.textContent=(w.approximate?'≈ ':'')+n(total(w.counts));label.textContent=t('window.'+w.seconds);node.append(count,label);return node;
    })));
    renderChanged('hourly',data.hourly||[],()=>renderHourly(data.hourly||[]));
    renderChanged('trend',[range,data.days.slice(-range)],()=>renderTrend($('trend-chart'),data.days.slice(-range)));
    renderChanged('donut',data.lifetime,()=>renderDonut(data.lifetime));
    updateRangeOptions($('calendar-range-select'),true);calendarRange=$('calendar-range-select').value;
    renderChanged('calendar',[data.now.split('T')[0],calendarRange,data.history_days],renderCalendar);
  }else if(page==='history'){
    updateRangeOptions($('history-range-select'),false);historyRange=$('history-range-select').value;
    renderHistory();
  }else if(page==='keys'){
    renderChanged('keyboard',data.keyboard_stats||data.top_keys,renderKeyboard);
  }
};
function renderPermission(){
  if(onLinux)$('permission-reset').hidden=true;
  $('permission-banner').hidden=!data.capture.permission_needed;
  const needsMacUpdatePermission=updatedThisLaunch&&!onWindows&&!onLinux;
  $('permission-title').hidden=needsMacUpdatePermission;$('permission-updated-title').hidden=!needsMacUpdatePermission;
}
function renderRecordingState(){
  const demo=!!data.demo;
  const state=demo?'':data.capture.error?'error':data.paused?'paused':data.source_mode||data.capture.listening?'':'error';
  $('status').className='status '+state;$('status').lastElementChild.textContent=t(demo?'status.demo':data.capture.error?(data.source_mode?'status.read_error':'status.recording_error'):data.paused?'status.paused':data.source_mode?'status.updating':data.capture.listening?'status.recording':'status.permission');
  $('pause').textContent=t(data.source_mode?(data.paused?'action.resume_refresh':'action.pause_refresh'):(data.paused?'action.resume':'action.pause'));
}
function renderSettings(){
  $('permission-description').textContent=t(onLinux?(data.capture.listening&&!data.capture.permission_needed?'settings.authorized':'settings.permission_description'):onWindows?(data.capture.listening?'settings.windows_capture':'status.unavailable'):data.source_mode && !data.setup_pending?'settings.source_permission':data.capture.listening?'settings.authorized':'settings.permission_description');
  $('permission-row').hidden=onWindows || (!!data.source_mode && !data.setup_pending);
  $('permission-reset-settings').hidden=onLinux || $('permission-row').hidden || data.capture.listening;
  $('capture-settings').hidden=onWindows || (!!data.source_mode && !data.setup_pending);
  $('handoff-settings').hidden=!data.setup_pending;
  $('takeover').disabled=dataOperationBusy || !data.capture.listening || data.capture.permission_needed;
  $('handoff-description').textContent=t(data.capture.listening?'settings.takeover_ready':'settings.takeover_wait');
  $('autostart-row').hidden=data.auto_start_available!==true;
  $('autostart').checked=data.auto_start===true;
  setSelectableText($('db-path'),data.demo?t('demo.storage'):data.database_path);
  const storageMode=data.demo?'demo':data.database_mode||'custom';
  const storageDescriptions={default:'settings.storage_default',custom:'settings.storage_custom',source:'settings.storage_source',demo:'settings.storage_demo'};
  $('db-description').textContent=t(storageMode==='default'?'storage.directory_description':storageDescriptions[storageMode]||storageDescriptions.custom);
  $('storage-directory').hidden=storageMode!=='default';
  $('import-history-row').hidden=storageMode!=='default';
  $('reveal').disabled=!!data.demo||dataOperationBusy;
  syncSettingsNavigation();
}
const svgNode=(tag,attrs={})=>{const node=document.createElementNS('http://www.w3.org/2000/svg',tag);for(const[key,value]of Object.entries(attrs))node.setAttribute(key,String(value));return node};
const svgText=(text,x,y,attrs={})=>{const el=svgNode('text',{x,y,...attrs});el.textContent=text;return el};
let hourlyNodes=null;
function renderHourly(hours){
  const container=$('hourly-chart'),keys=hours.map((h,i)=>i?h.start_ms:h.end_ms-3600000).join(','),
    counts=hours.reduce((sum,h)=>({keyboard:sum.keyboard+h.counts.keyboard,mouse:sum.mouse+h.counts.mouse}),{keyboard:0,mouse:0}),
    approximate=hours.some(h=>h.approximate),{ceiling,ticks}=H.countScale(Math.max(0,...hours.map(h=>total(h.counts))));
  const formatRange=h=>I.date(h.start_ms,{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit',hourCycle:'h23',timeZoneName:'short'})+' — '+I.date(h.end_ms,{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit',hourCycle:'h23',timeZoneName:'short'});
  const description=h=>t('chart.tooltip',{period:formatRange(h),keyboard:(h.approximate?'≈ ':'')+n(h.counts.keyboard),mouse:(h.approximate?'≈ ':'')+n(h.counts.mouse)});
  setSelectableText($('hourly-total'),(approximate?'≈ ':'')+n(total(counts)));
  $('hourly-total').setAttribute('aria-label',t('chart.hourly_total',{count:(approximate?'≈ ':'')+n(total(counts))}));
  setSelectableText($('hourly-range'),hours.length?formatRange({start_ms:hours[0].start_ms,end_ms:hours[hours.length-1].end_ms}):'');
  if(!hourlyNodes||hourlyNodes.keys!==keys){
    const focused=document.activeElement?.dataset.hour;
    const plot=document.createElement('div'),yAxis=document.createElement('div'),xAxis=document.createElement('div'),empty=document.createElement('div');
    plot.className='hourly-plot';yAxis.className='trend-y-axis';xAxis.className='trend-x-axis';empty.className='empty-label';
    const slots=hours.map((h,i)=>{
      const node=document.createElement('div'),keyboard=document.createElement('span'),mouse=document.createElement('span');
      node.className='hourly-slot';node.tabIndex=0;node.dataset.hour=String(i?h.start_ms:h.end_ms-3600000);node.setAttribute('role','img');
      keyboard.className='hourly-keyboard';mouse.className='hourly-mouse';node.append(keyboard,mouse);
      for(const event of ['mouseenter','focus'])node.addEventListener(event,()=>{hourlyNodes.active=node.dataset.hour;updateHourlyDetail();});
      node.addEventListener('keydown',event=>{
        const direction=event.key==='ArrowRight'?1:event.key==='ArrowLeft'?-1:0;
        const next=event.key==='Home'?0:event.key==='End'?hours.length-1:Math.max(0,Math.min(hours.length-1,i+direction));
        if(direction||event.key==='Home'||event.key==='End'){event.preventDefault();hourlyNodes.slots[next].node.focus();}
      });
      plot.append(node);return {node,keyboard,mouse};
    });
    plot.addEventListener('mouseleave',()=>{if(!slots.some(slot=>slot.node===document.activeElement)){hourlyNodes.active=null;updateHourlyDetail();}});
    container.replaceChildren(plot,yAxis,xAxis,empty);hourlyNodes={keys,plot,yAxis,xAxis,empty,slots,active:focused};
    slots.find(slot=>slot.node.dataset.hour===focused)?.node.focus();
  }
  const chart=hourlyNodes;
  chart.hours=hours;chart.description=description;
  container.style.setProperty('--trend-gutter',Math.max(56,...ticks.map(value=>n(value).length*6+12))+'px');
  chart.plot.style.gridTemplateColumns=`repeat(${Math.max(1,hours.length)},minmax(0,1fr))`;
  chart.yAxis.replaceChildren(...ticks.map(value=>{
    const label=document.createElement('span');label.textContent=n(value);label.style.top=(1-value/ceiling)*100+'%';return label;
  }));
  chart.plot.style.setProperty('--hourly-grid-step',100/(ticks.length-1)+'%');
  chart.slots.forEach(({node,keyboard,mouse},i)=>{
    const h=hours[i];node.setAttribute('aria-label',description(h));
    keyboard.style.height=h.counts.keyboard/ceiling*100+'%';mouse.style.height=h.counts.mouse/ceiling*100+'%';
    node.classList.toggle('partial',h.end_ms-h.start_ms<3600000);
  });
  chart.xAxis.replaceChildren(...H.trendLabelIndices(hours.length).map(i=>{
    const h=hours[i],label=document.createElement('span'),time=document.createElement('span'),date=document.createElement('small');
    label.className='trend-date';label.style.left=(i+.5)/hours.length*100+'%';
    time.textContent=I.date(h.start_ms,{hour:'2-digit',minute:'2-digit',hourCycle:'h23'});date.textContent=I.date(h.start_ms,{month:'short',day:'numeric'});label.append(time,date);return label;
  }));
  chart.empty.hidden=hours.some(h=>total(h.counts)>0);chart.empty.textContent=t('common.empty');
  chart.defaultDescription=t('chart.hourly_hint');updateHourlyDetail();
}
function updateHourlyDetail(){
  if(!hourlyNodes?.hours)return;
  const chart=hourlyNodes,index=chart.slots.findIndex(slot=>slot.node.dataset.hour===chart.active);
  chart.slots.forEach((slot,i)=>{slot.node.classList.toggle('active',i===index);slot.node.tabIndex=i===(index>=0?index:chart.slots.length-1)?0:-1;});
  setSelectableText($('hourly-detail'),index>=0?chart.description(chart.hours[index]):chart.defaultDescription);
}
function renderTrend(container,days){
  const svg=svgNode('svg',{viewBox:'0 0 600 132',preserveAspectRatio:'none',class:'trend-plot',role:'img','aria-label':t('chart.aria')});
  const {ceiling,ticks}=H.countScale(Math.max(0,...days.map(d=>total(d.counts))));
  const yAxis=document.createElement('div'),xAxis=document.createElement('div');
  yAxis.className='trend-y-axis';xAxis.className='trend-x-axis';
  container.style.setProperty('--trend-gutter',Math.max(56,...ticks.map(value=>n(value).length*6+12))+'px');
  for(const value of ticks){
    const fraction=1-value/ceiling,y=fraction*132;
    svg.append(svgNode('line',{x1:0,x2:600,y1:y,y2:y,stroke:'var(--line)','stroke-width':1,'vector-effect':'non-scaling-stroke'}));
    const label=document.createElement('span');label.textContent=n(value);label.style.top=fraction*100+'%';yAxis.append(label);
  }
  const width=600/Math.max(1,days.length),barWidth=Math.min(26,width*.6),palette=T.get(currentTheme);
  days.forEach((d,i)=>{const x=i*width+(width-barWidth)/2,kh=d.counts.keyboard/ceiling*132,mh=d.counts.mouse/ceiling*132;
    const period=d.start?I.day(d.start)+' — '+I.day(d.end):I.day(d.day);
    for(const[color,y,height]of [[palette.accent,132-kh,kh],[palette.mouse,132-kh-mh,mh]]){const bar=svgNode('rect',{x,y,width:barWidth,height,rx:1.4,fill:color});const title=svgNode('title');title.textContent=t('chart.tooltip',{period,keyboard:n(d.counts.keyboard),mouse:n(d.counts.mouse)});bar.append(title);svg.append(bar)}
  });
  const multipleYears=new Set(days.map(d=>(d.start||d.day).slice(0,4))).size>1;
  for(const i of H.trendLabelIndices(days.length)){
    const d=days[i],date=d.start||d.day,monthly=d.grouping==='month',label=document.createElement('span');
    label.className='trend-date'+(days.length>1&&i===0?' first':days.length>1&&i===days.length-1?' last':'');
    label.style.left=(i+.5)/days.length*100+'%';
    const primary=document.createElement('span');primary.textContent=I.day(date,monthly?{month:'short'}:{month:'short',day:'numeric'});label.append(primary);
    if(monthly||multipleYears){const year=document.createElement('small');year.textContent=I.day(date,{year:'numeric'});label.append(year)}
    xAxis.append(label);
  }
  container.replaceChildren(svg,yAxis,xAxis);
  if(!days.some(d=>total(d.counts)>0)){const label=document.createElement('div');label.className='empty-label';label.textContent=t('common.empty');container.append(label)}
}
function renderDonut(counts){
  const all=total(counts),ratio=all?counts.keyboard/all:0,circ=2*Math.PI*51,svg=svgNode('svg',{viewBox:'0 0 170 170',role:'img','aria-label':t('chart.mix_aria',{keyboard:I.percent(ratio,0),mouse:I.percent(1-ratio,0)})});
  const palette=T.get(currentTheme);
  svg.append(svgNode('circle',{cx:85,cy:85,r:51,fill:'none',stroke:all?palette.mouse:'#e9eff9','stroke-width':13}));
  if(all)svg.append(svgNode('circle',{cx:85,cy:85,r:51,fill:'none',stroke:palette.accent,'stroke-width':13,'stroke-dasharray':`${ratio*circ} ${circ}` ,transform:'rotate(-90 85 85)'}));
  svg.append(svgText(all?I.percent(ratio,0):'—',85,85,{'text-anchor':'middle',style:'font-size:26px;fill:var(--accent-strong);letter-spacing:-1px'}),svgText(t('chart.keyboard_share'),85,106,{'text-anchor':'middle',style:'font-size:10px;fill:#7c94b5'}));
  $('donut').replaceChildren(svg);$('composition-legend').replaceChildren(...[[t('common.keyboard'),counts.keyboard,'keyboard-dot'],[t('common.mouse'),counts.mouse,'mouse-dot']].map(([label,value,cls])=>{const node=document.createElement('div'),count=document.createElement('strong'),dot=document.createElement('i');count.textContent=n(value);dot.className=cls;dot.style.marginLeft='0';node.append(count,dot,' '+label);return node}));
}
function updateRangeOptions(select,includeRecent){
  const options=[['all',t('common.all_history')],...H.years(data.history_days).map(year=>[year,t('common.year',{year})])];
  if(includeRecent)options.push(['90',t('common.recent90')]);
  const signature=I.locale+':'+options.map(option=>option[0]).join(',');
  if(select.dataset.options===signature)return;
  const selected=select.value;
  select.replaceChildren(...options.map(([value,label])=>{const option=document.createElement('option');option.value=value;option.textContent=label;return option}));
  select.value=options.some(option=>option[0]===selected)?selected:'all';select.dataset.options=signature;
  Dropdowns.sync(select);
}
function renderCalendar(){
  const today=data.now.split('T')[0],bounds=H.bounds(data.history_days,today,calendarRange);
  const days=H.calendarDays(data.history_days,bounds.start,bounds.end);
  const sections=H.sections(days),layout=I.locale+':'+calendarRange+':'+bounds.start+':'+bounds.end;
  if(calendarLayout!==layout){
    calendarCells=new Map();
    $('heatmap').replaceChildren(...sections.map(section=>{
      const block=document.createElement('div');block.className='calendar-year';
      const label=document.createElement('div');label.className='calendar-year-label';
      const year=document.createElement('strong');year.textContent=t('common.year',{year:section.year});
      const period=document.createElement('span');period.textContent=I.day(section.days[0].day,{month:'short',day:'numeric'})+' — '+I.day(section.days[section.days.length-1].day,{month:'short',day:'numeric'});label.append(year,period);
      const months=document.createElement('div');months.className='calendar-months';
      const body=document.createElement('div');body.className='calendar-body';
      const weekdays=document.createElement('div');weekdays.className='calendar-weekdays';
      for(const text of I.weekdays().map((day,index)=>index%2===0?day:'')){const el=document.createElement('span');el.textContent=text;weekdays.append(el)}
      const grid=document.createElement('div');grid.className='heatmap';
      const first=section.days[0].day,padding=H.weekday(first);
      for(let i=0;i<padding;i++){const cell=document.createElement('div');cell.className='heat-cell blank';grid.append(cell)}
      let previousMonth='';
      for(const d of section.days){
        const month=d.day.slice(5,7);
        if(month!==previousMonth){const el=document.createElement('span');el.textContent=I.month(month);el.style.left=Math.floor((H.difference(first,d.day)+padding)/7)*15+'px';months.append(el);previousMonth=month}
        const cell=document.createElement('div');cell.dataset.day=d.day;grid.append(cell);calendarCells.set(d.day,cell);
      }
      body.append(weekdays,grid);block.append(label,months,body);return block;
    }));
    calendarLayout=layout;
  }
  const max=Math.max(1,...days.map(d=>total(d.counts)));
  for(const d of days){const cell=calendarCells.get(d.day),value=total(d.counts),level=value?Math.max(1,Math.ceil(value/max*4)):0;cell.className='heat-cell level-'+level+(d.day===today?' today':'');cell.title=t('calendar.tooltip',{day:d.day,count:n(value),keyboard:n(d.counts.keyboard),mouse:n(d.counts.mouse)});}
  $('active-days').textContent=t('calendar.recorded',{count:n(days.filter(d=>total(d.counts)>0).length)});
  const comparison=H.bookComparison(days.reduce((sum,d)=>sum+d.counts.keyboard,0)),aside=$('calendar-aside');
  aside.hidden=!comparison;
  if(comparison){
    const book=t('calendar.book_title');
    aside.textContent=comparison.opening?t('calendar.literary_opening'):t(comparison.copies===1?'calendar.literary_one':'calendar.literary',{count:n(comparison.copies),book});
    aside.title=t('calendar.literary_basis',{book,characters:n(comparison.characters)});
  }else{aside.textContent='';aside.title='';}
  $('calendar-range').textContent=t('calendar.period',{start:I.day(bounds.start),end:I.day(bounds.end),count:n(days.reduce((sum,d)=>sum+total(d.counts),0))});
}
function renderHistory(){
  const today=data.now.split('T')[0],records=H.recordedInRange(data.history_days,today,historyRange),bounds=H.bounds(data.history_days,today,historyRange);
  const pagination=H.paginate(records,historyPage);historyPage=pagination.page;
  const signature=I.locale+':'+currentTheme+':'+historyRange+':'+historyPage+':'+today+':'+JSON.stringify(records);
  if(signature===historySignature)return;
  historySignature=signature;
  const days=H.calendarDays(records,bounds.start,bounds.end),trend=H.trend(days);
  const granularity=t(days.length>370?'history.monthly':days.length>90?'history.weekly':'history.daily');
  $('history-range').textContent=t('history.range',{start:I.day(bounds.start),end:I.day(bounds.end),grouping:granularity});
  const keyboard=records.reduce((sum,d)=>sum+d.counts.keyboard,0),mouse=records.reduce((sum,d)=>sum+d.counts.mouse,0);
  $('history-summary').textContent=t('history.summary',{days:n(pagination.total),count:n(keyboard+mouse),keyboard:n(keyboard),mouse:n(mouse)});
  renderTrend($('history-chart'),trend);
  $('history-table').replaceChildren(...pagination.rows.map(d=>{
    const tr=document.createElement('tr');for(const value of [I.day(d.day),n(d.counts.keyboard),n(d.counts.mouse),n(total(d.counts))]){const td=document.createElement('td');td.textContent=value;tr.append(td)}return tr;
  }));
  $('history-prev').disabled=historyPage===0;$('history-next').disabled=historyPage+1>=pagination.pages;
  $('history-page-info').textContent=pagination.total?t('history.pagination',{start:n(historyPage*30+1),end:n(Math.min((historyPage+1)*30,pagination.total)),count:n(pagination.total),page:n(historyPage+1),pages:n(pagination.pages)}):t('common.empty_history');
}
function renderKeyboard(){
  const stats=data.keyboard_stats||{physical:data.top_keys};
  const view=K.distribution(stats);
  keyboardDistribution=view;updateKeyboardView();
  $('keyboard-coverage').textContent=t('keys.coverage',{count:n(view.visibleRanked.length)});
  if(keyboardView==='treemap'){
    renderKeyboardTreemap(view);return;
  }
  const max=Math.max(1,...view.visibleRanked.map(k=>k.count));
  const signature=JSON.stringify(view.rows.map(row=>row.map(key=>key.id)));
  if(keyboardLayoutSignature!==signature){
    keyboardCells.clear();keyboardLayoutSignature=signature;
    $('keyboard-layout').replaceChildren(...view.rows.map((row,index)=>{
      const arrowIds=['up','left','down','right'],arrows=row.filter(key=>arrowIds.includes(key.id));
      const node=document.createElement('div');node.className='keyboard-row'+(index===0?' function-row':row.some(key=>key.supplemental)?' supplemental-row':arrows.length?' modifier-row':'');
      function createCell(key){
        const cell=document.createElement('div');cell.className='keyboard-key';cell.style.setProperty('--key-width',key.width);cell.dataset.key=key.id;cell.tabIndex=0;cell.setAttribute('role','img');
        const label=document.createElement('span');label.className='key-label';label.textContent=key.label;
        const count=document.createElement('span');count.className='key-count';cell.append(label,count);
        keyboardCells.set(key.id,cell);return cell;
      }
      let arrowCluster=null;
      for(const key of row){
        if(arrowIds.includes(key.id)){
          if(!arrowCluster){
            arrowCluster=document.createElement('div');arrowCluster.className='keyboard-arrow-cluster';
            for(const id of arrowIds){const arrow=arrows.find(item=>item.id===id);if(arrow)arrowCluster.append(createCell(arrow));}
            node.append(arrowCluster);
          }
        }else node.append(createCell(key));
      }
      return node;
    }));
  }
  for(const key of view.rows.flat()){
    const cell=keyboardCells.get(key.id),hex=keyColor(key.count,max);
    cell.style.setProperty('--key-bg',hex);cell.style.setProperty('--key-text',T.textFor(hex));
    const label=key.label;
    cell.firstElementChild.textContent=label;
    cell.lastElementChild.textContent=K.compact(key.count);
    const detail=t('keys.tooltip',{key:label,count:n(key.count),percent:I.percent(view.total?key.count/view.total:0)});
    cell.title=detail;cell.setAttribute('aria-label',detail);
  }
}
function keyColor(count,max){
  const intensity=count?Math.pow(Math.log1p(count)/Math.log1p(max),3):0;
  const palette=T.get(currentTheme),from=T.rgb(palette.empty),to=T.rgb(palette.full);
  return '#'+from.map((value,i)=>Math.round(value+(to[i]-value)*intensity).toString(16).padStart(2,'0')).join('');
}
function renderKeyboardTreemap(view){
  const container=$('keyboard-treemap'),width=container.clientWidth||640,height=container.clientHeight||279;
  const keys=view.visibleRanked,sum=keys.reduce((sum,key)=>sum+key.count,0),max=Math.max(1,...keys.map(key=>key.count));
  const signature=JSON.stringify(keys.map(key=>key.id).sort());
  if(container.dataset.keys!==signature){
    const active=new Set(keys.map(key=>key.id));
    for(const id of keyboardBlocks.keys())if(!active.has(id))keyboardBlocks.delete(id);
    container.dataset.keys=signature;
    container.replaceChildren(...keys.map(key=>{
      if(keyboardBlocks.has(key.id))return keyboardBlocks.get(key.id);
      const cell=document.createElement('div');cell.className='keyboard-block';cell.dataset.key=key.id;cell.tabIndex=0;cell.setAttribute('role','img');
      const surface=document.createElement('span');surface.className='keyboard-block-surface';
      const label=document.createElement('span');label.className='keyboard-block-label';label.textContent=key.label;surface.append(label);cell.append(surface);
      keyboardBlocks.set(key.id,cell);return cell;
    }));
    if(!keys.length){const empty=document.createElement('div');empty.className='empty-label';container.append(empty);}
  }
  if(!keys.length)container.firstElementChild.textContent=t('common.empty');
  for(const key of K.treemap(keys,width,height)){
    const cell=keyboardBlocks.get(key.id),color=keyColor(key.count,max);
    for(const [name,value]of [['left',key.x/width],['top',key.y/height],['width',key.w/width],['height',key.h/height]])cell.style[name]=value*100+'%';
    cell.style.setProperty('--block-gap',Math.min(.75,key.w*.1,key.h*.1)+'px');
    cell.style.setProperty('--block-font',Math.min(24,Math.max(11,Math.min(key.w,key.h)/4))+'px');
    cell.style.setProperty('--key-bg',color);cell.style.setProperty('--key-text',T.textFor(color));
    cell.firstElementChild.firstElementChild.hidden=key.w<Math.max(28,key.label.length*8+8)||key.h<18;
    const detail=t('keys.tooltip',{key:key.label,count:n(key.count),percent:I.percent(sum?key.count/sum:0)});
    cell.title=detail;cell.setAttribute('aria-label',detail);
  }
}
send('ready');

$('takeover').addEventListener('click',()=>send('takeover'));
$('autostart')?.addEventListener('change',event=>{
  const enabled=event.target.checked;
  event.target.checked=data.auto_start===true;
  send('autostart',{enabled});
});
