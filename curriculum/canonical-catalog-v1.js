/*
 * Electrical Career Readiness Hub — canonical 24-week curriculum catalog v1.
 * Merges the maintained base curriculum and extension modules into one
 * runtime catalog without duplicating lesson definitions in the UI.
 */

export const CANONICAL_SOURCES = [
  '/curriculum/learning-content-v1.json',
  '/curriculum/learning-content-weeks-11-15-v1.json',
  '/curriculum/learning-content-weeks-16-20-v1.json',
  '/curriculum/learning-content-weeks-21-24-v1.json'
];

export const CANONICAL_WEEK_IDS = Array.from({ length: 24 }, (_, i) => String(i + 1));

export const ASSESSMENT_SOURCES = [
  '/curriculum/assessment-question-bank-v1.json',
  '/curriculum/assessment-bank-weeks-21-24-v1.json'
];

async function fetchJson(url) {
  const response = await fetch(url, { cache: 'no-store' });
  if (!response.ok) throw new Error(`Canonical curriculum load failed: ${response.status} ${url}`);
  return response.json();
}

function normalizeWeek(content, fallback = {}) {
  const c = content || {}, integration = c.integration || {};
  return {
    id: c.id || fallback.id,
    week: c.week ?? fallback.week,
    title: c.title || fallback.title || 'Untitled week',
    phase: c.phase || fallback.phase || '',
    estimatedHours: c.estimatedHours ?? fallback.estimatedHours ?? 6,
    objective: c.objective || c.learn?.objective || '',
    learn: c.learn || { heading: 'Core learning', bullets: [], takeaway: '' },
    apply: c.apply || { scenario: '', tasks: [], deliverable: '' },
    check: c.check || { questions: [], passRule: '' },
    evidence: c.evidence || { prompt: '', criteria: [], portfolioCategory: '' },
    skills: c.skills || c.skillTargets || integration.skills || [],
    integration: {
      ...integration,
      homeAction: integration.homeAction || integration.home || '',
      journalPrompt: integration.journalPrompt || integration.journal || '',
      portfolioPrompt: integration.portfolioPrompt || integration.portfolio || ''
    }
  };
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

export async function loadAssessmentCatalog(sources = ASSESSMENT_SOURCES) {
  const payloads = await Promise.all(sources.map(fetchJson));
  const questionsByWeek = {};
  for (const payload of payloads) {
    const groups = Array.isArray(payload?.weeks) ? payload.weeks : [];
    for (const group of groups) {
      const weekId = String(group?.week ?? '');
      if (!CANONICAL_WEEK_IDS.includes(weekId)) continue;
      const questions = Array.isArray(group.questions) ? group.questions : [];
      questionsByWeek[weekId] = [...(questionsByWeek[weekId] || []), ...questions];
    }
  }
  return questionsByWeek;
}

export function catalogCompleteness(catalog) {
  const ids = Object.keys(catalog || {}).sort((a, b) => Number(a) - Number(b));
  return { expectedWeeks: 24, actualWeeks: ids.length, complete: ids.length === 24 && ids.every((id, i) => id === String(i + 1)) };
}

export function assessmentCoverage(assessments) {
  const weeks = Object.keys(assessments || {}).filter(id => CANONICAL_WEEK_IDS.includes(String(id)));
  return {
    assessedWeeks: weeks.length,
    assessedWeekIds: weeks.sort((a, b) => Number(a) - Number(b)),
    totalQuestions: weeks.reduce((n, id) => n + (assessments[id]?.length || 0), 0)
  };
}
