(() => {
  'use strict';
  const card=document.querySelector('.install-card');
  if(!card) return;

  const toggle=card.querySelector('#install-toggle');
  const details=card.querySelector('#install-details');
  const toggleText=card.querySelector('.install-toggle-text');
  const tabs=[...card.querySelectorAll('.install-platform')];
  const views=[...card.querySelectorAll('[data-platform-view]')];
  const dots=[...card.querySelectorAll('.install-progress span')];
  const installedNote=document.querySelector('#installed-note');
  const installNow=document.querySelector('#android-install-now');

  let platform='ios',step=0,timer=null,deferredPrompt=null,expanded=false;

  function standalone(){
    return window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone===true;
  }

  function render(){
    card.dataset.platform=platform;
    card.dataset.step=String(step);
    tabs.forEach(tab=>{
      const on=tab.dataset.platform===platform;
      tab.classList.toggle('active',on);
      tab.setAttribute('aria-selected',String(on));
    });
    views.forEach(view=>view.classList.toggle('hidden',view.dataset.platformView!==platform));
    card.querySelectorAll('.install-step').forEach(btn=>{
      const active=btn.closest('[data-steps]')?.dataset.steps===platform && Number(btn.dataset.step)===step;
      btn.classList.toggle('active',active);
    });
    dots.forEach((dot,i)=>dot.classList.toggle('active',i===step));
    installedNote?.classList.toggle('hidden',!standalone());
  }

  function restart(){
    clearInterval(timer);
    if(!expanded) return;
    if(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    timer=setInterval(()=>{step=(step+1)%4;render();},3200);
  }

  function setExpanded(next){
    expanded=Boolean(next);
    if(details) details.hidden=!expanded;
    if(toggle){
      toggle.setAttribute('aria-expanded',String(expanded));
      toggle.setAttribute('aria-label',expanded?'Installationsanleitung einklappen':'Installationsanleitung aufklappen');
    }
    if(toggleText) toggleText.textContent=expanded?'Anleitung schließen':'Anleitung anzeigen';
    card.classList.toggle('install-collapsed',!expanded);

    if(expanded){
      render();
      restart();
    }else{
      clearInterval(timer);
    }
  }

  function setPlatform(next){
    platform=next==='android'?'android':'ios';
    step=0;
    render();
    restart();
  }

  toggle?.addEventListener('click',()=>setExpanded(!expanded));

  tabs.forEach(tab=>tab.addEventListener('click',()=>{
    setPlatform(tab.dataset.platform);
  }));

  card.querySelectorAll('.install-step').forEach(btn=>btn.addEventListener('click',()=>{
    platform=btn.closest('[data-steps]').dataset.steps;
    step=Math.max(0,Math.min(3,Number(btn.dataset.step)||0));
    render();
    restart();
  }));

  window.addEventListener('beforeinstallprompt',event=>{
    event.preventDefault();
    deferredPrompt=event;
    if(installNow) installNow.classList.remove('hidden');
  });

  installNow?.addEventListener('click',async()=>{
    if(!deferredPrompt) return;
    deferredPrompt.prompt();
    try{await deferredPrompt.userChoice;}catch(_){}
    deferredPrompt=null;
    installNow.classList.add('hidden');
  });

  window.addEventListener('appinstalled',()=>{
    deferredPrompt=null;
    installNow?.classList.add('hidden');
    installedNote?.classList.remove('hidden');
  });

  const ua=navigator.userAgent||'';
  if(/Android/i.test(ua)) platform='android';
  else if(/iPhone|iPad|iPod/i.test(ua)) platform='ios';

  render();
  setExpanded(false);

  document.addEventListener('visibilitychange',()=>{
    if(document.hidden) clearInterval(timer);
    else restart();
  });
})();
