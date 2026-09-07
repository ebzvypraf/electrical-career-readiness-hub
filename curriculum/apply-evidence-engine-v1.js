/* Electrical Career Readiness Hub — Apply evidence engine v1.
 * Turns the Apply stage from a free-form note into a small, auditable completion record.
 */
import './apply-impact-ui-v1.js';

export const APPLY_EVIDENCE_VERSION = '1.0.0';

export function normalizeApplyEvidence(input = {}) {
  const tasks = Array.isArray(input.tasks) ? input.tasks.map(Boolean) : [];
  return {
    tasks,
    tasksComplete: tasks.length > 0 && tasks.every(Boolean),
    deliverable: String(input.deliverable || '').trim(),
    decisions: String(input.decisions || '').trim(),
    assumptions: String(input.assumptions || '').trim(),
    verification: String(input.verification || '').trim(),
    notes: String(input.notes || '').trim(),
    capturedAt: String(input.capturedAt || new Date().toISOString())
  };
}

export function canCompleteApply(evidence = {}) {
  const x = normalizeApplyEvidence(evidence);
  return Boolean(x.tasksComplete && x.deliverable && x.decisions && x.assumptions && x.verification);
}

export function buildApplySignals(evidence = {}) {
  const x = normalizeApplyEvidence(evidence);
  const required = ['tasksComplete', 'deliverable', 'decisions', 'assumptions', 'verification'];
  const complete = required.filter(key => Boolean(x[key])).length;
  return {
    version: APPLY_EVIDENCE_VERSION,
    complete,
    total: required.length,
    completionRate: complete / required.length,
    ready: canCompleteApply(x),
    capturedAt: x.capturedAt
  };
}

if (typeof window !== 'undefined') window.ECRHApplyEvidence = { APPLY_EVIDENCE_VERSION, normalizeApplyEvidence, canCompleteApply, buildApplySignals };
