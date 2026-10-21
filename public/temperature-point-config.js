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
export function plasmaPresetNeeded(raw){
 const h=validateHaccp(raw),point=plasmaPoint(h);
 return Boolean(point&&!h.equipment.some(item=>item.pointId===point.id));
}

export function seedPlasmaTemperatures(state){
 const h=validateHaccp(state.haccp),point=plasmaPoint(h);
 if(!point||h.equipment.some(item=>item.pointId===point.id))return false;
 for(const row of PLASMA_TEMPERATURES){
  h.equipment.push({id:crypto.randomUUID(),pointId:point.id,...row});
 }
 state.haccp=validateHaccp(h);
 return true;
}
