const hudTooltip=(()=>{
  const tip=$('hud-tooltip');
  if(!tip||typeof tip.querySelector!=='function'||typeof document.addEventListener!=='function')return {show(){},hide(){},sync(){}};
  const label=tip.querySelector('.hud-tooltip-label'),body=tip.querySelector('.hud-tooltip-body');
  let anchor=null,visible=false,timer=0;
  const split=text=>{const i=text.indexOf(' · ');return i<0?['',text]:[text.slice(0,i),text.slice(i+3)]};
  const position=()=>{
    const r=anchor.getBoundingClientRect(),tw=tip.offsetWidth,th=tip.offsetHeight,gap=9,margin=8;
    let x=r.left+r.width/2-tw/2,y=r.top-gap-th,p='top';
    if(y<margin){y=r.bottom+gap;p='bottom'}
    x=Math.max(margin,Math.min(x,window.innerWidth-tw-margin));
    tip.style.left=x+'px';tip.style.top=y+'px';tip.dataset.placement=p;
  };
  const show=el=>{
    const text=el.dataset.tooltip||'';
    const [head,rest]=split(text);
    label.textContent=head;label.style.display=head?'':'none';
    body.textContent=rest;
    anchor=el;position();
    if(!visible){tip.classList.toggle('is-visible',true);tip.setAttribute('aria-hidden','false')}
    visible=true;
  };
  const hide=()=>{
    if(timer){clearTimeout(timer);timer=0}
    tip.classList.toggle('is-visible',false);tip.setAttribute('aria-hidden','true');
    visible=false;anchor=null;
  };
  document.addEventListener('pointerover',e=>{
    const el=e.target.closest?.('[data-tooltip]');
    if(!el){hide();return}
    if(el===anchor&&visible)return;
    if(timer)clearTimeout(timer);
    timer=setTimeout(()=>{timer=0;show(el)},60);
  },{passive:true});
  document.addEventListener('pointerout',e=>{
    const next=e.relatedTarget?.closest?.('[data-tooltip]');
    if(next&&next!==anchor){if(timer)clearTimeout(timer);show(next);return}
    hide();
  },{passive:true});
  document.addEventListener('focusin',e=>{
    const el=e.target.closest?.('[data-tooltip]');
    if(el){if(timer)clearTimeout(timer);show(el)}
  });
  document.addEventListener('focusout',e=>{if(!e.relatedTarget?.closest?.('[data-tooltip]'))hide()});
  window.addEventListener('scroll',hide,{passive:true,capture:true});
  window.addEventListener('resize',hide,{passive:true});
  return {show,hide,sync:()=>{if(visible&&anchor)show(anchor)}};
})();
