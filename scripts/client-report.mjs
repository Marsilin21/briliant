import {readFileSync,writeFileSync} from 'node:fs';
import {esc,loadCatalog} from '../server/content.mjs';
const read=p=>JSON.parse(readFileSync(p,'utf8'));
const audit=read('_redesign/RELEASE_AUDIT.json'),before=read('_redesign/PAGE_OFFER_SNAPSHOT.json'),images=Object.values(read('dist/optimized-images/manifest.json'));
const testLog=readFileSync('_redesign/RELEASE_TESTS.txt','utf8');
const passed=Number(testLog.match(/pass (\d+)/)?.[1]),failed=Number(testLog.match(/fail (\d+)/)?.[1]);
if(audit.errors.length||!passed||failed!==0)throw Error('Нужен успешный актуальный аудит и журнал тестов');
const saved=images.reduce((s,i)=>s+i.originalBytes-i.optimizedBytes,0),original=images.reduce((s,i)=>s+i.originalBytes,0);
const roles={home:'Выбор вида ремонта и переход к подходящей услуге.',cosmetic:'Обновить покрытия, сохранив подходящие основания и коммуникации.',capital:'Существенно обновить основания, отделку и инженерные системы.',premium:'Реализовать дизайн-проект со сложными узлами, материалами и согласованием решений.',newbuild:'Определить работы от состояния передачи квартиры застройщиком.',resale:'Выбрать, что сохранить и что менять; сопоставить косметический и капитальный объём.',design:'Получить согласованную планировку, визуализацию и рабочую документацию.',supervision:'Сопровождать соответствие работ проекту; отделить это от техконтроля и закупок.',houses:'Спланировать ремонт существующего дома с учётом инженерии и доступа.',construction:'Обсудить проект дома, границы комплектации и расчёт общей площади.',smart:'Выбрать сценарии, состав оборудования, монтаж и настройку системы.',furniture:'Согласовать изделия, размеры, материалы, фурнитуру и установку.',works:'Посмотреть существующую галерею; фактические сведения об объектах дополняются через CMS.',about:'Понять направления работы и порядок взаимодействия.',faq:'Найти общие ответы о смете, сроках, материалах и приёмке.',contacts:'Найти контакты и регион работы.',legal:'Ознакомиться с политикой обработки данных; до заполнения это закрытая от индексации заготовка.'};
const changes=[
 ['Измеренный спрос и проверка выдачи','В Wordstat проверены 103 формулировки для Нижнего Новгорода, сохранены операторы, периоды и источники. По 15 поисковым выборкам Яндекса рассчитаны 105 сравнений URL. В админке доступны частотность, исходные десятки результатов и решения по структуре. Это снимок исследования, а не достигнутые позиции.'],
 ['Продвижение в админке','Подготовлены шесть деревьев и 18 плановых размещений по схеме Шакина, связь до четырёх уровней, учёт URL, статусов, подтверждений и стоимости. Рабочий план сохраняется отдельно от сайта; внешние публикации ещё не выполнены.'],
 ['Управляемая перелинковка и sitemap','30 контекстных ссылок редактируются через черновик и публикацию. Карта сайта показывает входящие ссылки, замечания и индексацию. XML использует опубликованные страницы; lastmod меняется по изменению конкретной страницы, неизвестные даты не выдумываются.'],
 ['Предметные тексты','Переписаны вступления и ответы на 11 страницах услуг и сценариев ремонта. Раскрыты результат, исходные данные, факторы цены и отдельно согласуемые позиции.'],
 ['Разные услуги — разные этапы','Дизайн, надзор, строительство, мебель и автоматизация получили собственные этапы. Убраны неуместные обещания выполнения ремонта и общие условия оплаты за м².'],
 ['Связные цены и состав','Девять предложений хранятся централизованно. Главная и страницы услуг используют одни данные. Ставки сохранены из исходного сайта; материалы и исключения описаны без выдуманных комплектаций.'],
 ['Структура без размножения URL','Оставлено 17 страниц. Новостройка описывает исходное состояние, вторичка — выбор сохраняемых элементов и объёма, капитальный ремонт — глубокое обновление. Созданы 30 контекстных ссылок; обе новые страницы доступны в меню услуг.'],
 ['Техническая SEO-основа','Уникальные title и description, один H1, canonical, серверный HTML, структурированные данные, sitemap, 301 со старых адресов и настоящая 404. Разметка Service добавлена к девяти услугам.'],
 ['Рабочая админка','Редактирование текстов, SEO, цен и галереи; черновик, предпросмотр, публикация, история и восстановление. Заявки с услугой, источником и UTM; роли пользователей, журнал действий и очередь уведомлений.'],
 ['Отладка совместимости','Исправлены всплывающая форма Tilda и мобильное отображение подсказки в SEO-редакторе. Неработающий картографический API заменён публичной картой того же города в существующем блоке.'],
 ['Сохранение оформления','Сохранены исходные логотип, CSS, фотографии и порядок блоков. Четыре фотографии отдаются в lossless WebP поддерживающим браузерам; сравнение декодированных пикселей пройдено.']
];
const remaining=[
 'Контакты подтверждены пользователем 8 сентября и внесены в админку. Остаются реквизиты оператора и окончательный текст политики. В production при неподтверждённой политике приём заявок блокируется.',
 'Дополнить шесть существующих объектов подтверждённым составом работ и ролью компании. Даты, бюджеты, собственное производство и другие отсутствующие факты не придуманы.',
 'Подключить выбранные уведомления и аналитику, проверить реальную доставку согласованного обращения. Сейчас внешние каналы выключены; тестовая заявка проверена внутри отдельной базы.',
 'На финальном этапе проверить хостинг, HTTPS, резервную копию и переключение домена. Docker Engine и реальный VPS не проверены запуском. Действующий brilliant-monolit.ru не изменялся.'
];
const examples=[['design',3],['supervision',6],['resale',1]].map(([key,index])=>{
 const old=before.find(p=>p.key===key),now=audit.pages.find(p=>p.key===key);
 return {label:now.label,beforeQ:old.questions[index],beforeA:old.answers[index],afterQ:now.questions[index],afterA:now.answers[index]};
});
const sources=[['ATMOSPHERE — услуги','https://atmos-studio.ru/uslugi/','Разделение проектирования, выполнения ремонта и сопровождения.'],['Элементарно','https://elementarnooo.ru/','Предметные сведения о выполненных объектах.'],['СК Частный Дом — проекты','https://chastdom-sk.ru/proekty-s-cenami/doma-iz-gazobetonnykh-blokov','Связь площади, проекта, цены и комплектации.'],['HouseClever — умный дом','https://umnyj-doms.ru/index/umnyj_dom_v_nizhnem_novgorode/0-125','Описание через сценарии и состав системы.'],['FLAT NN','https://flatnn.ru/','Изделия, замеры, материалы и установка.']];
const md=`# Бриллиант Монолит: результат локальной доработки

Подготовлено 8 сентября 2026. Снимок проверки: ${audit.generatedAt}.

**Версия готова к демонстрации заказчику. Публикация на основном домене — отдельный финальный этап.**

${changes.map(([name,value])=>`- **${name}.** ${value}`).join('\n')}

## Что проверено

- ${passed}/${passed} автоматических тестов, ошибок ${failed}.
- Обход работающего сервера: ${audit.pageCount} страниц, ${audit.uniqueAssets} локальных ресурсов, ${audit.redirects.length} старых адресов с 301, ${audit.contextLinks} контекстных ссылок; ошибок ${audit.errors.length}.
- Все 17 страниц при ширине 390 и 1440 пикселей: один H1, нет горизонтального переполнения и незаполненных полей шаблона. Выбранные экраны, меню, FAQ и формы осмотрены визуально.
- В отдельной тестовой базе браузером проверены публикация SEO-правки и заявка с услугой, источником, UTM и версией содержания. Реальная внешняя доставка не проверялась.
- Экономия ${(saved/1e6).toFixed(2)} МБ (${(saved/original*100).toFixed(1)}%) на четырёх фотографиях без изменения декодированных пикселей. Это не измерение скорости всего сайта.

## Зачем нужны страницы

| Страница | Задача посетителя |
|---|---|
${audit.pages.map(p=>`| ${p.label} — ${p.path} | ${roles[p.key]} |`).join('\n')}

## Основание для изменений

${sources.map(([name,url,why])=>`- [${name}](${url}): ${why}`).join('\n')}

Изучено опубликованное предложение конкурентов. Их цены, сроки, гарантии и комплектации не перенесены как факты о нашей компании. Полный аудит — PAGE_VALUE_REVIEW.md. До/после и полные тексты доступны в CLIENT_REPORT.html без работающего сервера.

## Перед запуском

${remaining.map((v,i)=>`${i+1}. ${v}`).join('\n')}

## Что означает выполненная SEO-работа

Подготовлены структура, содержательные тексты и техническая доступность для поисковых систем. 8 сентября измерена фразовая частотность 103 запросов Wordstat: 88 исходных и 15 дополнительных, регион Нижний Новгород. Сохранены 15 выборок Яндекса и 105 сравнений URL. Вторичка и капитальный ремонт имеют 0 общих URL из 10 в этой выборке; синонимы вторичного жилья и вторички — 8 из 10. Решения учитывают также содержание и задачу посетителя. Подробный отчёт: SEO_RESEARCH_2026-09-08.html. Схема «Удар шершня» представлена рабочими деревьями в админке; внешних публикаций пока нет.

Локальная версия намеренно закрыта от индексации. Позиции, трафик, конверсия и Core Web Vitals после публикации не измерялись. Полезный контент и логическая организация соответствуют принципам [руководства Google](https://developers.google.com/search/docs/fundamentals/seo-starter-guide); выполнение этих работ не гарантирует позиции.

Демонстрация: http://127.0.0.1:4180/ · Админка: http://127.0.0.1:4180/admin/ (на компьютере с запущенным проектом).

Доказательства: RELEASE_AUDIT.json, RELEASE_AUDIT.md, RELEASE_TESTS.txt, BROWSER_QA.json, SEO_WORKSPACE_QA.json. Инструкции: HANDOVER.md и SEO_ADMIN_GUIDE.md.
`;
writeFileSync('_redesign/CLIENT_REPORT.md',md);
const li=items=>'<ul>'+items.map(v=>'<li>'+esc(v)+'</li>').join('')+'</ul>';
const html=`<!doctype html><html lang="ru"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Бриллиант Монолит — отчёт о доработке</title><style>
:root{color-scheme:light;--gold:#a47737;--ink:#25221e;--paper:#f6f3ed}*{box-sizing:border-box}body{margin:0;background:var(--paper);color:var(--ink);font:16px/1.65 system-ui,sans-serif}main{max-width:1120px;margin:auto;padding:48px 28px 80px}h1{font-size:clamp(30px,5vw,52px);line-height:1.12;margin:16px 0}h2{margin:46px 0 18px;font-size:27px}h3{margin:0 0 8px}p{margin:12px 0}a{color:#765321}small,.muted{color:#6c665e}.eyebrow{color:var(--gold);text-transform:uppercase;letter-spacing:.15em;font-size:13px}.lead{max-width:850px;font-size:20px}.badge{display:inline-block;padding:6px 14px;background:#e8eee5;color:#345037;border-radius:20px}.metrics,.grid,.comparison{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px}.metrics{grid-template-columns:repeat(4,minmax(0,1fr));margin:28px 0}.card,details{background:white;border:1px solid #e0d8cb;border-radius:12px;padding:22px}.metric b{display:block;font-size:36px;line-height:1.3;color:var(--gold)}.metric span{font-size:14px}details{margin:12px 0}summary{cursor:pointer;font-weight:650;overflow-wrap:anywhere}.details-body{margin-top:22px}.route{display:block;font:13px/1.6 monospace;color:#746650}.comparison>div{border-left:3px solid #c7b48f;padding:8px 16px}.comparison p{font-size:15px}.tablewrap{overflow-x:auto}table{border-collapse:collapse;width:100%;background:white}th,td{text-align:left;padding:14px;border-bottom:1px solid #e1d9cc;vertical-align:top}th{background:#ebe4d8}td:first-child{width:28%}.note{padding:18px 22px;background:#eee7db;border-left:4px solid var(--gold)}dt{font-weight:bold;margin-top:16px}dd{margin:4px 0 16px;overflow-wrap:anywhere}.meta{font-size:14px;padding:14px;background:#f6f3ed;border-radius:8px}.links{display:flex;gap:20px;flex-wrap:wrap}footer{margin-top:48px;font-size:13px;color:#696157}li{margin:8px 0}@media(max-width:700px){main{padding:26px 16px}.metrics,.grid,.comparison{grid-template-columns:1fr 1fr}.grid,.comparison{grid-template-columns:1fr}.card,details{padding:17px}th,td{padding:10px;font-size:14px}}@media print{body{background:white}main{padding:0}details{break-inside:avoid}.card{break-inside:avoid}a{color:inherit}.links{display:none}}
</style><main><div class="eyebrow">Бриллиант Монолит · 8 сентября 2026</div><h1>Содержание, SEO<br>и управление сайтом</h1><span class="badge">Готово к демонстрации</span><p class="lead">Исходное оформление сохранено. Услуги получили предметные описания, структура — понятные роли страниц, сайт — собственную админку и проверенную техническую основу.</p><p class="muted">Действующий домен не изменялся. Этот файл можно передать заказчику и открыть без сервера; ссылки на демонстрацию работают на компьютере с запущенным проектом.</p>
<div class="metrics"><div class="card metric"><b>17</b><span>страниц проверено</span></div><div class="card metric"><b>${passed}/${passed}</b><span>тестов пройдено</span></div><div class="card metric"><b>30</b><span>контекстных ссылок</span></div><div class="card metric"><b>0</b><span>ошибок локального обхода</span></div></div><div class="links"><a href="http://127.0.0.1:4180/">Открыть демонстрацию</a><a href="http://127.0.0.1:4180/admin/">Открыть админку</a><a href="#texts">Читать тексты страниц</a></div>
<h2>Что изменилось</h2><div class="grid">${changes.map(([name,value])=>`<article class="card"><h3>${esc(name)}</h3><p>${esc(value)}</p></article>`).join('')}</div>
<h2>Примеры до и после</h2><p>Сравнение с локальным снимком перед последней редакционной доработкой. Это реальные тексты соответствующих блоков.</p>${examples.map(e=>`<article class="card" style="margin-bottom:16px"><h3>${esc(e.label)}</h3><div class="comparison"><div><small>ДО</small><p><b>${esc(e.beforeQ)}</b></p><p>${esc(e.beforeA)}</p></div><div><small>ПОСЛЕ</small><p><b>${esc(e.afterQ)}</b></p><p>${esc(e.afterA)}</p></div></div></article>`).join('')}
<h2>Зачем нужны эти страницы</h2><div class="tablewrap"><table><thead><tr><th>Страница</th><th>Задача посетителя</th></tr></thead><tbody>${audit.pages.map(p=>`<tr><td>${esc(p.label)}<span class="route">${esc(p.path)}</span></td><td>${esc(roles[p.key])}</td></tr>`).join('')}</tbody></table></div><p class="note">Капитальный ремонт описывает объём глубокого обновления. Новостройка — состояние передачи от застройщика. Вторичное жильё — выбор сохраняемых элементов и подходящего объёма. Проверка Яндекса 8 сентября показала 0 общих URL из 10 у капитального ремонта и вторички, а также капитального ремонта и новостройки. Разделение поддерживается содержанием и этой выборкой; это не гарантия ранжирования.</p>
<h2>На чём основаны решения</h2><p>Изучены опубликованные предложения профильных конкурентов. Заимствован принцип конкретного объяснения услуги; чужие условия не объявлены условиями нашей компании.</p><ul>${sources.map(([name,url,why])=>`<li><a href="${esc(url)}">${esc(name)}</a> — ${esc(why)}</li>`).join('')}</ul><p>Подробное исследование и ограничения выборки сохранены в PAGE_VALUE_REVIEW.md.</p>
<h2>Проверка работоспособности</h2>${li([`${passed} автоматических тестов пройдено. Проверяются публикация, версии, роли, защита, заявки, миграция данных, медиа, SEO и сохранение исходного оформления.`,`Фактический сервер: 17 страниц, ${audit.uniqueAssets} ресурсов, 15 редиректов старых адресов. Проверены title, description, H1, canonical, JSON-LD, sitemap и 404.`,`17 страниц при ширине 390 и 1440 пикселей: нет горизонтального переполнения и незаполненных полей шаблона. Выбранные экраны осмотрены визуально; это не попиксельное сравнение всей страницы.`,`В браузере на отдельной базе выполнены публикация SEO-правки и отправка заявки. В админке проверены услуга, источник, UTM и версия содержания; внешняя доставка была отключена.`,`Исправлены и повторно проверены мобильный SEO-редактор, открытие всплывающей формы и карта города.`,`${(saved/1e6).toFixed(2)} МБ экономии на четырёх фотографиях (${(saved/original*100).toFixed(1)}%) без изменения пикселей. Реальные Core Web Vitals не измерены.`])}<p class="muted">Артефакты: RELEASE_AUDIT.json, RELEASE_AUDIT.md, RELEASE_TESTS.txt, BROWSER_QA.json, SEO_WORKSPACE_QA.json. Время обхода: ${esc(audit.generatedAt)}.</p>
<h2 id="texts">Метаданные и тексты всех страниц</h2><p>Откройте нужную строку. Здесь сохранены фактические title, description, первый вводный блок и все вопросы/ответы из HTML проверенной версии. Полные страницы с остальными блоками доступны в демонстрации.</p>${audit.pages.map(p=>`<details><summary>${esc(p.label)}<span class="route">${esc(p.path)} · ${p.faqCount} ответов</span></summary><div class="details-body"><p>${esc(roles[p.key])}</p><div class="meta"><b>Title:</b> ${esc(p.title)}<br><b>Description:</b> ${esc(p.description)}<br><b>H1:</b> ${esc(p.h1)}</div>${p.intro?`<p>${esc(p.intro)}</p>`:''}<dl>${p.questions.map((q,i)=>`<dt>${esc(q)}</dt><dd>${esc(p.answers[i]||'')}</dd>`).join('')}</dl><a href="http://127.0.0.1:4180${esc(p.path)}">Открыть страницу</a></div></details>`).join('')}
<h2>Что осталось до публикации</h2>${li(remaining)}<p>В админке доступно ${Object.keys(loadCatalog().texts).length} текстовых полей, девять предложений и шесть существующих объектов. Она управляет текущей структурой; произвольный конструктор блоков, отдельные страницы проектов и Telegram-бот портфолио не входят в реализованные функции.</p>
<h2>Как оценивать SEO-результат</h2><p>Подготовлены содержательные тексты, структура и техническая доступность страниц. Измерена фразовая частотность 103 запросов в регионе Нижний Новгород; по 15 выборкам Яндекса рассчитаны 105 сравнений. <a href="SEO_RESEARCH_2026-09-08.html">Открыть подробное SEO-исследование</a>. Схема «Удар шершня» представлена рабочими деревьями в админке. Внешних публикаций пока нет; статусы и подтверждения заполняет редактор.</p><p>Локальная версия намеренно закрыта от индексации. Позиции, трафик и конверсия после публикации пока не измерены. Принципы полезного содержания и логической структуры описаны в <a href="https://developers.google.com/search/docs/fundamentals/seo-starter-guide">официальном руководстве Google</a>; выполнение этих работ не гарантирует место в выдаче.</p><footer>Отчёт сформирован из результатов локальных проверок. Инструкция запуска и передачи — HANDOVER.md. Пароли и персональные данные в этот файл не включены.</footer></main></html>`;
writeFileSync('_redesign/CLIENT_REPORT.html',html);
console.log(`Client report: ${audit.pages.length} pages, ${passed} tests, ${Buffer.byteLength(html)} bytes`);
