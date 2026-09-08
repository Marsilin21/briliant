import {offerConditions} from './service-content.mjs';
// Shared by the renderer and editor: one offer supplies every displayed price.
export const offerNames={cosmetic:'Косметический ремонт',capital:'Капитальный ремонт',premium:'Ремонт по дизайн-проекту',design:'Дизайн интерьера',houses:'Ремонт домов',construction:'Строительство коттеджей',supervision:'Авторский надзор',smart:'Умный дом',furniture:'Мебель на заказ'};
export const offerDefaults=Object.fromEntries(Object.keys(offerNames).map(key=>[key,{
 price:{cosmetic:'от 4 000',capital:'9 000–10 000',premium:'18 000–22 000',design:'1 500–2 500',houses:'от 10 000',construction:'от 65 000',supervision:'15 000–25 000',smart:'от 300 000',furniture:''}[key],unit:key==='supervision'?'месяц':['smart','furniture'].includes(key)?'проект':'м²',confirmed:key!=='furniture',
 variant:key==='houses'?'С инженерией — ориентировочно от 15 000 ₽/м²':key==='smart'?'Для дома — от 500 000 ₽':key==='supervision'?'Оплата по выездам — по согласованию':'',
 scope:{cosmetic:'Обновление отделки стен, потолков и пола.',capital:'Демонтаж, инженерные системы и отделка.',premium:'Выполнение ремонта по согласованному дизайн-проекту.',design:'Планировка, визуализация и рабочие чертежи — по заданию.',houses:'Ремонт существующего дома по результатам осмотра.',construction:'Строительство по проекту и согласованной комплектации.',supervision:'Проверка соответствия работ дизайн-проекту.',smart:'Подбор сценариев, оборудования и настройка системы.',furniture:'Мебель по размерам помещения и согласованному проекту.'}[key],
 materials:offerConditions[key]?.materials??'Материалы и порядок их оплаты указываются отдельными позициями сметы. Начальная ставка не означает включения всех закупок.',
 exclusions:offerConditions[key]?.exclusions??'Включаются только позиции согласованной сметы. Дополнительные работы требуют отдельного согласования.',
 basis:offerConditions[key]?.basis??'Для расчёта нужны сведения об объекте и согласованный состав работ.',
 legacyReference:{cosmetic:'Главная и услуга: от 4 000 ₽/м²',capital:'Главная: от 10 000; услуга: 9 000–10 000 ₽/м²',premium:'Главная: от 20 000; услуга: 18 000–22 000 ₽/м²',design:'1 500–2 500 ₽/м²',houses:'От 10 000; с инженерией около 15 000 ₽/м²',construction:'От 65 000 ₽/м²',supervision:'15 000–25 000 ₽/месяц или по выездам',smart:'Квартира от 300 000; дом от 500 000 ₽',furniture:'Цена не указана'}[key]
}]));
export function offerText(offer,field){
 if(field==='price')return offer.confirmed?[`${offer.price} ₽/${offer.unit}`,offer.variant].filter(Boolean).join('. '):'По смете';
 if(field==='summary')return offer.scope;
 if(field==='details')return [offer.scope,offer.materials,offer.exclusions,offer.basis,offer.confirmed?`Ориентир: ${offerText(offer,'price')}. Окончательная стоимость — в согласованной смете.`:'Стоимость определяется после уточнения задачи.'].join(' ');
 return '';
}
