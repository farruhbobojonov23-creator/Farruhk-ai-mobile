// Neural TTS uses the existing server-side Gemini key; no keys reach the browser.
export function installVoiceApi(app,{key,model=process.env.GEMINI_TTS_MODEL||'gemini-3.8-flash-tts',request=fetch}){
  const voices=['Kore','Aoede','Sulafat'];
  app.get('/api/voice/config',(req,res)=>res.json({configured:Boolean(key),model,voices}));
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
      const body={contents:[{role:'user',parts:[{text,speech_metadata:{style:'Speak Russian naturally, warmly and calmly, like a helpful female colleague. Use expressive but subtle intonation, conversational pacing and natural pauses. Do not sound like an announcer.'}}]}],generationConfig:{responseModalities:['AUDIO'],speechConfig:{voiceConfig:{voice}}}};
      const response=await request('https://generativelanguage.googleapis.com/v1beta/models/'+encodeURIComponent(model)+':generateContent',{method:'POST',headers:{'Content-Type':'application/json','x-goog-api-key':key},body:JSON.stringify(body),signal:controller.signal});
      const data=await response.json();
      if(!response.ok){const err=new Error('provider');err.status=response.status;throw err}
      const audio=data?.candidates?.[0]?.content?.parts?.find(p=>p.inlineData?.data)?.inlineData;
      if(!audio?.data)throw Error('empty audio');
      const bytes=Buffer.from(audio.data,'base64');
      if(bytes.length<44||bytes.subarray(0,4).toString()!=='RIFF'||bytes.subarray(8,12).toString()!=='WAVE')throw Error('invalid WAV');
      res.setHeader('Cache-Control','no-store');res.type('audio/wav').send(bytes);
    }catch(error){
      if(res.destroyed)return;
      const quota=error.status===429;
      res.status(quota?429:502).json({error:quota?'Лимит голосового сервиса исчерпан. Попробуй позже.':'Не удалось создать голосовой ответ. Текст ответа доступен в чате.'});
    }finally{clearTimeout(timer);res.off('close',disconnect)}
  });
}
