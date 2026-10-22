import test from 'node:test';
import assert from 'node:assert/strict';
import {selectVoiceInputMode} from '../public/voice-mode.js';

test('Android Chrome uses faster browser speech first when supported',()=>{
 assert.equal(selectVoiceInputMode({geminiConfigured:true,mediaSupported:true,recorderSupported:true,browserSupported:true}),'browser');
});
test('Android PWA falls back to Gemini transcription when browser recognition unavailable',()=>{
 assert.equal(selectVoiceInputMode({geminiConfigured:true,mediaSupported:true,recorderSupported:false,browserSupported:true}),'browser');
 assert.equal(selectVoiceInputMode({geminiConfigured:false,mediaSupported:true,recorderSupported:true,browserSupported:true}),'browser');
 assert.equal(selectVoiceInputMode({geminiConfigured:true,mediaSupported:true,recorderSupported:true,browserSupported:false}),'gemini');
});
test('Unsupported devices display a clear error instead of requesting mic indefinitely',()=>{
 assert.equal(selectVoiceInputMode({geminiConfigured:false,mediaSupported:true,recorderSupported:true,browserSupported:false}),'unsupported');
 assert.equal(selectVoiceInputMode({geminiConfigured:true,mediaSupported:false,recorderSupported:false,browserSupported:false}),'unsupported');
});
