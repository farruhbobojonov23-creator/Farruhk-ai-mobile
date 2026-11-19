/* Shared premium A4 themes for editor, PDF and Word.
 * Palette changes must never modify recipes or regulatory content. */
export const PREMIUM_TTK_THEMES=Object.freeze([
 {id:'emerald-gold-a4',name:'01 · Изумруд и золото',subtitle:'Emerald Gold',tone:'emerald',band:'#064B3C',ink:'#16392F',accent:'#C69B3D',paper:'#FFFDF5',cell:'#FFFBF0',head:'#F3E5BF',line:'#D8C69C'},
 {id:'navy-silver-a4',name:'02 · Синий и серебро',subtitle:'Navy Silver',tone:'navy',band:'#0D2D59',ink:'#18324F',accent:'#9CAFC8',paper:'#FFFFFF',cell:'#F8FAFE',head:'#E4EBF4',line:'#C2D0E0'},
 {id:'bordeaux-gold-a4',name:'03 · Бордо и золото',subtitle:'Bordeaux Gold',tone:'bordeaux',band:'#710B26',ink:'#4B1725',accent:'#CB9E4A',paper:'#FFFCF7',cell:'#FFF9F2',head:'#F6E4CC',line:'#E4C8A7'},
 {id:'graphite-copper-a4',name:'04 · Графит и медь',subtitle:'Graphite Copper',tone:'graphite',band:'#23272D',ink:'#2E3034',accent:'#C17F59',paper:'#FEFDFB',cell:'#FAF9F7',head:'#F2E1D7',line:'#D9C5B9'}
]);
export const isPremiumTtkTheme=id=>PREMIUM_TTK_THEMES.some(theme=>theme.id===id);
export const premiumTtkTheme=id=>PREMIUM_TTK_THEMES.find(theme=>theme.id===id)||PREMIUM_TTK_THEMES[0];
export const ALLERGEN_OPTIONS=Object.freeze([
 ['fish','Рыба'],['milk','Молоко и молочные продукты'],
 ['gluten','Злаки, содержащие глютен'],['sesame','Кунжут'],
 ['crustaceans','Ракообразные'],['soy','Соя'],
 ['eggs','Яйца'],['nuts','Орехи'],['other','Другое']
]);
export const normalizeAllergens=value=>Array.isArray(value)?ALLERGEN_OPTIONS.map(([key])=>key).filter(k=>value.includes(k)):[];
