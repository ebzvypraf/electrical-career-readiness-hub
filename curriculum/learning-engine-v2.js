/*
 * Electrical Career Readiness Hub — Learning Engine v2 adapter
 * Canonical runtime helper for the Learn → Apply → Check → Evidence loop.
 * Framework-free so the existing index.html can adopt it without replacing
 * the current production shell.
 */

export const STAGES = ['learn', 'apply', 'check', 'evidence'];
export const STAGE_LABELS = { learn: 'Learn', apply: 'Apply', check: 'Check', evidence: 'Evidence' };

/* Root-safe URLs: this module lives under /curriculum but the production
 * Course UI will import it from /index.html. Keep content paths absolute to
 * the deployed application root so both contexts resolve the same payloads.
 */
export const CURRICULUM_URLS = {
  1: '/curriculum/learning-content-v1.json',
  2: '/curriculum/week-02-microstation-connect.json',
  3: '/curriculum/week-03-electrical-documentation.json',
  4: '/curriculum/week-04-single-line-diagrams.json',
  5: '/curriculum/week-05-cable-schedules.json'
};

export function emptyProgress() {
  return { learn: false, apply: false, check: false, evidence: false };
}

export function normalizeWeek(content, fallback = {}) {
  const c = content || {};
  return {
    id: c.id || fallback.id,
    week: c.week ?? fallback.week,
    title: c.title || fallback.title || 'Untitled week',
    phase: c.phase || fallback.phase || '',
    objective: c.objective || '',
    learn: c.learn || { heading: 'Core learning', bullets: [], takeaway: '' },
    apply: c.apply || { scenario: '', tasks: [], deliverable: '' },
    check: c.check || { questions: [] },
    evidence: c.evidence || { prompt: '', criteria: [] },
    skills: c.skills || c.skillTargets || [],
    integration: c.integration || {}
  };
}

export function stageProgress(progress) {
  const p = { ...emptyProgress(), ...(progress || {}) };
  return STAGES.reduce((n, stage) => n + (p[stage] ? 1 : 0), 0);
}

export function totalProgress(progressByWeek) {
  return Object.values(progressByWeek || {}).reduce((n, p) => n + stageProgress(p), 0);
}

export function nextStage(progressByWeek, weekIds) {
  for (const id of weekIds || Object.keys(progressByWeek || {})) {
    const p = progressByWeek?.[id] || emptyProgress();
    for (const stage of STAGES) if (!p[stage]) return { weekId: id, stage };
  }
  return null;
}

export function isStageUnlocked(progressByWeek, weekId, stage) {
  const p = progressByWeek?.[weekId] || emptyProgress();
  const index = STAGES.indexOf(stage);
  if (index < 0) return false;
  if (index === 0) return true;
  return STAGES.slice(0, index).every(previous => Boolean(p[previous]));
}

export function canCompleteStage(stage, context = {}) {
  if (stage === 'learn') return true;
  if (stage === 'apply') return Boolean(context.applicationNotes?.trim());
  if (stage === 'check') {
    return Number.isFinite(context.score) && context.total > 0 && context.score >= Math.ceil(context.total * 0.67);
  }
  if (stage === 'evidence') return Boolean(context.evidence?.title?.trim() && context.evidence?.description?.trim());
  return false;
}

export function deriveSignals(week, progress, context = {}) {
  const p = { ...emptyProgress(), ...(progress || {}) };
  const evidenceReady = Boolean(context.evidence?.title?.trim() && context.evidence?.description?.trim());
  return {
    completedStages: STAGES.filter(s => p[s]),
    completion: stageProgress(p),
    evidenceReady,
    skills: week?.skills || [],
    journalPrompt: week?.integration?.journalPrompt || '',
    homeAction: week?.integration?.homeAction || '',
    portfolioPrompt: week?.integration?.portfolioPrompt || ''
  };
}

export function createLearningState(weekIds = Object.keys(CURRICULUM_URLS)) {
  return weekIds.reduce((state, id) => {
    state[id] = emptyProgress();
    return state;
  }, {});
}

export function applyStageCompletion(progressByWeek, weekId, stage, context = {}) {
  if (!STAGES.includes(stage)) throw new Error(`Unknown learning stage: ${stage}`);
  const current = progressByWeek?.[weekId] || emptyProgress();
  if (!isStageUnlocked(progressByWeek, weekId, stage)) {
    return { ok: false, progress: { ...current }, reason: `Stage locked: complete the previous stage first` };
  }
  if (!canCompleteStage(stage, context)) {
    return { ok: false, progress: { ...current }, reason: `Stage gate not satisfied: ${STAGE_LABELS[stage]}` };
  }
  const updated = { ...current, [stage]: true };
  return { ok: true, progress: updated, reason: `${STAGE_LABELS[stage]} completed` };
}

export async function loadWeek(url, fallback = {}) {
  const response = await fetch(url, { cache: 'no-store' });
  if (!response.ok) throw new Error(`Curriculum load failed: ${response.status} ${url}`);
  return normalizeWeek(await response.json(), fallback);
}

export async function loadCatalog(urls = CURRICULUM_URLS) {
  const entries = await Promise.all(Object.entries(urls).map(async ([week, url]) => {
    const content = await loadWeek(url, { week: Number(week) });
    return [String(week), content];
  }));
  return Object.fromEntries(entries);
}

export function buildIntegrationSnapshot(catalog, progressByWeek, contextByWeek = {}) {
  const weeks = Object.entries(catalog || {}).map(([weekId, week]) => {
    const progress = progressByWeek?.[weekId] || emptyProgress();
    const signals = deriveSignals(week, progress, contextByWeek?.[weekId] || {});
    return { weekId, title: week.title, progress, signals };
  });
  const next = nextStage(progressByWeek, Object.keys(catalog || {}));
  return {
    next,
    totalStages: Object.keys(catalog || {}).length * STAGES.length,
    completedStages: weeks.reduce((n, w) => n + w.signals.completion, 0),
    weeks
  };
}
