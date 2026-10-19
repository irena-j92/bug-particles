import * as THREE from './vendor/three.module.js';
import {createLadybugModel,createChromeMaterial,createStudioEnvironment,createDepthMaterial,vertexShader,fragmentShader} from './ladybug.js?v=bitmap-4';

// All artistic controls live here. Density changes require rebuilding the geometry.
const CONFIG={desktopDensity:1,mobileDensity:.50,initialRotation:.92,pointSize:2.05,dotSize:3.8,scrollScrub:1.05};
const stage=document.querySelector('#stage'),loader=document.querySelector('#loader');
const reducedMotion=matchMedia('(prefers-reduced-motion: reduce)').matches;
let renderer,geometry,material,solidGeometry,solidMaterial,animationFrame,scrollTween,disposed=false;
let failed=false;
function progress(value){document.querySelector('#loading-fill').style.width=value+'%';document.querySelector('#loading-number').textContent=String(value).padStart(2,'0');}
// Real 5x7 bitmap letters, rendered without font/network dependencies.
const glyphs={l:['10000','10000','10000','10000','10000','10000','11111'],o:['00000','00000','01110','10001','10001','10001','01110'],a:['00000','00000','01110','00001','01111','10001','01111'],d:['00001','00001','01111','10001','10001','10001','01111'],i:['00100','00000','01100','00100','00100','00100','01110'],n:['00000','00000','11110','10001','10001','10001','10001'],g:['00000','01111','10001','10001','01111','00001','01110'],'.':['00000','00000','00000','00000','00000','00100','00100']};
const ctx=document.querySelector('#pixel-label').getContext('2d');ctx.fillStyle='#e4ff86';[...'loading...'].forEach((c,i)=>glyphs[c].forEach((row,y)=>[...row].forEach((bit,x)=>{if(bit==='1')ctx.fillRect(i*6+x,y,1,1);})));progress(12);
function showFailure(error){if(failed)return;failed=true;console.error(error);loader.hidden=true;loader.style.display='none';document.querySelector('#fallback').hidden=false;stage.style.display='none';document.querySelector('.interaction').style.display='none';}
// A failed import must never leave an infinite preloader.
window.addEventListener('error',()=>showFailure(new Error('A required resource failed to initialize.')),{once:true});
const timeout=setTimeout(()=>{if(loader.isConnected&&loader.style.display!=='none')showFailure(new Error('Initialization timed out.'));},15000);

async function init(){
  if(!window.gsap||!window.ScrollTrigger)throw new Error('GSAP did not load.');
  gsap.registerPlugin(ScrollTrigger);
  renderer=new THREE.WebGLRenderer({alpha:true,antialias:true,powerPreference:'high-performance'});
  renderer.debug.onShaderError=(gl,program,vertex,fragment)=>showFailure(new Error([
    'WebGL shader compilation failed',gl.getProgramInfoLog(program),gl.getShaderInfoLog(vertex),gl.getShaderInfoLog(fragment)
  ].filter(Boolean).join('\n')));
  renderer.setPixelRatio(Math.min(devicePixelRatio,1.75));renderer.setClearColor(0x111110,0);
  renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.05;
  stage.appendChild(renderer.domElement);
  renderer.domElement.addEventListener('webglcontextlost',event=>{event.preventDefault();cancelAnimationFrame(animationFrame);showFailure(new Error('WebGL context lost. Reload to restore it.'));});
  const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(33,1,.1,80);
  camera.position.set(0,4.6,10.8);camera.lookAt(0,.30,0);
  progress(28);await new Promise(requestAnimationFrame);
  const isMobile=innerWidth<700;
  const model=createLadybugModel(isMobile?CONFIG.mobileDensity:CONFIG.desktopDensity);
  geometry=model.particles;solidGeometry=model.solid;progress(60);
  const environment=createStudioEnvironment(renderer);scene.environment=environment.texture;
  renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
  const key=new THREE.DirectionalLight(0xf2f5ff,2.4);key.position.set(-3,6,5);key.castShadow=true;
  key.shadow.mapSize.set(isMobile?1024:2048,isMobile?1024:2048);
  Object.assign(key.shadow.camera,{left:-4,right:4,top:4,bottom:-4,near:.1,far:20});
  key.shadow.bias=-.00035;key.shadow.normalBias=.016;key.shadow.radius=4;scene.add(key);
  const fill=new THREE.DirectionalLight(0xb4c5ff,.65);fill.position.set(4,1,-3);scene.add(fill);
  material=new THREE.ShaderMaterial({vertexShader,fragmentShader,transparent:true,depthWrite:true,depthTest:true,uniforms:{uTime:{value:0},uBurst:{value:0},uPixelRatio:{value:renderer.getPixelRatio()},uPointScale:{value:CONFIG.pointSize},uMotion:{value:reducedMotion?0:1},uDotSize:{value:CONFIG.dotSize}}});
  solidMaterial=createChromeMaterial(material.uniforms);
  const bug=new THREE.Group(),solidBug=new THREE.Mesh(solidGeometry,solidMaterial),particles=new THREE.Points(geometry,material);
  particles.frustumCulled=false;particles.renderOrder=1;
  solidBug.castShadow=true;solidBug.receiveShadow=true;solidBug.customDepthMaterial=createDepthMaterial(material.uniforms);
  const ground=new THREE.Mesh(new THREE.PlaneGeometry(12,12),new THREE.ShadowMaterial({opacity:.40}));
  ground.rotation.x=-Math.PI/2;ground.position.y=-.925;ground.receiveShadow=true;
  bug.add(solidBug,particles,ground);bug.rotation.y=CONFIG.initialRotation;scene.add(bug);progress(78);
  let targetAngle=CONFIG.initialRotation,dragging=false,lastX=0,velocity=0;
  const resize=()=>{
    const w=stage.clientWidth,h=stage.clientHeight;renderer.setSize(w,h);camera.aspect=w/h;camera.updateProjectionMatrix();
    const mobile=w<700;bug.scale.setScalar(mobile?Math.min(.75,w/h*1.17):1.07);
    material.uniforms.uDotSize.value=mobile?2.7:CONFIG.dotSize;
    // Put the insect below the type baseline, keeping all six legs in frame.
    bug.position.y=mobile?-.46:-.37;
  };resize();window.addEventListener('resize',resize);
  stage.addEventListener('pointerdown',event=>{if(event.button!==0)return;dragging=true;lastX=event.clientX;velocity=0;stage.setPointerCapture(event.pointerId);});
  stage.addEventListener('pointermove',event=>{if(!dragging)return;const delta=event.clientX-lastX;velocity=delta*.006;targetAngle+=velocity;lastX=event.clientX;});
  const release=()=>{dragging=false;};stage.addEventListener('pointerup',release);stage.addEventListener('pointercancel',release);stage.addEventListener('lostpointercapture',release);
  stage.addEventListener('keydown',event=>{if(event.key==='ArrowLeft'||event.key==='ArrowRight'){event.preventDefault();targetAngle+=(event.key==='ArrowLeft'?-1:1)*.2;}});
  const burst=material.uniforms.uBurst;
  scrollTween=gsap.to(burst,{value:1,ease:'none',scrollTrigger:{trigger:'#experiment',start:'top top',end:'bottom bottom',scrub:reducedMotion?true:CONFIG.scrollScrub},onUpdate:()=>{
    const p=burst.value;document.querySelector('#percent').textContent=String(Math.round(p*100)).padStart(3,'0');
    document.querySelector('#progress').style.transform=`scaleX(${p})`;document.querySelector('#phase-label').textContent=p<.08?'FORM':p>.85?'FREE':'FLUX';
    gsap.set('.title-wrap',{y:reducedMotion?0:-p*90,opacity:1-p*.92});
    gsap.set(['.specimen','.interaction'],{opacity:Math.max(0,1-p*5)});
  }});
  let previous=performance.now(),elapsed=0;
  const render=now=>{
    if(disposed||failed)return;
    const dt=Math.min((now-previous)/1000,.05);previous=now;
    if(!document.hidden){
      elapsed+=dt;material.uniforms.uTime.value=elapsed;
      solidBug.visible=material.uniforms.uBurst.value<.24;
      particles.visible=material.uniforms.uBurst.value>.02;
      ground.material.opacity=.40*(1-THREE.MathUtils.smoothstep(material.uniforms.uBurst.value,.025,.24));
      if(!dragging&&!reducedMotion){targetAngle+=velocity*dt*20;velocity*=Math.exp(-dt*7);}
      bug.rotation.y=THREE.MathUtils.lerp(bug.rotation.y,targetAngle,reducedMotion?1:1-Math.exp(-dt*10));
      bug.rotation.z=reducedMotion?0:Math.sin(elapsed*.35)*.007;
      renderer.render(scene,camera);
    }
    animationFrame=requestAnimationFrame(render);
  };
  renderer.compile(scene,camera);if(failed)return;
  renderer.render(scene,camera);if(failed)return;
  progress(100);render(performance.now());clearTimeout(timeout);
  gsap.to(loader,{opacity:0,duration:reducedMotion?0:.65,delay:reducedMotion?0:.35,onComplete:()=>{loader.style.display='none';loader.setAttribute('aria-hidden','true');}});
  if(!reducedMotion)gsap.from('.title-wrap',{scale:.98,duration:1.3,ease:'power3.out'});
  ScrollTrigger.refresh();
  // Explicit cleanup for embedding this standalone hero in an SPA.
  window.destroyBuggedOut=()=>{disposed=true;cancelAnimationFrame(animationFrame);scrollTween.scrollTrigger.kill();scrollTween.kill();window.removeEventListener('resize',resize);geometry.dispose();material.dispose();solidGeometry.dispose();solidMaterial.dispose();solidBug.customDepthMaterial.dispose();ground.geometry.dispose();ground.material.dispose();environment.dispose();key.shadow.map?.dispose();renderer.dispose();renderer.domElement.remove();};
}
const menuButton=document.querySelector('#menu-button'),menu=document.querySelector('#menu');
function closeMenu(){menu.hidden=true;menuButton.setAttribute('aria-expanded','false');menuButton.setAttribute('aria-label','Open menu');}
menuButton.addEventListener('click',()=>{const open=menu.hidden;menu.hidden=!open;menuButton.setAttribute('aria-expanded',String(open));menuButton.setAttribute('aria-label',open?'Close menu':'Open menu');});
document.addEventListener('keydown',e=>{if(e.key==='Escape'){closeMenu();menuButton.focus();}});
document.querySelector('#restart').addEventListener('click',()=>{closeMenu();window.scrollTo({top:0,behavior:reducedMotion?'instant':'smooth'});});
document.querySelector('#scroll-cue').addEventListener('click',()=>window.scrollTo({top:document.querySelector('#experiment').offsetHeight-innerHeight,behavior:reducedMotion?'instant':'smooth'}));
// Preserve the live scene in the back/forward cache; dispose on actual unload.
window.addEventListener('pagehide',event=>{if(!event.persisted)window.destroyBuggedOut?.();});
// Module execution can precede defer scripts in some loading scenarios.
if(document.readyState==='complete')init().catch(showFailure);else window.addEventListener('load',()=>init().catch(showFailure),{once:true});
