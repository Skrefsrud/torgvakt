import { build } from "esbuild";
import { cpSync, mkdirSync, rmSync } from "node:fs";

rmSync("dist", { recursive: true, force: true });
mkdirSync("dist", { recursive: true });

await build({
  entryPoints: {
    content: "src/content/index.ts",
    background: "src/background/index.ts",
    popup: "src/popup/index.ts",
  },
  bundle: true,
  outdir: "dist",
  format: "iife",
  target: "chrome110",
});

cpSync("manifest.json", "dist/manifest.json");
cpSync("src/popup/popup.html", "dist/popup.html");
cpSync("src/popup/popup.css", "dist/popup.css");
cpSync("src/content/content.css", "dist/content.css");
cpSync("icons", "dist/icons", { recursive: true });
