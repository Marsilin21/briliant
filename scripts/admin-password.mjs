import {openStore} from '../server/db.mjs';
import {hashPassword,token} from '../server/auth.mjs';
import {ROOT} from '../server/content.mjs';
import {resolve} from 'node:path';
import {writeFileSync} from 'node:fs';
const dir=resolve(process.env.DATA_DIR||resolve(ROOT,'data'));
const store=openStore(dir),login=process.env.INIT_ADMIN_LOGIN||'admin',password=token().slice(0,24);
const existing=store.db.prepare('SELECT id FROM users WHERE login=?').get(login);
const hashed=await hashPassword(password);
store.tx(()=>{
 if(existing){store.db.prepare("UPDATE users SET password=?,role='admin',active=1 WHERE id=?").run(hashed,existing.id);store.db.prepare('DELETE FROM sessions WHERE user_id=?').run(existing.id);}
 else store.db.prepare("INSERT INTO users(login,password,role) VALUES(?,?,'admin')").run(login,hashed);
 store.audit('local-command','password.reset',{login});
});
writeFileSync(resolve(dir,'initial-admin.txt'),`Вход: ${login}\nПароль: ${password}\n\nВсе предыдущие сессии этого пользователя завершены.\n`,{mode:0o600});
store.db.close();console.log('Новый пароль сохранён в data/initial-admin.txt (либо DATA_DIR). Он не выводится в журнал.');
