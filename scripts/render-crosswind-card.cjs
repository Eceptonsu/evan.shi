// Render the real game canvas at the Projects card's 16:9 aspect ratio.
// Usage: node scripts/render-crosswind-card.cjs [path-to-@napi-rs/canvas]
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {createCanvas,Path2D}=require(process.argv[2]||'@napi-rs/canvas');
const base=path.resolve(__dirname,'..'),canvas=createCanvas(864,486);
canvas.getBoundingClientRect=()=>({width:864,height:486});
const colors={paper:'#f4efea',ink:'#302b2c',quiet:'#6e6064',mist:'#dfcfd0',ridge:'#554e53',sail:'#ad5e78','sail-light':'#e9b9c4',line:'#51464c'};
function element(){return {style:{},dataset:{},addEventListener(){},setAttribute(){},remove(){},querySelector:()=>element()};}
const hands=['a','w','s','d'].map(key=>({...element(),dataset:{key}}));
const elements=new Map();
const root={...element(),appendChild(){},querySelectorAll:()=>hands,querySelector(selector){if(selector==='canvas')return canvas;if(!elements.has(selector))elements.set(selector,element());return elements.get(selector);}};
const document={getElementById:()=>root,addEventListener(){},createElement:tag=>tag==='canvas'?createCanvas(640,640):element()};
const window={addEventListener(){}};
const sandbox={window,document,Path2D,console,performance:{now:()=>0},devicePixelRatio:1,matchMedia:()=>({matches:false,addEventListener(){}}),getComputedStyle:el=>({color:colors[el.style.color.slice(6,-1)]}),ResizeObserver:class {constructor(fn){this.fn=fn;}observe(){this.fn();}},requestAnimationFrame(){},cancelAnimationFrame(){}};
vm.runInNewContext(fs.readFileSync(path.join(base,'assets/js/crosswind-art.js'),'utf8'),sandbox);
let source=fs.readFileSync(path.join(base,'assets/js/crosswind.js'),'utf8');
source=source.replace(/\}\)\(\);\s*$/,'globalThis.paintCard=()=>{bank=-.08;forward=1.8;draw(0);};})();');
vm.runInNewContext(source,sandbox);sandbox.paintCard();
const output=path.join(base,'assets/img/projects/cadence.png');
fs.writeFileSync(output,canvas.toBuffer('image/png'));
console.log('Rendered '+output);
