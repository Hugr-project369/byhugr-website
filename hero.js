// One persistent scene. Language changes update the words, never recreate WebGL.
const smooth=x=>{x=Math.min(1,Math.max(0,x));return x*x*(3-2*x);};
const SLOT=6.8;
export async function createHomeHero(initialCopy){
 const hero=document.querySelector('#hero'),host=hero.querySelector('.hero-motion'),anchor=hero.querySelector('#halo-anchor'),button=hero.querySelector('#halo-word'),inner=button.querySelector('.halo-word-inner');
 let canvas=host.querySelector('canvas'),engine,copy=initialCopy,epoch=0,lastTime=0,index=-1,inView=true,modal=false,down=null,unavailable=false,interrupted=false;
 const reduced=matchMedia('(prefers-reduced-motion: reduce)');
 const brand='<span class="halo-brand">HU<span>G</span>R</span>';
 function paint(time){
  lastTime=time;
  if(reduced.matches||unavailable||interrupted){if(index!==-2){inner.innerHTML=brand+`<span class="halo-static">${copy.haloWords.slice(1).join(' ')}</span>`;index=-2;}inner.style.opacity='1';inner.style.transform='scale(1)';return;}
  const elapsed=Math.max(0,time-epoch),next=Math.floor(elapsed/SLOT)%copy.haloWords.length,phase=elapsed%SLOT;
  if(next!==index){index=next;inner.innerHTML=index===0?brand:`<span class="halo-syllable">${copy.haloWords[index]}</span>`;button.dataset.word=copy.haloWords[index];}
  const opacity=smooth(phase/1.8)*(1-smooth((phase-4.6)/2.1));
  const breath=Math.sin(Math.PI*phase/SLOT)**2;
  inner.style.opacity=String(opacity);inner.style.transform=`scale(${.98+breath*.032})`;
 }
 function measure(){
  const h=host.getBoundingClientRect(),a=anchor.getBoundingClientRect(),radius=Math.max(48,Math.min(a.height*.45,a.width*.42,194));
  const layout={x:a.left-h.left+a.width/2,y:a.top-h.top+a.height/2,radius};
  const textTop=hero.querySelector('h1').getBoundingClientRect().top-h.top;
  hero.style.setProperty('--halo-radius',`${radius}px`);
  host.style.setProperty('--halo-clear',`${Math.min(layout.y+radius+7,textTop-12)}px`);
  host.style.setProperty('--halo-text',`${textTop-3}px`);
  return layout;
 }
 const options={host,canvas,measure,onFrame:paint,onReady:()=>hero.dataset.haloReady='true',onContext:available=>{interrupted=!available;hero.classList.toggle('halo-interrupted',interrupted);index=-1;if(available)epoch=lastTime;paint(lastTime);}};
 try{const {createSpace}=await import('./halo/space.js');engine=createSpace(options);}catch{engine=null;}
 if(!engine){const replacement=canvas.cloneNode();canvas.replaceWith(replacement);canvas=replacement;const {createPresence}=await import('./halo/fallback.js');engine=createPresence({...options,canvas});hero.dataset.haloRenderer='canvas-2d';}else hero.dataset.haloRenderer='webgl-3d';
 if(!engine){unavailable=true;hero.classList.add('halo-static-fallback');inner.innerHTML=brand+`<span class="halo-static">${copy.haloWords.slice(1).join(' ')}</span>`;inner.style.opacity='1';}
 function setLocale(nextCopy){copy=nextCopy;epoch=lastTime;index=-1;button.setAttribute('aria-label',copy.haloLabel);paint(lastTime);requestAnimationFrame(()=>engine?.resize());}
 function sync(){engine?.setReduced(reduced.matches);engine?.setActive(inView&&!modal);}
 const observer=new IntersectionObserver(entries=>{inView=entries[0].isIntersecting;if(!inView)engine?.hold(false);sync();},{threshold:0});observer.observe(hero);
 const sizing=new ResizeObserver(()=>engine?.resize());sizing.observe(anchor);
 document.fonts.ready.then(()=>engine?.resize());
 reduced.addEventListener('change',()=>{epoch=lastTime;index=-1;sync();paint(lastTime);});
 document.addEventListener('hugr-dialog',event=>{modal=event.detail.open;engine?.hold(false);sync();});
 function coordinates(event){const r=host.getBoundingClientRect();return {x:event.clientX-r.left,y:event.clientY-r.top};}
 hero.addEventListener('pointermove',event=>{const p=coordinates(event);engine?.pointer(p.x,p.y);},{passive:true});
 hero.addEventListener('pointerleave',()=>{engine?.leave();down=null;});
 hero.addEventListener('pointerdown',event=>{if(event.button!==0||event.target.closest('a,button,input,dialog'))return;down=coordinates(event);});
 hero.addEventListener('pointerup',event=>{const p=coordinates(event);if(down&&Math.hypot(p.x-down.x,p.y-down.y)<10)engine?.release(p.x,p.y);down=null;});
 hero.addEventListener('pointercancel',()=>{down=null;engine?.hold(false);});
 button.addEventListener('pointerdown',event=>{if(event.button!==0)return;button.setPointerCapture(event.pointerId);engine?.hold(true);});
 for(const name of ['pointerup','pointercancel','lostpointercapture','blur'])button.addEventListener(name,()=>engine?.hold(false));
 button.addEventListener('keydown',event=>{if(['Space','Enter'].includes(event.code)){event.preventDefault();engine?.hold(true);}});
 button.addEventListener('keyup',event=>{if(['Space','Enter'].includes(event.code)){event.preventDefault();engine?.hold(false);}});
 window.addEventListener('blur',()=>engine?.hold(false));
 modal=document.querySelector('#info-dialog').open;setLocale(copy);sync();
 Object.defineProperty(window,'homeHaloState',{get:()=>({...engine?.getState(),word:copy.haloWords[index]??copy.haloWords.join(' '),phase:(lastTime-epoch)%SLOT,locale:document.documentElement.lang})});
 return {setLocale};
}
