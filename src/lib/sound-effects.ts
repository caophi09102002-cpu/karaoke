/**
 * Sound effects engine using Web Audio API.
 * Synthesizes realistic applause, whistling, and cheering sounds directly in browser.
 * Works completely offline without needing external audio file dependencies.
 */

class SoundEngine {
  private ctx: AudioContext | null = null;

  private getContext(): AudioContext | null {
    if (typeof window === "undefined") return null;
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === "suspended") {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  /**
   * Synthesize realistic crowd applause
   */
  public playApplause(durationSec = 2.5): void {
    const ctx = this.getContext();
    if (!ctx) return;

    try {
      const bufferSize = ctx.sampleRate * durationSec;
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);

      // Generate randomized clap density envelope
      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        // Modulate with rhythmic hand clap bursts
        const burst = Math.sin(i / 180) * 0.4 + 0.6;
        data[i] = white * burst;
      }

      const noise = ctx.createBufferSource();
      noise.buffer = buffer;

      // Filter to acoustic clapping frequency range (800Hz - 2800Hz)
      const filter = ctx.createBiquadFilter();
      filter.type = "bandpass";
      filter.frequency.value = 1400;
      filter.Q.value = 1.2;

      // Gain envelope with smooth fade in and fade out
      const gain = ctx.createGain();
      const now = ctx.currentTime;
      gain.gain.setValueAtTime(0.01, now);
      gain.gain.linearRampToValueAtTime(0.4, now + 0.2);
      gain.gain.exponentialRampToValueAtTime(0.001, now + durationSec);

      noise.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);

      noise.start(now);
      noise.stop(now + durationSec);
    } catch (e) {
      console.warn("[SoundEngine] Failed to play applause:", e);
    }
  }

  /**
   * Synthesize crowd whistle
   */
  public playWhistle(durationSec = 1.2): void {
    const ctx = this.getContext();
    if (!ctx) return;

    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const now = ctx.currentTime;

      osc.type = "sine";
      // Whistle frequency ramp up then down
      osc.frequency.setValueAtTime(1600, now);
      osc.frequency.exponentialRampToValueAtTime(2400, now + 0.3);
      osc.frequency.exponentialRampToValueAtTime(1900, now + durationSec);

      gain.gain.setValueAtTime(0.01, now);
      gain.gain.linearRampToValueAtTime(0.25, now + 0.1);
      gain.gain.exponentialRampToValueAtTime(0.001, now + durationSec);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + durationSec);
    } catch (e) {
      console.warn("[SoundEngine] Failed to play whistle:", e);
    }
  }

  /**
   * Play celebration cheer fanfare
   */
  public playCheer(): void {
    const ctx = this.getContext();
    if (!ctx) return;

    try {
      // First trigger applause
      this.playApplause(2.8);

      // Play joyful major chord fanfare: C5, E5, G5, C6
      const freqs = [523.25, 659.25, 783.99, 1046.5];
      const now = ctx.currentTime;

      freqs.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = "triangle";
        osc.frequency.setValueAtTime(freq, now + idx * 0.08);

        const startTime = now + idx * 0.08;
        gain.gain.setValueAtTime(0.01, startTime);
        gain.gain.linearRampToValueAtTime(0.15, startTime + 0.05);
        gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.8);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(startTime);
        osc.stop(startTime + 0.85);
      });
    } catch (e) {
      console.warn("[SoundEngine] Failed to play cheer:", e);
    }
  }

  /**
   * Play based on cheer type
   */
  public play(type: "applause" | "whistle" | "cheer" | "heart" | "fire"): void {
    switch (type) {
      case "whistle":
        this.playWhistle();
        break;
      case "cheer":
      case "heart":
      case "fire":
        this.playCheer();
        break;
      case "applause":
      default:
        this.playApplause();
        break;
    }
  }
}

export const soundEngine = new SoundEngine();
