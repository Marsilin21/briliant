import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {ROOT} from './content.mjs';
import {defaultLinks} from '../site/link-management.mjs';

// Old versions remain immutable in SQLite. Upgrade a copy for editing/restoration.
export function upgradeContent(input,catalog,defaults){
 const previous=JSON.parse(readFileSync(resolve(ROOT,'scripts/legacy-content-v1.json'),'utf8'));
 const seoBaseline=JSON.parse(readFileSync(resolve(ROOT,'scripts/seo-baseline-v2.json'),'utf8'));
 const editorialBaseline=JSON.parse(readFileSync(resolve(ROOT,'scripts/editorial-baseline-v3.json'),'utf8'));
 const result={...structuredClone(input),schemaVersion:2,offers:structuredClone(input.offers??defaults.offers),texts:{}};
 result.projects=structuredClone(input.projects??defaults.projects);
 result.internalLinks=structuredClone(input.internalLinks??defaults.internalLinks??defaultLinks(catalog));
 result.seoRevision=1;
 result.seo=structuredClone(input.seo);
 for(const [key,seo]of Object.entries(defaults.seo)){
  if(!result.seo[key])result.seo[key]=structuredClone(seo);
  else if(!input.seoRevision)for(const part of ['title','description'])if(result.seo[key][part]===seoBaseline.seo[key]?.[part])result.seo[key][part]=seo[part];
 }
 for(const [id,field] of Object.entries(catalog.texts)){
  const prior=input.texts[field.legacyId];
  result.texts[id]=input.schemaVersion===2&&Object.hasOwn(input.texts,id)?input.texts[id]:typeof prior==='string'&&prior!==(previous.texts[field.legacyId]??field.original)?prior:defaults.texts[id];
  if(input.schemaVersion===2&&!Object.hasOwn(input.texts,id)){
   for(const use of field.uses){
    const oldId=createHash('sha256').update(use.page+':'+field.original).digest('hex').slice(0,20);
    if(Object.hasOwn(input.texts,oldId)&&input.texts[oldId]!==editorialBaseline.texts[oldId]){result.texts[id]=input.texts[oldId];break;}
   }
  }
  if(!input.seoRevision&&result.texts[id]===seoBaseline.texts[id])result.texts[id]=defaults.texts[id];
  if(result.texts[id]===editorialBaseline.texts[id])result.texts[id]=defaults.texts[id];
  if(!input.projects&&field.binding?.project){
   const b=field.binding,custom=input.texts[id]??prior;
   if(typeof custom==='string'&&custom!==field.original)result.projects[b.project][b.field]=custom;
  }
 }
 // Replace only unchanged baseline values; preserve independent editor changes.
 for(const [key,offer] of Object.entries(result.offers))for(const field of Object.keys(offer)){
  if(offer[field]===editorialBaseline.offers[key]?.[field])offer[field]=defaults.offers[key][field];
 }
 return result;
}
