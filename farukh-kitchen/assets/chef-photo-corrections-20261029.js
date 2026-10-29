/* FARUKH KITCHEN: user verified 2026-10-29
  Third photo 43706 (previously mapped to FK-044) -> FK-059 Креветка под моцареллой.
  Fourth photo 43709 (previously mapped to FK-047) -> FK-048 Запечённая легенда.
  Other two photos are assigned by chef-corrected-4-final-20261029.js.
*/
(function(){
  const p=window.FK_CHEF_PHOTOS||{};
  const mozzarella=p["FK-044"];
  const legend=p["FK-047"];
  if(mozzarella)p["FK-059"]=mozzarella;
  if(legend)p["FK-048"]=legend;
  window.FK_CHEF_PHOTOS=p;
})();
