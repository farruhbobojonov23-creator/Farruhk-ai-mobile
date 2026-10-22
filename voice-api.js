// Neural TTS is server-side only: the browser never receives the Gemini API key.
// Gemini 3.8 TTS uses the Interactions endpoint, NOT generateContent.
export function installVoiceApi(app,{key,model=process.env.GEMINI_TTS_MODEL||'gemini-3.8-flash-tts',request=fetch}){
  const voices=['Kore','Aoede','Sulafat'];
  app.get('/api/voice/config',(req,res)=>{
    res.setHeader('Cache-Control','no-store');
    res.json({configured:Boolean(key),model:key?model:null,voices});
  });
  app.post('/api/voice/speak',async(req,res)=>{
    if(!key)return res.status(503).json({error:'Голос Gemini не настроен на сервере.'});
    const text=typeof req.body?.text==='string'?req.body.text.trim():'';
    if(!text||text.length>3500)return res.status(400).json({error:'Для озвучивания нужен текст до 3500 символов.'});
    const voice=voices.includes(req.body?.voice)?req.body.voice:'Sulafat';
    const controller=new AbortController();
    const timer=setTimeout(()=>controller.abort(),45000);
    const disconnect=()=>{if(!res.writableEnded)controller.abort()};
    res.on('close',disconnect);
    try{
      const body={
        model,
        input:[{type:'user_input',content:[{
          type:'text',
          text,
          annotations:[{type:'speech_metadata',style:'Speak in Russian naturally, warmly and calmly, like a helpful female colleague. Conversational pacing, clear diction and gentle intonation.'}]
        }]}],
        response_format:{type:'audio'},
        generation_config:{speech_config:[{voice}]}
      };
      const response=await request('https://generativelanguage.googleapis.com/v1beta/interactions',{
        method:'POST',headers:{'Content-Type':'application/json','x-goog-api-key':key},
        body:JSON.stringify(body),signal:controller.signal
      });
      const data=await response.json().catch(()=>({}));
      if(!response.ok){const err=new Error('provider');err.status=response.status;throw err}
      // In raw Interactions REST JSON, audio is in steps[].content[].data.
      const audio=(data?.steps||[])
        .filter(step=>step?.type==='model_output')
        .flatMap(step=>Array.isArray(step.content)?step.content:[])
        .filter(part=>part?.type==='audio'&&typeof part.data==='string')
        .at(-1);
      if(!audio)throw Error('empty audio');
      const bytes=Buffer.from(audio.data,'base64');
      if(bytes.length<44||bytes.subarray(0,4).toString()!=='RIFF'||bytes.subarray(8,12).toString()!=='WAVE')throw Error('invalid WAV');
      res.setHeader('Cache-Control','no-store');
      res.type('audio/wav').send(bytes);
    }catch(error){
      if(res.destroyed)return;
      const quota=error.status===429;
      res.status(quota?429:502).json({error:quota?'Лимит голосового сервиса исчерпан. Попробуй позже.':'Не удалось создать голосовой ответ. Текст ответа доступен в чате.'});
    }finally{clearTimeout(timer);res.off('close',disconnect)}
  });
}
