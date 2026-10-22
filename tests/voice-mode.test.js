import test from 'node:test';
import assert from 'node:assert/strict';
import {selectVoiceInputMode} from '../public/voice-mode.js';

test('Android Chrome records into Gemini when supported and configured',()=>{
 assert.equal(selectVoiceInputMode({geminiConfigured:true,mediaSupported:true,recorderSupported:true,browserSupported:true}),'gemini');
});
test('Android PWA falls back to browser recognition if recording unavailable',()=>{
 assert.equal(selectVoiceInputMode({geminiConfigured:true,mediaSupported:true,recorderSupported:false,browserSupported:true}),'browser');
 assert.equal(selectVoiceInputMode({geminiConfigured:false,mediaSupported:true,recorderSupported:true,browserSupported:true}),'browser');
});
test('Unsupported devices display a clear error instead of requesting mic indefinitely',()=>{
 assert.equal(selectVoiceInputMode({geminiConfigured:false,mediaSupported:true,recorderSupported:true,browserSupported:false}),'unsupported');
 assert.equal(selectVoiceInputMode({geminiConfigured:true,mediaSupported:false,recorderSupported:false,browserSupported:false}),'unsupported');
});
