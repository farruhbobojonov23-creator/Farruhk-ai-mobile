// Retry only transport failures. The same serialized recipe ID and digest make
// a lost response safe to resend to the idempotent Google receiver.
function waitForRetry(ms,signal){
 return new Promise((resolve,reject)=>{
  if(signal?.aborted){reject(signal.reason||new DOMException('Cancelled','AbortError'));return}
  const done=()=>{signal?.removeEventListener('abort',cancel);resolve()};
  const timer=setTimeout(done,ms);
  const cancel=()=>{clearTimeout(timer);signal?.removeEventListener('abort',cancel);reject(signal.reason||new DOMException('Cancelled','AbortError'))};
  signal?.addEventListener('abort',cancel,{once:true});
 });
}
export async function postGooglePacket(body,signal,{request=fetch,wait=waitForRetry}={}){
 const serialized=JSON.stringify(body);
 const delays=[0,2000,6000];
 for(let attempt=0;attempt<delays.length;attempt++){
  if(signal?.aborted)throw signal.reason||new DOMException('Cancelled','AbortError');
  if(delays[attempt])await wait(delays[attempt],signal);
  if(signal?.aborted)throw signal.reason||new DOMException('Cancelled','AbortError');
  try{
   const timeout=AbortSignal.timeout(110000);
   const response=await request('/api/recipes/google-sync',{method:'POST',headers:{'Content-Type':'application/json'},
    body:serialized,cache:'no-store',signal:signal?AbortSignal.any([signal,timeout]):timeout});
   let data;
   try{data=await response.json()}catch(error){
    if(error instanceof TypeError||error?.name==='AbortError'||error?.name==='TimeoutError')throw error;
    // Proxy restarts can return HTML instead of the gateway's JSON.
    if([502,503,504].includes(response.status))throw Object.assign(new Error('Temporary gateway response'),{transport:true});
    throw Object.assign(new Error('Сервер вернул неожиданный ответ. Обновите страницу и повторите отправку.'),{code:'GOOGLE_INVALID_RESPONSE'});
   }
   if(!response.ok||data?.ok!==true){
    const error=new Error(data?.error||'Google не подтвердил сохранение.');
    Object.assign(error,{code:data?.code,documentSaved:data?.documentSaved===true,documentUrl:data?.documentUrl});
    throw error;
   }
   return data;
  }catch(error){
   if(signal?.aborted)throw signal.reason||new DOMException('Cancelled','AbortError');
   const transient=error?.transport===true||error instanceof TypeError||
    error?.name==='TimeoutError'||error?.name==='AbortError';
   if(!transient)throw error;
   if(attempt===delays.length-1)throw Object.assign(
    new Error('Не удалось получить ответ сервера после 3 попыток. ТТК сохранена на устройстве; результат записи в Google пока не подтверждён. Отправка повторится при восстановлении связи или возвращении в приложение.'),
    {code:'GOOGLE_TRANSPORT_UNCONFIRMED'});
  }
 }
}
