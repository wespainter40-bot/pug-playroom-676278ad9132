const CSS = `
#ui { position: fixed; inset: 0; pointer-events: none; z-index: 10; font-family: "Trebuchet MS", "Arial Rounded MT Bold", system-ui, sans-serif; color: #fff; user-select: none; -webkit-user-select: none; }
#ui * { box-sizing: border-box; }
#ui button, #ui label { pointer-events: auto; touch-action: manipulation; }
.hidden { display: none !important; }
.btn { font: 800 3.6vmin/1 "Trebuchet MS", system-ui, sans-serif; color: #fff; background: #2e9b4a; border: 0.6vmin solid #fff; border-radius: 2.4vmin;
  padding: 2vmin 3.6vmin; box-shadow: 0 1vmin 0 #17612b; cursor: pointer; letter-spacing: 0.05em; text-transform: uppercase; }
.btn:active { transform: translateY(0.8vmin); box-shadow: 0 0.2vmin 0 #17612b; }
.btn.red { background: #c0392b; box-shadow: 0 1vmin 0 #7d2118; }
.btn.red:active { box-shadow: 0 0.2vmin 0 #7d2118; }
.btn.gold { background: #f1b40f; color: #4a2c00; box-shadow: 0 1vmin 0 #9a6d00; }
.btn.small { font-size: 2.4vmin; padding: 1.2vmin 2vmin; border-width: 0.4vmin; box-shadow: 0 0.6vmin 0 #17612b; }
.btn[disabled] { filter: grayscale(1) brightness(0.7); cursor: not-allowed; }
#menu { position: absolute; inset: 0; display: grid; grid-template-columns: 1.15fr 0.85fr; padding: 4vmin 5vmin; gap: 3vmin; }
#menu .left { display: flex; flex-direction: column; gap: 1.6vmin; justify-content: safe center; min-width: 0; overflow-y: auto; }
.title { font: 900 9vmin/0.95 "Trebuchet MS", system-ui, sans-serif; text-transform: uppercase; color: #fff; text-shadow: 0 0.8vmin 0 #c0392b, 0 1.4vmin 2vmin rgba(0,0,0,.5); letter-spacing: 0.02em; }
.title span { color: #f1b40f; }
.sub { font-size: 2.6vmin; opacity: .9; margin-top: -1vmin; }
.card { background: rgba(10, 30, 18, 0.82); border: 0.5vmin solid #f1b40f; border-radius: 2.6vmin; padding: 1.6vmin 2.6vmin; display: flex; align-items: center; justify-content: space-between; gap: 2vmin; }
.card h2 { margin: 0; font-size: 3.6vmin; }
.card p { margin: 0.4vmin 0 0; font-size: 2.1vmin; opacity: .85; }
.picker { display: grid; grid-template-columns: repeat(6, 1fr); gap: 1.2vmin; }
.pick { flex: 1; min-width: 0; text-align: center; background: rgba(10, 30, 18, 0.8); border: 0.5vmin solid rgba(255,255,255,.35); border-radius: 2.2vmin; color: #fff; padding: 1.4vmin 0.6vmin; font: 800 2.3vmin/1.1 "Trebuchet MS", system-ui, sans-serif; cursor: pointer; }
.pick small { display: none; }
.pick.on { border-color: #f1b40f; background: rgba(193, 57, 43, 0.85); box-shadow: 0 0 0 0.5vmin rgba(241,180,15,.45); }
.row { display: flex; gap: 1.6vmin; flex-wrap: wrap; align-items: center; }
.info { font-size: 2.3vmin; opacity: .92; }
.warn { color: #ffd1cc; font-weight: 800; }
#hud { position: absolute; left: 2.4vmin; top: 2.4vmin; display: flex; flex-direction: column; gap: 0.8vmin; }
.pill { background: rgba(10, 30, 18, 0.78); border: 0.4vmin solid rgba(255,255,255,.5); border-radius: 1.8vmin; padding: 0.9vmin 1.8vmin; font: 800 3vmin/1.1 "Trebuchet MS", system-ui, sans-serif; display: flex; gap: 1.4vmin; align-items: baseline; }
.pill b { font-size: 1.8vmin; opacity: .75; letter-spacing: .1em; }
#h-hidden-pill { background: #1b86b8; border-color: #fff; letter-spacing: .15em; }
.meter { display: inline-block; width: 12vmin; height: 2.2vmin; background: rgba(255,255,255,.2); border-radius: 1vmin; overflow: hidden; align-self: center; }
.meter i { display: block; height: 100%; width: 0; background: #2e9b4a; }
#dev-badge { background: #8e44ad; border-color: #fff; letter-spacing: .15em; }
#switches { position: absolute; right: 2vmin; top: 2vmin; display: flex; flex-direction: column; gap: 0.8vmin; align-items: flex-end; }
.sw { display: flex; align-items: center; gap: 1vmin; background: rgba(10, 30, 18, 0.78); border: 0.4vmin solid rgba(255,255,255,.4); border-radius: 1.8vmin; padding: 0.8vmin 1.4vmin; font-size: 2.2vmin; font-weight: 700; cursor: pointer; }
.sw input { width: 2.6vmin; height: 2.6vmin; accent-color: #2e9b4a; }
#playbar { position: absolute; left: 50%; top: 2vmin; transform: translateX(-50%); display: flex; gap: 1.4vmin; }
#toast { position: absolute; left: 50%; bottom: 6vmin; transform: translateX(-50%); max-width: 70vw; background: rgba(255,255,255,.96); color: #153a22; border: 0.6vmin solid #2e9b4a; border-radius: 2.4vmin; padding: 1.6vmin 2.6vmin; font: 700 2.8vmin/1.25 "Trebuchet MS", system-ui, sans-serif; text-align: center; box-shadow: 0 1vmin 3vmin rgba(0,0,0,.45); }
#toast .who { display: block; font-size: 1.8vmin; color: #1b86b8; letter-spacing: .12em; text-transform: uppercase; margin-bottom: 0.4vmin; }
.modal { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; background: rgba(5, 14, 9, 0.7); }
.modal .box { background: #10361f; border: 0.8vmin solid #f1b40f; border-radius: 3vmin; padding: 4vmin 5vmin; text-align: center; max-width: 80vw; display: flex; flex-direction: column; gap: 2vmin; align-items: center; }
.modal h1 { margin: 0; font: 900 7vmin/1 "Trebuchet MS", system-ui, sans-serif; text-transform: uppercase; color: #f1b40f; text-shadow: 0 0.6vmin 0 #7d2118; }
.modal .big { font-size: 4vmin; font-weight: 800; }
.badge { background: #c0392b; border: 0.4vmin solid #fff; border-radius: 99vmin; padding: 0.6vmin 2.4vmin; font-weight: 900; letter-spacing: .12em; font-size: 3vmin; }
`;

export function fmtTime(s) {
  if (!Number.isFinite(s)) return '--';
  const m = Math.floor(s / 60);
  const r = s - m * 60;
  return `${m}:${r.toFixed(1).padStart(4, '0')}`;
}

export function fmtClock(s) {
  const t = Math.max(0, Math.ceil(s));
  return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;
}

function el(html) {
  const t = document.createElement('template');
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
}

export function createUI({ characters, games, on }) {
  const style = document.createElement('style');
  style.textContent = CSS;
  document.head.appendChild(style);

  const root = document.getElementById('ui') || document.body.appendChild(el('<div id="ui"></div>'));
  root.innerHTML = `
    <div id="menu" class="hidden">
      <div class="left">
        <div class="title">Pug <span>Playroom</span></div>
        <div class="sub">Pearson and Dad's private game room</div>
        <div id="games"></div>
        <div class="picker" id="picker"></div>
        <div class="row">
          <button class="btn gold small" id="griddy">Do the Griddy!</button>
          <div class="info" id="menu-info"></div>
        </div>
      </div>
      <div class="right"></div>
    </div>
    <div id="hud" class="hidden">
      <div class="pill"><b>TIME</b><span id="h-time">0:00.0</span></div>
      <div class="pill"><b id="h-item-label">BONES</b><span id="h-bones">0/12</span></div>
      <div class="pill" id="h-saved-pill"><b>SAVED</b><span id="h-saved">0</span></div>
      <div class="pill" id="h-left-pill"><b>TODAY LEFT</b><span id="h-left">60:00</span></div>
      <div class="pill hidden" id="h-toys-pill"><b>TOYS</b><span id="h-toys">0</span></div>
      <div class="pill hidden" id="h-dance-pill"><b>DJ DANCE</b><span id="h-dance">READY</span></div>
      <div class="pill hidden" id="h-noise-pill"><b>NOISE</b><span class="meter"><i id="h-noise"></i></span></div>
      <div class="pill hidden" id="h-hidden-pill">HIDDEN</div>
      <div class="pill hidden" id="dev-badge">DEV</div>
    </div>
    <div id="playbar" class="hidden">
      <button class="btn small red" id="b-restart">Restart!</button>
      <button class="btn small" id="b-sound">Sound on</button>
      <button class="btn small" id="b-menu">Menu</button>
    </div>
    <div id="switches">
      <label class="sw"><input type="checkbox" id="sw-dev"> Developer mode</label>
      <label class="sw"><input type="checkbox" id="sw-limit"> 1-hour daily limit</label>
      <label class="sw"><input type="checkbox" id="sw-buddy"> Orbit buddy</label>
      <label class="sw"><input type="checkbox" id="sw-sound"> Sound and music</label>
      <label class="sw"><input type="checkbox" id="sw-scary"> Scary mode (off is gentle)</label>
    </div>
    <div id="toast" class="hidden"></div>
    <div id="win" class="modal hidden"></div>
    <div id="locked" class="modal hidden"></div>`;

  const q = (id) => root.querySelector(id);
  const gamesEl = q('#games');
  const pickerEl = q('#picker');

  const gameButtons = games.map((g) => {
    const card = el(`<div class="card"><div><h2>${g.title}</h2><p>${g.blurb}</p><p id="best-${g.id}"></p></div><button class="btn" data-play="${g.id}">Play!</button></div>`);
    card.querySelector('button').addEventListener('click', () => on.play(g.id));
    gamesEl.appendChild(card);
    return { id: g.id, btn: card.querySelector('button'), best: card.querySelector(`#best-${g.id}`) };
  });

  const pickButtons = characters.map((c) => {
    const b = el(`<button class="pick" data-id="${c.id}" title="${c.blurb}">${c.name}<small>${c.blurb}</small></button>`);
    b.addEventListener('click', () => on.pick(c.id));
    pickerEl.appendChild(b);
    return b;
  });

  q('#griddy').addEventListener('click', () => on.griddy());
  q('#b-menu').addEventListener('click', () => on.menu());
  q('#b-restart').addEventListener('click', () => on.restart());
  q('#sw-dev').addEventListener('change', (e) => on.dev(e.target.checked));
  q('#sw-limit').addEventListener('change', (e) => on.limit(e.target.checked));
  q('#sw-buddy').addEventListener('change', (e) => on.buddy(e.target.checked));
  q('#sw-sound').addEventListener('change', (e) => on.sound(e.target.checked));
  q('#sw-scary').addEventListener('change', (e) => on.scary(e.target.checked));
  q('#b-sound').addEventListener('click', () => on.sound(q('#b-sound').dataset.on !== '1'));

  let toastTimer = 0;

  return {
    showMenu(info) {
      q('#menu').classList.remove('hidden');
      q('#switches').classList.remove('hidden');
      q('#hud').classList.add('hidden');
      q('#playbar').classList.add('hidden');
      pickButtons.forEach((b) => b.classList.toggle('on', b.dataset.id === info.character));
      gameButtons.forEach((g) => {
        g.btn.disabled = !!info.locked;
        const best = info.bestTimes && info.bestTimes[g.id];
        g.best.textContent = Number.isFinite(best) ? `Best time: ${fmtTime(best)}` : 'No best time yet';
      });
      const bonesLine = `Golden bones saved: ${info.bonesTotal}. Collect them in a run and win to keep them.`;
      q('#menu-info').innerHTML = info.locked
        ? `<span class="warn">Time's up for today, pup. Come back tomorrow!</span>`
        : bonesLine;
    },
    hideMenu() { q('#menu').classList.add('hidden'); },
    showHud() {
      q('#switches').classList.add('hidden');
      q('#hud').classList.remove('hidden');
      q('#playbar').classList.remove('hidden');
    },
    setHud({ time, bonesRun, bonesMax, saved, remaining, dev, toys, noise, hidden, itemLabel, dance }) {
      q('#h-time').textContent = fmtTime(time);
      q('#h-item-label').textContent = itemLabel || 'BONES';
      q('#h-saved-pill').classList.toggle('hidden', !!itemLabel);
      q('#h-bones').textContent = `${bonesRun}/${bonesMax}`;
      q('#h-saved').textContent = String(saved);
      q('#h-left-pill').classList.toggle('hidden', !Number.isFinite(remaining));
      if (Number.isFinite(remaining)) q('#h-left').textContent = fmtClock(remaining);
      q('#dev-badge').classList.toggle('hidden', !dev);
      const hasToys = Number.isFinite(toys), hasNoise = Number.isFinite(noise), hasDance = Number.isFinite(dance);
      q('#h-toys-pill').classList.toggle('hidden', !hasToys);
      q('#h-noise-pill').classList.toggle('hidden', !hasNoise);
      q('#h-hidden-pill').classList.toggle('hidden', !hasNoise || !hidden);
      q('#h-dance-pill').classList.toggle('hidden', !hasDance);
      if (hasDance) q('#h-dance').textContent = dance > 0 ? `${dance}s` : 'READY';
      if (hasToys) q('#h-toys').textContent = String(toys);
      if (hasNoise) {
        const n = Math.max(0, Math.min(1, noise || 0));
        const bar = q('#h-noise');
        bar.style.width = `${Math.round(n * 100)}%`;
        bar.style.background = n > 0.66 ? '#c0392b' : n > 0.33 ? '#f1b40f' : '#2e9b4a';
      }
    },
    setSwitches({ dev, limit, buddy, sound, scary }) {
      q('#sw-dev').checked = !!dev;
      q('#sw-limit').checked = !!limit;
      q('#sw-buddy').checked = !!buddy;
      q('#sw-sound').checked = !!sound;
      q('#sw-scary').checked = !!scary;
      const b = q('#b-sound');
      b.dataset.on = sound ? '1' : '0';
      b.textContent = sound ? 'Sound on' : 'Sound off';
    },
    toast(text, ms = 3500, who = '') {
      const t = q('#toast');
      t.innerHTML = (who ? `<span class="who">${who}</span>` : '') + text;
      t.classList.remove('hidden');
      clearTimeout(toastTimer);
      toastTimer = setTimeout(() => t.classList.add('hidden'), ms);
    },
    clearToast() { clearTimeout(toastTimer); q('#toast').classList.add('hidden'); },
    showWin(res) {
      const w = q('#win');
      w.innerHTML = `<div class="box">
        <h1>You made it!</h1>
        <div class="big">Time ${fmtTime(res.time)}</div>
        ${res.isBest ? '<div class="badge">NEW BEST</div>' : ''}
        <div class="big">${res.summary || `Bones banked: ${res.bonesBanked} (saved total ${res.total})`}</div>
        <div class="row"><button class="btn" id="w-menu">Back to menu</button><button class="btn red" id="w-again">Play again</button></div>
      </div>`;
      w.classList.remove('hidden');
      w.querySelector('#w-menu').addEventListener('click', () => on.menu());
      w.querySelector('#w-again').addEventListener('click', () => on.again());
    },
    hideWin() { q('#win').classList.add('hidden'); },
    showLocked() {
      const l = q('#locked');
      l.innerHTML = `<div class="box"><h1>Time's up for today, pup</h1><div class="big">That was a whole hour of playing. See you tomorrow!</div><button class="btn" id="l-ok">OK</button></div>`;
      l.classList.remove('hidden');
      l.querySelector('#l-ok').addEventListener('click', () => l.classList.add('hidden'));
    },
    hideLocked() { q('#locked').classList.add('hidden'); },
  };
}
