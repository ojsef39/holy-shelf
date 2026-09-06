#!/usr/bin/env node
/**
 * Generates src/icons/ from icon.png in the repo root.
 *
 * The generated files are gitignored and rebuilt by the pre* scripts before
 * anything that needs them, so the repo carries one source image instead of
 * five derivatives. sharp rather than sips or ImageMagick, because this has to
 * run on the CI runner as well as a Mac.
 *
 * Sizes: 16/32 for Chrome's toolbar and menus, 48 for about:addons, 96 for the
 * same at 2x, 128 for the AMO listing.
 */
import { mkdir, access } from "node:fs/promises";
import sharp from "sharp";

const SIZES = [16, 32, 48, 96, 128];
const source = new URL("../icon.png", import.meta.url);
const outDir = new URL("../src/icons/", import.meta.url);

try {
  await access(source);
} catch {
  console.error("[holy-shelf] icon.png not found in the repo root");
  process.exit(1);
}

await mkdir(outDir, { recursive: true });

await Promise.all(
  SIZES.map(async (size) => {
    const out = new URL(`icon-${size}.png`, outDir);
    await sharp(source.pathname).resize(size, size, { fit: "contain" }).png().toFile(out.pathname);
  })
);

console.log(`[holy-shelf] wrote ${SIZES.length} icons: ${SIZES.join(", ")}`);
