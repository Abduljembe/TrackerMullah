import { forceRefreshTradingViewQuotes } from './tradingViewSync.ts';
import {
  evaluateOpenPaperPositionsAgainstQuotes,
  setAutoOpenOnSignalEnabled,
} from './paperTradeManager.ts';

export const MASTER_ENGINE_EVENT = 'njia-master-engine-state';

export interface MasterEngineDetail {
  running: boolean;
  at: number;
}

// Always starts in Standby (false) on every fresh website open so the user
// explicitly flips the ignition switch ON to spin up all live systems + audio.
let masterEngineRunning = false;
let lastIgnitionAt = 0;

let sharedEngineCtx: AudioContext | null = null;
let activeCleanupTimer: ReturnType<typeof setTimeout> | null = null;
let activeMasterGain: GainNode | null = null;

function getOrCreateAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const Ctx =
    window.AudioContext ||
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).webkitAudioContext;
  if (!Ctx) return null;

  if (!sharedEngineCtx || sharedEngineCtx.state === 'closed') {
    sharedEngineCtx = new Ctx();
  }
  if (sharedEngineCtx.state === 'suspended') {
    sharedEngineCtx.resume().catch(() => {});
  }
  return sharedEngineCtx;
}

function createSoftSaturationCurve(drive = 3.2): Float32Array<ArrayBuffer> {
  const samples = 1024;
  const curve = new Float32Array(new ArrayBuffer(samples * 4));
  for (let i = 0; i < samples; i++) {
    const x = (i * 2) / samples - 1;
    // Slight asymmetry produces warm even-order engine manifold harmonics
    curve[i] = Math.tanh((x + 0.08 * x * x) * drive);
  }
  return curve;
}

function createNoiseBuffer(ctx: AudioContext, durationSec: number): AudioBuffer {
  const length = Math.max(1, Math.floor(ctx.sampleRate * durationSec));
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  let b0 = 0;
  let b1 = 0;
  let b2 = 0;
  for (let i = 0; i < length; i++) {
    const white = Math.random() * 2 - 1;
    // Smooth pink-tinted exhaust noise
    b0 = 0.99765 * b0 + white * 0.099046;
    b1 = 0.963 * b1 + white * 0.2965164;
    b2 = 0.57 * b2 + white * 1.0526913;
    data[i] = Math.max(-1, Math.min(1, (b0 + b1 + b2 + white * 0.18) * 0.16));
  }
  return buffer;
}

function silencePreviousEngineAudio(ctx: AudioContext) {
  if (activeCleanupTimer) {
    clearTimeout(activeCleanupTimer);
    activeCleanupTimer = null;
  }
  if (activeMasterGain) {
    try {
      const now = ctx.currentTime;
      activeMasterGain.gain.cancelScheduledValues(now);
      activeMasterGain.gain.setValueAtTime(activeMasterGain.gain.value, now);
      activeMasterGain.gain.linearRampToValueAtTime(0.0001, now + 0.05);
    } catch {
      // ignore
    }
    activeMasterGain = null;
  }
}

/**
 * Synthesizes a realistic 4-phase car engine ignition sound via Web Audio API:
 * 1) Key turn click + starter solenoid engage
 * 2) Starter motor cranking compression pulses (4 cranks)
 * 3) Combustion catch + aggressive rev flare
 * 4) Smooth low idle purr that gracefully fades out
 */
export function playCarEngineStartSound(): void {
  const ctx = getOrCreateAudioContext();
  if (!ctx) return;

  try {
    silencePreviousEngineAudio(ctx);

    const t0 = ctx.currentTime + 0.01;
    const masterGain = ctx.createGain();
    masterGain.gain.setValueAtTime(0.0001, t0);
    masterGain.gain.linearRampToValueAtTime(0.75, t0 + 0.02);
    masterGain.gain.setValueAtTime(0.75, t0 + 2.35);
    masterGain.gain.exponentialRampToValueAtTime(0.001, t0 + 3.35);
    masterGain.connect(ctx.destination);
    activeMasterGain = masterGain;

    const noiseBuffer = createNoiseBuffer(ctx, 3.4);

    // -----------------------------------------------------------------------
    // PHASE 1: Ignition Key Turn Click & Starter Solenoid Engage (0.00s - 0.07s)
    // -----------------------------------------------------------------------
    const clickSrc = ctx.createBufferSource();
    clickSrc.buffer = noiseBuffer;
    const clickFilter = ctx.createBiquadFilter();
    clickFilter.type = 'highpass';
    clickFilter.frequency.setValueAtTime(1800, t0);
    const clickGain = ctx.createGain();
    clickGain.gain.setValueAtTime(0.45, t0);
    clickGain.gain.exponentialRampToValueAtTime(0.001, t0 + 0.032);
    clickSrc.connect(clickFilter);
    clickFilter.connect(clickGain);
    clickGain.connect(masterGain);
    clickSrc.start(t0);
    clickSrc.stop(t0 + 0.04);

    const solenoidOsc = ctx.createOscillator();
    solenoidOsc.type = 'triangle';
    solenoidOsc.frequency.setValueAtTime(165, t0 + 0.015);
    solenoidOsc.frequency.exponentialRampToValueAtTime(52, t0 + 0.07);
    const solenoidGain = ctx.createGain();
    solenoidGain.gain.setValueAtTime(0.28, t0 + 0.015);
    solenoidGain.gain.exponentialRampToValueAtTime(0.001, t0 + 0.075);
    solenoidOsc.connect(solenoidGain);
    solenoidGain.connect(masterGain);
    solenoidOsc.start(t0 + 0.015);
    solenoidOsc.stop(t0 + 0.08);

    // -----------------------------------------------------------------------
    // PHASE 2: Starter Motor Cranking Compression Pulses (0.08s - 0.78s)
    // -----------------------------------------------------------------------
    const crankOffsets = [0.08, 0.255, 0.43, 0.605];
    crankOffsets.forEach((offset, idx) => {
      const cs = t0 + offset;
      const crankDur = 0.145;

      // Starter gear whine (high-mid metallic whir)
      const gearOsc = ctx.createOscillator();
      gearOsc.type = 'sawtooth';
      gearOsc.frequency.setValueAtTime(420 + idx * 18, cs);
      gearOsc.frequency.linearRampToValueAtTime(580 + idx * 24, cs + 0.065);
      gearOsc.frequency.linearRampToValueAtTime(380, cs + crankDur);

      const gearFilter = ctx.createBiquadFilter();
      gearFilter.type = 'bandpass';
      gearFilter.frequency.setValueAtTime(640, cs);
      gearFilter.Q.setValueAtTime(3.2, cs);

      const gearGain = ctx.createGain();
      gearGain.gain.setValueAtTime(0.001, cs);
      gearGain.gain.linearRampToValueAtTime(0.11, cs + 0.025);
      gearGain.gain.exponentialRampToValueAtTime(0.002, cs + crankDur);

      gearOsc.connect(gearFilter);
      gearFilter.connect(gearGain);
      gearGain.connect(masterGain);
      gearOsc.start(cs);
      gearOsc.stop(cs + crankDur + 0.01);

      // Cylinder compression chug
      const chugOsc = ctx.createOscillator();
      chugOsc.type = 'sawtooth';
      chugOsc.frequency.setValueAtTime(29, cs);
      chugOsc.frequency.linearRampToValueAtTime(46 + idx * 4, cs + 0.06);
      chugOsc.frequency.linearRampToValueAtTime(27, cs + crankDur);

      const chugFilter = ctx.createBiquadFilter();
      chugFilter.type = 'lowpass';
      chugFilter.frequency.setValueAtTime(210, cs);
      chugFilter.Q.setValueAtTime(2.0, cs);

      const chugGain = ctx.createGain();
      chugGain.gain.setValueAtTime(0.001, cs);
      chugGain.gain.linearRampToValueAtTime(0.32, cs + 0.03);
      chugGain.gain.exponentialRampToValueAtTime(0.003, cs + crankDur);

      chugOsc.connect(chugFilter);
      chugFilter.connect(chugGain);
      chugGain.connect(masterGain);
      chugOsc.start(cs);
      chugOsc.stop(cs + crankDur + 0.01);
    });

    // -----------------------------------------------------------------------
    // PHASE 3 & 4: Combustion Catch, Rev Flare & Smooth Idle Fade (0.76s - 3.32s)
    // -----------------------------------------------------------------------
    const catchAt = t0 + 0.76;
    const stopAt = t0 + 3.35;

    const shaper = ctx.createWaveShaper();
    shaper.curve = createSoftSaturationCurve(3.4);
    shaper.oversample = '2x';

    const engineFilter = ctx.createBiquadFilter();
    engineFilter.type = 'lowpass';
    engineFilter.Q.setValueAtTime(2.6, catchAt);
    engineFilter.frequency.setValueAtTime(190, catchAt);
    engineFilter.frequency.exponentialRampToValueAtTime(1320, catchAt + 0.24);
    engineFilter.frequency.exponentialRampToValueAtTime(760, catchAt + 0.62);
    engineFilter.frequency.exponentialRampToValueAtTime(255, catchAt + 1.28);
    engineFilter.frequency.linearRampToValueAtTime(215, stopAt);

    const engineGain = ctx.createGain();
    engineGain.gain.setValueAtTime(0.001, catchAt);
    engineGain.gain.linearRampToValueAtTime(0.56, catchAt + 0.14);
    engineGain.gain.setValueAtTime(0.52, catchAt + 0.55);
    engineGain.gain.linearRampToValueAtTime(0.34, catchAt + 1.25);
    engineGain.gain.exponentialRampToValueAtTime(0.001, stopAt);

    // Primary cylinder sawtooth
    const oscPrimary = ctx.createOscillator();
    oscPrimary.type = 'sawtooth';
    oscPrimary.frequency.setValueAtTime(46, catchAt);
    oscPrimary.frequency.exponentialRampToValueAtTime(136, catchAt + 0.26);
    oscPrimary.frequency.exponentialRampToValueAtTime(84, catchAt + 0.62);
    oscPrimary.frequency.exponentialRampToValueAtTime(42, catchAt + 1.22);
    oscPrimary.frequency.linearRampToValueAtTime(39, stopAt);

    // Detuned twin manifold sawtooth
    const oscDetuned = ctx.createOscillator();
    oscDetuned.type = 'sawtooth';
    oscDetuned.detune.setValueAtTime(14, catchAt);
    oscDetuned.frequency.setValueAtTime(46, catchAt);
    oscDetuned.frequency.exponentialRampToValueAtTime(136, catchAt + 0.26);
    oscDetuned.frequency.exponentialRampToValueAtTime(84, catchAt + 0.62);
    oscDetuned.frequency.exponentialRampToValueAtTime(42, catchAt + 1.22);
    oscDetuned.frequency.linearRampToValueAtTime(39, stopAt);

    // Harmonic rumble octave (2x firing order)
    const oscHarmonic = ctx.createOscillator();
    oscHarmonic.type = 'triangle';
    oscHarmonic.frequency.setValueAtTime(92, catchAt);
    oscHarmonic.frequency.exponentialRampToValueAtTime(272, catchAt + 0.26);
    oscHarmonic.frequency.exponentialRampToValueAtTime(168, catchAt + 0.62);
    oscHarmonic.frequency.exponentialRampToValueAtTime(84, catchAt + 1.22);
    oscHarmonic.frequency.linearRampToValueAtTime(78, stopAt);

    // Deep sub-bass thump
    const oscSub = ctx.createOscillator();
    oscSub.type = 'sine';
    oscSub.frequency.setValueAtTime(46, catchAt);
    oscSub.frequency.exponentialRampToValueAtTime(136, catchAt + 0.26);
    oscSub.frequency.exponentialRampToValueAtTime(84, catchAt + 0.62);
    oscSub.frequency.exponentialRampToValueAtTime(42, catchAt + 1.22);
    oscSub.frequency.linearRampToValueAtTime(39, stopAt);

    const oscDetunedGain = ctx.createGain();
    oscDetunedGain.gain.setValueAtTime(0.65, catchAt);
    const oscHarmonicGain = ctx.createGain();
    oscHarmonicGain.gain.setValueAtTime(0.45, catchAt);
    const oscSubGain = ctx.createGain();
    oscSubGain.gain.setValueAtTime(0.7, catchAt);

    // Subtle firing-order amplitude LFO for authentic idle purr
    const lfo = ctx.createOscillator();
    lfo.type = 'sine';
    lfo.frequency.setValueAtTime(26, catchAt);
    lfo.frequency.exponentialRampToValueAtTime(13, catchAt + 1.2);
    const lfoGain = ctx.createGain();
    lfoGain.gain.setValueAtTime(45, catchAt);
    lfo.connect(lfoGain);
    lfoGain.connect(engineFilter.frequency);

    // Exhaust breath noise layer
    const exhaustSrc = ctx.createBufferSource();
    exhaustSrc.buffer = noiseBuffer;
    const exhaustFilter = ctx.createBiquadFilter();
    exhaustFilter.type = 'bandpass';
    exhaustFilter.frequency.setValueAtTime(210, catchAt);
    exhaustFilter.frequency.exponentialRampToValueAtTime(440, catchAt + 0.28);
    exhaustFilter.frequency.exponentialRampToValueAtTime(175, catchAt + 1.25);
    exhaustFilter.Q.setValueAtTime(1.1, catchAt);

    const exhaustGain = ctx.createGain();
    exhaustGain.gain.setValueAtTime(0.001, catchAt);
    exhaustGain.gain.linearRampToValueAtTime(0.28, catchAt + 0.16);
    exhaustGain.gain.exponentialRampToValueAtTime(0.06, catchAt + 1.4);
    exhaustGain.gain.exponentialRampToValueAtTime(0.001, stopAt);

    oscPrimary.connect(shaper);
    oscDetuned.connect(oscDetunedGain);
    oscDetunedGain.connect(shaper);
    oscHarmonic.connect(oscHarmonicGain);
    oscHarmonicGain.connect(shaper);
    oscSub.connect(oscSubGain);
    oscSubGain.connect(shaper);

    shaper.connect(engineFilter);
    engineFilter.connect(engineGain);
    engineGain.connect(masterGain);

    exhaustSrc.connect(exhaustFilter);
    exhaustFilter.connect(exhaustGain);
    exhaustGain.connect(masterGain);

    oscPrimary.start(catchAt);
    oscDetuned.start(catchAt);
    oscHarmonic.start(catchAt);
    oscSub.start(catchAt);
    lfo.start(catchAt);
    exhaustSrc.start(catchAt);

    oscPrimary.stop(stopAt);
    oscDetuned.stop(stopAt);
    oscHarmonic.stop(stopAt);
    oscSub.stop(stopAt);
    lfo.stop(stopAt);
    exhaustSrc.stop(stopAt);

    activeCleanupTimer = setTimeout(() => {
      if (activeMasterGain === masterGain) {
        activeMasterGain = null;
      }
      activeCleanupTimer = null;
    }, 3500);
  } catch {
    // Ignore audio errors on restricted environments
  }
}

/**
 * Synthesizes a clean engine shutoff wind-down sound when switching systems OFF.
 */
export function playCarEngineStopSound(): void {
  const ctx = getOrCreateAudioContext();
  if (!ctx) return;

  try {
    silencePreviousEngineAudio(ctx);

    const t0 = ctx.currentTime + 0.01;
    const stopAt = t0 + 0.68;

    const masterGain = ctx.createGain();
    masterGain.gain.setValueAtTime(0.001, t0);
    masterGain.gain.linearRampToValueAtTime(0.38, t0 + 0.04);
    masterGain.gain.exponentialRampToValueAtTime(0.001, stopAt);
    masterGain.connect(ctx.destination);
    activeMasterGain = masterGain;

    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(44, t0);
    osc.frequency.exponentialRampToValueAtTime(16, t0 + 0.58);

    const sub = ctx.createOscillator();
    sub.type = 'sine';
    sub.frequency.setValueAtTime(44, t0);
    sub.frequency.exponentialRampToValueAtTime(16, t0 + 0.58);

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(260, t0);
    filter.frequency.exponentialRampToValueAtTime(65, t0 + 0.58);

    osc.connect(filter);
    sub.connect(filter);
    filter.connect(masterGain);

    osc.start(t0);
    sub.start(t0);
    osc.stop(stopAt);
    sub.stop(stopAt);

    // Final key-off click
    const click = ctx.createOscillator();
    click.type = 'triangle';
    click.frequency.setValueAtTime(140, t0 + 0.54);
    click.frequency.exponentialRampToValueAtTime(45, t0 + 0.6);
    const clickGain = ctx.createGain();
    clickGain.gain.setValueAtTime(0.18, t0 + 0.54);
    clickGain.gain.exponentialRampToValueAtTime(0.001, t0 + 0.61);
    click.connect(clickGain);
    clickGain.connect(masterGain);
    click.start(t0 + 0.54);
    click.stop(t0 + 0.62);

    activeCleanupTimer = setTimeout(() => {
      if (activeMasterGain === masterGain) {
        activeMasterGain = null;
      }
      activeCleanupTimer = null;
    }, 800);
  } catch {
    // Ignore audio errors
  }
}

export function isMasterEngineRunning(): boolean {
  return masterEngineRunning;
}

export function getLastIgnitionAt(): number {
  return lastIgnitionAt;
}

export function setMasterEngineRunning(
  nextRunning: boolean,
  options?: { skipAudio?: boolean }
): boolean {
  masterEngineRunning = nextRunning;
  const now = Date.now();
  if (nextRunning) {
    lastIgnitionAt = now;
  }

  if (typeof window !== 'undefined') {
    if (!options?.skipAudio) {
      if (nextRunning) {
        playCarEngineStartSound();
      } else {
        playCarEngineStopSound();
      }
    }

    if (nextRunning) {
      try {
        localStorage.setItem('mullah_bot_running', 'true');
      } catch {
        // ignore
      }

      // Enable signal -> paper trade auto-execution for Forex Journal
      setAutoOpenOnSignalEnabled(true);

      // Start backend EA controller
      fetch('/api/ea/control', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'START' }),
      }).catch(() => {});

      // Force-refresh live TradingView quotes and evaluate open paper positions immediately
      forceRefreshTradingViewQuotes()
        .then((quotes) => {
          if (quotes && Object.keys(quotes).length > 0) {
            evaluateOpenPaperPositionsAgainstQuotes(quotes);
          }
        })
        .catch(() => {});

      // Engage all mounted bots & auto-pilots across views
      window.dispatchEvent(
        new CustomEvent('njia-bot-control', {
          detail: { target: 'ALL', action: 'START' },
        })
      );
    } else {
      try {
        localStorage.removeItem('mullah_bot_running');
      } catch {
        // ignore
      }

      fetch('/api/ea/control', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'STOP' }),
      }).catch(() => {});

      window.dispatchEvent(
        new CustomEvent('njia-bot-control', {
          detail: { target: 'ALL', action: 'STOP' },
        })
      );
    }

    window.dispatchEvent(
      new CustomEvent<MasterEngineDetail>(MASTER_ENGINE_EVENT, {
        detail: { running: nextRunning, at: now },
      })
    );
  }

  return masterEngineRunning;
}

export function subscribeMasterEngine(callback: (running: boolean) => void): () => void {
  if (typeof window === 'undefined') return () => {};
  const handler = (event: Event) => {
    const detail = (event as CustomEvent<MasterEngineDetail>).detail;
    if (detail && typeof detail.running === 'boolean') {
      callback(detail.running);
    }
  };
  window.addEventListener(MASTER_ENGINE_EVENT, handler);
  return () => window.removeEventListener(MASTER_ENGINE_EVENT, handler);
}
