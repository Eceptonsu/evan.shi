(function(root){
  'use strict';
  // Paint each landform once. The game moves these transparent washes through
  // perspective instead of redrawing thousands of texture marks each frame.
  function landscape(seed){
    const canvas=document.createElement('canvas');canvas.width=640;canvas.height=640;
    const g=canvas.getContext('2d');
    let state=seed*1009+73;
    const random=()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state/4294967296;};
    const peaks=[{x:.22+random()*.12,h:.37+random()*.2,w:.13+random()*.06},{x:.57+random()*.12,h:.4+random()*.23,w:.16+random()*.07}];
    const ridge=x=>{
      const u=x/640;
      return 560-peaks.reduce((sum,p)=>sum+p.h*490*Math.exp(-(((u-p.x)/p.w)**2)),0)+Math.sin(u*49+seed)*7+Math.sin(u*111+seed)*3;
    };
    const outline=new Path2D();outline.moveTo(0,640);
    for(let x=0;x<=640;x+=3)outline.lineTo(x,ridge(x));
    outline.lineTo(640,640);outline.closePath();
    g.save();g.clip(outline);
    // A paper underpainting hides trees on more distant ridges. Without it,
    // transparent rock washes let rear branches appear to cut through a crag.
    g.fillStyle='#f4efea';g.fillRect(0,0,640,640);
    const wash=g.createLinearGradient(0,130,0,635);
    wash.addColorStop(0,'rgba(50,63,58,.78)');wash.addColorStop(.48,'rgba(91,104,95,.44)');wash.addColorStop(.78,'rgba(147,153,139,.24)');wash.addColorStop(1,'rgba(170,171,153,0)');
    g.fillStyle=wash;g.fillRect(0,0,640,640);
    // Split washes leave the white paper breathing between rock faces.
    for(let n=0;n<24;n++){
      const x=random()*640,y=ridge(x),depth=55+random()*180;
      g.fillStyle=`rgba(45,57,51,${.015+random()*.045})`;
      g.beginPath();g.moveTo(x,y);g.bezierCurveTo(x-20,y+depth*.3,x+40,y+depth*.7,x+5,Math.min(635,y+depth));g.lineTo(x+35,y+depth*.5);g.closePath();g.fill();
    }
    // Dry, broken downward strokes describe stone without a uniform outline.
    for(let n=0;n<410;n++){
      const x=random()*640,top=ridge(x),y=top+random()*(610-top),length=7+random()*45;
      const alpha=(1-y/680)*(.05+random()*.18);
      g.strokeStyle=`rgba(35,47,42,${alpha})`;g.lineWidth=.35+random()*1.5;
      g.beginPath();g.moveTo(x,y);g.lineTo(x-3+random()*9,y+length*.35);g.moveTo(x+2,y+length*.42);g.lineTo(x-5+random()*12,y+length);g.stroke();
    }
    for(let n=0;n<1250;n++){
      const x=random()*640,y=ridge(x)+random()*160;
      g.fillStyle=`rgba(34,46,39,${.025+random()*.10})`;g.fillRect(x,y,.4+random()*2.6,.3+random()*1.1);
    }
    g.restore();
    // A sparse line of pines makes the silhouette legible at different depths.
    function pine(x,y,h){
      const lean=(random()-.5)*h*.2;
      g.strokeStyle='rgba(31,45,38,.65)';g.lineWidth=Math.max(1.5,h*.04);
      g.beginPath();g.moveTo(x,y);g.quadraticCurveTo(x-lean,y-h*.5,x+lean,y-h);g.stroke();
      for(let tier=1;tier<7;tier++){
        const p=tier/7,cy=y-h+h*p,spread=h*.3*p;
        for(const side of [-1,1]){
          g.beginPath();g.moveTo(x+lean*(1-p),cy);g.lineTo(x+side*spread,cy-h*.07);g.stroke();
          for(let j=0;j<5;j++){
            const px=x+side*spread*j/5,py=cy-h*.07*j/5;
            g.strokeStyle=`rgba(30,44,36,${.3+random()*.3})`;g.lineWidth=1.3+random();
            g.beginPath();g.moveTo(px-spread*.2,py+2);g.lineTo(px+side*spread*.1,py-h*.06);g.lineTo(px+spread*.25,py+1);g.stroke();
          }
        }
      }
    }
    for(let i=0;i<10;i++){
      let x=90+random()*450;
      for(let attempt=0;attempt<6 && ridge(x)>430;attempt++)x=90+random()*450;
      // Keep trunks above the lower mist mask. Trees on the washed-out skirt
      // otherwise look detached, and disappear behind the next layer in pieces.
      if(ridge(x)<=430)pine(x,ridge(x)+3,14+random()*28);
    }
    if(seed%3===0){
      // One pale waterfall interrupts the heavier rocks, fading into the wash.
      const x=365,y=ridge(x)+45;
      g.strokeStyle='rgba(247,244,231,.65)';g.lineWidth=4;g.beginPath();g.moveTo(x,y);g.bezierCurveTo(x+8,y+30,x-12,y+75,x+4,y+135);g.stroke();
    }
    // Feather the transparent margins so a moving wash has no rectangular edge.
    g.globalCompositeOperation='destination-in';
    const edge=g.createLinearGradient(0,0,640,0);
    edge.addColorStop(0,'transparent');edge.addColorStop(.09,'#000');edge.addColorStop(.91,'#000');edge.addColorStop(1,'transparent');
    g.fillStyle=edge;g.fillRect(0,0,640,640);
    const mist=g.createLinearGradient(0,460,0,640);mist.addColorStop(0,'#000');mist.addColorStop(1,'transparent');
    g.fillStyle=mist;g.fillRect(0,0,640,640);
    g.globalCompositeOperation='source-over';
    return canvas;
  }
  let paintings;
  function mountain(index){paintings ||= Array.from({length:6},(_,i)=>landscape(i+1));return paintings[((index%6)+6)%6];}
  const mipmaps=new Map();
  function drawMountain(g,index,x,y,w,h){
    const original=mountain(index);
    if(!mipmaps.has(original)){
      const levels=[original];
      while(levels.at(-1).width>40){
        const previous=levels.at(-1),small=document.createElement('canvas');
        small.width=previous.width/2;small.height=previous.height/2;
        const brush=small.getContext('2d');brush.imageSmoothingEnabled=true;brush.imageSmoothingQuality='high';
        brush.drawImage(previous,0,0,small.width,small.height);levels.push(small);
      }
      mipmaps.set(original,levels);
    }
    const levels=mipmaps.get(original),ratio=Math.min(root.devicePixelRatio||1,2);
    const lod=Math.max(0,Math.min(levels.length-1,Math.floor(Math.log2(640/Math.max(1,Math.max(w,h)*ratio)))));
    g.imageSmoothingEnabled=true;g.imageSmoothingQuality='high';
    g.drawImage(levels[lod],x,y,w,h);
  }
  const palette={paper:'#f4efea',ink:'#302b2c',quiet:'#6e6064',mist:'#dfcfd0',sail:'#ad5e78','sail-light':'#e9b9c4'};
  function scenery(g,w,h,drift=0){
    g.save();g.fillStyle=palette.paper;g.fillRect(0,0,w,h);
    const wash=g.createLinearGradient(0,0,0,h);wash.addColorStop(0,palette.paper);wash.addColorStop(1,'#e5dadd');
    g.fillStyle=wash;g.fillRect(0,0,w,h);
    for(let layer=0;layer<3;layer++){
      for(let i=-1;i<4;i++){
        const span=w*(.5+layer*.12),slide=drift*(layer+1)*3;
        const x=i*span-((slide%span)+span)%span;
        g.globalAlpha=.22+layer*.17;
        drawMountain(g,i+layer*2,x,h*(.02+layer*.1),span,h*(.88+layer*.1));
      }
    }
    g.globalAlpha=1;
    const mist=g.createLinearGradient(0,h*.3,0,h);mist.addColorStop(0,'rgba(244,239,234,0)');mist.addColorStop(1,palette.paper);
    g.fillStyle=mist;g.fillRect(0,0,w,h);g.restore();
  }
  function petal(g,x,y,angle,open,ink,paper){
    g.save();g.translate(x,y);g.rotate(angle);
    // The point at (0,0) is the timing anchor. Flutter changes the body only.
    g.beginPath();g.moveTo(0,0);g.bezierCurveTo(-9,-9,-24,-11,-31,-2);g.bezierCurveTo(-26,11,-9,9,0,0);g.closePath();
    g.fillStyle=open?paper:ink;g.fill();g.strokeStyle=ink;g.lineWidth=open?1.8:.7;g.stroke();
    g.beginPath();g.moveTo(-27,-1);g.quadraticCurveTo(-12,4,-2,0);g.strokeStyle=open?ink:paper;g.globalAlpha=open?.5:.78;g.lineWidth=1;g.stroke();
    if(!open){g.beginPath();g.moveTo(-19,-5);g.quadraticCurveTo(-11,-3,-6,-1);g.globalAlpha=.3;g.lineWidth=.7;g.stroke();}
    g.restore();
  }
  function kite(ctx,{cx,cy,scale,tilt},flex=0,colors=palette,motion={}){
    ctx.save();ctx.translate(cx,cy);ctx.rotate(tilt);ctx.scale(scale,scale);
    const lean=motion.lean||0,belly=lean*30,rise=(motion.lift||0)*12;
    const sail=ctx.createLinearGradient(-140,-45,100,80);sail.addColorStop(0,colors['sail-light']);sail.addColorStop(.56+lean*.16,colors.sail);sail.addColorStop(1,colors['sail-light']);
    ctx.fillStyle=sail;ctx.beginPath();ctx.moveTo(0,-65);ctx.bezierCurveTo(-42,-54,-103,-16+flex,-151,33);ctx.bezierCurveTo(-94,21,-50,33,-12,64);ctx.quadraticCurveTo(0,49,12,64);ctx.bezierCurveTo(50,33,94,21,151,33);ctx.bezierCurveTo(103,-16-flex,42,-54,0,-65);ctx.closePath();ctx.fill();
    // Translucent panels, a bent leading edge, seams and a quiet trailing hem.
    ctx.fillStyle=colors['sail-light'];ctx.globalAlpha=.42-lean*.12;ctx.beginPath();ctx.moveTo(0,-65);ctx.quadraticCurveTo(-18+belly,2-rise,-12,64);ctx.quadraticCurveTo(-48,29,-92,26);ctx.quadraticCurveTo(-62,-18,0,-65);ctx.fill();ctx.globalAlpha=.26+lean*.12;ctx.beginPath();ctx.moveTo(0,-65);ctx.quadraticCurveTo(51,-12,151,33);ctx.quadraticCurveTo(87,5,12,64);ctx.quadraticCurveTo(22+belly,1-rise,0,-65);ctx.fill();ctx.globalAlpha=1;
    ctx.strokeStyle=colors.paper;ctx.globalAlpha=.35;ctx.lineWidth=.7;
    [-1,1].forEach(side=>{for(let j=1;j<5;j++){ctx.beginPath();ctx.moveTo(0,-65);ctx.quadraticCurveTo(side*j*18+belly,-16-rise,side*(12+j*27),35-j*3-side*flex*j/4);ctx.stroke();}});
    ctx.globalAlpha=.5;ctx.strokeStyle=colors.ink;ctx.lineWidth=.65;ctx.beginPath();ctx.moveTo(-151,33);ctx.bezierCurveTo(-103,-16+flex,-42,-54,0,-65);ctx.bezierCurveTo(42,-54,103,-16-flex,151,33);ctx.stroke();ctx.globalAlpha=.2;ctx.beginPath();ctx.moveTo(0,-65);ctx.quadraticCurveTo(4+belly,0-rise,0,55);ctx.stroke();ctx.globalAlpha=1;ctx.restore();
  }
  root.CrosswindArt={mountain,drawMountain,scenery,kite,petal,palette};
})(window);
