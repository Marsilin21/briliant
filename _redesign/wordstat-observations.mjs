// Counts transcribed from authenticated Wordstat DOM, 2026-09-08.
// A/B are the actual intervals displayed by the service, not estimated dates.
import {seoPlan} from '../site/seo-plan.mjs';
import {writeFileSync} from 'node:fs';
const values={
 home:[[139,'A'],[95,'A'],[0,'B'],[3,'A'],[0,'B'],[0,'B'],[0,'A'],[0,'A'],[0,'B']],
 newbuild:[[0,'A'],[0,'B'],[0,'A'],[0,'B'],[0,'B'],[0,'B'],[0,'B']],
 resale:[[0,'B'],[0,'B'],[0,'B'],[0,'B'],[0,'B'],[0,'B']],
 cosmetic:[[2,'B'],[0,'B'],[0,'B'],[0,'B'],[0,'B']],
 capital:[[0,'A'],[0,'B'],[0,'B'],[0,'B'],[0,'B'],[0,'B']],
 premium:[[0,'A'],[0,'B'],[0,'B'],[0,'B'],[0,'B'],[0,'B']],
 design:[[50,'A'],[7,'A'],[0,'B'],[0,'B'],[0,'B'],[0,'B'],[1,'A']],
 houses:[[8,'A'],[2,'B'],[0,'B'],[0,'B'],[0,'B']],
 construction:[[4,'A'],[42,'A'],[0,'B'],[0,'B'],[2,'A']],
 supervision:[[0,'B'],[0,'B'],[0,'B'],[0,'B'],[0,'B']],
 smart:[[18,'A'],[1,'B'],[0,'B'],[0,'B'],[0,'B'],[0,'B']],
 furniture:[[138,'A'],[8,'A'],[277,'A'],[52,'A'],[8,'A']],
 faq:[[5,'A'],[0,'B'],[0,'B'],[0,'B'],[0,'A'],[0,'B'],[0,'B']],
 works:[[0,'B'],[0,'B'],[0,'B']],about:[[2,'B'],[0,'B'],[2,'B']],contacts:[[0,'B'],[0,'B'],[0,'B']]
};
const core=[['home','ремонт квартир',219],['newbuild','ремонт в новостройке',1],['resale','ремонт вторичного жилья',0],['resale','ремонт вторички',4],['cosmetic','косметический ремонт квартиры',6],['capital','капитальный ремонт квартиры',6],['premium','дизайнерский ремонт',3],['premium','ремонт по дизайн проекту',0],['design','дизайн интерьера',1261],['design','дизайн проект квартиры',192],['houses','ремонт коттеджей',1],['construction','строительство домов',2676],['supervision','авторский надзор',17],['smart','умный дом',348],['furniture','мебель на заказ',87]];
const periods={A:'08.08.2026 – 06.09.2026',B:'07.08.2026 – 07.09.2026'};
function row(id,page,query,frequency,code){const operator='"'+query+'"';return {id,page,query,frequency,region:'Нижний Новгород (47), все устройства',period:periods[code],operator,source:'https://wordstat.yandex.ru/?region=47&view=table&words='+encodeURIComponent(operator),checkedAt:'2026-09-08'};}
const measurements=Object.entries(seoPlan).flatMap(([page,p])=>{if(values[page].length!==p.queries.length)throw Error('Query count changed');return p.queries.map((q,i)=>row(page+'-'+i,page,q,...values[page][i]));});
measurements.push(...core.map(([page,q,n],i)=>row('research-'+page+'-'+i,page,q,n,'A')));
writeFileSync(new URL('./WORDSTAT_2026-09-08.json',import.meta.url),JSON.stringify({checkedAt:'2026-09-08',method:'Authenticated Wordstat UI. Top queries, city 47, all devices. Quoted phrase headline count; no word-form or word-order fixation. Each displayed period preserved. Counts are requests, not visitors or leads. Do not sum overlapping queries.',measurements},null,2)+'\n');
console.log({measured:measurements.length,nonzero:measurements.filter(m=>m.frequency>0).length});
