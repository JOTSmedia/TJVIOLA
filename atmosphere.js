/** An animated blue light field, continuous through the whole artist experience. */
const canvas=document.querySelector('#ambient-canvas');
if(canvas){
 const ctx=canvas.getContext('2d'),reduced=matchMedia('(prefers-reduced-motion:reduce)');
 let w=0,h=0,frame=0,last=0,scrollPhase=0;
 const resize=()=>{w=innerWidth;h=innerHeight;canvas.width=w;canvas.height=h;draw(performance.now());};
 function glow(x,y,r,inner,outer){const g=ctx.createRadialGradient(x,y,0,x,y,r);g.addColorStop(0,inner);g.addColorStop(.46,outer);g.addColorStop(1,'rgba(0,20,90,0)');ctx.fillStyle=g;ctx.fillRect(0,0,w,h);}
 function draw(time){
  if(!ctx)return;const t=reduced.matches?1.2:time*.00013;
  ctx.globalCompositeOperation='source-over';ctx.fillStyle='#020c2a';ctx.fillRect(0,0,w,h);
  glow(w*(.22+Math.sin(t*.7+scrollPhase)*.22),h*.15,Math.max(w,h)*.8,'rgba(0,77,255,.83)','rgba(0,54,220,.3)');
  glow(w*(.77+Math.cos(t*.5)*.17),h*(.66+Math.sin(t*.8)*.22),Math.max(w,h)*.68,'rgba(0,159,255,.56)','rgba(0,69,255,.2)');
  glow(w*.48,h*(1+Math.sin(t*.4)*.2),w*.7,'rgba(0,42,255,.5)','rgba(0,25,150,.12)');
  ctx.globalCompositeOperation='screen';
  for(let band=0;band<3;band++){
   const origin=h*(.18+band*.35),phase=t+band*1.7+scrollPhase*.4;
   // Wide luminous currents, with finely striated blue material along each edge.
   for(let line=0;line<27;line++){
    ctx.beginPath();ctx.strokeStyle=`rgba(${band===1?'67,214,255':'41,112,255'},${.019+Math.sin(line/27*Math.PI)*.035})`;
    ctx.lineWidth=line===13?2.5:.7;
    for(let x=-20;x<=w+20;x+=16){const p=x/(w||1)*Math.PI*2;const y=origin+Math.sin(p*.68+phase)*h*.22+Math.cos(p*1.5-phase*.6)*50+(line-13)*4.5+Math.sin(p*.6+line*.055+phase)*38;if(x===-20)ctx.moveTo(x,y);else ctx.lineTo(x,y);}ctx.stroke();
   }
  }
  ctx.globalCompositeOperation='source-over';
 }
 function animate(time){frame=requestAnimationFrame(animate);if(document.hidden||time-last<45)return;last=time;draw(time);}
 window.addEventListener('resize',resize,{passive:true});window.addEventListener('scroll',()=>{scrollPhase=scrollY/Math.max(1,document.body.scrollHeight)*3;},{passive:true});
 reduced.addEventListener('change',()=>{cancelAnimationFrame(frame);resize();if(!reduced.matches)frame=requestAnimationFrame(animate);});
 resize();if(!reduced.matches)frame=requestAnimationFrame(animate);
}
