import { DatabaseSync } from 'node:sqlite';
import { mkdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { ROOT } from './content.mjs';
import {upgradeContent} from './migrate-content.mjs';

export function openStore(dataDir){
 mkdirSync(dataDir,{recursive:true});mkdirSync(resolve(dataDir,'uploads'),{recursive:true});
 const db=new DatabaseSync(resolve(dataDir,'monolit.sqlite'));
 db.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;
 CREATE TABLE IF NOT EXISTS users(id INTEGER PRIMARY KEY,login TEXT NOT NULL UNIQUE,password TEXT NOT NULL,role TEXT NOT NULL CHECK(role IN ('admin','manager')),active INTEGER NOT NULL DEFAULT 1,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
 CREATE TABLE IF NOT EXISTS sessions(token TEXT PRIMARY KEY,user_id INTEGER NOT NULL REFERENCES users(id),csrf TEXT NOT NULL,expires INTEGER NOT NULL);
 CREATE TABLE IF NOT EXISTS content(id INTEGER PRIMARY KEY CHECK(id=1),draft TEXT NOT NULL,published TEXT NOT NULL,revision INTEGER NOT NULL DEFAULT 1,version INTEGER NOT NULL DEFAULT 1,updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
 CREATE TABLE IF NOT EXISTS versions(id INTEGER PRIMARY KEY,data TEXT NOT NULL,actor TEXT NOT NULL,note TEXT NOT NULL,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
 CREATE TABLE IF NOT EXISTS leads(id INTEGER PRIMARY KEY,request_id TEXT NOT NULL UNIQUE,name TEXT NOT NULL,phone TEXT NOT NULL,comment TEXT NOT NULL,source TEXT NOT NULL,utm TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'new',assignee INTEGER REFERENCES users(id),consent_version INTEGER NOT NULL,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
 CREATE TABLE IF NOT EXISTS lead_notes(id INTEGER PRIMARY KEY,lead_id INTEGER NOT NULL REFERENCES leads(id) ON DELETE CASCADE,actor TEXT NOT NULL,text TEXT NOT NULL,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
 CREATE TABLE IF NOT EXISTS deliveries(id INTEGER PRIMARY KEY,lead_id INTEGER NOT NULL REFERENCES leads(id) ON DELETE CASCADE,channel TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'pending',attempts INTEGER NOT NULL DEFAULT 0,next_at INTEGER NOT NULL DEFAULT 0,last_error TEXT,updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
 CREATE TABLE IF NOT EXISTS media(id TEXT PRIMARY KEY,url TEXT NOT NULL,original_name TEXT NOT NULL,mime TEXT NOT NULL,width INTEGER NOT NULL,height INTEGER NOT NULL,bytes INTEGER NOT NULL,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
 CREATE TABLE IF NOT EXISTS settings(id INTEGER PRIMARY KEY CHECK(id=1),data TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS seo_workspace(id INTEGER PRIMARY KEY CHECK(id=1),data TEXT NOT NULL,revision INTEGER NOT NULL DEFAULT 1,updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
 CREATE TABLE IF NOT EXISTS seo_page_dates(page TEXT PRIMARY KEY,hash TEXT NOT NULL,modified_at TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS audit(id INTEGER PRIMARY KEY,actor TEXT NOT NULL,action TEXT NOT NULL,details TEXT NOT NULL,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
 CREATE INDEX IF NOT EXISTS leads_status ON leads(status,created_at DESC);
 CREATE INDEX IF NOT EXISTS sessions_expiry ON sessions(expires);
 CREATE INDEX IF NOT EXISTS deliveries_pending ON deliveries(status,next_at);`);
 for(const [name,definition] of [['offer','TEXT NOT NULL DEFAULT \'\''],['brief','TEXT NOT NULL DEFAULT \'{}\'']])if(!db.prepare('PRAGMA table_info(leads)').all().some(c=>c.name===name))db.exec(`ALTER TABLE leads ADD COLUMN ${name} ${definition}`);
 if(!db.prepare('SELECT id FROM content').get()){
  const seed=readFileSync(resolve(ROOT,'dist/default-content.json'),'utf8');
  db.prepare('INSERT INTO content(id,draft,published) VALUES(1,?,?)').run(seed,seed);
  db.prepare('INSERT INTO versions(data,actor,note) VALUES(?,?,?)').run(seed,'system','Исходный импорт с сохранением дизайна');
 }
 const catalog=JSON.parse(readFileSync(resolve(ROOT,'dist/catalog.json'),'utf8')),defaults=JSON.parse(readFileSync(resolve(ROOT,'dist/default-content.json'),'utf8'));
 const oldContent=db.prepare('SELECT draft,published FROM content WHERE id=1').get();
 const upgradedDraft=JSON.stringify(upgradeContent(JSON.parse(oldContent.draft),catalog,defaults)),upgradedPublished=JSON.stringify(upgradeContent(JSON.parse(oldContent.published),catalog,defaults));
 if(upgradedDraft!==oldContent.draft||upgradedPublished!==oldContent.published){
  db.exec('BEGIN IMMEDIATE');try{
   db.prepare('UPDATE content SET draft=?,published=?,revision=revision+1,updated_at=CURRENT_TIMESTAMP WHERE id=1').run(upgradedDraft,upgradedPublished);
   db.prepare('INSERT INTO audit(actor,action,details) VALUES(?,?,?)').run('system','content.migrated',JSON.stringify({schemaVersion:2,reason:'Индивидуальные тексты страниц и единые предложения; история сохранена'}));
   db.exec('COMMIT');
  }catch(e){db.exec('ROLLBACK');throw e;}
 }
 db.prepare('INSERT OR IGNORE INTO settings(id,data) VALUES(1,?)').run(JSON.stringify({telegram:{enabled:false,token:'',chatId:''},bitrix:{enabled:false,url:''},email:{enabled:false,host:'',port:465,secure:true,user:'',password:'',from:'',to:''}}));
 const state=()=>{const s=db.prepare('SELECT * FROM content WHERE id=1').get();return {...s,draft:JSON.parse(s.draft),published:JSON.parse(s.published)};};
 const audit=(actor,action,details={})=>db.prepare('INSERT INTO audit(actor,action,details) VALUES(?,?,?)').run(actor,action,JSON.stringify(details));
 const tx=fn=>{db.exec('BEGIN IMMEDIATE');try{const r=fn();db.exec('COMMIT');return r;}catch(e){db.exec('ROLLBACK');throw e;}};
 return {db,state,audit,tx,settings:()=>JSON.parse(db.prepare('SELECT data FROM settings WHERE id=1').get().data)};
}
