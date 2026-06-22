import sharp from 'sharp';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.join(__dirname, '..', '..');

export const IMAGES_DIR = path.join(projectRoot, 'public', 'images', 'products');
fs.mkdirSync(IMAGES_DIR, { recursive: true });

const MAX_WIDTH = parseInt(process.env.IMAGE_MAX_WIDTH, 10) || 1000;
const THUMB_WIDTH = parseInt(process.env.IMAGE_PREVIEW_WIDTH, 10) || 400;
const QUALITY = parseInt(process.env.IMAGE_QUALITY, 10) || 80;

/**
 * Convert an image (buffer or path) into a full-size WebP + a thumbnail WebP.
 * Files are written as <baseName>.webp and <baseName>_thumb.webp.
 * Returns web paths { image_path, thumb_path } relative to /public.
 */
export async function processImage(input, baseName, subdir = 'products') {
  const dir = path.join(projectRoot, 'public', 'images', subdir);
  fs.mkdirSync(dir, { recursive: true });
  const fullName = `${baseName}.webp`;
  const thumbName = `${baseName}_thumb.webp`;
  const fullPath = path.join(dir, fullName);
  const thumbPath = path.join(dir, thumbName);

  // sharp can't read the same file it writes; buffer the source first.
  const source = Buffer.isBuffer(input) ? input : await fs.promises.readFile(input);

  await sharp(source)
    .rotate()
    .resize(MAX_WIDTH, MAX_WIDTH, { fit: 'inside', withoutEnlargement: true })
    .webp({ quality: QUALITY })
    .toFile(fullPath);

  await sharp(source)
    .rotate()
    .resize(THUMB_WIDTH, THUMB_WIDTH, { fit: 'inside', withoutEnlargement: true })
    .webp({ quality: QUALITY })
    .toFile(thumbPath);

  return {
    image_path: `/images/${subdir}/${fullName}`,
    thumb_path: `/images/${subdir}/${thumbName}`,
  };
}

/** Delete previously stored product images (best-effort). */
export function removeImageFiles(...webPaths) {
  for (const p of webPaths) {
    if (!p) continue;
    const abs = path.join(projectRoot, 'public', p.replace(/^\//, ''));
    fs.promises.unlink(abs).catch(() => {});
  }
}
