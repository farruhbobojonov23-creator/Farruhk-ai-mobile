(()=>{'use strict';
function mount(){if(document.getElementById('aiLive'))return;
 const b=document.createElement('button');b.className='ai-live-launch';b.setAttribute('aria-label','Открыть FARRUKH AI');b.textContent='✦';
 const o=document.createElement('section');o.id='aiLive';o.className='ai-live';o.innerHTML='<div class="ai-live-head"><button class="ai-live-close" aria-label="Закрыть">×</button><div class="ai-live-logo">FARRUKH <b>AI</b></div><button class="ai-live-sound" aria-label="Звук">◖))</button></div><div class="ai-live-stage"><div class="ai-live-avatar"></div><div class="ai-live-holo"></div></div><div class="ai-live-panel"><div class="ai-live-state">Готова помочь</div><div class="ai-live-copy">Нажмите микрофон и говорите</div><div class="ai-live-wave">'+Array(17).fill('<i></i>').join('')+'</div><button class="ai-live-mic" aria-label="Говорить">🎙</button></div>';
 document.body.append(b,o);
 const state=(s,t,c)=>{o.className='ai-live open '+s;o.querySelector('.ai-live-state').textContent=t;o.querySelector('.ai-live-copy').textContent=c||''};
 b.onclick=()=>{o.classList.add('open');state('','Здравствуйте, шеф!','Я готова. Нажмите микрофон и говорите.')};
 o.querySelector('.ai-live-close').onclick=()=>o.classList.remove('open');
 o.querySelector('.ai-live-mic').onclick=()=>{state('listening','Слушаю вас…','Говорите, я внимательно слушаю.');const old=document.querySelector('[data-start-chat]');if(old)old.click();setTimeout(()=>{if(o.classList.contains('listening'))state('thinking','Думаю…','Обрабатываю запрос')},5500)};
 const mo=new MutationObserver(()=>{const body=document.body.className||'';if(body.includes('speaking'))state('speaking','Отвечаю…','FARRUKH AI');else if(body.includes('listening'))state('listening','Слушаю вас…','Говорите')});mo.observe(document.body,{attributes:true,attributeFilter:['class']});
 document.addEventListener('click',e=>{if(e.target.closest('[data-start-chat]')&&!e.target.closest('.ai-live-mic')){o.classList.add('open');state('listening','Слушаю вас…','Говорите, я внимательно слушаю.')}});
}
document.readyState==='loading'?document.addEventListener('DOMContentLoaded',mount):mount();
})();