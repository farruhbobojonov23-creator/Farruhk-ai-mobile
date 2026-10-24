// Curated, unapproved prep-label drafts for sushi kitchens (2026-10-24).
// The active SanPiN 2.3/2.4.4282-26 DOES NOT prescribe a universal 12 h
// lifetime for these different products. A 12 h draft is a suggested INTERNAL
// maximum for planning only, NOT a legal claim and NOT an automatic food
// safety approval. Actual shelf life comes from manufacturer labels, TTK,
// processing conditions and the operator's documented safety assessment.
// Every new/filled-in item is blocked from printing until separately reviewed.
export const version='japanese-prep-drafts-2026-10-24-v1';
export const proposedHours=12;
export const proposedStorage='+2…+6 °C';
export const references=[
 'СанПиН 2.3/2.4.4282-26 (с 01.09.2026), пп. 5–11: сроки, безопасность и ТТК',
 'ТР ТС 022/2011, ст. 4: маркировка срока и условий хранения',
 'Маркировка поставщика и утверждённая ТТК конкретной продукции'
];
const items=[
  {
    "name": "Соус спайси",
    "prepEvent": "prepared",
    "description": "Соус холодного смешивания; состав и стабильность проверяются по ТТК. Предыдущее предложение 48 ч у владельца сохраняется без изменения."
  },
  {
    "name": "Соус сырный",
    "prepEvent": "prepared",
    "description": "Домашний/цеховой соус: срок обосновать по ТТК и технологии."
  },
  {
    "name": "Фирменный соус",
    "prepEvent": "prepared",
    "description": "Состав и способ приготовления определяют допустимый срок."
  },
  {
    "name": "Огурцы",
    "prepEvent": "prepared",
    "description": "Вымытые и нарезанные огурцы; маркировать время подготовки.",
    "aliases": [
      "Огурцы (нарезка)"
    ]
  },
  {
    "name": "Капуста",
    "prepEvent": "prepared",
    "description": "Свежая нашинкованная капуста; учитывать наличие заправки.",
    "aliases": [
      "Капуста (нарезка)"
    ]
  },
  {
    "name": "Такуан",
    "prepEvent": "opened",
    "description": "Только после вскрытия/перекладки из заводской тары; срок не длиннее срока изготовителя."
  },
  {
    "name": "Форель",
    "prepEvent": "thawed",
    "description": "Если фактически разморожена; учитывать более строгие заводские условия хранения и срок после разморозки."
  },
  {
    "name": "Угорь",
    "prepEvent": "opened",
    "description": "Если заводской термообработанный угорь после вскрытия; правила изготовителя приоритетны."
  },
  {
    "name": "Креветка",
    "prepEvent": "thawed",
    "description": "После размораживания; вид (сырая/варёная) и маркировку необходимо сверить."
  },
  {
    "name": "Курица готовая",
    "prepEvent": "prepared",
    "description": "После полной термообработки и контролируемого охлаждения по ТТК."
  },
  {
    "name": "Снежный краб",
    "prepEvent": "opened",
    "description": "Сурими/крабовый продукт после вскрытия: срок не дольше заводского."
  },
  {
    "name": "Сливочный соус",
    "prepEvent": "prepared",
    "description": "Соус собственного приготовления: проверка состава и технологии."
  },
  {
    "name": "Перец",
    "prepEvent": "prepared",
    "description": "Промытый нарезанный перец.",
    "aliases": [
      "Перец (нарезка)"
    ]
  },
  {
    "name": "Омлет",
    "prepEvent": "prepared",
    "description": "После термообработки яиц и охлаждения по ТТК."
  },
  {
    "name": "Морковь",
    "prepEvent": "prepared",
    "description": "Мытая, очищенная или нарезанная морковь.",
    "aliases": [
      "Морковь (нарезка)"
    ]
  },
  {
    "name": "Бульон Том Ям",
    "prepEvent": "prepared",
    "description": "После приготовления и быстрого безопасного охлаждения по ТТК."
  },
  {
    "name": "Унаги соус",
    "prepEvent": "opened",
    "description": "Заводской соус после вскрытия/перелива; срок изготовителя приоритетен.",
    "aliases": [
      "Соус унаги"
    ]
  },
  {
    "name": "Терияки соус",
    "prepEvent": "opened",
    "description": "Заводской соус после вскрытия/перелива; срок изготовителя приоритетен.",
    "aliases": [
      "Терияки",
      "Соус терияки"
    ]
  },
  {
    "name": "Сладкий чили",
    "prepEvent": "opened",
    "description": "Заводской соус после вскрытия/перелива; срок изготовителя приоритетен.",
    "aliases": [
      "Соус сладкий чили"
    ]
  },
  {
    "name": "Авокадо (нарезка)",
    "prepEvent": "prepared",
    "description": "Свежая нарезка: время подготовки и условия подтверждаются ТТК."
  },
  {
    "name": "Лук зелёный (нарезка)",
    "prepEvent": "prepared",
    "description": "Промытый и нарезанный зелёный лук."
  },
  {
    "name": "Дайкон (нарезка)",
    "prepEvent": "prepared",
    "description": "Мытая и нарезанная редька."
  },
  {
    "name": "Лайм (дольки)",
    "prepEvent": "prepared",
    "description": "Промытый разрезанный лайм, хранить закрытым.",
    "aliases": [
      "Лимон / лайм (дольки)"
    ]
  },
  {
    "name": "Лосось (размороженный)",
    "prepEvent": "thawed",
    "description": "Рыба после разморозки: проверять заводские режимы и безопасность употребления без нагрева.",
    "aliases": [
      "Лосось / сёмга (размороженная, порционированная)"
    ]
  },
  {
    "name": "Мидии (мясо)",
    "prepEvent": "thawed",
    "description": "После разморозки; сырые и готовые моллюски требуют разных ТТК."
  },
  {
    "name": "Кальмар (подготовленный)",
    "prepEvent": "prepared",
    "description": "Уточнить вид: сырой, размороженный либо отварной; готовый срок только по ТТК."
  },
  {
    "name": "Спайси-майо",
    "prepEvent": "prepared",
    "description": "Смешанный соус; срок зависит от состава и санитарной технологии."
  },
  {
    "name": "Сырная начинка",
    "prepEvent": "prepared",
    "description": "Смешанный сырный полуфабрикат; нужна ТТК."
  },
  {
    "name": "Шапка сырная",
    "prepEvent": "prepared",
    "description": "Сырная смесь для запекания: срок до термообработки по ТТК."
  },
  {
    "name": "Соус Том Ям (база)",
    "prepEvent": "prepared",
    "description": "Концентрат/база: порядок приготовления и охлаждения по ТТК.",
    "aliases": [
      "Соус Том Ям база"
    ]
  },
  {
    "name": "Сливочный сыр (открытый)",
    "prepEvent": "opened",
    "description": "Открытая заводская упаковка: не превышать срок и режим изготовителя.",
    "aliases": [
      "Сливочный сыр"
    ]
  },
  {
    "name": "Икра масаго (открытая)",
    "prepEvent": "opened",
    "description": "Только после вскрытия/разморозки: условия и срок поставщика важнее предлагаемого интервала.",
    "aliases": [
      "Икра масаго / тобико"
    ]
  },
  {
    "name": "Имбирь маринованный (открытый)",
    "prepEvent": "opened",
    "description": "После вскрытия: срок изготовителя и способ отбора порций.",
    "aliases": [
      "Имбирь маринованный"
    ]
  },
  {
    "name": "Чука (открытая)",
    "prepEvent": "opened",
    "description": "Морская водоросль/салат после вскрытия; учитывать срок производителя.",
    "aliases": [
      "Чука / вакаме"
    ]
  },
  {
    "name": "Томаты черри (нарезка)",
    "prepEvent": "prepared",
    "description": "Промытые нарезанные томаты для Том Ям."
  },
  {
    "name": "Грибы (нарезка)",
    "prepEvent": "prepared",
    "description": "Промытые и нарезанные грибы; вид и последующая термообработка по ТТК."
  }
];
export const definitions=items;
const normalize=name=>String(name||'').toLocaleLowerCase('ru').replace(/ё/g,'е').replace(/\s+/g,' ').trim();
const found = new Map();
for(const d of definitions)for(const alias of [d.name,...(d.aliases||[])])found.set(normalize(alias),d);
const memo=d=>'Предложение для проверки (НЕ срок, установленный СанПиН): внутрицеховой предел не более 12 часов при +2…+6 °C, только после подтверждения безопасности и ТТК. '+d.description+' Если требования изготовителя строже — применяются они. ';
export function merge(existing){
 if(!Array.isArray(existing))throw Error('Ожидался массив каталога FARUKH PRINT');
 const names=new Set(existing.filter(p=>p?.kind==='prep').map(p=>normalize(p.name)));
 const next=existing.map(p=>{
  if(p?.kind!=='prep')return p;
  const d=found.get(normalize(p.name));
  if(!d)return p;
  // Do not change a previously approved label or any values chosen by
  // the owner. Only supplement genuinely missing fields on drafts.
  if(p.needsReview!==true)return p;
  const patch={};
  if(!p.storage)patch.storage=proposedStorage;
  if(p.hours===null||p.hours===undefined||p.hours==='')patch.hours=proposedHours;
  if(!p.prepEvent)patch.prepEvent=d.prepEvent;
  if(!p.recipeMemo)patch.recipeMemo=memo(d);
  if(!p.labelStyle)patch.labelStyle='premium-prep-30x20';
  return Object.keys(patch).length?{...p,...patch}:p;
 });
 for(const d of definitions){
  if(names.has(normalize(d.name))||(d.aliases||[]).some(x=>names.has(normalize(x))))continue;
  next.push({
   id:'japanese-prep-'+normalize(d.name).replace(/[^a-zа-я0-9]+/g,'-'),
   kind:'prep',name:d.name,storage:proposedStorage,hours:proposedHours,
   prepEvent:d.prepEvent,labelStyle:'premium-prep-30x20',
   recipeMemo:memo(d),point:'',needsReview:true
  });
 }
 return next;
}
