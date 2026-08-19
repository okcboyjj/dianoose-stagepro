// A small, accurate Web Audio metronome for Stage Mode's click track.
//
// Timing uses the standard lookahead-scheduler pattern: a coarse setInterval wakes up often
// enough to schedule the next few beats *ahead* on the Web Audio clock (sample-accurate), so
// the audible tempo doesn't drift even if the JS timer is jittery. Clicks are short oscillator
// blips — no samples to load, so it starts instantly on the toggle tap (which also satisfies the
// browser's user-gesture requirement for creating/resuming the AudioContext).
export class Metronome {
  constructor(onBeat) {
    this.ctx = null;
    this.bpm = 90;
    this.beatsPerBar = 4;
    this.nextNoteTime = 0;   // Web Audio time of the next beat
    this.beat = 0;           // 0-based beat within the bar
    this.timer = null;
    this.onBeat = onBeat;    // (beatIndexInBar) => void, fired ~in sync with the audio
    this.lookahead = 25;     // ms between scheduler wakeups
    this.scheduleAhead = 0.12; // seconds of audio to schedule in advance
  }

  _click(time, accent) {
    const ctx = this.ctx;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.value = accent ? 1500 : 900;         // beat 1 is a higher, brighter click
    const peak = accent ? 0.5 : 0.32;
    gain.gain.setValueAtTime(0.0001, time);
    gain.gain.exponentialRampToValueAtTime(peak, time + 0.001);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.05);
    osc.connect(gain).connect(ctx.destination);
    osc.start(time);
    osc.stop(time + 0.06);
  }

  _scheduler() {
    const secondsPerBeat = 60 / this.bpm;
    while (this.nextNoteTime < this.ctx.currentTime + this.scheduleAhead) {
      const accent = this.beat % this.beatsPerBar === 0;
      this._click(this.nextNoteTime, accent);
      if (this.onBeat) {
        const beatInBar = this.beat % this.beatsPerBar;
        const delayMs = Math.max(0, (this.nextNoteTime - this.ctx.currentTime) * 1000);
        setTimeout(() => this.onBeat(beatInBar), delayMs);
      }
      this.nextNoteTime += secondsPerBeat;
      this.beat++;
    }
  }

  start(bpm, beatsPerBar = 4) {
    this.bpm = bpm || this.bpm;
    this.beatsPerBar = beatsPerBar;
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AC();
    }
    if (this.ctx.state === "suspended") this.ctx.resume();
    this.beat = 0;
    this.nextNoteTime = this.ctx.currentTime + 0.05;
    if (this.timer) clearInterval(this.timer);
    this.timer = setInterval(() => this._scheduler(), this.lookahead);
  }

  setBpm(bpm) {
    if (bpm) this.bpm = bpm; // takes effect on the next scheduled beat — no restart, no drift
  }

  stop() {
    if (this.timer) { clearInterval(this.timer); this.timer = null; }
  }

  dispose() {
    this.stop();
    if (this.ctx) { try { this.ctx.close(); } catch { /* noop */ } this.ctx = null; }
  }
}
