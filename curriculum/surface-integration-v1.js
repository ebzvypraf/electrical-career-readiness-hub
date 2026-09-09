/*
 * Electrical Career Readiness Hub — Cross-surface integration bridge v1
 *
 * Connects the canonical Learning Engine to Home, Skills, Journal and
 * Portfolio consumers without replacing the existing production shell.
 */
import { STAGES, emptyProgress, nextStage, stageProgress } from './learning-engine-v2.js';

function assessmentSummary(context = {}) {
  const result = context.assessmentResult || {};
  const history = Array.isArray(context.assessmentHistory) ? context.assessmentHistory : [];
  return { attempted: Boolean(history.length || context.assessmentResult), passed: Boolean(result.passed), percentage: result.percentage == null ? null : Number(result.percentage), attempts: history.length, recovered: Boolean(result.recovered), remediation: context.remediation?.status || null };
}

function stageReadiness(progress, context) {
  const assessment = assessmentSummary(context);
  const evidence = context.evidence || {};
  return {
    learn: Boolean(progress.learn),
    apply: Boolean(progress.apply),
    check: Boolean(progress.check || assessment.passed),
    evidence: Boolean(progress.evidence || (evidence.title?.trim() && evidence.description?.trim())),
    assessment,
    evidenceQuality: evidence.evidenceQuality || '',
    evidenceLinked: Boolean(evidence.linkageComplete)
  };
}

export function buildSurfaceState(catalog, progressByWeek = {}, contextByWeek = {}) {
  const ids = Object.keys(catalog || {});
  const weeks = ids.map(weekId => {
    const week = catalog[weekId] || {};
    const progress = { ...emptyProgress(), ...(progressByWeek[weekId] || {}) };
    const context = contextByWeek[weekId] || {};
    const readiness = stageReadiness(progress, context);
    return {
      weekId, weekNumber: week.week ?? Number(weekId), title: week.title || `Week ${weekId}`, phase: week.phase || '', progress,
      completion: stageProgress(progress), skills: week.skills || week.skillTargets || [],
      journalPrompt: week.integration?.journalPrompt || '', homeAction: week.integration?.homeAction || '', portfolioPrompt: week.integration?.portfolioPrompt || '',
      evidenceReady: readiness.evidence, readiness, nextRequiredStage: STAGES.find(stage => !readiness[stage]) || null
    };
  });
  const next = nextStage(progressByWeek, ids);
  const active = next ? weeks.find(w => w.weekId === next.weekId) : null;
  return {
    home: { next, title: active?.title || 'Program complete', action: active?.homeAction || (next ? `Continue ${next.stage}.` : 'Review your portfolio and readiness profile.'), completedStages: weeks.reduce((n, w) => n + w.completion, 0), totalStages: weeks.length * STAGES.length, activeReadiness: active?.readiness || null, activeNextRequiredStage: active?.nextRequiredStage || null },
    skills: { targets: [...new Set(weeks.flatMap(w => w.skills))], activeWeek: active?.weekId || null, activeStage: active?.nextRequiredStage || null },
    journal: { prompt: active?.journalPrompt || '', activeWeek: active?.weekId || null, activeStage: active?.nextRequiredStage || null },
    portfolio: { evidenceReadyWeeks: weeks.filter(w => w.evidenceReady).map(w => w.weekId), prompt: active?.portfolioPrompt || '', activeWeek: active?.weekId || null, activeStage: active?.nextRequiredStage || null },
    weeks
  };
}

export function createSurfaceIntegration({ catalog, getProgress, getContext, onHome, onSkills, onJournal, onPortfolio }) {
  if (!catalog) throw new Error('Catalog is required');
  const snapshot = () => buildSurfaceState(catalog, getProgress?.() || {}, getContext?.() || {});
  return { getSnapshot: snapshot, refresh: () => { const state = snapshot(); onHome?.(state.home); onSkills?.(state.skills); onJournal?.(state.journal); onPortfolio?.(state.portfolio); return state; } };
}
