// Generates valid PNG icons using pure Node.js
const fs = require('fs');
const zlib = require('zlib');

function createIcon(size) {
  const w = size, h = size;
  const radius = Math.round(size * 0.22); // rounded corners

  // RGBA pixel buffer
  const pixels = Buffer.alloc(w * h * 4, 0);

  function setPixel(x, y, r, g, b, a) {
    if (x < 0 || x >= w || y < 0 || y >= h) return;
    const i = (y * w + x) * 4;
    pixels[i] = r; pixels[i+1] = g; pixels[i+2] = b; pixels[i+3] = a;
  }

  function inRoundedRect(x, y) {
    if (x < 0 || x >= w || y < 0 || y >= h) return false;
    const cx = w / 2, cy = h / 2;
    const hw = w / 2 - radius, hh = h / 2 - radius;
    const dx = Math.max(0, Math.abs(x - cx) - hw);
    const dy = Math.max(0, Math.abs(y - cy) - hh);
    return dx * dx + dy * dy <= radius * radius;
  }

  // Draw background
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (inRoundedRect(x, y)) {
        setPixel(x, y, 8, 12, 18, 255); // #080C12
      }
    }
  }

  // Draw lightning bolt using filled polygon
  // Bolt points scaled to size
  const s = size / 512;
  const boltPoints = [
    [300*s, 80*s],
    [180*s, 280*s],
    [256*s, 280*s],
    [212*s, 432*s],
    [380*s, 200*s],
    [296*s, 200*s],
    [340*s, 80*s],
  ];

  // Scanline fill for the bolt polygon
  for (let y = 0; y < h; y++) {
    const intersections = [];
    const n = boltPoints.length;
    for (let i = 0; i < n; i++) {
      const [x1, y1] = boltPoints[i];
      const [x2, y2] = boltPoints[(i + 1) % n];
      if ((y1 <= y && y < y2) || (y2 <= y && y < y1)) {
        const xi = x1 + (y - y1) * (x2 - x1) / (y2 - y1);
        intersections.push(xi);
      }
    }
    intersections.sort((a, b) => a - b);
    for (let k = 0; k < intersections.length - 1; k += 2) {
      const xStart = Math.round(intersections[k]);
      const xEnd = Math.round(intersections[k + 1]);
      for (let x = xStart; x <= xEnd; x++) {
        if (!inRoundedRect(x, y)) continue;
        // Gradient: blue (#4F8EFF) at top → purple (#A855F7) at bottom
        const t = (y - 80*s) / (432*s - 80*s);
        const tc = Math.max(0, Math.min(1, t));
        const r = Math.round(79  + (168 - 79)  * tc);
        const g = Math.round(142 + (85  - 142) * tc);
        const b = Math.round(255 + (247 - 255) * tc);
        setPixel(x, y, r, g, b, 255);
      }
    }
  }

  // Build PNG
  function crc32(buf) {
    const table = new Uint32Array(256);
    for (let i = 0; i < 256; i++) {
      let c = i;
      for (let j = 0; j < 8; j++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
      table[i] = c;
    }
    let crc = 0xFFFFFFFF;
    for (let i = 0; i < buf.length; i++) crc = table[(crc ^ buf[i]) & 0xFF] ^ (crc >>> 8);
    return (crc ^ 0xFFFFFFFF) >>> 0;
  }

  function pngChunk(type, data) {
    const lenBuf = Buffer.alloc(4); lenBuf.writeUInt32BE(data.length);
    const typeBuf = Buffer.from(type, 'ascii');
    const crcInput = Buffer.concat([typeBuf, data]);
    const crcBuf = Buffer.alloc(4); crcBuf.writeUInt32BE(crc32(crcInput));
    return Buffer.concat([lenBuf, typeBuf, data, crcBuf]);
  }

  // Raw image data: filter byte (0) + RGBA row
  const rawRows = [];
  for (let y = 0; y < h; y++) {
    rawRows.push(0); // filter none
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      rawRows.push(pixels[i], pixels[i+1], pixels[i+2], pixels[i+3]);
    }
  }
  const rawBuf = Buffer.from(rawRows);
  const compressed = zlib.deflateSync(rawBuf, { level: 6 });

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8;  // bit depth
  ihdr[9] = 6;  // color type RGBA
  ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;

  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), // PNG signature
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', compressed),
    pngChunk('IEND', Buffer.alloc(0))
  ]);
}

fs.writeFileSync('icons/icon-192.png', createIcon(192));
fs.writeFileSync('icons/icon-512.png', createIcon(512));
console.log('Done: icon-192.png (' + fs.statSync('icons/icon-192.png').size + ' bytes)');
console.log('Done: icon-512.png (' + fs.statSync('icons/icon-512.png').size + ' bytes)');
