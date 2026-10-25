'use-strict';

// Minimal fragmented MP4 helpers for passing camera video to the browser (MSE) without transcoding

const SAMPLE_IS_NON_SYNC = 0x00_01_00_00;
const VISUAL_SAMPLE_ENTRY_SIZE = 78;
// lower 24 bits of a full box header
const FULL_BOX_FLAGS = 16_777_215;

const readBoxes = (buffer, start = 0, end = buffer.length) => {
  const boxes = [];
  let offset = start;

  while (offset + 8 <= end) {
    let size = buffer.readUInt32BE(offset);
    const type = buffer.toString('latin1', offset + 4, offset + 8);
    let headerSize = 8;

    if (size === 1) {
      if (offset + 16 > end) {
        break;
      }

      size = Number(buffer.readBigUInt64BE(offset + 8));
      headerSize = 16;
    } else if (size === 0) {
      size = end - offset;
    }

    if (size < headerSize || offset + size > end) {
      break;
    }

    boxes.push({ type, start: offset, dataStart: offset + headerSize, end: offset + size });
    offset += size;
  }

  return boxes;
};

const findBox = (buffer, path, start = 0, end = buffer.length) => {
  let box = { dataStart: start, end };

  for (const type of path) {
    box = readBoxes(buffer, box.dataStart, box.end).find((child) => child.type === type);

    if (!box) {
      return null;
    }
  }

  return box;
};

const hex = (value) => value.toString(16).padStart(2, '0');

const reverseBits32 = (value) => {
  let result = 0;

  for (let index = 0; index < 32; index++) {
    result = (result << 1) | ((value >>> index) & 1);
  }

  return result >>> 0;
};

const avcCodecString = (type, buffer, avcC) => {
  const data = avcC.dataStart;
  return `${type}.${hex(buffer[data + 1])}${hex(buffer[data + 2])}${hex(buffer[data + 3])}`;
};

// ISO/IEC 14496-15 Annex E
const hevcCodecString = (type, buffer, hvcC) => {
  const data = hvcC.dataStart;
  const profileByte = buffer[data + 1];
  const profileSpace = ['', 'A', 'B', 'C'][profileByte >> 6];
  const tier = (profileByte >> 5) & 1 ? 'H' : 'L';
  const profile = profileByte & 31;
  const compatibility = reverseBits32(buffer.readUInt32BE(data + 2))
    .toString(16)
    .toUpperCase();
  const constraints = [...buffer.subarray(data + 6, data + 12)];
  const level = buffer[data + 12];

  while (constraints.length > 0 && constraints[constraints.length - 1] === 0) {
    constraints.pop();
  }

  return [
    type,
    `${profileSpace}${profile}`,
    compatibility,
    `${tier}${level}`,
    ...constraints.map((byte) => byte.toString(16).toUpperCase()),
  ].join('.');
};

/**
 * Returns the RFC 6381 codec string of the first video track, e.g. "avc1.4d401f"
 */
export const getCodecString = (moov) => {
  const stsd = findBox(moov, ['moov', 'trak', 'mdia', 'minf', 'stbl', 'stsd']);

  if (!stsd) {
    return null;
  }

  // full box header (4) + entry_count (4)
  const [entry] = readBoxes(moov, stsd.dataStart + 8, stsd.end);

  if (!entry) {
    return null;
  }

  const children = readBoxes(moov, entry.dataStart + VISUAL_SAMPLE_ENTRY_SIZE, entry.end);

  if (entry.type === 'avc1' || entry.type === 'avc3') {
    const avcC = children.find((child) => child.type === 'avcC');
    return avcC ? avcCodecString(entry.type, moov, avcC) : null;
  }

  if (entry.type === 'hvc1' || entry.type === 'hev1') {
    const hvcC = children.find((child) => child.type === 'hvcC');
    return hvcC ? hevcCodecString(entry.type, moov, hvcC) : null;
  }

  return entry.type;
};

/**
 * Returns the default sample flags from moov > mvex > trex, used when a fragment doesn't carry its own
 */
export const getDefaultSampleFlags = (moov) => {
  const trex = findBox(moov, ['moov', 'mvex', 'trex']);

  // version/flags (4), track_ID (4), default_sample_description_index (4), duration (4), size (4), flags (4)
  return trex && trex.dataStart + 24 <= trex.end ? moov.readUInt32BE(trex.dataStart + 20) : 0;
};

/**
 * Checks if the first sample of a fragment (moof) is a sync sample (keyframe)
 */
export const isKeyframeFragment = (moof, defaultSampleFlags = 0) => {
  const tfhd = findBox(moof, ['moof', 'traf', 'tfhd']);
  const trun = findBox(moof, ['moof', 'traf', 'trun']);

  if (!trun) {
    return false;
  }

  let sampleFlags = defaultSampleFlags;

  if (tfhd) {
    const tfhdFlags = moof.readUInt32BE(tfhd.dataStart) & FULL_BOX_FLAGS;
    let offset = tfhd.dataStart + 8;

    offset += tfhdFlags & 0x1 ? 8 : 0;
    offset += tfhdFlags & 0x2 ? 4 : 0;
    offset += tfhdFlags & 0x8 ? 4 : 0;
    offset += tfhdFlags & 0x10 ? 4 : 0;

    if (tfhdFlags & 0x20) {
      sampleFlags = moof.readUInt32BE(offset);
    }
  }

  const trunFlags = moof.readUInt32BE(trun.dataStart) & FULL_BOX_FLAGS;
  let offset = trun.dataStart + 8;

  offset += trunFlags & 0x1 ? 4 : 0;

  if (trunFlags & 0x4) {
    sampleFlags = moof.readUInt32BE(offset);
  } else if (trunFlags & 0x4_00) {
    offset += trunFlags & 0x1_00 ? 4 : 0;
    offset += trunFlags & 0x2_00 ? 4 : 0;
    sampleFlags = moof.readUInt32BE(offset);
  }

  return (sampleFlags & SAMPLE_IS_NON_SYNC) === 0;
};

/**
 * Splits a byte stream into top level MP4 boxes
 */
export class Mp4BoxReader {
  #pending = Buffer.alloc(0);

  push(chunk) {
    this.#pending = this.#pending.length > 0 ? Buffer.concat([this.#pending, chunk]) : chunk;

    const boxes = [];
    let offset = 0;

    while (this.#pending.length - offset >= 8) {
      let size = this.#pending.readUInt32BE(offset);

      if (size === 1) {
        if (this.#pending.length - offset < 16) {
          break;
        }

        size = Number(this.#pending.readBigUInt64BE(offset + 8));
      }

      if (size < 8) {
        throw new Error(`Invalid MP4 box size: ${size}`);
      }

      if (this.#pending.length - offset < size) {
        break;
      }

      boxes.push({
        type: this.#pending.toString('latin1', offset + 4, offset + 8),
        data: this.#pending.subarray(offset, offset + size),
      });

      offset += size;
    }

    this.#pending = offset < this.#pending.length ? Buffer.from(this.#pending.subarray(offset)) : Buffer.alloc(0);

    return boxes;
  }
}
