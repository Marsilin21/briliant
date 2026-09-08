import {writeFileSync} from 'node:fs';
import {seoPlan} from '../site/seo-plan.mjs';
// Ordered first 10 distinct direct organic URLs observed in Yandex UI on 2026-09-08.
// URI text decoded for readability; query parameters retained.
const blocks={
home:`https://uslugi.yandex.ru/47-nizhny-novgorod/category?text=ремонт+квартир+недорого+под+ключ+цены+вторичка
https://profi.ru/geo-nnov/remont/brigady-po-remontu-kvartir/
https://2gis.ru/n_novgorod/search/Ремонт и отделка квартир%2C офисов%2C помещений/rubricId/276
https://nn.domclick.ru/my-home/promo/remont
https://www.avito.ru/nizhniy_novgorod/predlozheniya_uslug?q=бюджетный+ремонт+квартир
https://yandex.ru/maps/47/nizhny-novgorod/category/construction_and_finishing_works/184107547/
https://zoon.ru/nn/building/type/remont_kvartir/page-2/
https://nizhniy-novgorod.lemanapro.ru/uslugi/
https://vk.ru/arthazoff
https://m2nn.ru/`,
capital:`https://uslugi.yandex.ru/47-nizhny-novgorod/category?text=капитальный+ремонт+квартир+под+ключ
https://nn.domclick.ru/my-home/promo/remont/kapitalnyj
https://yandex.ru/maps/47/nizhny-novgorod/search/Капитальный ремонт квартиры/
https://www.avito.ru/nizhegorodskaya_oblast/predlozheniya_uslug/remont_i_otdelka/remont_kvartir_i_domov_pod_klyuch/kapitalnyy_remont_kvartiry-ASgBAgICA0SYC8CfAcQVwPUByq4P9rjzAg
https://profi.ru/geo-nnov/remont/kapitalnyj-remont-kvartir-pod-klyuch/
https://zoon.ru/nn/p-remont-kapitalnyj_remont_kvartir_i_kottedzhej/
https://astracolor.ru/kapitalnyi-remont-kvartir
https://nizhniy-novgorod.proff-remont.ru/kapitalnyj_remont/
https://alphastroy.pro/vidy-remonta/kapitalnyj-remont/
https://remontstroynn.ru/kapitalnyj-remont-kvartir/`,
resale:`https://nn.domclick.ru/my-home/promo/remont/vtorichka
https://uslugi.yandex.ru/47-nizhny-novgorod/category?text=ремонт+квартир+недорого+под+ключ+цены+вторичка
https://profi.ru/geo-nnov/remont/remont-vtorichnogo-zhilya/
https://www.avito.ru/nizhniy_novgorod/predlozheniya_uslug/remont_i_otdelka/remont_kvartir_i_domov_pod_klyuch/remont_vo_vtoricke-ASgBAgICA0SYC8CfAcQVwPUByq4PjqeaAw
https://zoon.ru/nn/building/type/remont_vtorichnogo_zhilya/
https://youdo.com/g-nnovgorod/remont/podkljuch/flat/mnogokvartirniydom
https://glavremont52.ru/remont-kvartiry/vo-vtorichke/
https://vk.ru/arthazoff
https://nizhniy-novgorod.proff-remont.ru/remont-vtorichki/
https://arthazoff.ru/`,
newbuild:`https://uslugi.yandex.ru/47-nizhny-novgorod/category/remont-i-stroitelstvo/remont-kvartir-i-domov/remont-v-novostrojke--1822
https://nn.domclick.ru/my-home/promo/remont/v-novostrojke
https://www.avito.ru/nizhniy_novgorod/predlozheniya_uslug?q=ремонт+квартир+в+новостройке+под+ключ
https://profi.ru/geo-nnov/remont/remont-v-novostroike/
https://zoon.ru/nn/building/type/remont_v_novostrojke/
https://yandex.ru/maps/47/nizhny-novgorod/search/Ремонт новостройки/
https://alphastroy.pro/remont-kvartir-v-novostrojkah/
https://remontstroynn.ru/remont-kvartir-v-novostrojke/
https://vashdom-nn.ru/remont-kvartir/tip-doma/novostroyka/
https://youdo.com/g-nnovgorod/remont/podkljuch/flat/novostroyka`,
cosmetic:`https://uslugi.yandex.ru/47-nizhny-novgorod/category/remont-i-stroitelstvo/remont-kvartir-i-domov/kosmeticheskij-remont-kvartiryi--1820
https://www.avito.ru/nizhniy_novgorod/predlozheniya_uslug?q=косметический+ремонт+квартир
https://profi.ru/geo-nnov/remont/kosmeticheskij-remont/
https://nn.domclick.ru/my-home/promo/remont/kosmeticheskij
https://pro.petrovich.ru/niznij-novgorod/users/kompleksnyj-remont/kvartira/kosmeticeskij-remont-kvartiry
https://zoon.ru/nn/building/type/kosmeticheskij_remont/
https://yandex.ru/maps/47/nizhny-novgorod/search/Ремонт квартир/
https://remontstroynn.ru/kosmeticheskij-remont-kvartir/
https://nizhniy-novgorod.proff-remont.ru/kosmeticheskij_remont/
https://www.yell.ru/nnovgorod/top/kosmeticheskij-remont/`,
design:`https://uslugi.yandex.ru/47-nizhny-novgorod/category/dizajneryi/dizajner-intererov--258
https://yandex.ru/maps/47/nizhny-novgorod/search/Консультация дизайнера интерьера/?page=2
https://2gis.ru/n_novgorod/search/Нижний новгород дизайн интерьера
https://www.avito.ru/nizhniy_novgorod/predlozheniya_uslug?q=дизайн+интерьера
https://nn.domclick.ru/my-home/promo/design-project
https://freshart-nn.ru/portfolio/
https://basicdecor.ru/interiors/designers/nizhniy-novgorod/
https://zoon.ru/nn/p-freelancer-dizajn_interera/
https://www.inmyroom.ru/novgorod/pro/s-dizayner-interiera
https://elproko.ru/`,
premium:`https://uslugi.yandex.ru/47-nizhny-novgorod/category?text=дизайнерский+ремонт+квартир+и+домов
https://nn.domclick.ru/my-home/promo/remont/dizajnerskij
https://profi.ru/geo-nnov/remont/dizajnerskij-remont/
https://www.avito.ru/nizhniy_novgorod/predlozheniya_uslug/remont_i_otdelka/remont_kvartir_i_domov_pod_klyuch/dizaynerskiy_remont_kvartir-ASgBAgICA0SYC8CfAcQVwPUByq4PkLnzAg
https://yandex.ru/maps/47/nizhny-novgorod/search/Дизайнерский ремонт квартиры/
https://elementarnooo.ru/
https://arthazoff.ru/
https://zoon.ru/nn/building/type/dizajnerskij_remont_kvartiry/
https://alphastroy.pro/vidy-remonta/dizajnerskij-remont/
https://sc-remstroy.ru/`,
supervision:`https://profi.ru/geo-nnov/remont/design/dizain-interiera/dizain-proekt/avtorskii-nadzor/
https://uslugi.yandex.ru/47-nizhny-novgorod/category?text=Авторский надзор в строительстве
https://zoon.ru/nn/building/type/avtorskij_nadzor_dizajnera/
https://www.avito.ru/nizhniy_novgorod/predlozheniya_uslug/delovye_uslugi/konsultirovanie-ASgBAgICAkSYC7KfAZ4L~J8B?q=авторский+надзор
https://elproko.ru/avtorskiy-nadzor/
https://2gis.ru/n_novgorod/search/Авторский надзор
https://nnv.pgp.com.ru/services/author_supervision/
https://vashdom-nn.ru/avtorskiy-nadzor/
https://hands.ru/nizhny-novgorod/service/avtorskii-nadsor/
https://www.yell.ru/nnovgorod/top/avtorskij-nadzor-dizajnera/`,
houses:`https://uslugi.yandex.ru/47-nizhny-novgorod/category?text=Ремонт частного дома цена за работу
https://2gis.ru/n_novgorod/search/Ремонт домов нижний новгород
https://www.avito.ru/nizhniy_novgorod/predlozheniya_uslug?q=ремонт+домов+под+ключ
https://yandex.ru/maps/47/nizhny-novgorod/category/construction_and_finishing_works/184107547/
https://profi.ru/geo-nnov/remont/remont-dachnyh-domov/
https://zoon.ru/nn/building/type/remont_dachnyh_domov/
https://nn.domclick.ru/my-home/promo/remont
https://stroyterem-nn.ru/uslugi/remont-domov/
https://alphastroy.pro/remont-domov-i-kottedzhej/
https://youla.ru/nizhniy_novgorod/uslugi/remont-stroitelstvo`,
construction:`https://uslugi.yandex.ru/47-nizhny-novgorod/category/remont-i-stroitelstvo/stroitelstvo-domov-i-kottedzhej--1954
https://nn.domclick.ru/stroitelstvo-domov
https://2gis.ru/n_novgorod/search/Строительство коттеджей
https://yandex.ru/maps/47/nizhny-novgorod/search/Строительство домов/
https://zoon.ru/nn/building/type/stroitelstvo_dach_i_kottedzhej/
https://www.avito.ru/nizhniy_novgorod/predlozheniya_uslug/stroitelstvo-ASgBAgICAUSYC6Cf8QI?q=строительство+домов+под+ключ
https://stroylider-nn.ru/catalog/kottedzhi/
https://profi.ru/geo-nnov/remont/stroitelstvo-domov/
https://nn.acpdom.ru/
https://www.kp.ru/expert/special/stroitelstvo-chastnyh-domov-v-nizhnem-novgorode/`,
home_variant:`https://uslugi.yandex.ru/47-nizhny-novgorod/category?text=Ремонт квартир под ключ цены недорого
https://yandex.ru/maps/47/nizhny-novgorod/search/Ремонт под ключ/
https://profi.ru/geo-nnov/remont/otdelka_i_remont_kvartir_pod_kljuch/
https://www.avito.ru/nizhniy_novgorod/predlozheniya_uslug/remont_i_otdelka-ASgBAgICAUSYC8CfAQ?q=ремонт+квартир+под+ключ
https://nn.domclick.ru/my-home/promo/remont/pod-klyuch
https://zoon.ru/nn/building/type/otdelka_pod_klyuch/
https://vk.ru/arthazoff
https://arthazoff.ru/
https://2gis.ru/n_novgorod/search/Ремонт и отделка квартир%2C офисов%2C помещений/rubricId/276
https://vashdom-nn.ru/remont-kvartir/`,
resale_variant:`https://uslugi.yandex.ru/47-nizhny-novgorod/category?text=ремонт+квартир+недорого+под+ключ+цены+вторичка
https://nn.domclick.ru/my-home/promo/remont/vtorichka
https://profi.ru/geo-nnov/remont/remont-vtorichnogo-zhilya/
https://zoon.ru/nn/building/type/remont_vtorichnogo_zhilya/
https://www.avito.ru/nizhniy_novgorod/predlozheniya_uslug/remont_i_otdelka/remont_kvartir_i_domov_pod_klyuch/remont_vo_vtoricke-ASgBAgICA0SYC8CfAcQVwPUByq4PjqeaAw
https://youdo.com/g-nnovgorod/remont/podkljuch/flat/mnogokvartirniydom
https://glavremont52.ru/remont-kvartiry/vo-vtorichke/
https://nizhniy-novgorod.proff-remont.ru/remont-vtorichki/
https://www.yell.ru/nnovgorod/top/remont-vtorichnogo-zhilya/
https://nizhniy.garantstroikompleks.ru/remont-vtorichnogo-zhilya`,
capital_variant:`https://nn.domclick.ru/my-home/promo/remont/kapitalnyj
https://uslugi.yandex.ru/47-nizhny-novgorod/category?text=капитальный+ремонт+квартир+под+ключ
https://profi.ru/geo-nnov/remont/remont-kvartir-kottedzhey/kapitalnyi-remont-kvartir-i-kottedzhei/
https://vashdom-nn.ru/remont-kvartir/tip-remonta/kapitalnyy-remont/
https://zoon.ru/nn/p-remont-kapitalnyj_remont_kvartir_i_kottedzhej/
https://glavremont52.ru/remont-kvartiry/kapitalnyy/
https://nizhniy-novgorod.proff-remont.ru/kapitalnyj_remont/
https://fkrnnov.ru/
https://alphastroy.pro/vidy-remonta/kapitalnyj-remont/
https://dzine.ru/kapitalnyj-remont-pod-klyuch`,
premium_variant:`https://uslugi.yandex.ru/47-nizhny-novgorod/category?text=дизайнерский+ремонт
https://nn.domclick.ru/my-home/promo/remont/dizajnerskij
https://profi.ru/geo-nnov/remont/dizajnerskij-remont/
https://2gis.ru/n_novgorod/search/Ремонт квартир по дизайн проекту
https://yandex.ru/maps/47/nizhny-novgorod/search/Дизайнерский ремонт/
https://www.avito.ru/nizhniy_novgorod/predlozheniya_uslug/tag/dizajn-proekt-kvartiry
https://arthazoff.ru/
https://max-dar.ru/new
https://alphastroy.pro/vidy-remonta/dizajnerskij-remont/
https://freshart-nn.ru/`,
design_variant:`https://uslugi.yandex.ru/47-nizhny-novgorod/category/dizajneryi/dizajner-intererov/dizajn-proekt-interera-kvartiryi--261
https://2gis.ru/n_novgorod/search/Дизайн-проект квартиры
https://yandex.ru/maps/47/nizhny-novgorod/search/Дизайн проект интерьера/
https://www.avito.ru/nizhniy_novgorod/predlozheniya_uslug/tag/dizajn-proekt-kvartiry
https://www.inmyroom.ru/novgorod/pro/s-dizayner-interiera
https://zoon.ru/nn/building/type/dizajn_intererov/
https://elproko.ru/
https://interior-design.su/
https://prb52.com/
https://regodesign.ru/portfolio/proekty/`
};
const variants={home_variant:'ремонт квартир под ключ нижний новгород',resale_variant:'ремонт вторички нижний новгород',capital_variant:'капремонт квартиры нижний новгород',premium_variant:'ремонт по дизайн проекту нижний новгород',design_variant:'дизайн проект квартиры нижний новгород'};
const twoPages=new Set(['capital','houses','premium_variant','design_variant']);
const samples=Object.entries(blocks).map(([id,block])=>{const query=variants[id]||seoPlan[id].queries[0];const source='https://yandex.ru/search/?text='+encodeURIComponent(query)+'&lr=47';const urls=block.split('\n').map(u=>new URL(u).href);if(urls.length!==10||new Set(urls).size!==10)throw Error('Invalid sample '+id);return {id,query,checkedAt:'2026-09-08',sources:twoPages.has(id)?[source,source+'&p=1']:[source],urls};});
function normalize(s){const u=new URL(s);u.hash='';u.hostname=u.hostname.replace(/^www\./,'');u.searchParams.sort();return u.hostname+u.pathname.replace(/\/$/,'')+u.search;}
const pairs=[];
for(let i=0;i<samples.length;i++)for(let j=i+1;j<samples.length;j++){
 const a=samples[i],b=samples[j],bUrls=new Set(b.urls.map(normalize));
 const commonUrls=a.urls.filter(u=>bUrls.has(normalize(u)));
 const hosts=s=>new Set(s.urls.map(u=>new URL(u).hostname.replace(/^www\./,'')));
 const ah=hosts(a),bh=hosts(b),commonHosts=[...ah].filter(h=>bh.has(h));
 pairs.push({a:a.id,b:b.id,commonUrls,urlOverlap:commonUrls.length,percent:commonUrls.length*10,commonHosts,hostOverlap:commonHosts.length});
}
const report={checkedAt:'2026-09-08',engine:'Yandex desktop UI, current authenticated session',region:'lr=47 (Нижний Новгород)',method:'First 10 distinct ordinary direct organic result URLs in DOM order. Ads/promo/yabs/count links and widgets excluded. Organic directories, maps, social sites included. Where fewer than 10 distinct URLs on page 1, continue page 2, deduplicate. URL equality ignores scheme, www, trailing slash, hash; preserves path and query. Host matches are separate and do not establish same intent.',limitations:'One date/session, not depersonalized tracking or Google. lr sets regional preference; IP/account can affect results. No ranking guarantee. Low overlap alone does not require separate pages.',samples,pairs};
writeFileSync(new URL('./SERP_OVERLAP_2026-09-08.json',import.meta.url),JSON.stringify(report,null,2)+'\n');
console.log(pairs.filter(p=>[['capital','resale'],['capital','newbuild'],['capital','cosmetic'],['design','premium'],['design','supervision'],['houses','construction'],['resale','resale_variant'],['capital','capital_variant'],['premium','premium_variant'],['home','home_variant']].some(([a,b])=>p.a===a&&p.b===b)));
