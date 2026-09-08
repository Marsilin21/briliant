import {createHash} from 'node:crypto';
import {load} from 'cheerio';
import {linkedText} from './linked-text.mjs';
import {linkProblem} from '../site/link-management.mjs';

export function syncPageDates(db,pages,content,render,at=new Date().toISOString(),initialize=false){
 for(const page of pages){
  const hash=createHash('sha256').update(render(page,content)).digest('hex');
  const old=db.prepare('SELECT hash FROM seo_page_dates WHERE page=?').get(page.key);
  // An imported page has no trustworthy per-page publication date yet.
  if(old?.hash!==hash)db.prepare('INSERT INTO seo_page_dates(page,hash,modified_at) VALUES(?,?,?) ON CONFLICT(page) DO UPDATE SET hash=excluded.hash,modified_at=excluded.modified_at').run(page.key,hash,!old&&initialize?'':at);
 }
}
export function sitemapRows(db,pages,content,origin){return pages.filter(p=>!content.seo[p.key].noindex).map(p=>({key:p.key,path:p.path,url:origin+p.path,lastmod:db.prepare('SELECT modified_at FROM seo_page_dates WHERE page=?').get(p.key)?.modified_at||null}));}
export function inspectSeo(pages,content,catalog,render,origin){
 const results=[],edges=[],issues=[],titles=new Set(),descriptions=new Set();
 for(const page of pages){
  const $=load(render(page,content)),title=$('title').text(),description=$('meta[name=description]').attr('content'),h1=$('h1').length;
  if(!title||titles.has(title))issues.push({page:page.path,message:'Пустой или повторяющийся title'});titles.add(title);
  if(!description||descriptions.has(description))issues.push({page:page.path,message:'Пустой или повторяющийся description'});descriptions.add(description);
  if(h1!==1)issues.push({page:page.path,message:'Ожидается один H1'});
  $('a[href]').each((_,e)=>{const href=$(e).attr('href');if(!href||href.startsWith('#'))return;try{const u=new URL(href,origin+page.path);if(u.origin!==origin)return;const target=pages.find(p=>p.path===u.pathname);if(!target){issues.push({page:page.path,message:'Неизвестная внутренняя страница: '+u.pathname});return;}edges.push({source:page.key,target:target.key,anchor:$(e).text().trim()||$(e).find('img').attr('alt')||'Изображение',context:$(e).parents('.t585__text').length>0});}catch{issues.push({page:page.path,message:'Некорректная ссылка'});}});
  results.push({key:page.key,path:page.path,label:page.label,title,description,h1,noindex:content.seo[page.key].noindex,canonical:$('link[rel=canonical]').attr('href')});
 }
 for(const page of results){page.incoming=edges.filter(e=>e.target===page.key&&e.source!==page.key).length;page.contextIncoming=edges.filter(e=>e.context&&e.target===page.key&&e.source!==page.key).length;if(!page.noindex&&page.path!=='/'&&!page.incoming)issues.push({page:page.path,message:'Нет входящих внутренних ссылок'});}
 const links=content.internalLinks.map(l=>{
  let problem=linkProblem(l,content,catalog);
  if(!problem){const same=content.internalLinks.filter(x=>x.enabled&&x.field===l.field&&x.source===l.source);const html=linkedText(content.texts[l.field],same.map(x=>[x.anchor,x.target]),s=>s.replace(/&/g,'&amp;').replace(/</g,'&lt;')),$=load(html);if(!$('a').toArray().some(a=>$(a).text().toLocaleLowerCase('ru')===l.anchor.toLocaleLowerCase('ru')&&$(a).attr('href')===l.target))problem='Фраза перекрывается другой ссылкой';}
  return {...l,problem};
 });
 for(const l of links.filter(l=>l.enabled&&l.problem))issues.push({page:pages.find(p=>p.key===l.source).path,message:l.problem+': '+l.anchor});
 return {pages:results,edges,links,issues,contextCount:edges.filter(e=>e.context).length};
}
