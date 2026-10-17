import test from 'node:test';
import assert from 'node:assert/strict';
import {speechNumber,parseWorkbenchCommand,findVoiceField,normalizeFieldValue} from '../public/workbench-voice.js';

test('Ingredient dictation converts Russian quantities and never invents missing waste',()=>{
 assert.deepEqual(parseWorkbenchCommand('Добавь ингредиент рис нетто восемьдесят граммов отходы ноль процентов'),{type:'ingredient',name:'рис',grams:80,lossPercent:0});
 assert.equal(parseWorkbenchCommand('Добавь ингредиент лосось нетто 40 граммов').lossPercent,null);
 assert.equal(parseWorkbenchCommand('Добавь ингредиент рис нетто 80 отходы 100').type,'error');
 assert.equal(parseWorkbenchCommand('Добавь ингредиент рис нетто минус пять').type,'error');
 assert.equal(speechNumber('сто двадцать пять'),125);assert.equal(speechNumber('две тысячи пятьсот'),2500);assert.equal(speechNumber('2,5'),2.5);
});
test('Recipes create a form, save only by an explicit command, and ordinary conversation is untouched',()=>{
 assert.deepEqual(parseWorkbenchCommand('Создай ТТК с названием Филадельфия'),{type:'new-recipe',name:'Филадельфия'});
 assert.equal(parseWorkbenchCommand('Сохрани ТТК').type,'save-recipe');
 assert.equal(parseWorkbenchCommand('Как лучше приготовить рис?'),null);
 assert.deepEqual(parseWorkbenchCommand('Открой ХАССП'),{type:'navigate',view:'lab'});
 assert.deepEqual(parseWorkbenchCommand('Технология свернуть ролл'),{type:'field',label:'Технология',value:'свернуть ролл'});
});
test('Fields match unique labels; repeated ingredient controls require an explicit target',()=>{
 const field=(id,label)=>({id,getAttribute:()=>label});
 assert.equal(findVoiceField('Нетто',[field('a','Нетто, г'),field('b','Нетто, г')]),null);
 const technology=field('technology','Формовка / приготовление');
 assert.equal(findVoiceField('технология',[technology]),technology);
});
test('Numeric and enum dictation is validated before writing',()=>{
 const number={tagName:'INPUT',type:'number',min:'0',max:'99.99',id:'loss',getAttribute:()=> 'Отходы, %'};
 assert.equal(normalizeFieldValue(number,'двадцать пять процентов'),'25');
 assert.throws(()=>normalizeFieldValue(number,'сто'),/Уточни/);
 assert.throws(()=>normalizeFieldValue(number,'немного'),/Уточни/);
 const select={tagName:'SELECT',options:[{value:'draft',textContent:'В разработке'},{value:'ready',textContent:'Рецептура готова'}]};
 assert.equal(normalizeFieldValue(select,'В разработке'),'draft');
 assert.throws(()=>normalizeFieldValue(select,'готово'),/вариантов/);
});
