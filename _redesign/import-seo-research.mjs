import {readFileSync,writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import {seoPlan} from '../site/seo-plan.mjs';
const origin='http://127.0.0.1:4180';
const credentials=readFileSync('data/initial-admin.txt','utf8');
const login=credentials.match(/^Вход:\s*(.+)$/m)?.[1].trim(),password=credentials.match(/^Пароль:\s*(.+)$/m)?.[1].trim();
if(!login||!password)throw Error('Local credential file format unavailable');
const auth=await fetch(origin+'/api/auth/login',{method:'POST',headers:{origin,'content-type':'application/json'},body:JSON.stringify({login,password})});
if(!auth.ok)throw Error('Login failed: '+auth.status);
const cookie=auth.headers.getSetCookie().map(c=>c.split(';')[0]).join('; '),{csrf}=await auth.json();
const headers={origin,cookie,'content-type':'application/json','x-csrf-token':csrf};
async function call(path,method='GET',body){const r=await fetch(origin+path,{method,headers,...(body?{body:JSON.stringify(body)}:{})});if(!r.ok)throw Error('Request failed '+path+': '+r.status);return r.json();}
try{
 const prior=await call('/api/admin/seo/workspace');
 writeFileSync('_redesign/SEO_WORKSPACE_BEFORE_RESEARCH.json',JSON.stringify(prior,null,2)+'\n');
 const contentBefore=await call('/api/admin/content');
 const report=JSON.parse(readFileSync('site/seo-research.json','utf8'));
 const data=structuredClone(prior.data);
 for(const measurement of report.wordstat.measurements){
  const existing=data.measurements.find(m=>m.id===measurement.id);
  if(existing){assert.equal(existing.query,measurement.query,'Query changed since measurement');if(existing.frequency!==null&&existing.checkedAt!=='2026-09-08')throw Error('Preserve existing measurement '+existing.id);Object.assign(existing,measurement);}
  else {if(!measurement.id.startsWith('research-'))throw Error('Original query deleted '+measurement.id);data.measurements.push(measurement);}
 }
 const targets={capital:'research-capital-5',newbuild:'research-newbuild-1',resale:'research-resale-3',supervision:'research-supervision-12'};
 for(const c of data.campaigns){
  const decisions=report.decisions.filter(d=>d.pages.includes(c.page));
  if(!decisions.length)continue;
  const target=report.wordstat.measurements.find(m=>m.id===targets[c.page]);
  if(target&&c.query===seoPlan[c.page]?.queries[0])c.query=target.query;
  const m=data.measurements.find(m=>m.page===c.page&&m.query===c.query);
  const prefix='\n\n[Исследование 08.09.2026]\n';
  const note=(m?`Целевой запрос: «${m.query}» — ${m.frequency} по фразе в кавычках; ${m.region}; ${m.period}. `:'')+decisions.map(d=>d.action+' '+d.overlap+'/10 общих URL.').join(' ')+' Подробности: вкладка «Исследование выдачи». Это выборка Яндекса; внешние ссылки ещё не опубликованы.';
  c.notes=c.notes.split(prefix)[0]+prefix+note;
 }
 await call('/api/admin/seo/workspace/validate','POST',{data});
 const saved=await call('/api/admin/seo/workspace','PUT',{data,revision:prior.revision});
 const actual=await call('/api/admin/seo/workspace');
 assert.deepEqual(actual.data,data,'Persistent workspace differs');
 const contentAfter=await call('/api/admin/content');
 assert.deepEqual(contentAfter,contentBefore,'Public-site content changed unexpectedly');
 const qa={checkedAt:new Date().toISOString(),beforeRevision:prior.revision,afterRevision:actual.revision,measured:actual.data.measurements.filter(m=>m.frequency!==null).length,nonzero:actual.data.measurements.filter(m=>m.frequency>0).length,researchMeasurements:report.wordstat.measurements.length,serpSamples:report.serp.samples.length,pairComparisons:report.serp.pairs.length,placementsUnchanged:JSON.stringify(data.placements)===JSON.stringify(prior.data.placements),siteContentUnchanged:true,sourceTranscription:report.verification,readbackMatches:true};
 writeFileSync('_redesign/SEO_RESEARCH_QA.json',JSON.stringify(qa,null,2)+'\n');
 writeFileSync('_redesign/SEO_WORKSPACE_MEASURED.json',JSON.stringify(actual.data,null,2)+'\n');
 console.log(qa);
}finally{await fetch(origin+'/api/auth/logout',{method:'POST',headers});}
