import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,readFileSync,readdirSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {JSDOM,VirtualConsole} from 'jsdom';
import {createApp} from '../server/app.mjs';
import {ROOT} from '../server/content.mjs';

test('built admin UI logs in, edits a field, saves, publishes, previews and navigates panels',async()=>{
 const origin='http://127.0.0.1:4180',password='UI-test-password-2048';
 const app=await createApp({dataDir:mkdtempSync(join(tmpdir(),'monolit-ui-')),password,worker:false,origins:[origin]});await app.ready();
 const errors=[];const vc=new VirtualConsole();vc.on('jsdomError',e=>errors.push(e.message));vc.on('error',e=>errors.push(String(e)));
 const dom=new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>',{url:origin+'/admin/',runScripts:'dangerously',pretendToBeVisual:true,virtualConsole:vc});
 const w=dom.window;w.structuredClone=structuredClone;let cookie='',previewURL='';
 w.fetch=async(url,init={})=>{
  const u=new URL(url,origin);const headers={origin,...init.headers,...(cookie?{cookie}:{})};
  const r=await app.inject({url:u.pathname+u.search,method:init.method||'GET',headers,...(init.body?{payload:init.body}:{})});
  if(r.cookies.length)cookie=r.cookies.map(c=>c.name+'='+c.value).join('; ');
  return {ok:r.statusCode>=200&&r.statusCode<300,status:r.statusCode,json:async()=>r.json(),text:async()=>r.body};
 };
 w.open=()=>({set location(v){previewURL=v;},close(){}});
 w.HTMLDialogElement.prototype.showModal=function(){this.setAttribute('open','');};
 w.HTMLDialogElement.prototype.close=function(){this.removeAttribute('open');};
 const until=async(predicate,label)=>{for(let n=0;n<160;n++){if(predicate())return;await new Promise(r=>setTimeout(r,15));}throw Error('UI timeout: '+label+'; '+w.document.body.textContent.slice(-800));};
 const button=text=>[...w.document.querySelectorAll('button')].find(b=>b.textContent.trim()===text);
 const click=el=>{assert.ok(el,'UI element exists');el.dispatchEvent(new w.MouseEvent('click',{bubbles:true}));};
 const value=(el,v)=>{assert.ok(el,'input exists');const proto=el.tagName==='TEXTAREA'?w.HTMLTextAreaElement.prototype:w.HTMLInputElement.prototype;Object.getOwnPropertyDescriptor(proto,'value').set.call(el,v);el.dispatchEvent(new w.Event('input',{bubbles:true}));el.dispatchEvent(new w.Event('change',{bubbles:true}));};
 try{
  const asset=readdirSync(resolve(ROOT,'dist/admin/assets')).find(x=>x.endsWith('.js'));w.eval(readFileSync(resolve(ROOT,'dist/admin/assets',asset),'utf8'));
  await until(()=>button('Войти →'),'login');value(w.document.querySelector('input[type=password]'),password);
  w.document.querySelector('form').dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));
  await until(()=>w.document.querySelector('.intro'),'overview');assert.equal(w.document.querySelector('h1').textContent,'Обзор сайта');
  click(button('Страницы и тексты'));await until(()=>w.document.querySelector('.field-card textarea'),'editor');
  const input=w.document.querySelector('.field-card textarea'),text='Проверка редактора через интерфейс';value(input,text);
  await until(()=>!button('Сохранить черновик').disabled,'dirty state');click(button('Сохранить черновик'));
  await until(()=>w.document.body.textContent.includes('Черновик сохранён'),'save');
  assert.doesNotMatch((await app.inject('/')).body,/Проверка редактора через интерфейс/);
  click(button('Посмотреть черновик ↗'));await until(()=>previewURL.includes('/api/admin/preview/home'),'preview URL');
  click(button('Опубликовать'));await until(()=>w.document.querySelector('dialog[open]'),'confirmation');click(button('Подтвердить'));
  await until(()=>w.document.body.textContent.includes('Опубликовано. Тексты и SEO'),'published');
  assert.match((await app.inject('/')).body,/Проверка редактора через интерфейс/);
  click(button('Услуги и цены'));await until(()=>w.document.querySelector('.search-preview'),'offer editor');
  value(w.document.querySelector('textarea'),'от 4 321');await until(()=>!button('Сохранить черновик').disabled,'offer dirty');
  click(button('Опубликовать'));await until(()=>w.document.querySelector('dialog[open]'),'offer confirmation');click(button('Подтвердить'));
  await until(()=>button('Опубликовать')&&!button('Опубликовать').disabled&&button('Сохранить черновик').disabled,'offer saved');
  assert.match((await app.inject('/')).body,/4 321/);assert.match((await app.inject('/kosmeticheskiy-remont')).body,/4 321/);
  click(button('Портфолио'));await until(()=>w.document.querySelector('main').textContent.includes('Сведения об объектах'),'project editor');
  const city=[...w.document.querySelectorAll('label')].find(l=>l.textContent==='Город')?.querySelector('input');value(city,'Тестовый город');
  await until(()=>!button('Сохранить черновик').disabled,'project dirty');click(button('Опубликовать'));await until(()=>w.document.querySelector('dialog[open]'),'project confirmation');click(button('Подтвердить'));
  await until(()=>button('Опубликовать')&&!button('Опубликовать').disabled&&button('Сохранить черновик').disabled,'project saved');
  assert.match((await app.inject('/')).body,/Тестовый город/);assert.match((await app.inject('/case')).body,/Тестовый город/);
  for(const [tab,expected] of [['Заявки','Заявок пока нет'],['Медиатека','Новых фотографий пока нет'],['Публикации и версии','История публикаций'],['Каналы заявок','SMTP-сервер'],['Пользователи','Изменить свой пароль'],['Журнал действий','Последние действия'],['Поисковая оптимизация','Канонический адрес'],['Портфолио','Изображения страницы'],['Данные компании','Полное наименование ИП'],['Аналитика','Номер счётчика']]){
   click(button(tab));await until(()=>w.document.querySelector('main').textContent.includes(expected),tab);
  }
  click(button('Продвижение'));await until(()=>button('Сохранить план продвижения'),'promotion editor');
  const targetQuery=[...w.document.querySelectorAll('label')].find(l=>l.textContent==='Целевой запрос')?.querySelector('input');value(targetQuery,'ремонт квартиры проверка плана');
  click(button('Перелинковка'));await until(()=>button('Добавить внутреннюю ссылку'),'internal links');
  click(button('Продвижение'));await until(()=>button('Сохранить план продвижения'),'return to promotion');
  assert.equal([...w.document.querySelectorAll('label')].find(l=>l.textContent==='Целевой запрос').querySelector('input').value,'ремонт квартиры проверка плана');
  click(button('Сохранить план продвижения'));await until(()=>w.document.body.textContent.includes('План продвижения сохранён.'),'private save');
  assert.equal(JSON.parse(app.store.db.prepare('SELECT data FROM seo_workspace').get().data).campaigns[0].query,'ремонт квартиры проверка плана');
  click(button('Запросы и частотность'));await until(()=>button('Экспорт запросов CSV'),'semantic measurements');
  assert.ok(w.document.querySelectorAll('.seo-query').length>0);
  click(button('Исследование выдачи'));await until(()=>w.document.body.textContent.includes('8 из 10 общих URL'),'research comparison');
  const comparison=[...w.document.querySelectorAll('label')].find(l=>l.textContent.startsWith('Первый запрос'))?.querySelector('select');
  assert.ok(comparison);comparison.value='resale_variant';comparison.dispatchEvent(new w.Event('change',{bubbles:true}));
  await until(()=>w.document.body.textContent.includes('Выберите два разных запроса.'),'same query guard');
  comparison.value='capital';comparison.dispatchEvent(new w.Event('change',{bubbles:true}));
  await until(()=>w.document.body.textContent.includes('0 из 10 общих URL'),'different intent comparison');
  assert.ok(button('Скачать исследование JSON'));
  click(button('Карта сайта'));await until(()=>w.document.querySelector('.seo-table tbody tr'),'sitemap report');
  assert.equal(w.document.querySelectorAll('.seo-table tbody tr').length,17);
  assert.ok(w.document.querySelector('a[href="/sitemap.xml"]'));
  assert.deepEqual(errors,[]);
 }finally{dom.window.close();await app.close();}
});
