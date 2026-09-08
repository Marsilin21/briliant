// Only static internal destinations become links; editor content is always escaped.
export function linkedText(value,links,escape){
 const text=String(value),matches=[];
 for(const [anchor,path]of links||[]){
  if(!/^\/(?:[a-z0-9/-]*)$/.test(path))throw Error('Некорректная внутренняя ссылка');
  const start=text.toLocaleLowerCase('ru-RU').indexOf(anchor.toLocaleLowerCase('ru-RU'));
  if(start>=0&&!matches.some(m=>start<m.end&&start+anchor.length>m.start))matches.push({start,end:start+anchor.length,path});
 }
 let result='',offset=0;
 for(const m of matches.sort((a,b)=>a.start-b.start)){result+=escape(text.slice(offset,m.start))+`<a href="${escape(m.path)}">${escape(text.slice(m.start,m.end))}</a>`;offset=m.end;}
 return result+escape(text.slice(offset));
}
