import {DatabaseSync,backup} from 'node:sqlite';
import {mkdirSync,copyFileSync,writeFileSync,renameSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {ROOT} from '../server/content.mjs';
const dataDir=resolve(process.env.DATA_DIR||resolve(ROOT,'data'));
const stamp=new Date().toISOString().replace(/[:.]/g,'-');
const destination=resolve(process.env.BACKUP_DIR||resolve(ROOT,'backups'),stamp);
const partial=destination+'.partial';mkdirSync(join(partial,'uploads'),{recursive:true});
const live=new DatabaseSync(join(dataDir,'monolit.sqlite'),{readOnly:true});
try{
 await backup(live,join(partial,'monolit.sqlite'));
 const snapshot=new DatabaseSync(join(partial,'monolit.sqlite'),{readOnly:true});
 try{
  if(snapshot.prepare('PRAGMA integrity_check').get().integrity_check!=='ok')throw Error('Проверка целостности базы не пройдена');
  const media=snapshot.prepare('SELECT id FROM media').all();
  for(const m of media)copyFileSync(join(dataDir,'uploads',m.id+'.webp'),join(partial,'uploads',m.id+'.webp'));
  writeFileSync(join(partial,'manifest.json'),JSON.stringify({createdAt:new Date().toISOString(),mediaCount:media.length,integrity:'ok',database:'monolit.sqlite'},null,2));
 }finally{snapshot.close();}
 renameSync(partial,destination);console.log('Резервная копия создана: '+destination);
}finally{live.close();}
