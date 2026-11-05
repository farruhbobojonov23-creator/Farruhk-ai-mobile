/* CHEF AKA live public site settings. All data here is intentionally public (text, tariffs, product photos only). */
import {createClient} from 'https://esm.sh/@supabase/supabase-js@2.118.0';
const sb=createClient('https://rwvljbgsqnabvzmoaxgg.supabase.co','sb_publishable_VD-jbYP5drGWQneUwaGytA_u-OWJclT',{auth:{persistSession:false,autoRefreshToken:false}});
const fmt=n=>new Intl.NumberFormat('ru-RU').format(Number(n||0));
async function applySiteConfig(){
 const [{data:rows,error:e1},{data:photos,error:e2}]=await Promise.all([
  sb.from('fk_site_settings').select('key,value'),
  sb.from('fk_site_photos').select('recipe_code,object_path')
 ]);
 if(e1)console.warn('CHEF AKA: настройки сайта пока недоступны');
 if(e2)console.warn('CHEF AKA: фотографии сайта пока недоступны');
 const s=Object.fromEntries((rows||[]).map(x=>[x.key,x.value]));
 const prices={start:Number(s.price_start)||49900,pro:Number(s.price_pro)||79900,premium:Number(s.price_premium)||199900};
 window.FK_SITE_PRICES=prices;
 const hero=document.querySelector('.fk-hero-copy h1');
 if(hero&&s.hero_title)hero.textContent=s.hero_title;
 const subtitle=document.querySelector('.fk-hero-copy .fk-hero-sub');
 if(subtitle&&s.hero_subtitle)subtitle.textContent=s.hero_subtitle;
 const amountMap=new Map([['49 900',prices.start],['79 900',prices.pro],['199 900',prices.premium],['99 950',prices.premium/2]]);
 // Replace only known literal old prices in rendered text nodes; never edit input/password fields or scripts.
 const scan=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT,{
  acceptNode(node){
   const parent=node.parentElement;
   if(!parent||parent.closest('script,style,textarea,option,pre,code'))return NodeFilter.FILTER_REJECT;
   return /(?:49|79|99|199)[\u00a0\u202f ]?\d{3}/.test(node.textContent||'')?NodeFilter.FILTER_ACCEPT:NodeFilter.FILTER_REJECT;
  }
 });
 const changed=[];
 while(scan.nextNode())changed.push(scan.currentNode);
 for(const node of changed){
  let t=node.textContent;
  for(const [old,num] of amountMap){
   const pat=new RegExp(old.replace(' ','[\\s\\u00a0\\u202f]*')+'(?=\\s*₽)','g');
   t=t.replace(pat,fmt(num));
  }
  node.textContent=t;
 }
 const priceEls=document.querySelectorAll('.fk-plan');
 for(const card of priceEls){
  const name=card.querySelector('h3')?.textContent||'';
  const code=name.includes('PREMIUM')?'premium':name.includes('PRO')?'pro':'start';
  const strong=card.querySelector('.fk-plan-price strong');
  if(strong)strong.textContent=fmt(prices[code])+' ₽';
 }
 const premiumStrong=document.querySelector('.fk-premium-price strong');
 if(premiumStrong)premiumStrong.textContent=fmt(prices.premium)+' ₽';
 const choose=document.getElementById('plan');
 if(choose){
  for(const option of choose.options){
   if(prices[option.value]!=null)option.textContent=option.textContent.replace(/\d[\d\s\u00a0\u202f]*₽/,fmt(prices[option.value])+' ₽');
  }
  choose.dispatchEvent(new Event('change',{bubbles:true}));
 }
 const pictureMap=window.FK_APPROVED_PRODUCT_PHOTOS||(window.FK_APPROVED_PRODUCT_PHOTOS={});
 for(const x of photos||[]){
  if(!/^(FK-A4|TTK-PF)-\d{3}$/.test(x.recipe_code)&&!/^(ТТК-ПФ)-\d{3}$/.test(x.recipe_code))continue;
  if(!x.object_path.startsWith('products/'))continue;
  const {data}=sb.storage.from('fk-site-photos').getPublicUrl(x.object_path);
  if(data?.publicUrl)pictureMap[x.recipe_code]=data.publicUrl;
 }
 window.dispatchEvent(new Event('fk:photos-changed'));
}
applySiteConfig().catch(()=>console.warn('CHEF AKA: public site config offline, existing design preserved'));
