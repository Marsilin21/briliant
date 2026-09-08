(() => {
  const config=JSON.parse(document.getElementById('monolit-config').textContent);
  const track=(event,params)=>{if(window.ym&&config.analytics.enabled)window.ym(Number(config.analytics.metrikaId),'reachGoal',event,params);};
  let started=false;
  let selectedOffer=config.offer||'';
  document.addEventListener('click',event=>{
    const trigger=event.target.closest('a,button');if(!trigger)return;
    const card=trigger.closest('[data-offer]');
    if(card)selectedOffer=card.dataset.offer;
    else if(trigger.matches('a[href^="#popup:"],a[href^="#form"],a[href^="#rec"]'))selectedOffer=config.offer||'';
    const hash=trigger.getAttribute('href')||'';
    if(hash.startsWith('#popup:')||hash.startsWith('#form')||hash.startsWith('#rec'))document.querySelectorAll('[data-monolit-form]').forEach(f=>{f.dataset.selectedOffer=selectedOffer;});
  },true);
  const utm=Object.fromEntries(['utm_source','utm_medium','utm_campaign','utm_term','utm_content'].map(k=>[k,new URLSearchParams(location.search).get(k)||'']).filter(([,v])=>v));
  try{if(Object.keys(utm).length)sessionStorage.setItem('monolit_utm',JSON.stringify(utm));else Object.assign(utm,JSON.parse(sessionStorage.getItem('monolit_utm')||'{}'));}catch{}
  document.querySelectorAll('[data-monolit-form]').forEach(form=>{
    const submit=form.querySelector('[type="submit"],button');
    const status=form.querySelector('.monolit-form-status');let busy=false,requestId=crypto.randomUUID();
    form.addEventListener('focusin',()=>{if(!started){started=true;track('form_start');}});
    form.addEventListener('submit',async event=>{
      event.preventDefault();event.stopImmediatePropagation();if(busy)return;
      if(config.preview){status.textContent='Это просмотр черновика. Заявки здесь не отправляются.';return;}
      if(!form.reportValidity())return;
      busy=true;submit&&(submit.disabled=true);status.textContent='Отправляем…';
      const data=new FormData(form);
      try{
        const response=await fetch('/api/leads',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:data.get('Name')||'',phone:data.get('Phone')||'',comment:data.get('Comment')||'',website:data.get('website')||'',consent:true,source:location.pathname,offer:form.dataset.selectedOffer??config.offer??'',utm,requestId})});
        const body=await response.json();if(!response.ok)throw Error(body.error||'Не удалось отправить заявку');
        status.textContent='Спасибо! Ваша заявка принята.';form.reset();delete form.dataset.selectedOffer;selectedOffer=config.offer||'';requestId=crypto.randomUUID();track('lead_submit');
      }catch(error){status.textContent=error.message||'Нет связи с сервером. Повторите отправку.';}finally{busy=false;submit&&(submit.disabled=false);}
    },true);
  });
  // Make confirmed textual contact links usable without changing their appearance.
  document.querySelectorAll('a').forEach(a=>{const t=a.textContent.trim();if(/^\+?[\d\s()-]{10,24}$/.test(t)&&t.replace(/\D/g,'').length>=10)a.href='tel:+'+t.replace(/\D/g,'');else if(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(t))a.href='mailto:'+t;});
  document.addEventListener('click',e=>{const a=e.target.closest('a');if(!a)return;if(a.href.startsWith('tel:'))track('phone_click');if(/https:\/\/(t\.me|wa\.me|vk\.com)\//.test(a.href))track('messenger_click');},true);
  if(config.preview){const n=document.createElement('div');n.className='monolit-preview-note';n.textContent='Предпросмотр сохранённого черновика · приём заявок отключён';document.body.append(n);return;}
  if(!config.analytics.enabled)return;
  const enable=()=>{if(window.ym)return;window.ym=function(){(window.ym.a=window.ym.a||[]).push(arguments)};window.ym.l=Date.now();const s=document.createElement('script');s.src='https://mc.yandex.ru/metrika/tag.js';s.async=true;document.head.append(s);window.ym(Number(config.analytics.metrikaId),'init',{clickmap:true,trackLinks:true,accurateTrackBounce:true});};
  let preference;try{preference=localStorage.getItem('monolit_analytics');}catch{}
  if(preference==='yes'){enable();return;}if(preference==='no')return;
  const banner=document.createElement('aside');banner.className='monolit-cookie';banner.setAttribute('aria-label','Настройки аналитики');banner.innerHTML='<div>Разрешить Яндекс.Метрике собирать статистику посещений? Это помогает улучшать сайт.</div><button type="button" data-value="yes">Разрешить</button><button type="button" data-value="no">Отклонить</button>';
  banner.addEventListener('click',e=>{const value=e.target.dataset.value;if(!value)return;try{localStorage.setItem('monolit_analytics',value);}catch{}if(value==='yes')enable();banner.remove();});document.body.append(banner);
})();
