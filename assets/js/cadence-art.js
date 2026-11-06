(function(root){
  'use strict';
  const art=root.CrosswindArt,colors=art.palette;
  const reduced=root.matchMedia('(prefers-reduced-motion: reduce)').matches;
  class Scene {
    constructor(canvas){this.canvas=canvas;this.ctx=canvas.getContext('2d');this.flashAt=-99;this.success=false;this.anchor=null;this.last=null;this.pulseFrame=0;new ResizeObserver(()=>{if(this.last)this.draw(...this.last);}).observe(canvas);}
    clear(){cancelAnimationFrame(this.pulseFrame);this.flashAt=-99;this.anchor=null;}
    resetFlight(){this.clear();this.flightY=null;this.flightTime=null;}
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
        const score=flight?.score;if(!score)return;
        const index=Math.min(flight.index,score.notes.length-1),note=score.notes[index],elapsed=flight.elapsed;
        const pitchY=midi=>h*.5-(midi-(score.low+score.high)/2)*h*.34/Math.max(7,score.high-score.low);
        const scale=Math.min(.32,w/1400),nose=w*.22+65*scale,lookahead=4.8;
        const targetY=pitchY(flight.preview||flight.idle?note.midi:flight.detected??note.midi);
        const before=this.flightY??targetY,dt=this.flightTime===null||this.flightTime===undefined?0:Math.max(0,Math.min(.1,now-this.flightTime));
        const desired=flight.detected===null&&!flight.preview?before:Math.max(62,Math.min(h-62,targetY));
        this.flightY=before+(desired-before)*(reduced?1:1-Math.exp(-dt*9));this.flightTime=now;
        const y=this.flightY,tilt=Math.PI/2+(reduced?0:Math.max(-.18,Math.min(.18,(y-before)*.025)));
        // Musical height belongs to the score. Rings arrive at the forward nose.
        for(let i=flight.index;i<score.notes.length;i++){
          const event=score.notes[i],x=nose+(event.end-elapsed)/lookahead*(w*.93-nose);
          if(x>w+24)break;if(x<nose-20)continue;
          const gy=pitchY(event.midi),ry=151*scale*1.12,active=i===flight.index;
          g.strokeStyle=colors.sail;g.lineWidth=active?2:1;g.globalAlpha=active?.72:.3;
          g.beginPath();g.ellipse(x,gy,Math.max(10,w*.014),ry,0,0,Math.PI*2);g.stroke();
          if(active){g.globalAlpha=.12;g.lineWidth=6;g.stroke();}
          g.globalAlpha=active?1:.55;g.fillStyle=colors.ink;g.font='14px Georgia';g.textAlign='center';g.fillText(event.label,x,gy-ry-12);
        }
        g.globalAlpha=1;
        art.kite(g,{cx:w*.22,cy:y,scale,tilt});
        if(glow && !flight.preview){g.strokeStyle=this.success?colors.sail:colors.quiet;g.globalAlpha=glow*.5;g.lineWidth=1;g.beginPath();g.ellipse(nose,y,10+(1-glow)*20,151*scale*(1.1+(1-glow)*.2),0,0,Math.PI*2);g.stroke();g.globalAlpha=1;}
        g.fillStyle=colors.quiet;g.font='12px Arial';g.textAlign='left';
        g.fillText(flight.idle?'Follow the notes':flight.preview?'Listen':elapsed<0?'Ready…':cents===null?'Play the ring’s note':`${cents>0?'+':''}${Math.round(cents)} cents`,20,28);
        g.fillText(flight.preview?`${flight.index} / ${score.notes.length} notes`:`${flight.hits} / ${score.notes.length} rings`,20,h-20);
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
