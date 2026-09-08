import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,mkdtempSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {load} from 'cheerio';
import {createApp} from '../server/app.mjs';
import {PAGES,loadCatalog,renderPage,validateContent,esc} from '../server/content.mjs';
import {upgradeContent} from '../server/migrate-content.mjs';
import {linkedText} from '../server/linked-text.mjs';
import {seoPlan,answerLinks} from '../site/seo-plan.mjs';
const catalog=loadCatalog(),defaults=JSON.parse(readFileSync('dist/default-content.json','utf8'));
const html=(key,c=defaults)=>renderPage(PAGES.find(p=>p.key===key),c,catalog,{origin:'https://brilliant-monolit.ru',production:true});

test('semantic destinations are unique and new landing pages are reachable through contextual HTML links',async()=>{
 const queries=new Set();
 for(const group of Object.values(seoPlan))for(const query of group.queries){assert.ok(!queries.has(query),'Query assigned twice: '+query);queries.add(query);assert.ok(PAGES.some(p=>p.path===group.path));}
 const links=new Map();
 for(const page of PAGES){const $=load(html(page.key));links.set(page.path,$('.t585__text a').map((_,a)=>$(a).attr('href')).get());
  for(const [index,pairs]of Object.entries(answerLinks[page.key]||{}))for(const[,url]of pairs)assert.ok($('.t585__text').eq(Number(index)).find('a').toArray().some(a=>$(a).attr('href')===url),page.key+' -> '+url);
 }
 assert.ok(links.get('/').includes('/remont-v-novostroyke'));assert.ok(links.get('/').includes('/remont-vtorichnogo-zhilya'));
 const app=await createApp({dataDir:mkdtempSync(join(tmpdir(),'monolit-seo-')),password:'Seo-test-password-2048',worker:false});
 try{
  for(const url of new Set([...links.values()].flat()))assert.equal((await app.inject(url)).statusCode,200,url);
  const sitemap=(await app.inject('/sitemap.xml')).body;
  for(const key of ['newbuild','resale']){const p=PAGES.find(p=>p.key===key);assert.ok(sitemap.includes('https://brilliant-monolit.ru'+p.path));assert.equal((await app.inject(p.path+'/')).headers.location,p.path);const $=load((await app.inject(p.path)).body);assert.equal($('link[rel=canonical]').attr('href'),'https://brilliant-monolit.ru'+p.path);assert.match($('meta[name=robots]').attr('content'),/noindex/);}
  assert.equal((await app.inject('/page115136766.html')).headers.location,'/kap-remont');
 }finally{await app.close();}
});

test('new landings address different starting conditions and do not inherit the capital repair price',()=>{
 const a=load(html('newbuild')),b=load(html('resale'));
 assert.equal(a('h1').text(),'Ремонт в новостройке');assert.equal(b('h1').text(),'Ремонт вторичного жилья');
 assert.match(a('.t585__text').text(),/застройщика/);assert.match(b('.t585__text').text(),/скрытые|демонтаж/);
 const first=a('.t585__title').map((_,e)=>a(e).text()).get(),second=b('.t585__title').map((_,e)=>b(e).text()).get();assert.equal(first.length,10);assert.equal(second.length,10);assert.ok(first.filter(q=>second.includes(q)).length<3);
 for(const $ of [a,b]){assert.doesNotMatch($('[field=descr]').first().text(),/9 000|10 000/);assert.ok($('[field=descr]').first().text().trim().length>40);}
});

test('internal linking cannot turn editor HTML into executable markup and follows edited text',()=>{
 const text='Дизайн-проект <img src=x onerror=alert(1)> & детали';
 const rendered=linkedText(text,[['Дизайн-проект','/design']],esc);assert.match(rendered,/<a href="\/design">Дизайн-проект<\/a>/);assert.doesNotMatch(rendered,/<img/);assert.match(rendered,/&lt;img/);
 assert.equal(linkedText('Переписанный ответ',[['Дизайн-проект','/design']],esc),'Переписанный ответ');
 assert.throws(()=>linkedText('ссылка',[['ссылка','javascript:alert(1)']],esc));
});

test('SEO expansion preserves edited texts, prices and noindex while importing new pages and untouched defaults',()=>{
 const prior=JSON.parse(readFileSync('scripts/seo-baseline-v2.json','utf8'));
 prior.seo.design.title='Заголовок владельца';prior.seo.capital.noindex=true;prior.offers.capital.price='от 12 300';
 const id=Object.keys(catalog.texts).find(id=>catalog.texts[id].uses.some(u=>u.page==='home')&&catalog.texts[id].links?.some(([,url])=>url==='/remont-v-novostroyke'));assert.ok(id);prior.texts[id]='Сохранённый ответ владельца';
 const migrated=upgradeContent(prior,catalog,defaults);validateContent(migrated,catalog);
 assert.equal(migrated.seo.design.title,'Заголовок владельца');assert.equal(migrated.seo.capital.noindex,true);assert.equal(migrated.offers.capital.price,'от 12 300');assert.equal(migrated.texts[id],'Сохранённый ответ владельца');
 assert.equal(migrated.seo.home.title,defaults.seo.home.title);assert.ok(migrated.seo.newbuild&&migrated.seo.resale);assert.deepEqual(upgradeContent(migrated,catalog,defaults),migrated);
});
