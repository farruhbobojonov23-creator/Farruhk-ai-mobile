/* FARUKH KITCHEN: final Chef Aka corrections confirmed 29 October 2026.
   1 Сливочный лосось -> FK-047, new transparent photograph 45621
   2 Запечённый чиз -> FK-044, user photograph 43719
   3 Креветка под моцареллой -> FK-059 (mapped in chef-photo-corrections)
   4 Легенда -> FK-048 (mapped in chef-photo-corrections)
*/
(function(){
  const p=window.FK_CHEF_PHOTOS||{};
  if(window.FK_CHEF_UNASSIGNED?.["UNASSIGNED-43719"])p["FK-044"]=window.FK_CHEF_UNASSIGNED["UNASSIGNED-43719"];
  p["FK-047"]="assets/photos/chef-corrected-4-final-20261029-1.webp";
  window.FK_CHEF_PHOTOS=p;
})();
