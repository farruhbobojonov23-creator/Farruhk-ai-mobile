import test from 'node:test';
import assert from 'node:assert/strict';
import {auditTtkDraft} from '../public/ttk-pro-workspace.js';

const complete={
 name:'Филадельфия',category:'Холодные роллы',cardNumber:'001',cardDate:'2026-11-13',
 ingredients:[{name:'Рис',grams:100,grossGrams:100,nutritionOrigin:'saved'}],
 netYieldGrams:100,rawRequirements:'Только проверенное сырьё',
 preparation:'Отварить рис',forming:'Сформировать ролл',serving:'Нарезать на 8 частей',
 storage:'Хранение по согласованной ТТК',
 appearance:'Ровные кусочки',taste:'Без посторонних привкусов',safety:'Контроль ингредиентов',
 chef:'Шеф',approver:'Управляющий',
 nutrition:{kcal:200,protein:5,fat:2,carbs:30},status:'ready'
};
test('TTK pilot reports completeness without claiming compliance',()=>{
 const result=auditTtkDraft(complete);
 assert.equal(result.complete,result.total);
 assert.equal(result.percent,100);
 assert.equal(result.allFieldsFilled,true);
 assert.ok(result.warnings.some(x=>x.includes('Фото блюда не добавлено')));
});
test('TTK pilot catches missing allergen-independent fields without inventing nutrition',()=>{
 const result=auditTtkDraft({...complete,ingredients:[{name:'Рис',grams:100,grossGrams:70,nutritionOrigin:'reference'}],nutrition:{kcal:null},approver:'',status:'ready'});
 assert.equal(result.allFieldsFilled,false);
 assert.ok(result.checks.find(x=>x.id==='ingredients'&&!x.ok));
 assert.ok(result.checks.find(x=>x.id==='nutrition'&&!x.ok));
 assert.ok(result.checks.find(x=>x.id==='signatures'&&!x.ok));
 assert.ok(result.warnings.some(x=>x.includes('Справочные')));
 assert.ok(result.warnings.some(x=>x.includes('Указан статус')));
});
test('TTK pilot accepts zero nutrition as entered, never as missing',()=>{
 const result=auditTtkDraft({...complete,nutrition:{protein:0,fat:0,carbs:0,kcal:0}});
 assert.equal(result.checks.find(x=>x.id==='nutrition').ok,true);
});
