'use-strict';

import {
  Mp4BoxReader,
  getCodecString,
  getDefaultSampleFlags,
  isKeyframeFragment,
} from '../../src/controller/camera/utils/fmp4.utils.js';

const NON_SYNC = 0x00_01_00_00;

const uint32 = (value) => {
  const buffer = Buffer.alloc(4);
  buffer.writeUInt32BE(value >>> 0);
  return buffer;
};

const box = (type, ...payload) => {
  const data = Buffer.concat(payload);
  return Buffer.concat([uint32(data.length + 8), Buffer.from(type, 'latin1'), data]);
};

const fullBox = (type, flags, ...payload) => box(type, uint32(flags), ...payload);

const sampleEntry = (type, config) => box(type, Buffer.alloc(78), config);

const moovWith = (entry, trexFlags = 0) =>
  box(
    'moov',
    box('trak', box('mdia', box('minf', box('stbl', fullBox('stsd', 0, uint32(1), entry))))),
    box('mvex', fullBox('trex', 0, uint32(1), uint32(1), uint32(0), uint32(0), uint32(trexFlags)))
  );

const moof = ({ tfhdFlags = 0, tfhdValues = [], trunFlags = 0, trunValues = [] }) =>
  box(
    'moof',
    fullBox('mfhd', 0, uint32(1)),
    box(
      'traf',
      fullBox('tfhd', tfhdFlags, uint32(1), ...tfhdValues.map((value) => uint32(value))),
      fullBox('trun', trunFlags, uint32(1), ...trunValues.map((value) => uint32(value)))
    )
  );

describe('fMP4 utils', () => {
  it('should split a byte stream into top level boxes across chunk boundaries', () => {
    const stream = Buffer.concat([box('ftyp', Buffer.from('isom')), box('moov'), box('mdat', Buffer.alloc(100, 1))]);
    const reader = new Mp4BoxReader();
    const boxes = [];

    for (let offset = 0; offset < stream.length; offset += 7) {
      boxes.push(...reader.push(stream.subarray(offset, offset + 7)));
    }

    expect(boxes.map((entry) => entry.type)).toEqual(['ftyp', 'moov', 'mdat']);
    expect(Buffer.concat(boxes.map((entry) => entry.data)).equals(stream)).toBe(true);
  });

  it('should read the codec string of H.264 and H.265 tracks', () => {
    // profile 0x4d, compatibility 0x40, level 0x1f
    const avcC = box('avcC', Buffer.from([1, 77, 64, 31]));
    expect(getCodecString(moovWith(sampleEntry('avc1', avcC)))).toBe('avc1.4d401f');

    // Main profile, compatibility 0x60000000, level 93, constraint 0xb0
    const hvcC = box('hvcC', Buffer.from([1, 1, 96, 0, 0, 0, 176, 0, 0, 0, 0, 0, 93]));
    expect(getCodecString(moovWith(sampleEntry('hvc1', hvcC)))).toBe('hvc1.1.6.L93.B0');
  });

  it('should detect keyframes from first sample flags', () => {
    expect(isKeyframeFragment(moof({ trunFlags: 0x5, trunValues: [0, 0] }))).toBe(true);
    expect(isKeyframeFragment(moof({ trunFlags: 0x5, trunValues: [0, NON_SYNC] }))).toBe(false);
  });

  it('should detect keyframes from per sample flags', () => {
    const trunFlags = 0x1 | 0x1_00 | 0x2_00 | 0x4_00;
    expect(isKeyframeFragment(moof({ trunFlags, trunValues: [0, 40, 1000, 0] }))).toBe(true);
    expect(isKeyframeFragment(moof({ trunFlags, trunValues: [0, 40, 1000, NON_SYNC] }))).toBe(false);
  });

  it('should fall back to tfhd and trex default sample flags', () => {
    const tfhd = { tfhdFlags: 0x20, tfhdValues: [NON_SYNC] };
    expect(isKeyframeFragment(moof(tfhd))).toBe(false);

    const defaults = getDefaultSampleFlags(moovWith(sampleEntry('avc1', box('avcC')), NON_SYNC));
    expect(defaults).toBe(NON_SYNC);
    expect(isKeyframeFragment(moof({}), defaults)).toBe(false);
    expect(isKeyframeFragment(moof({}), 0)).toBe(true);
  });
});
