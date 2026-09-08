import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {offerNames,offerText} from '../site/offers.mjs';
import {projectDefaults,projectText,projectStatuses} from '../site/projects.mjs';
import {seoMetadata} from '../site/seo-plan.mjs';
import {linkedText} from './linked-text.mjs';
import {defaultLinks,validateLinks} from '../site/link-management.mjs';

export const ROOT = fileURLToPath(new URL('../', import.meta.url));
export const PAGES = [
  ['home','/','page106667786.html','Главная','Ремонт квартир в Нижнем Новгороде — Бриллиант Монолит','Ремонт квартир и дизайн интерьера в Нижнем Новгороде. Виды работ, этапы, примеры интерьеров и подготовка индивидуальной сметы.'],
  ['design','/design','page114132466.html','Дизайн интерьера','Дизайн интерьера в Нижнем Новгороде — Бриллиант Монолит','Планировочные решения, визуализация и рабочие чертежи для ремонта квартиры или дома. Состав дизайн-проекта и порядок согласования.'],
  ['cosmetic','/kosmeticheskiy-remont','page115135716.html','Косметический ремонт','Косметический ремонт квартир — Бриллиант Монолит','Обновление отделки квартиры: стены, потолки и напольные покрытия. Состав косметического ремонта, подготовка основания и расчёт сметы.'],
  ['capital','/kap-remont','page115136766.html','Капитальный ремонт','Капитальный ремонт квартир — Бриллиант Монолит','Капитальный ремонт: демонтаж, электрика, сантехника, выравнивание и чистовая отделка. Этапы работ и факторы стоимости.'],
  ['premium','/elit-remont','page115137346.html','Дизайнерский ремонт','Ремонт по дизайн-проекту — Бриллиант Монолит','Реализация дизайн-проекта квартиры: отделка, инженерные решения, освещение и комплектация. Обсуждение материалов и состава работ.'],
  ['houses','/remont-domov','page115137936.html','Ремонт домов','Ремонт домов и коттеджей — Бриллиант Монолит','Внутренняя отделка и ремонт загородного дома. Оценка состояния конструкций и инженерных систем, планирование этапов и сметы.'],
  ['construction','/stroitelstvo-kottegey','page115138566.html','Строительство коттеджей','Строительство коттеджей — Бриллиант Монолит','Обсуждение проекта и комплектации коттеджа: конструктив, инженерные системы, отделка и благоустройство. Индивидуальный состав работ.'],
  ['supervision','/avtorski-nadzor','page115139206.html','Авторский надзор','Авторский надзор за ремонтом — Бриллиант Монолит','Контроль соответствия ремонта дизайн-проекту. Согласование материалов и решений, выезды дизайнера и уточнение рабочих чертежей.'],
  ['smart','/smart-house','page115139476.html','Умный дом','Системы умного дома — Бриллиант Монолит','Сценарии автоматизации квартиры и дома: освещение, климат и управление оборудованием. Проектирование, подбор и настройка системы.'],
  ['furniture','/mebel-na-zakaz','page115140096.html','Мебель на заказ','Мебель на заказ для интерьера — Бриллиант Монолит','Кухни, шкафы, гардеробные и встроенная мебель под размеры помещения. Обсуждение конструкции, материалов, фурнитуры и установки.'],
  ['works','/case','page114151676.html','Портфолио','Интерьеры и портфолио — Бриллиант Монолит','Галерея интерьеров квартир и домов: планировочные решения, отделка, освещение и мебель. Обсудите задачи вашего проекта.'],
  ['about','/info','page114132856.html','О компании','О компании Бриллиант Монолит','Подход к ремонту квартир и домов, подготовка сметы, согласование работ и взаимодействие с заказчиком. Информация о компании.'],
  ['faq','/questions','page115133696.html','Частые вопросы','Вопросы о ремонте квартир — Бриллиант Монолит','Ответы о смете, сроках ремонта, материалах, дизайн-проекте, оплате и приёмке работ. Что обсудить перед заключением договора.'],
  ['contacts','/contacts','page114143906.html','Контакты','Контакты Бриллиант Монолит','Контактная информация компании Бриллиант Монолит и форма обращения по ремонту квартиры, дома или дизайн-проекту.'],
  ['legal','/rules','page111377176.html','Политика','Обработка персональных данных — Бриллиант Монолит','Информация об обработке персональных данных при обращении через сайт Бриллиант Монолит.'],
  ['newbuild','/remont-v-novostroyke','page115136766.html','Ремонт в новостройке','Ремонт квартиры в новостройке в Нижнем Новгороде — Бриллиант Монолит','Ремонт новостройки без отделки и с предчистовой подготовкой: планировка, инженерия, этапы, состав сметы и отделочные работы.'],
  ['resale','/remont-vtorichnogo-zhilya','page115136766.html','Ремонт вторичного жилья','Ремонт вторичного жилья в Нижнем Новгороде — Бриллиант Монолит','Ремонт существующей квартиры: осмотр, демонтаж, состояние коммуникаций, выбор косметического или капитального ремонта и расчёт сметы.']
].map(([key,path,file,label,title,description])=>({key,path,file,label,title:seoMetadata[key]?.[0]??title,description:seoMetadata[key]?.[1]??description,generated:['newbuild','resale'].includes(key)}));

export const esc = value => String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const jsonSafe = value => JSON.stringify(value).replace(/</g,'\\u003c');
export function loadCatalog(){ return JSON.parse(readFileSync(resolve(ROOT,'dist/catalog.json'),'utf8')); }
export function validateContent(c, catalog){
  if(!c || typeof c!=='object' || Array.isArray(c)) throw Error('Неверный формат содержимого');
  for(const key of Object.keys(c)) if(!['schemaVersion','seoRevision','offers','projects','texts','media','seo','checks','organization','analytics','internalLinks'].includes(key)) throw Error('Неизвестный раздел содержимого');
  validateLinks(c.internalLinks,catalog);
  if(c.seoRevision!==1)throw Error('Обновите структуру SEO');
  if(!c.projects||Array.isArray(c.projects)||Object.keys(c.projects).sort().join()!==Object.keys(projectDefaults).sort().join())throw Error('Некорректный список объектов');
  for(const p of Object.values(c.projects)){
   const limits={title:130,area:30,description:160,city:60,areaKind:40,scope:120,period:40,status:20};
   if(!p||Object.keys(p).length!==Object.keys(limits).length||Object.entries(limits).some(([k,max])=>typeof p[k]!=='string'||p[k].length>max)||!p.title.trim()||!Object.hasOwn(projectStatuses,p.status))throw Error('Проверьте сведения об объекте');
   if(projectText(p,'description').length>280)throw Error('Сократите подпись объекта до 280 символов, чтобы сохранить оформление карточки');
  }
  if(c.schemaVersion!==2||!c.offers||Array.isArray(c.offers)||Object.keys(c.offers).sort().join()!==Object.keys(offerNames).sort().join())throw Error('Некорректный каталог предложений');
  for(const offer of Object.values(c.offers)){
   if(!offer||typeof offer!=='object'||typeof offer.confirmed!=='boolean')throw Error('Проверьте предложение');
   for(const [key,max] of Object.entries({price:60,unit:30,scope:180,materials:500,exclusions:700,basis:500,variant:140,legacyReference:700}))if(typeof offer[key]!=='string'||offer[key].length>max)throw Error('Проверьте поле предложения: '+key);
   if(!['price','unit','scope','materials','exclusions','basis','variant','legacyReference','confirmed'].every(k=>Object.hasOwn(offer,k))||Object.keys(offer).length!==9)throw Error('Некорректные поля предложения');
   if(!offer.scope.trim()||offer.confirmed&&(!/\d/.test(offer.price)||!offer.unit.trim()||!offer.materials.trim()||!offer.exclusions.trim()||!offer.basis.trim()))throw Error('Для показа цены укажите ставку, единицу, состав и условия расчёта');
  }
  for(const key of ['texts','media','seo','checks','organization','analytics']) if(!c[key] || typeof c[key]!=='object' || Array.isArray(c[key])) throw Error('Отсутствует раздел '+key);
  for(const [id,value] of Object.entries(c.texts)){
    if(!Object.hasOwn(catalog.texts,id) || typeof value!=='string' || value.length>24000) throw Error('Некорректное текстовое поле');
  }
  if(Object.keys(c.texts).length!==Object.keys(catalog.texts).length) throw Error('Неполный набор текстовых полей');
  for(const [id,m] of Object.entries(c.media)){
    const source=Object.hasOwn(catalog.media,id)?catalog.media[id]:null;
    if(!source || !m || typeof m.url!=='string' || typeof m.alt!=='string' || m.alt.length>300 || !/^\/(images|uploads)\/[a-zA-Z0-9_./-]+$/.test(m.url) || m.url.includes('..')) throw Error('Некорректное изображение');
    if(source.locked && m.url!==source.url) throw Error('Оригинальные логотип и декоративные элементы защищены от замены');
  }
  if(Object.keys(c.media).length!==Object.keys(catalog.media).length) throw Error('Неполный набор изображений');
  for(const p of PAGES){
    const s=c.seo[p.key];
    if(!s || typeof s.title!=='string' || !s.title.trim() || s.title.length>180 || typeof s.description!=='string' || s.description.length>500 || typeof s.noindex!=='boolean') throw Error('Проверьте SEO страницы '+p.label);
  }
  if(Object.keys(c.seo).length!==PAGES.length) throw Error('Некорректный список страниц');
  for(const [k,v] of Object.entries(c.checks)) if(!Object.hasOwn(catalog.checks,k) || typeof v!=='boolean') throw Error('Неверный статус проверки');
  for(const k of Object.keys(catalog.checks)) if(typeof c.checks[k]!=='boolean') throw Error('Неполный список проверок');
  for(const [k,v] of Object.entries(c.organization)) if(!['name','legalName','inn','email','phone','address','region'].includes(k) || typeof v!=='string' || v.length>500) throw Error('Некорректные реквизиты');
  if(!c.organization.name?.trim()) throw Error('Укажите название компании');
  if(typeof c.analytics.enabled!=='boolean' || !/^\d{0,12}$/.test(c.analytics.metrikaId)) throw Error('Некорректный номер счётчика');
  if(c.analytics.enabled && !/^\d{5,12}$/.test(c.analytics.metrikaId)) throw Error('Укажите номер счётчика Метрики');
  return c;
}

export function renderPage(page,c,catalog,{origin,preview=false,production=false,version=0}={}){
  let html=readFileSync(resolve(ROOT,'dist/templates',page.key+'.html'),'utf8');
  const links=c.internalLinks??defaultLinks(catalog);
  html=html.replace(/@@TEXT_([a-f0-9]+)@@/g,(_,id)=>{const f=catalog.texts[id];const value=f.binding?.offer?offerText(c.offers[f.binding.offer],f.binding.field):f.binding?.project?projectText(c.projects[f.binding.project],f.binding.field):c.texts[id]??f.original;return linkedText(value,links.filter(l=>l.enabled&&l.field===id&&l.source===page.key).map(l=>[l.anchor,l.target]),esc);});
  html=html.replace(/@@MEDIA_([a-f0-9]+)@@/g,(_,id)=>esc(c.media[id].url));
  html=html.replace(/@@ALT_([a-f0-9]+)@@/g,(_,id)=>esc(c.media[id].alt));
  const seo=c.seo[page.key], canonical=origin+page.path;
  const robots=preview||!production||seo.noindex?'noindex, nofollow':'index, follow, max-image-preview:large';
  const schema=[{'@context':'https://schema.org','@type':'WebPage',name:seo.title,description:seo.description,url:canonical}];
  if(page.key==='home') schema.push({'@context':'https://schema.org','@type':'Organization',name:c.organization.name,url:origin});
  else schema.push({'@context':'https://schema.org','@type':'BreadcrumbList',itemListElement:[{'@type':'ListItem',position:1,name:'Главная',item:origin+'/'},{'@type':'ListItem',position:2,name:page.label,item:canonical}]});
  if(Object.hasOwn(offerNames,page.key))schema.push({'@context':'https://schema.org','@type':'Service','@id':canonical+'#service',name:offerNames[page.key],serviceType:offerNames[page.key],description:c.offers[page.key].scope,url:canonical,provider:{'@type':'Organization',name:c.organization.name,url:origin}});
  const config={preview,legalReady:c.checks.legal,analytics:c.analytics,version,offer:Object.hasOwn(offerNames,page.key)?page.key:'',offerNames};
  const head=`<title>${esc(seo.title)}</title><meta name="description" content="${esc(seo.description)}"><link rel="canonical" href="${esc(canonical)}"><meta name="robots" content="${robots}"><meta property="og:title" content="${esc(seo.title)}"><meta property="og:description" content="${esc(seo.description)}"><meta property="og:url" content="${esc(canonical)}"><meta property="og:type" content="website"><script type="application/ld+json">${jsonSafe(schema)}</script><script id="monolit-config" type="application/json">${jsonSafe(config)}</script><link rel="stylesheet" href="/site/runtime.css"><script src="/site/runtime.js" defer></script>`;
  return html.replace('<!--MONOLIT_HEAD-->','<script src="/site/tilda-layout.js" defer></script>'+head);
}
