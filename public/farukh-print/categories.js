// Shared catalog grouping for the kitchen and owner editors.
(()=>{
 const defaults=['Холодные роллы','Запечённые роллы','Темпура','Маки','Онигири','Суши','Бери-дог','Воки','Закуски','ХАССП'];
 const tidy=value=>String(value||'').trim().replace(/\s+/g,' ').slice(0,60);
 function category(p){
  if(p.kind!=='ready')return '';
  if(tidy(p.category))return tidy(p.category);
  const name=tidy(p.name).toLocaleLowerCase('ru').replace(/ё/g,'е');
  if(/^(запеч|кранч|сливочный)/.test(name))return defaults[1];
  if(/^темпура/.test(name))return defaults[2];
  if(/^маки| маки/.test(name))return defaults[3];
  if(/^онигири/.test(name))return defaults[4];
  if(/^суши|^гункан/.test(name))return defaults[5];
  if(/^бери[ -]?дог/.test(name))return defaults[6];
  if(/^(wok|вок|удон)/.test(name))return defaults[7];
  if(/^(закуск|наггетс|картофель|сырные палочки|байтс)/.test(name))return defaults[8];
  if(/^(хассп|haccp)/.test(name))return defaults[9];
  if(/^ролл|^фила|^канада|^гейша|^тигровая|^калифорния|^бонито/.test(name))return defaults[0];
  return 'Без категории';
 }
 function list(products){return [...new Set([...defaults,...products.filter(p=>p.kind==='ready').map(category)])]}
 globalThis.FarukhPrintCategories={defaults,category,list};
})();
