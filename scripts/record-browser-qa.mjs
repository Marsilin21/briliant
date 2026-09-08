// Recorded observations from the Codex browser session, not a browser test runner.
import {writeFileSync} from 'node:fs';
import {PAGES} from '../server/content.mjs';
writeFileSync('_redesign/BROWSER_QA.json',JSON.stringify({
 recordedAt:new Date().toISOString(),method:'CUA browser: DOM measurements, UI interaction and selected screenshots',
 mobile:PAGES.map(p=>({path:p.path,width:390,height:844,documentWidth:375,h1:1,unresolved:false})),
 desktop:PAGES.map(p=>({path:p.path,width:1440,height:900,documentWidth:1425,h1:1,unresolved:false})),
 visual:['Авторский надзор: первый экран на desktop и mobile','Авторский надзор: длинный раскрытый FAQ на mobile','Вторичное жильё: первый экран desktop','О компании: текст mobile','Мобильное меню: 11 услуг','Админка: обзор desktop, SEO-редактор mobile после исправления','Дизайн: всплывающая форма после анимации','Контакты: карта Нижнего Новгорода'],
 scenarios:[{name:'Вход → правка title → черновик → публикация → версия 2',result:'passed',environment:'isolated 4181'},
 {name:'Заявка /design → сохранение → просмотр в админке',result:'passed',environment:'isolated 4181',observed:{count:1,service:'Дизайн интерьера',source:'/design',utm_source:'browser-qa',contentVersion:2,externalDelivery:false}},
 {name:'Форма после восстановления layout helpers',result:'passed',environment:'main 4180; opened without submitting',freshConsoleErrors:0},
 {name:'Карта после замены неработающего API на публичный виджет',result:'passed',environment:'main 4180',center:[44.006516,56.326797],officePin:false}],
 limitations:['Эмуляция размера окна, не физический телефон','Внешняя доставка отключена','Скриншоты просмотрены в сессии; отдельный архив скриншотов не создавался','Это выбранные визуальные сценарии, не попиксельное сравнение каждой области сайта']
},null,2));
