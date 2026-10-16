import {build} from 'esbuild';
await build({entryPoints:['node_modules/@imgly/background-removal/dist/index.mjs'],bundle:true,format:'esm',splitting:true,outdir:'public/vendor/background',minify:true,legalComments:'external',alias:{'onnxruntime-web/webgpu':'onnxruntime-web'}});
