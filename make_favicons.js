const fs = require('fs');
const zlib = require('zlib');

// Generate a solid 32x32 PNG favicon with RGBA pixels
function createPng32() {
  const width = 32;
  const height = 32;
  const buffer = Buffer.alloc(width * height * 4);

  // Background squircle color: #5865F2 (R: 88, G: 101, B: 242)
  // Glyph: White handset + waves
  // Let's sample or draw squircle + glyph
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      
      // Squircle distance from center (15.5, 15.5)
      const dx = Math.abs(x - 15.5) / 14;
      const dy = Math.abs(y - 15.5) / 14;
      const r = Math.pow(dx, 4) + Math.pow(dy, 4);

      if (r <= 1.0) {
        // Inside squircle
        let rVal = 88 + Math.floor((1 - y / 32) * 20);
        let gVal = 101;
        let bVal = 242;
        let aVal = 255;
        if (r > 0.85) {
          // Antialiasing border
          aVal = Math.floor((1 - (r - 0.85) / 0.15) * 255);
        }

        // Check if inside white phone handset or wave
        // Handset geometry rough check:
        // Top bulb: around (10, 10), Bottom bulb: around (22, 22), or rotated
        // Phone receiver:
        const px = x;
        const py = y;
        
        // Let's create phone handset silhouette
        const inReceiver = 
          // bottom bulb
          (Math.hypot(px - 10, py - 21) < 3.5) ||
          // top bulb
          (Math.hypot(px - 21, py - 10) < 3.5) ||
          // connecting handle arch
          (Math.hypot(px - 13, py - 13) < 6.5 && Math.hypot(px - 13, py - 13) > 3.0 && px <= 14 && py >= 12 && py <= 22) ||
          (px >= 8 && px <= 13 && py >= 18 && py <= 23) ||
          (px >= 18 && px <= 23 && py >= 8 && py <= 13);

        // Sound waves in upper right
        const distFromEar = Math.hypot(px - 19, py - 11);
        const inWave1 = Math.abs(distFromEar - 6) < 1.0 && px >= 20 && py <= 12;
        const inWave2 = Math.abs(distFromEar - 9) < 1.0 && px >= 21 && py <= 13;

        if (inReceiver || inWave1 || inWave2) {
          rVal = 255;
          gVal = 255;
          bVal = 255;
        }

        buffer[idx] = rVal;
        buffer[idx + 1] = gVal;
        buffer[idx + 2] = bVal;
        buffer[idx + 3] = aVal;
      } else {
        buffer[idx] = 0;
        buffer[idx + 1] = 0;
        buffer[idx + 2] = 0;
        buffer[idx + 3] = 0;
      }
    }
  }

  // PNG structure
  const rawScanlines = Buffer.alloc(height * (width * 4 + 1));
  for (let y = 0; y < height; y++) {
    rawScanlines[y * (width * 4 + 1)] = 0; // filter byte None
    buffer.copy(rawScanlines, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4);
  }

  const compressed = zlib.deflateSync(rawScanlines);

  function crc32(buf) {
    let crc = -1;
    for (let i = 0; i < buf.length; i++) {
      crc = (crc >>> 8) ^ crcTable[(crc ^ buf[i]) & 0xFF];
    }
    return (crc ^ -1) >>> 0;
  }

  const crcTable = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) {
      c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    }
    crcTable[i] = c >>> 0;
  }

  function makeChunk(type, data) {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length, 0);
    const typeBuf = Buffer.from(type, 'ascii');
    const crcBuf = Buffer.alloc(4);
    crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
    return Buffer.concat([len, typeBuf, data, crcBuf]);
  }

  const sig = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData[8] = 8; // bit depth
  ihdrData[9] = 6; // RGBA
  ihdrData[10] = 0; // deflate
  ihdrData[11] = 0; // filter
  ihdrData[12] = 0; // interlace
  const ihdrChunk = makeChunk('IHDR', ihdrData);
  const idatChunk = makeChunk('IDAT', compressed);
  const iendChunk = makeChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([sig, ihdrChunk, idatChunk, iendChunk]);
}

const png = createPng32();
fs.writeFileSync('public/caller-icon-32.png', png);

// Create valid ICO file wrapping the PNG
// ICO header: 6 bytes (Reserved 2 bytes = 0, Type 2 bytes = 1, Count 2 bytes = 1)
// Directory entry: 16 bytes
// Image data: PNG bytes
const icoHeader = Buffer.alloc(6);
icoHeader.writeUInt16LE(0, 0); // reserved
icoHeader.writeUInt16LE(1, 2); // 1 = icon
icoHeader.writeUInt16LE(1, 4); // 1 image

const icoEntry = Buffer.alloc(16);
icoEntry.writeUInt8(32, 0); // width
icoEntry.writeUInt8(32, 1); // height
icoEntry.writeUInt8(0, 2);  // color palette (0 = no palette)
icoEntry.writeUInt8(0, 3);  // reserved
icoEntry.writeUInt16LE(1, 4); // color planes
icoEntry.writeUInt16LE(32, 6); // bits per pixel
icoEntry.writeUInt32LE(png.length, 8); // image size
icoEntry.writeUInt32LE(22, 12); // offset (6 + 16 = 22)

const ico = Buffer.concat([icoHeader, icoEntry, png]);
fs.writeFileSync('public/favicon.ico', ico);
console.log('Successfully generated public/caller-icon-32.png and public/favicon.ico!');
