import { execSync } from "node:child_process";
import { createWriteStream } from "node:fs";
import { readdirSync, statSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { deflateRawSync } from "node:zlib";

execSync("npm run build", { stdio: "inherit" });

// Minimal store-zip writer (no external zip dependency).
function* files(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) yield* files(p);
    else yield p;
  }
}

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = (buf) => {
  let c = 0xffffffff;
  for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};

const entries = [];
const chunks = [];
let offset = 0;
for (const p of files("dist")) {
  const rel = relative("dist", p).replaceAll("\\", "/");
  const data = readFileSync(p);
  const compressed = deflateRawSync(data);
  const name = Buffer.from(rel);
  const local = Buffer.alloc(30);
  local.writeUInt32LE(0x04034b50, 0);
  local.writeUInt16LE(20, 4);
  local.writeUInt16LE(8, 8);
  local.writeUInt32LE(crc32(data), 14);
  local.writeUInt32LE(compressed.length, 18);
  local.writeUInt32LE(data.length, 22);
  local.writeUInt16LE(name.length, 26);
  entries.push({ rel: name, crc: crc32(data), csize: compressed.length, usize: data.length, offset });
  chunks.push(local, name, compressed);
  offset += 30 + name.length + compressed.length;
}
const cdStart = offset;
for (const e of entries) {
  const cd = Buffer.alloc(46);
  cd.writeUInt32LE(0x02014b50, 0);
  cd.writeUInt16LE(20, 4);
  cd.writeUInt16LE(20, 6);
  cd.writeUInt16LE(8, 10);
  cd.writeUInt32LE(e.crc, 16);
  cd.writeUInt32LE(e.csize, 20);
  cd.writeUInt32LE(e.usize, 24);
  cd.writeUInt16LE(e.rel.length, 28);
  cd.writeUInt32LE(e.offset, 42);
  chunks.push(cd, e.rel);
  offset += 46 + e.rel.length;
}
const eocd = Buffer.alloc(22);
eocd.writeUInt32LE(0x06054b50, 0);
eocd.writeUInt16LE(entries.length, 8);
eocd.writeUInt16LE(entries.length, 10);
eocd.writeUInt32LE(offset - cdStart, 12);
eocd.writeUInt32LE(cdStart, 16);
chunks.push(eocd);

const out = createWriteStream("torgvakt.zip");
for (const c of chunks) out.write(c);
out.end(() => console.log(`torgvakt.zip ready (${entries.length} files) for Chrome Web Store upload`));
