window.t_appendYandexMap=function(recId){
 const container=document.querySelector('#rec'+recId+' .t-map');
 if(!container||container.querySelector('iframe'))return;
 const marker=(window['arMapMarkers'+recId]||[])[0];
 const lat=Number(marker?.lat),lng=Number(marker?.lng);
 if(!Number.isFinite(lat)||!Number.isFinite(lng))return;
 const url=new URL('https://yandex.ru/map-widget/v1/');
 url.searchParams.set('ll',lng+','+lat);url.searchParams.set('z',container.getAttribute('data-map-zoom')||'12');url.searchParams.set('theme','dark');
 const frame=document.createElement('iframe');frame.src=url.href;frame.title='Карта: '+(marker.title||'регион работы');frame.style.cssText='width:100%;height:100%;border:0;display:block';frame.referrerPolicy='strict-origin-when-cross-origin';container.appendChild(frame);
};
