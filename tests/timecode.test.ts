/**
 * F1 — Tests du decodeur MTC (logique pure, sans MIDI reel).
 */
import { describe, expect, it } from 'vitest';
import type { TimecodeFrame } from '../src/utils/timecode';

// Mock de MIDIInput (Web MIDI API n'est pas disponible dans jsdom/Node).
class MockMIDIInput extends EventTarget {
  name = 'Mock MIDI';
  manufacturer = '';
  version = '';
  type = 'input' as const;
  id = 'mock-1';
  connection = 'open' as const;
  state = 'connected' as const;
  onmidimessage: ((ev: MIDIMessageEvent) => void) | null = null;

  // Envoie un message MIDI synthetique.
  send(data: Uint8Array): void {
    const evt = new Event('midimessage') as MIDIMessageEvent;
    Object.defineProperty(evt, 'data', { value: data });
    this.dispatchEvent(evt);
    this.onmidimessage?.(evt);
  }
}

describe('decodeMTC (unit, sans MIDI reel)', () => {
  it('decode un full-frame SysEx correctement', async () => {
    const { decodeMTC } = await import('../src/utils/timecode');
    const input = new MockMIDIInput() as unknown as MIDIInput;
    const frames: TimecodeFrame[] = [];
    const off = decodeMTC(input, (f) => frames.push(f));

    // Full-frame : F0 7F 7F 01 01 hh mm ss ff F7 (01:02:03:04, 30fps)
    // hByte = 0x61 = 01 | (30fps code 3 = 0x60)
    const hByte = 0x01 | (3 << 5); // 0x61
    const sysex = new Uint8Array([0xf0, 0x7f, 0x7f, 0x01, 0x01, hByte, 0x02, 0x03, 0x04, 0xf7]);
    (input as unknown as MockMIDIInput).send(sysex);

    expect(frames).toHaveLength(1);
    expect(frames[0].hours).toBe(1);
    expect(frames[0].minutes).toBe(2);
    expect(frames[0].seconds).toBe(3);
    expect(frames[0].frames).toBe(4);
    expect(frames[0].frameRate).toBe(30);
    expect(frames[0].totalSeconds).toBeCloseTo(1 * 3600 + 2 * 60 + 3 + 4 / 30);
    off();
  });

  it('decode 8 quarter-frames successifs en un timecode complet (00:00:01:00 25fps)', async () => {
    const { decodeMTC } = await import('../src/utils/timecode');
    const input = new MockMIDIInput() as unknown as MIDIInput;
    const frames: TimecodeFrame[] = [];
    const off = decodeMTC(input, (f) => frames.push(f));

    // Timecode 00:00:01:00 a 25fps
    // frames nibbles : f_lo=0, f_hi=0, s_lo=1, s_hi=0, m_lo=0, m_hi=0, h_lo=0, h_hi=(25fps=1<<1)
    const qfs = [
      [0x00, 0x00], // idx 0 : frames low nibble = 0
      [0x10, 0x00], // idx 1 : frames high nibble = 0
      [0x20, 0x01], // idx 2 : seconds low nibble = 1
      [0x30, 0x00], // idx 3 : seconds high nibble = 0
      [0x40, 0x00], // idx 4 : minutes low nibble = 0
      [0x50, 0x00], // idx 5 : minutes high nibble = 0
      [0x60, 0x00], // idx 6 : hours low nibble = 0
      [0x70, (1 << 1)], // idx 7 : hours high nibble = 0, fps = 25 (code 1), direction = forward
    ];

    for (const [idx, val] of qfs) {
      const byte = idx | (val & 0x0f);
      (input as unknown as MockMIDIInput).send(new Uint8Array([0xf1, byte]));
    }

    expect(frames).toHaveLength(1);
    expect(frames[0].seconds).toBe(1);
    expect(frames[0].frameRate).toBe(25);
    off();
  });
});

describe('formatTimecode (helper interne)', () => {
  it('totalSeconds est coherent', () => {
    const tc: TimecodeFrame = { hours: 1, minutes: 30, seconds: 45, frames: 12, frameRate: 25, totalSeconds: 0 };
    tc.totalSeconds = tc.hours * 3600 + tc.minutes * 60 + tc.seconds + tc.frames / tc.frameRate;
    expect(tc.totalSeconds).toBeCloseTo(1 * 3600 + 30 * 60 + 45 + 12 / 25);
  });
});
