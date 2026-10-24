// FARUKH PRINT illustrated guide. Original lightweight SVG food illustrations,
// rendered locally; no external hotlinks, no image CDN, no print dependencies.
const start='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 100" width="120" height="100"><defs>'+
 '<linearGradient id="leaf" x2=".7" y2="1"><stop stop-color="#b5f271"/><stop offset=".46" stop-color="#48b529"/><stop offset="1" stop-color="#157039"/></linearGradient>'+
 '<linearGradient id="skin" x2=".8" y2="1"><stop stop-color="#72b82c"/><stop offset=".4" stop-color="#147b38"/><stop offset="1" stop-color="#064c31"/></linearGradient>'+
 '<linearGradient id="glass" x2=".7" y2="1"><stop stop-color="#fff" stop-opacity=".92"/><stop offset="1" stop-color="#8ed7f2" stop-opacity=".32"/></linearGradient>'+
 '<linearGradient id="salmon" x2="0" y2="1"><stop stop-color="#ffb899"/><stop offset=".4" stop-color="#fb8061"/><stop offset="1" stop-color="#d8584d"/></linearGradient>'+
 '<linearGradient id="beef" x2=".8" y2="1"><stop stop-color="#fbada9"/><stop offset=".4" stop-color="#dc4c5c"/><stop offset="1" stop-color="#a91b43"/></linearGradient>'+
 '<linearGradient id="gold" x2=".8" y2="1"><stop stop-color="#fff9b2"/><stop offset=".6" stop-color="#ffd258"/><stop offset="1" stop-color="#ec9f34"/></linearGradient>'+
 '<filter id="shade" x="-35%" y="-35%" width="170%" height="185%"><feDropShadow dx="0" dy="3" stdDeviation="3.1" flood-color="#263e46" flood-opacity=".19"/></filter></defs>';
const end='</svg>';
const shadow='<ellipse cx="60" cy="91" rx="48" ry="5" fill="#213949" opacity=".09"/>';
const cucumber=(x=5,y=5,scale=1)=>'<g transform="translate('+x+' '+y+') scale('+scale+')" filter="url(#shade)">'+
 '<path d="M9 34 Q22 12 72 20 Q89 23 93 31 Q96 46 75 55 Q37 65 13 49 Q5 44 9 34Z" fill="url(#skin)"/>'+
 '<path d="M17 35 Q44 17 80 26" stroke="#baf48c" stroke-width="3" opacity=".6" fill="none"/>'+
 '<g transform="translate(4 17)"><ellipse cx="25" cy="43" rx="20" ry="14" fill="#4a982a" stroke="#1c6936" stroke-width="2"/><ellipse cx="25" cy="42" rx="16" ry="11.5" fill="#defbb2" stroke="#7bc74f" stroke-width="1.4"/>'+
 '<ellipse cx="25" cy="42" rx="10" ry="7.5" fill="#a4d66f"/><g fill="#f8ffe0"><ellipse cx="21" cy="39" rx="1.5" ry="3"/><ellipse cx="29" cy="39" rx="1.5" ry="3"/><ellipse cx="21" cy="45" rx="1.5" ry="3"/><ellipse cx="29" cy="45" rx="1.5" ry="3"/></g></g>'+
 '<g transform="translate(29 5)"><ellipse cx="25" cy="43" rx="19" ry="13.5" fill="#479a2d" stroke="#1c6936" stroke-width="2"/><ellipse cx="25" cy="42" rx="15.7" ry="11.4" fill="#e0f9b8" stroke="#83cb5e"/><ellipse cx="25" cy="42" rx="9" ry="6.7" fill="#a7d878"/><g fill="#f8ffe6"><ellipse cx="22" cy="40" rx="1.2" ry="2.7"/><ellipse cx="28" cy="40" rx="1.2" ry="2.7"/><ellipse cx="22" cy="45" rx="1.2" ry="2.7"/><ellipse cx="28" cy="45" rx="1.2" ry="2.7"/></g></g></g>';
const icons={
 cucumber:cucumber(5,6,.98),
 vegetables:'<g filter="url(#shade)"><path d="M45 52 Q66 22 90 33 Q106 53 80 72 Q52 76 45 52Z" fill="#dd3f32"/><path d="M57 30l13-5 9 6-8 2 1 7-9-7-7 7z" fill="#448e27"/><path d="M39 80Q24 67 26 37l19-4 9 14-5 31z" fill="url(#gold)"/><path d="M34 44L22 29M39 40L38 19M46 43L54 28" stroke="#379447" stroke-width="4.5" fill="none" stroke-linecap="round"/></g>'+cucumber(36,40,.44),
 herbs:'<g filter="url(#shade)" stroke="#368345" stroke-width="1.2"><path d="M51 88L42 29M56 85L67 22M60 87L87 45M50 85L25 39" fill="none" stroke="#3a965a" stroke-width="3"/>'+
 '<path d="M47 72Q11 56 22 29Q57 36 47 72Z" fill="url(#leaf)"/><path d="M51 67Q74 38 59 15Q38 24 51 67Z" fill="#43a644"/><path d="M67 69Q101 66 100 34Q69 36 67 69Z" fill="#33883e"/><path d="M38 50Q38 18 14 12Q5 42 38 50Z" fill="#75c748"/><path d="M74 82Q97 93 109 63Q79 52 74 82Z" fill="#79be4e"/></g>',
 cheese:'<g filter="url(#shade)"><path d="M18 60L88 27Q97 26 98 37V74Q94 78 88 79L24 86Q17 85 18 78Z" fill="url(#gold)" stroke="#e2a241" stroke-width="1.5"/><path d="M18 60L88 27L99 37L66 67Z" fill="#fff5a4"/><path d="M66 67L99 37V74L66 84Z" fill="#efb43c"/><circle cx="43" cy="72" r="8" fill="#e8ac41"/><circle cx="75" cy="63" r="5" fill="#e4a22b"/><ellipse cx="86" cy="48" rx="5" ry="8" fill="#e7ae40"/><ellipse cx="31" cy="52" rx="5" ry="3.5" fill="#e7bd64"/></g>',
 sauce:'<g filter="url(#shade)"><path d="M14 45Q14 31 59 31Q104 31 105 45L96 72Q88 86 60 86Q32 86 23 72Z" fill="#ecf2f3" stroke="#c7d7dd" stroke-width="2"/><ellipse cx="59" cy="45" rx="45" ry="15" fill="#fbfdff" stroke="#bfccd3" stroke-width="2"/><ellipse cx="59" cy="44" rx="38" ry="11" fill="#f9e5a0"/><path d="M36 44Q45 31 58 42T82 44" stroke="#e4c579" stroke-width="4" fill="none" stroke-linecap="round"/></g>',
 rawmeat:'<g filter="url(#shade)"><path d="M10 53Q12 33 37 30Q56 18 88 37Q109 47 101 66Q95 84 67 83L27 72Q8 70 10 53Z" fill="url(#beef)" stroke="#ac4153" stroke-width="2"/><path d="M22 58Q36 39 56 45T92 56M41 70Q55 53 73 62" fill="none" stroke="#ffd5ce" stroke-width="5" stroke-linecap="round"/><path d="M16 52Q38 30 73 38" stroke="#ffc0bd" stroke-width="3" opacity=".65" fill="none"/></g>',
 sushi:'<g filter="url(#shade)">'+[0,1,2].map((i)=>'<g transform="translate('+(15+i*30)+' '+(23+i%2*9)+')"><rect x="0" y="22" width="30" height="37" rx="5" fill="#f1ead8"/><path d="M1 31h28M1 41h28M1 50h28" stroke="#e1d9c7" stroke-width="2"/><path d="M1 17Q2 12 10 10H24Q33 12 29 22L26 33Q17 28 2 35Z" fill="url(#salmon)"/><path d="M7 16Q16 20 24 15M8 24Q16 27 23 22" stroke="#ffe0c6" stroke-width="2.2" fill="none"/></g>').join('')+'</g>',
 seafood:'<g filter="url(#shade)">'+[0,1,2].map((i)=>'<g transform="translate('+(10+29*i)+' '+(30+13*(i%2))+') rotate('+(i*14-10)+' 13 20)"><path d="M4 4Q31 -2 32 23Q26 42 12 38Q22 29 20 19Q18 12 4 16Z" fill="url(#salmon)" stroke="#cb765e" stroke-width="1.4"/><path d="M13 14L18 11M18 20l10-4M19 27l12 1" stroke="#ffe4d5" stroke-width="3"/><path d="M4 5L-3 -2L-2 16Z" fill="#e76d69"/></g>').join('')+'</g>',
 onion:'<g filter="url(#shade)"><path d="M20 68Q13 52 34 29Q39 20 42 13Q49 28 58 38Q80 72 48 84Q30 86 20 68Z" fill="#9f3f86" stroke="#793766" stroke-width="2"/><path d="M42 24Q35 46 43 77M47 31Q55 53 51 77" stroke="#d7a2c6" stroke-width="2.5" fill="none"/><path d="M66 73Q59 56 80 40L89 21Q91 37 100 45Q119 73 92 85Q75 88 66 73Z" fill="#f5ebda" stroke="#c4b5a4" stroke-width="2"/><path d="M89 37Q81 58 89 79" fill="none" stroke="#d7c6ab" stroke-width="2"/></g>',
 container:'<g filter="url(#shade)"><path d="M12 30H103L95 80Q91 89 80 89H35Q25 87 23 78Z" fill="url(#glass)" stroke="#9fbfce" stroke-width="2"/><path d="M26 45Q60 48 93 44L86 79Q62 85 34 78Z" fill="#b4d9a8" opacity=".55"/>'+
 '<g transform="translate(18 26) scale(.62)">'+cucumber(1,10,.9)+'</g><path d="M8 27Q11 22 20 22H100Q110 22 110 28Q111 34 99 35H20Q8 35 8 27Z" fill="#d9f3ef" stroke="#8dbab6" stroke-width="2"/><path d="M32 23H91" stroke="white" stroke-width="3" opacity=".8"/></g>',
 fridge:'<g filter="url(#shade)"><rect x="19" y="12" width="83" height="80" rx="8" fill="#d5ecf8" stroke="#9dc3dc" stroke-width="2.4"/><rect x="27" y="20" width="69" height="64" rx="4" fill="#f2faff"/><path d="M27 47H96M27 68H96" stroke="#adcddd" stroke-width="3"/><rect x="27" y="20" width="26" height="64" rx="3" fill="#bdd5e7" opacity=".65"/><path d="M53 21v62" stroke="#8caebf" stroke-width="2"/><rect x="65" y="29" width="22" height="17" rx="3" fill="#89cfea"/><rect x="69" y="27" width="14" height="5" rx="2" fill="#cdeaf3"/></g>'+cucumber(51,45,.43),
 spoiled:'<g filter="url(#shade)"><path d="M9 55Q16 25 76 29Q106 34 104 59Q97 84 49 79Q15 79 9 55Z" fill="url(#skin)" stroke="#286636" stroke-width="2"/><path d="M30 35Q64 17 94 37" stroke="#94c96e" stroke-width="4" fill="none"/><circle cx="51" cy="51" r="13" fill="#a5ad4a" stroke="#706b38" stroke-width="3"/><circle cx="73" cy="66" r="9" fill="#9fa85b" stroke="#6e7044" stroke-width="3"/><circle cx="52" cy="50" r="5" fill="#657f41"/><circle cx="71" cy="64" r="3" fill="#56663b"/><path d="M33 65L37 54M83 41l8 8" stroke="#e9ce89" stroke-width="2"/></g>',
 magnifier:'<g>'+cucumber(0,20,.84)+'<g filter="url(#shade)"><circle cx="77" cy="45" r="22" fill="#d6f5fc" fill-opacity=".34" stroke="#3c5767" stroke-width="7"/><path d="M91 61L110 87" stroke="#405867" stroke-width="9" stroke-linecap="round"/><path d="M64 33Q76 22 87 33" stroke="white" stroke-width="3" fill="none"/></g></g>',
 package:'<g filter="url(#shade)"><path d="M19 37L58 17L99 37L60 59Z" fill="#f9d49e" stroke="#d98d41" stroke-width="2"/><path d="M19 37V76L60 94V59Z" fill="#e6a35e" stroke="#d18e48" stroke-width="2"/><path d="M60 59L99 37V76L60 94Z" fill="#f2bf81" stroke="#d18e48" stroke-width="2"/><path d="M41 26L80 46" stroke="#fdf1db" stroke-width="8" fill="none"/><path d="M80 46V62" stroke="#fdf1db" stroke-width="8"/></g>',
 clipboard:'<g filter="url(#shade)"><rect x="27" y="14" width="68" height="80" rx="7" fill="#fcfeff" stroke="#a8cbd9" stroke-width="3"/><rect x="47" y="10" width="30" height="12" rx="5" fill="#4b9ab8"/><path d="M46 44l7 8 13-16M46 69l7 7 13-16" stroke="#34a457" stroke-width="5" stroke-linecap="round" stroke-linejoin="round" fill="none"/><path d="M71 47h14M71 72h14" stroke="#acc4cc" stroke-width="4" stroke-linecap="round"/></g>',
 books:'<g filter="url(#shade)"><path d="M14 61h85v19H14z" fill="#5897c3"/><path d="M14 58h77v15H14z" fill="#ebf7ff" stroke="#9cb9d0"/><path d="M19 40h85v18H19z" fill="#ce4258"/><path d="M19 40h77v13H19z" fill="#fff0f0" stroke="#dabec5"/><path d="M15 24h78v17H15z" fill="#e5b34a"/><path d="M15 24h70v13H15z" fill="#fff8e6" stroke="#dcc49b"/></g>',
 chemical:'<g filter="url(#shade)"><path d="M25 35H90L83 83H33Z" fill="#80cde8" stroke="#468fa6" stroke-width="3"/><path d="M36 52H80" stroke="#e8f8fd" stroke-width="3"/><path d="M39 32Q57 9 77 32" fill="none" stroke="#468fa6" stroke-width="6"/><path d="M44 60h30" stroke="white" stroke-width="5"/></g>',
 fish:'<g filter="url(#shade)"><path d="M12 55Q39 12 82 37Q101 52 82 70Q42 91 12 55Z" fill="url(#salmon)" stroke="#d67869" stroke-width="2"/><path d="M20 48Q48 34 78 43M24 59Q50 47 82 55M33 70Q55 56 78 64" stroke="#ffe3d2" stroke-width="4" fill="none" stroke-linecap="round"/></g>'
};
const aliases={
 'холодильник':'fridge','температура':'fridge','термометр':'fridge','режим':'fridge',
 'тара':'container','емкость':'container','контейнер':'container','упаковка':'container','вакуум':'container','хранить':'container',
 'форма':'cucumber','вид':'cucumber','огур':'cucumber','овощ':'vegetables','морков':'vegetables','перец':'vegetables','капуст':'vegetables',
 'зелень':'herbs','салат':'herbs','укроп':'herbs','петруш':'herbs','сыр':'cheese','молочн':'cheese',
 'соус':'sauce','майонез':'sauce','маринад':'sauce','масло':'sauce',
 'мясо':'rawmeat','птица':'rawmeat','куриц':'rawmeat','говядин':'rawmeat',
 'ролл':'sushi','суши':'sushi','блюда':'sushi','готовая':'sushi',
 'кревет':'seafood','морепродукт':'seafood','краб':'seafood','мид':'seafood',
 'рыба':'fish','форел':'fish','лосос':'fish','угор':'fish',
 'лук':'onion','чеснок':'onion','аромат':'onion','запах':'onion',
 'испорч':'spoiled','порч':'spoiled','плесен':'spoiled','слиз':'spoiled','ошиб':'spoiled','нельзя':'spoiled','избегать':'spoiled',
 'контрол':'magnifier','провер':'magnifier','срок':'clipboard','ттк':'clipboard','технолог':'clipboard','документ':'books','условия':'books','нормат':'books',
 'замороз':'fridge','размороз':'fridge','химическ':'chemical','уборк':'chemical','дезинф':'chemical'
};
const name=v=>String(v||'').toLocaleLowerCase('ru').replace(/ё/g,'е');
export function subjectFor(text,fallback='container'){
 const value=name(text);
 for(const [fragment,which] of Object.entries(aliases))if(value.includes(fragment))return which;
 return fallback;
}
export function illustrationFor(which){
 const type=icons[which]?which:'package';
 return 'data:image/svg+xml;charset=utf-8,'+encodeURIComponent(start+shadow+icons[type]+end);
}
export function isCatalogPhoto(value){return typeof value==='string'&&(/^data:image\/(?:jpeg|png|webp);base64,/.test(value)||/^https:\/\//.test(value))}
export function advicePicture(product,section,title){
 const n=name(product?.name),t=name(title);
 // The owner's real photo remains visible for the product, when available.
 if((/в каком виде|лучше хранить|подготовка/.test(t)||section==='Форма')&&isCatalogPhoto(product?.photo))return product.photo;
 if(/температур|режим|охлаждени|размороз/.test(t))return illustrationFor('fridge');
 if(/упаков|тар|емкост|хранить/.test(t))return illustrationFor('container');
 if(/порч|брак|нельзя|ошиб/.test(t))return illustrationFor('spoiled');
 if(/контрол|провер/.test(t))return illustrationFor('magnifier');
 if(/срок|технолог/.test(t))return illustrationFor('clipboard');
 if(/нормат|условия применения/.test(t))return illustrationFor('books');
 if(/форел|лосос|угор/.test(n))return illustrationFor('fish');
 if(/кревет|краб|морепродукт/.test(n))return illustrationFor('seafood');
 if(/огур/.test(n))return illustrationFor('cucumber');
 return illustrationFor(subjectFor(n,'package'));
}
export function neighborPicture(text){
 return illustrationFor(subjectFor(text,'package'));
}
