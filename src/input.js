const LOOK_SENS = 0.006;
const STICK_RADIUS = 60;

export function createInput(canvas, opts = {}) {
  const jumpLabel = opts.jumpLabel || 'JUMP';
  const extras = !!opts.extras;
  const keys = new Set();
  let lookDelta = 0;
  let dragId = null;
  let lastX = 0;
  let stick = { x: 0, y: 0, id: null };
  let jumpTouch = false;
  let sneakTouch = false;
  let throwFlag = false;
  const cleanups = [];
  const on = (target, type, fn, opts) => {
    target.addEventListener(type, fn, opts);
    cleanups.push(() => target.removeEventListener(type, fn, opts));
  };

  on(window, 'keydown', (e) => {
    keys.add(e.code);
    if (e.code === 'KeyE' && !e.repeat) throwFlag = true;
    if (e.code === 'Space') e.preventDefault();
  });
  on(window, 'keyup', (e) => keys.delete(e.code));
  on(window, 'blur', () => keys.clear());

  on(canvas, 'pointerdown', (e) => {
    if (dragId !== null) return;
    if (e.pointerType === 'touch' && e.clientX < window.innerWidth / 2) return;
    dragId = e.pointerId;
    lastX = e.clientX;
    canvas.setPointerCapture?.(e.pointerId);
  });
  on(canvas, 'pointermove', (e) => {
    if (e.pointerId !== dragId) return;
    lookDelta -= (e.clientX - lastX) * LOOK_SENS;
    lastX = e.clientX;
  });
  const endDrag = (e) => { if (e.pointerId === dragId) dragId = null; };
  on(canvas, 'pointerup', endDrag);
  on(canvas, 'pointercancel', endDrag);

  const coarse = window.matchMedia?.('(pointer: coarse)').matches || 'ontouchstart' in window;
  let ui = null;
  if (coarse) {
    ui = document.createElement('div');
    ui.id = 'touch-ui';
    ui.innerHTML = `
      <div id="stick-base"><div id="stick-knob"></div></div>
      <div id="jump-btn">${jumpLabel}</div>${extras ? '<div id="sneak-btn" class="xbtn">SNEAK</div><div id="throw-btn" class="xbtn">THROW</div>' : ''}`;
    const style = document.createElement('style');
    style.textContent = `
      #touch-ui { position: fixed; inset: 0; pointer-events: none; z-index: 5; user-select: none; -webkit-user-select: none; }
      #stick-base { position: absolute; left: 6vmin; bottom: 8vmin; width: 28vmin; height: 28vmin; border-radius: 50%;
        background: rgba(255,255,255,.14); border: 2px solid rgba(255,255,255,.35); pointer-events: auto; touch-action: none; }
      #stick-knob { position: absolute; left: 50%; top: 50%; width: 12vmin; height: 12vmin; margin: -6vmin 0 0 -6vmin;
        border-radius: 50%; background: rgba(255,255,255,.55); }
      #jump-btn { position: absolute; right: 7vmin; bottom: 10vmin; width: 20vmin; height: 20vmin; border-radius: 50%;
        background: rgba(46,155,74,.75); border: 3px solid rgba(255,255,255,.7); color: #fff; font: 700 3.4vmin sans-serif;
        display: flex; align-items: center; justify-content: center; pointer-events: auto; touch-action: none; }
      .xbtn { position: absolute; width: 15vmin; height: 15vmin; border-radius: 50%; background: rgba(241,180,15,.78); border: 3px solid rgba(255,255,255,.7);
        color: #4a2c00; font: 800 2.8vmin sans-serif; display: flex; align-items: center; justify-content: center; pointer-events: auto; touch-action: none; }
      #throw-btn { right: 29vmin; bottom: 8vmin; }
      #sneak-btn { right: 8vmin; bottom: 33vmin; }`;
    document.head.appendChild(style);
    document.body.appendChild(ui);
    cleanups.push(() => { ui.remove(); style.remove(); });

    const base = ui.querySelector('#stick-base');
    const knob = ui.querySelector('#stick-knob');
    const jump = ui.querySelector('#jump-btn');
    const setKnob = () => { knob.style.transform = `translate(${stick.x * 22}%, ${stick.y * 22}%)`; };

    on(base, 'pointerdown', (e) => {
      stick.id = e.pointerId;
      base.setPointerCapture(e.pointerId);
      moveStick(e);
    });
    const moveStick = (e) => {
      const r = base.getBoundingClientRect();
      const dx = e.clientX - (r.left + r.width / 2);
      const dy = e.clientY - (r.top + r.height / 2);
      const radius = Math.max(STICK_RADIUS, r.width / 2);
      const len = Math.hypot(dx, dy) || 1;
      const k = Math.min(1, len / radius) / len;
      stick.x = dx * k;
      stick.y = dy * k;
      setKnob();
    };
    on(base, 'pointermove', (e) => { if (e.pointerId === stick.id) moveStick(e); });
    const endStick = (e) => {
      if (e.pointerId !== stick.id) return;
      stick = { x: 0, y: 0, id: null };
      setKnob();
    };
    on(base, 'pointerup', endStick);
    on(base, 'pointercancel', endStick);

    on(jump, 'pointerdown', (e) => { jumpTouch = true; jump.setPointerCapture(e.pointerId); });
    on(jump, 'pointerup', () => { jumpTouch = false; });
    on(jump, 'pointercancel', () => { jumpTouch = false; });

    if (extras) {
      const sneak = ui.querySelector('#sneak-btn');
      const toss = ui.querySelector('#throw-btn');
      on(sneak, 'pointerdown', (e) => { sneakTouch = true; sneak.setPointerCapture(e.pointerId); });
      on(sneak, 'pointerup', () => { sneakTouch = false; });
      on(sneak, 'pointercancel', () => { sneakTouch = false; });
      on(toss, 'pointerdown', () => { throwFlag = true; });
    }
  }

  return {
    read() {
      let moveX = 0, moveZ = 0;
      if (keys.has('KeyD') || keys.has('ArrowRight')) moveX += 1;
      if (keys.has('KeyA') || keys.has('ArrowLeft')) moveX -= 1;
      if (keys.has('KeyW') || keys.has('ArrowUp')) moveZ += 1;
      if (keys.has('KeyS') || keys.has('ArrowDown')) moveZ -= 1;
      moveX += stick.x;
      moveZ -= stick.y;
      const len = Math.hypot(moveX, moveZ);
      if (len > 1) { moveX /= len; moveZ /= len; }
      const out = {
        moveX, moveZ, jump: keys.has('Space') || jumpTouch, lookDeltaX: lookDelta,
        tiptoe: keys.has('ShiftLeft') || keys.has('ShiftRight') || sneakTouch,
        throwPressed: throwFlag,
      };
      lookDelta = 0;
      throwFlag = false;
      return out;
    },
    destroy() { cleanups.forEach((fn) => fn()); },
  };
}
