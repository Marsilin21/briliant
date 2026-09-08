import {readFileSync,writeFileSync,statSync,existsSync} from 'node:fs';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {load} from 'cheerio';
import {PAGES,ROOT,esc} from '../server/content.mjs';
const origin=process.env.AUDIT_ORIGIN||'http://127.0.0.1:4180';
if(!['127.0.0.1','localhost'].includes(new URL(origin).hostname))throw Error('Аудит предназначен для локального экземпляра');
const errors=[],pages=[],urls=new Set(),assets=new Set(),titles=new Set(),descriptions=new Set();
const check=(condition,message)=>{if(!condition)errors.push(message);};
for(const page of PAGES){
 const response=await fetch(origin+page.path);const html=await response.text(),$=load(html);
 const title=$('title').text().trim(),description=$('meta[name=description]').attr('content'),canonical=$('link[rel=canonical]').attr('href');
 check(response.status===200,page.path+': HTTP '+response.status);
 check($('h1').length===1&&$('h1').text().trim(),page.path+': H1');
 check($('title').length===1&&title&&!titles.has(title),page.path+': title');titles.add(title);
 check(description&&!descriptions.has(description),page.path+': description');descriptions.add(description);
 check(canonical==='https://brilliant-monolit.ru'+page.path,page.path+': canonical');
 check(/noindex/.test($('meta[name=robots]').attr('content')),page.path+': локальная индексация должна быть закрыта');
 check(!/@@(?:TEXT|MEDIA|ALT)_/.test(html),page.path+': незаменённое поле');
 try{JSON.parse($('script[type="application/ld+json"]').text());}catch{errors.push(page.path+': JSON-LD');}
 $('a[href]').each((_,a)=>{const href=$(a).attr('href');if(href.startsWith('/')){const u=new URL(href,origin);if(!u.pathname.startsWith('/api/'))urls.add(u.pathname);}});
 $('a[href]').each((_,a)=>{const href=$(a).attr('href');try{new URL(href,origin+page.path);}catch{errors.push(page.path+': некорректный href '+href);}});
 $('[src],[data-original],[data-content-cover-bg],link[rel=stylesheet]').each((_,e)=>{for(const attr of ['src','data-original','data-content-cover-bg',...(e.tagName==='link'?['href']:[])]){const value=$(e).attr(attr);if(value?.startsWith('/'))assets.add(value);}});
 const answers=$('.t585__text').map((_,e)=>$(e).text().trim()).get();
 pages.push({key:page.key,path:page.path,label:page.label,status:response.status,title,description,h1:$('h1').text().trim(),intro:$('[field=descr]').first().text().trim(),faqCount:answers.length,faqWords:answers.join(' ').split(/\s+/).filter(Boolean).length,contextLinks:$('.t585__text a').length,forms:$('[data-monolit-form]').length,htmlBytes:Buffer.byteLength(html),questions:$('.t585__title').map((_,e)=>$(e).text().trim()).get(),answers});
}
const checks=[...new Set([...urls,...assets])],responses=[];
for(let i=0;i<checks.length;i+=8)responses.push(...await Promise.all(checks.slice(i,i+8).map(async path=>{try{const r=await fetch(origin+path,{method:'HEAD',signal:AbortSignal.timeout(15000)});check(r.ok,path+': HTTP '+r.status);return {path,status:r.status};}catch(e){errors.push(path+': '+e.message);return {path,status:0};}})));
const redirects=[];
for(const page of PAGES.filter(p=>!p.generated)){const response=await fetch(origin+'/'+page.file,{redirect:'manual'});check(response.status===301&&response.headers.get('location')===page.path,'Редирект '+page.file);redirects.push({from:'/'+page.file,to:response.headers.get('location'),status:response.status});}
const sitemap=await (await fetch(origin+'/sitemap.xml')).text();
for(const p of PAGES)check(sitemap.includes('https://brilliant-monolit.ru'+p.path+'</loc>')===(p.key!=='legal'),'sitemap '+p.path);
check((await fetch(origin+'/missing-release-check')).status===404,'Неизвестная страница должна возвращать 404');
const manifest=JSON.parse(readFileSync(resolve(ROOT,'dist/source-manifest.json'),'utf8'));
for(const [path,digest] of Object.entries({...manifest.files,...manifest.assets}))check(createHash('sha256').update(readFileSync(resolve(ROOT,path.replace(/^\//,'')))).digest('hex')===digest,'Изменён исходник '+path);
const browser=existsSync('_redesign/BROWSER_QA.json')?JSON.parse(readFileSync('_redesign/BROWSER_QA.json','utf8')):null;
const result={generatedAt:new Date().toISOString(),origin,pageCount:pages.length,localNoindex:true,errors,uniqueInternalTargets:urls.size,uniqueAssets:assets.size,contextLinks:pages.reduce((sum,p)=>sum+p.contextLinks,0),sourceFilesVerified:Object.keys(manifest.files).length,sourceAssetsVerified:Object.keys(manifest.assets).length,pages,responses,redirects,browser};
writeFileSync('_redesign/RELEASE_AUDIT.json',JSON.stringify(result,null,2));
const rows=pages.map(p=>`| [${p.label}](${origin+p.path}) | ${p.status} | 1 | ${p.faqCount} | ${p.faqWords} | ${p.contextLinks} |`).join('\n');
writeFileSync('_redesign/RELEASE_AUDIT.md',`# Проверка локального выпуска\n\nВремя: ${result.generatedAt}. Проверен фактический HTML работающего сервера ${origin}.\n\nОшибок проверок: **${errors.length}**. Страниц: ${pages.length}. Внутренних адресов: ${urls.size}. Локальных ресурсов: ${assets.size}. Контекстных ссылок: ${result.contextLinks}. Проверены метаданные, H1, canonical, JSON-LD, 404, ${redirects.length} старых адресов, sitemap, исходные файлы и ресурсы.\n\nЛокальная версия намеренно закрыта от индексации. Режим production проверяется отдельно в tests/release.test.mjs; это не запуск на домене.\n\n| Страница | HTTP | H1 | Ответов | Слов в ответах | Контекстных ссылок |\n|---|---:|---:|---:|---:|---:|\n${rows}\n\nЧисло слов приведено для проверки объёма собственного содержания без отзывов и меню. Это не SEO-оценка и не целевая плотность ключевых слов.\n\n${errors.length?errors.map(e=>'- '+e).join('\n'):'Автоматический обход ошибок не обнаружил.'}\n`);
console.log(JSON.stringify({pages:pages.length,internalTargets:urls.size,assets:assets.size,contextLinks:result.contextLinks,errors},null,2));
if(errors.length)process.exitCode=1;
