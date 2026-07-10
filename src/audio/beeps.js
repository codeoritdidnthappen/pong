/**
 * The cabinet had three sounds and no sample data. Neither do we: a square wave
 * oscillator, three pitches, and a short envelope.
 *
 * Frequencies are the ones from the original 1972 board.
 */
const TONES = {
  paddle: { freq: 459, duration: 0.05 },
  wall: { freq: 226, duration: 0.05 },
  score: { freq: 490, duration: 0.28 },
};

export function createAudio(muted = false) {
  let ctx = null;
  let master = null;

  /**
   * Browsers refuse to start an AudioContext outside a user gesture, so it is
   * created on the first one and resumed on every subsequent one.
   */
  function unlock() {
    if (!ctx) {
      const AudioCtx = window.AudioContext ?? window.webkitAudioContext;
      if (!AudioCtx) return;
      ctx = new AudioCtx();
      master = ctx.createGain();
      master.gain.value = 0.12;
      master.connect(ctx.destination);
    }
    if (ctx.state === "suspended") ctx.resume();
  }

  function play(kind) {
    if (muted || !ctx || ctx.state !== "running") return;
    const tone = TONES[kind];
    if (!tone) return;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "square";
    osc.frequency.value = tone.freq;

    const now = ctx.currentTime;
    // A hard attack and a quick exponential decay: a beep, not a note.
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(1, now + 0.002);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + tone.duration);

    osc.connect(gain).connect(master);
    osc.start(now);
    osc.stop(now + tone.duration + 0.02);
  }

  return {
    unlock,
    play,
    playEvents(events) {
      // One beep per kind per tick; a double wall hit in one step is one sound.
      const kinds = new Set();
      for (const event of events) {
        if (event.type === "paddle") kinds.add("paddle");
        else if (event.type === "wall") kinds.add("wall");
        else if (event.type === "score") kinds.add("score");
      }
      kinds.forEach(play);
    },
    setMuted(value) {
      muted = value;
    },
    get muted() {
      return muted;
    },
  };
}
