// Visual catalogue metadata only. These names never modify saved HACCP journal data.
export const journalCards=Object.freeze({
 temperature:{description:'Контроль холодильников и морозильников',icon:'thermometer',tone:'blue'},
 humidity:{description:'Температура и влажность склада',icon:'droplet',tone:'blue'},
 frying:{description:'Качество и замена масла',icon:'droplet',tone:'amber'},
 receiving:{description:'Проверка поступающих продуктов',icon:'box',tone:'green'},
 storage:{description:'Маркировка и сроки хранения',icon:'layers',tone:'blue'},
 packaging:{description:'Контроль упаковки и маркировки',icon:'box',tone:'purple'},
 cooking:{description:'Контроль тепловой обработки',icon:'heat',tone:'amber'},
 defrosting:{description:'Контроль размораживания сырья',icon:'snowflake',tone:'blue'},
 quality:{description:'Проверка готовой продукции',icon:'check',tone:'green'},
 cleaning:{description:'Текущая и генеральная уборка',icon:'sparkle',tone:'blue'},
 hygiene:{description:'Осмотр сотрудников перед сменой',icon:'user',tone:'purple'},
 pests:{description:'Проверка помещений и зон',icon:'shield',tone:'green'},
 audit:{description:'Проверки и замечания по точкам',icon:'clipboard',tone:'blue'}
});
export const journalGroups=Object.freeze([
 {name:'Оборудование и условия',kinds:['temperature','humidity','frying']},
 {name:'Продукты и процессы',kinds:['receiving','storage','packaging','cooking','defrosting','quality']},
 {name:'Чистота, персонал и контроль',kinds:['cleaning','hygiene','pests','audit']}
]);
export const russianRecordCount=n=>String(n)+' '+(n%10===1&&n%100!==11?'запись':n%10>=2&&n%10<=4&&(n%100<12||n%100>14)?'записи':'записей');
export const russianJournalCount=n=>String(n)+' '+(n%10===1&&n%100!==11?'журнал':n%10>=2&&n%10<=4&&(n%100<12||n%100>14)?'журнала':'журналов');
// Safe, static SVG line icons: no remote assets, no icon fonts and no animations.
const paths={
 thermometer:'<path d="M14 14.8V5a3 3 0 0 0-6 0v9.8a5 5 0 1 0 6 0Z"/><path d="M11 9v9"/><path d="M10 18h2"/>',
 droplet:'<path d="M12 2c-2.2 4.2-7 9-7 13a7 7 0 0 0 14 0c0-4-4.8-8.8-7-13Z"/>',
 box:'<path d="m3 7 9-4 9 4-9 4-9-4Zm0 0v10l9 4 9-4V7m-9 4v10"/>',
 layers:'<path d="m12 3 9 5-9 5-9-5 9-5Zm-9 9 9 5 9-5M3 16l9 5 9-5"/>',
 heat:'<path d="M7 21c-2-2-2-5 0-7m5 7c-2-3-2-5 0-8s2-5 0-9m5 17c-2-2-2-5 0-7"/>',
 snowflake:'<path d="M12 2v20M4 7l16 10M20 7 4 17M9 5l3-3 3 3M9 19l3 3 3-3"/>',
 check:'<path d="M12 22c5-2 8-6 8-11V5l-8-3-8 3v6c0 5 3 9 8 11Z"/><path d="m8 12 3 3 5-6"/>',
 sparkle:'<path d="m12 2 2.7 7.3L22 12l-7.3 2.7L12 22l-2.7-7.3L2 12l7.3-2.7L12 2Z"/>',
 user:'<circle cx="12" cy="7" r="4"/><path d="M4 22v-2c0-4 3-6 8-6s8 2 8 6v2"/>',
 shield:'<path d="m12 2 8 4v6c0 5-4 8-8 10-4-2-8-5-8-10V6l8-4Z"/><path d="m8.5 12 2.5 2.5 4.5-5"/>',
 clipboard:'<rect x="5" y="5" width="14" height="17" rx="2"/><rect x="9" y="2" width="6" height="5" rx="1"/><path d="M9 12h6m-6 4h6"/>'
};
export function journalIcon(name){
 const nodes=paths[name]||paths.clipboard;
 return '<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">'+nodes+'</svg>';
}
