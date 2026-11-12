export async function requireOwner(){
  // The owner-only HTML is served only after server-side cookie verification.
  // Skip duplicate authentication calls on every navigation and refresh.
  if(document.querySelector('meta[name="farruh-owner-validated"][content="1"]'))return {authenticated:true,serverValidated:true};
  const check=await fetch('/api/auth/session',{cache:'no-store',credentials:'same-origin',signal:AbortSignal.timeout(9000)}).then(r=>{if(!r.ok)throw Error('Session unavailable');return r.json()}).catch(()=>({configured:false,offline:true}));
  if(check.authenticated)return check;
  const overlay=document.createElement('div');overlay.className='login-overlay';
  overlay.innerHTML='<form class="login-card"><span class="panel-kicker">FARRUKH AI</span><h1>Личный ассистент</h1><p>Войдите, чтобы открыть ваши данные.</p><label>Пароль<input type="password" name="password" autocomplete="current-password" required></label><button type="submit">Войти</button><p class="login-error" role="alert"></p></form>';
  document.body.appendChild(overlay);overlay.querySelector('input').focus();
  const error=overlay.querySelector('.login-error');
  if(!check.configured)error.textContent=check.offline?'Сервер недоступен. Повторите вход после восстановления связи.':'Вход ещё не настроен на сервере. Нужны ASSISTANT_PASSWORD и ASSISTANT_SESSION_SECRET.';
  await new Promise(resolve=>{overlay.querySelector('form').onsubmit=async e=>{
    e.preventDefault();const button=e.target.querySelector('button');button.disabled=true;error.textContent='';
    try{const r=await fetch('/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},credentials:'same-origin',cache:'no-store',signal:AbortSignal.timeout(12000),body:JSON.stringify({password:e.target.elements.password.value})});const d=await r.json();if(!r.ok)throw Error(d.error||'Не удалось войти');overlay.remove();resolve()}catch(e){error.textContent=e.name==='TimeoutError'?'Сервер отвечает слишком долго. Повтори вход.':e.message}finally{button.disabled=false}
  }});
}
