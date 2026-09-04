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
  '/curriculum/assessment-bank-weeks-01-03-v1.json',
  '/curriculum/assessment-question-bank-v1.json',
  '/curriculum/assessment-bank-weeks-16-20-v1.json',
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

export async function loadAssessmentCatalog(sources = ASSESSMENT_SOURCES, catalog = {}) {
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
  for (const weekId of CANONICAL_WEEK_IDS) {
    if (questionsByWeek[weekId]?.length) continue;
    const curriculumQuestions = catalog?.[weekId]?.check?.questions;
    if (Array.isArray(curriculumQuestions) && curriculumQuestions.length) {
      questionsByWeek[weekId] = curriculumQuestions;
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

export function assessmentQuality(assessments, catalog = {}) {
  return CANONICAL_WEEK_IDS.map(weekId => {
    const authored = Array.isArray(assessments?.[weekId]) ? assessments[weekId] : [];
    const questions = authored.length ? authored : (catalog?.[weekId]?.check?.questions || []);
    const candidate = authored.length ? authored : questions;
    const deterministic = candidate.length > 0 && candidate.every(q => Array.isArray(q?.options) && q.options.length >= 2 && Number.isInteger(q?.correctIndex) && q.correctIndex >= 0 && q.correctIndex < q.options.length);
    return {
      week: Number(weekId),
      questionCount: questions.length,
      deterministic,
      mode: deterministic ? 'authored-deterministic' : questions.length ? 'compatibility' : 'missing'
    };
  });
}

export function validateCanonicalQuality(catalog, assessments) {
  const coverage = catalogCompleteness(catalog);
  const assessment = assessmentQuality(assessments, catalog);
  const missingStages = assessment.filter(x => !['learn', 'apply', 'check', 'evidence'].every(stage => catalog?.[String(x.week)]?.[stage])).map(x => x.week);
  const missingChecks = assessment.filter(x => x.mode === 'missing').map(x => x.week);
  const compatibilityChecks = assessment.filter(x => x.mode === 'compatibility').map(x => x.week);
  return {
    ...coverage,
    stageComplete: missingStages.length === 0,
    missingStageWeeks: missingStages,
    assessmentReady: missingChecks.length === 0,
    missingAssessmentWeeks: missingChecks,
    compatibilityWeeks: compatibilityChecks,
    deterministicWeeks: assessment.filter(x => x.deterministic).map(x => x.week)
  };
}
