// Procedural WebGL surface: no raster texture to blur at high pixel density.
export function mountAuroraOrb(host,panel){
 const canvas=document.createElement('canvas');canvas.setAttribute('aria-hidden','true');host.append(canvas);
 const gl=canvas.getContext('webgl',{alpha:true,antialias:true,premultipliedAlpha:false});if(!gl){canvas.remove();return ()=>{}}
 const vs='attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}';
 const fs=`precision highp float;
 uniform vec2 size;uniform float time,level,phase;
 mat3 rot(float a){float c=cos(a),s=sin(a);return mat3(c,0.,s,0.,1.,0.,-s,0.,c);}
 float bands(vec3 p){return sin(p.x*5.+sin(p.y*4.+sin(p.z*3.))*1.8)+sin(p.z*7.+p.y*2.)*.35;}
 vec3 sky(vec3 d){float b=pow(max(0.,1.-abs(d.y-.18-sin(d.x*4.+time*.13)*.13)*4.),3.);vec3 green=vec3(.16,.85,.59),purple=vec3(.42,.31,.78);return vec3(.008,.03,.04)+mix(green,purple,smoothstep(-.5,.6,d.x))*b*.65+vec3(.5,.85,.78)*pow(max(dot(d,normalize(vec3(-.5,.8,1.))),0.),40.)*1.3;}
 void main(){vec2 uv=(gl_FragCoord.xy/size-.5)*2.;uv.x*=size.x/size.y;float r=length(uv),rad=.79+level*.024;float halo=exp(-max(0.,r-rad)*13.)*.18;vec3 glow=mix(vec3(.11,.67,.48),vec3(.34,.3,.7),phase)*halo;float alpha=halo*.65;
 if(r<rad){vec3 n=normalize(vec3(uv/rad,sqrt(1.-pow(r/rad,2.))));vec3 p=rot(time*.065)*n;float field=bands(p*1.1+vec3(0.,time*.055,0.));vec3 material=mix(vec3(.012,.075,.08),vec3(.08,.38,.28),smoothstep(-1.,1.,field));material=mix(material,vec3(.15,.12,.38),smoothstep(.25,.9,p.x)*.5);
 vec3 light=normalize(vec3(-.55,.7,1.3)),eye=vec3(0.,0.,1.),halfv=normalize(light+eye);float diff=max(dot(n,light),0.);float spec=pow(max(dot(n,halfv),0.),115.)*.8;float fres=pow(1.-n.z,3.);vec3 reflected=sky(reflect(-eye,n));float ribbons=pow(max(0.,1.-abs(field-.25)*4.),4.);vec3 vein=mix(vec3(.32,.95,.74),vec3(.6,.45,.95),smoothstep(-.7,.8,p.x));vec3 c=material*(.2+diff*.8)+reflected*(.2+fres*.65)+vein*ribbons*(.12+level*.7)+vec3(.73,1.,.91)*spec;
 float edge=(1.-smoothstep(rad-.012,rad,r));glow=mix(glow,c,edge);alpha=mix(alpha,1.,edge);}
 gl_FragColor=vec4(pow(glow,vec3(.85)),alpha);}`;
 function compile(type,code){const s=gl.createShader(type);gl.shaderSource(s,code);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error('shader');return s}
 let program;try{program=gl.createProgram();gl.attachShader(program,compile(gl.VERTEX_SHADER,vs));gl.attachShader(program,compile(gl.FRAGMENT_SHADER,fs));gl.linkProgram(program);if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error('link')}catch{canvas.remove();return ()=>{}}
 gl.useProgram(program);const buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]),gl.STATIC_DRAW);const position=gl.getAttribLocation(program,'p');gl.enableVertexAttribArray(position);gl.vertexAttribPointer(position,2,gl.FLOAT,false,0,0);
 const uniforms=Object.fromEntries(['size','time','level','phase'].map(k=>[k,gl.getUniformLocation(program,k)]));let frame=0,stopped=false,lastDraw=0;const reduced=matchMedia('(prefers-reduced-motion: reduce)');
 function draw(now){if(stopped)return;frame=requestAnimationFrame(draw);if(document.hidden||now-lastDraw<33)return;lastDraw=now;const rect=host.getBoundingClientRect(),dpr=Math.min(window.devicePixelRatio||1,3),width=Math.round(rect.width*dpr),height=Math.round(rect.height*dpr);if(!width||!height)return;if(canvas.width!==width||canvas.height!==height){canvas.width=width;canvas.height=height;gl.viewport(0,0,width,height)}gl.uniform2f(uniforms.size,width,height);gl.uniform1f(uniforms.time,reduced.matches?0:now*.001);gl.uniform1f(uniforms.level,reduced.matches?0:Number(panel.style.getPropertyValue('--voice-level'))||0);gl.uniform1f(uniforms.phase,panel.dataset.phase==='speaking'?1:0);gl.drawArrays(gl.TRIANGLES,0,6)}
 host.classList.add('orb-webgl');frame=requestAnimationFrame(draw);
 const dispose=()=>{stopped=true;cancelAnimationFrame(frame);gl.deleteBuffer(buffer);gl.deleteProgram(program)};canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();dispose();canvas.remove();host.classList.remove('orb-webgl')});window.addEventListener('pagehide',dispose,{once:true});return dispose;
}
