/* Golden Hours — audio engine.
   Alarms are scheduled on the Web Audio clock the moment a session starts,
   so the chime fires on time even if the tab is minimized and timers are throttled. */
(function () {
  'use strict';

  const FILES = {
    'cabin-chime': 'assets/audio/cabin-chime.wav',
    'arrival-chime': 'assets/audio/arrival-chime.wav',
    'boarding-bell': 'assets/audio/boarding-bell.wav',
    'jet-flyby': 'assets/audio/jet-flyby.wav',
    'fanfare': 'assets/audio/fanfare.wav'
  };

  let ctx = null, master = null, sfxGain = null;
  const buffers = {};
  let scheduled = [];           // alarm sources waiting on the audio clock
  let scheduledFor = 0;         // wall-clock ms the alarm is aimed at
  let ambience = null;
  let volume = 0.7, ambienceVolume = 0.35;

  function ensureCtx() {
    if (ctx) return ctx;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain(); master.gain.value = 1; master.connect(ctx.destination);
    sfxGain = ctx.createGain(); sfxGain.gain.value = volume; sfxGain.connect(master);
    loadAll();
    return ctx;
  }

  function synthBuffer(name) {
    const data = window.GHSynth.render(name, ctx.sampleRate);
    const b = ctx.createBuffer(1, data.length, ctx.sampleRate);
    b.getChannelData(0).set(data);
    return b;
  }

  function loadAll() {
    Object.keys(FILES).forEach(function (name) {
      if (buffers[name]) return;
      // Start with the synthesized version so sound is instantly available,
      // then swap in the file once it has been fetched.
      try { buffers[name] = synthBuffer(name); } catch (e) { /* ignore */ }
      if (location.protocol === 'file:') return;
      fetch(FILES[name]).then(function (r) {
        if (!r.ok) throw new Error(r.status);
        return r.arrayBuffer();
      }).then(function (ab) {
        return new Promise(function (res, rej) { ctx.decodeAudioData(ab, res, rej); });
      }).then(function (buf) { buffers[name] = buf; }).catch(function () { /* keep synth */ });
    });
    try { buffers.click = synthBuffer('click'); } catch (e) { /* ignore */ }
  }

  function unlock() {
    const c = ensureCtx();
    if (c && c.state === 'suspended') c.resume();
  }
  ['pointerdown', 'keydown', 'touchend'].forEach(function (ev) {
    window.addEventListener(ev, unlock, { capture: true, passive: true });
  });

  function running() { return ctx && ctx.state === 'running'; }

  function play(name, when, gain) {
    if (!ensureCtx() || !buffers[name]) return null;
    const src = ctx.createBufferSource();
    src.buffer = buffers[name];
    const g = ctx.createGain(); g.gain.value = gain == null ? 1 : gain;
    src.connect(g); g.connect(sfxGain);
    src.start(when || 0);
    return src;
  }

  const Audio = {
    unlock: unlock,
    isReady: running,
    setVolume: function (v) {
      volume = v;
      if (sfxGain) sfxGain.gain.setTargetAtTime(v, ctx.currentTime, 0.02);
    },
    play: function (name, gain) {
      if (!running()) { unlock(); }
      return play(name, 0, gain);
    },
    click: function () { if (running()) play('click', 0, 0.35); },

    // Schedule the alarm `delaySec` from now; `repeat` plays it N times.
    scheduleAlarm: function (name, delaySec, repeat, wallTargetMs) {
      Audio.cancelAlarm();
      if (!running() || !buffers[name]) return false;
      const len = buffers[name].duration;
      const t0 = ctx.currentTime + Math.max(0, delaySec);
      for (let i = 0; i < Math.max(1, repeat); i++) {
        const src = play(name, t0 + i * (len + 0.25));
        if (src) scheduled.push(src);
      }
      scheduledFor = wallTargetMs || 0;
      return true;
    },
    cancelAlarm: function () {
      scheduled.forEach(function (s) { try { s.stop(); } catch (e) { /* already stopped */ } });
      scheduled = []; scheduledFor = 0;
    },
    // Was an alarm already queued on the audio clock for this end time?
    alarmCovers: function (wallTargetMs) {
      return scheduled.length > 0 && Math.abs(scheduledFor - wallTargetMs) < 1500;
    },
    releaseAlarm: function () { scheduled = []; scheduledFor = 0; },

    // Low cabin hum made of filtered brown noise with a slow swell.
    setAmbience: function (on, vol) {
      if (vol != null) ambienceVolume = vol;
      if (!ensureCtx()) return;
      if (on && !ambience) {
        const len = ctx.sampleRate * 4;
        const buf = ctx.createBuffer(2, len, ctx.sampleRate);
        for (let ch = 0; ch < 2; ch++) {
          const d = buf.getChannelData(ch); let last = 0;
          for (let i = 0; i < len; i++) { const w = Math.random() * 2 - 1; last = (last + 0.02 * w) / 1.02; d[i] = last * 3.2; }
          // crossfade loop seam
          const f = 4000; for (let i = 0; i < f; i++) { const k = i / f; d[i] = d[i] * k + d[len - f + i] * (1 - k); }
        }
        const src = ctx.createBufferSource(); src.buffer = buf; src.loop = true; src.loopStart = 4000 / ctx.sampleRate;
        const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 520; lp.Q.value = 0.4;
        const hum = ctx.createOscillator(); hum.type = 'sine'; hum.frequency.value = 96;
        const humG = ctx.createGain(); humG.gain.value = 0.018;
        const g = ctx.createGain(); g.gain.value = 0;
        const lfo = ctx.createOscillator(); lfo.frequency.value = 0.07;
        const lfoG = ctx.createGain(); lfoG.gain.value = 120;
        lfo.connect(lfoG); lfoG.connect(lp.frequency);
        src.connect(lp); lp.connect(g); hum.connect(humG); humG.connect(g); g.connect(master);
        src.start(); hum.start(); lfo.start();
        g.gain.setTargetAtTime(ambienceVolume, ctx.currentTime, 0.8);
        ambience = { src: src, hum: hum, lfo: lfo, g: g };
      } else if (!on && ambience) {
        const a = ambience; ambience = null;
        a.g.gain.setTargetAtTime(0, ctx.currentTime, 0.4);
        setTimeout(function () { try { a.src.stop(); a.hum.stop(); a.lfo.stop(); } catch (e) { /* ignore */ } }, 2500);
      } else if (on && ambience) {
        ambience.g.gain.setTargetAtTime(ambienceVolume, ctx.currentTime, 0.2);
      }
    }
  };

  window.GHAudio = Audio;
})();
