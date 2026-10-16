export function validateCategories(value){
 if(!Array.isArray(value)||value.length>100)throw Error('Допустимо до 100 категорий.');
 const ids=new Set(),names=new Set();let total=0;
 return value.map(c=>{
  if(!c||typeof c.id!=='string'||!c.id||c.id.length>200||typeof c.name!=='string'||!c.name.trim()||c.name.length>100||c.name.trim()==='Все')throw Error('Повреждена категория.');
  const name=c.name.trim(),key=name.toLocaleLowerCase('ru');if(ids.has(c.id)||names.has(key))throw Error('Повтор категории.');ids.add(c.id);names.add(key);
  const image=String(c.image||'');total+=image.length;
  if(image&&!/^\/assets\/categories\/[a-z0-9-]+\.(png|svg|webp)$/.test(image)&&!/^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(image))throw Error('Неверное фото категории.');
  if(image.length>6*1024*1024||total>14*1024*1024)throw Error('Фото занимают слишком много места. Уменьши размер изображений.');
  return {id:c.id,name,image,color:/^#[0-9a-f]{6}$/i.test(c.color)?c.color:'#eef2e9',visible:c.visible!==false,scale:Math.max(.6,Math.min(1.6,Number(c.scale)||1))};
 });
}
