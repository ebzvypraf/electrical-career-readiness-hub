/*
 * Electrical Career Readiness Hub — canonical 24-week catalog loader v1
 * Merges the maintained base curriculum and extension modules into one
 * runtime catalog without duplicating lesson definitions in the UI.
 */
import { normalizeWeek } from './learning-engine-v2.js';

export const CANONICAL_SOURCES = [
  '/curriculum/learning-content-v1.json',
  '/curriculum/learning-content-weeks-11-15-v1.json',
  '/curriculum/learning-content-weeks-16-20-v1.json',
  '/curriculum/learning-content-weeks-21-24-v1.json'
];

export const CANONICAL_WEEK_IDS = Array.from({ length: 24 }, (_, i) => String(i + 1));

async function fetchJson(url) {
  const response = await fetch(url, { cache: 'no-store' });
  if (!response.ok) throw new Error(`Canonical curriculum load failed: ${response.status} ${url}`);
  return response.json();
}

export async function loadCanonicalCatalog(sources = CANONICAL_SOURCES) {
  const payloads = await Promise.all(sources.map(fetchJson));
  const modules = payloads.flatMap(payload => Array.isArray(payload?.modules) ? payload.modules : []);
  const catalog = {};

  for (const module of modules) {
    const weekId = String(module?.week ?? '');
    if (!CANONICAL_WEEK_IDS.includes(weekId)) continue;
    if (catalog[weekId]) throw new Error(`Duplicate canonical curriculum module: Week ${weekId}`);
    catalog[weekId] = normalizeWeek(module, { week: Number(weekId) });
  }

  const missing = CANONICAL_WEEK_IDS.filter(id => !catalog[id]);
  if (missing.length) throw new Error(`Canonical curriculum incomplete; missing Weeks ${missing.join(', ')}`);
  return Object.fromEntries(CANONICAL_WEEK_IDS.map(id => [id, catalog[id]]));
}

export function catalogCompleteness(catalog) {
  const ids = Object.keys(catalog || {}).sort((a, b) => Number(a) - Number(b));
  return { expectedWeeks: 24, actualWeeks: ids.length, complete: ids.length === 24 && ids.every((id, i) => id === String(i + 1)) };
}
