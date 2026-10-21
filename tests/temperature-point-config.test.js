import test from 'node:test';
import assert from 'node:assert/strict';
import {emptyHaccp} from '../public/haccp-model.js';
import {PLASMA_TEMPERATURES,plasmaPresetNeeded,seedPlasmaTemperatures} from '../public/temperature-point-config.js';

test('Плазма: four refrigerators and two freezers are seeded with the confirmed limits',()=>{
 const haccp=emptyHaccp();haccp.points[1].name='Плазма';
 const state={haccp};
 assert.equal(plasmaPresetNeeded(state.haccp),true);
 assert.equal(seedPlasmaTemperatures(state),true);
 const saved=state.haccp.equipment.filter(e=>e.pointId==='point-2');
 assert.equal(saved.length,6);
 assert.deepEqual(saved.map(e=>[e.name,e.min,e.max]),PLASMA_TEMPERATURES.map(e=>[e.name,e.min,e.max]));
 assert.equal(saved.every(e=>!('measured' in e)),true);
 assert.equal(state.haccp.equipment.filter(e=>e.pointId!=='point-2').length,0);
 assert.equal(plasmaPresetNeeded(state.haccp),false);
 assert.equal(seedPlasmaTemperatures(state),false);
 assert.equal(state.haccp.equipment.length,6);
});

test('existing Plasma equipment and other points are never overwritten',()=>{
 const haccp=emptyHaccp();haccp.points[0].name='Плазма';
 haccp.equipment.push({id:'custom',pointId:'point-1',name:'Холодильный стол',min:0,max:3});
 haccp.equipment.push({id:'other',pointId:'point-3',name:'Морозильник №1',min:-23,max:-17});
 const state={haccp};
 assert.equal(plasmaPresetNeeded(state.haccp),false);
 assert.equal(seedPlasmaTemperatures(state),false);
 assert.deepEqual(state.haccp.equipment,haccp.equipment);
});

test('a generic point is not silently renamed Plasma',()=>{
 const state={haccp:emptyHaccp()};
 assert.equal(plasmaPresetNeeded(state.haccp),false);
 assert.equal(seedPlasmaTemperatures(state),false);
 assert.equal(state.haccp.points[0].name,'Точка 1');
});
