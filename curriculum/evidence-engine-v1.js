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

function buildRecoveryProvenance(checkResult, context = {}) {
  const history = Array.isArray(context?.assessmentHistory) ? context.assessmentHistory : [];
  const remediation = context?.remediation || null;
  const recovered = Boolean(checkResult?.passed && remediation?.status === 'complete' && history.length > 1);
  const priorFailed = history.slice(0, -1).filter(item => item?.passed === false).at(-1) || null;
  const recoveredQuestionIds = Array.isArray(priorFailed?.missedQuestionIds) ? priorFailed.missedQuestionIds.slice() : [];
  const recoveredConcepts = Array.isArray(remediation?.concepts) ? remediation.concepts.map(text).filter(Boolean) : [];
  return { recovered, attempts: history.length, priorFailedAttempt: Boolean(priorFailed), recoveredQuestionIds, recoveredConcepts, remediationStatus: text(remediation?.status), reinforcementNote: text(remediation?.notes) };
}

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
  const applyLink = text(evidence.applyLink);
  const checkLink = text(evidence.checkLink);
  const allCriteriaSatisfied = criterionResults.length === 0 || criterionResults.every(c => c.satisfied);
  const fieldsComplete = REQUIRED.every(field => text(evidence[field]).length > 0);
  const applicationEvidence = evidence.applicationEvidence || evidence.context && evidence.context.applicationEvidence || null;
  const checkResult = evidence.checkResult || evidence.context && evidence.context.assessmentResult || null;
  const applyReady = Boolean(applicationEvidence && applicationEvidence.tasksComplete && applicationEvidence.deliverable && applicationEvidence.decisions && applicationEvidence.assumptions && applicationEvidence.verification);
  const checkPassed = Boolean(checkResult && (checkResult.passed || checkResult.completionReady));
  const prerequisitesSatisfied = applyReady && checkPassed;
  const missingPrerequisites = [];
  if (!applyReady) missingPrerequisites.push('Complete and save the structured Apply record, including all tasks, deliverable, decisions, assumptions, and verification.');
  if (!checkPassed) missingPrerequisites.push('Pass the Check stage before submitting Evidence.');
  const linkageComplete = Boolean(applyLink && checkLink);
  const demonstrated = fieldsComplete && allCriteriaSatisfied && prerequisitesSatisfied;
  let reviewStatus = text(evidence.reviewStatus);
  if (![STATUS.DRAFT, STATUS.REVIEW, STATUS.DEMONSTRATED].includes(reviewStatus)) reviewStatus = demonstrated ? STATUS.DEMONSTRATED : STATUS.DRAFT;
  if (!demonstrated && reviewStatus === STATUS.DEMONSTRATED) reviewStatus = STATUS.REVIEW;
  const quality = demonstrated && linkageComplete ? 'high' : (demonstrated || (fieldsComplete && prerequisitesSatisfied) ? 'developing' : 'insufficient');
  const context = evidence.context || {};
  const recoveryProvenance = buildRecoveryProvenance(checkResult, context);
  return {
    week: module && Number(module.week) || null, title, description,
    competency: Array.isArray(module && module.skillTargets) ? module.skillTargets.slice() : [],
    reflection, nextAction, applyLink, checkLink, linkageComplete,
    reviewStatus, evidenceQuality: quality, criteria: criterionResults, fieldsComplete, allCriteriaSatisfied,
    applicationEvidence, checkResult, applyReady, checkPassed, prerequisitesSatisfied, missingPrerequisites, demonstrated,
    recoveryProvenance, capturedAt: text(evidence.capturedAt) || null
  };
}

export function canComplete(module, input) { return normalize(module, input).demonstrated; }

export function buildSignals(module, evidence) {
  const e = normalize(module, evidence);
  return {
    home: { week: e.week, evidenceReady: e.demonstrated, evidenceQuality: e.evidenceQuality, prerequisitesSatisfied: e.prerequisitesSatisfied, missingPrerequisites: e.missingPrerequisites, recovered: e.recoveryProvenance.recovered, linkageComplete: e.linkageComplete },
    skills: e.competency.map(skill => ({ skill, demonstratedCapability: e.demonstrated, evidenceQuality: e.evidenceQuality, week: e.week, recoveryAssisted: e.recoveryProvenance.recovered, recoveryConcepts: e.recoveryProvenance.recoveredConcepts, evidenceLinkageComplete: e.linkageComplete })),
    journal: { week: e.week, reflection: e.reflection, nextAction: e.nextAction, recovery: e.recoveryProvenance, applyLink: e.applyLink, checkLink: e.checkLink },
    portfolio: { week: e.week, title: e.title, description: e.description, competency: e.competency, reflection: e.reflection, nextAction: e.nextAction, applyLink: e.applyLink, checkLink: e.checkLink, linkageComplete: e.linkageComplete, reviewStatus: e.reviewStatus, evidenceQuality: e.evidenceQuality, criteria: e.criteria, capturedAt: e.capturedAt, recoveryProvenance: e.recoveryProvenance }
  };
}

const api = { STATUS, normalize, canComplete, buildSignals };
if (typeof module !== 'undefined' && module.exports) module.exports = api;
if (typeof window !== 'undefined') window.ECRHEvidence = api;
