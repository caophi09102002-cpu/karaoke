/**
 * Web Audio API Engine for Karaoke Dual-Screen App
 *
 * 1. Stereo Splitter (Vocal Cut / Separation):
 *    Standard Karaoke tracks typically encode:
 *    - Left Channel (0): Music Beat only
 *    - Right Channel (1): Vocal + Music Beat
 *    Using ChannelSplitterNode (2) & ChannelMergerNode (2):
 *    - mute-vocal (Beat only): Channel 0 is duplicated to both Left (0) and Right (1).
 *    - unmute-vocal (Full Stereo / Singer): Standard Left -> Left, Right -> Right.
 *
 * 2. Key Transpose (Pitch Shifting):
 *    - Supports range from -4 to +4 semitones (nửa cung).
 *    - Granular Delay Modulation (Web Audio API) shifts pitch in real time while
 *      maintaining 100% constant playback speed/tempo.
 *    - When semitones === 0, direct dry bypass is used for pristine fidelity.
 */

function createFadeBuffer(context: AudioContext, activeTime: number, fadeTime: number): AudioBuffer {
  const length1 = Math.round(activeTime * context.sampleRate);
  const length2 = Math.round((activeTime - 2 * fadeTime) * context.sampleRate);
  const length = length1 + length2;
  const buffer = context.createBuffer(1, length, context.sampleRate);
  const p = buffer.getChannelData(0);

  const fadeLength = Math.round(fadeTime * context.sampleRate);
  const fadeIndex1 = fadeLength;
  const fadeIndex2 = length1 - fadeLength;

  for (let i = 0; i < length1; ++i) {
    let value: number;
    if (i < fadeIndex1) {
      value = Math.sqrt(i / fadeLength);
    } else if (i >= fadeIndex2) {
      value = Math.sqrt(1 - (i - fadeIndex2) / fadeLength);
    } else {
      value = 1;
    }
    p[i] = value;
  }

  for (let i = length1; i < length; ++i) {
    p[i] = 0;
  }

  return buffer;
}

function createDelayTimeBuffer(
  context: AudioContext,
  activeTime: number,
  fadeTime: number,
  shiftUp: boolean
): AudioBuffer {
  const length1 = Math.round(activeTime * context.sampleRate);
  const length2 = Math.round((activeTime - 2 * fadeTime) * context.sampleRate);
  const length = length1 + length2;
  const buffer = context.createBuffer(1, length, context.sampleRate);
  const p = buffer.getChannelData(0);

  for (let i = 0; i < length1; ++i) {
    if (shiftUp) {
      p[i] = (length1 - i) / length;
    } else {
      p[i] = i / length1;
    }
  }

  for (let i = length1; i < length; ++i) {
    p[i] = 0;
  }

  return buffer;
}

/**
 * Granular Pitch Shifter Node implemented on native Web Audio graph
 */
class WebAudioGranularPitchShifter {
  private context: AudioContext;
  public input: GainNode;
  public output: GainNode;

  private mod1Gain: GainNode;
  private mod2Gain: GainNode;
  private mod3Gain: GainNode;
  private mod4Gain: GainNode;
  private modGain1: GainNode;
  private modGain2: GainNode;

  private delayTime: number = 0.1;
  private fadeTime: number = 0.05;
  private bufferTime: number = 0.1;

  constructor(context: AudioContext) {
    this.context = context;

    this.input = context.createGain();
    this.output = context.createGain();

    const delay1 = context.createDelay(1.0);
    const delay2 = context.createDelay(1.0);

    // Buffers for delay time modulation
    const shiftDownBuffer = createDelayTimeBuffer(context, this.bufferTime, this.fadeTime, false);
    const shiftUpBuffer = createDelayTimeBuffer(context, this.bufferTime, this.fadeTime, true);

    const mod1 = context.createBufferSource();
    const mod2 = context.createBufferSource();
    const mod3 = context.createBufferSource();
    const mod4 = context.createBufferSource();

    mod1.buffer = shiftDownBuffer;
    mod2.buffer = shiftDownBuffer;
    mod3.buffer = shiftUpBuffer;
    mod4.buffer = shiftUpBuffer;

    mod1.loop = true;
    mod2.loop = true;
    mod3.loop = true;
    mod4.loop = true;

    this.mod1Gain = context.createGain();
    this.mod2Gain = context.createGain();
    this.mod3Gain = context.createGain();
    this.mod4Gain = context.createGain();

    this.mod3Gain.gain.value = 0;
    this.mod4Gain.gain.value = 0;

    mod1.connect(this.mod1Gain);
    mod2.connect(this.mod2Gain);
    mod3.connect(this.mod3Gain);
    mod4.connect(this.mod4Gain);

    this.modGain1 = context.createGain();
    this.modGain2 = context.createGain();

    this.mod1Gain.connect(this.modGain1);
    this.mod2Gain.connect(this.modGain2);
    this.mod3Gain.connect(this.modGain1);
    this.mod4Gain.connect(this.modGain2);

    this.modGain1.connect(delay1.delayTime);
    this.modGain2.connect(delay2.delayTime);

    // Crossfade windows
    const fadeBuffer = createFadeBuffer(context, this.bufferTime, this.fadeTime);
    const fade1 = context.createBufferSource();
    const fade2 = context.createBufferSource();
    fade1.buffer = fadeBuffer;
    fade2.buffer = fadeBuffer;
    fade1.loop = true;
    fade2.loop = true;

    const mix1 = context.createGain();
    const mix2 = context.createGain();
    mix1.gain.value = 0;
    mix2.gain.value = 0;

    fade1.connect(mix1.gain);
    fade2.connect(mix2.gain);

    // Audio path
    this.input.connect(delay1);
    this.input.connect(delay2);
    delay1.connect(mix1);
    delay2.connect(mix2);
    mix1.connect(this.output);
    mix2.connect(this.output);

    // Start modulators and crossfades
    const t = context.currentTime + 0.02;
    const t2 = t + this.bufferTime - this.fadeTime;

    mod1.start(t);
    mod2.start(t2);
    mod3.start(t);
    mod4.start(t2);
    fade1.start(t);
    fade2.start(t2);

    this.setDelay(this.delayTime);
  }

  private setDelay(time: number) {
    this.modGain1.gain.setTargetAtTime(0.5 * time, this.context.currentTime, 0.01);
    this.modGain2.gain.setTargetAtTime(0.5 * time, this.context.currentTime, 0.01);
  }

  public setPitchOffset(mult: number) {
    if (mult > 0) {
      // Pitch UP
      this.mod1Gain.gain.setValueAtTime(0, this.context.currentTime);
      this.mod2Gain.gain.setValueAtTime(0, this.context.currentTime);
      this.mod3Gain.gain.setValueAtTime(1, this.context.currentTime);
      this.mod4Gain.gain.setValueAtTime(1, this.context.currentTime);
    } else {
      // Pitch DOWN
      this.mod1Gain.gain.setValueAtTime(1, this.context.currentTime);
      this.mod2Gain.gain.setValueAtTime(1, this.context.currentTime);
      this.mod3Gain.gain.setValueAtTime(0, this.context.currentTime);
      this.mod4Gain.gain.setValueAtTime(0, this.context.currentTime);
    }
    this.setDelay(this.delayTime * Math.abs(mult));
  }
}

/**
 * Complete Karaoke Audio Processor managing Vocal Splitter & Pitch Shifter
 */
export class KaraokeAudioProcessor {
  private audioCtx: AudioContext | null = null;
  private mediaSource: MediaElementAudioSourceNode | null = null;
  private connectedElement: HTMLMediaElement | null = null;

  // Splitter & Merger Nodes for Vocal Cut
  private splitter: ChannelSplitterNode | null = null;
  private merger: ChannelMergerNode | null = null;
  private leftToLeftGain: GainNode | null = null;
  private leftToRightGain: GainNode | null = null;
  private rightToRightGain: GainNode | null = null;

  // Pitch Shifter and Dry/Wet Bypasser
  private pitchShifter: WebAudioGranularPitchShifter | null = null;
  private dryGain: GainNode | null = null;
  private wetGain: GainNode | null = null;
  private masterGain: GainNode | null = null;

  // Current State
  private isVocalMuted: boolean = false;
  private pitchSemitones: number = 0; // -4 to +4

  constructor() {}

  /**
   * Initialize or retrieve the AudioContext
   */
  public getAudioContext(): AudioContext {
    if (!this.audioCtx) {
      const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
      this.audioCtx = new AudioCtxClass();
    }
    if (this.audioCtx.state === "suspended") {
      this.audioCtx.resume().catch(() => {});
    }
    return this.audioCtx;
  }

  /**
   * Connect an HTML5 <video> or <audio> element to the Web Audio pipeline
   */
  public attachMediaElement(element: HTMLMediaElement) {
    if (this.connectedElement === element && this.mediaSource) {
      // Already attached to this media element
      this.resume();
      return;
    }

    const ctx = this.getAudioContext();

    try {
      // Create source node for media element
      this.mediaSource = ctx.createMediaElementSource(element);
      this.connectedElement = element;

      // 1. Setup Stereo Splitter Nodes (Left: Beat, Right: Vocal + Beat)
      this.splitter = ctx.createChannelSplitter(2);
      this.merger = ctx.createChannelMerger(2);

      this.leftToLeftGain = ctx.createGain();
      this.leftToRightGain = ctx.createGain();
      this.rightToRightGain = ctx.createGain();

      // Splitter output 0 -> Left channel
      this.splitter.connect(this.leftToLeftGain, 0); // -> Merger input 0 (Left Out)
      this.splitter.connect(this.leftToRightGain, 0); // -> Merger input 1 (Right Out when vocal muted)

      // Splitter output 1 -> Right channel
      this.splitter.connect(this.rightToRightGain, 1); // -> Merger input 1 (Right Out when vocal active)

      this.leftToLeftGain.connect(this.merger, 0, 0);
      this.leftToRightGain.connect(this.merger, 0, 1);
      this.rightToRightGain.connect(this.merger, 0, 1);

      // Connect source to splitter
      this.mediaSource.connect(this.splitter);

      // 2. Setup Pitch Shifter with Dry/Wet Routing
      this.pitchShifter = new WebAudioGranularPitchShifter(ctx);
      this.dryGain = ctx.createGain();
      this.wetGain = ctx.createGain();
      this.masterGain = ctx.createGain();
      this.masterGain.gain.value = 1.0;

      // Vocal splitter merger output feeds into both dry and pitch shifter
      this.merger.connect(this.dryGain);
      this.merger.connect(this.pitchShifter.input);

      this.pitchShifter.output.connect(this.wetGain);

      // Mix dry and wet to master gain, then to destination
      this.dryGain.connect(this.masterGain);
      this.wetGain.connect(this.masterGain);
      this.masterGain.connect(ctx.destination);

      // Apply initial state
      this.applyVocalState();
      this.applyPitchState();

      console.log("[KaraokeAudioProcessor] Successfully initialized Web Audio pipeline.");
    } catch (err) {
      console.warn("[KaraokeAudioProcessor] Error attaching media element:", err);
    }
  }

  /**
   * Resume audio context if suspended (browser autoplay policy)
   */
  public resume() {
    if (this.audioCtx && this.audioCtx.state === "suspended") {
      this.audioCtx.resume().catch(() => {});
    }
  }

  /**
   * Set Vocal Mute state:
   * - true: Mute Vocal (Takes Left beat and duplicates to both Left & Right speakers)
   * - false: Unmute Vocal (Plays original Stereo Left & Right)
   */
  public setVocalMuted(muted: boolean) {
    this.isVocalMuted = muted;
    this.applyVocalState();
  }

  public toggleVocal(): boolean {
    this.setVocalMuted(!this.isVocalMuted);
    return this.isVocalMuted;
  }

  public getVocalMuted(): boolean {
    return this.isVocalMuted;
  }

  private applyVocalState() {
    if (!this.audioCtx || !this.leftToLeftGain || !this.leftToRightGain || !this.rightToRightGain) {
      return;
    }

    const now = this.audioCtx.currentTime;

    if (this.isVocalMuted) {
      // MUTE VOCAL (Chỉ phát Beat):
      // Left channel is duplicated to both Left and Right speakers
      this.leftToLeftGain.gain.setValueAtTime(1.0, now);
      this.leftToRightGain.gain.setValueAtTime(1.0, now);
      this.rightToRightGain.gain.setValueAtTime(0.0, now);
      console.log("[KaraokeAudioProcessor] Mode: BEAT ONLY (Vocal muted, Left channel cloned to Stereo)");
    } else {
      // UNMUTE VOCAL (Có tiếng ca sĩ):
      // Standard stereo Left -> Left, Right -> Right
      this.leftToLeftGain.gain.setValueAtTime(1.0, now);
      this.leftToRightGain.gain.setValueAtTime(0.0, now);
      this.rightToRightGain.gain.setValueAtTime(1.0, now);
      console.log("[KaraokeAudioProcessor] Mode: FULL STEREO (Singer vocal unmuted)");
    }
  }

  /**
   * Set Key Transpose in semitones (-4 to +4)
   * 0 = Original key (Gốc)
   */
  public setPitch(semitones: number) {
    const clamped = Math.max(-4, Math.min(4, Math.round(semitones)));
    this.pitchSemitones = clamped;
    this.applyPitchState();
  }

  public getPitch(): number {
    return this.pitchSemitones;
  }

  public pitchUp(): number {
    this.setPitch(this.pitchSemitones + 1);
    return this.pitchSemitones;
  }

  public pitchDown(): number {
    this.setPitch(this.pitchSemitones - 1);
    return this.pitchSemitones;
  }

  public pitchReset(): number {
    this.setPitch(0);
    return this.pitchSemitones;
  }

  private semitonesToMult(semitones: number): number {
    // Map -4..+4 semitones to delay time modulation factor
    if (semitones === 0) return 0;
    const sign = semitones > 0 ? 1 : -1;
    const abs = Math.abs(semitones);

    switch (abs) {
      case 1:
        return sign * 0.15;
      case 2:
        return sign * 0.24;
      case 3:
        return sign * 0.34;
      case 4:
        return sign * 0.52;
      default:
        return sign * (abs * 0.12);
    }
  }

  private applyPitchState() {
    if (!this.audioCtx || !this.dryGain || !this.wetGain || !this.pitchShifter) {
      return;
    }

    const now = this.audioCtx.currentTime;

    if (this.pitchSemitones === 0) {
      // TONE GỐC: 100% dry bypass for crystal clean audio
      this.dryGain.gain.setValueAtTime(1.0, now);
      this.wetGain.gain.setValueAtTime(0.0, now);
      console.log("[KaraokeAudioProcessor] Tone: GỐC (0 semitones - Dry bypass)");
    } else {
      // TRANSPOSED: Route through pitch shifter
      this.dryGain.gain.setValueAtTime(0.0, now);
      this.wetGain.gain.setValueAtTime(1.0, now);

      const mult = this.semitonesToMult(this.pitchSemitones);
      this.pitchShifter.setPitchOffset(mult);
      console.log(
        `[KaraokeAudioProcessor] Tone transposed: ${this.pitchSemitones > 0 ? "+" : ""}${
          this.pitchSemitones
        } semitones (mult: ${mult})`
      );
    }
  }

  /**
   * Set Master Volume (0.0 to 1.0)
   */
  public setVolume(vol: number) {
    if (this.masterGain && this.audioCtx) {
      const v = Math.max(0, Math.min(1, vol));
      this.masterGain.gain.setValueAtTime(v, this.audioCtx.currentTime);
    }
  }

  /**
   * Clean up Web Audio pipeline
   */
  public dispose() {
    if (this.audioCtx && this.audioCtx.state !== "closed") {
      this.audioCtx.close().catch(() => {});
      this.audioCtx = null;
    }
    this.mediaSource = null;
    this.connectedElement = null;
  }
}

// Global singleton instance for Host screen
export const karaokeAudio = typeof window !== "undefined" ? new KaraokeAudioProcessor() : null;
