export const projectDefaults=Object.fromEntries([
 ['silver','ЖК «Серебряный парк», ул. Берзарина','38 м²','Просторная гостиная в спокойной бежево-серой гамме'],
 ['river','ЖК «Ривер Парк», ул. Коломенская','21 м²','Спальня с элементами japandi и тёплой натуральной палитрой'],
 ['garden','ЖК «Садовые кварталы», ул. Ефремова','18 м²','Современная кухня с матовыми фасадами и каменной столешницей'],
 ['symbol','ЖК «Символ», проезд Невельского','42 м²','Гостиная с многоуровневым светом и вечерней атмосферой'],
 ['lucky','ЖК «Lucky», ул. Костикова','9 м²','Ванная комната в натуральных оттенках с ощущением спа-зоны'],
 ['neva','ЖК «Neva Towers», Пресненская набережная','45 м²','Светлая гостиная с панорамным остеклением и видом на город']
].map(([id,title,area,description])=>[id,{title,area,description,city:'',areaKind:'',scope:'',period:'',status:''}]));
export const projectStatuses={'':'Не указан',completed:'Реализовано',design:'Визуализация',progress:'В работе'};
export function projectText(project,field){
 if(field==='title')return [project.city,project.title].filter(Boolean).join(' · ');
 if(field==='area')return [project.area,project.areaKind].filter(Boolean).join(' · ');
 if(field==='description')return [project.status?projectStatuses[project.status]:'',project.description,project.scope,project.period].filter(Boolean).join(' · ');
 return '';
}
