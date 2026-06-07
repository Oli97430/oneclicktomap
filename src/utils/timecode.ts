/**
 * F1 - Timecode SMPTE : decodeur MTC (MIDI Time Code) via Web MIDI API
 * et decodeur LTC (Linear Time Code) via Web Audio biphase mark.
 *
 * MTC (MIDI) :
 *   - Quarter-frame messages (0xF1 xx) reconstitues en timecode complet.
 *   - Full-frame SysEx (0xF0 7F ... 01 01 ...) reconnus directement.
 *
 * LTC (audio) :
 *   - Le signal est lu via un AudioWorkletNode (classe LTCDecoderProcessor)
 *     qui doit etre installe dans le contexte audio appelant.
 *   - Le module worklet est expose via la constante LTC_WORKLET_CODE.
 *
 * Les deux decodeurs emettent des TimecodeFrame normalises.
 */

/** Taux d'images standards. */
export type FrameRate = 24 | 25 | 29.97 | 30;

/** Un timecode complet. */
export interface TimecodeFrame {
  hours: number;
  minutes: number;
  seconds: number;
  frames: number;
  frameRate: FrameRate;
  /** Temps equivalent en secondes depuis minuit. */
  totalSeconds: number;
}

export type TimecodeCallback = (tc: TimecodeFrame) => void;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function toTotalSeconds(h: number, m: number, s: number, f: number, fps: FrameRate): number {
  return h * 3600 + m * 60 + s + f / fps;
}

function guessFrameRate(fpsCode: number): FrameRate {
  switch (fpsCode) {
    case 0: return 24;
    case 1: return 25;
    case 2: return 29.97;
    default: return 30;
  }
}

// ---------------------------------------------------------------------------
// MTC decoder
// ---------------------------------------------------------------------------

/**
 * Ecoute les messages MIDI entrants sur l'entree donnee et appelle
 * `callback` a chaque timecode reconstitue (toutes les 8 quarter-frames).
 *
 * Retourne une fonction de nettoyage (ferme l'eventlistener MIDI).
 */
export function decodeMTC(
  input: MIDIInput,
  callback: TimecodeCallback,
): () => void {
  // Les 8 quarter-frames du MTC, indexes 0-7 (reception cyclique).
  const qf = new Uint8Array(8);
  let qfCount = 0;

  const onMessage = (event: Event): void => {
    const msg = event as MIDIMessageEvent;
    const data = msg.data;
    if (!data || data.length === 0) return;

    const status = data[0];

    // Full-frame SysEx : F0 7F 7F 01 01 hh mm ss ff F7
    if (status === 0xf0 && data.length >= 10 && data[1] === 0x7f && data[3] === 0x01 && data[4] === 0x01) {
      const hByte = data[5];
      const fps = guessFrameRate((hByte >> 5) & 0x03);
      const h = hByte & 0x1f;
      const m = data[6] & 0x3f;
      const s = data[7] & 0x3f;
      const f = data[8] & 0x1f;
      callback({ hours: h, minutes: m, seconds: s, frames: f, frameRate: fps, totalSeconds: toTotalSeconds(h, m, s, f, fps) });
      qfCount = 0;
      return;
    }

    // Quarter-frame : F1 0n (n = index 0-7, data = nibble)
    if (status === 0xf1 && data.length >= 2) {
      const byte = data[1];
      const idx = (byte >> 4) & 0x07;
      const nibble = byte & 0x0f;
      qf[idx] = nibble;
      qfCount += 1;

      // Reconstitution apres 8 quarter-frames (un cycle complet).
      if (qfCount >= 8 && idx === 7) {
        const fpsCode = (qf[7] >> 1) & 0x03;
        const fps = guessFrameRate(fpsCode);
        const f = (qf[0]) | ((qf[1] & 0x01) << 4);
        const s = (qf[2]) | ((qf[3] & 0x03) << 4);
        const m = (qf[4]) | ((qf[5] & 0x03) << 4);
        const h = (qf[6]) | ((qf[7] & 0x01) << 4);
        callback({ hours: h, minutes: m, seconds: s, frames: f, frameRate: fps, totalSeconds: toTotalSeconds(h, m, s, f, fps) });
        qfCount = 0;
      }
    }
  };

  input.addEventListener('midimessage', onMessage);
  return () => input.removeEventListener('midimessage', onMessage);
}

/** Liste les entrees MIDI disponibles (retourne [] si Web MIDI non supporte). */
export async function listMIDIInputs(): Promise<MIDIInput[]> {
  if (!navigator.requestMIDIAccess) return [];
  try {
    const access = await navigator.requestMIDIAccess({ sysex: true });
    return Array.from(access.inputs.values());
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// LTC decoder (AudioWorklet)
// ---------------------------------------------------------------------------

/**
 * Code source du worklet LTC (a charger via AudioContext.audioWorklet.addModule).
 * Utilise le decodage biphase-mark : chaque transition = bit, double transition = 0.
 * Emet un message { timecode: TimecodeFrame } quand un frame complet est decode.
 */
export const LTC_WORKLET_CODE = `
class LTCDecoderProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this._bits = [];
    this._lastLevel = 0;
    this._halfClock = 0;
    this._sampleRate = sampleRate;
    // LTC : 80 bits par frame, frame rate estimee a 25 fps par defaut.
    this._samplesPerBit = Math.round(this._sampleRate / (25 * 80));
    this._counter = 0;
  }

  process(inputs) {
    const input = inputs[0]?.[0];
    if (!input) return true;
    for (let i = 0; i < input.length; i++) {
      const level = input[i] > 0 ? 1 : -1;
      if (level !== this._lastLevel) {
        this._halfClock++;
        if (this._halfClock >= 2) {
          // Deux demi-periodes = bit 0 (pas de transition au milieu).
          this._bits.push(0);
          this._halfClock = 0;
        } else {
          // Une seule demi-periode = bit 1.
          this._bits.push(1);
        }
        this._lastLevel = level;
        this._tryDecode();
      }
    }
    return true;
  }

  _tryDecode() {
    // LTC word = 80 bits, sync word = 0011 1111 1111 1101 (bits 64-79).
    if (this._bits.length < 80) return;
    // Cherche le mot de sync.
    const tail = this._bits.slice(-16).join('');
    if (tail !== '0011111111111101') return;
    const frame = this._bits.slice(-80);
    const f  = this._decodeBCD(frame, 0, 4)  + this._decodeBCD(frame, 8, 2)  * 10;
    const s  = this._decodeBCD(frame, 16, 4) + this._decodeBCD(frame, 24, 3) * 10;
    const m  = this._decodeBCD(frame, 32, 4) + this._decodeBCD(frame, 40, 3) * 10;
    const h  = this._decodeBCD(frame, 48, 4) + this._decodeBCD(frame, 56, 2) * 10;
    const fps = 25; // simplifie
    this.port.postMessage({ timecode: { hours: h, minutes: m, seconds: s, frames: f, frameRate: fps, totalSeconds: h*3600+m*60+s+f/fps } });
    this._bits = [];
  }

  _decodeBCD(bits, start, len) {
    let v = 0;
    for (let i = 0; i < len; i++) v |= (bits[start + i] << i);
    return v;
  }
}
registerProcessor('ltc-decoder', LTCDecoderProcessor);
`;

/**
 * Installe le worklet LTC dans un contexte audio existant et renvoie
 * le noeud source (a connecter depuis un MediaStreamSource ou MediaElementSource).
 * Appelle `callback` pour chaque timecode recu.
 */
export async function createLTCDecoder(
  ctx: AudioContext,
  callback: TimecodeCallback,
): Promise<{ node: AudioWorkletNode; disconnect: () => void }> {
  const blob = new Blob([LTC_WORKLET_CODE], { type: 'application/javascript' });
  const url = URL.createObjectURL(blob);
  await ctx.audioWorklet.addModule(url);
  URL.revokeObjectURL(url);

  const node = new AudioWorkletNode(ctx, 'ltc-decoder');
  node.port.onmessage = (ev: MessageEvent) => {
    const tc = (ev.data as { timecode?: TimecodeFrame }).timecode;
    if (tc) callback(tc);
  };
  return {
    node,
    disconnect: () => {
      node.disconnect();
      node.port.close();
    },
  };
}
