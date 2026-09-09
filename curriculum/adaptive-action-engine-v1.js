/*
 * Electrical Career Readiness Hub — adaptive next-action engine v1.
 * Chooses the highest-value learner action from canonical state signals.
 *
 * v1.2 adds cross-week transfer awareness so a capability already
 * demonstrated with strong evidence is treated as a transfer opportunity,
 * not a reason to repeat generic remediation.
 *
 * v1.2.1 also treats a legacy/current assessmentResult as a one-attempt
 * assessment trail when assessmentHistory has not yet been materialized.
 *
 * v1.2.2 uses the persisted per-attempt recovery flag when available so a
 * later ordinary pass is not incorrectly treated as a recovery.
 */
import { STAGES, STAGE_LABELS, isStageUnlocked } from './learning-engine-v2.js';

export const ADAPTIVE_ACTION_ENGINE_VERSION = '1.2.2';

function text(value) { return String(value ?? '').trim(); }

function assessmentTrail(context = {}) {
  const history = Array.isArray(context?.assessmentHistory) && context.assessmentHistory.length
    ? context.assessmentHistory
    : (context?.assessmentResult ? [context.assessmentResult] : []);
  const latest = history.at(-1) || context?.assessmentResult || null;
  const priorFailure = history.slice(0, -1).some(item => item?.passed === false);
  const hasPersistedRecovery = history.some(item => typeof item?.recovered === 'boolean');
  return {
    attempts: history.length,
    recovered: hasPersistedRecovery ? latest?.recovered === true : Boolean(history.length > 1 && latest?.passed && priorFailure),
    latestPassed: Boolean(latest?.passed),
    latestPercentage: Number.isFinite(Number(latest?.percentage)) ? Number(latest.percentage) : null
  };
}

function skillTransferContext(hubSignals, skill) {
  const summary = (hubSignals?.skills || []).find(item => text(item?.skill).toLowerCase() === text(skill).toLowerCase()) || null;
  if (!summary) return { demonstratedWeeks: 0, evidenceQuality: 0, transferReady: false };
  const demonstratedWeeks = Number(summary.demonstratedWeeks) || 0;
  const evidenceQuality = Number(summary.evidenceQuality) || 0;
  const transferReady = demonstratedWeeks > 0 && evidenceQuality >= 80;
  return { demonstratedWeeks, evidenceQuality, transferReady };
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

  // 2. Prefer the highest-value competency gap. If that skill has already
  //    been demonstrated strongly elsewhere, frame the next unlocked stage as
  //    transfer practice rather than repeating the same generic instruction.
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
    const transfer = skillTransferContext(hubSignals, gap.skill);
    const transferBonus = transfer.transferReady ? 2 : 0;
    const gapReadiness = Number.isFinite(Number(gap.readiness)) ? Number(gap.readiness) : 100;
    const priority = Math.max(0, gapReadiness) - evidenceBonus - recoveryBonus - transferBonus + index * 0.01;
    const recoveryNote = trail.recovered
      ? ` This capability was recovered after ${trail.attempts} Check attempts; the next action preserves that recovery trail.`
      : '';
    const transferNote = transfer.transferReady
      ? ` ${transfer.demonstratedWeeks} prior week${transfer.demonstratedWeeks === 1 ? '' : 's'} already show strong evidence for this skill; use this stage to transfer it into a new context.`
      : '';
    const transferPrompt = transfer.transferReady
      ? `Transfer ${gap.skill} into the Week ${weekId} ${STAGE_LABELS[stage]} task and explicitly compare the new context with the prior demonstrated example.`
      : (gap.journalNextAction || `Strengthen ${gap.skill} through the ${STAGE_LABELS[stage]} stage.`);

    return {
      priority,
      weekId,
      week: catalog[weekId]?.title || gap.recommendedWeekTitle || `Week ${weekId}`,
      stage,
      label: transfer.transferReady ? `Transfer ${STAGE_LABELS[stage]}` : STAGE_LABELS[stage],
      prompt: transferPrompt,
      reason: `Priority competency gap: ${gap.skill} (${gap.readiness ?? 'developing'}% readiness).${recoveryNote}${transferNote}`,
      skill: gap.skill,
      adaptive: true,
      source: transfer.transferReady ? 'skill-gap-transfer' : 'skill-gap',
      assessmentTrail: {
        attempts: trail.attempts,
        recovered: trail.recovered,
        latestPassed: trail.latestPassed,
        latestPercentage: trail.latestPercentage
      },
      transfer: {
        transferReady: transfer.transferReady,
        demonstratedWeeks: transfer.demonstratedWeeks,
        evidenceQuality: transfer.evidenceQuality
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
