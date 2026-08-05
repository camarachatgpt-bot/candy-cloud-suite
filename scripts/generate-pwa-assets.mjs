import { access, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import sharp from "sharp";
import pngToIco from "png-to-ico";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");
const publicDir = path.join(rootDir, "public");
const iconsDir = path.join(publicDir, "icons");

const sourcePng = path.join(iconsDir, "icon-1024.png");
const sourceJpeg = path.join(iconsDir, "icon-1024.jpeg");

async function fileExists(filePath) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function ensureBaseIcon() {
  if (await fileExists(sourcePng)) {
    return sourcePng;
  }

  if (!(await fileExists(sourceJpeg))) {
    throw new Error(`Base icon not found at ${sourcePng} or ${sourceJpeg}`);
  }

  await mkdir(iconsDir, { recursive: true });
  await sharp(sourceJpeg).png().toFile(sourcePng);
  return sourcePng;
}

async function buildSquareIcon(inputPath, outputPath, size, padding) {
  const innerSize = size - padding * 2;
  const resizedInput = await sharp(inputPath)
    .resize({
      width: innerSize,
      height: innerSize,
      fit: "contain",
      withoutEnlargement: true,
    })
    .png()
    .toBuffer();

  await sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: "#000000",
    },
  })
    .composite([
      {
        input: resizedInput,
        top: padding,
        left: padding,
      },
    ])
    .png()
    .toFile(outputPath);
}

async function buildFavicon(inputPath, outputPath) {
  const sizes = [16, 32, 48, 64];
  const icons = await Promise.all(
    sizes.map((size) =>
      sharp(inputPath)
        .resize({
          width: size,
          height: size,
          fit: "contain",
          withoutEnlargement: true,
        })
        .png()
        .toBuffer(),
    ),
  );

  const icoBuffer = await pngToIco(icons);
  await writeFile(outputPath, icoBuffer);
}

async function main() {
  const baseIconPath = await ensureBaseIcon();

  await mkdir(publicDir, { recursive: true });

  await buildSquareIcon(baseIconPath, path.join(publicDir, "icon-192x192.png"), 192, 14);
  await buildSquareIcon(baseIconPath, path.join(publicDir, "icon-512x512.png"), 512, 36);
  await buildSquareIcon(baseIconPath, path.join(publicDir, "maskable-icon-512x512.png"), 512, 72);
  await buildSquareIcon(baseIconPath, path.join(publicDir, "apple-touch-icon.png"), 180, 14);
  await buildFavicon(baseIconPath, path.join(publicDir, "favicon.ico"));
}

await main();