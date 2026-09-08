import React,{useState,useEffect} from 'react';
import {offerNames,offerText} from '../../site/offers.mjs';
import {api} from './api';

export function Offers({content,edit}){
 const [selected,setSelected]=useState('cosmetic');const offer=content.offers[selected];
 const field=(key,label,rows=2)=><label key={key}>{label}<textarea rows={rows} value={offer[key]} onChange={e=>edit(c=>{c.offers[selected][key]=e.target.value;return c;})}/></label>;
 return <><div className="notice">Одно предложение используется в цене и ответе о составе услуги, а для трёх видов ремонта — ещё и в карточке главной. Правка применяется ко всем этим местам после публикации.</div><div className="toolbar"><label>Услуга<select value={selected} onChange={e=>setSelected(e.target.value)}>{Object.entries(offerNames).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select></label></div><div className="card"><h2>{offerNames[selected]}</h2><p className="muted">Сведения исходного сайта: {offer.legacyReference}</p><label className="checkbox"><input type="checkbox" checked={offer.confirmed} onChange={e=>edit(c=>{c.offers[selected].confirmed=e.target.checked;return c;})}/>Показывать указанную цену</label><div className="columns">{field('price','Ставка или диапазон без валюты · например, от 4 000')}{field('unit','Единица расчёта · м², месяц, проект')}</div>{field('variant','Другой вариант комплектации · если есть')}{field('scope','Состав предложения · кратко, до 180 символов')}{field('materials','Как учитываются материалы')}{field('exclusions','Исключения и дополнительные услуги',3)}{field('basis','Что нужно для расчёта и условия ставки',3)}<div className="search-preview"><small>Так выглядит описание стоимости</small><strong>{offerText(offer,'price')}</strong><p>{offerText(offer,'details')}</p></div><p className="muted">Отключённая цена заменяется на «По смете». Это не проверка достоверности: условия нужно сверять с действующим предложением компании.</p></div></>;
}

const briefLabels={object:'Объект и адрес',area:'Площадь',condition:'Исходное состояние',project:'Есть ли проект и какие документы получены',task:'Состав задачи',start:'Желаемое начало',nextStep:'Следующий шаг и договорённость'};
export function LeadBrief({lead,run,notify}){
 const [brief,setBrief]=useState({});
 useEffect(()=>{let value={};try{value=JSON.parse(lead.brief||'{}');}catch{}setBrief(Object.fromEntries(Object.keys(briefLabels).map(k=>[k,value[k]||''])));},[lead.id,lead.brief]);
 return <form onSubmit={e=>{e.preventDefault();run(async()=>{await api('/admin/leads/'+lead.id+'/brief','PUT',brief);notify('Сведения об объекте сохранены');});}}><h3>Задача и следующий шаг</h3><p>Заполняется менеджером после обсуждения с заказчиком.</p><div className="columns">{Object.entries(briefLabels).map(([k,label])=><label key={k}>{label}<textarea rows="2" maxLength="1500" value={brief[k]||''} onChange={e=>setBrief(b=>({...b,[k]:e.target.value}))}/></label>)}</div><button>Сохранить сведения об объекте</button></form>;
}
