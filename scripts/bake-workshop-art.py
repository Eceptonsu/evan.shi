"""Reproducible original parallax artwork; no per-pixel noise at runtime."""
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw

OUT = Path(__file__).resolve().parents[1] / 'assets/img/workshop'
OUT.mkdir(parents=True, exist_ok=True)
rng = np.random.default_rng(2718)

def noise(w, h, seed=1):
    random = np.random.default_rng(seed)
    result = np.zeros((h, w), dtype=np.float32)
    for scale, weight in [(8, .5), (20, .25), (48, .13), (120, .07), (280, .035)]:
        small = random.integers(0, 256, (max(2, scale//2), scale), dtype=np.uint8)
        result += np.asarray(Image.fromarray(small).resize((w,h), Image.Resampling.BICUBIC))/255*weight
    return result

w,h=2048,1024
y,x=np.mgrid[0:h,0:w]/np.array([h,w])[:,None,None]
n=noise(w,h)
band=np.exp(-((y-.5+.19*np.sin(x*6.283)+(n-.5)*.42)/.16)**2)
filament=np.clip(1-n*1.32,0,1)**2*band
mix=(np.sin(x*6.283)+1)/2
cold=np.array([38,113,146]); warm=np.array([133,63,134])
tint=cold[None,None,:]*mix[:,:,None]+warm[None,None,:]*(1-mix[:,:,None])
rgb=np.array([3,5,16])+tint*filament[:,:,None]*2.2
core=np.exp(-(((x-.65)/.09)**2+((y-.63)/.12)**2))*band
rgb+=core[:,:,None]*np.array([115,74,48])
sky=Image.fromarray(np.uint8(np.clip(rgb,0,255)))
draw=ImageDraw.Draw(sky)
for i in range(1800):
    px=int(rng.random()*w); py=int(rng.random()*h); light=int(rng.uniform(65,210))
    draw.point((px,py),fill=(light,light,min(255,light+30)))
sky.save(OUT/'nebula.jpg',quality=90,optimize=True)

# Silky transparent foreground clouds, layered independently of the background.
w,h=1024,512
y,x=np.mgrid[0:h,0:w]/np.array([h,w])[:,None,None]
n=noise(w,h,22)
alpha=np.exp(-((y-.5-.16*np.sin(x*5)+(n-.5)*.3)/.12)**2)*np.sin(x*np.pi)**2
rgba=np.zeros((h,w,4),dtype=np.uint8)
rgba[:,:,:3]=[103,125,196];rgba[:,:,3]=np.uint8(alpha*95)
Image.fromarray(rgba).save(OUT/'veil.png',optimize=True)

# Lit planetary portraits: turbulent bands, broken sea ice, and crater relief.
size=768
yy,xx=np.mgrid[-1.6:1.6:complex(size),-1.6:1.6:complex(size)]
r=np.sqrt(xx*xx+yy*yy); z=np.sqrt(np.clip(1-r*r,0,1))
for kind in range(3):
    n=noise(size,size,41+kind); fine=noise(size,size,81+kind)
    if kind==0:
        bands=np.sin(yy*64+(n-.5)*19+np.sin(xx*8)*1.3)*.5+.5
        storm=np.exp(-(((xx-.32)/.26)**2+((yy-.23)/.13)**2))
        bands=np.clip(bands*.6+n*.6-storm*.5,0,1)
        color=np.array([72,77,126])+bands[:,:,None]*np.array([141,107,72])
    elif kind==1:
        islands=np.clip((n-.47)*9,0,1)
        fractures=np.exp(-((fine-.48)*110)**2)
        color=np.array([14,53,78])+islands[:,:,None]*np.array([130,146,137])
        color+=fractures[:,:,None]*np.array([23,37,39])
    else:
        relief=(n-.5)*.8
        for _ in range(90):
            cx,cy=rng.uniform(-1,1,2); radius=rng.uniform(.015,.13)
            dist=np.sqrt((xx-cx)**2+(yy-cy)**2)/radius
            relief+=np.exp(-((dist-1)*8)**2)*.13-np.exp(-(dist*1.8)**2)*.1
        dy,dx=np.gradient(relief)
        color=(np.array([155,99,69])*(.75+n[:,:,None]*.5))*(1+np.clip((dx-dy)*38,-.6,.6))[:,:,None]
    light=np.clip(-xx*.58-yy*.46+z*.67,0,1)
    color*= (.07+light*.93)[:,:,None]
    rim=(1-z)**5*np.clip(light+.25,0,1)
    color+=rim[:,:,None]*np.array([60,110,168])
    alpha=np.clip((1-r)*size/3,0,1)
    image=np.dstack((np.uint8(np.clip(color,0,255)),np.uint8(alpha*255)))
    if kind==0:
        # Rings run behind the upper hemisphere and across the lower limb.
        rx=xx*.94-yy*.34; ry=xx*.34+yy*.94
        rr=np.sqrt(rx*rx+(ry/.33)**2)
        grain=.5+.22*np.sin(rr*220)+.12*np.sin(rr*590)
        ring=np.clip((rr-1.12)*30,0,1)*np.clip((1.57-rr)*30,0,1)
        ring*=np.clip(abs(rr-1.33)*90,0,1)*(.3+grain*.5)
        ring*=((r>1)|(ry>0))
        a=ring[:,:,None]
        image[:,:,:3]=np.uint8(image[:,:,:3]*(1-a)+np.array([173,150,131])*a)
        image[:,:,3]=np.uint8(np.maximum(alpha,ring)*255)
    Image.fromarray(image).save(OUT/f'planet-{kind}.png',optimize=True)
print('Baked nebula, transparent veils, and three detailed planetary portraits.')
