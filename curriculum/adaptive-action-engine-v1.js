/*
 * Electrical Career Readiness Hub — adaptive next-action engine v1.
 * Chooses the highest-value learner action from canonical state signals.
 *
 * v1.1 adds recovery-aware context to skill-gap actions without changing
 * the authoritative stage gates or double-counting recovered capability.
 */
import { STAGES, STAGE_LABELS, isStageUnlocked } from './learning-engine-v2.js';

export const ADAPTIVE_ACTION_ENGINE_VERSION = '1.1.0';

function text(value) { return String(value ?? '').trim(); }

function assessmentTrail(context = {}) {
  const history = Array.isArray(context?.assessmentHistory) ? context.assessmentHistory : [];
  const latest = history.at(-1) || context?.assessmentResult || null;
  const priorFailure = history.slice(0, -1).some(item => item?.passed === false);
  return {
    attempts: history.length,
    recovered: Boolean(history.length > 1 && latest?.passed && priorFailure),
    latestPassed: Boolean(latest?.passed),
    latestPercentage: Number.isFinite(Number(latest?.percentage)) ? Number(latest.percentage) : null
  };
}

export function chooseNextBestAction({ catalog = {}, progressByWeek = {}, contextByWeek = {}, hubSignals = {} } = {}) {
  const ids = Object.keys(catalog || {}).sort((a, b) => Number(a) - Number(b));

  // 1. A failed Check with unfinished remediation always outranks normal progression.
  const remediationCandidates = ids.map(id => {
    const remediation = contextByWeek?.[id]?.remediation;
    if (!remediation || !['required', 'in-progress', 'ready-to-retry'].includes(remediation.status)) return null;
    const week = catalog[id];
    const stage = remediation.status === 'ready-to-retry' ? 'check' : 'learn';
    return {
      priority: remediation.status === 'ready-to-retry' ? 10 : 20,
      weekId: id,
      week: week?.title || `Week ${id}`,
      stage,
      label: stage === 'check' ? 'Retry Check' : 'Reinforce Learn',
      prompt: remediation.status === 'ready-to-retry'
        ? 'Retry the Check after completing targeted reinforcement.'
        : `Reinforce: ${(remediation.concepts || []).join(', ') || 'the failed Check items'}.`,
      reason: 'An unresolved assessment gap should be addressed before new course progression.',
      adaptive: true,
      source: 'remediation',
      engineVersion: ADAPTIVE_ACTION_ENGINE_VERSION
    };
  }).filter(Boolean).sort((a, b) => a.priority - b.priority || Number(a.weekId) - Number(b.weekId));
  if (remediationCandidates.length) return remediationCandidates[0];

  // 2. Prefer the highest-value competency gap, while carrying the Check trail
  //    into the action so recovered capability is recognized without being counted twice.
  const gaps = Array.isArray(hubSignals?.prioritySkillGaps) ? hubSignals.prioritySkillGaps : [];
  const gapCandidates = gaps.map((gap, index) => {
    const weekId = text(gap.recommendedWeekId);
    const stage = text(gap.recommendedStage);
    if (!weekId || !STAGES.includes(stage) || !catalog?.[weekId]) return null;
    if (!isStageUnlocked(progressByWeek, weekId, stage)) return null;

    const trail = assessmentTrail(contextByWeek?.[weekId]);
    const evidenceQuality = text(contextByWeek?.[weekId]?.evidence?.evidenceQuality) || 'insufficient';
    const evidenceBonus = evidenceQuality === 'high' ? 0 : evidenceQuality === 'developing' ? 1 : 2;
    const recoveryBonus = trail.recovered ? 1 : 0;
    const gapReadiness = Number.isFinite(Number(gap.readiness)) ? Number(gap.readiness) : 100;
    const priority = Math.max(0, gapReadiness) - evidenceBonus - recoveryBonus + index * 0.01;
    const recoveryNote = trail.recovered
      ? ` This capability was recovered after ${trail.attempts} Check attempts; the next action preserves that recovery trail.`
      : '';

    return {
      priority,
      weekId,
      week: catalog[weekId]?.title || gap.recommendedWeekTitle || `Week ${weekId}`,
      stage,
      label: STAGE_LABELS[stage],
      prompt: gap.journalNextAction || `Strengthen ${gap.skill} through the ${STAGE_LABELS[stage]} stage.`,
      reason: `Priority competency gap: ${gap.skill} (${gap.readiness ?? 'developing'}% readiness).${recoveryNote}`,
      skill: gap.skill,
      adaptive: true,
      source: 'skill-gap',
      assessmentTrail: {
        attempts: trail.attempts,
        recovered: trail.recovered,
        latestPassed: trail.latestPassed,
        latestPercentage: trail.latestPercentage
      },
      evidenceQuality,
      engineVersion: ADAPTIVE_ACTION_ENGINE_VERSION
    };
  }).filter(Boolean).sort((a, b) => a.priority - b.priority || Number(a.weekId) - Number(b.weekId));
  if (gapCandidates.length) return gapCandidates[0];

  // 3. Fall back to the canonical sequential stage order.
  const next = hubSignals?.nextBestAction || null;
  if (next?.weekId && next?.stage) return { ...next, adaptive: false, source: 'sequential', engineVersion: ADAPTIVE_ACTION_ENGINE_VERSION };
  for (const id of ids) {
    const progress = progressByWeek?.[id] || {};
    const stage = STAGES.find(candidate => !progress[candidate]);
    if (stage && isStageUnlocked(progressByWeek, id, stage)) {
      return { weekId: id, week: catalog[id]?.title || `Week ${id}`, stage, label: STAGE_LABELS[stage], prompt: '', reason: 'Continue the canonical course sequence.', adaptive: false, source: 'sequential', engineVersion: ADAPTIVE_ACTION_ENGINE_VERSION };
    }
  }
  return null;
}

if (typeof window !== 'undefined') window.ECRHAdaptiveAction = { chooseNextBestAction };
