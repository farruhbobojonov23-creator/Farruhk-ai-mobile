// Pure capabilities check used before attempting microphone access on Android/PWA.
export function selectVoiceInputMode({geminiConfigured=false,mediaSupported=false,recorderSupported=false,browserSupported=false}={}){
 // Chrome's one-utterance recognition removes an extra audio upload and AI transcription round-trip.
 if(browserSupported)return 'browser';
 return geminiConfigured&&mediaSupported&&recorderSupported?'gemini':'unsupported';
}
