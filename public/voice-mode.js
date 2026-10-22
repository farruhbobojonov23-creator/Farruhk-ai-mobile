// Pure capabilities check used before attempting microphone access on Android/PWA.
export function selectVoiceInputMode({geminiConfigured=false,mediaSupported=false,recorderSupported=false,browserSupported=false}={}){
 if(geminiConfigured&&mediaSupported&&recorderSupported)return 'gemini';
 return browserSupported?'browser':'unsupported';
}
