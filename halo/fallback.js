// Original HUGR motion study V2. No generated media or external runtime.
const TAU = Math.PI * 2;
const clamp = (v,a=0,b=1) => Math.max(a,Math.min(b,v));
const fract = v => v-Math.floor(v);
const seed = v => fract(Math.sin(v*127.1+311.7)*43758.5453);
const angleDiff = (a,b) => Math.atan2(Math.sin(a-b),Math.cos(a-b));
const mix = (a,b,t) => a+(b-a)*t;
const palette = {gold:[232,195,128],pearl:[255,244,215],blue:[142,175,220]};
const rgba = (color,opacity) => `rgba(${color[0]},${color[1]},${color[2]},${clamp(opacity)})`;
const quadratic = (a,b,c,t) => ({x:(1-t)**2*a.x+2*(1-t)*t*b.x+t*t*c.x,y:(1-t)**2*a.y+2*(1-t)*t*b.y+t*t*c.y});

export function createPresence({host,canvas,measure,onFrame=()=>{},onReady=()=>{},onHolding=()=>{}}={}) {
 const ctx=canvas.getContext('2d',{alpha:false});
 if(!ctx) return null;
 let width=1,height=1,cx=0,cy=0,radius=1,dpr=1,mobile=false;
 let time=0,previous=0,frameId=0,paused=false,reduced=false,active=true,holding=false,speed=1;
 let stars=[],dust=[],comets=[],waves=[],splinters=[],nextComet=1.2,nextHeartbeat=1.1,serial=0,background;
 let pointer={x:0,y:0,tx:0,ty:0,amount:0,target:0},ringRotation=0;
 const sprites={gold:makeGlow(palette.gold),pearl:makeGlow(palette.pearl),blue:makeGlow(palette.blue)};

 function makeGlow(color) {
  const texture=document.createElement('canvas');texture.width=texture.height=128;
  const g=texture.getContext('2d'),gradient=g.createRadialGradient(64,64,0,64,64,64);
  gradient.addColorStop(0,rgba(color,.98));gradient.addColorStop(.065,rgba(color,.68));
  gradient.addColorStop(.18,rgba(color,.19));gradient.addColorStop(.42,rgba(color,.047));gradient.addColorStop(1,rgba(color,0));
  g.fillStyle=gradient;g.fillRect(0,0,128,128);return texture;
 }
 function glow(x,y,size,opacity=1,tone='gold') {
  if(opacity<.002||size<.2)return;
  ctx.globalAlpha=clamp(opacity);ctx.drawImage(sprites[tone],x-size,y-size,size*2,size*2);ctx.globalAlpha=1;
 }
 function makeBackground() {
  background=document.createElement('canvas');background.width=Math.round(width);background.height=Math.round(height);
  const g=background.getContext('2d');g.fillStyle='#030407';g.fillRect(0,0,width,height);
  // Broad, asymmetric light in the distance. Native-resolution gradients avoid tiled noise.
  for(const [x,y,rx,ry,color,alpha,rotation] of [
   [.2,.71,.6,.3,[28,43,79],.18,-.55],
   [.84,.24,.4,.24,[44,34,50],.17,-.55],
   [.76,.72,.35,.12,[59,42,23],.09,-.5]
  ]) {
   g.save();g.translate(width*x,height*y);g.rotate(rotation);g.scale(width*rx,height*ry);
   const a=g.createRadialGradient(0,0,0,0,0,1);a.addColorStop(0,rgba(color,alpha));a.addColorStop(1,rgba(color,0));
   g.fillStyle=a;g.fillRect(-1,-1,2,2);g.restore();
  }
  stars=Array.from({length:mobile?90:185},(_,i)=>({x:seed(i+18)*2-1,y:seed(i+491)*2-1,z:.2+seed(i+642)*.8,r:.3+seed(i+98)*.75,phase:seed(i+256)*TAU,tone:i%8===0?'gold':'blue'}));
  dust=Array.from({length:mobile?145:300},(_,i)=>({angle:seed(i+791)*TAU,r:1.04+Math.pow(seed(i+221),1.8)*1.12,phase:seed(i+97)*TAU,s:.35+seed(i+871)*.85,depth:seed(i+366),offset:seed(i+430),sign:i%3?1:-1}));
 }
 function outsideClip(extra=0) {
  ctx.beginPath();ctx.rect(-width,-height,width*3,height*3);ctx.arc(cx,cy,radius+extra,0,TAU,true);ctx.clip('evenodd');
 }
 function drawSky() {
  ctx.globalCompositeOperation='source-over';ctx.drawImage(background,0,0,width,height);
  ctx.save();outsideClip(3);ctx.globalCompositeOperation='lighter';
  for(const s of stars) {
   const px=cx+s.x*width*.7+pointer.x*s.z*5,py=cy+s.y*height*.7+pointer.y*s.z*5;
   const alpha=(.12+(.5+.5*Math.sin(time*.22+s.phase))*.28)*s.z;
   ctx.fillStyle=rgba(s.tone==='gold'?palette.gold:palette.blue,alpha);
   ctx.beginPath();ctx.arc(px,py,s.r,0,TAU);ctx.fill();
   if(s.r>.9&&s.z>.8){glow(px,py,8,alpha*.24,s.tone);ctx.fillStyle=rgba(palette.pearl,alpha*.22);ctx.fillRect(px-3,py-.2,6,.4);}
  }
  ctx.restore();
  // Nothing from the outer universe passes through this quiet interior.
  ctx.fillStyle='#030407';ctx.beginPath();ctx.arc(cx,cy,radius-2,0,TAU);ctx.fill();
  const calm=ctx.createRadialGradient(cx,cy,0,cx,cy,radius*.73);
  calm.addColorStop(0,'rgba(120,88,36,.035)');calm.addColorStop(1,'rgba(120,88,36,0)');
  ctx.fillStyle=calm;ctx.fillRect(cx-radius,cy-radius,radius*2,radius*2);
 }
 function drawDust() {
  const near=[];ctx.save();outsideClip(3);ctx.globalCompositeOperation='lighter';
  for(const p of dust) {
   const a=p.angle+time*(.005+p.depth*.011)*p.sign;
   let r=p.r+Math.sin(time*.2+p.phase)*.018;
   // Asymmetric clusters read as depth, rather than another concentric ring.
   const cluster=Math.pow(.5+.5*Math.sin(a*2+.8),3);
   const px=cx+Math.cos(a)*r*radius,py=cy+Math.sin(a)*r*radius;
   const toX=pointer.x*radius-(px-cx),toY=pointer.y*radius-(py-cy),distance=Math.hypot(toX,toY);
   const attention=Math.exp(-Math.pow(distance/(radius*.4),2))*pointer.amount;
   let x=px+toX*attention*.09,y=py+toY*attention*.09;
   const d=Math.hypot(x-cx,y-cy);if(d<radius+5){x=cx+(x-cx)*(radius+5)/d;y=cy+(y-cy)*(radius+5)/d;}
   const twinkle=.6+.4*Math.sin(p.phase+time*.36);
   const alpha=(.13+cluster*.45)*twinkle*(1-(r-1)/2)+attention*.28;
   ctx.fillStyle=rgba(palette.gold,alpha);ctx.beginPath();ctx.arc(x,y,p.s*(.65+p.depth*.4)+attention*.2,0,TAU);ctx.fill();
   if(alpha>.31)glow(x,y,5+p.s*5,alpha*.16);
   if(attention>.3&&near.length<14)near.push({x,y,a:attention});
  }
  // Fine connections exist only around the visitor's gesture, and only outside.
  ctx.lineWidth=.4;
  for(let i=0;i<near.length;i++)for(let j=i+1;j<near.length;j++) {
   const a=near[i],b=near[j],distance=Math.hypot(a.x-b.x,a.y-b.y);
   if(distance>42)continue;
   ctx.strokeStyle=rgba(palette.gold,(1-distance/42)*Math.min(a.a,b.a)*.17);
   ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();
  }
 ctx.restore();
 }
 function drawCurrents() {
  ctx.save();outsideClip(5);ctx.globalCompositeOperation='lighter';ctx.lineWidth=.45;
  const strands=mobile?17:26;
  // Open silk-like folds surround a single boundary. They never close into extra rings.
  for(let sector=0;sector<3;sector++) {
   const centre=sector*2.37+.4+Math.sin(time*.04+sector)*.13;
   const col=sector===1?palette.blue:palette.gold;
   for(let j=0;j<strands;j++) {
    const lane=j/(strands-1),flicker=.72+.28*Math.sin(time*.23+j*.43+sector);
    ctx.strokeStyle=rgba(col,(.022+.045*Math.sin(lane*Math.PI))*flicker);
    ctx.beginPath();
    for(let k=0;k<=42;k++) {
     const u=k/42,flow=Math.sin(u*Math.PI),a=centre+(u-.5)*1.12+lane*.09;
     const r=1.045+lane*lane*.27+flow*flow*(.07+.025*Math.sin(lane*7+time*.21+sector));
     const x=cx+Math.cos(a)*radius*r,y=cy+Math.sin(a)*radius*r;
     if(k===0)ctx.moveTo(x,y);else ctx.lineTo(x,y);
    }
    ctx.stroke();
   }
  }
  ctx.restore();
 }
 function addComet({manual=false,x=0,y=0,initialAge=0}={}) {
  if(manual&&comets.some(c=>c.manual))return false;
  const id=serial++,sign=id%2?1:-1;
  const startDistance=manual?Math.hypot(x,y):0;
  if(manual&&startDistance<1.085)return false;
  let a=manual?Math.atan2(y,x):id*2.39996323+.38;
  const impactRadius=1+Math.max(4/radius,.023);
  if(manual)a+=sign*Math.min(.15,Math.acos(clamp(impactRadius/startDistance,-1,1))*.55);
  const n={x:Math.cos(a),y:Math.sin(a)},tangent={x:-Math.sin(a),y:Math.cos(a)};
  const end={x:n.x*impactRadius,y:n.y*impactRadius};
  const beta=.32+seed(id+20)*.4;
  const incoming={x:-n.x*Math.cos(beta)+tangent.x*sign*Math.sin(beta),y:-n.y*Math.cos(beta)+tangent.y*sign*Math.sin(beta)};
  const length=1.7+seed(id+801)*1.25;
  const start=manual?{x,y}:{x:end.x-incoming.x*length,y:end.y-incoming.y*length};
  const distance=Math.hypot(start.x-end.x,start.y-end.y);
  const control=manual?{x:mix(start.x,end.x,.5)+n.x*.12*distance,y:mix(start.y,end.y,.5)+n.y*.12*distance}:{x:end.x-incoming.x*length*.47+n.x*.10,y:end.y-incoming.y*length*.47+n.y*.10};
  const vx=end.x-control.x,vy=end.y-control.y,vlen=Math.hypot(vx,vy),dot=(vx*n.x+vy*n.y)/vlen;
  const out={x:vx/vlen-2*dot*n.x,y:vy/vlen-2*dot*n.y};
  const hero=manual||id%3===0;
  const c={id,manual,start,control,end,n,tangent,out,angle:a,sign,age:initialAge,hit:false,Tin:manual?clamp(distance*1.35,.7,3):3.8+seed(id+31)*1.4,Tout:4.8,travel:distance*(manual?1.5:1.1),weight:hero?1:.52,color:id%5===2?'blue':'gold',trail:hero?1.65:1.25};
  if(c.age>=c.Tin)c.hit=true;
  comets.push(c);return true;
 }
 function cometAt(c,age) {
  if(age<c.Tin)return quadratic(c.start,c.control,c.end,Math.pow(clamp(age/c.Tin),1.65));
  const ageOut=age-c.Tin,u=1-Math.exp(-ageOut*.69);
  return {x:c.end.x+c.out.x*c.travel*u+c.tangent.x*c.sign*u*u*.43,y:c.end.y+c.out.y*c.travel*u+c.tangent.y*c.sign*u*u*.43};
 }
 function impact(c) {
  waves.push({angle:c.angle,birth:time,power:c.weight*.72,heartbeat:false});
  for(let i=0;i<10;i++) {
   const a=c.angle+(seed(c.id*19+i)-.5)*1.25;
   splinters.push({x:c.end.x,y:c.end.y,a,birth:time,life:.65+seed(i+c.id)*1.1,velocity:.1+seed(i+40)*.25,weight:c.weight});
  }
 }
 function drawComets() {
  ctx.save();outsideClip(2.2);ctx.globalCompositeOperation='lighter';ctx.lineCap='butt';
  for(const c of comets) {
   const head=cometAt(c,c.age),hx=cx+head.x*radius,hy=cy+head.y*radius;
   const fade=Math.min(c.manual?1:clamp(c.age*2),clamp((c.Tin+c.Tout-c.age)/1.3));
   if(fade<=0)continue;
   const color=palette[c.color],count=44,points=[];
   const scale=clamp(radius/200,.65,1.15)*c.weight;
   for(let j=0;j<=count;j++) {
    const age=Math.max(0,c.age-(1-j/count)*c.trail),p=cometAt(c,age);
    points.push({x:cx+p.x*radius,y:cy+p.y*radius,f:j/count});
   }
   // A tapered central ribbon and two hairline strands: no flat neon tube.
   for(let j=1;j<points.length;j++) {
    const p=points[j],q=points[j-1],f=p.f,opacity=f*f*fade;
    ctx.lineWidth=(.28+Math.pow(f,1.7)*1.9)*scale;
    ctx.strokeStyle=rgba(color,opacity*.92);ctx.beginPath();ctx.moveTo(q.x,q.y);ctx.lineTo(p.x,p.y);ctx.stroke();
    const dx=p.x-q.x,dy=p.y-q.y,len=Math.hypot(dx,dy)||1;
    const spread=(1-f)*Math.sin(f*6+c.id)*3.4*scale;
    const nx=-dy/len,ny=dx/len;
    ctx.lineWidth=.38*scale;ctx.strokeStyle=rgba(palette.pearl,opacity*.24);
    ctx.beginPath();ctx.moveTo(q.x+nx*spread,q.y+ny*spread);ctx.lineTo(p.x+nx*spread,p.y+ny*spread);ctx.stroke();
    ctx.strokeStyle=rgba(palette.blue,opacity*.19);
    ctx.beginPath();ctx.moveTo(q.x-nx*spread*.7,q.y-ny*spread*.7);ctx.lineTo(p.x-nx*spread*.7,p.y-ny*spread*.7);ctx.stroke();
    if(j%6===0)glow(p.x,p.y,12*scale,opacity*.08,c.color);
   }
   glow(hx,hy,32*scale,fade*.78,c.color);glow(hx,hy,8*scale,fade*.95,'pearl');
   ctx.fillStyle=rgba(palette.pearl,fade);ctx.beginPath();ctx.arc(hx,hy,.85*scale+.25,0,TAU);ctx.fill();
   const near=cometAt(c,Math.max(0,c.age-.02)),a=Math.atan2(head.y-near.y,head.x-near.x);
   ctx.save();ctx.translate(hx,hy);ctx.rotate(a);ctx.fillStyle=rgba(palette.pearl,fade*.25);ctx.fillRect(-5*scale,-.18,10*scale,.36);ctx.restore();
  }
  for(const s of splinters) {
   const t=time-s.birth,alpha=(1-t/s.life)**2*s.weight;
   const x=cx+(s.x+Math.cos(s.a)*s.velocity*t)*radius,y=cy+(s.y+Math.sin(s.a)*s.velocity*t)*radius;
   ctx.strokeStyle=rgba(palette.gold,alpha*.54);ctx.lineWidth=.65;
   ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+Math.cos(s.a)*2,y+Math.sin(s.a)*2);ctx.stroke();
  }
  ctx.restore();
 }
 function ringLight(angle) {
  let value=.13+Math.pow(.5+.5*Math.cos(angle-time*.19-1.1),12)*.18;
  if(pointer.amount>.01) {
   const a=Math.atan2(pointer.y,pointer.x),d=Math.hypot(pointer.x,pointer.y);
   value+=Math.exp(-Math.pow(angleDiff(angle,a)/.32,2))*Math.exp(-Math.pow((d-1)/.55,2))*pointer.amount*.72;
  }
  for(const w of waves) {
   const age=time-w.birth;if(age<0)continue;const dist=Math.abs(angleDiff(angle,w.angle));
   const front=age*(w.heartbeat?.91:1.24);
   const wave=Math.exp(-Math.pow((dist-front)/.09,2))*Math.exp(-age*.64);
   const contact=Math.exp(-Math.pow(dist/.105,2))*Math.exp(-age*3.8);
   value+=(wave*.85+contact*.9)*w.power;
  }
  return clamp(value,0,1.35);
 }
 function drawRing() {
  ringRotation=time*.052;
  const count=Math.max(70,Math.round(TAU*radius/8.5));
  ctx.save();ctx.globalCompositeOperation='lighter';
  // The contact light glides outside the dotted edge, without filling its gaps.
  ctx.save();outsideClip(5);
  for(const w of waves) {
   const age=time-w.birth;if(age<0)continue;
   for(const direction of [-1,1]) {
    const a=w.angle+direction*age*(w.heartbeat?.91:1.24),r=radius+8;
    glow(cx+Math.cos(a)*r,cy+Math.sin(a)*r,32,Math.exp(-age*.8)*w.power*.62);
   }
  }
  ctx.restore();
  // Glow is attached to individual points; their dark intervals stay legible.
  for(let i=0;i<count;i++) {
   const a=i*TAU/count+ringRotation,l=ringLight(a),x=cx+Math.cos(a)*radius,y=cy+Math.sin(a)*radius;
   const facet=.78+.22*Math.sin(i*2.4+.5);
   glow(x,y,10,.17+Math.min(.25,l*.22));
   ctx.strokeStyle=rgba(palette.gold,(.79+l*.20)*facet);ctx.lineWidth=1.55+Math.min(.34,l*.24);ctx.lineCap='round';
   const dash=2.45/radius;
   ctx.beginPath();ctx.arc(cx,cy,radius,a-dash/2,a+dash/2);ctx.stroke();
   if(l>.53) {
    ctx.fillStyle=rgba(palette.pearl,Math.min(.93,(l-.43)*1.25));ctx.beginPath();ctx.arc(x,y,.63,0,TAU);ctx.fill();
    glow(x,y,13,Math.min(.17,(l-.43)*.17),'pearl');
   }
  }
  ctx.restore();
 }
 function draw() {
  onFrame(time);drawSky();drawCurrents();drawDust();drawComets();drawRing();}
 function resize() {
  const box=host.getBoundingClientRect();width=box.width;height=box.height;mobile=width<=600;
  cx=width*.5;cy=height*(mobile?.43:.48);radius=Math.min(width*(mobile?.315:.225),height*(mobile?.195:.255),264);
  dpr=Math.min(devicePixelRatio||1,mobile?1.75:2);
  canvas.width=Math.round(width*dpr);canvas.height=Math.round(height*dpr);ctx.setTransform(dpr,0,0,dpr,0,0);
  if(measure){const layout=measure();cx=layout.x;cy=layout.y;radius=layout.radius;}host.style.setProperty('--radius',`${radius}px`);makeBackground();
  if(!comets.length&&time===0)for(let i=0;i<5;i++)addComet({initialAge:i*.73+.7});
  draw();
 }
 function update(dt) {
  speed+=(holding?.12-speed:1-speed)*(1-Math.exp(-dt*(holding?3.6:2.6)));
  const step=dt*speed;time+=step;
  const ease=1-Math.exp(-dt*3.9);pointer.x+=(pointer.tx-pointer.x)*ease;pointer.y+=(pointer.ty-pointer.y)*ease;pointer.amount+=(pointer.target-pointer.amount)*ease;
  for(const c of comets) {c.age+=step;if(!c.hit&&c.age>=c.Tin){c.hit=true;impact(c);}}
  comets=comets.filter(c=>c.age<c.Tin+c.Tout);
  if(time>=nextComet) {if(comets.filter(c=>!c.manual).length<6)addComet();nextComet=time+1.8+seed(serial)*.7;}
  if(time>=nextHeartbeat) {waves.push({angle:-1.55,birth:time,power:.49,heartbeat:true});waves.push({angle:-1.55,birth:time+.36,power:.29,heartbeat:true});nextHeartbeat=time+7.2;}
  waves=waves.filter(w=>time-w.birth<3.5);splinters=splinters.filter(s=>time-s.birth<s.life);
 }
 function tick(stamp) {
  frameId=0;if(!active||paused||reduced||document.hidden)return;
  const dt=Math.min((stamp-previous)/1000,.045);previous=stamp;update(dt);draw();frameId=requestAnimationFrame(tick);
 }
 function restart() {cancelAnimationFrame(frameId);frameId=0;previous=performance.now();if(active&&!paused&&!reduced&&!document.hidden)frameId=requestAnimationFrame(tick);else draw();}
 function hold(value){holding=value&&!paused&&!reduced&&active;onHolding(holding);}
 function point(x,y) {pointer.tx=(x-cx)/radius;pointer.ty=(y-cy)/radius;pointer.target=1;if(paused||reduced){pointer.x=pointer.tx;pointer.y=pointer.ty;pointer.amount=1;draw();}}
 const visibility=()=>{hold(false);restart();};document.addEventListener('visibilitychange',visibility);
 const observer=new ResizeObserver(resize);observer.observe(host);resize();restart();onReady();
 return {
  pointer:point,leave(){pointer.target=0;hold(false);if(paused||reduced){pointer.amount=0;draw();}},hold,
  release(x,y){if(paused||reduced||!active)return false;const created=addComet({manual:true,x:(x-cx)/radius,y:(y-cy)/radius});if(created)draw();return created;},
  setPaused(value){paused=value;hold(false);restart();},setReduced(value){reduced=value;hold(false);restart();},setActive(value){active=value;hold(false);restart();},resize,
  getState(){return {time,speed,holding,paused,reduced,active,centre:{x:cx,y:cy,radius},meteor:comets.some(c=>c.manual),comets:comets.length,ringRotation,dashCount:Math.max(70,Math.round(TAU*radius/8.5)),waves:waves.length};},
  dispose(){cancelAnimationFrame(frameId);observer.disconnect();document.removeEventListener('visibilitychange',visibility);}
 };
}
