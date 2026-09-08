// Shared by the editor and renderer. Only existing text can become an internal link.
export function defaultLinks(catalog){
 return Object.entries(catalog.texts).flatMap(([field,f])=>(f.links||[]).map(([anchor,target],n)=>({id:field+'-'+n,field,source:f.uses[0].page,anchor,target,enabled:true})));
}
export function linkProblem(link,content,catalog){
 const text=content.texts[link.field]||'';
 if(!link.enabled)return 'Отключена';
 if(!text.toLocaleLowerCase('ru').includes(link.anchor.toLocaleLowerCase('ru')))return 'Фраза отсутствует в тексте';
 const target=catalog.pages.find(p=>p.path===link.target);
 if(content.seo[target?.key]?.noindex)return 'Целевая страница закрыта от поиска';
 return '';
}
export function validateLinks(links,catalog){
 if(!Array.isArray(links)||links.length>300)throw Error('Допустимо до 300 внутренних ссылок');
 const ids=new Set(),anchors=new Set();
 for(const l of links){
  if(!l||Object.keys(l).sort().join()!=='anchor,enabled,field,id,source,target'||typeof l.id!=='string'||!/^[\w-]{1,80}$/.test(l.id)||ids.has(l.id))throw Error('Некорректный идентификатор ссылки');ids.add(l.id);
  const f=catalog.texts[l.field],source=catalog.pages.find(p=>p.key===l.source);
  if(!source||!f||f.binding||f.scope!=='page'||!f.uses.every(u=>u.page===l.source)||!Array.isArray(f.links))throw Error('Выберите доступный текстовый блок ссылки');
  if(typeof l.anchor!=='string'||!l.anchor.trim()||l.anchor!==l.anchor.trim()||l.anchor.length>180||typeof l.enabled!=='boolean')throw Error('Укажите фразу ссылки до 180 символов');
  if(!catalog.pages.some(p=>p.path===l.target)||l.target===source.path)throw Error('Выберите другую существующую страницу');
  const pair=l.field+':'+l.anchor.toLocaleLowerCase('ru');if(anchors.has(pair))throw Error('Одна фраза в блоке не может вести на разные страницы');anchors.add(pair);
 }
}
