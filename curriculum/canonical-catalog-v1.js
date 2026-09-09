/*
 * Electrical Career Readiness Hub — canonical 24-week curriculum catalog v1.
 * Merges the maintained base curriculum and extension modules into one
 * runtime catalog without duplicating lesson definitions in the UI.
 */

import './remediation-ui-v1.js';
import './remediation-impact-ui-v1.js';
import './evidence-provenance-ui-v1.js';
import './evidence-criteria-ui-v1.js';
import './apply-structured-ui-v1.js';
import './learning-integrity-ui-v1.js';
import './learner-state-integrity-v1.js';
import './learner-flow-integrity-v1.js';
import './stage-journal-bridge-v1.js';
import './assessment-recovery-journal-bridge-v1.js';
import './assessment-history-bridge-v1.js';
import './recovery-provenance-bridge-v1.js';
import './assessment-store-bridge-v1.js';
import './skills-canonical-ui-v1.js';

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
  '/curriculum/assessment-bank-weeks-11-15-v1.json',
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
    if (Array.isArray(curriculumQuestions) && curriculumQuestions.length) questionsByWeek[weekId] = curriculumQuestions;
  }
  const missing = CANONICAL_WEEK_IDS.filter(id => !questionsByWeek[id]?.length);
  if (missing.length) throw new Error(`Canonical assessment catalog incomplete; missing Weeks ${missing.join(', ')}`);
  return questionsByWeek;
}
