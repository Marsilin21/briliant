import {readFileSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
export function buildTildaCompatibility(root){
 // Retain only Tilda's layout helpers, not its form submission/analytics SDK.
 const forms=readFileSync(resolve(root,'js/tilda-forms-1.0.min.js'),'utf8'),parts=[],visited=new Set();
 function include(name){
  if(visited.has(name))return;visited.add(name);
  const start=forms.indexOf('function '+name+'(');if(start<0)throw Error('Missing Tilda layout helper: '+name);
  const end=forms.indexOf('function t_',start+15),body=forms.slice(start,end<0?undefined:end);
  if(/fetch\(|XMLHttpRequest|t_forms__send/.test(body))throw Error('Layout extraction includes network behavior');
  parts.push(body);for(const helper of new Set(body.match(/t_forms__\w+/g)||[]))include(helper);
 }
 include('t_forms__calculateInputsWidth');
 writeFileSync(resolve(root,'site/tilda-layout.js'),'// Layout helpers extracted from the supplied Tilda export. No submission SDK.\n'+parts.join('\n'));
 // The export has no usable Maps API key. Embed the public city map at the
 // original marker coordinates, without claiming a verified office location.
 writeFileSync(resolve(root,'site/tilda-map-compatible.js'),`window.t_appendYandexMap=function(recId){
 const container=document.querySelector('#rec'+recId+' .t-map');
 if(!container||container.querySelector('iframe'))return;
 const marker=(window['arMapMarkers'+recId]||[])[0];
 const lat=Number(marker?.lat),lng=Number(marker?.lng);
 if(!Number.isFinite(lat)||!Number.isFinite(lng))return;
 const url=new URL('https://yandex.ru/map-widget/v1/');
 url.searchParams.set('ll',lng+','+lat);url.searchParams.set('z',container.getAttribute('data-map-zoom')||'12');url.searchParams.set('theme','dark');
 const frame=document.createElement('iframe');frame.src=url.href;frame.title='Карта: '+(marker.title||'регион работы');frame.style.cssText='width:100%;height:100%;border:0;display:block';frame.referrerPolicy='strict-origin-when-cross-origin';container.appendChild(frame);
};\n`);
}
