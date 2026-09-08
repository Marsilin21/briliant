import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,mkdtempSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {load} from 'cheerio';
import {PAGES,renderPage,loadCatalog,validateContent} from '../server/content.mjs';
import {upgradeContent} from '../server/migrate-content.mjs';
import {createApp} from '../server/app.mjs';
import sharp from 'sharp';
import {JSDOM} from 'jsdom';
const catalog=loadCatalog(),defaults=JSON.parse(readFileSync('dist/default-content.json','utf8'));
const render=(key,c=defaults)=>load(renderPage(PAGES.find(p=>p.key===key),c,catalog,{origin:'https://brilliant-monolit.ru',production:true}));

test('Tilda popup layout helpers and city map work without the legacy submission SDK or eval',()=>{
 const dom=new JSDOM('<div id="rec123"><div class="t-map" data-map-zoom="12"></div></div>',{runScripts:'outside-only'});
 try{
  const layout=readFileSync('site/tilda-layout.js','utf8'),map=readFileSync('site/tilda-map-compatible.js','utf8');
  assert.doesNotMatch(layout,/XMLHttpRequest|fetch\(|t_forms__send/);
  assert.doesNotMatch(map,/eval\(|api-maps\.yandex/);
  dom.window.eval(layout);
  assert.equal(typeof dom.window.t_forms__calculateInputsWidth,'function');
  assert.equal(typeof dom.window.t_forms__calculateFieldsWidthInJS,'function');
  dom.window.arMapMarkers123=[{lat:56.326797,lng:44.006516,title:'Нижний Новгород'}];
  dom.window.eval(map);dom.window.t_appendYandexMap('123');dom.window.t_appendYandexMap('123');
  const frames=dom.window.document.querySelectorAll('iframe');assert.equal(frames.length,1);
  assert.equal(new URL(frames[0].src).searchParams.get('ll'),'44.006516,56.326797');
  assert.equal(frames[0].title,'Карта: Нижний Новгород');
  const $=render('contacts');assert.equal($('script[src="/site/tilda-layout.js"]').length,1);
  assert.equal($('script[src="/site/tilda-map-compatible.js"]').length,1);
 }finally{dom.window.close();}
});

test('lossless image delivery preserves source pixels, negotiates formats and honors cache validators',async()=>{
 const manifest=JSON.parse(readFileSync('dist/optimized-images/manifest.json','utf8'));assert.ok(Object.keys(manifest).length);
 const app=await createApp({dataDir:mkdtempSync(join(tmpdir(),'monolit-images-')),password:'Image-test-isolated-2026',worker:false});
 try{
  for(const [path,entry] of Object.entries(manifest)){
   const original=readFileSync('.'+path),response=await app.inject({url:path,headers:{accept:'image/webp,image/*;q=0.8'}});
   assert.equal(response.statusCode,200);assert.equal(response.headers['content-type'],'image/webp');assert.equal(response.headers.vary,'Accept');assert.ok(response.rawPayload.length<original.length);
   assert.deepEqual(await sharp(response.rawPayload).ensureAlpha().raw().toBuffer(),await sharp(original).ensureAlpha().raw().toBuffer());
   assert.equal((await app.inject({url:path,headers:{accept:'image/webp;q=0,image/png'}})).headers['content-type'],'image/png');
   const head=await app.inject({method:'HEAD',url:path,headers:{accept:'image/webp'}});assert.equal(Number(head.headers['content-length']),entry.optimizedBytes);assert.equal(head.rawPayload.length,0);
   assert.equal((await app.inject({url:path,headers:{accept:'image/webp','if-none-match':response.headers.etag}})).statusCode,304);
  }
 }finally{await app.close();}
});

test('editorial upgrade preserves custom offer conditions, page copy and rollback history shape',()=>{
 const baseline=JSON.parse(readFileSync('scripts/editorial-baseline-v3.json','utf8'));
 const field=Object.keys(catalog.texts).find(id=>baseline.texts[id]&&catalog.texts[id].uses.some(u=>u.page==='design')&&baseline.texts[id]!==defaults.texts[id]);assert.ok(field);
 baseline.texts[field]='Ручная редактура заказчика';baseline.offers.supervision.basis='Согласованные условия владельца';baseline.offers.capital.price='от 12 300';
 const result=upgradeContent(baseline,catalog,defaults);validateContent(result,catalog);
 assert.equal(result.texts[field],'Ручная редактура заказчика');assert.equal(result.offers.supervision.basis,baseline.offers.supervision.basis);assert.equal(result.offers.capital.price,'от 12 300');
 assert.equal(result.offers.design.materials,defaults.offers.design.materials);assert.deepEqual(upgradeContent(result,catalog,defaults),result);
});

test('specialist services do not inherit repair payment or execution and home scope stays consistent',()=>{
 const nadzor=render('supervision'),design=render('design');
 assert.doesNotMatch(nadzor('.t585__text').eq(6).text(),/цены за квадратный метр|порядок оплаты работ и закупки/i);
 for(const $ of [nadzor,design]){
  const process=$('[field="btitle"]').filter((i,e)=>$(e).text().trim()==='ПРОЦЕСС РАБОТЫ').closest('.r');
  assert.doesNotMatch(process.text(),/Выполняем ремонт|Передаем готовый объект/);assert.equal(process.find('[field^="li_descr__"]').length,7);
 }
 assert.doesNotMatch(render('home')('body').text(),/Полный демонтаж|ОНЛАЙН-КОНТРОЛЬ/);
 for(const p of PAGES){const $=render(p.key);assert.equal($('a[href^="/#popup:"]').length,0);assert.equal($('a[href^="/"][target="_blank"]').length,0);}
 const schema=JSON.parse(design('script[type="application/ld+json"]').text());assert.equal(schema.filter(x=>x['@type']==='Service').length,1);
 assert.equal(schema.find(x=>x['@type']==='Service').description,defaults.offers.design.scope);
});

test('production mode exposes indexable pages but keeps legal, admin, drafts and leads protected',async()=>{
 const origin='https://brilliant-monolit.ru';
 const app=await createApp({dataDir:mkdtempSync(join(tmpdir(),'monolit-production-')),production:true,origins:[origin],password:'Isolated-release-test-2026',worker:false});
 try{
  const page=await app.inject('/design');assert.equal(page.statusCode,200);assert.match(load(page.body)('meta[name=robots]').attr('content'),/^index, follow/);
  const policy=await app.inject('/rules');assert.match(load(policy.body)('meta[name=robots]').attr('content'),/noindex/);
  assert.equal((await app.inject('/admin/')).headers['x-robots-tag'],'noindex, nofollow');
  assert.equal((await app.inject('/api/admin/preview/design')).statusCode,401);
  const lead=await app.inject({method:'POST',url:'/api/leads',headers:{origin},payload:{name:'Тест',phone:'+79991234567',consent:true,source:'/design',requestId:'test-production'}});
  assert.equal(lead.statusCode,503);assert.equal(app.store.db.prepare('SELECT count(*) AS count FROM leads').get().count,0);
 }finally{await app.close();}
});
