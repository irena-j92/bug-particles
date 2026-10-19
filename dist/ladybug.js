import * as THREE from './vendor/three.module.js';

// A single detailed surface model supplies both the solid and its particle cloud.
// Materials: 0 silver shell, .15 hardware, .65 graphite, 1 black, 2 ivory, 3 lens.
const V = a => new THREE.Vector3(...a);
const UP = new THREE.Vector3(0, 1, 0);
const HEAD = [0, .20, 1.04];

export function createLadybugModel(density = 1) {
  const data = {position: [], normal: [], aKind: [], aPart: [], aAnchor: [], aShell: []};
  const components = [];
  function append(g, kind=0, part=0, anchor=[0,0,0], shell=0, label='hardware') {
    const flat = g.index ? g.toNonIndexed() : g;
    const p=flat.attributes.position, n=flat.attributes.normal;
    const start=data.position.length/3;
    for(let i=0;i<p.count;i++) {
      data.position.push(p.getX(i),p.getY(i),p.getZ(i));
      data.normal.push(n.getX(i),n.getY(i),n.getZ(i));
      data.aKind.push(kind);data.aPart.push(part);data.aAnchor.push(...anchor);data.aShell.push(shell);
    }
    components.push({label,vertices:p.count,start});
    if(flat!==g)flat.dispose();g.dispose();
  }
  function ellipsoid(center,scale,kind=.15,part=0,anchor=[0,0,0],shell=0,label='housing') {
    const major=Math.max(...scale)>.50;
    const g=new THREE.SphereGeometry(1,major?56:32,major?36:24);
    g.scale(...scale);g.translate(...center);append(g,kind,part,anchor,shell,label);
  }
  function segment(a,b,r1,r2,kind=.15,part=0,anchor=[0,0,0],label='beveled actuator') {
    const A=V(a),B=V(b),length=A.distanceTo(B);
    // Rounded shoulders and inset end faces, rather than blunt cylinder ends.
    const bevel=Math.min(.045,length*.12);
    const profile=[[0,0],[r1*.76,0],[r1*.94,bevel*.3],[r1,bevel],[r1, length*.30],
      [r2,length-bevel],[r2*.94,length-bevel*.3],[r2*.76,length],[0,length]];
    const g=new THREE.LatheGeometry(profile.map(([r,y])=>new THREE.Vector2(r,y)),40);
    g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(UP,B.clone().sub(A).normalize()));
    g.translate(...a);append(g,kind,part,anchor,0,label);
  }
  function path(points,radius,kind=.15,part=0,anchor=[0,0,0],label='edge trim') {
    const curve=new THREE.CatmullRomCurve3(points.map(V));
    append(new THREE.TubeGeometry(curve,Math.max(24,points.length*3),radius,10,false),kind,part,anchor,0,label);
  }
  function ring(center,normal,radius,tube,kind=.15,part=0,anchor=[0,0,0],label='joint bearing') {
    const g=new THREE.TorusGeometry(radius,tube,12,40);
    g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,0,1),V(normal).normalize()));
    g.translate(...center);append(g,kind,part,anchor,0,label);
  }
  function fastener(center,normal,radius=.038,part=0,anchor=[0,0,0]) {
    const c=V(center),n=V(normal).normalize(),outer=c.clone().addScaledVector(n,.025);
    segment(c.toArray(),outer.toArray(),radius,radius*.94,.15,part,anchor,'fastener');
    const tangent=new THREE.Vector3(0,1,0).cross(n).normalize();
    if(tangent.lengthSq()<.01)tangent.set(1,0,0);
    const tip=outer.addScaledVector(n,.002);
    segment(tip.clone().addScaledVector(tangent,-radius*.60).toArray(),tip.clone().addScaledVector(tangent,radius*.60).toArray(),.006,.006,1,part,anchor,'screw slot');
  }
  function shellPoint(side,t,a,inner=false) {
    const profile=Math.sqrt(Math.max(0,1-t*t));
    return new THREE.Vector3(side*(.021+1.28*profile*(1-.12*Math.max(t,0))*Math.sin(a)),
      .32-.10*Math.max(t,0)+1.00*profile*Math.pow(Math.max(0,Math.cos(a)),.88)-(inner?.038:0),-.40+1.62*t);
  }
  for(const side of [-1,1]) {
    // Each elytron is its own smooth, thin-walled machined panel.
    // The front is cut away around the pronotum; the center has a real gap.
    for(const inner of [false,true]) {
      const p=[],n=[],indices=[],rows=112,cols=72;
      for(let i=0;i<=rows;i++)for(let j=0;j<=cols;j++) {
        const t=-.999+i/rows*1.719,a=j/cols*Math.PI/2;
        const point=shellPoint(side,t,a,inner);
        const dt=shellPoint(side,Math.min(.721,t+.0002),a).sub(shellPoint(side,Math.max(-.9999,t-.0002),a));
        const da=shellPoint(side,t,Math.min(Math.PI/2,a+.0002)).sub(shellPoint(side,t,Math.max(0,a-.0002)));
        const normal=dt.cross(da).normalize().multiplyScalar(side*(inner?-1:1));
        p.push(...point.toArray());n.push(...normal.toArray());
      }
      for(let i=0;i<rows;i++)for(let j=0;j<cols;j++) {
        const a=i*(cols+1)+j,b=a+cols+1;
        if(side*(inner?-1:1)>0)indices.push(a,b,a+1,b,b+1,a+1);
        else indices.push(a,a+1,b,b,a+1,b+1);
      }
      const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(p,3));g.setAttribute('normal',new THREE.Float32BufferAttribute(n,3));g.setIndex(indices);
      append(g,inner?.65:0,0,[0,0,0],inner?0:1,inner?'elytron inner wall':'sculpted elytron');
    }
    const edges=[[],[],[]];
    for(let i=0;i<=60;i++)edges[0].push(shellPoint(side,-.999+i/60*1.719,Math.PI/2).toArray());
    for(let i=0;i<=38;i++)edges[1].push(shellPoint(side,.72,Math.PI/2*(1-i/38)).toArray());
    for(let i=0;i<=60;i++)edges[2].push(shellPoint(side,.72-i/60*1.719,0).toArray());
    // Separate continuous edge paths avoid spline overshoot at the front corners.
    for(const edge of edges){
      path(edge,.020,.15,0,[0,0,0],'rolled shell rim');
      path(edge.map(p=>[p[0],p[1]-.035,p[2]]),.022,1,0,[0,0,0],'shell gasket');
    }
  }
  // Lower chassis and overlapping abdominal plates.
  ellipsoid([0,.04,-.35],[1.13,.32,1.37],.65,0,[0,0,0],0,'abdominal chassis');
  for(let i=0;i<6;i++) {
    const z=-1.47+i*.36,t=(z+.35)/1.37,w=1.13*Math.sqrt(1-t*t);
    const pts=[];for(let j=0;j<=54;j++){const a=j/54*Math.PI*2;pts.push([w*Math.cos(a),.04+.32*Math.sqrt(1-t*t)*Math.sin(a),z]);}
    path(pts,.018,i%2===0?.15:1,0,[0,0,0],'abdominal segmentation');
  }
  // Broad shoulder shield and a small, tapered face; no stacked round body balls.
  ellipsoid([0,.36,.91],[.88,.54,.62],1,1,HEAD,2,'pronotum shield');
  const neckTrim=[];for(let i=0;i<=64;i++){const a=i/64*Math.PI;neckTrim.push([.84*Math.cos(a),.34+.48*Math.sin(a),1.15]);}
  path(neckTrim,.018,.15,1,HEAD,'pronotum perimeter');
  ellipsoid([0,.22,1.53],[.47,.32,.37],.65,1,HEAD,0,'head capsule');
  ellipsoid([0,.11,1.77],[.31,.18,.15],1,1,HEAD,0,'clypeus faceplate');
  for(const side of [-1,1]) {
    ellipsoid([side*.37,.30,1.67],[.135,.17,.15],3,1,HEAD,0,'compound optical eye');
    ring([side*.389,.31,1.68],[side*.75,.14,.8],.135,.019,.15,1,HEAD,'eye socket');
    fastener([side*.32,.50,1.56],[side*.5,.8,.4],.027,1,HEAD);
    // Short feelers: individually tapered segments with tiny collar joints.
    const ant=[[side*.30,.15,1.80],[side*.47,.10,2.02],[side*.70,.12,2.18],[side*.84,.17,2.25]];
    for(let i=0;i<3;i++) {
      segment(ant[i],ant[i+1],.025-i*.004,.022-i*.004,.15,1,HEAD,'antenna segment');
      ellipsoid(ant[i],[.030,.027,.030],1,1,HEAD,0,'antenna joint');
    }
    ellipsoid(ant[3],[.062,.030,.036],.65,1,HEAD,0,'sensory club');
    path([[side*.15,.025,1.81],[side*.21,-.045,1.93],[side*.19,-.13,1.98],[side*.09,-.16,1.99]],.031,.15,1,HEAD,'mandible');
    // Six coxa/femur/tibia/tarsus chains with rounded mechanical housings.
    const layouts=[[[.70,.12,.83],[1.23,.00,1.21],[1.48,-.79,1.73],[1.87,-.87,1.95]],[[.98,.08,.04],[1.59,-.04,.12],[1.89,-.80,.22],[2.34,-.88,.42]],[[.80,.07,-.84],[1.30,-.04,-1.12],[1.55,-.80,-1.77],[1.98,-.88,-2.04]]];
    layouts.forEach((layout,i)=>{
      const p=layout.map(a=>[a[0]*side,a[1],a[2]]),part=2+i+(side===1?3:0),anchor=p[0];
      ellipsoid(p[0],[.19,.17,.19],1,part,anchor,0,'coxa socket');
      segment(p[0],p[1],.133,.112,.15,part,anchor,'femur actuator');
      ellipsoid(p[1],[.145,.145,.145],.15,part,anchor,0,'knee bearing');
      ring(p[1],[side,0,.1],.145,.023,1,part,anchor,'knee gasket');
      const knee=V(p[1]),ankle=V(p[2]),axis=ankle.clone().sub(knee).normalize();
      segment(knee.clone().addScaledVector(axis,.11).toArray(),ankle.clone().addScaledVector(axis,-.13).toArray(),.117,.075,.15,part,anchor,'tapered tibia housing');
      // Piston collars and a visible dark inset at each end of the polished housing.
      for(const t of [.16,.76]) {
        const c=knee.clone().lerp(ankle,t);
        segment(c.clone().addScaledVector(axis,-.024).toArray(),c.clone().addScaledVector(axis,.024).toArray(),t<.5?.124:.09,t<.5?.124:.09,1,part,anchor,'actuator seal');
      }
      const pistonOffset=new THREE.Vector3(side*.085,0,-.060);
      segment(knee.clone().lerp(ankle,.18).add(pistonOffset).toArray(),knee.clone().lerp(ankle,.85).add(pistonOffset).toArray(),.022,.022,.15,part,anchor,'exposed piston rod');
      ellipsoid(p[2],[.09,.09,.09],.15,part,anchor,0,'ankle joint');
      fastener(V(p[1]).add(new THREE.Vector3(side*.143,0,0)).toArray(),[side,0,0],.042,part,anchor);
      const foot=V(p[2]),end=V(p[3]);
      for(let j=0;j<3;j++) {
        const a=foot.clone().lerp(end,j/3),b=foot.clone().lerp(end,(j+1)/3);
        segment(a.toArray(),b.toArray(),.048-j*.010,.044-j*.010,.15,part,anchor,'tarsal segment');
        ellipsoid(b.toArray(),[.042-j*.008,.036-j*.006,.042-j*.008],1,part,anchor,0,'tarsal hinge');
      }
      for(const fork of [-1,1])path([p[3],[p[3][0]+side*.10,p[3][1]+.035,p[3][2]+fork*.045],[p[3][0]+side*.14,p[3][1]-.006,p[3][2]+fork*.095]],.014,.15,part,anchor,'paired claw');
    });
  }
  const solid=new THREE.BufferGeometry();
  for(const [name,array] of Object.entries(data))solid.setAttribute(name,new THREE.Float32BufferAttribute(array,['position','normal','aAnchor'].includes(name)?3:1));
  solid.computeBoundingSphere();solid.computeBoundingBox();
  const particles=sampleSurface(solid,Math.round(185000*density));
  return {solid,particles,components};
}

function sampleSurface(surface,count) {
  let seed=92;const rand=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  const attrs=surface.attributes,p=attrs.position,triangles=p.count/3,areas=new Float64Array(triangles);
  const a=new THREE.Vector3(),b=new THREE.Vector3(),c=new THREE.Vector3();let total=0;
  for(let i=0;i<triangles;i++) {
    a.fromBufferAttribute(p,i*3);b.fromBufferAttribute(p,i*3+1);c.fromBufferAttribute(p,i*3+2);
    total+=b.sub(a).cross(c.sub(a)).length()*.5;areas[i]=total;
  }
  const output={};for(const [key,attr]of Object.entries(attrs))output[key]=new Float32Array(count*attr.itemSize);
  output.aSeed=new Float32Array(count);output.aTarget=new Float32Array(count*3);
  for(let i=0;i<count;i++) {
    const area=rand()*total;let lo=0,hi=triangles-1;
    while(lo<hi){const mid=(lo+hi)>>1;if(areas[mid]<area)lo=mid+1;else hi=mid;}
    const index=lo*3,r=Math.sqrt(rand()),s=rand(),weights=[1-r,r*(1-s),r*s];
    for(const [key,attr]of Object.entries(attrs))for(let j=0;j<attr.itemSize;j++) {
      output[key][i*attr.itemSize+j]=weights[0]*attr.array[index*attr.itemSize+j]+weights[1]*attr.array[(index+1)*attr.itemSize+j]+weights[2]*attr.array[(index+2)*attr.itemSize+j];
    }
    output.aSeed[i]=rand();const theta=rand()*Math.PI*2,y=rand()*2-1,radial=Math.sqrt(1-y*y),reach=6+rand()*13;
    output.aTarget.set([Math.cos(theta)*radial*reach,y*reach*.72,Math.sin(theta)*radial*reach*.7],i*3);
  }
  const g=new THREE.BufferGeometry();for(const [key,array]of Object.entries(output))g.setAttribute(key,new THREE.BufferAttribute(array,attrs[key]?.itemSize??(key==='aSeed'?1:3)));
  g.computeBoundingSphere();return g;
}

const articulationGLSL=/* glsl */`
  mat3 rotateY(float a){float c=cos(a),s=sin(a);return mat3(c,0.,-s,0.,1.,0.,s,0.,c);}
  mat3 rotateZ(float a){float c=cos(a),s=sin(a);return mat3(c,s,0.,-s,c,0.,0.,0.,1.);}
  mat3 articulation(float part,float t,float motion){
    if(part>.5 && part<1.5)return rotateY(sin(t*.75)*.020*motion);
    if(part>1.5){float wave=sin(t*1.15+part*2.1)*sin(t*.34+part);return rotateZ(wave*.016*motion)*rotateY(sin(t*.7+part)*.012*motion);}
    return mat3(1.);
  }
`;
const markingsGLSL=/* glsl */`
  float shellSpots(vec3 p){
    // Rounded black inlays follow each individual wing cover.
    vec2 q=vec2(abs(p.x),p.z);
    float d=length((q-vec2(.65,.20))/vec2(.205,.245));
    d=min(d,length((q-vec2(.88,-.63))/vec2(.19,.27)));
    d=min(d,length((q-vec2(.47,-1.36))/vec2(.18,.19)));
    d=min(d,length((vec2(p.x,p.z)-vec2(0.,.59))/vec2(.23,.18)));
    return (1.-smoothstep(.98,1.02,d))*smoothstep(.44,.54,p.y);
  }
  vec3 surfaceColor(float kind,float shell,vec3 p){
    vec3 color=vec3(.69,.73,.79);
    if(kind>.5)color=vec3(.065,.077,.098);
    if(kind>.9)color=vec3(.009,.012,.017);
    if(kind>1.5)color=vec3(.82,.81,.73);
    if(kind>2.5)color=vec3(.015,.027,.039);
    if(shell>.5 && shell<1.5)color=mix(color,vec3(.006,.008,.012),shellSpots(p));
    if(shell>1.5){
      float shoulderMask=smoothstep(.34,.47,abs(p.x))*(1.-smoothstep(.73,.83,abs(p.x)))*smoothstep(.87,1.04,p.z);
      color=mix(color,vec3(.74,.76,.71),shoulderMask);
    }
    return color;
  }
`;

// Apply only to the insect, after its physically based shading and color conversion.
// Opaque black ink preserves its silhouette; white dot density preserves depth.
export const bitmapGLSL=/* glsl */`
  float bitmapInk(float shade){
    vec2 pixel=gl_FragCoord.xy/max(uPixelRatio,1.);
    vec2 cell=fract(pixel/uDotSize)-.5;
    float radius=sqrt(clamp(shade,0.,1.))*.69;
    float aa=.45/(uDotSize*max(uPixelRatio,1.));
    return 1.-smoothstep(radius-aa,radius+aa,length(cell));
  }
`;

export function createChromeMaterial(uniforms) {
  const material=new THREE.MeshPhysicalMaterial({color:0xffffff,metalness:1,roughness:.15,clearcoat:.85,clearcoatRoughness:.09,envMapIntensity:1.2,flatShading:false});
  material.onBeforeCompile=shader=>{
    Object.assign(shader.uniforms,{uTime:uniforms.uTime,uMotion:uniforms.uMotion,uBurst:uniforms.uBurst,uPixelRatio:uniforms.uPixelRatio,uDotSize:uniforms.uDotSize});
    shader.vertexShader=`uniform float uTime,uMotion;attribute float aPart,aKind,aShell;attribute vec3 aAnchor;varying vec3 vRest;varying float vKind,vShell;\n${articulationGLSL}\n`+shader.vertexShader;
    shader.vertexShader=shader.vertexShader.replace('#include <beginnormal_vertex>',`#include <beginnormal_vertex>\nmat3 joint=articulation(aPart,uTime,uMotion);objectNormal=joint*objectNormal;`);
    shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>\ntransformed=aAnchor+joint*(position-aAnchor);transformed.y+=sin(uTime*.8)*.006*uMotion;vRest=position;vKind=aKind;vShell=aShell;`);
    shader.fragmentShader=`uniform float uBurst,uPixelRatio,uDotSize;varying vec3 vRest;varying float vKind,vShell;\n${markingsGLSL}\n${bitmapGLSL}\n`+shader.fragmentShader;
    shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
      float erosion=smoothstep(.025,.24,uBurst);
      float grain=fract(sin(dot(floor(vRest*160.),vec3(12.9898,78.233,39.425)))*43758.5453);
      if(erosion>=1. || grain<erosion)discard;
      diffuseColor.rgb=surfaceColor(vKind,vShell,vRest);
    `);
    shader.fragmentShader=shader.fragmentShader.replace('#include <roughnessmap_fragment>',`#include <roughnessmap_fragment>
      roughnessFactor=vKind>.5?.26:.14;
      if(vKind>2.5)roughnessFactor=.12;
      if(vShell>.5 && vShell<1.5)roughnessFactor=mix(.135,.24,shellSpots(vRest));
    `);
    shader.fragmentShader=shader.fragmentShader.replace('#include <metalnessmap_fragment>',`#include <metalnessmap_fragment>
      metalnessFactor=vKind>.5?.78:1.;
      if(vKind>2.5)metalnessFactor=.28;
      if(vShell>1.5)metalnessFactor=.65;
    `);
    // Very fine optical sensor cells, visible only in highlights close to the head.
    shader.fragmentShader=shader.fragmentShader.replace('#include <normal_fragment_maps>',`#include <normal_fragment_maps>
      if(vKind>2.5){float cell=sin(vRest.y*330.)*sin(vRest.z*330.);normal=normalize(normal+vec3(cell*.018,cell*.013,0.));}
    `);
    shader.fragmentShader=shader.fragmentShader.replace('#include <dithering_fragment>',`
      float grey=dot(gl_FragColor.rgb,vec3(.2126,.7152,.0722));
      float contour=pow(1.-abs(dot(normalize(normal),normalize(vViewPosition))),4.);
      float silverSurface=1.-step(.5,vKind);
      if(vShell>.5 && vShell<1.5){
        float spotMask=shellSpots(vRest);
        silverSurface*=1.-spotMask;
        grey=max(grey,(1.-abs(spotMask*2.-1.))*.88);
      }
      grey=max(grey,.13*silverSurface);
      grey=max(grey,contour*.86);
      float ink=bitmapInk(pow(clamp(grey*1.08,0.,1.),2.6));
      gl_FragColor.rgb=mix(vec3(.009),vec3(.965),ink);
    `);
  };
  material.customProgramCacheKey=()=> 'bugged-out-bitmap-webgl-v4';
  return material;
}

export function createStudioEnvironment(renderer) {
  const room=new THREE.Scene();room.background=new THREE.Color(.10,.115,.14);
  // These panels appear only in reflections, not in the hero background.
  const box=new THREE.Mesh(new THREE.BoxGeometry(24,18,24),new THREE.MeshBasicMaterial({color:new THREE.Color(.13,.145,.17),side:THREE.BackSide}));room.add(box);
  function panel(position,size,color,intensity){
    const m=new THREE.MeshBasicMaterial({color:new THREE.Color(color).multiplyScalar(intensity),side:THREE.DoubleSide});
    const p=new THREE.Mesh(new THREE.PlaneGeometry(...size),m);p.position.set(...position);p.lookAt(0,0,0);room.add(p);
  }
  panel([-4,6,5],[7,4],0xffffff,5);
  panel([6,3,1],[2.1,7],0xe8efff,3.5);
  panel([-6,1,-3],[1.2,6],0xb9c5ff,2.0);
  panel([0,8,-4],[7,3],0xffffff,3.4);
  panel([0,1,9],[5,1.0],0xffffff,1.8);
  panel([2,-6,2],[8,5],0xffffff,.55);
  const pmrem=new THREE.PMREMGenerator(renderer);const target=pmrem.fromScene(room,.015,.1,40);
  room.traverse(o=>{if(o.isMesh){o.geometry.dispose();o.material.dispose();}});pmrem.dispose();return target;
}

export const vertexShader=/* glsl */`
  uniform float uTime,uBurst,uPixelRatio,uPointScale,uMotion;
  attribute float aKind,aPart,aSeed,aShell;attribute vec3 aAnchor,aTarget;
  varying vec3 vNormal,vPosition,vRest;varying float vKind,vSeed,vScatter,vShell;
  ${articulationGLSL}
  void main(){
    mat3 joint=articulation(aPart,uTime,uMotion);vec3 p=aAnchor+joint*(position-aAnchor);
    p.y+=sin(uTime*.8)*.006*uMotion;
    float b=smoothstep(aSeed*.19,.79+aSeed*.21,uBurst);
    vec3 swirl=vec3(sin(b*5.+position.z*2.+aSeed*6.),cos(b*4.+position.x*2.),sin(b*4.+position.y*3.));
    p+=aTarget*b+swirl*sin(b*3.14159265)*1.25;
    vec4 mv=modelViewMatrix*vec4(p,1.);vPosition=mv.xyz;vNormal=normalize(normalMatrix*joint*normal);
    vKind=aKind;vSeed=aSeed;vScatter=b;vRest=position;vShell=aShell;
    gl_Position=projectionMatrix*mv;gl_PointSize=clamp(uPointScale*uPixelRatio*(.78+aSeed*.43)*(10./max(1.,-mv.z))*(1.-b*.24),1.,7.*uPixelRatio);
  }
`;
export const fragmentShader=/* glsl */`
  uniform float uBurst;varying vec3 vNormal,vPosition,vRest;varying float vKind,vSeed,vScatter,vShell;
  ${markingsGLSL}
  vec3 studio(vec3 r){
    vec3 c=vec3(.15,.17,.21);
    c+=vec3(.94,.98,1.05)*pow(max(0.,dot(r,normalize(vec3(-.4,1.,.4)))),5.)*2.4;
    c+=vec3(1.,.97,.92)*pow(max(0.,dot(r,normalize(vec3(.7,.3,1.)))),35.)*3.;
    c+=vec3(.42,.45,.72)*pow(max(0.,dot(r,normalize(vec3(-1.,.15,.2)))),14.);
    return c;
  }
  void main(){
    vec2 uv=gl_PointCoord*2.-1.;float radius=dot(uv,uv);if(radius>1.)discard;
    vec3 bead=vec3(uv.x,-uv.y,sqrt(max(0.,1.-radius))),N=normalize(vNormal+bead*.09),V=normalize(-vPosition);
    vec3 color=studio(reflect(-V,N))*surfaceColor(vKind,vShell,vRest);
    color+=vec3(.22,.24,.30)*pow(1.-max(dot(N,V),0.),3.);
    color*=.84+vSeed*.3;color=mix(color,max(color,vec3(.22,.23,.28)),vScatter*.7);
    float alpha=(1.-smoothstep(.70,1.,radius))*smoothstep(.02,.12,uBurst);if(alpha<.01)discard;
    gl_FragColor=vec4(color,alpha);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
    float grey=dot(gl_FragColor.rgb,vec3(.2126,.7152,.0722));
    gl_FragColor.rgb=vec3(clamp(pow(grey,.8)*1.12,.28,.98));
  }
`;

// Shadow geometry follows the exact same joints and dissolve as the visible shell.
export function createDepthMaterial(uniforms){
  const material=new THREE.MeshDepthMaterial({depthPacking:THREE.RGBADepthPacking});
  material.onBeforeCompile=shader=>{
    Object.assign(shader.uniforms,{uTime:uniforms.uTime,uMotion:uniforms.uMotion,uBurst:uniforms.uBurst});
    shader.vertexShader=`uniform float uTime,uMotion;attribute float aPart;attribute vec3 aAnchor;varying vec3 vRest;\n${articulationGLSL}\n`+shader.vertexShader;
    shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>\nmat3 joint=articulation(aPart,uTime,uMotion);transformed=aAnchor+joint*(position-aAnchor);transformed.y+=sin(uTime*.8)*.006*uMotion;vRest=position;`);
    shader.fragmentShader='uniform float uBurst;varying vec3 vRest;\n'+shader.fragmentShader;
    shader.fragmentShader=shader.fragmentShader.replace('#include <alphatest_fragment>',`#include <alphatest_fragment>\nfloat erosion=smoothstep(.025,.24,uBurst);float grain=fract(sin(dot(floor(vRest*160.),vec3(12.9898,78.233,39.425)))*43758.5453);if(erosion>=1. || grain<erosion)discard;`);
  };
  material.customProgramCacheKey=()=> 'bugged-out-depth-v3';return material;
}
