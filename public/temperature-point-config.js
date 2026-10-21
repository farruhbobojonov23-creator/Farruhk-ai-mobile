import {validateHaccp} from './haccp-model.js';

// Equipment presets are configuration only: no factual temperature reading is invented.
export const PLASMA_TEMPERATURES = Object.freeze([
 {name:'Холодильник №1',min:2,max:6},
 {name:'Холодильник №2',min:2,max:6},
 {name:'Холодильник №3',min:2,max:6},
 {name:'Холодильник №4',min:2,max:6},
 {name:'Морозильник №1',min:-25,max:-18},
 {name:'Морозильник №2',min:-25,max:-18}
]);

function plasmaPoint(h){
 return h.points.find(point=>point.name.trim().toLocaleLowerCase('ru-RU')==='плазма');
}

// Never replace equipment that the owner has already configured, even partially.
// A renamed point can get the preset the next time the HACCP screen opens.
function isOldExampleFreezer(e){
 return /^морозильник №[12]$/iu.test(e.name.trim())&&e.min===-20&&e.max===-12;
}

export function plasmaPresetNeeded(raw){
 const h=validateHaccp(raw),point=plasmaPoint(h);
 if(!point)return false;
 const equipment=h.equipment.filter(item=>item.pointId===point.id);
 return !equipment.length||equipment.some(isOldExampleFreezer);
}

export function seedPlasmaTemperatures(state){
 const h=validateHaccp(state.haccp),point=plasmaPoint(h);
 if(!point)return false;
 const equipment=h.equipment.filter(item=>item.pointId===point.id);
 if(!equipment.length){
  for(const row of PLASMA_TEMPERATURES)h.equipment.push({id:crypto.randomUUID(),pointId:point.id,...row});
 }else{
  // Only migrate our earlier example range, never overwrite another custom range.
  const obsolete=equipment.filter(isOldExampleFreezer);
  if(!obsolete.length)return false;
  for(const freezer of obsolete){freezer.min=-25;freezer.max=-18}
 }
 state.haccp=validateHaccp(h);
 return true;
}
