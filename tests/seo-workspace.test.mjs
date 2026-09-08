import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {load} from 'cheerio';
import {createApp} from '../server/app.mjs';
import {PAGES} from '../server/content.mjs';
import {seedWorkspace,validateWorkspace} from '../server/seo-workspace.mjs';
const origin='http://127.0.0.1:4180',canonical='https://brilliant-monolit.ru',password='SEO-isolated-tests-2026';
async function fixture(){
 const dir=mkdtempSync(join(tmpdir(),'monolit-seo-work-')),app=await createApp({dataDir:dir,password,origins:[origin],worker:false});
 const login=await app.inject({method:'POST',url:'/api/auth/login',headers:{origin},payload:{login:'admin',password}});
 assert.equal(login.statusCode,200);const headers={origin,cookie:login.cookies.map(c=>c.name+'='+c.value).join('; '),'x-csrf-token':login.json().csrf};
 const call=(method,url,payload)=>app.inject({method,url,headers,...(payload?{payload}:{})});
 return {app,dir,call,headers};
}
test('SEO plan validates hierarchy, evidence, measured zero and unsafe URLs',()=>{
 const w=seedWorkspace();validateWorkspace(w,PAGES,canonical);assert.equal(w.measurements.length,88);assert.equal(w.placements.length,18);
 const mutate=fn=>{const c=structuredClone(w);fn(c);return ()=>validateWorkspace(c,PAGES,canonical);};
 assert.throws(mutate(c=>{c.placements[0].url='javascript:alert(1)';}));
 assert.throws(mutate(c=>{c.placements[1].parent=c.placements[3].id;}),/предыдущий уровень/);
 assert.throws(mutate(c=>{c.placements[0].parent=c.placements[2].id;}),/предыдущий уровень/);
 assert.throws(mutate(c=>{c.placements[0].status='published';}),/опубликованной/);
 assert.throws(mutate(c=>{c.measurements[0].frequency=0;}),/частотности/);
 assert.throws(mutate(c=>{c.measurements[0].source='https://u:secret@example.org';}));
 const m=w.measurements[0];Object.assign(m,{frequency:0,period:'2026-08',operator:'"!ремонт !квартир"',source:'https://wordstat.yandex.ru/',checkedAt:'2026-09-08'});validateWorkspace(w,PAGES,canonical);
 Object.assign(w.placements[0],{status:'published',url:'https://example.org/article',publishedAt:'2026-09-08',checkedAt:'2026-09-08',evidence:'https://example.org/article'});validateWorkspace(w,PAGES,canonical);
 Object.assign(w.placements[1],{status:'published',url:'https://example.net/related',publishedAt:'2026-09-08',checkedAt:'2026-09-08',evidence:'https://example.net/related'});validateWorkspace(w,PAGES,canonical);
 w.placements[0].status='lost';assert.throws(()=>validateWorkspace(w,PAGES,canonical),/опубликованной/);
});
test('SEO workspace is private, role protected, revision checked and persists independently from publication',async()=>{
 const {app,dir,call,headers}=await fixture();
 try{
  assert.equal((await app.inject('/api/admin/seo/workspace')).statusCode,401);
  assert.equal((await app.inject('/api/admin/seo/report')).statusCode,401);
  const state=app.store.state(),w=(await call('GET','/api/admin/seo/workspace')).json();
  w.data.campaigns[0].notes='Private SEO test note';
  assert.equal((await app.inject({method:'PUT',url:'/api/admin/seo/workspace',headers:{origin,cookie:headers.cookie},payload:{data:w.data,revision:w.revision}})).statusCode,403);
  assert.equal((await call('PUT','/api/admin/seo/workspace',{data:w.data,revision:w.revision})).statusCode,200);
  assert.equal((await call('PUT','/api/admin/seo/workspace',{data:w.data,revision:w.revision})).statusCode,409);
  assert.equal(app.store.state().version,state.version);assert.deepEqual(app.store.state().published,state.published);
  assert.doesNotMatch((await app.inject('/')).body,/Private SEO test note/);
  app.store.db.prepare("UPDATE users SET role='manager' WHERE login='admin'").run();
  assert.equal((await call('GET','/api/admin/seo/workspace')).statusCode,200);
  assert.equal((await call('PUT','/api/admin/seo/workspace',{data:w.data,revision:w.revision+1})).statusCode,403);
 }finally{await app.close();}
 const reopened=await createApp({dataDir:dir,password,origins:[origin],worker:false});
 try{assert.equal(JSON.parse(reopened.store.db.prepare('SELECT data FROM seo_workspace').get().data).campaigns[0].notes,'Private SEO test note');}finally{await reopened.close();}
});
test('internal links publish and restore safely; sitemap uses only changed public page dates',async()=>{
 const {app,call}=await fixture();
 try{
  const initial=app.store.state(),initialMap=(await app.inject('/sitemap.xml')).body;
  assert.deepEqual((await call('GET','/api/admin/seo/report')).json().issues,[]);
  const $=load((await app.inject('/')).body),link=initial.draft.internalLinks.find(l=>l.source==='home');assert.ok($('.t585__text a[href="'+link.target+'"]').length);
  const draft=structuredClone(initial.draft);draft.internalLinks.find(l=>l.id===link.id).enabled=false;draft.seo.design.noindex=true;
  let response=await call('PUT','/api/admin/content/draft',{content:draft,revision:initial.revision});assert.equal(response.statusCode,200,response.body);
  assert.equal((await app.inject('/sitemap.xml')).body,initialMap);
  assert.ok(load((await app.inject('/')).body)('.t585__text a[href="'+link.target+'"]').length);
  const privatePreview=await call('GET','/api/admin/preview/home');assert.equal(load(privatePreview.body)('.t585__text a[href="'+link.target+'"]').length,0);
  const report=await call('POST','/api/admin/seo/inspect',{content:draft});assert.equal(report.statusCode,200,report.body);assert.ok(report.json().issues.some(i=>i.message.includes('закрыта от поиска')));
  const oldDates=app.store.db.prepare('SELECT * FROM seo_page_dates').all();
  response=await call('POST','/api/admin/content/publish',{revision:app.store.state().revision});assert.equal(response.statusCode,200,response.body);
  assert.equal(load((await app.inject('/')).body)('.t585__text a[href="'+link.target+'"]').length,0);
  const map=(await app.inject('/sitemap.xml')).body;assert.doesNotMatch(map,/<loc>https:\/\/brilliant-monolit.ru\/design<\/loc>/);assert.doesNotMatch(map,/\/admin|\/api|\/rules|example.org/);
  for(const old of oldDates){const now=app.store.db.prepare('SELECT * FROM seo_page_dates WHERE page=?').get(old.page);if(['home','design'].includes(old.page)){assert.notEqual(now.hash,old.hash);assert.notEqual(now.modified_at,old.modified_at);}else assert.deepEqual(now,old);}
  const hostile=structuredClone(draft);hostile.internalLinks[0].target='//evil.example';assert.equal((await call('PUT','/api/admin/content/draft',{content:hostile,revision:app.store.state().revision})).statusCode,400);
  const missing=structuredClone(draft);missing.internalLinks[0].enabled=true;missing.internalLinks[0].anchor='Фраза которой нет';const missingReport=await call('POST','/api/admin/seo/inspect',{content:missing});assert.ok(missingReport.json().issues.some(i=>i.message.includes('Фраза отсутствует')));
  response=await call('POST',`/api/admin/content/versions/${initial.version}/restore`,{revision:app.store.state().revision});assert.equal(response.statusCode,200,response.body);
  assert.ok(app.store.state().draft.internalLinks.find(l=>l.id===link.id).enabled);assert.match(map,/<lastmod>/);
 }finally{await app.close();}
});
