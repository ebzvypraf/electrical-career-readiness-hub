/* Electrical Career Readiness Hub — remediation engine v1.
 * Canonical transaction for failed Check -> targeted reinforcement -> retry.
 */
export const REMEDIATION_ENGINE_VERSION = '1.0.0';
export const REMEDIATION_STATUS = { REQUIRED: 'required', IN_PROGRESS: 'in-progress', READY_TO_RETRY: 'ready-to-retry', COMPLETE: 'complete' };

function clean(value) { return String(value ?? '').trim(); }

export function buildRemediationPlan(assessmentResult = {}) {
  const feedback = assessmentResult?.feedback || {};
  const reinforcement = Array.isArray(feedback.reinforcement) ? feedback.reinforcement : [];
  const concepts = [...new Set(reinforcement.flatMap(item => Array.isArray(item?.concepts) ? item.concepts.map(clean).filter(Boolean) : []))];
  const questionIds = reinforcement.map(item => clean(item?.questionId)).filter(Boolean);
  return {
    engineVersion: REMEDIATION_ENGINE_VERSION,
    status: reinforcement.length ? REMEDIATION_STATUS.REQUIRED : REMEDIATION_STATUS.COMPLETE,
    failedCount: Number(feedback.failedCount) || reinforcement.length,
    questionIds,
    concepts,
    actions: concepts.length ? concepts.map(concept => `Review and explain ${concept} in your own words.`) : ['Review the failed Check items and explain the correct reasoning before retrying.']
  };
}

export function startRemediation(assessmentResult = {}, existing = null, now = new Date().toISOString()) {
  const plan = buildRemediationPlan(assessmentResult);
  return { ...plan, ...(existing || {}), status: REMEDIATION_STATUS.IN_PROGRESS, startedAt: existing?.startedAt || now, completedAt: null };
}

export function completeRemediation(remediation = {}, notes = '', now = new Date().toISOString()) {
  const cleanNotes = clean(notes);
  if (!cleanNotes) return { ok: false, reason: 'Add a short reinforcement note before marking remediation complete.', remediation };
  if (!Array.isArray(remediation?.questionIds) || !remediation.questionIds.length) return { ok: false, reason: 'No failed Check items are linked to this remediation.', remediation };
  return { ok: true, remediation: { ...remediation, status: REMEDIATION_STATUS.READY_TO_RETRY, notes: cleanNotes, completedAt: now } };
}

export function canRetryCheck(remediation = {}) { return remediation?.status === REMEDIATION_STATUS.READY_TO_RETRY || remediation?.status === REMEDIATION_STATUS.COMPLETE; }

if (typeof window !== 'undefined') window.ECRHRemediation = { buildRemediationPlan, startRemediation, completeRemediation, canRetryCheck };
