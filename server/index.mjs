import { createApp } from './app.mjs';
const app=await createApp({logger:true});
const address=await app.listen({host:process.env.HOST||'127.0.0.1',port:Number(process.env.PORT||4180)});
console.log(`Сайт: ${address}/ · Админка: ${address}/admin/`);
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,async()=>{await app.close();process.exit(0);});
