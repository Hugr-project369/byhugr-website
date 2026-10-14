// HUGR Halo V3. Local real-time 3D; every orbit and reflection is authored here.
import * as THREE from './vendor/three.module.js';
import { EffectComposer } from './vendor/addons/postprocessing/EffectComposer.js';
import { RenderPass } from './vendor/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from './vendor/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from './vendor/addons/postprocessing/OutputPass.js';
import { ShaderPass } from './vendor/addons/postprocessing/ShaderPass.js';

const TAU=Math.PI*2,R=2.25,EDGE=2.285;
const clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,x));
const seed=n=>{const x=Math.sin(n*127.1+311.7)*43758.5453;return x-Math.floor(x);};
const angleDiff=(a,b)=>Math.atan2(Math.sin(a-b),Math.cos(a-b));
const quadratic=(a,b,c,t)=>new THREE.Vector3().copy(a).multiplyScalar((1-t)**2).addScaledVector(b,2*t*(1-t)).addScaledVector(c,t*t);
const vertexRibbon=`varying vec2 vUv; void main(){vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`;
const fragmentRibbon=`uniform vec3 tint;uniform float opacity;varying vec2 vUv;void main(){float edge=pow(max(0.,1.-abs(vUv.y*2.-1.)),1.5);float tail=pow(vUv.x,1.6);gl_FragColor=vec4(tint,edge*tail*opacity);}`;

export function createSpace({host,canvas,measure,onFrame=()=>{},onReady=()=>{},onHolding=()=>{},onContext=()=>{}}={}) {
 let renderer;
 try{renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:false,powerPreference:'high-performance'});}catch{return null;}
 // Software WebGL is technically available but cannot sustain this light field.
 const gl=renderer.getContext(),debug=gl.getExtension('WEBGL_debug_renderer_info');
 const device=debug?String(gl.getParameter(debug.UNMASKED_RENDERER_WEBGL)):'';
 if(/SwiftShader|llvmpipe|softpipe|Software Rasterizer/i.test(device)){renderer.dispose();return null;}
 renderer.setClearColor('#000000');renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.12;
 const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(39,1,.1,90),universe=new THREE.Group();scene.add(universe);
 const composer=new EffectComposer(renderer);composer.addPass(new RenderPass(scene,camera));
 const bloom=new UnrealBloomPass(new THREE.Vector2(1,1),.62,.55,1.05);composer.addPass(bloom);composer.addPass(new OutputPass());
 // Applied after bloom: external light cannot bleed into the protected centre.
 const mask=new ShaderPass({uniforms:{tDiffuse:{value:null},cameraLocal:{value:new THREE.Vector3()},inverseRotation:{value:new THREE.Matrix3()},aspect:{value:1},tanHalfFov:{value:Math.tan(39*Math.PI/360)},radius:{value:R}},vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',fragmentShader:`uniform sampler2D tDiffuse;uniform vec3 cameraLocal;uniform mat3 inverseRotation;uniform float aspect,tanHalfFov,radius;varying vec2 vUv;void main(){vec2 ndc=vUv*2.-1.;vec3 ray=inverseRotation*vec3(ndc.x*aspect*tanHalfFov,ndc.y*tanHalfFov,-1.);float safeZ=abs(ray.z)<.00001?-.00001:ray.z;float t=-cameraLocal.z/safeZ;vec3 hit=cameraLocal+ray*t;float r=length(hit.xy);float outside=t>0.?smoothstep(radius,radius+max(fwidth(r)*1.1,.002),r):1.;vec3 calm=vec3(3.,4.,7.)/255.;calm+=vec3(.012,.007,.001)*exp(-r*r*2.5);gl_FragColor=vec4(mix(calm,texture2D(tDiffuse,vUv).rgb+vec3(3.,4.,7.)/255.,outside),1.);}`});composer.addPass(mask);
 let width=1,height=1,radius=1,cx=0,cy=0,mobile=false,dpr=1,time=0,previous=0,frameId=0,paused=false,reduced=false,active=true,holding=false,speed=1;
 let serial=0,comets=[],waves=[],sparks=[],nextComet=1.3,nextHeartbeat=1.15,ringRotation=0,ring,dashCount=0,contextLost=false;
 const pointer={x:0,y:0,tx:0,ty:0,amount:0,target:0};
 const dummy=new THREE.Object3D(),inverse=new THREE.Matrix4(),raycaster=new THREE.Raycaster();
 const origin=new THREE.Vector3(),ray=new THREE.Vector3();
 const glowTexture=makeGlow(),spikeTexture=makeSpike();

 function makeGlow(){const c=document.createElement('canvas');c.width=c.height=128;const g=c.getContext('2d'),r=g.createRadialGradient(64,64,0,64,64,64);r.addColorStop(0,'rgba(255,255,255,1)');r.addColorStop(.055,'rgba(255,255,255,.85)');r.addColorStop(.18,'rgba(255,255,255,.18)');r.addColorStop(.42,'rgba(255,255,255,.025)');r.addColorStop(1,'rgba(255,255,255,0)');g.fillStyle=r;g.fillRect(0,0,128,128);return new THREE.CanvasTexture(c);}
 function makeSpike(){const c=document.createElement('canvas');c.width=c.height=128;const g=c.getContext('2d');for(let i=0;i<2;i++){g.save();g.translate(64,64);g.rotate(i*Math.PI/2);const r=g.createLinearGradient(-64,0,64,0);r.addColorStop(0,'#ffffff00');r.addColorStop(.49,'#ffffff55');r.addColorStop(.5,'#ffffffff');r.addColorStop(.51,'#ffffff55');r.addColorStop(1,'#ffffff00');g.fillStyle=r;g.fillRect(-64,-.65,128,1.3);g.restore();}return new THREE.CanvasTexture(c);}
 function sprite(color,scale,opacity=1,texture=glowTexture){const s=new THREE.Sprite(new THREE.SpriteMaterial({map:texture,color,opacity,transparent:true,blending:THREE.AdditiveBlending,depthWrite:false,depthTest:false,toneMapped:true}));s.scale.setScalar(scale);universe.add(s);return s;}
 function disposeObject(object){object.removeFromParent();if(!object.isSprite)object.geometry?.dispose();object.material?.dispose();}
 function buildRing(){
  if(ring)disposeObject(ring);
  dashCount=Math.max(76,Math.round(TAU*radius/8.5));
  const geo=new THREE.CapsuleGeometry(Math.max(.0085,.75*R/radius),Math.max(.023,1.1*R/radius),3,6),glows=new Float32Array(dashCount);
  geo.setAttribute('aGlow',new THREE.InstancedBufferAttribute(glows,1));
  const material=new THREE.ShaderMaterial({vertexShader:`attribute float aGlow;varying float vGlow;varying vec3 vNormal;varying vec3 vEye;void main(){vGlow=aGlow;vec4 p=modelViewMatrix*instanceMatrix*vec4(position,1.);vEye=normalize(-p.xyz);vNormal=normalize(normalMatrix*mat3(instanceMatrix)*normal);gl_Position=projectionMatrix*p;}`,fragmentShader:`varying float vGlow;varying vec3 vNormal;varying vec3 vEye;void main(){vec3 n=normalize(vNormal);float light=.6+.4*max(0.,dot(n,normalize(vec3(-.3,.7,1.))));float spec=pow(max(0.,dot(reflect(normalize(vec3(.4,-.5,-1.)),n),vEye)),18.);vec3 gold=vec3(.72,.36,.1)*light;gold+=vec3(.9,.79,.48)*spec*.35;gold+=vec3(2.1,1.35,.43)*vGlow;gl_FragColor=vec4(gold,1.);}`});
  ring=new THREE.InstancedMesh(geo,material,dashCount);ring.instanceMatrix.setUsage(THREE.DynamicDrawUsage);ring.frustumCulled=false;universe.add(ring);
 }
 const waveLights=Array.from({length:16},()=>sprite(new THREE.Color(2.3,1.27,.41),.54,0));
 // Thousands of depth-separated motes, with a restrained cool undertone.
 const count=1500,positions=new Float32Array(count*3),colors=new Float32Array(count*3),sizes=new Float32Array(count),phases=new Float32Array(count);
 for(let i=0;i<count;i++){
  const a=seed(i+81)*TAU,r=R*(1.035+Math.pow(seed(i+410),1.55)*1.3);
  const cloud=i%3!==0;
  positions[i*3]=cloud?Math.cos(a)*r:(seed(i+115)*2-1)*12;
  positions[i*3+1]=cloud?Math.sin(a)*r:(seed(i+91)*2-1)*9;
  positions[i*3+2]=cloud?Math.sin(a*2+.3)*.7+(seed(i+212)-.5)*1.4:-3-seed(i+213)*9;
  const intensity=cloud?.25+seed(i+215)*.95:.2+seed(i+215)*.5;
  const cool=i%7===0;colors.set(cool?[intensity*.4,intensity*.64,intensity]:[intensity,intensity*.62,intensity*.25],i*3);
  sizes[i]=i%59===0?7+seed(i+111)*6:1+seed(i+17)*2;phases[i]=seed(i+616)*TAU;
 }
 const pointsGeo=new THREE.BufferGeometry();pointsGeo.setAttribute('position',new THREE.BufferAttribute(positions,3));pointsGeo.setAttribute('color',new THREE.BufferAttribute(colors,3));pointsGeo.setAttribute('size',new THREE.BufferAttribute(sizes,1));pointsGeo.setAttribute('phase',new THREE.BufferAttribute(phases,1));
 const pointsMaterial=new THREE.ShaderMaterial({uniforms:{clock:{value:0},pixelRatio:{value:1},cameraDistance:{value:10},mobile:{value:0}},vertexShader:`attribute vec3 color;attribute float size,phase;uniform float clock,pixelRatio,cameraDistance,mobile;varying vec3 vColor;varying float vSoft;void main(){vec3 p=position;float a=clock*.014;mat2 turn=mat2(cos(a),-sin(a),sin(a),cos(a));p.xy=turn*p.xy;p.z+=sin(clock*.13+phase)*.11;vec4 mv=modelViewMatrix*vec4(p,1.);float depth=cameraDistance/-mv.z;float twinkle=.68+.32*sin(phase+clock*.32);vColor=color*twinkle;vSoft=step(6.,size);gl_PointSize=clamp(size*pixelRatio*depth*mix(1.,.78,mobile),.8,22.);gl_Position=projectionMatrix*mv;}`,fragmentShader:`varying vec3 vColor;varying float vSoft;void main(){float d=length(gl_PointCoord-.5)*2.;if(d>1.)discard;float a=mix(pow(1.-d,1.6),exp(-d*d*6.)*.3,vSoft);gl_FragColor=vec4(vColor,a);}`,transparent:true,blending:THREE.AdditiveBlending,depthWrite:false});
 const points=new THREE.Points(pointsGeo,pointsMaterial);universe.add(points);
 // Open, layered ribbons describe the field in three dimensions without adding another boundary.
 const filaments=[];
 for(let group=0;group<3;group++)for(let j=0;j<19;j++){
  const data=new Float32Array(81*3),fade=Float32Array.from({length:81},(_,k)=>Math.sin(k/80*Math.PI)**1.5),geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.BufferAttribute(data,3));geo.setAttribute('fade',new THREE.BufferAttribute(fade,1));
  const mat=new THREE.ShaderMaterial({uniforms:{tint:{value:new THREE.Color(group===1?0x496186:0xb68a4b)},opacity:{value:.05+Math.sin(j/19*Math.PI)*.065}},vertexShader:'attribute float fade;varying float vFade;void main(){vFade=fade;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',fragmentShader:'uniform vec3 tint;uniform float opacity;varying float vFade;void main(){gl_FragColor=vec4(tint,vFade*opacity);}',transparent:true,blending:THREE.AdditiveBlending,depthWrite:false});
  const line=new THREE.Line(geo,mat);line.frustumCulled=false;universe.add(line);filaments.push({group,j,line,data});
 }
 const nebulae=[sprite(0x4c759d,11,.04),sprite(0xa56838,7,.055),sprite(0x715775,9,.035)];
 nebulae[0].position.set(-4,-2,-4);nebulae[1].position.set(4,2,-2);nebulae[2].position.set(1,4,-6);
 function createRibbon(color,width){const N=64,geo=new THREE.BufferGeometry(),pos=new Float32Array((N+1)*6),uv=new Float32Array((N+1)*4),indices=[];for(let j=0;j<=N;j++){uv.set([j/N,0,j/N,1],j*4);if(j<N){const k=j*2;indices.push(k,k+1,k+2,k+1,k+3,k+2);}}geo.setAttribute('position',new THREE.BufferAttribute(pos,3).setUsage(THREE.DynamicDrawUsage));geo.setAttribute('uv',new THREE.BufferAttribute(uv,2));geo.setIndex(indices);const mat=new THREE.ShaderMaterial({uniforms:{tint:{value:color},opacity:{value:1}},vertexShader:vertexRibbon,fragmentShader:fragmentRibbon,transparent:true,blending:THREE.AdditiveBlending,depthWrite:false,depthTest:false,side:THREE.DoubleSide});const mesh=new THREE.Mesh(geo,mat);mesh.frustumCulled=false;universe.add(mesh);return {mesh,pos,N,width};}
 function addComet({manual=false,x=0,y=0,initialAge=0}={}){
  if(manual&&comets.some(c=>c.manual))return false;
  const startDistance=Math.hypot(x,y);if(manual&&startDistance<EDGE*1.08)return false;
  const id=serial++,sign=id%2?1:-1;let a=manual?Math.atan2(y,x):id*2.39996323+.38;
  if(manual)a+=sign*Math.min(.15,Math.acos(clamp(EDGE/startDistance,-1,1))*.55);
  const n=new THREE.Vector3(Math.cos(a),Math.sin(a),0),tangent=new THREE.Vector3(-Math.sin(a),Math.cos(a),0),end=n.clone().multiplyScalar(EDGE);
  const beta=.32+seed(id+20)*.4,incoming=n.clone().multiplyScalar(-Math.cos(beta)).addScaledVector(tangent,sign*Math.sin(beta)),length=R*(1.7+seed(id+801)*1.25);
  const start=manual?new THREE.Vector3(x,y,0):end.clone().addScaledVector(incoming,-length),distance=start.distanceTo(end);
  const control=manual?start.clone().lerp(end,.5).addScaledVector(n,.12*distance):end.clone().addScaledVector(incoming,-length*.47).addScaledVector(n,.1*R);
  const velocity=end.clone().sub(control).normalize(),out=velocity.clone().addScaledVector(n,-2*velocity.dot(n)),hero=manual||id%3===0,weight=hero?1:.56,cool=id%5===2;
  const color=cool?new THREE.Color(1.2,2,3.1):new THREE.Color(3.2,1.75,.56);
  const c={id,manual,start,control,end,n,tangent,out,angle:a,sign,age:initialAge,hit:false,Tin:manual?clamp(distance/R*1.35,.7,3):4.6+seed(id+31)*1.4,Tout:5.8,travel:distance*(manual?1.5:1.1),depth:manual?0:(seed(id+97)*2-1)*2,weight,trail:hero?2.15:1.65,head:sprite(color,.7*weight),star:sprite(color,.76*weight,1,spikeTexture),ribbons:[createRibbon(color,.041*weight),createRibbon(new THREE.Color(.7,1.1,1.7),.009*weight)]};
  if(c.age>=c.Tin)c.hit=true;comets.push(c);return true;
 }
 function cometAt(c,age){if(age<c.Tin){const u=Math.pow(clamp(age/c.Tin),1.55),p=quadratic(c.start,c.control,c.end,u);p.z=c.depth*(1-u)**1.7;return p;}const u=1-Math.exp(-(age-c.Tin)*.57);return c.end.clone().addScaledVector(c.out,c.travel*u).addScaledVector(c.tangent,c.sign*u*u*.43*R).setZ(c.depth*.38*u);}
 function impact(c){waves.push({angle:c.angle,birth:time,power:c.weight,heartbeat:false});for(let i=0;i<12;i++){const a=c.angle+(seed(c.id*19+i)-.5)*1.45,s=sprite(new THREE.Color(2.7,1.7,.7),.06+seed(i+77)*.09,.8);sparks.push({sprite:s,start:c.end.clone(),direction:new THREE.Vector3(Math.cos(a),Math.sin(a),(seed(i+c.id)-.5)*.7),birth:time,life:.7+seed(i+c.id)*1.1,velocity:.25+seed(i+40)*.5});}}
 function ringLight(angle){let light=.07;const distance=angleDiff(angle,Math.atan2(pointer.y,pointer.x)),attention=Math.exp(-Math.pow((Math.hypot(pointer.x,pointer.y)-1)/.6,2));light+=Math.exp(-distance*distance/.065)*pointer.amount*attention*.65;for(const w of waves){const age=time-w.birth;if(age<0)continue;const d=Math.abs(angleDiff(angle,w.angle)),front=age*1.3;light+=Math.exp(-Math.pow((d-front)/.13,2))*Math.exp(-age*.85)*w.power*1.35;if(!w.heartbeat)light+=Math.exp(-d*d/.015)*Math.exp(-age*5)*w.power*.7;}return light;}
 function updateRing(){ringRotation=time*.052;const glow=ring.geometry.attributes.aGlow;for(let i=0;i<dashCount;i++){const a=i/dashCount*TAU+ringRotation;dummy.position.set(Math.cos(a)*EDGE,Math.sin(a)*EDGE,0);dummy.rotation.set(0,0,a);dummy.updateMatrix();ring.setMatrixAt(i,dummy.matrix);glow.array[i]=ringLight(a);}ring.instanceMatrix.needsUpdate=true;glow.needsUpdate=true;
  let k=0;for(const w of waves){const age=time-w.birth;if(age<0||age>2.5)continue;for(const sign of [-1,1]){if(k>=waveLights.length)break;const a=w.angle+sign*age*1.3,s=waveLights[k++];s.position.set(Math.cos(a)*(EDGE+.03),Math.sin(a)*(EDGE+.03),.025);s.material.opacity=Math.exp(-age*1.25)*w.power*.6;s.scale.setScalar(.4+age*.16);}}for(;k<waveLights.length;k++)waveLights[k].material.opacity=0;
 }
 function updateComets(){for(const c of comets){const head=cometAt(c,c.age),fade=Math.min(c.manual?1:clamp(c.age*1.5),clamp((c.Tin+c.Tout-c.age)/1.5));c.head.position.copy(head);c.star.position.copy(head);c.head.material.opacity=fade;c.star.material.opacity=fade*.85;c.star.material.rotation=time*.025+c.id;
   for(let q=0;q<c.ribbons.length;q++){const ribbon=c.ribbons[q];for(let j=0;j<=ribbon.N;j++){const f=j/ribbon.N,age=Math.max(0,c.age-(1-f)*c.trail),p=cometAt(c,age),next=cometAt(c,age+.007),tangent=next.sub(p).normalize(),normal=new THREE.Vector3(-tangent.y,tangent.x,0).normalize();if(q===1)p.addScaledVector(normal,Math.sin(f*8+time*.65+c.id)*.013+.022).z+=.006;const w=ribbon.width*(.04+.96*f**1.6);const left=p.clone().addScaledVector(normal,-w),right=p.clone().addScaledVector(normal,w);ribbon.pos.set([left.x,left.y,left.z,right.x,right.y,right.z],j*6);}ribbon.mesh.geometry.attributes.position.needsUpdate=true;ribbon.mesh.material.uniforms.opacity.value=fade*(q===0?.76:.5);}
  }
 }
 function updateFilaments(){for(const {group,j,line,data}of filaments){const lane=j/18;for(let k=0;k<=80;k++){const u=k/80,a=group*2.37+.4+(u-.5)*1.34+lane*.13+Math.sin(time*.045+group)*.12,r=R*(1.07+lane*lane*.29+Math.sin(u*Math.PI)**2*(.13+.03*Math.sin(lane*7+time*.16+group)));data[k*3]=Math.cos(a)*r;data[k*3+1]=Math.sin(a)*r;data[k*3+2]=Math.sin(u*Math.PI)*(.18+lane*.5)*Math.sin(a*1.3+time*.08);}line.geometry.attributes.position.needsUpdate=true;}}
 function updateMask(){universe.updateMatrixWorld(true);inverse.copy(universe.matrixWorld).invert();mask.uniforms.cameraLocal.value.copy(camera.position).applyMatrix4(inverse);mask.uniforms.inverseRotation.value.setFromMatrix4(inverse);mask.uniforms.aspect.value=camera.aspect;}
 function draw(){if(contextLost)return;onFrame(time);universe.rotation.set(.18+pointer.y*.045,-.14+pointer.x*.055,0);pointsMaterial.uniforms.clock.value=time;updateRing();updateFilaments();updateComets();for(const s of sparks){const age=time-s.birth;s.sprite.position.copy(s.start).addScaledVector(s.direction,s.velocity*age);s.sprite.material.opacity=(1-age/s.life)**2*.9;}updateMask();composer.render();}
 function advance(dt){const delta=dt*speed;time+=delta;for(const c of comets){c.age+=delta;if(!c.hit&&c.age>=c.Tin){c.hit=true;impact(c);}}comets=comets.filter(c=>{if(c.age<c.Tin+c.Tout)return true;disposeObject(c.head);disposeObject(c.star);c.ribbons.forEach(r=>disposeObject(r.mesh));return false;});sparks=sparks.filter(s=>{if(time-s.birth<s.life)return true;disposeObject(s.sprite);return false;});waves=waves.filter(w=>time-w.birth<4.3);if(time>=nextComet&&comets.filter(c=>!c.manual).length<6){addComet();nextComet=time+1.85;}if(time>=nextHeartbeat){waves.push({angle:-Math.PI/2,birth:time,power:.45,heartbeat:true},{angle:-Math.PI/2,birth:time+.34,power:.27,heartbeat:true});nextHeartbeat=time+7.2;}}
 function canRun(){return active&&!paused&&!reduced&&!document.hidden&&!contextLost;}
 function frame(now){frameId=0;if(!canRun())return;const dt=previous?Math.min((now-previous)/1000,.045):.016;previous=now;const ease=1-Math.exp(-dt*4.5);speed+=((holding?.12:1)-speed)*ease;pointer.x+=(pointer.tx-pointer.x)*ease;pointer.y+=(pointer.ty-pointer.y)*ease;pointer.amount+=(pointer.target-pointer.amount)*ease;advance(dt);draw();frameId=requestAnimationFrame(frame);}
 function sync(){cancelAnimationFrame(frameId);frameId=0;previous=0;if(canRun())frameId=requestAnimationFrame(frame);else draw();}
 function resize(){const box=host.getBoundingClientRect();width=box.width;height=box.height;mobile=width<=600;dpr=Math.min(devicePixelRatio||1,mobile?1.5:1.6);cx=width*.5;cy=height*(mobile?.43:.48);radius=Math.min(width*(mobile?.315:.225),height*(mobile?.195:.255),264);if(measure){const layout=measure();cx=layout.x;cy=layout.y;radius=layout.radius;}host.style.setProperty('--radius',`${radius}px`);const tan=Math.tan(camera.fov*Math.PI/360);camera.aspect=width/height;camera.position.set(0,0,R*height/(2*radius*tan));camera.updateProjectionMatrix();universe.position.y=(.5-cy/height)*2*camera.position.z*tan;universe.position.x=(cx/width-.5)*2*camera.position.z*tan*camera.aspect;renderer.setPixelRatio(dpr);renderer.setSize(width,height,false);composer.setPixelRatio(dpr);composer.setSize(width,height);pointsMaterial.uniforms.pixelRatio.value=dpr;pointsMaterial.uniforms.mobile.value=radius<150?1:0;pointsGeo.setDrawRange(0,radius<150?1100:count);pointsMaterial.uniforms.cameraDistance.value=camera.position.z;buildRing();draw();}
 function pointOnPlane(x,y){updateMask();raycaster.setFromCamera(new THREE.Vector2(x/width*2-1,1-y/height*2),camera);origin.copy(raycaster.ray.origin).applyMatrix4(inverse);ray.copy(raycaster.ray.direction).transformDirection(inverse);if(Math.abs(ray.z)<1e-5)return null;const t=-origin.z/ray.z;return t>0?origin.clone().addScaledVector(ray,t):null;}
 resize();for(let i=0;i<5;i++)addComet({initialAge:.75+i*1.75});draw();onReady();sync();
 const observer=new ResizeObserver(resize);observer.observe(host);
 document.addEventListener('visibilitychange',sync);
 canvas.addEventListener('webglcontextlost',event=>{event.preventDefault();contextLost=true;sync();host.dataset.context='lost';onContext(false);});
 canvas.addEventListener('webglcontextrestored',()=>{contextLost=false;delete host.dataset.context;resize();sync();onContext(true);});
 return {
  resize,
  pointer(x,y){pointer.tx=clamp((x-cx)/radius,-3,3);pointer.ty=clamp((cy-y)/radius,-3,3);pointer.target=1;if(!canRun()){pointer.x=pointer.tx;pointer.y=pointer.ty;pointer.amount=1;draw();}},
  leave(){pointer.target=0;pointer.tx=pointer.ty=0;if(!canRun()){pointer.x=pointer.y=pointer.amount=0;draw();}},
  hold(value){holding=value;onHolding(value);},
  release(x,y){if(!canRun())return false;const p=pointOnPlane(x,y);if(!p)return false;const created=addComet({manual:true,x:p.x,y:p.y});if(created)draw();return created;},
  setPaused(value){paused=value;sync();},setReduced(value){reduced=value;sync();},setActive(value){active=value;sync();},
  getState(){return {renderer:'webgl-3d',time,speed,holding,paused,reduced,active,contextLost,centre:{x:cx,y:cy,radius},meteor:comets.length,comets:comets.map(c=>({manual:c.manual,age:c.age,Tin:c.Tin,x:cometAt(c,c.age).x/R,y:cometAt(c,c.age).y/R,z:cometAt(c,c.age).z})),ringRotation,dashCount,waves:waves.length,camera:{distance:camera.position.z,tiltX:universe.rotation.x,tiltY:universe.rotation.y}};}
 };
}
