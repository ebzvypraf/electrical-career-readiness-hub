/* Electrical Career Readiness Hub — Evidence Engine v1
 * Canonical Evidence -> Portfolio -> Skills -> Home/Journal contract.
 * Browser-safe, dependency-free, and importable by the canonical state store.
 */
import './evidence-ui-enhancer-v1.js';
import './interview-readiness-enhancer-v1.js';
import './skill-gap-action-enhancer-v1.js';
import './journal-learning-link-v1.js';

export const STATUS = { DRAFT: 'draft', REVIEW: 'needs-review', DEMONSTRATED: 'demonstrated' };
const REQUIRED = ['title', 'description'];

function text(value) { return String(value == null ? '' : value).trim(); }

export function normalize(module, input) {
  const evidence = input || {};
  const criteria = Array.isArray(module && module.evidence && module.evidence.criteria) ? module.evidence.criteria : [];
  const criterionResults = criteria.map(function (label, index) {
    const id = 'criterion_' + (index + 1);
    return { id, label: text(label), satisfied: evidence[id] === true || evidence[id] === 'true' };
  });
  const title = text(evidence.title);
  const description = text(evidence.description);
  const reflection = text(evidence.reflection);
  const nextAction = text(evidence.nextAction);
  const allCriteriaSatisfied = criterionResults.length === 0 || criterionResults.every(c => c.satisfied);
  const fieldsComplete = REQUIRED.every(field => text(evidence[field]).length > 0);
  const applicationEvidence = evidence.applicationEvidence || evidence.context && evidence.context.applicationEvidence || null;
  const checkResult = evidence.checkResult || evidence.context && evidence.context.assessmentResult || null;
  const applyReady = !applicationEvidence || Boolean(applicationEvidence.tasksComplete && applicationEvidence.deliverable && applicationEvidence.decisions && applicationEvidence.assumptions && applicationEvidence.verification);
  const checkPassed = !checkResult || Boolean(checkResult.passed || checkResult.completionReady);
  const prerequisitesSatisfied = applyReady && checkPassed;
  const demonstrated = fieldsComplete && allCriteriaSatisfied && prerequisitesSatisfied;
  let reviewStatus = text(evidence.reviewStatus);
  if (![STATUS.DRAFT, STATUS.REVIEW, STATUS.DEMONSTRATED].includes(reviewStatus)) reviewStatus = demonstrated ? STATUS.DEMONSTRATED : STATUS.DRAFT;
  if (!demonstrated && reviewStatus === STATUS.DEMONSTRATED) reviewStatus = STATUS.REVIEW;
  const quality = demonstrated ? 'high' : (fieldsComplete && prerequisitesSatisfied ? 'developing' : 'insufficient');
  return {
    week: module && Number(module.week) || null,
    title, description,
    competency: Array.isArray(module && module.skillTargets) ? module.skillTargets.slice() : [],
    reflection, nextAction, reviewStatus, evidenceQuality: quality,
    criteria: criterionResults, fieldsComplete, allCriteriaSatisfied,
    applicationEvidence, checkResult, applyReady, checkPassed, prerequisitesSatisfied, demonstrated,
    capturedAt: text(evidence.capturedAt) || null
  };
}

export function canComplete(module, input) { return normalize(module, input).demonstrated; }

export function buildSignals(module, evidence) {
  const e = normalize(module, evidence);
  return {
    home: { week: e.week, evidenceReady: e.demonstrated, evidenceQuality: e.evidenceQuality },
    skills: e.competency.map(skill => ({ skill, demonstratedCapability: e.demonstrated, evidenceQuality: e.evidenceQuality, week: e.week })),
    journal: { week: e.week, reflection: e.reflection, nextAction: e.nextAction },
    portfolio: { week: e.week, title: e.title, description: e.description, competency: e.competency, reflection: e.reflection, nextAction: e.nextAction, reviewStatus: e.reviewStatus, evidenceQuality: e.evidenceQuality, criteria: e.criteria, capturedAt: e.capturedAt }
  };
}

const api = { STATUS, normalize, canComplete, buildSignals };
if (typeof module !== 'undefined' && module.exports) module.exports = api;
if (typeof window !== 'undefined') window.ECRHEvidence = api;
