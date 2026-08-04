#!/usr/bin/env node
// GTM tooling — NOT part of the deployed app. Builds a prospecting list of
// local businesses (salons, pet shops, aesthetics clinics, etc.) in a given
// city/neighborhood via the official Google Places API (Text Search), for
// manual/in-person outreach — never for automated WhatsApp/Instagram
// messaging, which would violate Meta's ToS and risk exactly the kind of
// number ban this project's moderation/rate-limit work exists to prevent.
//
// Usage:
//   node scripts/find-leads.mjs --city "Pinheiros, São Paulo, SP" \
//     --categories "salão de beleza,barbearia,pet shop banho e tosa" \
//     --out leads-pinheiros.csv
//
// Requires PLACES_API_KEY in .env.local (Places API, restricted to that
// service only — see gcloud services api-keys create).

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');

function loadEnvLocal() {
  const envPath = path.join(REPO_ROOT, '.env.local');
  let content;
  try {
    content = readFileSync(envPath, 'utf8');
  } catch {
    return;
  }
  for (const line of content.split('\n')) {
    const match = line.match(/^([A-Z_][A-Z0-9_]*)\s*=\s*(.*)$/);
    if (!match) continue;
    const [, key, rawValue] = match;
    const value = rawValue.trim().replace(/^"(.*)"$/, '$1');
    if (!(key in process.env)) process.env[key] = value;
  }
}

function parseArgs(argv) {
  const args = { categories: 'salão de beleza,barbearia,pet shop banho e tosa', out: 'leads.csv' };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--city') args.city = argv[++i];
    else if (arg === '--categories') args.categories = argv[++i];
    else if (arg === '--out') args.out = argv[++i];
    else if (arg === '--max-pages') args.maxPages = Number(argv[++i]);
  }
  return args;
}

const FIELD_MASK = [
  'places.id',
  'places.displayName',
  'places.formattedAddress',
  'places.internationalPhoneNumber',
  'places.nationalPhoneNumber',
  'places.rating',
  'places.userRatingCount',
  'places.googleMapsUri',
  'places.websiteUri',
].join(',');

async function searchCategory(apiKey, category, city, maxPages) {
  const results = [];
  let pageToken;
  let page = 0;
  do {
    const body = pageToken
      ? { textQuery: `${category} em ${city}`, languageCode: 'pt-BR', regionCode: 'BR', pageToken }
      : { textQuery: `${category} em ${city}`, languageCode: 'pt-BR', regionCode: 'BR', pageSize: 20 };

    const res = await fetch('https://places.googleapis.com/v1/places:searchText', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask': FIELD_MASK,
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Places API error (${res.status}) for "${category}": ${errText}`);
    }

    const data = await res.json();
    for (const place of data.places ?? []) {
      results.push({
        category,
        name: place.displayName?.text ?? '',
        phone: place.nationalPhoneNumber ?? place.internationalPhoneNumber ?? '',
        address: place.formattedAddress ?? '',
        rating: place.rating ?? '',
        reviews: place.userRatingCount ?? '',
        website: place.websiteUri ?? '',
        mapsUrl: place.googleMapsUri ?? '',
      });
    }
    pageToken = data.nextPageToken;
    page += 1;
    // Google requires a short delay before a pageToken becomes valid.
    if (pageToken && page < maxPages) await new Promise((r) => setTimeout(r, 2000));
  } while (pageToken && page < maxPages);

  return results;
}

function toCsv(rows) {
  const headers = ['category', 'name', 'phone', 'address', 'rating', 'reviews', 'website', 'mapsUrl'];
  const escape = (v) => `"${String(v).replace(/"/g, '""')}"`;
  const lines = [headers.join(',')];
  for (const row of rows) {
    lines.push(headers.map((h) => escape(row[h] ?? '')).join(','));
  }
  return lines.join('\n');
}

async function main() {
  loadEnvLocal();
  const apiKey = process.env.PLACES_API_KEY;
  if (!apiKey) {
    console.error('PLACES_API_KEY not set in .env.local. See scripts/find-leads.mjs header for setup.');
    process.exit(1);
  }

  const args = parseArgs(process.argv.slice(2));
  if (!args.city) {
    console.error('Usage: node scripts/find-leads.mjs --city "Bairro, Cidade, UF" [--categories "a,b,c"] [--out file.csv] [--max-pages 1]');
    process.exit(1);
  }

  const categories = args.categories.split(',').map((c) => c.trim()).filter(Boolean);
  const maxPages = args.maxPages ?? 1; // 1 page = up to 20 results/category, no extra cost beyond the base search

  console.log(`Buscando em "${args.city}" — categorias: ${categories.join(' | ')}`);

  const all = [];
  const seen = new Set();
  for (const category of categories) {
    console.log(`  -> ${category}...`);
    const found = await searchCategory(apiKey, category, args.city, maxPages);
    for (const row of found) {
      const key = `${row.name}|${row.address}`;
      if (seen.has(key)) continue;
      seen.add(key);
      all.push(row);
    }
  }

  const outPath = path.isAbsolute(args.out) ? args.out : path.join(process.cwd(), args.out);
  writeFileSync(outPath, toCsv(all), 'utf8');
  console.log(`\n${all.length} negócios únicos encontrados. Salvo em: ${outPath}`);
  console.log('Dica: ordene pela coluna "reviews" baixo + "rating" mediano pra achar quem mais precisa de ajuda com atendimento.');
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
