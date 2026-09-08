import { load } from 'cheerio';
import { readFileSync, writeFileSync, mkdirSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import {editorial,editorialCorrections} from './editorial.mjs';
import {offerDefaults} from '../site/offers.mjs';
import {projectDefaults} from '../site/projects.mjs';
import {serviceSteps,serviceCTA} from '../site/service-content.mjs';
import { ROOT, PAGES } from '../server/content.mjs';
import {optimizeImages} from './optimize-images.mjs';
import {buildTildaCompatibility} from './tilda-compat.mjs';
const hash=t=>createHash('sha256').update(t).digest('hex').slice(0,20);
const catalog={pages:PAGES,texts:{},media:{},checks:{
  contacts:'Подтвердить действующие телефон, адрес и почту',region:'Подтвердить Нижний Новгород и зону работы',
  prices:'Подтвердить ставки, состав работ и включение материалов',guarantees:'Подтвердить гарантии, сроки и порядок оплаты',
  portfolio:'Проверить принадлежность проектов и права на фотографии',reviews:'Подтвердить отзывы и их первоисточники',
  legal:'Заполнить действительные реквизиты и согласовать текст политики'
}};
const defaults={schemaVersion:2,offers:structuredClone(offerDefaults),texts:{},media:{},seo:{},checks:Object.fromEntries(Object.keys(catalog.checks).map(k=>[k,false])),organization:{name:'Бриллиант Монолит',legalName:'',inn:'',email:'',phone:'',address:'',region:'Нижний Новгород'},analytics:{enabled:false,metrikaId:''}};
const corrections=new Map([
  ['Европейские стандарты','Согласованные решения'],
  ['долговечный ремонт с гарантией до 5 лет','состав работ и условия гарантии — в договоре'],
  ['за один день','по вашему проекту'],
  ['Заполните форму и мы свяжемся с вами в течение часа','Оставьте номер телефона для обсуждения ремонта'],
  ['от 9 000–10 000 ₽/м²','9 000–10 000 ₽/м²'],
  ['от 18 000–22 000 ₽/м²','18 000–22 000 ₽/м²'],
  ['от 15 000–25 000 ₽/месяц (или по выездам)','15 000–25 000 ₽/месяц (или по выездам)'],
  ['Кухни, шкафы, гардеробные, панели, текстиль, свет, декор','Кухни, шкафы, гардеробные и встроенная мебель'],
]);
const steps=['Обсуждаем объект и задачи ремонта','Уточняем размеры и состояние объекта','Определяем состав и стоимость работ','Согласовываем условия, этапы и сроки','Выполняем согласованные работы','Обсуждаем ход и результаты этапов','Принимаем работы по условиям договора'];
defaults.projects=structuredClone(projectDefaults);
defaults.seoRevision=1;
mkdirSync(resolve(ROOT,'dist/templates'),{recursive:true});
buildTildaCompatibility(ROOT);
for(const page of PAGES){
 const original=readFileSync(resolve(ROOT,page.file),'utf8');const $=load(original); let step=0;
 // Remove foreign-company legal text while retaining its original styled container.
 if(page.key==='legal'){
   const e=$('[field="text"]').first();
   e.html('<strong style="color:var(--uc-color-color-lxVJcqrgT6F9,#d4ad72);font-size:24px">Обработка персональных данных</strong><br><br>Сведения об операторе и условиях обработки данных уточняются владельцем сайта.<br><br>Перед запуском необходимо указать действительные реквизиты компании, контакт для обращений, цели и сроки хранения данных, используемые сервисы и порядок отзыва согласия.<br><br>Этот текст является заготовкой для редактора. Приём заявок на действующем сайте включается после заполнения и проверки политики.');
 }
 $('title,meta[name="description"],meta[name="robots"],link[rel="canonical"],meta[property="og:title"],meta[property="og:description"],meta[property="og:url"],meta[property="og:type"],script[type="application/ld+json"]').remove();
 $('script[src]').each((_,e)=>{if(/tilda-(forms|events|stat)/.test($(e).attr('src')))$(e).remove();});
 // Tilda analytics bootstrap lives in an inline footer script too.
 $('script:not([src])').each((_,e)=>{if(/stat\.tildacdn|tildastat|TildaStat|tilda-stat/.test($(e).text()))$(e).remove();});
 $('link[rel="preconnect"]').each((_,e)=>{if(/ws\.tildacdn/.test($(e).attr('href')))$(e).remove();});
 // Absolute local paths work on previews and preserve the original URL structure.
 $('[src],[href],[data-original],[data-content-cover-bg]').each((_,e)=>{
  for(const a of ['src','href','data-original','data-content-cover-bg']){
   const v=$(e).attr(a);if(!v)continue;
   if(/^(images|css|js|files)\//.test(v))$(e).attr(a,'/'+v);
   else if(/^https?:\/\/(www\.)?brilliant-monolit\.ru(?=\/|$)/i.test(v))$(e).attr(a,v.replace(/^https?:\/\/(www\.)?brilliant-monolit\.ru/i,'')||'/');
  }
 });
 $('a[href="/main"],a[href="/main/"]').attr('href','/');
 $('script[src^="/js/tilda-map-1.0.min.js"]').attr('src','/site/tilda-map-compatible.js');
 $('a.t420__logo-link[href="#"]').attr('href','/');
 // Keep visitors in the same tab when navigating inside this site.
 $('a[href^="/"]').removeAttr('target');
 $('a[href]').each((_,e)=>{const match=$(e).attr('href').match(/^(?:https?:\/\/|\/)?(#popup:.*)$/);if(match)$(e).attr('href',match[1]);});
 $('.t-menusub__list').each((_,list)=>{
  const capital=$(list).find('a[href="/kap-remont"]').closest('li');
  if(capital.length)capital.after('<li class="t-menusub__list-item t-name t-name_xs"><a class="t-menusub__link-item t-name t-name_xs" href="/remont-v-novostroyke">Ремонт в новостройке</a></li><li class="t-menusub__list-item t-name t-name_xs"><a class="t-menusub__link-item t-name t-name_xs" href="/remont-vtorichnogo-zhilya">Ремонт вторичного жилья</a></li>');
 });
 const body=$('body').get(0);
 let heading=$('.t-title,.t-section__title').filter((_,e)=>!$(e).closest('footer,#t-footer,form,.t-popup').length && $(e).text().trim()).first();
 if(page.key==='about')heading=$('.t-text').filter((_,e)=>$(e).text().includes('Бриллиант монолит —')).first();
 if(page.key==='contacts')heading=$('.tn-atom,.t-title,.t-text').filter((_,e)=>$(e).text().trim()==='Контакты' && !$(e).closest('#t-header,#t-footer').length).first();
 if(page.key==='legal')heading=$('[field="text"]').first().find('strong').first();
 if(!heading.length)heading=$('[field]').filter((_,e)=>!$(e).closest('#t-header,#t-footer').length && $(e).text().trim()).first();
 if(!heading.length)throw Error('Не найден заголовок '+page.key);
 const oldTag=heading[0].tagName;heading[0].tagName='h1';heading.attr('data-seo-heading','');
 if(oldTag==='strong')heading.attr('style',heading.attr('style')+';display:inline;font-weight:bold');
 $('.t-section__title').each((_,e)=>{if(e.tagName!=='h1'){e.tagName='h2';$(e).attr('data-seo-heading','');}});
 $('.t-card__title').each((_,e)=>{e.tagName='h3';$(e).attr('data-seo-heading','');});
 const overrides=editorial($,page);
 $('.t-popup[aria-label]').attr('aria-label',serviceCTA[page.key]??'Обсудите задачу');
 function walk(node){
  if(['script','style','noscript','svg','template'].includes(node.tagName))return;
  if(node.type==='text'){
   const text=node.data.trim();if(!text || !/[\p{L}\p{N}]/u.test(text))return;
   let keyText=text, value=corrections.get(text)??text;
   if(text==='Кратко о процессе'){keyText=page.key+':step:'+step;value=(serviceSteps[page.key]??steps)[step++]??'Согласовываем детали с заказчиком';}
   if(/Итоговая сумма фиксируется в договоре и не меняется/.test(text))value='Стоимость определяется согласованной сметой. Дополнительные работы и изменения оформляются отдельным согласованием с заказчиком до их выполнения.';
   if(/Сроки зависят от сложности проекта и поставок материалов/.test(text))value='Срок зависит от площади, состояния объекта, состава работ и поставок материалов. График обсуждается после осмотра и фиксируется в договоре.';
   if(/Мы даём гарантию на все работы/.test(text))value='Срок и условия гарантии на работы указываются в договоре. Гарантия на оборудование определяется условиями его производителя.';
   const legacyId=hash(keyText);const parent=$(node.parent);const rec=parent.closest('.r').attr('id')||'general';
   const override=overrides.get(node);
   value=override?.value??(text==='Получите смету'?serviceCTA[page.key]:undefined)??editorialCorrections.get(text)??value;
   const shared=!!parent.closest('#t-header,#t-footer').length || ['+7 (495) 11-11-1111','brilliant-monolit@info.ru','г. Нижний Новгород, ул. Пушкина 17'].includes(text);
   const id=hash(override?.key??(shared?keyText:page.key+':'+keyText));
   let section=parent.closest('.r').find('[field="btitle"],.t-section__title').first().text().trim()||rec;
   section=section.replace(/@@TEXT_[a-f0-9]+@@/g,'').trim()||rec;
   let review=/₽|\d.*руб|стоимост.*фикс|строго за фактически/.test(text)?'prices':/гаранти|в течение часа|один день|\d.*недел|\d.*лет/.test(text)?'guarantees':/ЖК |Neva Towers|Ковров|Рыбина|Бусыгин/.test(text)?'portfolio':/495|Пушкина|@info\.ru/.test(text)?'contacts':/Нижн.*Новгород/.test(text)?'region':null;
   const summaryOffer=page.key==='home'?{'Функциональный ремонт с базовыми решениями':'cosmetic','Сбалансированный ремонт с продуманным дизайном':'capital','Индивидуальный проект, материалы и контроль':'premium'}[text]:undefined;
   const servicePrice=Object.hasOwn(offerDefaults,page.key)&&/₽/.test(text)&&text.length<160;
   if(!catalog.texts[id])catalog.texts[id]={original:text,label:(override?.value||editorialCorrections.get(text)||text).slice(0,85),uses:[],review,legacyId,scope:shared?'shared':'page',links:override?.links??(parent.closest('.t585__text').length&&!parent.closest('a').length?[]:undefined),binding:override?.binding??(summaryOffer?{offer:summaryOffer,field:'summary'}:servicePrice?{offer:page.key,field:'price'}:undefined)};
   if(!catalog.texts[id].uses.some(u=>u.page===page.key&&u.section===section))catalog.texts[id].uses.push({page:page.key,section});
   defaults.texts[id]=value;node.data=node.data.replace(text,'@@TEXT_'+id+'@@');
  }else for(const child of [...(node.children||[])])walk(child);
 }
 walk(body);
 // Image slots share references across pages. Logos and all original vector/decorative PNG assets stay locked.
 $('[src],[data-original],[data-content-cover-bg]').each((_,e)=>{
  const el=$(e);let url=el.attr('data-original')||el.attr('data-content-cover-bg')||el.attr('src');
  if(!url?.startsWith('/images/'))return;
  const id=hash(url),locked=!/\.jpe?g$/i.test(url);
  if(!catalog.media[id])catalog.media[id]={url,locked,pages:[]};
  if(!catalog.media[id].pages.includes(page.key))catalog.media[id].pages.push(page.key);
  defaults.media[id]={url,alt:el.attr('alt')||(!locked?'Интерьер из галереи Бриллиант Монолит':'')};
  if(el.attr('data-original'))el.attr('data-original','@@MEDIA_'+id+'@@');
  if(el.attr('data-content-cover-bg'))el.attr('data-content-cover-bg','@@MEDIA_'+id+'@@');
  if(e.tagName==='img'){el.attr('src','@@MEDIA_'+id+'@@');el.attr('alt','@@ALT_'+id+'@@');}
 });
 $('form').each((_,e)=>{
  const f=$(e);f.attr('data-monolit-form','').attr('action','/api/leads').removeClass('js-form-proccess').removeAttr('data-success-callback');
  f.find('input[type="tel"]').attr('placeholder','+7 (___) ___-__-__').attr('required','').removeClass('js-phonemask-input').removeAttr('data-phonemask-init data-phonemask-id data-phonemask-lid');
  f.find('input[name="Name"]').attr('maxlength','100');
  f.find('input[type="tel"]').attr('maxlength','24').attr('aria-label','Номер телефона');
  f.find('input[name="Name"]').attr('aria-label','Ваше имя');
  f.append('<div class="monolit-hp" aria-hidden="true"><label>Website<input name="website" tabindex="-1" autocomplete="off"></label></div><div class="monolit-form-status" role="status" aria-live="polite"></div>');
 });
 $('head').append('<!--MONOLIT_HEAD-->');
 defaults.seo[page.key]={title:page.title,description:page.description,noindex:page.key==='legal'};
 writeFileSync(resolve(ROOT,'dist/templates',page.key+'.html'),$.html());
}
const {defaultLinks}=await import('../site/link-management.mjs');
defaults.internalLinks=defaultLinks(catalog);
writeFileSync(resolve(ROOT,'dist/catalog.json'),JSON.stringify(catalog,null,2));
writeFileSync(resolve(ROOT,'dist/default-content.json'),JSON.stringify(defaults,null,2));
const manifest={files:Object.fromEntries(PAGES.map(p=>[p.file,createHash('sha256').update(readFileSync(resolve(ROOT,p.file))).digest('hex')])),assets:{}};
for(const m of Object.values(catalog.media)){const path=resolve(ROOT,m.url.slice(1));if(statSync(path).isFile())manifest.assets[m.url]=createHash('sha256').update(readFileSync(path)).digest('hex');}
writeFileSync(resolve(ROOT,'dist/source-manifest.json'),JSON.stringify(manifest,null,2));
await optimizeImages(ROOT,catalog);
console.log(`Подготовлены ${PAGES.length} исходных страниц, ${Object.keys(catalog.texts).length} текстовых полей и ${Object.keys(catalog.media).length} изображений. Дизайн и исходные файлы сохранены.`);
