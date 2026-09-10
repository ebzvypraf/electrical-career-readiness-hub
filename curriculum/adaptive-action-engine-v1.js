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
 *
 * v1.2.3 normalizes qualitative evidence strength so Skills signals such as
 * "high" are treated consistently with numeric evidence-quality scores.
 *
 * v1.2.4 consumes the canonical learning-engine demonstratedCapability
 * aggregate when the legacy skills alias is not present.
 *
 * v1.2.5 normalizes numeric evidence quality before prioritizing a skill gap,
 * so canonical numeric evidence scores receive the same adaptive weighting
 * as qualitative evidence labels.
 *
 * v1.2.6 carries the canonical proof-chain state into adaptive actions so
 * Home, Skills, Journal, and Portfolio can consume the same Apply → Check →
 * Evidence context without recreating it locally.
 *
 * v1.2.7 adds an explicit proof-chain status and next-proof-stage contract to
 * every adaptive action so downstream surfaces can explain what is complete
 * and what evidence-producing step should happen next.
 */
import { STAGES, STAGE_LABELS, isStageUnlocked } from './learning-engine-v2.js';

export const ADAPTIVE_ACTION_ENGINE_VERSION = '1.2.7';

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

function normalizeEvidenceQuality(value) {
  if (Number.isFinite(Number(value))) return Number(value);
  const label = text(value).toLowerCase();
  return ({ high: 100, strong: 100, developing: 60, medium: 60, moderate: 60, insufficient: 0, low: 0 }[label] ?? 0);
}

function skillTransferContext(hubSignals, skill) {
  const sources = [
    ...(Array.isArray(hubSignals?.demonstratedCapability) ? hubSignals.demonstratedCapability : []),
    ...(Array.isArray(hubSignals?.skills) ? hubSignals.skills : [])
  ];
  const summary = sources.find(item => text(item?.skill).toLowerCase() === text(skill).toLowerCase()) || null;
  if (!summary) return { demonstratedWeeks: 0, evidenceQuality: 0, transferReady: false };
  const demonstratedWeeks = Number(summary.demonstratedWeeks ?? summary.evidenceCount) || 0;
  const evidenceQuality = normalizeEvidenceQuality(summary.evidenceQuality);
  const transferReady = demonstratedWeeks > 0 && evidenceQuality >= 80;
  return { demonstratedWeeks, evidenceQuality, transferReady };
}

function proofChainContext(context = {}) {
  const chain = context?.evidence?.proofChain;
  if (!chain || typeof chain !== 'object') {
    return { hasProofChain: false, applyLinked: false, checkLinked: false, evidenceCaptured: false, demonstrated: false };
  }
  return {
    hasProofChain: true,
    applyLinked: Boolean(chain.apply?.linked),
    checkLinked: Boolean(chain.check?.linked),
    evidenceCaptured: Boolean(chain.evidence?.captured),
    demonstrated: Boolean(chain.evidence?.demonstratedCapability)
  };
}

function proofChainStatus(context = {}) {
  const proof = proofChainContext(context);
  const nextProofStage = !proof.applyLinked ? 'apply'
    : !proof.checkLinked ? 'check'
    : !proof.evidenceCaptured ? 'evidence'
    : !proof.demonstrated ? 'evidence'
    : null;
  const completedStages = [proof.applyLinked, proof.checkLinked, proof.evidenceCaptured, proof.demonstrated].filter(Boolean).length;
  return {
    ...proof,
    completedStages,
    totalStages: 4,
    complete: completedStages === 4,
    nextProofStage,
    nextProofLabel: nextProofStage ? STAGE_LABELS[nextProofStage] || 'Evidence' : 'Complete'
  };
}

function actionContract(context = {}) {
  const status = proofChainStatus(context);
  return {
    proofStatus: status.complete ? 'demonstrated' : status.nextProofStage ? 'in-progress' : 'not-started',
    proofProgress: `${status.completedStages}/${status.totalStages}`,
    nextProofStage: status.nextProofStage,
    nextProofLabel: status.nextProofLabel
  };
}

export function chooseNextBestAction({ catalog = {}, progressByWeek = {}, contextByWeek = {}, hubSignals = {} } = {}) {
  const ids = Object.keys(catalog || {}).sort((a, b) => Number(a) - Number(b));

  const remediationCandidates = ids.map(id => {
    const remediation = contextByWeek?.[id]?.remediation;
    if (!remediation || !['required', 'in-progress', 'ready-to-retry'].includes(remediation.status)) return null;
    const week = catalog[id];
    const stage = remediation.status === 'ready-to-retry' ? 'check' : 'learn';
    const proof = proofChainStatus(contextByWeek?.[id]);
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
      proofChain: proof,
      ...actionContract(contextByWeek?.[id]),
      engineVersion: ADAPTIVE_ACTION_ENGINE_VERSION
    };
  }).filter(Boolean).sort((a, b) => a.priority - b.priority || Number(a.weekId) - Number(b.weekId));
  if (remediationCandidates.length) return remediationCandidates[0];

  const gaps = Array.isArray(hubSignals?.prioritySkillGaps) ? hubSignals.prioritySkillGaps : [];
  const gapCandidates = gaps.map((gap, index) => {
    const weekId = text(gap.recommendedWeekId);
    const stage = text(gap.recommendedStage);
    if (!weekId || !STAGES.includes(stage) || !catalog?.[weekId]) return null;
    if (!isStageUnlocked(progressByWeek, weekId, stage)) return null;

    const trail = assessmentTrail(contextByWeek?.[weekId]);
    const evidenceQuality = normalizeEvidenceQuality(contextByWeek?.[weekId]?.evidence?.evidenceQuality);
    const evidenceBonus = evidenceQuality >= 80 ? 0 : evidenceQuality >= 60 ? 1 : 2;
    const recoveryBonus = trail.recovered ? 1 : 0;
    const transfer = skillTransferContext(hubSignals, gap.skill);
    const transferBonus = transfer.transferReady ? 2 : 0;
    const proof = proofChainStatus(contextByWeek?.[weekId]);
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
      proofChain: proof,
      ...actionContract(contextByWeek?.[weekId]),
      engineVersion: ADAPTIVE_ACTION_ENGINE_VERSION
    };
  }).filter(Boolean).sort((a, b) => a.priority - b.priority || Number(a.weekId) - Number(b.weekId));
  if (gapCandidates.length) return gapCandidates[0];

  const next = hubSignals?.nextBestAction || null;
  if (next?.weekId && next?.stage) {
    return {
      ...next,
      adaptive: false,
      source: 'sequential',
      proofChain: proofChainStatus(contextByWeek?.[next.weekId]),
      ...actionContract(contextByWeek?.[next.weekId]),
      engineVersion: ADAPTIVE_ACTION_ENGINE_VERSION
    };
  }
  for (const id of ids) {
    const progress = progressByWeek?.[id] || {};
    const stage = STAGES.find(candidate => !progress[candidate]);
    if (stage && isStageUnlocked(progressByWeek, id, stage)) {
      return {
        weekId: id,
        week: catalog[id]?.title || `Week ${id}`,
        stage,
        label: STAGE_LABELS[stage],
        prompt: '',
        reason: 'Continue the canonical course sequence.',
        adaptive: false,
        source: 'sequential',
        proofChain: proofChainStatus(contextByWeek?.[id]),
        ...actionContract(contextByWeek?.[id]),
        engineVersion: ADAPTIVE_ACTION_ENGINE_VERSION
      };
    }
  }
  return null;
}

if (typeof window !== 'undefined') window.ECRHAdaptiveAction = { chooseNextBestAction };
