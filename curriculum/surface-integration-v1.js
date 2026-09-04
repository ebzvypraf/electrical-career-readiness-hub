/*
 * Electrical Career Readiness Hub — Cross-surface integration bridge v1
 *
 * Connects the canonical Learning Engine to Home, Skills, Journal and
 * Portfolio consumers without replacing the existing production shell.
 */
import { STAGES, emptyProgress, nextStage, stageProgress } from './learning-engine-v2.js';

export function buildSurfaceState(catalog, progressByWeek = {}, contextByWeek = {}) {
  const ids = Object.keys(catalog || {});
  const weeks = ids.map(weekId => {
    const week = catalog[weekId] || {};
    const progress = { ...emptyProgress(), ...(progressByWeek[weekId] || {}) };
    const context = contextByWeek[weekId] || {};
    const evidence = context.evidence || {};
    return {
      weekId,
      weekNumber: week.week ?? Number(weekId),
      title: week.title || `Week ${weekId}`,
      phase: week.phase || '',
      progress,
      completion: stageProgress(progress),
      skills: week.skills || week.skillTargets || [],
      journalPrompt: week.integration?.journalPrompt || '',
      homeAction: week.integration?.homeAction || '',
      portfolioPrompt: week.integration?.portfolioPrompt || '',
      evidenceReady: Boolean(evidence.title?.trim() && evidence.description?.trim())
    };
  });

  const next = nextStage(progressByWeek, ids);
  const active = next ? weeks.find(w => w.weekId === next.weekId) : null;

  return {
    home: {
      next,
      title: active?.title || 'Program complete',
      action: active?.homeAction || (next ? `Continue ${next.stage}.` : 'Review your portfolio and readiness profile.'),
      completedStages: weeks.reduce((n, w) => n + w.completion, 0),
      totalStages: weeks.length * STAGES.length
    },
    skills: {
      targets: [...new Set(weeks.flatMap(w => w.skills))],
      activeWeek: active?.weekId || null
    },
    journal: {
      prompt: active?.journalPrompt || '',
      activeWeek: active?.weekId || null
    },
    portfolio: {
      evidenceReadyWeeks: weeks.filter(w => w.evidenceReady).map(w => w.weekId),
      prompt: active?.portfolioPrompt || '',
      activeWeek: active?.weekId || null
    },
    weeks
  };
}

export function createSurfaceIntegration({ catalog, getProgress, getContext, onHome, onSkills, onJournal, onPortfolio }) {
  if (!catalog) throw new Error('Catalog is required');
  const snapshot = () => buildSurfaceState(catalog, getProgress?.() || {}, getContext?.() || {});
  return {
    getSnapshot: snapshot,
    refresh: () => {
      const state = snapshot();
      onHome?.(state.home);
      onSkills?.(state.skills);
      onJournal?.(state.journal);
      onPortfolio?.(state.portfolio);
      return state;
    }
  };
}
