// Curated illustrative ingredient photos from Wikimedia Commons.
// The real photo the owner uploaded is always preferred. Remote reference
// photos never become a hidden catalog field, and never alter printed labels.
// Each source can be opened for author, full license and attribution.
(()=>{
'use strict';
const entries=[
  [
    "Авокадо (нарезка)",
    "Avocado Slices.jpg",
    "Alabama Extension",
    "CC0"
  ],
  [
    "Лук зелёный (нарезка)",
    "Green onions.jpg",
    "vanessa lollipop",
    "CC BY-SA 2.0"
  ],
  [
    "Дайкон (нарезка)",
    "Sliced daikon.jpg",
    "Carrotkit",
    "CC BY-SA 4.0"
  ],
  [
    "Лайм (дольки)",
    "Limewedge.jpg",
    "Fluff",
    "CC BY-SA 3.0"
  ],
  [
    "Лосось (размороженный)",
    "Raw salmon fillets.jpg",
    "FULVIO_TOGNON",
    "CC0"
  ],
  [
    "Мидии (мясо)",
    "Cooked mussels.jpg",
    "PookieFugglestein",
    "CC0"
  ],
  [
    "Кальмар (подготовленный)",
    "Chilled squid rings.jpg",
    "François Nguyen",
    "CC"
  ],
  [
    "Спайси-майо",
    "Mayonnaise in the bowl.jpg",
    "Jasmine Sharon Bodra",
    "CC BY-SA 4.0"
  ],
  [
    "Сырная начинка",
    "Requeijão Cremoso.jpg",
    "Wikimedia Commons contributor",
    "CC"
  ],
  [
    "Шапка сырная",
    "Requeijão Cremoso.jpg",
    "Wikimedia Commons contributor",
    "CC"
  ],
  [
    "Соус Том Ям (база)",
    "Bumbu Tom Yam.jpg",
    "Herusutimbul",
    "CC"
  ],
  [
    "Сливочный сыр (открытый)",
    "Philly cream cheese.jpg",
    "National Cancer Institute, Renee Comet",
    "Public domain"
  ],
  [
    "Икра масаго (открытая)",
    "Hamachi (Yellowtail), Jalapeno, Cilantro, Garlic Powder Hon Maguro (Bluefin Tuna- Sake (Salmon) Ebi (Tiger Shrimp) Masago (Smelt Roe) (26094247038).jpg",
    "Lou Stejskal",
    "CC"
  ],
  [
    "Имбирь маринованный (открытый)",
    "Gari ginger.jpg",
    "DoWhile",
    "Public domain"
  ],
  [
    "Чука (открытая)",
    "Goma wakame.jpg",
    "Arnaud 25",
    "CC0"
  ],
  [
    "Томаты черри (нарезка)",
    "Tomates cherry.jpg",
    "Adpb0409",
    "CC"
  ],
  [
    "Грибы (нарезка)",
    "Sliced champignons.jpg",
    "frank wouters",
    "CC BY 2.0"
  ]
];
const photos=Object.fromEntries(entries.map(([name,file,author,license])=>[
 name.toLocaleLowerCase('ru'),{
  url:'https://commons.wikimedia.org/wiki/Special:FilePath/'+encodeURIComponent(file.replace(/ /g,'_'))+'?width=360',
  creditUrl:'https://commons.wikimedia.org/wiki/File:'+encodeURIComponent(file.replace(/ /g,'_')),
  author,license,illustrative:true
 }
]));
const emoji={"Лайм (дольки)":"🍋","Кальмар (подготовленный)":"🦑","Икра масаго (открытая)":"🍣","Спайси-майо":"🥣","Сырная начинка":"🧀","Шапка сырная":"🧀","Сливочный сыр (открытый)":"🧀","Соус Том Ям (база)":"🥣","Мидии (мясо)":"🦪","Чука (открытая)":"🥬","Авокадо (нарезка)":"🥑"};
const find=p=>photos[String(typeof p==='string'?p:p?.name||'').trim().toLocaleLowerCase('ru')]||null;
const mark=p=>emoji[typeof p==='string'?p:p?.name]||'🍱';
window.FarukhPrepPhotoLibrary={find,mark,entries};
})();
