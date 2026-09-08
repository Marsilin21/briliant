import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,readFileSync,existsSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {createHash,randomUUID} from 'node:crypto';
import {load} from 'cheerio';
import sharp from 'sharp';
import {backup,DatabaseSync} from 'node:sqlite';
import {createApp} from '../server/app.mjs';
import {ROOT,PAGES} from '../server/content.mjs';
import {secureEqual} from '../server/auth.mjs';
import {deliveryWorker,mergeSettings} from '../server/notify.mjs';
let app,admin,manager,dir;
const origin='http://127.0.0.1:4180',password='Test-password-37-long';
const json=r=>{assert.match(r.headers['content-type'],/application\/json/);return r.json();};
const call=(method,url,body,who=admin,extra={})=>app.inject({method,url,headers:{origin,...(who?{cookie:who.cookie,'x-csrf-token':who.csrf}:{}),...extra},...(body?{payload:body}: {})});
async function login(name,pass=password){const r=await call('POST','/api/auth/login',{login:name,password:pass},null);assert.equal(r.statusCode,200,r.body);return {...r.json(),cookie:r.cookies.map(c=>c.name+'='+c.value).join('; ')};}
before(async()=>{dir=mkdtempSync(join(tmpdir(),'monolit-test-'));app=await createApp({dataDir:dir,password,worker:false,origins:[origin]});await app.ready();admin=await login('admin');});
after(async()=>{await app.close();});

test('public pages preserve source assets, section order, logo files and readable SEO',async()=>{
 const manifest=JSON.parse(readFileSync(resolve(ROOT,'dist/source-manifest.json')));
 for(const [path,expected] of Object.entries({...manifest.files,...manifest.assets}))assert.equal(createHash('sha256').update(readFileSync(resolve(ROOT,path.replace(/^\//,'')))).digest('hex'),expected,path);
 const titles=new Set();
 for(const page of PAGES){const r=await call('GET',page.path);assert.equal(r.statusCode,200,page.path);const $=load(r.body),original=load(readFileSync(resolve(ROOT,page.file),'utf8'));
  assert.equal($('h1').length,1,page.key);assert.ok($('h1').text().trim());assert.ok($('meta[name="description"]').attr('content'));
  assert.equal($('link[rel="canonical"]').attr('href'),'https://brilliant-monolit.ru'+page.path);
  assert.ok(!titles.has($('title').text()));titles.add($('title').text());
  assert.deepEqual($('.r').map((_,e)=>$(e).attr('id')).get(),original('.r').map((_,e)=>original(e).attr('id')).get(),page.key+' section order');
  assert.deepEqual($('link[rel="stylesheet"]').map((_,e)=>$(e).attr('href')).get().filter(s=>s!=='/site/runtime.css').map(s=>s.replace(/^\//,'')),original('link[rel="stylesheet"]').map((_,e)=>original(e).attr('href')).get(),page.key+' original styles');
  assert.deepEqual($('style').map((_,e)=>$(e).html()).get(),original('style').map((_,e)=>original(e).html()).get(),page.key+' original inline styles');
  assert.equal($('img').length,original('img').length,page.key+' images');assert.equal($('script[src*="tilda-forms"]').length,0);
  assert.ok($('a[href]').length>10,page.key+' links');assert.doesNotMatch(r.body,/@@(?:TEXT|MEDIA|ALT)_/);
  const ld=JSON.parse($('script[type="application/ld+json"]').text());assert.ok(Array.isArray(ld));
 }
});
test('source inaccuracies corrected without importing ceiling business details',async()=>{
 const legal=(await call('GET','/rules')).body;assert.doesNotMatch(legal,/Вахранев|525804517612|тип потолка/);
 assert.doesNotMatch((await call('GET','/info')).body,/Кратко о процессе/);
 const $=load((await call('GET','/')).body);assert.doesNotMatch($('body').text(),/Европейские стандарты|свяжемся с вами в течение часа/);
});
test('private files and admin APIs are inaccessible without authentication',async()=>{
 for(const path of ['/api/admin/content','/api/admin/leads','/api/admin/users','/api/admin/settings/integrations','/api/admin/preview/home'])assert.equal((await call('GET',path,null,null)).statusCode,401,path);
 for(const path of ['/data/initial-admin.txt','/.env','/server/app.mjs','/dist/default-content.json','/_redesign/AUDIT.md','/files/page106667786body.html'])assert.equal((await call('GET',path,null,null)).statusCode,404,path);
 const r=await call('POST','/api/auth/login',{login:'admin',password},null,{origin:'https://evil.example'});assert.equal(r.statusCode,403);
 assert.equal(secureEqual('é'.repeat(64),'x'.repeat(64)),false);
});
test('CSRF protection rejects missing or malformed token',async()=>{
 const draft=json(await call('GET','/api/admin/content'));
 assert.equal((await call('PUT','/api/admin/content/draft',{content:draft.content,revision:draft.revision},admin,{'x-csrf-token':''})).statusCode,403);
 assert.equal((await call('PUT','/api/admin/content/draft',{content:draft.content,revision:draft.revision},admin,{'x-csrf-token':'x'.repeat(64)})).statusCode,403);
});
test('draft, preview, publication, metadata and restoration share a consistent version',async()=>{
 let d=json(await call('GET','/api/admin/content'));const originalVersion=d.version;
 const id=Object.keys(d.catalog.texts).find(k=>d.catalog.texts[k].original==='Премиальный сервис');assert.ok(id);
 d.content.texts[id]='Проверяемая правка <script>alert(1)</script>';
 d.content.seo.home.title='Ремонт квартир — проверка публикации';
 let r=await call('PUT','/api/admin/content/draft',{content:d.content,revision:d.revision});assert.equal(r.statusCode,200,r.body);const newRevision=r.json().revision;
 assert.doesNotMatch((await call('GET','/')).body,/Проверяемая правка/);
 const preview=await call('GET','/api/admin/preview/home');assert.match(preview.body,/Проверяемая правка &lt;script&gt;/);assert.match(preview.body,/noindex/);assert.doesNotMatch(preview.body,/<script>alert\(1\)/);
 assert.equal((await call('PUT','/api/admin/content/draft',{content:d.content,revision:d.revision})).statusCode,409);
 r=await call('POST','/api/admin/content/publish',{revision:newRevision});assert.equal(r.statusCode,200,r.body);
 const published=await call('GET','/');assert.match(published.body,/<title>Ремонт квартир — проверка публикации<\/title>/);assert.match(published.body,/Проверяемая правка &lt;script&gt;/);
 d=json(await call('GET','/api/admin/content'));r=await call('POST',`/api/admin/content/versions/${originalVersion}/restore`,{revision:d.revision});assert.equal(r.statusCode,200,r.body);
 assert.match((await call('GET','/')).body,/Проверяемая правка/);
 d=json(await call('GET','/api/admin/content'));assert.equal((await call('POST','/api/admin/content/publish',{revision:d.revision})).statusCode,200);
 assert.doesNotMatch((await call('GET','/')).body,/Проверяемая правка/);
});
test('invalid content and logo replacement cannot be published',async()=>{
 const d=json(await call('GET','/api/admin/content'));const id=Object.keys(d.catalog.media).find(k=>d.catalog.media[k].locked);d.content.media[id].url='/uploads/fake.webp';
 assert.equal((await call('PUT','/api/admin/content/draft',{content:d.content,revision:d.revision})).statusCode,400);
 d.content.media[id].url=d.catalog.media[id].url;delete d.content.texts[Object.keys(d.content.texts)[0]];
 assert.equal((await call('PUT','/api/admin/content/draft',{content:d.content,revision:d.revision})).statusCode,400);
});
test('manager can edit drafts and notes but cannot publish, delete or change integrations',async()=>{
 let r=await call('POST','/api/admin/users',{login:'manager',password,role:'manager'});assert.equal(r.statusCode,200);manager=await login('manager');
 const d=json(await call('GET','/api/admin/content',null,manager));assert.equal((await call('PUT','/api/admin/content/draft',{content:d.content,revision:d.revision},manager)).statusCode,200);
 for(const [method,path,body] of [['POST','/api/admin/content/publish',{revision:d.revision+1}],['POST','/api/admin/content/discard',{revision:d.revision+1}],['DELETE','/api/admin/leads/1',{}],['POST','/api/admin/users',{login:'fake',password,role:'admin'}],['PUT','/api/admin/settings/integrations',{}],['DELETE','/api/admin/media/not-real',{}]])assert.equal((await call(method,path,body,manager)).statusCode,403,path);
 assert.equal((await call('GET','/api/admin/settings/integrations',null,manager)).statusCode,403);
});
test('lead validation, honeypot, durable acceptance and deduplication',async()=>{
 const body={name:'Тестовый клиент',phone:'+7 (999) 123-45-67',comment:'Только тестовая БД',source:'/kap-remont',utm:{utm_source:'test',extra:'ignored'},consent:true,requestId:randomUUID()};
 let r=await call('POST','/api/leads',{...body,phone:'123'},null);assert.equal(r.statusCode,400);
 r=await call('POST','/api/leads',{...body,consent:false},null);assert.equal(r.statusCode,400);
 const before=app.store.db.prepare('SELECT count(*) n FROM leads').get().n;
 r=await call('POST','/api/leads',{...body,website:'bot.example'},null);assert.equal(r.statusCode,200);assert.equal(app.store.db.prepare('SELECT count(*) n FROM leads').get().n,before);
 r=await call('POST','/api/leads',body,null);assert.equal(r.statusCode,201,r.body);const id=r.json().id;
 r=await call('POST','/api/leads',body,null);assert.equal(r.statusCode,200);assert.equal(r.json().id,id);
 const lead=app.store.db.prepare('SELECT * FROM leads WHERE id=?').get(id);assert.equal(lead.phone,'+79991234567');assert.equal(lead.source,'/kap-remont');assert.deepEqual(JSON.parse(lead.utm),{utm_source:'test'});
 assert.equal((await call('PATCH','/api/admin/leads/'+id,{status:'inwork',assignee:manager.user.id},manager)).statusCode,200);
 assert.equal((await call('POST','/api/admin/leads/'+id+'/notes',{text:'Позвонить после уточнения'},manager)).statusCode,200);
 const detail=json(await call('GET','/api/admin/leads/'+id));assert.equal(detail.notes.length,2);assert.equal(detail.lead.assignee,manager.user.id);
 assert.equal((await call('POST','/api/leads',{...body,requestId:randomUUID()},null)).statusCode,429);
});
test('notifications fail independently and retry without losing a saved lead',async()=>{
 const db=app.store.db,lead=db.prepare('SELECT * FROM leads LIMIT 1').get();
 const prior=app.store.settings();db.prepare('UPDATE settings SET data=?').run(JSON.stringify({telegram:{enabled:true},bitrix:{enabled:true},email:{enabled:true}}));
 for(const channel of ['telegram','bitrix','email'])db.prepare('INSERT INTO deliveries(lead_id,channel) VALUES(?,?)').run(lead.id,channel);
 const calls=[];const worker=deliveryWorker(app.store,{sender:async channel=>{calls.push(channel);if(channel==='telegram')throw Error('simulated');}});await worker();
 const deliveries=db.prepare('SELECT * FROM deliveries WHERE lead_id=?').all(lead.id);assert.equal(deliveries.find(d=>d.channel==='telegram').status,'retry');assert.equal(deliveries.find(d=>d.channel==='email').status,'sent');assert.equal(deliveries.find(d=>d.channel==='bitrix').status,'sent');assert.equal(calls.length,3);assert.ok(db.prepare('SELECT * FROM leads WHERE id=?').get(lead.id));
 db.prepare('UPDATE settings SET data=?').run(JSON.stringify(prior));
});
test('integration secrets stay server side and external addresses are constrained',async()=>{
 const settings=app.store.settings();settings.telegram.token='123456789:abcdefghijklmnopqrstuvwxyz123456';settings.telegram.chatId='-100123456789';settings.telegram.enabled=true;
 const r=await call('PUT','/api/admin/settings/integrations',settings);assert.equal(r.statusCode,200,r.body);const read=json(await call('GET','/api/admin/settings/integrations')).settings;assert.equal(read.telegram.token,'');assert.equal(read.telegram.tokenConfigured,true);assert.doesNotMatch(JSON.stringify(read),/abcdefghijklmnopqrstuvwxyz/);
 assert.equal(mergeSettings(read,settings).telegram.token,settings.telegram.token);
 assert.throws(()=>mergeSettings({...settings,bitrix:{enabled:true,url:'https://127.0.0.1/rest/1/test/'}},settings));
 settings.telegram.enabled=false;app.store.db.prepare('UPDATE settings SET data=?').run(JSON.stringify(settings));
});
test('image upload validates bytes, optimizes pictures and rejects fake images',async()=>{
 const image=await sharp({create:{width:50,height:30,channels:3,background:'#d4ad72'}}).png().toBuffer();
 const upload=async(bytes,name)=>{const boundary='----monolit'+randomUUID();const body=Buffer.concat([Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${name}"\r\nContent-Type: image/png\r\n\r\n`),bytes,Buffer.from(`\r\n--${boundary}--\r\n`)]);return app.inject({method:'POST',url:'/api/admin/media',headers:{origin,cookie:admin.cookie,'x-csrf-token':admin.csrf,'content-type':'multipart/form-data; boundary='+boundary},payload:body});};
 const bad=await upload(Buffer.from('<svg onload="alert(1)"></svg>'),'fake.png');assert.equal(bad.statusCode,400);
 const good=await upload(image,'picture.png');assert.equal(good.statusCode,201,good.body);const m=good.json();assert.match(m.url,/\.webp$/);assert.equal((await call('GET',m.url,null,null)).statusCode,200);
 let d=json(await call('GET','/api/admin/content'));const id=Object.keys(d.catalog.media).find(k=>!d.catalog.media[k].locked);d.content.media[id].url=m.url;
 assert.equal((await call('PUT','/api/admin/content/draft',{content:d.content,revision:d.revision})).statusCode,200);
 assert.equal((await call('DELETE','/api/admin/media/'+m.id,{})).statusCode,409);
 d=json(await call('GET','/api/admin/content'));assert.equal((await call('POST','/api/admin/content/discard',{revision:d.revision})).statusCode,200);
 assert.equal((await call('DELETE','/api/admin/media/'+m.id,{})).statusCode,200);
});
test('legacy URLs redirect to equivalents, sitemap uses HTTPS and unknown URL returns 404',async()=>{
 for(const page of PAGES.filter(p=>!p.generated)){const r=await call('GET','/'+page.file,null,null);assert.equal(r.statusCode,301);assert.equal(r.headers.location,page.path);}
 assert.equal((await call('GET','/kap-remont/',null,null)).headers.location,'/kap-remont');
 assert.equal((await call('GET','/missing-real-page',null,null)).statusCode,404);
 const map=await call('GET','/sitemap.xml');assert.match(map.body,/https:\/\/brilliant-monolit.ru/);assert.doesNotMatch(map.body,/<loc>http:/);assert.doesNotMatch(map.body,/<loc>[^<]*\/admin/);
 assert.equal((await call('GET','/robots.txt')).body,'User-agent: *\nDisallow: /\n');
});
test('SQLite backup produces a restorable consistent snapshot',async()=>{
 const path=join(dir,'backup.sqlite');await backup(app.store.db,path);assert.ok(existsSync(path));const restored=new DatabaseSync(path);assert.equal(restored.prepare('PRAGMA integrity_check').get().integrity_check,'ok');assert.equal(restored.prepare('SELECT count(*) n FROM leads').get().n,app.store.db.prepare('SELECT count(*) n FROM leads').get().n);restored.close();
});
test('sessions are revoked when an account is disabled',async()=>{
 assert.equal((await call('PATCH','/api/admin/users/'+manager.user.id,{active:false,role:'manager'})).statusCode,200);
 assert.equal((await call('GET','/api/admin/content',null,manager)).statusCode,401);
 assert.equal((await call('PATCH','/api/admin/users/'+admin.user.id,{active:false,role:'admin'})).statusCode,400);
});
