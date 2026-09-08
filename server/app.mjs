import Fastify from 'fastify';
import cookie from '@fastify/cookie';
import rateLimit from '@fastify/rate-limit';
import multipart from '@fastify/multipart';
import staticFiles from '@fastify/static';
import sharp from 'sharp';
import { existsSync, writeFileSync, unlinkSync,createReadStream } from 'node:fs';
import { resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import {upgradeContent} from './migrate-content.mjs';
import {offerNames} from '../site/offers.mjs';
import { openStore } from './db.mjs';
import { ROOT,PAGES,loadCatalog,validateContent,renderPage,esc } from './content.mjs';
import { hashPassword,verifyPassword,token,digest,guards } from './auth.mjs';
import { configured,deliveryWorker,redactSettings,mergeSettings } from './notify.mjs';
import {seedWorkspace,validateWorkspace} from './seo-workspace.mjs';
import {syncPageDates,sitemapRows,inspectSeo} from './seo-audit.mjs';

const fail=(reply,code,error)=>reply.code(code).send({error});
const clean=(v,max)=>typeof v==='string'?v.trim().slice(0,max):'';
export async function createApp(options={}){
 const production=options.production??process.env.NODE_ENV==='production';
 const dataDir=resolve(options.dataDir||process.env.DATA_DIR||resolve(ROOT,'data'));
 const origin=options.origin||process.env.SITE_ORIGIN||'https://brilliant-monolit.ru';
 const originURL=new URL(origin);if(originURL.origin!==origin || !['https:','http:'].includes(originURL.protocol))throw Error('SITE_ORIGIN должен содержать только протокол и домен');
 const secure=options.secure??(process.env.COOKIE_SECURE==='true'||production);
 if(production && (!secure||originURL.protocol!=='https:'||!process.env.ALLOWED_ORIGINS&&!options.origins))throw Error('Для production необходимы HTTPS, Secure-cookie и ALLOWED_ORIGINS');
 const origins=new Set(options.origins||(process.env.ALLOWED_ORIGINS||'http://127.0.0.1:4180,http://localhost:4180').split(',').map(s=>s.trim()));
 if(production)origins.add(origin);
 const catalog=loadCatalog();const store=openStore(dataDir);const {db,state,audit,tx}=store;
 const app=Fastify({logger:options.logger??false,bodyLimit:2*1024*1024,trustProxy:production&&process.env.TRUST_PROXY==='1'?1:false});
 app.decorate('store',store);app.decorate('catalog',catalog);
 await app.register(cookie);await app.register(rateLimit,{global:false});await app.register(multipart,{limits:{fileSize:10*1024*1024,files:1,fields:2}});
 const g=guards(store,origins);const read=[g.auth],write=[g.origin,g.auth,g.csrf],adminRead=[g.auth,g.admin],adminWrite=[...write,g.admin];
 const cookies={path:'/',httpOnly:true,sameSite:'strict',secure,maxAge:60*60*12};
 const initialPassword=options.password||process.env.INIT_ADMIN_PASSWORD;
 if(!db.prepare('SELECT id FROM users LIMIT 1').get()){
  if(production&&!initialPassword)throw Error('Укажите INIT_ADMIN_PASSWORD перед первым production-запуском');
  const password=initialPassword||token().slice(0,24);if(password.length<12)throw Error('Первый пароль должен содержать не менее 12 символов');
  db.prepare('INSERT INTO users(login,password,role) VALUES(?,?,?)').run(process.env.INIT_ADMIN_LOGIN||'admin',await hashPassword(password),'admin');
  if(!initialPassword)writeFileSync(resolve(dataDir,'initial-admin.txt'),`Вход: ${process.env.INIT_ADMIN_LOGIN||'admin'}\nПароль: ${password}\n\nАдминка: http://127.0.0.1:4180/admin/\nПосле входа пароль можно изменить в разделе «Пользователи». Файл не раздаётся веб-сервером.\n`,{mode:0o600});
 }
 const dummyHash=await hashPassword(token());
 app.addHook('onRequest',async(req,reply)=>{
  reply.header('X-Content-Type-Options','nosniff').header('Referrer-Policy','strict-origin-when-cross-origin').header('X-Frame-Options','SAMEORIGIN');
  reply.header('Content-Security-Policy',"default-src 'self' https: data: blob:; script-src 'self' 'unsafe-inline' https://neo.tildacdn.com https://static.tildacdn.com https://mc.yandex.ru; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; object-src 'none'; base-uri 'self'; frame-ancestors 'self'; form-action 'self'");
  if(!production||req.url.startsWith('/admin')||req.url.startsWith('/api'))reply.header('X-Robots-Tag','noindex, nofollow');
  if(req.url.startsWith('/api')||req.url.startsWith('/admin'))reply.header('Cache-Control','no-store');
 });
 app.setErrorHandler((error,req,reply)=>{
  const code=error.statusCode>=400&&error.statusCode<500?error.statusCode:500;
  if(code===429)return fail(reply,429,'Слишком много попыток. Повторите позже');
  if(code===413)return fail(reply,413,'Файл или запрос слишком большой');
  if(code===415)return fail(reply,415,'Неподдерживаемый формат запроса');
  if(code===400)return fail(reply,400,'Проверьте формат отправленных данных');
  req.log.error({code:error.code||'INTERNAL'},'Request failed');return fail(reply,500,'Не удалось выполнить действие. Попробуйте ещё раз');
 });
 const rendered=(p,c,preview=false)=>renderPage(p,c,catalog,{origin,production,preview,version:state().version});
 const stableRender=(p,c)=>renderPage(p,c,catalog,{origin,production:true,version:0});
 const syncDates=c=>syncPageDates(db,PAGES,c,stableRender);
 tx(()=>syncPageDates(db,PAGES,state().published,stableRender,new Date().toISOString(),true));
 db.prepare('INSERT OR IGNORE INTO seo_workspace(id,data) VALUES(1,?)').run(JSON.stringify(seedWorkspace()));
 const workspace=()=>{const r=db.prepare('SELECT * FROM seo_workspace WHERE id=1').get();return {data:JSON.parse(r.data),revision:r.revision,updatedAt:r.updated_at};};
 app.get('/api/admin/seo/workspace',{preHandler:read},async()=>({...workspace(),origin,production}));
 app.post('/api/admin/seo/workspace/validate',{preHandler:adminWrite},async(req,reply)=>{try{validateWorkspace(req.body?.data,PAGES,origin);return {ok:true};}catch(e){return fail(reply,400,e.message);}});
 app.put('/api/admin/seo/workspace',{preHandler:adminWrite},async(req,reply)=>{
  try{validateWorkspace(req.body?.data,PAGES,origin);}catch(e){return fail(reply,400,e.message);}
  if(req.body?.revision!==workspace().revision)return fail(reply,409,'План продвижения изменён другим редактором. Сначала экспортируйте свои правки, затем загрузите актуальный план');
  tx(()=>{db.prepare('UPDATE seo_workspace SET data=?,revision=revision+1,updated_at=CURRENT_TIMESTAMP WHERE id=1').run(JSON.stringify(req.body.data));audit(req.user.login,'seo.workspace.saved',{campaigns:req.body.data.campaigns.length,placements:req.body.data.placements.length});});
  return workspace();
 });
 const seoReport=c=>({origin,production,publishedSitemap:sitemapRows(db,PAGES,state().published,origin),...inspectSeo(PAGES,c,catalog,stableRender,origin)});
 app.get('/api/admin/seo/report',{preHandler:read},async(req)=>seoReport(req.query.mode==='draft'?state().draft:state().published));
 app.post('/api/admin/seo/inspect',{preHandler:write},async(req,reply)=>{
  try{validateContent(req.body?.content,catalog);}catch(e){return fail(reply,400,e.message);}
  return seoReport(req.body.content);
 });
 const preflight=c=>{
  validateContent(c,catalog);
  if(c.checks.legal&&(!c.organization.legalName||!/^\d{10}(\d{2})?$/.test(c.organization.inn)||!/^\S+@\S+\.\S+$/.test(c.organization.email)||!c.organization.phone))throw Error('Для подтверждения политики заполните действительные реквизиты, ИНН, телефон и email');
  if(c.checks.legal&&Object.entries(catalog.texts).some(([id,f])=>f.uses.some(u=>u.page==='legal')&&/заготовкой для редактора|уточняются владельцем сайта|Перед запуском необходимо/.test(c.texts[id])))throw Error('Замените заготовку политики окончательным текстом перед подтверждением');
  for(const m of Object.values(c.media)){
   if(m.url.startsWith('/uploads/')&&!db.prepare('SELECT id FROM media WHERE url=?').get(m.url))throw Error('Выберите файл из медиатеки');
   if(m.url.startsWith('/images/')&&!Object.values(catalog.media).some(x=>x.url===m.url))throw Error('Неизвестное исходное изображение');
  }
  for(const p of PAGES){const html=rendered(p,c);if(/@@(?:TEXT|MEDIA|ALT)_/.test(html))throw Error('Не все поля страницы заполнены');}
 };
 app.get('/api/health',async()=>({ok:true,service:'brilliant-monolit',database:!!db.prepare('SELECT 1').get(),mode:production?'production':'local'}));
 app.get('/api/content',async()=>{const s=state();return {version:s.version,updatedAt:s.updated_at};});
 app.post('/api/auth/login',{preHandler:[g.origin],config:{rateLimit:{max:5,timeWindow:'15 minutes'}}},async(req,reply)=>{
  const login=clean(req.body?.login,80),password=req.body?.password;
  if(typeof password!=='string'||password.length>256)return fail(reply,400,'Укажите логин и пароль');
  const user=db.prepare('SELECT * FROM users WHERE login=?').get(login);
  const valid=await verifyPassword(password,user?.password||dummyHash);
  if(!user?.active||!valid){audit(login||'anonymous','login.failed');return fail(reply,401,'Неверный логин или пароль');}
  const raw=token(),csrf=token();db.prepare('DELETE FROM sessions WHERE expires<?').run(Date.now());
  db.prepare('INSERT INTO sessions(token,user_id,csrf,expires) VALUES(?,?,?,?)').run(digest(raw),user.id,csrf,Date.now()+12*3600000);
  reply.setCookie('monolit_session',raw,cookies);audit(user.login,'login');return {user:{id:user.id,login:user.login,role:user.role},csrf};
 });
 app.get('/api/auth/me',{preHandler:read},async req=>({user:{id:req.user.user_id,login:req.user.login,role:req.user.role},csrf:req.user.csrf}));
 app.post('/api/auth/logout',{preHandler:write},async(req,reply)=>{db.prepare('DELETE FROM sessions WHERE token=?').run(req.user.token);reply.clearCookie('monolit_session',cookies);return {ok:true};});
 app.post('/api/auth/password',{preHandler:write},async(req,reply)=>{
  const {currentPassword,newPassword}=req.body||{};
  if(typeof currentPassword!=='string'||currentPassword.length>256||typeof newPassword!=='string'||newPassword.length<12||newPassword.length>256)return fail(reply,400,'Новый пароль должен содержать от 12 до 256 символов');
  const user=db.prepare('SELECT * FROM users WHERE id=?').get(req.user.user_id);
  if(!await verifyPassword(currentPassword,user.password))return fail(reply,400,'Текущий пароль неверен');
  const password=await hashPassword(newPassword);tx(()=>{db.prepare('UPDATE users SET password=? WHERE id=?').run(password,user.id);db.prepare('DELETE FROM sessions WHERE user_id=? AND token<>?').run(user.id,req.user.token);audit(user.login,'password.changed');});return {ok:true};
 });
 app.get('/api/admin/content',{preHandler:read},async()=>{const s=state();return {content:s.draft,revision:s.revision,version:s.version,updatedAt:s.updated_at,catalog};});
 app.put('/api/admin/content/draft',{preHandler:write},async(req,reply)=>{
  const {content,revision}=req.body||{};try{preflight(content);}catch(e){return fail(reply,400,e.message);}
  if(revision!==state().revision)return fail(reply,409,'Черновик уже изменён. Обновите данные, чтобы не затереть чужую работу');
  tx(()=>{db.prepare('UPDATE content SET draft=?,revision=revision+1,updated_at=CURRENT_TIMESTAMP WHERE id=1').run(JSON.stringify(content));audit(req.user.login,'draft.saved');});return {ok:true,revision:state().revision};
 });
 app.post('/api/admin/content/discard',{preHandler:adminWrite},async(req,reply)=>{
  if(req.body?.revision!==state().revision)return fail(reply,409,'Черновик изменился. Обновите данные');
  tx(()=>{db.prepare('UPDATE content SET draft=published,revision=revision+1 WHERE id=1').run();audit(req.user.login,'draft.discarded');});return {ok:true};
 });
 app.post('/api/admin/content/publish',{preHandler:adminWrite},async(req,reply)=>{
  const s=state();if(req.body?.revision!==s.revision)return fail(reply,409,'Черновик изменился. Обновите данные');
  try{preflight(s.draft);}catch(e){return fail(reply,400,e.message);}
  const version=tx(()=>{const result=db.prepare('INSERT INTO versions(data,actor,note) VALUES(?,?,?)').run(JSON.stringify(s.draft),req.user.login,clean(req.body?.note,250)||'Публикация');const v=Number(result.lastInsertRowid);db.prepare('UPDATE content SET published=draft,version=?,revision=revision+1,updated_at=CURRENT_TIMESTAMP WHERE id=1').run(v);syncDates(s.draft);audit(req.user.login,'content.published',{version:v});return v;});return {ok:true,version};
 });
 app.get('/api/admin/content/versions',{preHandler:read},async()=>({versions:db.prepare('SELECT id,actor,note,created_at FROM versions ORDER BY id DESC LIMIT 100').all()}));
 app.post('/api/admin/content/versions/:id/restore',{preHandler:adminWrite},async(req,reply)=>{
  if(req.body?.revision!==state().revision)return fail(reply,409,'Черновик изменился. Обновите данные');
  const v=db.prepare('SELECT * FROM versions WHERE id=?').get(Number(req.params.id));if(!v)return fail(reply,404,'Версия не найдена');
  const content=upgradeContent(JSON.parse(v.data),catalog,JSON.parse(readFileSync(resolve(ROOT,'dist/default-content.json'),'utf8')));try{preflight(content);}catch(e){return fail(reply,400,e.message);}
  tx(()=>{db.prepare('UPDATE content SET draft=?,revision=revision+1 WHERE id=1').run(JSON.stringify(content));audit(req.user.login,'version.restored.to.draft',{version:v.id});});return {ok:true,message:'Версия восстановлена в черновик. Проверьте и опубликуйте её'};
 });
 app.get('/api/admin/preview/:key',{preHandler:read},async(req,reply)=>{
  const page=PAGES.find(p=>p.key===req.params.key);if(!page)return fail(reply,404,'Страница не найдена');return reply.type('text/html; charset=utf-8').send(rendered(page,state().draft,true));
 });
 app.post('/api/leads',{preHandler:[g.origin],config:{rateLimit:{max:5,timeWindow:'1 minute'}}},async(req,reply)=>{
  const b=req.body||{};if(b.website)return {ok:true};
  const s=state();if(production&&!s.published.checks.legal)return fail(reply,503,'Приём заявок временно недоступен');
  if(b.consent!==true)return fail(reply,400,'Подтвердите согласие на обработку данных');
  const digits=clean(b.phone,40).replace(/\D/g,'');const phone=digits.length===10?'7'+digits:digits.length===11&&digits[0]==='8'?'7'+digits.slice(1):digits;
  if(!/^\d{10,15}$/.test(phone)||/^([0-9])\1+$/.test(phone))return fail(reply,400,'Укажите корректный номер телефона');
  if(typeof b.requestId!=='string'||! /^[a-zA-Z0-9-]{16,80}$/.test(b.requestId))return fail(reply,400,'Обновите страницу и повторите отправку');
  const old=db.prepare('SELECT id FROM leads WHERE request_id=?').get(b.requestId);if(old)return {ok:true,id:old.id};
  let source='/';try{const u=new URL(b.source,origin);if(u.origin===origin)source=u.pathname.slice(0,200);}catch{}
  const utm=Object.fromEntries(['utm_source','utm_medium','utm_campaign','utm_term','utm_content'].filter(k=>typeof b.utm?.[k]==='string').map(k=>[k,clean(b.utm[k],200)]));
  const offer=Object.hasOwn(offerNames,b.offer??'')?b.offer:PAGES.find(p=>p.path===source&&Object.hasOwn(offerNames,p.key))?.key||'';
  const id=tx(()=>{const result=db.prepare('INSERT INTO leads(request_id,name,phone,comment,source,utm,consent_version,offer) VALUES(?,?,?,?,?,?,?,?)').run(b.requestId,clean(b.name,100),'+'+phone,clean(b.comment,3000),source,JSON.stringify(utm),s.version,offer);const id=Number(result.lastInsertRowid);for(const channel of configured(store.settings()))db.prepare('INSERT INTO deliveries(lead_id,channel) VALUES(?,?)').run(id,channel);return id;});
  return reply.code(201).send({ok:true,id});
 });
 app.get('/api/admin/leads',{preHandler:read},async(req)=>{
  const status=clean(req.query.status,20),search=clean(req.query.search,100),offset=Math.max(0,Number(req.query.offset)||0);
  const where="WHERE (?='' OR status=?) AND (?='' OR name LIKE ? OR phone LIKE ?)";const args=[status,status,search,'%'+search+'%','%'+search+'%'];
  return {leads:db.prepare('SELECT * FROM leads '+where+' ORDER BY id DESC LIMIT 100 OFFSET ?').all(...args,offset),total:db.prepare('SELECT count(*) n FROM leads '+where).get(...args).n};
 });
 app.get('/api/admin/leads/:id',{preHandler:read},async(req,reply)=>{const id=Number(req.params.id);const lead=db.prepare('SELECT * FROM leads WHERE id=?').get(id);if(!lead)return fail(reply,404,'Заявка не найдена');return {lead,notes:db.prepare('SELECT * FROM lead_notes WHERE lead_id=? ORDER BY id').all(id),deliveries:db.prepare('SELECT * FROM deliveries WHERE lead_id=?').all(id)};});
 app.patch('/api/admin/leads/:id',{preHandler:write},async(req,reply)=>{
  const id=Number(req.params.id),{status,assignee}=req.body||{};if(!['new','inwork','done','rejected'].includes(status))return fail(reply,400,'Некорректный статус');
  if(assignee!==null&&(!Number.isInteger(assignee)||!db.prepare('SELECT id FROM users WHERE id=? AND active=1').get(assignee)))return fail(reply,400,'Выберите действующего ответственного');
  const old=db.prepare('SELECT status,assignee FROM leads WHERE id=?').get(id);if(!old)return fail(reply,404,'Заявка не найдена');
  tx(()=>{db.prepare('UPDATE leads SET status=?,assignee=?,updated_at=CURRENT_TIMESTAMP WHERE id=?').run(status,assignee,id);db.prepare('INSERT INTO lead_notes(lead_id,actor,text) VALUES(?,?,?)').run(id,req.user.login,`Статус: ${old.status} → ${status}. Ответственный: ${old.assignee??'не назначен'} → ${assignee??'не назначен'}.`);audit(req.user.login,'lead.updated',{id,status,assignee});});return {ok:true};
 });
 app.post('/api/admin/leads/:id/notes',{preHandler:write},async(req,reply)=>{const id=Number(req.params.id),text=clean(req.body?.text,3000);if(!text)return fail(reply,400,'Введите заметку');if(!db.prepare('SELECT id FROM leads WHERE id=?').get(id))return fail(reply,404,'Заявка не найдена');db.prepare('INSERT INTO lead_notes(lead_id,actor,text) VALUES(?,?,?)').run(id,req.user.login,text);return {ok:true};});
 app.put('/api/admin/leads/:id/brief',{preHandler:write},async(req,reply)=>{
  const id=Number(req.params.id),b=req.body;
  const keys=['object','area','condition','project','task','start','nextStep'];
  if(!b||typeof b!=='object'||Array.isArray(b)||Object.keys(b).some(k=>!keys.includes(k))||keys.some(k=>typeof b[k]!=='string'||b[k].length>1500))return fail(reply,400,'Проверьте сведения об объекте');
  if(!db.prepare('SELECT id FROM leads WHERE id=?').get(id))return fail(reply,404,'Заявка не найдена');
  tx(()=>{db.prepare('UPDATE leads SET brief=?,updated_at=CURRENT_TIMESTAMP WHERE id=?').run(JSON.stringify(b),id);audit(req.user.login,'lead.brief.updated',{id});});return {ok:true};
 });
 app.post('/api/admin/leads/:id/retry',{preHandler:adminWrite},async(req,reply)=>{const id=Number(req.params.id);if(!db.prepare('SELECT id FROM leads WHERE id=?').get(id))return fail(reply,404,'Заявка не найдена');db.prepare("UPDATE deliveries SET status='pending',attempts=0,next_at=0 WHERE lead_id=? AND status='failed'").run(id);audit(req.user.login,'delivery.retry',{id});return {ok:true};});
 app.delete('/api/admin/leads/:id',{preHandler:adminWrite},async(req,reply)=>{const r=db.prepare('DELETE FROM leads WHERE id=?').run(Number(req.params.id));if(!r.changes)return fail(reply,404,'Заявка не найдена');audit(req.user.login,'lead.deleted',{id:Number(req.params.id)});return {ok:true};});
 app.get('/api/admin/media',{preHandler:read},async()=>({media:db.prepare('SELECT * FROM media ORDER BY created_at DESC').all()}));
 app.delete('/api/admin/media/:id',{preHandler:adminWrite},async(req,reply)=>{
  const m=db.prepare('SELECT * FROM media WHERE id=?').get(req.params.id);if(!m)return fail(reply,404,'Фотография не найдена');
  const s=state();const used=c=>Object.values(c.media).some(x=>x.url===m.url);
  if(used(s.draft)||used(s.published)||db.prepare('SELECT data FROM versions').all().some(v=>used(JSON.parse(v.data))))return fail(reply,409,'Фотография используется на сайте, в черновике или истории. Она сохранена для восстановления версий');
  const path=resolve(dataDir,'uploads',m.id+'.webp');if(existsSync(path))unlinkSync(path);
  db.prepare('DELETE FROM media WHERE id=?').run(m.id);audit(req.user.login,'media.deleted',{id:m.id});return {ok:true};
 });
 app.post('/api/admin/media',{preHandler:write},async(req,reply)=>{
  const file=await req.file();if(!file)return fail(reply,400,'Выберите изображение');
  const bytes=await file.toBuffer();let metadata,output;
  const jpeg=bytes.length>3&&bytes[0]===0xff&&bytes[1]===0xd8&&bytes[2]===0xff;
  const png=bytes.length>8&&bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]));
  const webp=bytes.length>12&&bytes.subarray(0,4).toString()==='RIFF'&&bytes.subarray(8,12).toString()==='WEBP';
  if(!jpeg&&!png&&!webp)return fail(reply,400,'Нужен файл JPG, PNG или WebP; расширения файла недостаточно');
  try{const image=sharp(bytes,{limitInputPixels:40000000,failOn:'warning'});metadata=await image.metadata();if(!['jpeg','png','webp'].includes(metadata.format)||metadata.pages>1)throw Error('format');output=await image.rotate().resize({width:2400,height:2400,fit:'inside',withoutEnlargement:true}).webp({quality:88}).toBuffer({resolveWithObject:true});}catch{return fail(reply,400,'Нужен корректный JPG, PNG или WebP до 10 МБ и 40 мегапикселей');}
  const id=randomUUID(),url='/uploads/'+id+'.webp';writeFileSync(resolve(dataDir,'uploads',id+'.webp'),output.data);
  db.prepare('INSERT INTO media(id,url,original_name,mime,width,height,bytes) VALUES(?,?,?,?,?,?,?)').run(id,url,clean(file.filename,200),'image/webp',output.info.width,output.info.height,output.data.length);audit(req.user.login,'media.uploaded',{id});return reply.code(201).send({id,url,width:output.info.width,height:output.info.height});
 });
 app.get('/api/admin/settings/integrations',{preHandler:adminRead},async()=>({settings:redactSettings(store.settings())}));
 app.put('/api/admin/settings/integrations',{preHandler:adminWrite},async(req,reply)=>{let settings;try{settings=mergeSettings(req.body,store.settings());}catch(e){return fail(reply,400,e.message);}db.prepare('UPDATE settings SET data=? WHERE id=1').run(JSON.stringify(settings));audit(req.user.login,'integrations.updated',{enabled:configured(settings)});return {ok:true};});
 app.get('/api/admin/users',{preHandler:read},async req=>({users:db.prepare(req.user.role==='admin'?'SELECT id,login,role,active,created_at FROM users ORDER BY id':'SELECT id,login FROM users WHERE active=1 ORDER BY id').all()}));
 app.post('/api/admin/users',{preHandler:adminWrite},async(req,reply)=>{
  const {login,password,role}=req.body||{};if(typeof login!=='string'||! /^[a-zA-Z0-9_.-]{3,50}$/.test(login)||typeof password!=='string'||password.length<12||password.length>256||!['admin','manager'].includes(role))return fail(reply,400,'Логин: 3–50 латинских символов; пароль: минимум 12 символов; выберите роль');
  if(db.prepare('SELECT id FROM users WHERE login=?').get(login))return fail(reply,409,'Логин занят');const r=db.prepare('INSERT INTO users(login,password,role) VALUES(?,?,?)').run(login,await hashPassword(password),role);audit(req.user.login,'user.created',{id:Number(r.lastInsertRowid),role});return {ok:true};
 });
 app.patch('/api/admin/users/:id',{preHandler:adminWrite},async(req,reply)=>{
  const id=Number(req.params.id),{active,role,password}=req.body||{};if(!Number.isInteger(id)||typeof active!=='boolean'||!['admin','manager'].includes(role))return fail(reply,400,'Некорректные параметры пользователя');
  if(!db.prepare('SELECT id FROM users WHERE id=?').get(id))return fail(reply,404,'Пользователь не найден');if(id===req.user.user_id&&(!active||role!=='admin'))return fail(reply,400,'Нельзя отключить себя или изменить собственную роль');
  const target=db.prepare('SELECT * FROM users WHERE id=?').get(id);if(target.role==='admin'&&target.active&&(!active||role!=='admin')&&db.prepare("SELECT count(*) n FROM users WHERE role='admin' AND active=1").get().n<2)return fail(reply,400,'Нужен хотя бы один активный администратор');
  if(password&&(typeof password!=='string'||password.length<12||password.length>256))return fail(reply,400,'Пароль должен содержать от 12 до 256 символов');const hashed=password?await hashPassword(password):null;
  tx(()=>{db.prepare('UPDATE users SET active=?,role=? WHERE id=?').run(active?1:0,role,id);if(hashed)db.prepare('UPDATE users SET password=? WHERE id=?').run(hashed,id);db.prepare('DELETE FROM sessions WHERE user_id=?').run(id);audit(req.user.login,'user.updated',{id,active,role});});return {ok:true};
 });
 app.get('/api/admin/audit',{preHandler:adminRead},async()=>({events:db.prepare('SELECT * FROM audit ORDER BY id DESC LIMIT 200').all()}));
 const optimizedManifest=resolve(ROOT,'dist/optimized-images/manifest.json');
 const optimizedImages=existsSync(optimizedManifest)?JSON.parse(readFileSync(optimizedManifest,'utf8')):{};
 app.addHook('onRequest',async(req,reply)=>{
  const entry=optimizedImages[req.url.split('?')[0]];
  if(!entry||!['GET','HEAD'].includes(req.method))return;
  reply.header('Vary','Accept');
  const webp=(req.headers.accept||'').split(',').some(part=>{const [type,...options]=part.trim().split(';');const quality=options.find(v=>v.trim().startsWith('q='));return type==='image/webp'&&(!quality||Number(quality.trim().slice(2))>0);});
  if(webp){
   const etag='"'+entry.outputHash+'"';reply.header('Cache-Control','public, max-age=86400').header('ETag',etag);
   if((req.headers['if-none-match']||'').split(',').map(v=>v.trim().replace(/^W\//,'')).some(v=>v===etag||v==='*'))return reply.code(304).send();
   return reply.type('image/webp').header('Content-Length',entry.optimizedBytes).send(req.method==='HEAD'?null:createReadStream(resolve(ROOT,'dist/optimized-images',entry.file)));
  }
 });
 for(const dir of ['images','css','js'])await app.register(staticFiles,{root:resolve(ROOT,dir),prefix:'/'+dir+'/',decorateReply:false,maxAge:'1d',index:false,redirect:false});
 await app.register(staticFiles,{root:resolve(ROOT,'site'),prefix:'/site/',decorateReply:false,maxAge:0,index:false,redirect:false});
 await app.register(staticFiles,{root:resolve(dataDir,'uploads'),prefix:'/uploads/',decorateReply:false,maxAge:'1y',immutable:true,index:false,redirect:false});
 if(existsSync(resolve(ROOT,'dist/admin')))await app.register(staticFiles,{root:resolve(ROOT,'dist/admin'),prefix:'/admin/',decorateReply:false,maxAge:0,index:['index.html'],redirect:true});
 app.get('/admin',async(req,reply)=>reply.redirect('/admin/',301));
 for(const page of PAGES){
  app.get(page.path,async(req,reply)=>reply.header('Cache-Control','no-store').type('text/html; charset=utf-8').send(rendered(page,state().published)));
  if(page.path!=='/')app.get(page.path+'/',async(req,reply)=>reply.redirect(page.path,301));
  if(!page.generated)app.get('/'+page.file,async(req,reply)=>reply.redirect(page.path,301));
 }
 for(const path of ['/main','/main/','/index.html'])app.get(path,async(req,reply)=>reply.redirect('/',301));
 app.get('/robots.txt',async(req,reply)=>reply.type('text/plain; charset=utf-8').send(production?`User-agent: *\nDisallow: /admin\nDisallow: /api/\nDisallow: /_redesign/\nSitemap: ${origin}/sitemap.xml\n`:'User-agent: *\nDisallow: /\n'));
 app.get('/sitemap.xml',async(req,reply)=>{const urls=sitemapRows(db,PAGES,state().published,origin).map(p=>`<url><loc>${esc(p.url)}</loc>${p.lastmod?'<lastmod>'+esc(p.lastmod)+'</lastmod>':''}</url>`).join('');return reply.header('Cache-Control','no-store').type('application/xml').send(`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls}</urlset>`);});
 app.setNotFoundHandler((req,reply)=>req.url.startsWith('/api/')?fail(reply,404,'Не найдено'):reply.code(404).header('X-Robots-Tag','noindex').type('text/html; charset=utf-8').send('<!doctype html><html lang="ru"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Страница не найдена — Бриллиант Монолит</title><body style="background:#1e1e1e;color:#fff;font-family:Arial,sans-serif;padding:10vh 8vw"><h1>Страница не найдена</h1><p>Проверьте адрес или перейдите на главную.</p><a href="/" style="color:#d4ad72">На главную</a></body></html>'));
 const tick=deliveryWorker(store,{sender:options.sender});let timer;
 if(options.worker!==false){timer=setInterval(()=>tick().catch(()=>{}),10000);timer.unref();}
 app.addHook('onClose',async()=>{clearInterval(timer);db.close();});
 app.decorate('deliveryTick',tick);return app;
}
