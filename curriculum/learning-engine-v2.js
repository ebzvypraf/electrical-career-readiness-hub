/*
 * Electrical Career Readiness Hub — Learning Engine v2 adapter
 * Canonical runtime helper for the Learn → Apply → Check → Evidence loop.
 * Intentionally framework-free so the existing index.html can adopt it without
 * replacing the current production shell.
 */

export const STAGES = ['learn', 'apply', 'check', 'evidence'];

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
    for (const stage of STAGES) {
      if (!p[stage]) return { weekId: id, stage };
    }
  }
  return null;
}

export function canCompleteStage(stage, context = {}) {
  if (stage === 'learn') return true;
  if (stage === 'apply') return Boolean(context.applicationNotes?.trim());
  if (stage === 'check') return Number.isFinite(context.score) && context.total > 0 && context.score >= Math.ceil(context.total * 0.67);
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

export async function loadWeek(url, fallback = {}) {
  const response = await fetch(url, { cache: 'no-store' });
  if (!response.ok) throw new Error(`Curriculum load failed: ${response.status} ${url}`);
  return normalizeWeek(await response.json(), fallback);
}
