import * as THREE from 'three';
import {RoomEnvironment} from 'three/examples/jsm/environments/RoomEnvironment.js';
const host=document.querySelector('.ruby-scene');
if(host) start().catch(()=>{host.dataset.renderer='fallback'});
async function start(){
 const renderer=new THREE.WebGLRenderer({alpha:true,antialias:true,powerPreference:'low-power'});
 renderer.setClearColor(0x000000,0);renderer.setPixelRatio(Math.min(devicePixelRatio,2));
 renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.15;
 const canvas=renderer.domElement;canvas.className='ruby-sphere-canvas';canvas.tabIndex=0;canvas.setAttribute('role','img');canvas.setAttribute('aria-label','Объёмная сфера FARRUH AI. Поверните касанием или клавишами со стрелками.');
 host.removeAttribute('aria-hidden');host.append(canvas);
 const scene=new THREE.Scene(), camera=new THREE.PerspectiveCamera(35,1,.1,30);camera.position.set(0,.25,4.8);camera.lookAt(0,-.06,0);
 const pmrem=new THREE.PMREMGenerator(renderer),room=new RoomEnvironment();const environment=pmrem.fromScene(room,.04);scene.environment=environment.texture;room.dispose();pmrem.dispose();
 scene.add(new THREE.HemisphereLight(0xffffff,0x4b0010,2));
 const key=new THREE.DirectionalLight(0xfff1ed,4);key.position.set(-3,4,4);scene.add(key);
 const red=new THREE.PointLight(0xff183b,8,9);red.position.set(2,-1,2);scene.add(red);
 const orb=new THREE.Group();scene.add(orb);orb.rotation.set(.38,.35,-.25);
 const chrome=new THREE.MeshPhysicalMaterial({color:0xf0e7e4,metalness:1,roughness:.13,clearcoat:1,clearcoatRoughness:.07,envMapIntensity:1.8,side:THREE.DoubleSide});
 const ruby=new THREE.MeshPhysicalMaterial({color:0x8d0018,metalness:.15,roughness:.08,clearcoat:1,transparent:true,opacity:.24,depthWrite:false,side:THREE.FrontSide,envMapIntensity:1.4});
 orb.add(new THREE.Mesh(new THREE.SphereGeometry(.94,64,40),ruby));
 // Three curved, broad metal ribbons follow the surface of a sphere.
 for(let b=0;b<3;b++){
  const pos=[],indices=[];const n=192,m=10;
  for(let i=0;i<=n;i++){const t=i/n*Math.PI*2;for(let j=0;j<=m;j++){const v=(j/m-.5)*.34;const lat=.38*Math.sin(t*2)+v;const r=1.01+.025*Math.cos(v/.17*Math.PI/2);pos.push(r*Math.cos(lat)*Math.cos(t),r*Math.sin(lat),r*Math.cos(lat)*Math.sin(t));}}
  for(let i=0;i<n;i++)for(let j=0;j<m;j++){const a=i*(m+1)+j,c=a+m+1;indices.push(a,c,a+1,c,c+1,a+1);}
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setIndex(indices);g.computeVertexNormals();const mesh=new THREE.Mesh(g,chrome);mesh.rotation.set(b*Math.PI/3,b*Math.PI*2/3,b*.25);orb.add(mesh);
 }
 const glowMat=new THREE.MeshBasicMaterial({color:0xff294b});const filamentMat=new THREE.LineBasicMaterial({color:0xff193d,transparent:true,opacity:.7});
 const neural=new THREE.Group();orb.add(neural);const points=[];
 for(let i=0;i<52;i++){const y=1-2*(i+.5)/52,a=i*2.399963,r=.83*Math.sqrt(1-y*y);points.push(new THREE.Vector3(r*Math.cos(a),.83*y,r*Math.sin(a)));}
 const dotGeo=new THREE.SphereGeometry(.013,8,6);const dots=new THREE.InstancedMesh(dotGeo,glowMat,points.length),matrix=new THREE.Matrix4();points.forEach((p,i)=>{matrix.makeTranslation(p.x,p.y,p.z);dots.setMatrixAt(i,matrix)});neural.add(dots);
 const lines=[];points.forEach((p,i)=>points.slice(i+1).forEach(q=>{const d=p.distanceTo(q);if(d<.48&&d>.2)lines.push(p.x,p.y,p.z,q.x,q.y,q.z)}));const lineGeo=new THREE.BufferGeometry();lineGeo.setAttribute('position',new THREE.Float32BufferAttribute(lines,3));neural.add(new THREE.LineSegments(lineGeo,filamentMat));
 const nucleus=new THREE.Mesh(new THREE.IcosahedronGeometry(.16,2),new THREE.MeshPhysicalMaterial({color:0xad0019,emissive:0xff1235,emissiveIntensity:.65,metalness:.4,roughness:.17,clearcoat:1}));orb.add(nucleus);
 for(let i=0;i<3;i++){const ring=new THREE.Mesh(new THREE.TorusGeometry(.71+i*.035,.005,6,128),glowMat);ring.rotation.set(i*.9,.5+i*.7,i*.4);neural.add(ring);}
 let targetX=.38,targetY=.35,drag=null,visible=true,last=0,raf=0,alive=true;const reduced=matchMedia('(prefers-reduced-motion: reduce)');
 function resize(){const {width,height}=host.getBoundingClientRect();if(!width||!height)return;renderer.setSize(width,height);camera.aspect=width/height;camera.position.z=camera.aspect<1?4.8/camera.aspect:4.8;camera.updateProjectionMatrix();render(performance.now(),true)}
 function render(now,force=false){if(!alive)return;const active=visible&&!document.hidden&&document.body.dataset.view==='home';if(!active)return;if(!force&&now-last<32){raf=requestAnimationFrame(render);return;}last=now;const phase=document.querySelector('#home')?.dataset.phase||'idle';const busy=['connecting','listening','thinking','speaking'].includes(phase);const pulse=busy&&!reduced.matches?1+Math.sin(now*.006)*.3:1;glowMat.color.setRGB(1,.025*pulse,.08*pulse);filamentMat.opacity=busy?.9:.55;nucleus.material.emissiveIntensity=.65*pulse;orb.rotation.x+=(targetX-orb.rotation.x)*.12;orb.rotation.y+=(targetY-orb.rotation.y)*.12;if(!reduced.matches)neural.rotation.y=now*(busy?.00012:.000025);renderer.render(scene,camera);if(!reduced.matches||busy||drag)raf=requestAnimationFrame(render);}
 function wake(){cancelAnimationFrame(raf);raf=requestAnimationFrame(t=>render(t,true))}
 canvas.addEventListener('pointerdown',e=>{drag={x:e.clientX,y:e.clientY};canvas.setPointerCapture(e.pointerId);wake()});
 canvas.addEventListener('pointermove',e=>{if(!drag)return;targetY+=(e.clientX-drag.x)*.008;targetX=Math.max(-1.2,Math.min(1.2,targetX+(e.clientY-drag.y)*.008));drag={x:e.clientX,y:e.clientY};wake()});
 for(const event of ['pointerup','pointercancel','lostpointercapture'])canvas.addEventListener(event,()=>{drag=null});
 canvas.addEventListener('keydown',e=>{if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key))return;e.preventDefault();targetY+=e.key==='ArrowLeft'?-.2:e.key==='ArrowRight'?.2:0;targetX+=e.key==='ArrowUp'?-.2:e.key==='ArrowDown'?.2:0;if(reduced.matches){orb.rotation.x=targetX;orb.rotation.y=targetY}wake()});
 const ro=new ResizeObserver(resize);ro.observe(host);const io=new IntersectionObserver(([e])=>{visible=e.isIntersecting;wake()});io.observe(host);const mo=new MutationObserver(wake);mo.observe(document.body,{attributes:true,attributeFilter:['data-view']});mo.observe(document.querySelector('#home'),{attributes:true,attributeFilter:['data-phase']});document.addEventListener('visibilitychange',wake);reduced.addEventListener('change',wake);
 canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();cancelAnimationFrame(raf);alive=false;host.dataset.renderer='fallback'});
 canvas.addEventListener('webglcontextrestored',()=>location.reload());
 resize();host.dataset.renderer='webgl';wake();
}
