import sharp from "sharp";

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">
  <rect width="128" height="128" rx="24" fill="#16181d"/>
  <path d="M30 38 L66 38 A10 10 0 0 1 73 41 L98 66 A10 10 0 0 1 98 80 L74 104
           A10 10 0 0 1 60 104 L33 77 A10 10 0 0 1 30 70 Z" fill="#e8b13f"/>
  <circle cx="46" cy="54" r="7" fill="#16181d"/>
</svg>`;

for (const size of [16, 32, 48, 128]) {
  await sharp(Buffer.from(svg)).resize(size, size).png().toFile(`icons/icon${size}.png`);
}
console.log("icons written");
