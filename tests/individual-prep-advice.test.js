import test from 'node:test';
import assert from 'node:assert/strict';
import {individualPrepAdviceFor} from '../public/farukh-print/individual-prep-advice.js';

const prep=(name,extra={})=>({kind:'prep',name,...extra});

test('known preps get product-specific shelf, neighbors and handling',()=>{
 for(const [name,shelf] of [
  ['Икра масаго (открытая)','готовых к употреблению'],
  ['Форель слайсы','сырой рыбы'],
  ['Креветка тигровая отварная слайсы','готовых к употреблению'],
  ['Соус спайси','соусов'],
  ['Бульон Том Ям','готовых компонентов'],
  ['Перец и морковь жареные альденте','готовых компонентов'],
  ['Сыр творожный в кондитерском мешке','молочных'],
  ['Кунжут жаренный белый','Сухой склад'],
  ['Сухари панко и лук жаренный сухой (замесе)','Сухой склад'],
  ['Сироп для кофе','маркировке']
 ]){
  const result=individualPrepAdviceFor(prep(name));
  assert.equal(result.recognized,true,name);
  assert.ok(result.shelf.toLowerCase().includes(shelf.toLowerCase()),name);
  assert.ok(result.yes.length>0&&result.no.length>0,name);
  assert.ok(result.note.includes(name),name);
  assert.ok(result.tips.packaging&&result.tips.temperature&&result.tips.form,name);
  assert.equal('hours' in result,false,'advice must not invent expiry');
 }
});
test('unknown new semi-finished product is shown but never assigned an unsafe shelf',()=>{
 const result=individualPrepAdviceFor(prep('Совершенно новый продукт 123'));
 assert.equal(result.recognized,false);
 assert.match(result.shelf,/Полка пока не назначена/);
 assert.match(result.tips.control,/ТТК/);
 assert.equal('hours' in result,false);
});
test('ambiguous seafood is marked for review',()=>{
 const eel=individualPrepAdviceFor(prep('Угорь слайсы'));
 const shrimp=individualPrepAdviceFor(prep('Креветка тигровая'));
 assert.equal(eel.recognized,false);
 assert.equal(shrimp.recognized,false);
 assert.match(shrimp.shelf,/уточнения/);
});
test('do not add prep guidance to ready dishes or HACCP templates',()=>{
 assert.equal(individualPrepAdviceFor({kind:'ready',name:'Филадельфия'}),null);
 assert.equal(individualPrepAdviceFor({kind:'prep',name:'Мойка',template:'mop'}),null);
});
