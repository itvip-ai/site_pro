import 'dotenv/config';
import { initSchema, db } from '../src/config/db.js';

/*
 * Fills empty Romanian product fields (name_ro / description_ro) by machine-
 * translating the Russian originals. Free, no API key — uses the public Google
 * translate endpoint. Quality is "good enough as a first pass"; staff can refine
 * any card in the admin afterwards.
 *
 *   node scripts/translate.js [--field both|name|desc] [--limit N] [--dry-run]
 *
 * Idempotent & resumable: only fills fields that are still empty, so it can be
 * interrupted (rate limits, network) and re-run to continue.
 *
 *   TRANSLATE_DELAY_MS  pause between requests (default 400)
 */

const args = process.argv.slice(2);
const field = (args.find((a) => a.startsWith('--field=')) || '--field=both').split('=')[1];
const limitArg = args.find((a) => a.startsWith('--limit='));
const LIMIT = limitArg ? parseInt(limitArg.split('=')[1], 10) : Infinity;
const DRY = args.includes('--dry-run');
const DELAY = parseInt(process.env.TRANSLATE_DELAY_MS, 10) || 400;
const SL = 'ru';
const TL = 'ro';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const hasCyrillic = (s) => /[А-Яа-яЁё]/.test(s || '');

// Split long text into <= maxLen chunks on sentence / line boundaries.
function chunkText(text, maxLen = 1400) {
  if (text.length <= maxLen) return [text];
  const parts = [];
  let buf = '';
  for (const piece of text.split(/(?<=[.!?\n])\s+/)) {
    if ((buf + ' ' + piece).length > maxLen) {
      if (buf) parts.push(buf);
      if (piece.length > maxLen) {
        for (let i = 0; i < piece.length; i += maxLen) parts.push(piece.slice(i, i + maxLen));
        buf = '';
      } else buf = piece;
    } else {
      buf = buf ? buf + ' ' + piece : piece;
    }
  }
  if (buf) parts.push(buf);
  return parts;
}

async function translateChunk(q, attempt = 0) {
  const url =
    'https://translate.googleapis.com/translate_a/single?client=gtx&sl=' +
    SL + '&tl=' + TL + '&dt=t&q=' + encodeURIComponent(q);
  try {
    const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const data = await res.json();
    return (data[0] || []).map((s) => s[0]).join('');
  } catch (e) {
    if (attempt < 4) {
      await sleep(1500 * (attempt + 1)); // back off on rate limit / hiccup
      return translateChunk(q, attempt + 1);
    }
    throw e;
  }
}

async function translate(text) {
  const chunks = chunkText(String(text));
  let out = '';
  for (const c of chunks) {
    out += await translateChunk(c);
    await sleep(DELAY);
  }
  return out.trim();
}

async function run() {
  initSchema();

  const doName = field === 'both' || field === 'name';
  const doDesc = field === 'both' || field === 'desc';

  const rows = db
    .prepare(
      `SELECT id, code, name, name_ro, description, description_ro
       FROM products
       WHERE (@doName AND name IS NOT NULL AND name <> '' AND (name_ro IS NULL OR name_ro = ''))
          OR (@doDesc AND description IS NOT NULL AND description <> '' AND (description_ro IS NULL OR description_ro = ''))`
    )
    .all({ doName: doName ? 1 : 0, doDesc: doDesc ? 1 : 0 });

  console.log(`К переводу: ${rows.length} товаров (поля: ${field}). Задержка ${DELAY} мс.`);
  if (DRY) console.log('— пробный прогон, в БД ничего не пишется —');

  const setName = db.prepare("UPDATE products SET name_ro=@v, updated_at=datetime('now') WHERE id=@id");
  const setDesc = db.prepare("UPDATE products SET description_ro=@v, updated_at=datetime('now') WHERE id=@id");

  let nNames = 0, nDescs = 0, nSkip = 0, processed = 0;

  for (const p of rows) {
    if (processed >= LIMIT) break;
    processed++;
    try {
      // Names that are pure codes/latin (no Cyrillic) are left empty — the site
      // falls back to the original, so we don't waste requests on "28001".
      if (doName && hasCyrillic(p.name) && !p.name_ro) {
        const ro = await translate(p.name);
        if (ro && !DRY) setName.run({ v: ro, id: p.id });
        nNames++;
      } else if (doName && !hasCyrillic(p.name)) {
        nSkip++;
      }

      if (doDesc && hasCyrillic(p.description) && !p.description_ro) {
        const ro = await translate(p.description);
        if (ro && !DRY) setDesc.run({ v: ro, id: p.id });
        nDescs++;
      }
    } catch (e) {
      console.log(`  ! ${p.code}: ${e.message}`);
    }

    if (processed % 25 === 0) {
      console.log(`  …${processed}/${Math.min(rows.length, LIMIT)} (имён: ${nNames}, описаний: ${nDescs})`);
    }
  }

  console.log('\n' + '='.repeat(46));
  console.log(DRY ? '🔎 Пробный прогон завершён' : '✅ Перевод завершён');
  console.log(`   Обработано товаров: ${processed}`);
  console.log(`   Переведено названий: ${nNames}`);
  console.log(`   Переведено описаний: ${nDescs}`);
  console.log(`   Пропущено названий (артикулы): ${nSkip}`);
  console.log('\nНе всё перевелось? Запустите команду ещё раз — продолжит с места остановки.');
  db.close();
}

run().catch((e) => {
  console.error('❌ Прервано:', e);
  process.exit(1);
});
