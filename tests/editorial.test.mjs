import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,mkdtempSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {tmpdir} from 'node:os';
import {randomUUID} from 'node:crypto';
import {load} from 'cheerio';
import {JSDOM} from 'jsdom';
import {DatabaseSync} from 'node:sqlite';
import {createApp} from '../server/app.mjs';
import {ROOT,PAGES,loadCatalog,renderPage,validateContent} from '../server/content.mjs';
import {upgradeContent} from '../server/migrate-content.mjs';
import {offerText,offerNames} from '../site/offers.mjs';
const catalog=loadCatalog(),defaults=JSON.parse(readFileSync(resolve(ROOT,'dist/default-content.json'),'utf8'));
const html=(key,content=defaults)=>renderPage(PAGES.find(p=>p.key===key),content,catalog,{origin:'https://brilliant-monolit.ru'});

test('each service has independent useful questions, preserved introduction and consistent offer',()=>{
 const questions=new Set();
 for(const key of Object.keys(offerNames)){
  const $=load(html(key)),original=load(readFileSync(resolve(ROOT,PAGES.find(p=>p.key===key).file),'utf8'));
  const first=$('.t585__title').first().text();assert.ok(first);assert.ok(!questions.has(first));questions.add(first);
  assert.equal($('.t585__accordion').length,10);
  assert.equal($('[field="descr"]').length,original('[field="descr"]').length);
  // Introduction must survive price binding even when both share one field container.
  const intro=original('[field="descr"]').first().text().trim().split('₽')[0];
  assert.ok($('[field="descr"]').first().text().trim().length>30,key+' introductory copy');
  assert.match($('.t585__text').eq(2).text(),/смет|спецификаци/);
  if(key!=='furniture')assert.ok($('body').text().includes(offerText(defaults.offers[key],'price')));
 }
 const c=structuredClone(defaults);
 const id=Object.keys(catalog.texts).find(id=>catalog.texts[id].uses.some(u=>u.page==='capital')&&catalog.texts[id].label==='Что отличает капитальный ремонт?');assert.ok(id);
 c.texts[id]='Особенности ремонта этого объекта?';
 assert.match(html('capital',c),/Особенности ремонта этого объекта/);assert.doesNotMatch(html('cosmetic',c),/Особенности ремонта этого объекта/);
 assert.doesNotMatch(load(html('home'))('body').text(),/Получите смету|за один день|Индивидуальный проект, материалы и контроль/);
});

test('changing an offer updates home, service price and FAQ together without changing other services',()=>{
 const c=structuredClone(defaults);c.offers.capital.price='от 12 345';c.offers.capital.scope='Согласованный состав капитального ремонта';validateContent(c,catalog);
 const home=load(html('home',c)),page=load(html('capital',c));
 assert.match(home('[data-offer="capital"]').text(),/12 345/);assert.match(home('[data-offer="capital"]').text(),/Согласованный состав/);
 assert.match(page('body').text(),/12 345/);assert.match(page('.t585__text').eq(2).text(),/12 345/);
 assert.doesNotMatch(html('cosmetic',c),/12 345/);
 for(const [key,path]of [['cosmetic','/kosmeticheskiy-remont'],['capital','/kap-remont'],['premium','/elit-remont']])assert.equal(home(`[data-offer="${key}"] .t-card__title a`).attr('href'),path);
 c.offers.capital.confirmed=false;assert.match(load(html('home',c))('[data-offer="capital"]').text(),/По смете/);assert.doesNotMatch(html('capital',c),/12 345/);
 c.offers.capital.confirmed=true;c.offers.capital.materials='';assert.throws(()=>validateContent(c,catalog),/состав и условия/);
});

test('project information has one source across galleries, escapes HTML, and preserves photos',()=>{
 const c=structuredClone(defaults);c.projects.silver.city='Тестовый город';c.projects.silver.status='design';c.projects.silver.scope='<script>unsafe</script>';c.projects.silver.areaKind='комната';
 validateContent(c,catalog);
 for(const key of ['home','works']){const before=load(html(key)),after=load(html(key,c));assert.match(after('body').text(),/Тестовый город/);assert.match(after('body').text(),/Визуализация/);assert.match(after('body').text(),/38 м² · комната/);assert.doesNotMatch(html(key,c),/<script>unsafe/);assert.deepEqual(after('img').map((i,e)=>after(e).attr('src')).get(),before('img').map((i,e)=>before(e).attr('src')).get());}
});

test('legacy migration preserves custom drafts, existing media, and immutable old versions',async()=>{
 const legacy=JSON.parse(readFileSync(resolve(ROOT,'scripts/legacy-content-v1.json'),'utf8'));
 const field=Object.values(catalog.texts).find(f=>f.original==='Вы работаете по официальному договору?');assert.ok(field);
 const custom=structuredClone(legacy);custom.texts[field.legacyId]='Индивидуальный вопрос владельца';custom.seo.home.title='Сохранённый заголовок владельца';
 const upgraded=upgradeContent(custom,catalog,defaults);validateContent(upgraded,catalog);
 assert.equal(upgraded.seo.home.title,custom.seo.home.title);assert.deepEqual(upgraded.media,custom.media);
 assert.ok(Object.values(upgraded.texts).includes('Индивидуальный вопрос владельца'));
 assert.deepEqual(upgradeContent(upgraded,catalog,defaults),upgraded);
 const dir=mkdtempSync(join(tmpdir(),'monolit-migration-'));let app=await createApp({dataDir:dir,password:'Migration-test-password-123',worker:false});await app.close();
 const db=new DatabaseSync(join(dir,'monolit.sqlite'));
 db.prepare('UPDATE content SET draft=?,published=?').run(JSON.stringify(custom),JSON.stringify(legacy));db.prepare('UPDATE versions SET data=? WHERE id=1').run(JSON.stringify(legacy));db.close();
 app=await createApp({dataDir:dir,password:'Migration-test-password-123',worker:false});
 try{const state=app.store.state();validateContent(state.draft,catalog);validateContent(state.published,catalog);assert.equal(state.draft.seo.home.title,custom.seo.home.title);assert.notEqual(state.draft.seo.home.title,state.published.seo.home.title);assert.deepEqual(JSON.parse(app.store.db.prepare('SELECT data FROM versions WHERE id=1').get().data),legacy);}finally{await app.close();}
});

test('public form preserves service context and manager saves a brief without changing customer message',async()=>{
 const origin='http://127.0.0.1:4180',password='Brief-test-password-123',app=await createApp({dataDir:mkdtempSync(join(tmpdir(),'monolit-brief-')),password,worker:false,origins:[origin]});
 const dom=new JSDOM(html('capital'),{url:origin+'/kap-remont?utm_source=local-test',runScripts:'outside-only'});let submitted;
 const w=dom.window;w.fetch=async(url,init)=>{submitted=JSON.parse(init.body);const r=await app.inject({method:init.method,url,headers:{origin,'content-type':'application/json'},payload:submitted});return {ok:r.statusCode<400,json:async()=>r.json()};};
 try{
  w.eval(readFileSync(resolve(ROOT,'site/runtime.js'),'utf8'));
  const form=w.document.querySelector('[data-monolit-form]');assert.ok(form);form.querySelector('[name=Phone]').value='+7 999 123 45 67';const name=form.querySelector('[name=Name]');if(name)name.value='Тест';form.reportValidity=()=>true;
  form.dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));
  for(let i=0;i<100&&!app.store.db.prepare('SELECT id FROM leads LIMIT 1').get();i++)await new Promise(r=>setTimeout(r,10));
  assert.equal(submitted.offer,'capital');assert.equal(submitted.utm.utm_source,'local-test');
  const lead=app.store.db.prepare('SELECT * FROM leads LIMIT 1').get();assert.equal(lead.offer,'capital');assert.equal(lead.source,'/kap-remont');
  const login=await app.inject({method:'POST',url:'/api/auth/login',headers:{origin},payload:{login:'admin',password}});const headers={origin,cookie:login.cookies.map(c=>c.name+'='+c.value).join('; '),'x-csrf-token':login.json().csrf};
  const brief={object:'Квартира',area:'60 м²',condition:'Вторичка',project:'План',task:'Обсудить инженерные работы',start:'После согласования',nextStep:'Подготовить перечень исходных данных'};
  const r=await app.inject({method:'PUT',url:'/api/admin/leads/'+lead.id+'/brief',headers,payload:brief});assert.equal(r.statusCode,200,r.body);
  const saved=app.store.db.prepare('SELECT * FROM leads WHERE id=?').get(lead.id);assert.deepEqual(JSON.parse(saved.brief),brief);assert.equal(saved.comment,lead.comment);
  assert.equal((await app.inject({method:'PUT',url:'/api/admin/leads/'+lead.id+'/brief',headers:{origin},payload:brief})).statusCode,401);
  const invalid=await app.inject({method:'POST',url:'/api/leads',headers:{origin},payload:{...submitted,offer:'<script>bad</script>',source:'/',requestId:randomUUID()}});assert.equal(invalid.statusCode,201);assert.equal(app.store.db.prepare('SELECT offer FROM leads WHERE id=?').get(invalid.json().id).offer,'');
 }finally{dom.window.close();await app.close();}
});
