import sharp from 'sharp';
import {readFileSync,writeFileSync,mkdirSync,existsSync,statSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
const hash=b=>createHash('sha256').update(b).digest('hex');
export async function optimizeImages(root,catalog){
 const directory=resolve(root,'dist/optimized-images'),manifestFile=resolve(directory,'manifest.json');mkdirSync(directory,{recursive:true});
 const previous=existsSync(manifestFile)?JSON.parse(readFileSync(manifestFile,'utf8')):{},manifest={};
 for(const media of Object.values(catalog.media)){
  // Only photographic source PNGs; logo and decorative artwork are excluded.
  if(!/freepik.*\.png$/i.test(media.url))continue;
  const source=readFileSync(resolve(root,media.url.slice(1)));if(source.length<150000)continue;
  const digest=hash(source),file=digest+'.webp',output=resolve(directory,file),cached=previous[media.url];
  if(cached?.sourceHash===digest&&existsSync(output)&&hash(readFileSync(output))===cached.outputHash){manifest[media.url]=cached;continue;}
  const raw=await sharp(source).ensureAlpha().raw().toBuffer({resolveWithObject:true});
  const image=await sharp(raw.data,{raw:raw.info}).webp({lossless:true,effort:4}).toBuffer();
  const decoded=await sharp(image).ensureAlpha().raw().toBuffer();
  if(!decoded.equals(raw.data)||image.length>=source.length)continue;
  writeFileSync(output,image);manifest[media.url]={file,sourceHash:digest,outputHash:hash(image),originalBytes:source.length,optimizedBytes:image.length,width:raw.info.width,height:raw.info.height,pixelIdentical:true};
 }
 writeFileSync(manifestFile,JSON.stringify(manifest,null,2));
 const totals=Object.values(manifest).reduce((a,m)=>({original:a.original+m.originalBytes,optimized:a.optimized+m.optimizedBytes}),{original:0,optimized:0});
 console.log(`Без потери пикселей: ${Object.keys(manifest).length} фотографий, ${totals.original} → ${totals.optimized} байт. Логотип и исходники сохранены.`);
}
