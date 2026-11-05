(function(root){
  'use strict';
  const art=root.CrosswindArt,colors=art.palette;
  const reduced=root.matchMedia('(prefers-reduced-motion: reduce)').matches;
  class Scene {
    constructor(canvas){this.canvas=canvas;this.ctx=canvas.getContext('2d');this.flashAt=-99;this.success=false;this.anchor=null;this.last=null;this.pulseFrame=0;new ResizeObserver(()=>{if(this.last)this.draw(...this.last);}).observe(canvas);}
    clear(){cancelAnimationFrame(this.pulseFrame);this.flashAt=-99;this.anchor=null;}
    flash(now,success,anchor=null){
      this.clear();this.flashAt=now;this.success=success;this.anchor=anchor;
      if(!anchor || reduced)return;
      // Let the final note's ripple fade after the session loop has stopped.
      const started=performance.now();
      const pulse=()=>{
        const age=(performance.now()-started)/1000;
        if(this.last){const args=this.last.slice();args[1]=Math.max(args[1],now+age);this.draw(...args);}
        if(age<.5)this.pulseFrame=requestAnimationFrame(pulse);
      };
      this.pulseFrame=requestAnimationFrame(pulse);
    }
    draw(kind,now,targets=[],beat=.6,cents=null,flight=null){
      this.last=[kind,now,targets,beat,cents,flight];
      const box=this.canvas.getBoundingClientRect(),w=box.width,h=box.height;
      if(!w || !h)return;
      const ratio=Math.min(root.devicePixelRatio||1,2),g=this.ctx;
      if(this.canvas.width!==Math.round(w*ratio)||this.canvas.height!==Math.round(h*ratio)){this.canvas.width=Math.round(w*ratio);this.canvas.height=Math.round(h*ratio);}
      g.setTransform(ratio,0,0,ratio,0,0);
      art.scenery(g,w,h,reduced?0:now*.18);
      const glow=Math.max(0,1-(now-this.flashAt)*2);
      if(kind==='flight'){
        const y=h*.5+(cents===null?0:Math.max(-120,Math.min(120,-cents))*h/300);
        const cycle=flight?.progress||0,x=w*.8-cycle*w*.58;
        // A rose brushstroke gate and the same silk kite as Crosswind.
        g.strokeStyle=colors.sail;g.lineWidth=2;g.globalAlpha=.7;
        g.beginPath();g.ellipse(x,h*.5,Math.max(12,w*.018),h*.12,-.08,0,Math.PI*2);g.stroke();
        g.globalAlpha=.25;g.lineWidth=5;g.stroke();g.globalAlpha=1;
        art.kite(g,{cx:w*.22,cy:y,scale:Math.min(.32,w/1400),tilt:reduced?0:Math.max(-.12,Math.min(.12,(cents||0)/650))});
        g.fillStyle=colors.quiet;g.font='12px Arial';
        g.fillText(cents===null?'Play a steady note':`${cents>0?'+':''}${Math.round(cents)} cents`,20,28);
        g.fillText(`${flight?.hits||0} / 6 gates`,20,h-20);
      }else if(kind==='repeat'){
        if(!targets.length){
          for(let i=0;i<3;i++)art.petal(g,w*(.42+i*.08),h*.42+Math.sin(i*1.5)*8,-.3+i*.16,false,colors.sail,colors.paper);
        }
        const petal=this.anchor?.(),rect=petal?.getBoundingClientRect();
        if(glow && !reduced && rect?.width && rect?.height){
          const x=rect.left+rect.width/2-box.left,y=rect.bottom-box.top+12;
          g.strokeStyle=colors.sail;g.lineWidth=1.1;
          for(let i=0;i<3;i++){g.globalAlpha=glow*(.22-i*.04);g.beginPath();g.ellipse(x,y,14+(1-glow)*50+i*12,4+(1-glow)*12+i*3,0,0,Math.PI*2);g.stroke();}
          g.globalAlpha=1;
        }
      }
    }
  }
  root.CadenceArt={Scene};
})(window);
