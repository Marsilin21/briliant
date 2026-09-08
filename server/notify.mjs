import nodemailer from 'nodemailer';
import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import {offerNames} from '../site/offers.mjs';
export const configured=s=>Object.entries(s).filter(([,v])=>v.enabled).map(([k])=>k);
export function validateSettings(s){
 if(!s||typeof s!=='object'||!s.telegram||!s.bitrix||!s.email)throw Error('Некорректные настройки интеграций');
 for(const key of Object.keys(s))if(!['telegram','bitrix','email'].includes(key))throw Error('Неизвестный канал');
 for(const c of Object.values(s))if(typeof c.enabled!=='boolean')throw Error('Укажите состояние канала');
 if(s.telegram.enabled && (!/^\d+:[\w-]{20,}$/.test(s.telegram.token)||! /^-?\d{4,20}$/.test(s.telegram.chatId)))throw Error('Проверьте токен Telegram и ID чата');
 if(s.bitrix.url){const u=new URL(s.bitrix.url);if(u.protocol!=='https:'||u.port||u.username||u.password||u.search||u.hash||!/^([a-z0-9-]+\.)+bitrix24\.(ru|com|by|kz|eu|de)$/.test(u.hostname)||!/^\/rest\/\d+\/[a-zA-Z0-9]+\/?$/.test(u.pathname))throw Error('Нужен HTTPS-адрес входящего вебхука Bitrix24');}
 if(s.bitrix.enabled&&!s.bitrix.url)throw Error('Укажите вебхук Bitrix24');
 if(s.email.enabled && (!/^[a-z0-9.-]+$/i.test(s.email.host)||s.email.host.indexOf('.')<1||isIP(s.email.host)||![465,587].includes(Number(s.email.port))|| !s.email.user || !s.email.password || !/^[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+$/.test(s.email.to)|| !/^[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+$/.test(s.email.from)))throw Error('Проверьте SMTP, отправителя и получателя; поддерживаются порты 465 и 587');
 if(s.email.enabled && typeof s.email.secure!=='boolean')throw Error('Укажите режим TLS');
 if(JSON.stringify(s).length>16000)throw Error('Настройки слишком большие');
 return s;
}
export function redactSettings(s){const copy=structuredClone(s);for(const [channel,key] of [['telegram','token'],['bitrix','url'],['email','password']]){copy[channel][key+'Configured']=!!copy[channel][key];copy[channel][key]='';}return copy;}
export function mergeSettings(input,old){
 const result={telegram:{enabled:input.telegram?.enabled,token:input.telegram?.token??'',chatId:input.telegram?.chatId??''},bitrix:{enabled:input.bitrix?.enabled,url:input.bitrix?.url??''},email:Object.fromEntries(['enabled','host','port','secure','user','password','from','to'].map(k=>[k,input.email?.[k]]))};
 for(const [channel,key] of [['telegram','token'],['bitrix','url'],['email','password']])if(!result[channel][key])result[channel][key]=old[channel][key];
 return validateSettings(result);
}
async function post(url,body){const r=await fetch(url,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(5000),redirect:'error'});if(!r.ok)throw Error('HTTP '+r.status);const j=await r.json();if(j.ok===false||j.error)throw Error('Канал отклонил запрос');return j;}
async function send(channel,s,lead){
 const text=`Заявка №${lead.id}\nИмя: ${lead.name||'Не указано'}\nТелефон: ${lead.phone}\nУслуга: ${offerNames[lead.offer]||'Обсуждение задачи'}\nКомментарий: ${lead.comment}\nСтраница: ${lead.source}\nUTM: ${lead.utm}`;
 if(channel==='telegram')await post(`https://api.telegram.org/bot${s.telegram.token}/sendMessage`,{chat_id:s.telegram.chatId,text});
 else if(channel==='bitrix')await post(s.bitrix.url.replace(/\/?$/,'/')+'crm.lead.add.json',{fields:{TITLE:`Заявка с сайта №${lead.id}`,NAME:lead.name,PHONE:[{VALUE:lead.phone,VALUE_TYPE:'WORK'}],COMMENTS:text}});
 else if(channel==='email'){
  const smtp=s.email;const addresses=await lookup(smtp.host,{all:true,family:4});
  if(!addresses.length||addresses.some(a=>/^(0|10|127|169\.254|172\.(1[6-9]|2\d|3[01])|192\.168|100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])|198\.(18|19)|22[4-9]|23\d|24\d|25[0-5])\./.test(a.address)))throw Error('Недопустимый адрес SMTP');
  const transport=nodemailer.createTransport({host:addresses[0].address,port:Number(smtp.port),secure:Number(smtp.port)===465,requireTLS:true,tls:{servername:smtp.host,minVersion:'TLSv1.2'},auth:{user:smtp.user,pass:smtp.password},connectionTimeout:5000,greetingTimeout:5000,socketTimeout:5000});
  try{await transport.sendMail({from:smtp.from,to:smtp.to,subject:`Заявка с сайта №${lead.id}`,text});}finally{transport.close();}
 }
}
export function deliveryWorker(store,{sender=send}={}){
 let working=false;
 return async()=>{
  if(working)return;working=true;
  try{
   const s=store.settings();const rows=store.db.prepare("SELECT * FROM deliveries WHERE status IN ('pending','retry') AND next_at<=? LIMIT 12").all(Date.now());
   await Promise.allSettled(rows.map(async d=>{
    if(!s[d.channel]?.enabled)return;
    const lead=store.db.prepare('SELECT * FROM leads WHERE id=?').get(d.lead_id);if(!lead)return;
    try{await sender(d.channel,s,lead);store.db.prepare("UPDATE deliveries SET status='sent',attempts=attempts+1,last_error=NULL,updated_at=CURRENT_TIMESTAMP WHERE id=?").run(d.id);}
    catch{const attempts=d.attempts+1;store.db.prepare('UPDATE deliveries SET status=?,attempts=?,next_at=?,last_error=?,updated_at=CURRENT_TIMESTAMP WHERE id=?').run(attempts>=5?'failed':'retry',attempts,Date.now()+Math.min(3600000,30000*2**attempts),'Канал недоступен или отклонил запрос. Проверьте настройки.',d.id);}
   }));
  }finally{working=false;}
 };
}
