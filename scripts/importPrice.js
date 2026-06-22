import 'dotenv/config';
import path from 'path';
import ExcelJS from 'exceljs';
import { initSchema, db } from '../src/config/db.js';
import { Product } from '../src/models/product.js';
import { processImage } from '../src/utils/images.js';
import { parsePrice, safeSlug } from '../src/utils/helpers.js';

/*
 * One-off importer for the supplier price list (ТЗ §7).
 *
 *   node scripts/importPrice.js <file.xlsx> [--no-images] [--dry-run]
 *
 * - Each worksheet is treated as a category (sheet name = category).
 * - Header row is detected by keywords, so column order may vary per sheet.
 * - Embedded (anchored) images are pulled via ExcelJS, matched to their row,
 *   converted to WebP (+ thumbnail) with sharp, and linked to the product.
 * - Idempotent on `code`: re-running updates rows instead of duplicating.
 *
 * Large files: run with more heap, e.g.
 *   node --max-old-space-size=4096 scripts/importPrice.js data/price.xlsx
 */

const HEADERS = {
  code: [/^код$/i, /артикул/i, /^code$/i, /^sku$/i],
  name: [/наименован/i, /^название/i, /^name$/i, /товар/i, /модель/i, /^model$/i],
  image: [/изображен/i, /фото/i, /^image$/i, /^photo$/i, /картинк/i],
  description: [/описан/i, /характеристик/i, /^description$/i],
  // retail = "цена за шт", "розничная", "розница" — цена/price that is NOT partner
  retail: [/цена\s*за\s*шт/i, /розн/i, /^цена/i, /retail/i, /price/i],
  partner: [/партн/i, /дилер/i, /partner/i, /dealer/i],
};

function cellText(cell) {
  if (!cell) return '';
  const v = cell.value;
  if (v == null) return '';
  if (typeof v === 'object') {
    if (v.richText) return v.richText.map((r) => r.text).join('');
    if (v.text) return String(v.text);
    if ('result' in v) return v.result == null ? '' : String(v.result);
    if (v.hyperlink) return String(v.text || '');
  }
  return String(v).trim();
}

function cellNumber(cell) {
  if (!cell) return null;
  const v = cell.value;
  if (typeof v === 'number') return v;
  if (v && typeof v === 'object' && 'result' in v && typeof v.result === 'number') return v.result;
  return parsePrice(cellText(cell));
}

function matchHeader(text, patterns) {
  return patterns.some((re) => re.test(text));
}

/**
 * Scan the first rows of a sheet to locate the header row and map logical
 * fields to column numbers. Returns { headerRow, cols } or null.
 */
function detectColumns(ws) {
  const maxScan = Math.min(ws.rowCount || 20, 20);
  let best = null;

  for (let r = 1; r <= maxScan; r++) {
    const row = ws.getRow(r);
    const cols = {};
    let partnerCol = null;
    let retailCols = [];

    row.eachCell({ includeEmpty: false }, (cell, colNumber) => {
      const text = cellText(cell).trim();
      if (!text) return;
      if (!cols.code && matchHeader(text, HEADERS.code)) cols.code = colNumber;
      else if (!cols.name && matchHeader(text, HEADERS.name)) cols.name = colNumber;
      else if (!cols.image && matchHeader(text, HEADERS.image)) cols.image = colNumber;
      else if (!cols.description && matchHeader(text, HEADERS.description)) cols.description = colNumber;

      if (matchHeader(text, HEADERS.partner)) partnerCol = colNumber;
      else if (matchHeader(text, HEADERS.retail)) retailCols.push(colNumber);
    });

    if (partnerCol) cols.partner = partnerCol;
    // pick the first retail column that isn't the partner column
    cols.retail = retailCols.find((c) => c !== partnerCol) ?? retailCols[0] ?? null;

    const score = (cols.name ? 2 : 0) + (cols.retail ? 1 : 0) + (cols.partner ? 1 : 0) + (cols.code ? 1 : 0);
    if (cols.name && score > (best?.score ?? 0)) {
      best = { headerRow: r, cols, score };
    }
  }
  return best;
}

/** Build a map: spreadsheet row number -> { buffer, extension } for anchored images. */
function collectImages(wb, ws) {
  const map = new Map();
  let images = [];
  try {
    images = ws.getImages() || [];
  } catch {
    return map;
  }
  for (const img of images) {
    const media = wb.getImage(Number(img.imageId));
    if (!media || !media.buffer) continue;
    // tl.nativeRow is 0-based; +1 → spreadsheet row number.
    const rowNumber = Math.round(img.range?.tl?.nativeRow ?? 0) + 1;
    if (!map.has(rowNumber)) {
      map.set(rowNumber, { buffer: media.buffer, extension: media.extension || 'png' });
    }
  }
  return map;
}

async function run() {
  const args = process.argv.slice(2);
  const file = args.find((a) => !a.startsWith('--'));
  const noImages = args.includes('--no-images');
  const dryRun = args.includes('--dry-run');

  if (!file) {
    console.log('Использование: node scripts/importPrice.js <файл.xlsx> [--no-images] [--dry-run]');
    process.exit(1);
  }

  initSchema();

  const filePath = path.resolve(file);
  console.log(`📂 Чтение файла: ${filePath}`);
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(filePath);

  let inserted = 0;
  let updated = 0;
  let withImages = 0;
  let skipped = 0;
  const problems = [];

  for (const ws of wb.worksheets) {
    const category = (ws.name || '').trim();
    const detected = detectColumns(ws);
    if (!detected) {
      console.log(`— Лист «${category}»: заголовки не распознаны, пропуск.`);
      continue;
    }
    const { headerRow, cols } = detected;
    const images = noImages ? new Map() : collectImages(wb, ws);
    console.log(
      `📋 Лист «${category}»: заголовок в строке ${headerRow}, колонки ` +
        `${JSON.stringify(cols)}, картинок: ${images.size}`
    );

    const lastRow = ws.rowCount || 0;
    let sheetCount = 0;

    for (let r = headerRow + 1; r <= lastRow; r++) {
      const row = ws.getRow(r);
      const code = cols.code ? cellText(row.getCell(cols.code)).trim() : '';
      // Some sheets mislabel the name/image columns relative to the data, so
      // fall back to the image column (which is empty in real data rows).
      let name = cols.name ? cellText(row.getCell(cols.name)).trim() : '';
      if (!name && cols.image) name = cellText(row.getCell(cols.image)).trim();
      const priceRetail = cols.retail ? cellNumber(row.getCell(cols.retail)) : null;
      const pricePartner = cols.partner ? cellNumber(row.getCell(cols.partner)) : null;
      const description = cols.description ? cellText(row.getCell(cols.description)).trim() : '';

      if (!name) continue;

      // Merged category/section header rows repeat the same text across columns
      // (exceljs copies a merged value into every covered cell) — skip them.
      const codeText = cols.code ? cellText(row.getCell(cols.code)).trim() : '';
      if (description && name === description && (!codeText || codeText === name)) {
        skipped++;
        continue;
      }

      // Keep rows that have at least a code or a price; price may be null
      // ("по запросу" / "цена зависит от модели") — those are valid catalog items.
      if (!code && priceRetail == null && pricePartner == null) {
        skipped++;
        continue;
      }

      // Without a code we can't keep the import idempotent — synthesize a stable one.
      const finalCode = code || `${safeSlug(category)}-r${r}`;

      const data = {
        code: finalCode,
        name,
        category,
        description: description || null,
        price_retail: priceRetail,
        price_partner: pricePartner,
        image_path: null,
        thumb_path: null,
      };

      // Attach an image anchored to this row, if any.
      const media = images.get(r);
      if (media && !dryRun) {
        try {
          const base = `${safeSlug(finalCode)}-${r}`;
          const paths = await processImage(media.buffer, base);
          data.image_path = paths.image_path;
          data.thumb_path = paths.thumb_path;
          withImages++;
        } catch (e) {
          problems.push(`Картинка (лист «${category}», строка ${r}): ${e.message}`);
        }
      } else if (media && dryRun) {
        withImages++;
      }

      if (!dryRun) {
        const result = Product.upsertByCode(data);
        if (result === 'inserted') inserted++;
        else updated++;
      }
      sheetCount++;
    }
    console.log(`   ✓ обработано строк-товаров: ${sheetCount}`);
  }

  console.log('\n' + '='.repeat(48));
  console.log(dryRun ? '🔎 Пробный прогон (ничего не записано в БД)' : '✅ Импорт завершён');
  console.log(`   Добавлено:        ${inserted}`);
  console.log(`   Обновлено:        ${updated}`);
  console.log(`   С картинками:     ${withImages}`);
  console.log(`   Пропущено строк:  ${skipped}`);
  if (problems.length) {
    console.log(`   Проблемы (${problems.length}):`);
    problems.slice(0, 15).forEach((p) => console.log(`     - ${p}`));
  }
  db.close();
}

run().catch((e) => {
  console.error('❌ Импорт прерван:', e);
  process.exit(1);
});
