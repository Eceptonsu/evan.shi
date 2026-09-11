(function () {
  'use strict';
  if (window.__resumeWorkshopInstalled) return;
  window.__resumeWorkshopInstalled = true;
  let current;
  function refresh() {
    const mount = document.querySelector('#_main [data-workshop-mount]');
    if (current?.mount === mount) return;
    current?.dispose(); current = null;
    if (!mount) return;
    const root = mount.querySelector('[data-resume-workshop]');
    const mode = mount.querySelector('[data-resume-mode]');
    const classic = document.getElementById('resume');
    const status = root.querySelector('[data-workshop-status]');
    const annotations = [...root.querySelectorAll('[data-workshop-chapter]')];
    const nav = [...root.querySelectorAll('.workshop__nav [data-workshop-jump]')];
    const dialog = root.querySelector('[data-workshop-dialog]');
    const scrubber = root.querySelector('[data-workshop-scrubber]');
    const reduced = matchMedia('(prefers-reduced-motion: reduce)');
    const events = new AbortController();
    let scene, controls, pending, visible = false, disposed = false, frame = 0, lastShot = -1;
    let detailOpener;
    let layoutKey='';
    const inerted = new Map();
    mode.hidden = false;

    function present({ progress, shot, point, side, name }) {
      const width = root.clientWidth, height = root.clientHeight;
      if (shot !== lastShot) {
        // Avoid losing keyboard focus when scrolling away from an annotation.
        if (annotations[lastShot]?.contains(document.activeElement)) root.focus({ preventScroll:true });
        annotations.forEach((node,index) => { node.hidden = index !== shot; });
        nav.forEach((node,index) => { if (index === shot) node.setAttribute('aria-current','step'); else node.removeAttribute('aria-current'); });
        root.querySelector('[data-workshop-caption]').textContent = `${String(shot+1).padStart(2,'0')} / ${name}`;
        lastShot = shot;
      }
      const annotation = annotations[shot];
      const small = width <= 700;
      const nextLayout=`${shot}/${width}/${height}/${side}`;
      if(layoutKey!==nextLayout){
        const w = annotation.offsetWidth, h = annotation.offsetHeight;
        const clamp = (n,a,b) => Math.max(a,Math.min(Math.max(a,b),n));
        const margin=Math.max(30,width*.065);
        const x = small ? 10 : side==='right'?width-w-margin:margin;
        const y = small ? height - h - 60 : clamp(height*.48-h*.5,100,height-h-80);
        annotation.style.left = `${x}px`; annotation.style.top = `${Math.max(75,y)}px`;
        annotation.style.opacity = '1';layoutKey=nextLayout;
      }
      root.querySelector('[data-workshop-progress]').style.transform = `scaleX(${progress/(annotations.length-1)})`;
      scrubber.value=String(root.scrollTop/Math.max(1,root.scrollHeight-root.clientHeight)*(annotations.length-1));
      scrubber.setAttribute('aria-valuetext',`${name}, section ${shot+1} of ${annotations.length}`);
    }
    function progress() { return root.scrollTop / Math.max(1,root.scrollHeight-root.clientHeight) * (annotations.length-1); }
    function update() { frame = 0; if (visible) scene?.setProgress(progress(),reduced.matches); }
    function schedule() { if (!frame && visible) frame=requestAnimationFrame(update); }
    function setBackgroundInert(value) {
      if (value) {
        for (const child of document.body.children) if (child !== root && !inerted.has(child)) { inerted.set(child,child.inert); child.inert=true; }
      } else { inerted.forEach((value,node) => { node.inert=value; }); inerted.clear(); }
    }
    async function setView(next, focus = true) {
      visible = next === '3d';
      if (visible) document.body.append(root);
      root.hidden = !visible; classic.hidden = visible;
      document.body.classList.toggle('workshop-open',visible);
      setBackgroundInert(visible);
      if (!visible) { controls?.cancel(); if (dialog.open) dialog.close(); mount.append(root); }
      mode.querySelectorAll('[data-resume-view]').forEach(button => button.setAttribute('aria-pressed',String(button.dataset.resumeView === next)));
      if (focus) (visible ? root : mode.querySelector('[data-resume-view="classic"]')).focus({ preventScroll:true });
      const url = new URL(location.href); if (visible) url.hash='workshop'; else if (url.hash === '#workshop') url.hash='';
      history.replaceState(history.state,'',url);
      scene?.setActive(visible && !document.hidden);
      if (!visible || disposed) return;
      schedule();
      if (scene || pending) return;
      status.textContent='Opening the workshop…';
      pending=Promise.all([import('./resume-workshop-scene.js'),import('./resume-workshop-input.js')]).then(([module,input]) => {
        if (disposed) return null;
        controls??=input.attachJourneyInput(root,{isEnabled:()=>visible&&!dialog.open,isReduced:()=>reduced.matches,onNavigate:schedule,onEngage:()=>scene?.setPointer(0,0)});
        return module.createWorkshop(root.querySelector('[data-workshop-canvas]'),events.signal,() => {
          status.textContent='The scene was interrupted. Return to Classic and reopen the workshop to retry.';
          scene?.dispose(); scene=null;
        },present);
      });
      try {
        const loaded=await pending;
        if (disposed) { loaded?.dispose(); return; }
        scene=loaded; status.textContent=''; scene?.setActive(visible && !document.hidden); schedule();
      } catch (error) {
        if (!disposed) { status.textContent='The workshop could not load. Select Classic résumé to read everything, or reopen 3D to retry.'; console.warn('Resume workshop:',error); }
      } finally { pending=null; }
    }
    function jump(index) {
      controls?.cancel();
      root.scrollTo({ top:index/(annotations.length-1)*(root.scrollHeight-root.clientHeight), behavior:reduced.matches?'instant':'smooth' });
    }
    function seek(value){controls?.cancel();root.scrollTo({top:Math.max(0,Math.min(7,value))/7*(root.scrollHeight-root.clientHeight),behavior:'instant'});schedule();}
    scrubber.addEventListener('input',()=>seek(Number(scrubber.value)),{signal:events.signal});
    scrubber.addEventListener('keydown',event=>{
      const steps={ArrowLeft:-.1,ArrowDown:-.1,ArrowRight:.1,ArrowUp:.1,PageDown:1,PageUp:-1};
      if(event.key in steps||event.key==='Home'||event.key==='End'){
        event.preventDefault();event.stopPropagation();
        seek(event.key==='Home'?0:event.key==='End'?7:Number(scrubber.value)+steps[event.key]);
      }
    },{signal:events.signal});
    mode.addEventListener('click',event => { const button=event.target.closest('[data-resume-view]'); if (button) setView(button.dataset.resumeView); },{ signal:events.signal });
    root.addEventListener('click',event => {
      if (event.target.closest('[data-workshop-classic]')) setView('classic');
      const chapter=event.target.closest('[data-workshop-jump]'); if (chapter) jump(Number(chapter.dataset.workshopJump));
      const detail=event.target.closest('[data-workshop-detail]');
      if (detail) {
        const template=root.querySelector(`[data-workshop-template="${detail.dataset.workshopDetail}"]`);
        root.querySelector('[data-workshop-detail-content]').replaceChildren(template.content.cloneNode(true));
        root.querySelector('#workshop-detail-title').textContent=template.dataset.title;
        controls?.cancel();detailOpener=detail; dialog.showModal(); scene?.setActive(false);
      }
      if (event.target.closest('[data-workshop-close]')) dialog.close();
      if (event.target === dialog) { const r=dialog.getBoundingClientRect(); if (event.clientX<r.left || event.clientX>r.right || event.clientY<r.top || event.clientY>r.bottom) dialog.close(); }
    },{ signal:events.signal });
    dialog.addEventListener('close',() => { scene?.setActive(visible && !document.hidden); detailOpener?.focus({ preventScroll:true }); },{ signal:events.signal });
    root.addEventListener('keydown',event => {
      if (dialog.open) return;
      if (event.key === 'Escape') { event.preventDefault(); setView('classic'); }
      if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') { event.preventDefault(); jump(Math.max(0,Math.min(7,lastShot+(event.key === 'ArrowRight'?1:-1)))); }
      if (event.key === 'Tab') {
        const focusable=[...root.querySelectorAll('button,a[href],input')].filter(node => node.getClientRects().length && !node.closest('dialog'));
        const first=focusable[0], last=focusable.at(-1);
        if (event.shiftKey && (document.activeElement === first || document.activeElement === root)) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
      }
    },{ signal:events.signal });
    root.addEventListener('scroll',schedule,{ passive:true,signal:events.signal });
    root.addEventListener('pointermove',event => { if (!reduced.matches && event.pointerType === 'mouse'&&!root.classList.contains('is-dragging')) scene?.setPointer((event.clientX/root.clientWidth-.5)*2,(event.clientY/root.clientHeight-.5)*2); },{ passive:true,signal:events.signal });
    root.addEventListener('pointerleave',()=>scene?.setPointer(0,0),{signal:events.signal});
    window.addEventListener('resize',schedule,{ passive:true,signal:events.signal });
    reduced.addEventListener('change',schedule,{ signal:events.signal });
    document.addEventListener('visibilitychange',() => {if(document.hidden)controls?.cancel();scene?.setActive(visible && !document.hidden && !dialog.open);},{ signal:events.signal });
    current={ mount,dispose() { disposed=true; events.abort(); controls?.dispose();cancelAnimationFrame(frame); scene?.dispose(); if (dialog.open) dialog.close(); setBackgroundInert(false); document.body.classList.remove('workshop-open'); if (mount.isConnected) mount.append(root); else root.remove(); } };
    if (location.hash === '#workshop') setView('3d');
  }
  refresh();
  document.getElementById('_pushState')?.addEventListener('hy-push-state-after',refresh);
}());
