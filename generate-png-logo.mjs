import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";

// Creates a valid PNG RGBA image of specified dimensions with crisp brand colors
function createBrandPng(width, height) {
  const buffer = Buffer.alloc(width * height * 4);

  // Background gradient and emblem
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      
      // Emblem box: x: 10..70, y: 10..70
      if (x >= 10 && x <= 70 && y >= 10 && y <= 70) {
        // Cross vertical: x: 36..44, y: 22..58
        // Cross horizontal: x: 22..58, y: 36..44
        const isCross = (x >= 36 && x <= 44 && y >= 22 && y <= 58) ||
                        (x >= 22 && x <= 58 && y >= 36 && y <= 44);
        if (isCross) {
          // Vibrant green #22c55e
          buffer[idx] = 0x22;
          buffer[idx + 1] = 0xc5;
          buffer[idx + 2] = 0x5e;
          buffer[idx + 3] = 0xff;
        } else {
          // Dark Navy #0f172a
          buffer[idx] = 0x0f;
          buffer[idx + 1] = 0x17;
          buffer[idx + 2] = 0x2a;
          buffer[idx + 3] = 0xff;
        }
      } else {
        // Transparent
        buffer[idx] = 0;
        buffer[idx + 1] = 0;
        buffer[idx + 2] = 0;
        buffer[idx + 3] = 0;
      }
    }
  }

  // Raw image data with filter byte (0) per scanline
  const scanlines = Buffer.alloc(height * (width * 4 + 1));
  for (let y = 0; y < height; y++) {
    scanlines[y * (width * 4 + 1)] = 0; // Filter None
    buffer.copy(scanlines, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4);
  }

  const compressed = zlib.deflateSync(scanlines);

  // Build PNG chunks
  function crc32(buf) {
    let crc = -1;
    for (let i = 0; i < buf.length; i++) {
      let byte = buf[i];
      for (let j = 0; j < 8; j++) {
        crc = (crc >>> 1) ^ (((crc ^ byte) & 1) ? 0xedb88320 : 0);
        byte >>>= 1;
      }
    }
    return (crc ^ -1) >>> 0;
  }

  function makeChunk(type, data) {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length, 0);
    const typeBuf = Buffer.from(type, "binary");
    const body = Buffer.concat([typeBuf, data]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(body), 0);
    return Buffer.concat([len, body, crc]);
  }

  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR: width (4), height (4), bit depth (1), color type (1 = RGBA: 6), comp (1), filter (1), interlace (1)
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData[8] = 8; // 8 bits
  ihdrData[9] = 6; // RGBA
  ihdrData[10] = 0;
  ihdrData[11] = 0;
  ihdrData[12] = 0;
  const ihdr = makeChunk("IHDR", ihdrData);

  const idat = makeChunk("IDAT", compressed);
  const iend = makeChunk("IEND", Buffer.alloc(0));

  return Buffer.concat([signature, ihdr, idat, iend]);
}

const png = createBrandPng(320, 80);

const targetDirs = [
  "public/assets",
  "src-tauri/resources/assets",
  "dist/assets",
];

for (const dir of targetDirs) {
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "IM_logo.png"), png);
  console.log(`Saved IM_logo.png to ${dir}`);
}
