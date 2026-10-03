// Free local Piper TTS for FARRUKH AI Mobile.
// Runs in the browser; no API key and no paid voice service required.
let piperModulePromise = null;
let piperAudio = null;

async function loadPiper(){
  if(!piperModulePromise){
    piperModulePromise = import('https://esm.sh/@mintplex-labs/piper-tts-web@1.0.5');
  }
  return piperModulePromise;
}

const systemSpeak = typeof speak === 'function' ? speak : null;

speak = async function(text){
  if(!state.tts || !text) return;

  try{
    if('speechSynthesis' in window) speechSynthesis.cancel();
    if(piperAudio){
      piperAudio.pause();
      piperAudio = null;
    }

    const tts = await loadPiper();
    const wav = await tts.predict({
      text: String(text),
      voiceId: 'ru_RU-dmitri-medium'
    });

    const url = URL.createObjectURL(wav);
    piperAudio = new Audio(url);
    piperAudio.onended = () => {
      URL.revokeObjectURL(url);
      piperAudio = null;
    };
    piperAudio.onerror = () => URL.revokeObjectURL(url);
    await piperAudio.play();
  }catch(err){
    console.warn('Piper TTS unavailable, using system voice:', err);
    if(systemSpeak) systemSpeak(text);
  }
};

// Warm up the library after the page is interactive without blocking startup.
window.addEventListener('load', () => {
  setTimeout(() => loadPiper().catch(() => {}), 1500);
});
