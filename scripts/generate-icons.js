import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { deflateSync } from 'zlib';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const assetsDir = join(__dirname, '..', 'src', 'assets');

// Ensure assets directory exists
if (!existsSync(assetsDir)) {
  mkdirSync(assetsDir, { recursive: true });
}

// PNG file generation utilities
function createPNG(width, height, rgbaData) {
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

  // IHDR chunk
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr.writeUInt8(8, 8); // bit depth
  ihdr.writeUInt8(6, 9); // color type (RGBA)
  ihdr.writeUInt8(0, 10); // compression
  ihdr.writeUInt8(0, 11); // filter
  ihdr.writeUInt8(0, 12); // interlace
  const ihdrChunk = createChunk('IHDR', ihdr);

  // IDAT chunk (image data)
  // Add filter byte (0 = none) at the start of each row
  const rawData = Buffer.alloc(height * (1 + width * 4));
  for (let y = 0; y < height; y++) {
    rawData[y * (1 + width * 4)] = 0; // filter byte
    for (let x = 0; x < width; x++) {
      const srcIdx = (y * width + x) * 4;
      const dstIdx = y * (1 + width * 4) + 1 + x * 4;
      rawData[dstIdx] = rgbaData[srcIdx]; // R
      rawData[dstIdx + 1] = rgbaData[srcIdx + 1]; // G
      rawData[dstIdx + 2] = rgbaData[srcIdx + 2]; // B
      rawData[dstIdx + 3] = rgbaData[srcIdx + 3]; // A
    }
  }
  const compressed = deflateSync(rawData, { level: 9 });
  const idatChunk = createChunk('IDAT', compressed);

  // IEND chunk
  const iendChunk = createChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

function createChunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);

  const typeBuffer = Buffer.from(type, 'ascii');
  const crcData = Buffer.concat([typeBuffer, data]);

  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(crcData), 0);

  return Buffer.concat([length, typeBuffer, data, crc]);
}

// CRC32 implementation for PNG
function crc32(buffer) {
  let crc = 0xffffffff;
  const table = getCrc32Table();

  for (let i = 0; i < buffer.length; i++) {
    crc = (crc >>> 8) ^ table[(crc ^ buffer[i]) & 0xff];
  }

  return (crc ^ 0xffffffff) >>> 0;
}

let crc32Table = null;
function getCrc32Table() {
  if (crc32Table) return crc32Table;

  crc32Table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    crc32Table[n] = c;
  }
  return crc32Table;
}

// Create brutalist tech icon: Electric lime (#BFFF00) on dark (#0D0D0D)
// Design: Sharp geometric "A" with border - no rounded corners
function createIconData(size) {
  const data = new Uint8Array(size * size * 4);

  // Colors - Brutalist Tech palette
  const darkR = 0x0d, darkG = 0x0d, darkB = 0x0d;      // #0D0D0D
  const limeR = 0xbf, limeG = 0xff, limeB = 0x00;      // #BFFF00

  function setPixel(x, y, r, g, b, a = 255) {
    if (x >= 0 && x < size && y >= 0 && y < size) {
      const idx = (y * size + x) * 4;
      data[idx] = r;
      data[idx + 1] = g;
      data[idx + 2] = b;
      data[idx + 3] = a;
    }
  }

  // Fill with dark background
  for (let i = 0; i < size * size; i++) {
    data[i * 4] = darkR;
    data[i * 4 + 1] = darkG;
    data[i * 4 + 2] = darkB;
    data[i * 4 + 3] = 255;
  }

  // Calculate dimensions with padding
  const padding = Math.max(1, Math.floor(size * 0.08));
  const borderWidth = Math.max(1, Math.floor(size / 16));

  // Draw sharp rectangular border (no rounded corners)
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      // Check if pixel is on the border
      const onTopBorder = y >= padding && y < padding + borderWidth && x >= padding && x < size - padding;
      const onBottomBorder = y >= size - padding - borderWidth && y < size - padding && x >= padding && x < size - padding;
      const onLeftBorder = x >= padding && x < padding + borderWidth && y >= padding && y < size - padding;
      const onRightBorder = x >= size - padding - borderWidth && x < size - padding && y >= padding && y < size - padding;

      if (onTopBorder || onBottomBorder || onLeftBorder || onRightBorder) {
        setPixel(x, y, limeR, limeG, limeB);
      }
    }
  }

  // Draw sharp geometric "A" in the center
  const innerPadding = padding + borderWidth + Math.max(2, Math.floor(size * 0.12));
  const centerX = Math.floor(size / 2);
  const topY = innerPadding;
  const bottomY = size - innerPadding;
  const height = bottomY - topY;
  const halfWidth = Math.floor(height * 0.4);
  const leftX = centerX - halfWidth;
  const rightX = centerX + halfWidth;
  const strokeWidth = Math.max(1, Math.floor(size / 8));
  const crossbarY = topY + Math.floor(height * 0.6);

  function drawLine(x0, y0, x1, y1, width) {
    const dx = Math.abs(x1 - x0);
    const dy = Math.abs(y1 - y0);
    const steps = Math.max(dx, dy) * 2;

    for (let i = 0; i <= steps; i++) {
      const t = steps === 0 ? 0 : i / steps;
      const x = Math.round(x0 + (x1 - x0) * t);
      const y = Math.round(y0 + (y1 - y0) * t);

      // Draw square pixels (no anti-aliasing for brutalist look)
      for (let wx = -Math.floor(width / 2); wx < Math.ceil(width / 2); wx++) {
        for (let wy = -Math.floor(width / 2); wy < Math.ceil(width / 2); wy++) {
          setPixel(x + wx, y + wy, limeR, limeG, limeB);
        }
      }
    }
  }

  // Draw filled triangular top of A (sharp point)
  for (let row = 0; row < strokeWidth + 1; row++) {
    const y = topY + row;
    const halfSpan = Math.max(0, row * halfWidth / height);
    for (let x = centerX - Math.ceil(halfSpan) - Math.floor(strokeWidth/2); x <= centerX + Math.ceil(halfSpan) + Math.floor(strokeWidth/2); x++) {
      setPixel(x, y, limeR, limeG, limeB);
    }
  }

  // Left leg of A (sharp diagonal)
  drawLine(centerX, topY, leftX, bottomY, strokeWidth);

  // Right leg of A (sharp diagonal)
  drawLine(centerX, topY, rightX, bottomY, strokeWidth);

  // Crossbar (sharp horizontal)
  const crossbarLeftX = leftX + Math.floor((centerX - leftX) * 0.4);
  const crossbarRightX = rightX - Math.floor((rightX - centerX) * 0.4);
  drawLine(crossbarLeftX, crossbarY, crossbarRightX, crossbarY, Math.max(1, Math.floor(strokeWidth * 0.8)));

  return data;
}

// Generate icons at different sizes
const sizes = [16, 48, 128];

for (const size of sizes) {
  const rgbaData = createIconData(size);
  const pngBuffer = createPNG(size, size, rgbaData);
  const filePath = join(assetsDir, `icon-${size}.png`);
  writeFileSync(filePath, pngBuffer);
  console.log(`Created ${filePath}`);
}

console.log('Icons generated successfully!');
