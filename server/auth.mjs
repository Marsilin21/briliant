import { randomBytes, scrypt, timingSafeEqual, createHash } from 'node:crypto';
import { promisify } from 'node:util';
const derive=promisify(scrypt);
export const token=()=>randomBytes(32).toString('hex');
export const digest=s=>createHash('sha256').update(s).digest('hex');
export async function hashPassword(password){const salt=randomBytes(16).toString('hex');const key=await derive(password,salt,64);return salt+':'+key.toString('hex');}
export async function verifyPassword(password,stored){
 const [salt,hex]=stored.split(':');if(!salt||!hex)return false;
 const candidate=await derive(password,salt,64);const expected=Buffer.from(hex,'hex');return expected.length===candidate.length && timingSafeEqual(expected,candidate);
}
export function secureEqual(a,b){if(typeof a!=='string'||typeof b!=='string')return false;const left=Buffer.from(a),right=Buffer.from(b);return left.length===right.length&&timingSafeEqual(left,right);}
export function guards(store,origins){
 const origin=async(req,reply)=>{if(!origins.has(req.headers.origin))return reply.code(403).send({error:'Запрос с этого адреса запрещён'});};
 const auth=async(req,reply)=>{
  const raw=req.cookies.monolit_session;if(!raw)return reply.code(401).send({error:'Войдите в админ-панель'});
  const session=store.db.prepare('SELECT s.*,u.login,u.role,u.active FROM sessions s JOIN users u ON u.id=s.user_id WHERE token=? AND expires>?').get(digest(raw),Date.now());
  if(!session?.active)return reply.code(401).send({error:'Сессия завершена. Войдите снова'});req.user=session;
 };
 const csrf=async(req,reply)=>{if(!secureEqual(req.headers['x-csrf-token'],req.user?.csrf))return reply.code(403).send({error:'Обновите страницу и повторите действие'});};
 const admin=async(req,reply)=>{if(req.user?.role!=='admin')return reply.code(403).send({error:'Действие доступно только администратору'});};
 return {origin,auth,csrf,admin};
}
