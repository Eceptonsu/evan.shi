(function(root){
  'use strict';
  const art=root.CrosswindArt,colors=art.palette;
  const reduced=root.matchMedia('(prefers-reduced-motion: reduce)').matches;
  class Scene {
    constructor(canvas){this.canvas=canvas;this.ctx=canvas.getContext('2d');this.flashAt=-99;this.success=false;this.note=3;this.last=null;new ResizeObserver(()=>{if(this.last)this.draw(...this.last);}).observe(canvas);}
    flash(now,success,note=3){this.flashAt=now;this.success=success;this.note=note;}
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
        if(glow && !reduced){
          const x=w*(.22+this.note*.08),y=h*.66;
          g.strokeStyle=colors.sail;g.lineWidth=1.1;
          for(let i=0;i<3;i++){g.globalAlpha=glow*(.22-i*.04);g.beginPath();g.ellipse(x,y,14+(1-glow)*50+i*12,4+(1-glow)*12+i*3,0,0,Math.PI*2);g.stroke();}
          g.globalAlpha=1;
        }
      }else{
        // Quiet sound waves frame the concert note without competing with it.
        for(let i=0;i<3;i++){
          const breath=reduced?0:Math.sin(now*.8-i*.7)*3;
          g.strokeStyle=colors.sail;g.globalAlpha=.19-i*.035;g.lineWidth=1;
          g.beginPath();g.ellipse(w*.5,h*.51,Math.min(w*.32,145)+i*16+breath,42+i*9,0,0,Math.PI*2);g.stroke();
        }
        g.globalAlpha=1;
      }
    }
  }
  root.CadenceArt={Scene};
})(window);
