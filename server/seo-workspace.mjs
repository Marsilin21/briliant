import {seoPlan} from '../site/seo-plan.mjs';
export const statusLabels={planned:'План',prepared:'Материал готов',published:'Опубликовано',lost:'Ссылка утрачена',cancelled:'Отменено'};
const topics={home:'Как сравнить предложения по ремонту квартиры и состав сметы',design:'Какие чертежи нужны для реализации интерьера',capital:'Когда квартире нужен капитальный ремонт',newbuild:'Ремонт новостройки: что зависит от отделки застройщика',resale:'Что сохранить при ремонте вторичного жилья',supervision:'Что проверяет дизайнер при авторском надзоре'};
export function seedWorkspace(){
 const campaigns=Object.entries(topics).map(([page,topic])=>({id:'campaign-'+page,page,query:seoPlan[page].queries[0],topic,notes:'Одна целевая формулировка на дерево. Перед размещением проверить спрос, страницу и площадку.'}));
 return {campaigns,placements:campaigns.flatMap(c=>[1,2,3].map(tier=>({id:c.id+'-t'+tier,campaign:c.id,tier,parent:tier===1?'':c.id+'-t'+(tier-1),url:'',platform:'',anchor:tier===1?'Бриллиант Монолит':'подробный материал по теме',status:'planned',relation:'editorial',cost:null,scheduled:'',publishedAt:'',checkedAt:'',evidence:'',notes:tier===1?`Подготовить статью «${c.topic}». Объяснить задачу, варианты, ограничения и исходные данные; ссылка на соответствующую услугу.`:tier===2?'Подготовить самостоятельный тематический разбор с уместной ссылкой на материал первого уровня.':'Подготовить самостоятельное дополнение со ссылкой на материал второго уровня. Не публиковать копии предыдущих материалов.'}))),measurements:Object.entries(seoPlan).flatMap(([page,p])=>p.queries.map((query,i)=>({id:page+'-'+i,page,query,frequency:null,region:'Нижний Новгород',period:'',operator:'',source:'',checkedAt:''})))};
}
function str(value,max){return typeof value==='string'&&value.length<=max;}
function url(value){if(!str(value,2000))return false;if(!value)return true;try{const u=new URL(value);return ['https:','http:'].includes(u.protocol)&&!u.username&&!u.password;}catch{return false;}}
function date(v){return v===''||/^\d{4}-\d{2}-\d{2}$/.test(v)&&!Number.isNaN(Date.parse(v))&&new Date(v).toISOString().slice(0,10)===v;}
function rows(value,max){if(!Array.isArray(value)||value.length>max||value.some(r=>!r||typeof r!=='object'||!str(r.id,80)||!/^[\w-]+$/.test(r.id))||new Set(value.map(r=>r.id)).size!==value.length)throw Error('Некорректный список SEO-записей');}
function keys(row,expected){if(Object.keys(row).sort().join()!==expected.split(',').sort().join())throw Error('Некорректные поля SEO-записи');}
export function validateWorkspace(w,pages,origin){
 if(!w||Object.keys(w).sort().join()!=='campaigns,measurements,placements')throw Error('Некорректная структура продвижения');
 rows(w.campaigns,100);rows(w.placements,500);rows(w.measurements,1000);
 const pageOk=key=>pages.some(p=>p.key===key&&p.key!=='legal');
 for(const c of w.campaigns){keys(c,'id,page,query,topic,notes');if(!pageOk(c.page)||!str(c.query,250)||!c.query.trim()||!str(c.topic,350)||!c.topic.trim()||!str(c.notes,3000))throw Error('Проверьте запрос, тему и целевую страницу');}
 for(const p of w.placements){
  keys(p,'id,campaign,tier,parent,url,platform,anchor,status,relation,cost,scheduled,publishedAt,checkedAt,evidence,notes');
  if(!w.campaigns.some(c=>c.id===p.campaign)||![1,2,3,4].includes(p.tier)||!str(p.parent,80)||!url(p.url)||!url(p.evidence)||!str(p.platform,300)||!str(p.anchor,250)||!str(p.notes,5000)||!Object.hasOwn(statusLabels,p.status)||!['editorial','sponsored','ugc','nofollow'].includes(p.relation)||!(p.cost===null||Number.isFinite(p.cost)&&p.cost>=0&&p.cost<=10000000)||![p.scheduled,p.publishedAt,p.checkedAt].every(v=>str(v,10)&&date(v)))throw Error('Проверьте данные размещения');
  const parent=w.placements.find(x=>x.id===p.parent);
  if(p.tier===1?p.parent!=='':!parent||parent.campaign!==p.campaign||parent.tier!==p.tier-1)throw Error('Ссылка должна вести на предыдущий уровень того же дерева');
  if(p.url&&new URL(p.url).hostname===new URL(origin).hostname)throw Error('Для внешнего размещения нужен адрес другой площадки');
  if(p.status==='published'&&(!p.url||!p.publishedAt||!p.checkedAt||!p.evidence||!p.anchor.trim()||p.tier>1&&(!parent.url||parent.status!=='published')))throw Error('Для опубликованной ссылки укажите URL, даты, подтверждение и опубликованный предыдущий уровень');
 }
 const urls=w.placements.filter(p=>p.url).map(p=>new URL(p.url).href);if(new Set(urls).size!==urls.length)throw Error('URL размещения уже используется');
 for(const m of w.measurements){keys(m,'id,page,query,frequency,region,period,operator,source,checkedAt');if(!pageOk(m.page)||!str(m.query,250)||!m.query.trim()||!str(m.region,150)||!str(m.period,100)||!str(m.operator,250)||!url(m.source)||!str(m.checkedAt,10)||!date(m.checkedAt)||!(m.frequency===null||Number.isSafeInteger(m.frequency)&&m.frequency>=0)||m.frequency!==null&&(!m.region.trim()||!m.period.trim()||!m.operator.trim()||!m.source||!m.checkedAt))throw Error('Для частотности нужны регион, период, оператор, источник и дата проверки');}
 return w;
}
export function placementTarget(p,w,pages,origin){const c=w.campaigns.find(c=>c.id===p.campaign);return p.tier===1?origin+pages.find(x=>x.key===c?.page)?.path:w.placements.find(x=>x.id===p.parent)?.url||'';}
