/* Golden Hours — Golden State Airlines Flight 14-CA
   App logic: Pomofocus-style timer, tasks, journey progress, dialogs, narration.

   Timer accuracy: the timer never counts ticks. It stores the wall-clock time the
   session ends (endAt) and derives the remaining time from Date.now(). Ticks come
   from a Web Worker (not throttled like tab timers), and the alarm is queued on the
   Web Audio clock when a session starts, so it rings on time with the tab minimized. */
(function () {
  'use strict';

  const D = window.GH_DATA, SPOTS = D.spots, N = SPOTS.length;
  const KEY = 'goldenHours.flight14ca.v1';
  const HOUR = 3600000, MIN = 60000;
  const $ = function (s, r) { return (r || document).querySelector(s); };
  const $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  const Audio = window.GHAudio;
  const MODE_NAMES = { focus: 'Focus', short: 'Short break', long: 'Long break' };

  // ------------------------------------------------------------------ state
  const DEFAULT_SETTINGS = {
    focus: 60, short: 10, long: 40, interval: 4,
    autoBreaks: false, autoFocus: false,
    alarm: 'cabin-chime', volume: 70, repeat: 1, muted: false,
    ambience: false, ambienceVolume: 35,
    narrator: false, voiceRate: 1,
    notify: false, titleTimer: true, reduceMotion: false
  };

  function fresh() {
    return {
      v: 1,
      settings: Object.assign({}, DEFAULT_SETTINGS),
      timer: { mode: 'focus', running: false, endAt: 0, remaining: 60 * MIN, duration: 60 * MIN, credited: 0, rounds: 0 },
      progress: { focusMs: 0, unlocked: 0, sessions: 0, daily: {}, arrivals: [], finaleSeen: false },
      tasks: [], activeTask: null, passenger: '', boarded: false
    };
  }
  function num(v, d, lo, hi) { v = Number(v); if (!isFinite(v)) return d; return Math.min(hi, Math.max(lo, v)); }
  function merge(raw) {
    const f = fresh();
    if (!raw || typeof raw !== 'object') return f;
    const s = Object.assign(f.settings, raw.settings || {});
    s.focus = Math.round(num(s.focus, 60, 1, 180)); s.short = Math.round(num(s.short, 10, 1, 60));
    s.long = Math.round(num(s.long, 40, 1, 120)); s.interval = Math.round(num(s.interval, 4, 1, 12));
    s.volume = num(s.volume, 70, 0, 100); s.repeat = Math.round(num(s.repeat, 1, 1, 5));
    s.ambienceVolume = num(s.ambienceVolume, 35, 0, 100); s.voiceRate = num(s.voiceRate, 1, 0.7, 1.4);
    if (['cabin-chime', 'arrival-chime', 'boarding-bell', 'jet-flyby'].indexOf(s.alarm) < 0) s.alarm = 'cabin-chime';
    const t = Object.assign(f.timer, raw.timer || {});
    if (!MODE_NAMES[t.mode]) t.mode = 'focus';
    t.duration = num(t.duration, s[t.mode] * MIN, 1000, 180 * MIN);
    t.remaining = num(t.remaining, t.duration, 0, t.duration);
    t.credited = num(t.credited, 0, 0, t.duration);
    t.rounds = Math.round(num(t.rounds, 0, 0, 9999));
    t.endAt = num(t.endAt, 0, 0, 9e15); t.running = !!t.running && t.endAt > 0;
    const p = Object.assign(f.progress, raw.progress || {});
    p.focusMs = num(p.focusMs, 0, 0, 1e12); p.sessions = Math.round(num(p.sessions, 0, 0, 1e6));
    p.daily = (raw.progress && raw.progress.daily && typeof raw.progress.daily === 'object') ? raw.progress.daily : {};
    p.arrivals = Array.isArray(p.arrivals) ? p.arrivals.filter(function (a) { return a && a.n >= 1 && a.n <= N; }) : [];
    p.unlocked = Math.min(N, Math.floor(p.focusMs / HOUR));
    p.finaleSeen = !!p.finaleSeen;
    f.tasks = Array.isArray(raw.tasks) ? raw.tasks.filter(function (x) { return x && typeof x.title === 'string'; }).map(function (x) {
      return { id: String(x.id || uid()), title: x.title.slice(0, 200), note: String(x.note || '').slice(0, 1000), est: Math.round(num(x.est, 1, 1, 99)), act: Math.round(num(x.act, 0, 0, 999)), done: !!x.done };
    }) : [];
    f.activeTask = f.tasks.some(function (x) { return x.id === raw.activeTask; }) ? raw.activeTask : null;
    f.passenger = String(raw.passenger || '').slice(0, 40);
    f.boarded = !!raw.boarded;
    return f;
  }
  function load() { try { return merge(JSON.parse(localStorage.getItem(KEY))); } catch (e) { return fresh(); } }
  let S = load();
  let lastSave = 0;
  function save() { lastSave = Date.now(); try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { /* storage full or blocked */ } }
  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }

  // ------------------------------------------------------------------ helpers
  function dayKey(d) { d = d || new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
  function fmtHM(ms) {
    const m = Math.floor(ms / MIN), h = Math.floor(m / 60), r = m % 60;
    return h ? h + 'h ' + String(r).padStart(2, '0') + 'm' : r + 'm';
  }
  function fmtClock(ms) {
    const s = Math.ceil(ms / 1000), m = Math.floor(s / 60), r = s % 60;
    return String(m).padStart(2, '0') + ':' + String(r).padStart(2, '0');
  }
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function spotTitle(i) { return SPOTS[i].name; }
  function reduced() { return S.settings.reduceMotion || window.matchMedia('(prefers-reduced-motion: reduce)').matches; }
  function announce(msg) { const el = $('#srAnnounce'); el.textContent = ''; setTimeout(function () { el.textContent = msg; }, 60); }
  const posterCache = {};
  // Rendered fresh each time so every copy in the page has its own gradient/clip ids.
  function poster(n, o) { return window.GHPosters.render(n, o); }

  // ------------------------------------------------------------------ world
  let world = null;
  function initWorld() {
    try {
      if (!window.THREE) throw new Error('three.js missing');
      world = window.GHWorld.init({
        canvas: $('#world'), spots: SPOTS, mode: S.timer.mode, unlocked: S.progress.unlocked,
        reducedMotion: reduced(), onPick: onPinPick, onHover: onPinHover
      });
      applyPanelShift();
      window.addEventListener('resize', applyPanelShift);
    } catch (e) {
      console.warn('3D view unavailable:', e);
      world = null;
      document.body.classList.add('no-webgl');
      $('.view-controls').hidden = true;
    }
  }
  function applyPanelShift() {
    if (!world) return;
    const wide = window.innerWidth > 820;
    if (wide) { world.setPanelShift(Math.round(($('#cockpit').offsetWidth + 48) / 2), 0); $('.view-controls').style.top = ''; return; }
    // Phones: the map shows through the gap between the timer and the task list,
    // so aim the camera at the middle of that gap and park the view buttons there.
    const timerBottom = $('.timer-card').getBoundingClientRect().bottom + window.scrollY;
    const tasksTop = $('.tasks-card').getBoundingClientRect().top + window.scrollY;
    const gapMid = (timerBottom + Math.min(tasksTop, window.innerHeight)) / 2;
    world.setPanelShift(0, Math.round(clampN(gapMid - window.innerHeight / 2, 0, window.innerHeight * 0.3)));
    $('.view-controls').style.top = Math.round(tasksTop - 58) + 'px';
  }
  function clampN(v, a, b) { return Math.max(a, Math.min(b, v)); }

  // ------------------------------------------------------------------ split-flap board
  const board = $('#flapboard');
  let flapCells = [], flapPattern = '';
  function buildFlaps(str) {
    const pattern = str.replace(/\d/g, 'd');
    if (pattern === flapPattern) return;
    flapPattern = pattern; flapCells = [];
    board.innerHTML = '';
    board.classList.toggle('digits-5', str.length > 5);
    for (let i = 0; i < str.length; i++) {
      if (str[i] === ':') {
        const c = document.createElement('div'); c.className = 'flap-colon'; c.innerHTML = '<i></i><i></i>'; board.appendChild(c);
        flapCells.push(null); continue;
      }
      const f = document.createElement('div'); f.className = 'flap'; f.setAttribute('aria-hidden', 'true');
      f.innerHTML = '<span class="half top"><b></b></span><span class="half bottom"><b></b></span><span class="leaf leaf-top"><b></b></span><span class="leaf leaf-bottom"><b></b></span>';
      f._d = ''; f._b = f.querySelectorAll('b');
      board.appendChild(f); flapCells.push(f);
    }
  }
  function setFlaps(str, animate) {
    buildFlaps(str);
    for (let i = 0; i < str.length; i++) {
      const f = flapCells[i]; if (!f) continue;
      const nd = str[i]; if (f._d === nd) continue;
      const od = f._d || nd; f._d = nd;
      const b = f._b; // top, bottom, leafTop, leafBottom
      if (!animate || !od || od === nd) {
        b[0].textContent = nd; b[1].textContent = nd; f.classList.remove('flipping'); continue;
      }
      b[0].textContent = nd; b[1].textContent = od; b[2].textContent = od; b[3].textContent = nd;
      f.classList.remove('flipping'); void f.offsetWidth; f.classList.add('flipping');
      clearTimeout(f._t);
      f._t = setTimeout(function () { b[1].textContent = f._d; f.classList.remove('flipping'); }, 380);
    }
    $('#board').setAttribute('aria-label', 'Time remaining ' + str);
  }

  // ------------------------------------------------------------------ timer core
  const T = function () { return S.timer; };
  function remainingMs() { const t = T(); return t.running ? Math.max(0, t.endAt - Date.now()) : t.remaining; }
  function elapsedMs() { const t = T(); return Math.max(0, t.duration - remainingMs()); }

  function creditFocus() {
    const t = T(); if (t.mode !== 'focus') return;
    const delta = Math.min(elapsedMs(), t.duration) - t.credited;
    if (delta <= 0) return;
    t.credited += delta;
    addFocus(delta);
  }
  function addFocus(ms) {
    const p = S.progress, k = dayKey();
    p.focusMs += ms;
    p.daily[k] = (p.daily[k] || 0) + ms;
    const n = Math.min(N, Math.floor(p.focusMs / HOUR));
    if (n > p.unlocked) unlockTo(n);
  }

  function unlockTo(n) {
    const p = S.progress, prev = p.unlocked, now = Date.now();
    for (let i = prev; i < n; i++) {
      if (!p.arrivals.some(function (a) { return a.n === i + 1; })) p.arrivals.push({ n: i + 1, at: now });
    }
    p.unlocked = n;
    save();
    renderProgress();
    if (world) world.setProgress(n, true, onArrive);
    else for (let i = prev; i < n; i++) onArrive(i);
  }

  function start() {
    const t = T();
    if (t.running) return;
    if (t.remaining <= 0) t.remaining = t.duration;
    t.endAt = Date.now() + t.remaining;
    t.running = true;
    Audio.unlock();
    ensureAlarm();
    setTimeout(ensureAlarm, 400); // first gesture: context may still be resuming
    updateAmbience();
    save(); render(true); renderTasks();
  }
  function pause() {
    const t = T();
    if (!t.running) return;
    creditFocus();
    t.remaining = remainingMs();
    t.running = false; t.endAt = 0;
    Audio.cancelAlarm();
    updateAmbience();
    save(); render(true);
  }
  function toggle() { if (T().running) pause(); else start(); Audio.click(); }

  function ensureAlarm() {
    const t = T();
    if (!t.running || !Audio.isReady()) return;
    const left = t.endAt - Date.now();
    if (left < 400 || Audio.alarmCovers(t.endAt)) return;
    Audio.scheduleAlarm(S.settings.alarm, left / 1000, S.settings.repeat, t.endAt);
  }

  function setMode(mode, autostart) {
    const t = T();
    Audio.cancelAlarm();
    t.mode = mode; t.running = false; t.endAt = 0; t.credited = 0;
    t.duration = S.settings[mode] * MIN; t.remaining = t.duration;
    document.body.dataset.mode = mode;
    if (world) world.setTheme(mode);
    updateAmbience();
    save(); render(false);
    if (autostart) start();
  }

  // Finish the current session. opts.skipped: moved on early (no alarm).
  function finish(opts) {
    opts = opts || {};
    const t = T(), mode = t.mode, endAt = t.endAt;
    if (mode === 'focus') {
      creditFocus();
      t.rounds += 1;
      S.progress.sessions += 1;
      const task = S.tasks.find(function (x) { return x.id === S.activeTask; });
      if (task && !opts.skipped) task.act += 1;
      else if (task && opts.skipped && elapsedMs() >= t.duration * 0.5) task.act += 1;
    }
    if (!opts.skipped) {
      if (!opts.late && !Audio.alarmCovers(endAt)) {
        Audio.scheduleAlarm(S.settings.alarm, 0, S.settings.repeat, Date.now());
      }
      Audio.releaseAlarm(); // let it ring out even though the next session is being set up
      notifyEnd(mode);
    } else {
      Audio.cancelAlarm();
    }
    let next = 'focus';
    if (mode === 'focus') next = (t.rounds % S.settings.interval === 0) ? 'long' : 'short';
    const auto = !opts.late && (next === 'focus' ? S.settings.autoFocus : S.settings.autoBreaks);
    t.running = false;
    setMode(next, auto);
    if (!opts.skipped) {
      flashTitle(mode === 'focus' ? 'Landed! Time for a break' : 'Break over. Back to the cockpit');
      announce(mode === 'focus' ? 'Focus session complete. ' + MODE_NAMES[next] + ' is ready.' : 'Break over. Time to focus.');
    }
    renderTasks();
  }

  function skip() {
    const t = T();
    if (t.mode === 'focus') {
      confirmBox('Land this session early?', 'The ' + fmtHM(elapsedMs()) + ' you have flown so far still counts toward your next destination.', 'Skip to break', function () { finish({ skipped: true }); });
    } else {
      finish({ skipped: true });
    }
  }
  function resetTimer() {
    const t = T();
    creditFocus();
    Audio.cancelAlarm();
    t.running = false; t.endAt = 0; t.credited = 0;
    t.duration = S.settings[t.mode] * MIN; t.remaining = t.duration;
    updateAmbience(); save(); render(false);
  }
  function switchMode(mode) {
    const t = T();
    if (mode === t.mode) return;
    if (t.running) {
      confirmBox('The timer is still running', 'Switch to ' + MODE_NAMES[mode].toLowerCase() + '? Any focus time you have flown stays on your logbook.', 'Switch', function () {
        creditFocus(); setMode(mode, false);
      });
    } else { creditFocus(); setMode(mode, false); }
  }

  // ------------------------------------------------------------------ ticking
  let lastCredit = 0;
  function tick() {
    const t = T();
    if (t.running) {
      const rem = remainingMs();
      const now = Date.now();
      if (now - lastCredit > 1000) { lastCredit = now; creditFocus(); ensureAlarm(); }
      if (rem <= 0) { finish({ late: now - t.endAt > 15000 }); return; }
      if (now - lastSave > 5000) save();
    }
    render(!document.hidden);
  }
  function startTicker() {
    let workerOK = false;
    try {
      const src = 'var id=null;onmessage=function(e){clearInterval(id);if(e.data==="start"){id=setInterval(function(){postMessage(0)},250)}}';
      const w = new Worker(URL.createObjectURL(new Blob([src], { type: 'text/javascript' })));
      w.onmessage = tick;
      w.onerror = function () { if (!workerOK) setInterval(tick, 250); };
      w.postMessage('start');
      workerOK = true;
    } catch (e) { setInterval(tick, 250); }
    setInterval(tick, 1000); // safety net; ticks are idempotent
    ['visibilitychange', 'focus', 'pageshow'].forEach(function (ev) {
      (ev === 'visibilitychange' ? document : window).addEventListener(ev, function () { tick(); if (document.hidden) save(); });
    });
    window.addEventListener('pagehide', function () { creditFocus(); save(); });
  }

  // ------------------------------------------------------------------ rendering
  let lastStatus = '';
  function render(animate) {
    const t = T(), rem = remainingMs();
    setFlaps(fmtClock(rem), animate && !reduced());
    document.body.classList.toggle('running', t.running);
    const sb = $('#startBtn');
    sb.textContent = t.running ? 'Pause' : (rem < t.duration ? 'Resume' : 'Start');
    sb.classList.toggle('pressed', t.running);
    $$('.mode-tab').forEach(function (b) { b.setAttribute('aria-selected', String(b.dataset.mode === t.mode)); });
    $('#boardMode').textContent = MODE_NAMES[t.mode];
    const nxt = S.progress.unlocked < N ? SPOTS[S.progress.unlocked].short : 'Home';
    $('#boardDest').textContent = t.mode === 'focus' ? 'Next stop: ' + nxt : (t.mode === 'short' ? 'Seatbelt sign off' : 'Overnight layover');
    const n = t.mode === 'focus' ? t.rounds + 1 : Math.max(1, t.rounds);
    $('#sessionNo').textContent = '#' + n;
    let status;
    if (t.mode === 'focus') status = t.running ? 'Cruising altitude. Time to focus.' : (rem < t.duration ? 'Holding pattern. Press resume when ready.' : 'Cleared for takeoff. Time to focus.');
    else if (t.mode === 'short') status = 'Seatbelt sign is off. Stretch your legs.';
    else status = 'Overnight layover. Rest up, captain\u2019s orders.';
    if (status !== lastStatus) { $('#statusText').textContent = status; lastStatus = status; }
    $('#sessionBar span').style.width = (100 * (1 - rem / t.duration)).toFixed(2) + '%';
    if (t.mode === 'focus') renderNextMeter();
    if (!titleFlash) {
      if (S.settings.titleTimer && (t.running || rem < t.duration)) document.title = fmtClock(rem) + ' \u00b7 ' + (t.mode === 'focus' ? 'Focus' : 'Break') + ' | Golden Hours';
      else document.title = 'Golden Hours | Flight 14-CA';
    }
  }
  let titleFlash = 0;
  function flashTitle(msg) {
    clearTimeout(titleFlash);
    document.title = '\u2708 ' + msg;
    titleFlash = setTimeout(function () { titleFlash = 0; render(false); }, document.hidden ? 60000 : 6000);
  }

  function liveFocusMs() {
    const t = T();
    let ms = S.progress.focusMs;
    if (t.mode === 'focus') ms += Math.max(0, Math.min(elapsedMs(), t.duration) - t.credited);
    return ms;
  }
  function renderNextMeter() {
    const u = S.progress.unlocked;
    if (u >= N) return;
    const into = liveFocusMs() - u * HOUR;
    const pct = Math.max(0, Math.min(100, into / HOUR * 100));
    $('#nextMeter span').style.width = pct.toFixed(1) + '%';
    $('#nextMeter').setAttribute('aria-valuenow', Math.round(pct));
    const left = Math.max(0, Math.ceil((HOUR - into) / MIN));
    $('#nextLeft').textContent = left + ' min of focus to landing';
  }
  function renderProgress() {
    const u = S.progress.unlocked;
    $('#postcardCount').textContent = u + '/' + N;
    const card = $('#nextCard');
    if (u < N) {
      card.classList.remove('complete');
      const s = SPOTS[u];
      $('#nextKicker').textContent = u === 0 ? 'First stop' : 'Next stop';
      $('#nextName').textContent = s.short;
      $('#nextMeta').textContent = 'Hour ' + (u + 1) + ' of ' + N + ' \u00b7 ' + s.region;
      $('#nextThumb').innerHTML = poster(u + 1);
      $('#nextThumb').setAttribute('aria-label', 'Open postcards. Next stop ' + s.short);
      renderNextMeter();
    } else {
      card.classList.add('complete');
      $('#nextKicker').textContent = 'Journey complete';
      $('#nextName').textContent = 'The Golden State';
      $('#nextMeta').textContent = 'All ' + N + ' destinations visited';
      $('#nextMeter span').style.width = '100%';
      $('#nextLeft').textContent = 'Open your certificate';
      $('#nextThumb').innerHTML = poster(N);
    }
    const tip = $('#pcSub'); if (tip) tip.textContent = u + ' of ' + N + ' collected \u00b7 ' + fmtHM(S.progress.focusMs) + ' in the air';
  }

  // ------------------------------------------------------------------ ambience & notifications
  function updateAmbience() {
    const on = S.settings.ambience && !S.settings.muted && T().running && T().mode === 'focus';
    Audio.setAmbience(on, S.settings.ambienceVolume / 100 * 0.5);
  }
  function applyVolume() { Audio.setVolume(S.settings.muted ? 0 : S.settings.volume / 100); updateAmbience(); }

  function notifyEnd(mode) {
    if (!S.settings.notify || !('Notification' in window) || Notification.permission !== 'granted') return;
    if (!document.hidden && document.hasFocus()) return;
    try {
      const u = S.progress.unlocked;
      const body = mode === 'focus'
        ? (u > 0 ? 'Now arriving: ' + SPOTS[u - 1].short + '. ' : '') + 'Time for a break.'
        : 'Break is over. Back to the cockpit.';
      const n = new Notification(mode === 'focus' ? 'Focus session complete' : 'Seatbelt sign is on', { body: body, icon: 'assets/img/icon-192.png', tag: 'golden-hours' });
      n.onclick = function () { window.focus(); n.close(); };
    } catch (e) { /* some mobile browsers only allow notifications from a service worker */ }
  }

  // ------------------------------------------------------------------ arrivals
  function onArrive(idx) {
    const s = SPOTS[idx];
    Audio.play('arrival-chime', 0.8);
    announce('Now arriving: ' + s.name);
    const lastOne = idx === N - 1;
    if (lastOne && !S.progress.finaleSeen) { setTimeout(openFinale, 2200); return; }
    const anyOpen = $$('dialog[open]').length > 0;
    if (!T().running && !anyOpen) {
      openPostcard(idx, true);
    } else {
      showArrival(idx);
    }
    if (S.settings.narrator && !T().running) {
      const open = $('#postcardsDlg').open && pcIdx === idx;
      speak(s.paras, 'pc' + idx, open ? $('#pcListen') : null);
    }
  }
  let arrivalTimer = 0, arrivalIdx = -1;
  function showArrival(idx) {
    arrivalIdx = idx;
    $('#arrivalThumb').innerHTML = poster(idx + 1);
    $('#arrivalName').textContent = SPOTS[idx].short;
    const el = $('#arrival'); el.hidden = false;
    clearTimeout(arrivalTimer);
    arrivalTimer = setTimeout(function () { el.hidden = true; }, 20000);
  }

  // ------------------------------------------------------------------ pins
  const tip = $('#pinTip');
  let tipIdx = -1, tipUnlocked = -1;
  function onPinHover(i, pos) {
    if (i < 0) { if (tipIdx !== -1) { tip.hidden = true; tipIdx = -1; } return; }
    if (i === tipIdx && tipUnlocked === S.progress.unlocked) { tip.style.left = pos.x + 'px'; tip.style.top = pos.y + 'px'; return; }
    tipIdx = i; tipUnlocked = S.progress.unlocked;
    const u = S.progress.unlocked;
    let kicker, name, locked = false;
    if (i < u) { kicker = 'Hour ' + (i + 1) + ' \u00b7 visited'; name = SPOTS[i].short; }
    else if (i === u) { kicker = 'Next stop \u00b7 Hour ' + (i + 1); name = SPOTS[i].short; }
    else { kicker = 'Hour ' + (i + 1); name = 'Destination locked'; locked = true; }
    tip.innerHTML = '<small>' + esc(kicker) + '</small>' + esc(name);
    tip.classList.toggle('locked', locked);
    tip.style.left = pos.x + 'px'; tip.style.top = pos.y + 'px';
    tip.hidden = false;
  }
  function onPinPick(i) {
    const u = S.progress.unlocked;
    if (i < u) openPostcard(i);
    else if (i === u) { openPostcards(); }
    else announce('Hour ' + (i + 1) + ' is still locked. Keep focusing to fly there.');
  }

  // ------------------------------------------------------------------ dialogs
  function openDlg(d) { if (!d.open) { try { d.showModal(); } catch (e) { d.setAttribute('open', ''); } } tip.hidden = true; }
  function closeDlg(d) { if (d.open) d.close(); }
  $$('[data-close]').forEach(function (b) { b.addEventListener('click', function () { closeDlg(b.closest('dialog')); }); });
  $$('dialog').forEach(function (d) {
    d.addEventListener('click', function (e) { // click on backdrop closes (not for boarding/confirm)
      if (e.target !== d || d.id === 'boardingDlg' || d.id === 'confirmDlg') return;
      const r = d.getBoundingClientRect();
      if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) d.close();
    });
    d.addEventListener('close', function () { if (d.id !== 'confirmDlg') stopSpeech(); });
  });

  let confirmCb = null;
  function confirmBox(title, text, yesLabel, cb) {
    $('#cfTitle').textContent = title; $('#cfText').textContent = text; $('#cfYes').textContent = yesLabel || 'Continue';
    confirmCb = cb; openDlg($('#confirmDlg'));
    $('#cfYes').focus();
  }
  $('#cfYes').addEventListener('click', function () { const cb = confirmCb; confirmCb = null; closeDlg($('#confirmDlg')); if (cb) cb(); });
  $('#cfNo').addEventListener('click', function () { confirmCb = null; closeDlg($('#confirmDlg')); });

  // ---------- boarding
  function makeBarcode(seed) {
    let h = 2166136261; for (let i = 0; i < seed.length; i++) { h ^= seed.charCodeAt(i); h = Math.imul(h, 16777619); }
    let x = 0, out = '';
    while (x < 118) { h ^= h << 13; h ^= h >>> 17; h ^= h << 5; const w = 1 + (Math.abs(h) % 3), gap = 1 + (Math.abs(h >> 4) % 3); out += '<rect x="' + x + '" y="0" width="' + w + '" height="40"/>'; x += w + gap; }
    $('#barcode').innerHTML = out;
  }
  function openBoarding() {
    const u = S.progress.unlocked, returning = S.boarded;
    $('#passengerName').value = S.passenger;
    $('#bpItin').textContent = u >= N ? 'All ' + N + ' visited' : (u ? u + ' of ' + N + ' visited' : N + ' stops, 1 per hour');
    let html = '';
    if (!returning) {
      $('#bpTitle').textContent = 'Welcome aboard';
      html = '<div class="attendant"><svg viewBox="0 0 64 24" class="wings" aria-hidden="true"><use href="#wingsPath"/></svg><span>Cabin announcement</span></div>' +
        '<p>' + esc(D.intro) + '</p>' +
        '<p><b>How this flight works:</b> every 60 minutes of focus lands you at a new destination. Start the timer, get to work, and the plane flies on while you do. After ' + N + ' hours you will have seen the whole Golden State.</p>';
      $('#boardBtn').textContent = 'Board Flight 14-CA';
    } else {
      $('#bpTitle').textContent = S.passenger ? 'Welcome back, ' + S.passenger : 'Welcome back';
      if (u >= N) html = '<p>You have visited all ' + N + ' destinations of the Golden State. The cabin is yours: keep focusing, revisit your postcards, or download your certificate.</p>';
      else html = '<p>' + (u ? 'You have visited <b>' + u + ' of ' + N + '</b> destinations so far, with ' + fmtHM(S.progress.focusMs) + ' in the air. ' : 'Your seat is still warm. ') +
        'Next stop: <b>' + esc(SPOTS[u].name) + '</b>, ' + fmtHM(Math.max(0, (u + 1) * HOUR - S.progress.focusMs)) + ' of focus away.</p>';
      $('#boardBtn').textContent = T().running ? 'Return to the cockpit' : 'Resume Flight 14-CA';
    }
    $('#bpIntro').innerHTML = html;
    $('#listenIntro').hidden = !('speechSynthesis' in window) || returning;
    makeBarcode((S.passenger || 'passenger') + 'FLIGHT14CA');
    openDlg($('#boardingDlg'));
  }
  function boardFlight() {
    S.passenger = $('#passengerName').value.trim().slice(0, 40);
    S.boarded = true; save();
    Audio.unlock();
    setTimeout(function () { Audio.play('cabin-chime', 0.7); }, 60);
    closeDlg($('#boardingDlg'));
    $('#lbSub').textContent = (S.passenger || 'Passenger') + ' of Flight 14-CA';
    // A journey that was finished before the finale was seen: land it now.
    if (S.progress.unlocked >= N && !S.progress.finaleSeen) setTimeout(openFinale, 900);
  }
  $('#boardBtn').addEventListener('click', boardFlight);
  $('#passengerName').addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); boardFlight(); } });
  $('#passengerName').addEventListener('input', function () { makeBarcode(($('#passengerName').value || 'passenger') + 'FLIGHT14CA'); });
  $('#boardingDlg').addEventListener('cancel', function (e) { e.preventDefault(); boardFlight(); });
  $('#listenIntro').addEventListener('click', function () { toggleSpeech([D.intro], 'intro', this); });

  // ---------- postcards
  let pcIdx = -1;
  function renderGrid() {
    const u = S.progress.unlocked, g = $('#pcGrid');
    let html = '';
    for (let i = 0; i < N; i++) {
      if (i < u) html += '<button type="button" class="pc-card unlocked" data-i="' + i + '" aria-label="Hour ' + (i + 1) + ': ' + esc(SPOTS[i].name) + '">' + poster(i + 1) + '</button>';
      else {
        const next = i === u;
        html += '<button type="button" class="pc-card ' + (next ? 'next' : 'locked') + '" disabled aria-label="Hour ' + (i + 1) + (next ? ': next stop, ' + esc(SPOTS[i].short) : ': locked') + '">' + poster(i + 1, next ? { noShield: true } : { title: '\u2022 \u2022 \u2022', noShield: true }) +
          '<span class="lock"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg><b>Hour ' + (i + 1) + '</b><small>' + (next ? 'Next stop: ' + esc(SPOTS[i].short) : 'Keep focusing') + '</small></span></button>';
      }
    }
    g.innerHTML = html;
    renderProgress();
  }
  $('#pcGrid').addEventListener('click', function (e) {
    const b = e.target.closest('.pc-card.unlocked'); if (b) showDetail(Number(b.dataset.i));
  });
  function openPostcards() {
    $('#pcDetail').hidden = true; $('#pcGrid').hidden = false; pcIdx = -1;
    renderGrid(); openDlg($('#postcardsDlg'));
  }
  function openPostcard(i, arriving) {
    renderGrid(); showDetail(i, arriving); openDlg($('#postcardsDlg'));
  }
  function showDetail(i, arriving) {
    stopSpeech();
    pcIdx = i;
    const s = SPOTS[i], u = S.progress.unlocked;
    $('#pcGrid').hidden = true; $('#pcDetail').hidden = false;
    $('#pcPoster').innerHTML = poster(i + 1);
    $('#pcHour').textContent = (arriving ? 'Now arriving \u00b7 ' : '') + 'Destination ' + (i + 1) + ' of ' + N + ' \u00b7 Hour ' + (i + 1);
    $('#pcName').textContent = s.name;
    $('#pcRegion').textContent = s.region;
    $('#pcBody').innerHTML = s.paras.map(function (p) { return '<p>' + esc(p) + '</p>'; }).join('');
    $('#pcPrev').disabled = i <= 0;
    $('#pcNext').disabled = i >= u - 1;
    $('#pcListen').textContent = 'Listen';
    $('#pcListen').hidden = !('speechSynthesis' in window);
    $('#pcMap').hidden = !world;
    $('#postcardsDlg').scrollTop = 0;
  }
  $('#pcBack').addEventListener('click', function () { stopSpeech(); $('#pcDetail').hidden = true; $('#pcGrid').hidden = false; pcIdx = -1; });
  $('#pcPrev').addEventListener('click', function () { if (pcIdx > 0) showDetail(pcIdx - 1); });
  $('#pcNext').addEventListener('click', function () { if (pcIdx < S.progress.unlocked - 1) showDetail(pcIdx + 1); });
  $('#pcListen').addEventListener('click', function () { toggleSpeech(SPOTS[pcIdx].paras, 'pc' + pcIdx, this); });
  $('#pcMap').addEventListener('click', function () {
    const i = pcIdx; closeDlg($('#postcardsDlg'));
    if (world) { world.view('spot', i); setViewButtons('spot'); }
  });
  $('#openPostcards').addEventListener('click', openPostcards);
  $('#nextThumb').addEventListener('click', function () { if (S.progress.unlocked >= N) openFinale(); else openPostcards(); });
  $('#arrivalOpen').addEventListener('click', function () { $('#arrival').hidden = true; if (arrivalIdx >= 0) openPostcard(arrivalIdx, true); });
  $('#arrivalLater').addEventListener('click', function () { $('#arrival').hidden = true; });

  // ---------- logbook
  function openLogbook() {
    const p = S.progress, today = p.daily[dayKey()] || 0;
    const days = Object.keys(p.daily).filter(function (k) { return p.daily[k] > 0; }).length;
    $('#lbSub').textContent = (S.passenger || 'Passenger') + ' of Flight 14-CA';
    $('#lbStats').innerHTML = [
      [fmtHM(p.focusMs), 'Time in the air'], [p.unlocked + '/' + N, 'Destinations'],
      [String(p.sessions), 'Focus sessions'], [fmtHM(today), 'Today']
    ].map(function (s) { return '<div class="stat"><b>' + s[0] + '</b><span>' + s[1] + '</span></div>'; }).join('');
    let max = 0; const arr = [];
    for (let k = 6; k >= 0; k--) { const d = new Date(); d.setDate(d.getDate() - k); const v = p.daily[dayKey(d)] || 0; max = Math.max(max, v); arr.push({ d: d, v: v, today: k === 0 }); }
    max = Math.max(max, HOUR);
    $('#lbChart').innerHTML = arr.map(function (x) {
      const h = Math.round(x.v / max * 100);
      return '<div class="day' + (x.today ? ' today' : '') + '" title="' + fmtHM(x.v) + '"><span class="val">' + (x.v ? (x.v / HOUR).toFixed(1) + 'h' : '') + '</span><span class="bar" style="height:' + Math.max(2, h * 0.72) + '%"></span><span class="lbl">' + x.d.toLocaleDateString(undefined, { weekday: 'short' }) + '</span></div>';
    }).join('');
    const list = p.arrivals.slice().sort(function (a, b) { return b.n - a.n; });
    $('#lbArrivals').innerHTML = list.length ? list.map(function (a) {
      const when = new Date(a.at);
      return '<li><button type="button" data-i="' + (a.n - 1) + '"><svg class="shield" viewBox="0 0 40 42" aria-hidden="true">' + window.GHPosters.shield(0, 0, a.n, 1) + '</svg><span class="a-name">' + esc(SPOTS[a.n - 1].name) + '</span><time datetime="' + when.toISOString() + '">' + when.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) + ', ' + when.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }) + '</time></button></li>';
    }).join('') : '<li class="empty">No arrivals yet. Your first hour of focus lands you in ' + esc(SPOTS[0].short) + '.</li>';
    $('#lbChart').setAttribute('aria-label', days + ' days flown');
    openDlg($('#logbookDlg'));
  }
  $('#openLogbook').addEventListener('click', openLogbook);
  $('#lbArrivals').addEventListener('click', function (e) {
    const b = e.target.closest('button[data-i]'); if (!b) return;
    closeDlg($('#logbookDlg')); openPostcard(Number(b.dataset.i));
  });

  // ---------- settings
  const form = $('#settingsForm');
  function fillSettings() {
    const s = S.settings;
    ['focus', 'short', 'long', 'interval', 'repeat'].forEach(function (k) { form.elements[k].value = s[k]; });
    form.elements.alarm.value = s.alarm;
    form.elements.volume.value = s.volume; $('#volOut').textContent = Math.round(s.volume);
    form.elements.ambienceVolume.value = s.ambienceVolume; $('#ambOut').textContent = Math.round(s.ambienceVolume);
    form.elements.voiceRate.value = s.voiceRate; $('#rateOut').textContent = Number(s.voiceRate).toFixed(2).replace(/0$/, '') + '\u00d7';
    ['autoBreaks', 'autoFocus', 'ambience', 'narrator', 'titleTimer', 'notify', 'reduceMotion'].forEach(function (k) { form.elements[k].checked = !!s[k]; });
    markPreset(); notifyState(); timerHint();
  }
  function markPreset() {
    const s = S.settings, cur = [s.focus, s.short, s.long, s.interval].join(',');
    $$('.chip[data-preset]').forEach(function (c) { c.classList.toggle('on', c.dataset.preset === cur); });
  }
  function timerHint() {
    const s = S.settings;
    let txt = 'Every 60 minutes of focus lands you at a new destination, whatever session length you choose.';
    if (s.focus !== 60) txt += ' With ' + s.focus + '-minute sessions, that is about ' + (60 / s.focus).toFixed(s.focus > 60 || 60 % s.focus ? 1 : 0).replace(/\.0$/, '') + ' session' + (s.focus === 60 ? '' : 's') + ' per destination.';
    const t = T();
    if (t.running || remainingMs() < t.duration) txt += ' Changes to the current mode apply from the next session.';
    $('#timerHint').textContent = txt;
  }
  function notifyState() {
    const el = $('#notifyState');
    if (!('Notification' in window)) { el.textContent = 'Not supported in this browser'; return; }
    el.textContent = Notification.permission === 'denied' ? 'Blocked in your browser settings' : (Notification.permission === 'granted' ? 'Allowed' : 'Your browser will ask for permission');
  }
  function applyDurations() {
    const t = T();
    // Apply to the current mode right away only if the session has not started yet.
    if (!t.running && t.remaining === t.duration && t.credited === 0) {
      t.duration = S.settings[t.mode] * MIN; t.remaining = t.duration; render(false);
    }
  }
  function onSettingInput(e) {
    const el = e.target, k = el.name, s = S.settings;
    if (!k) return;
    if (el.type === 'number') {
      if (el.value === '') return; // let the user finish typing
      const v = Math.round(num(el.value, s[k], Number(el.min), Number(el.max)));
      s[k] = v;
      if (e.type === 'change') el.value = v;
      if (['focus', 'short', 'long'].indexOf(k) >= 0) applyDurations();
      markPreset(); timerHint();
    } else if (el.type === 'checkbox') {
      s[k] = el.checked;
      if (k === 'notify' && el.checked && 'Notification' in window && Notification.permission !== 'granted') {
        Notification.requestPermission().then(function (p) { if (p !== 'granted') { s.notify = false; el.checked = false; } notifyState(); save(); });
      } else if (k === 'notify' && el.checked && !('Notification' in window)) { s.notify = false; el.checked = false; }
      if (k === 'ambience') { Audio.unlock(); updateAmbience(); }
      if (k === 'reduceMotion') { document.body.classList.toggle('reduce-motion', el.checked); if (world) world.setReducedMotion(reduced()); }
      if (k === 'titleTimer') render(false);
      if (k === 'narrator' && el.checked && !('speechSynthesis' in window)) { s.narrator = false; el.checked = false; }
    } else if (el.type === 'range') {
      s[k] = Number(el.value);
      if (k === 'volume') { $('#volOut').textContent = el.value; applyVolume(); }
      if (k === 'ambienceVolume') { $('#ambOut').textContent = el.value; updateAmbience(); }
      if (k === 'voiceRate') $('#rateOut').textContent = Number(el.value).toFixed(2).replace(/0$/, '') + '\u00d7';
    } else if (el.tagName === 'SELECT') {
      s[k] = el.value;
      if (T().running) { Audio.cancelAlarm(); ensureAlarm(); }
      Audio.play(s.alarm, 1);
    }
    save();
  }
  // Ranges update live while dragging; everything else commits on change
  // (numbers on blur/Enter or via the +/- buttons), so nothing fires twice.
  form.addEventListener('input', function (e) { if (e.target.type === 'range') onSettingInput(e); });
  form.addEventListener('change', function (e) {
    if (e.target.type === 'range') return;
    if (e.target.type === 'number' && e.target.value === '') e.target.value = S.settings[e.target.name];
    onSettingInput(e);
  });
  form.addEventListener('click', function (e) {
    const b = e.target.closest('[data-step]');
    if (b) {
      const input = b.parentNode.querySelector('input');
      const step = Number(b.dataset.step), min = Number(input.min), max = Number(input.max);
      let v = Number(input.value) || 0;
      // snap to multiples of the step size so 60 -> 55 -> 50 feels natural
      v = Math.abs(step) > 1 ? (step > 0 ? Math.floor(v / step) * step + step : Math.ceil(v / -step) * -step + step) : v + step;
      input.value = Math.min(max, Math.max(min, v));
      input.dispatchEvent(new Event('change', { bubbles: true }));
      Audio.click();
      return;
    }
    const p = e.target.closest('[data-preset]');
    if (p) {
      const v = p.dataset.preset.split(',').map(Number);
      ['focus', 'short', 'long', 'interval'].forEach(function (k, i) { S.settings[k] = v[i]; form.elements[k].value = v[i]; });
      applyDurations(); markPreset(); timerHint(); save();
    }
  });
  $('#previewAlarm').addEventListener('click', function () { Audio.unlock(); Audio.play(S.settings.alarm, 1); });
  $('#openSettings').addEventListener('click', function () { fillSettings(); openDlg($('#settingsDlg')); });

  $('#exportBtn').addEventListener('click', function () {
    creditFocus(); save();
    const blob = new Blob([JSON.stringify(S, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = 'golden-hours-backup-' + dayKey() + '.json';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 2000);
  });
  $('#importBtn').addEventListener('click', function () { $('#importFile').click(); });
  $('#importFile').addEventListener('change', function () {
    const f = this.files && this.files[0]; if (!f) return;
    const r = new FileReader();
    r.onload = function () {
      let data;
      try { data = JSON.parse(r.result); } catch (e) { confirmBox('That file could not be read', 'Choose a backup exported from Golden Hours (a .json file).', 'OK', null); return; }
      const m = merge(data);
      confirmBox('Import this backup?', 'It has ' + fmtHM(m.progress.focusMs) + ' of focus and ' + m.progress.unlocked + ' destinations. Your current progress in this browser will be replaced.', 'Import', function () {
        m.timer.running = false; m.timer.endAt = 0;
        S = m; save(); location.reload();
      });
    };
    r.readAsText(f);
    this.value = '';
  });
  $('#resetJourney').addEventListener('click', function () {
    confirmBox('Restart the journey?', 'This clears your focus hours, postcards and logbook, and flies you back to the start. Your tasks and settings stay.', 'Restart', function () {
      Audio.cancelAlarm();
      S.progress = fresh().progress;
      S.timer = fresh().timer; S.timer.duration = S.settings.focus * MIN; S.timer.remaining = S.timer.duration;
      save();
      if (world) { world.endCelebration(); world.setProgress(0, false); }
      setMode('focus', false); renderProgress(); closeDlg($('#settingsDlg'));
    });
  });

  // ---------- finale
  const REFLECTION = [
    'Before you unbuckle, one last thought from the galley.',
    'California isn\u2019t perfect. The rent is steep, the freeways crawl, the droughts drag on, and some summers the hills burn. It asks a lot of the people who call it home.',
    'But you have also seen what it holds: granite walls older than memory, trees that were saplings when Rome was young, a desert that blooms, a coastline that never runs out of ways to be beautiful, and cities that keep inventing the future. Flawed and extraordinary, all at once.',
    'A place can have real flaws and still be worth the trip. The same is true of the thirty hours you just put in. Not every session was easy, and you showed up anyway, one hour at a time.'
  ];
  let logoImg = null;
  function drawCertificate() {
    const c = $('#certCanvas'), g = c.getContext('2d'), W = c.width, H = c.height;
    const name = S.passenger || 'Passenger of Flight 14-CA';
    g.fillStyle = '#10284a'; g.fillRect(0, 0, W, H);
    const grd = g.createRadialGradient(W * 0.5, H * 0.1, 50, W * 0.5, H * 0.3, W * 0.8);
    grd.addColorStop(0, 'rgba(240,194,94,.25)'); grd.addColorStop(1, 'rgba(240,194,94,0)');
    g.fillStyle = grd; g.fillRect(0, 0, W, H);
    // stripes (logo wing motif)
    g.strokeStyle = 'rgba(224,169,64,.18)'; g.lineWidth = 10;
    for (let i = 0; i < 4; i++) { g.beginPath(); g.moveTo(-40, H - 150 + i * 26); g.quadraticCurveTo(W * 0.5, H - 260 + i * 26, W + 40, H - 120 + i * 26); g.stroke(); }
    g.strokeStyle = '#e0a940'; g.lineWidth = 6; g.strokeRect(28, 28, W - 56, H - 56);
    g.strokeStyle = 'rgba(224,169,64,.5)'; g.lineWidth = 2; g.strokeRect(44, 44, W - 88, H - 88);
    const hasLogo = logoImg && logoImg.complete && logoImg.naturalWidth && location.protocol !== 'file:';
    let y = 96;
    if (hasLogo) {
      g.save(); g.beginPath(); g.arc(W / 2, 150, 86, 0, Math.PI * 2); g.fillStyle = '#fffaf0'; g.fill(); g.clip();
      const lw = 190, lh = lw * logoImg.naturalHeight / logoImg.naturalWidth;
      g.drawImage(logoImg, W / 2 - lw / 2, 150 - lh / 2 + 4, lw, lh); g.restore();
      y = 270;
    } else { y = 150; }
    g.textAlign = 'center';
    g.fillStyle = '#f0c25e'; g.font = '700 22px "Libre Franklin", Arial, sans-serif';
    g.fillText('GOLDEN STATE AIRLINES  \u00b7  FLIGHT 14-CA', W / 2, y);
    g.fillStyle = '#fffaf0'; g.font = '900 78px "Big Shoulders Display", Impact, sans-serif';
    g.fillText('CERTIFICATE OF FLIGHT', W / 2, y + 86);
    g.fillStyle = 'rgba(255,250,240,.75)'; g.font = 'italic 400 24px "Libre Franklin", Arial, sans-serif';
    g.fillText('This certifies that', W / 2, y + 140);
    g.fillStyle = '#f0c25e'; g.font = '800 68px "Big Shoulders Display", Impact, sans-serif';
    let fs = 68; while (g.measureText(name.toUpperCase()).width > W - 220 && fs > 30) { fs -= 4; g.font = '800 ' + fs + 'px "Big Shoulders Display", Impact, sans-serif'; }
    g.fillText(name.toUpperCase(), W / 2, y + 214);
    g.fillStyle = '#fffaf0'; g.font = '400 24px "Libre Franklin", Arial, sans-serif';
    g.fillText('completed ' + N + ' hours of focus and visited all ' + N + ' destinations', W / 2, y + 268);
    g.fillText('of the Golden State, from Yosemite to Venice Beach.', W / 2, y + 302);
    const last = S.progress.arrivals.reduce(function (m, a) { return Math.max(m, a.at || 0); }, 0) || Date.now();
    g.fillStyle = 'rgba(255,250,240,.7)'; g.font = '600 18px "Libre Franklin", Arial, sans-serif';
    g.textAlign = 'left'; g.fillText('LANDED ' + new Date(last).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' }).toUpperCase(), 90, H - 84);
    g.textAlign = 'right'; g.fillText('YOUR FLIGHT ATTENDANT', W - 90, H - 84);
    g.strokeStyle = 'rgba(240,194,94,.8)'; g.lineWidth = 2;
    g.beginPath(); g.moveTo(W - 330, H - 112); g.lineTo(W - 90, H - 112); g.stroke();
    g.fillStyle = '#f0c25e'; g.font = 'italic 400 30px Georgia, serif'; g.fillText('Welcome home', W - 96, H - 122);
  }
  function openFinale() {
    const name = S.passenger;
    $('#fnOutro').textContent = D.outro;
    $('#fnReflect').innerHTML = REFLECTION.map(function (p) { return '<p>' + esc(p) + '</p>'; }).join('') +
      '<p class="signoff">Welcome home, ' + (name ? esc(name) + ', ' : '') + 'passenger of Flight 14-CA.</p>';
    $('#certHint').textContent = '';
    if (!logoImg) { logoImg = new Image(); logoImg.onload = drawCertificate; logoImg.src = 'assets/img/logo.png'; }
    drawCertificate();
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(drawCertificate);
    const first = !S.progress.finaleSeen;
    S.progress.finaleSeen = true; save();
    closeDlg($('#postcardsDlg'));
    openDlg($('#finaleDlg'));
    if (world) world.celebrate();
    Audio.play('fanfare', 0.9);
    confetti(first ? 7000 : 3500);
    if (first && S.settings.narrator) speak([D.outro].concat(REFLECTION), 'finale', $('#fnListen'));
  }
  $('#finaleDlg').addEventListener('close', function () {
    if (world) { world.endCelebration(); world.setTheme(T().mode); world.view('overview'); setViewButtons('overview'); }
  });
  $('#fnListen').addEventListener('click', function () {
    toggleSpeech([D.outro].concat(REFLECTION, ['Welcome home, ' + (S.passenger ? S.passenger + ', ' : '') + 'passenger of Flight 14-CA.']), 'finale', this);
  });
  $('#certDownload').addEventListener('click', function () {
    drawCertificate();
    try {
      const url = $('#certCanvas').toDataURL('image/png');
      const a = document.createElement('a'); a.href = url; a.download = 'flight-14-ca-certificate.png';
      document.body.appendChild(a); a.click(); a.remove();
    } catch (e) {
      $('#certHint').textContent = 'Your browser blocked the download. Right-click the certificate and choose "Save image as".';
    }
  });

  // ---------- confetti
  function confetti(ms) {
    if (reduced()) return;
    const c = $('#confetti'), g = c.getContext('2d');
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    c.width = innerWidth * dpr; c.height = innerHeight * dpr; g.scale(dpr, dpr);
    const colors = ['#e0a940', '#f0c25e', '#c8382a', '#fffaf0', '#10284a', '#4ea6d6'];
    const parts = [];
    for (let i = 0; i < 220; i++) parts.push({ x: innerWidth * (0.2 + Math.random() * 0.6), y: innerHeight * 0.35, vx: (Math.random() - 0.5) * 16, vy: -Math.random() * 16 - 4, r: Math.random() * Math.PI, vr: (Math.random() - 0.5) * 0.3, w: 6 + Math.random() * 8, h: 4 + Math.random() * 6, c: colors[i % colors.length] });
    const t0 = performance.now();
    (function frame(now) {
      const el = now - t0; g.clearRect(0, 0, innerWidth, innerHeight);
      parts.forEach(function (p) {
        p.vy += 0.32; p.vx *= 0.99; p.x += p.vx; p.y += p.vy; p.r += p.vr;
        g.save(); g.translate(p.x, p.y); g.rotate(p.r); g.globalAlpha = Math.max(0, 1 - el / ms);
        g.fillStyle = p.c; g.fillRect(-p.w / 2, -p.h / 2, p.w, p.h * Math.abs(Math.cos(p.r * 2))); g.restore();
      });
      if (el < ms) requestAnimationFrame(frame); else g.clearRect(0, 0, innerWidth, innerHeight);
    })(t0);
  }

  // ------------------------------------------------------------------ narration (Web Speech)
  let speakingKey = null, speakingBtn = null;
  function pickVoice() {
    const vs = window.speechSynthesis.getVoices();
    const pref = ['Samantha', 'Google US English', 'Microsoft Aria', 'Microsoft Jenny', 'Microsoft Zira', 'Allison', 'Ava'];
    for (let i = 0; i < pref.length; i++) { const v = vs.find(function (x) { return x.name.indexOf(pref[i]) === 0; }); if (v) return v; }
    return vs.find(function (x) { return x.lang === 'en-US'; }) || vs.find(function (x) { return /^en/.test(x.lang); }) || null;
  }
  function chunks(paras) {
    const out = [];
    paras.forEach(function (p) {
      const sentences = p.match(/[^.!?]+[.!?]+["\u201d\u2019]?\s*|[^.!?]+$/g) || [p];
      let cur = '';
      sentences.forEach(function (s) { if ((cur + s).length > 220 && cur) { out.push(cur.trim()); cur = ''; } cur += s; });
      if (cur.trim()) out.push(cur.trim());
    });
    return out;
  }
  function speak(paras, key, btn) {
    if (!('speechSynthesis' in window) || S.settings.muted) return;
    stopSpeech();
    const synth = window.speechSynthesis, voice = pickVoice();
    const parts = chunks(paras);
    speakingKey = key; speakingBtn = btn || null;
    if (speakingBtn) { speakingBtn.textContent = 'Stop'; speakingBtn.setAttribute('aria-pressed', 'true'); }
    parts.forEach(function (text, i) {
      const u = new SpeechSynthesisUtterance(text);
      if (voice) u.voice = voice;
      u.lang = voice ? voice.lang : 'en-US'; u.rate = S.settings.voiceRate; u.pitch = 1.05;
      u.volume = Math.max(0.2, S.settings.volume / 100);
      if (i === parts.length - 1) u.onend = function () { if (speakingKey === key) resetSpeechBtn(); };
      synth.speak(u);
    });
  }
  function resetSpeechBtn() {
    if (speakingBtn) { speakingBtn.textContent = speakingBtn.dataset.label || 'Listen'; speakingBtn.setAttribute('aria-pressed', 'false'); }
    speakingKey = null; speakingBtn = null;
  }
  function stopSpeech() { if ('speechSynthesis' in window) window.speechSynthesis.cancel(); resetSpeechBtn(); }
  function toggleSpeech(paras, key, btn) {
    if (!btn.dataset.label) btn.dataset.label = btn.textContent;
    if (speakingKey === key) { stopSpeech(); return; }
    speak(paras, key, btn);
  }
  if ('speechSynthesis' in window) { window.speechSynthesis.getVoices(); window.speechSynthesis.onvoiceschanged = function () { }; }

  // ------------------------------------------------------------------ tasks (Pomofocus-style)
  let editing = null; // task id, 'new', or null
  function renderTasks() {
    const list = $('#taskList');
    let html = '';
    S.tasks.forEach(function (t) {
      if (editing === t.id) { html += editorHTML(t); return; }
      html += '<li class="task' + (t.id === S.activeTask ? ' active' : '') + (t.done ? ' done' : '') + '" data-id="' + t.id + '">' +
        '<button type="button" class="check" aria-label="' + (t.done ? 'Mark as not done' : 'Mark as done') + '" aria-pressed="' + t.done + '"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12 5 5 9-10"/></svg></button>' +
        '<span class="t-title">' + esc(t.title) + (t.note ? '<span class="t-note">' + esc(t.note) + '</span>' : '') + '</span>' +
        '<span class="t-count" title="Pomodoros done / estimated"><b>' + t.act + '</b>/' + t.est + '</span>' +
        '<button type="button" class="t-edit" aria-label="Edit task"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="5" r="1.8"/><circle cx="12" cy="12" r="1.8"/><circle cx="12" cy="19" r="1.8"/></svg></button></li>';
    });
    if (editing === 'new') html += editorHTML(null);
    list.innerHTML = html;
    $('#addTaskBtn').hidden = editing === 'new';
    const active = S.tasks.find(function (t) { return t.id === S.activeTask; });
    $('#workingOn').innerHTML = active ? 'Working on: <b>' + esc(active.title) + '</b>' : (S.tasks.length ? 'Tap a task to fly with it.' : 'What are you working on today?');
    // summary: Pomos x/y, Finish at HH:MM (h)
    const sum = $('#taskSummary');
    const open = S.tasks.filter(function (t) { return !t.done; });
    if (!S.tasks.length) { sum.hidden = true; return; }
    const est = S.tasks.reduce(function (a, t) { return a + t.est; }, 0);
    const left = open.reduce(function (a, t) { return a + Math.max(0, t.est - t.act); }, 0);
    let html2 = '<span>Pomos:<b>' + S.tasks.reduce(function (a, t) { return a + t.act; }, 0) + '/' + est + '</b></span>';
    if (left > 0) {
      const s = S.settings, t = T();
      let ms = 0, rounds = t.rounds;
      if (t.mode !== 'focus') ms += remainingMs();
      for (let i = 0; i < left; i++) {
        ms += s.focus * MIN;
        if (i === 0 && t.mode === 'focus') ms -= elapsedMs();
        rounds++;
        if (i < left - 1) ms += (rounds % s.interval === 0 ? s.long : s.short) * MIN;
      }
      const fin = new Date(Date.now() + ms);
      html2 += '<span>Finish at<b>' + fin.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }) + '</b> (' + (ms / HOUR).toFixed(1) + 'h)</span>';
    }
    sum.innerHTML = html2; sum.hidden = false;
  }
  function editorHTML(t) {
    const isNew = !t; t = t || { title: '', est: 1, note: '' };
    return '<li class="task-editor" data-edit="' + (isNew ? 'new' : t.id) + '"><div class="te-body">' +
      '<input class="te-title" type="text" maxlength="200" placeholder="What are you working on?" value="' + esc(t.title) + '" aria-label="Task title">' +
      '<div class="te-est"><span>Est. pomodoros</span><div class="stepper small"><button type="button" data-te="-1" aria-label="Fewer">\u2212</button><input type="number" class="te-num" min="1" max="99" value="' + t.est + '" aria-label="Estimated pomodoros"><button type="button" data-te="1" aria-label="More">+</button></div>' +
      '<span class="hint">' + S.settings.focus + ' min each</span></div>' +
      '<textarea class="te-note" maxlength="1000" placeholder="Add a note (optional)" aria-label="Note">' + esc(t.note || '') + '</textarea></div>' +
      '<div class="te-foot">' + (isNew ? '' : '<button type="button" class="btn btn-danger btn-sm" data-te-act="delete">Delete</button>') +
      '<span class="spacer"></span><button type="button" class="btn btn-ghost btn-sm" data-te-act="cancel">Cancel</button><button type="button" class="btn btn-navy btn-sm" data-te-act="save">Save</button></div></li>';
  }
  function openEditor(id) {
    editing = id; renderTasks();
    const inp = $('#taskList .te-title'); if (inp) { inp.focus(); inp.select(); }
  }
  function saveEditor(li) {
    const title = li.querySelector('.te-title').value.trim();
    if (!title) { li.querySelector('.te-title').focus(); return; }
    const est = Math.round(num(li.querySelector('.te-num').value, 1, 1, 99));
    const note = li.querySelector('.te-note').value.trim();
    if (editing === 'new') {
      const t = { id: uid(), title: title, est: est, act: 0, done: false, note: note };
      S.tasks.push(t);
      if (!S.activeTask) S.activeTask = t.id;
    } else {
      const t = S.tasks.find(function (x) { return x.id === editing; });
      if (t) { t.title = title; t.est = est; t.note = note; }
    }
    editing = null; save(); renderTasks();
  }
  $('#addTaskBtn').addEventListener('click', function () { openEditor('new'); });
  $('#taskList').addEventListener('click', function (e) {
    const ed = e.target.closest('.task-editor');
    if (ed) {
      const stepB = e.target.closest('[data-te]');
      if (stepB) { const n2 = ed.querySelector('.te-num'); n2.value = Math.min(99, Math.max(1, (Number(n2.value) || 1) + Number(stepB.dataset.te))); return; }
      const act = e.target.closest('[data-te-act]'); if (!act) return;
      const a = act.dataset.teAct;
      if (a === 'cancel') { editing = null; renderTasks(); }
      else if (a === 'save') saveEditor(ed);
      else if (a === 'delete') {
        S.tasks = S.tasks.filter(function (x) { return x.id !== editing; });
        if (S.activeTask === editing) S.activeTask = null;
        editing = null; save(); renderTasks();
      }
      return;
    }
    const li = e.target.closest('.task'); if (!li) return;
    const t = S.tasks.find(function (x) { return x.id === li.dataset.id; }); if (!t) return;
    if (e.target.closest('.check')) { t.done = !t.done; Audio.click(); }
    else if (e.target.closest('.t-edit')) { openEditor(t.id); return; }
    else S.activeTask = t.id;
    save(); renderTasks();
  });
  $('#taskList').addEventListener('keydown', function (e) {
    const ed = e.target.closest('.task-editor'); if (!ed) return;
    if (e.key === 'Enter' && e.target.tagName !== 'TEXTAREA') { e.preventDefault(); saveEditor(ed); }
    if (e.key === 'Escape') { e.preventDefault(); editing = null; renderTasks(); }
  });
  const menuBtn = $('#tasksMenuBtn'), menu = $('#tasksMenu');
  menuBtn.addEventListener('click', function (e) { e.stopPropagation(); menu.hidden = !menu.hidden; menuBtn.setAttribute('aria-expanded', String(!menu.hidden)); });
  document.addEventListener('click', function (e) { if (!menu.hidden && !e.target.closest('.menu-wrap')) { menu.hidden = true; menuBtn.setAttribute('aria-expanded', 'false'); } });
  menu.addEventListener('click', function (e) {
    const b = e.target.closest('[data-act]'); if (!b) return;
    menu.hidden = true; menuBtn.setAttribute('aria-expanded', 'false');
    const act = b.dataset.act;
    if (act === 'clear-done') { S.tasks = S.tasks.filter(function (t) { return !t.done; }); }
    else if (act === 'clear-act') { S.tasks.forEach(function (t) { t.act = 0; }); }
    else if (act === 'clear-all') {
      confirmBox('Clear all tasks?', 'This removes every task from the list. Your flight progress is not affected.', 'Clear all', function () { S.tasks = []; S.activeTask = null; editing = null; save(); renderTasks(); });
      return;
    }
    if (!S.tasks.some(function (t) { return t.id === S.activeTask; })) S.activeTask = null;
    save(); renderTasks();
  });

  // ------------------------------------------------------------------ controls wiring
  $('#startBtn').addEventListener('click', toggle);
  $('#resetBtn').addEventListener('click', function () { resetTimer(); Audio.click(); });
  $('#skipBtn').addEventListener('click', skip);
  $$('.mode-tab').forEach(function (b) { b.addEventListener('click', function () { switchMode(b.dataset.mode); }); });
  $('#sessionNo').addEventListener('click', function () {
    confirmBox('Reset the session count?', 'The #' + ($('#sessionNo').textContent.slice(1)) + ' counter goes back to #1. Your focus hours are not affected.', 'Reset count', function () { T().rounds = 0; save(); render(false); });
  });
  $('#muteBtn').addEventListener('click', function () {
    S.settings.muted = !S.settings.muted;
    this.setAttribute('aria-pressed', String(S.settings.muted));
    this.setAttribute('aria-label', S.settings.muted ? 'Unmute sounds' : 'Mute sounds');
    document.body.classList.toggle('muted', S.settings.muted);
    if (S.settings.muted) stopSpeech();
    applyVolume(); save();
  });
  function setViewButtons(v) { $$('.view-btn').forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.view === v)); }); }
  $$('.view-btn').forEach(function (b) { b.addEventListener('click', function () { if (world) { world.view(b.dataset.view); setViewButtons(b.dataset.view); } }); });

  document.addEventListener('keydown', function (e) {
    if (e.code !== 'Space' && e.key !== ' ') return;
    if (e.ctrlKey || e.metaKey || e.altKey || e.repeat) return;
    const a = document.activeElement;
    if ($$('dialog[open]').length) return;
    if (a && a !== document.body && a.id !== 'world') return; // focused buttons handle Space natively
    e.preventDefault();
    toggle();
  });

  // ------------------------------------------------------------------ boot
  function boot() {
    const t = T(), s = S.settings;
    document.body.dataset.mode = t.mode;
    document.body.classList.toggle('muted', !!s.muted);
    document.body.classList.toggle('reduce-motion', !!s.reduceMotion);
    $('#muteBtn').setAttribute('aria-pressed', String(!!s.muted));
    // shared wings path for boarding announcement
    const svgNS = 'http://www.w3.org/2000/svg';
    const defs = document.createElementNS(svgNS, 'svg'); defs.setAttribute('width', '0'); defs.setAttribute('height', '0'); defs.style.position = 'absolute';
    defs.innerHTML = '<defs><path id="wingsPath" d="' + $('.attendant .wings path').getAttribute('d') + '"/></defs>';
    document.body.appendChild(defs);

    applyVolume();
    initWorld();
    ['#pcListen', '#fnListen', '#listenIntro'].forEach(function (id) { $(id).dataset.label = $(id).textContent; });
    // A session that ended while the page was closed
    if (t.running && t.endAt <= Date.now()) {
      creditFocus();
      finish({ late: true });
    }
    renderProgress(); renderTasks(); render(false);
    startTicker();
    openBoarding();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();

  // tiny debug/testing hook
  window.GH = { state: function () { return S; }, finish: finish, openFinale: openFinale };
})();
