/* Electrical Career Readiness Hub — Evidence Engine v1.2.
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
function time(value) { const n = Date.parse(value || ''); return Number.isFinite(n) ? n : null; }

function buildRecoveryProvenance(checkResult, context = {}) {
  const history = Array.isArray(context?.assessmentHistory)
    ? context.assessmentHistory
    : (Array.isArray(checkResult?.assessmentHistory) ? checkResult.assessmentHistory : []);
  const remediation = context?.remediation || null;
  const hasPersistedRecovery = typeof checkResult?.recovered === 'boolean';
  const recovered = hasPersistedRecovery
    ? checkResult.recovered
    : Boolean(checkResult?.passed && remediation?.status === 'complete' && history.length > 1);
  const currentAttemptDate = text(checkResult?.date);
  const currentAttemptIndex = history.length
    ? history.findIndex(item => text(item?.date) === currentAttemptDate)
    : -1;
  const priorAttempts = currentAttemptIndex >= 0 ? history.slice(0, currentAttemptIndex) : history.slice(0, -1);
  const priorFailed = recovered
    ? priorAttempts.filter(item => item?.passed === false).at(-1) || null
    : null;
  const recoveredQuestionIds = Array.isArray(priorFailed?.missedQuestionIds)
    ? priorFailed.missedQuestionIds.slice()
    : [];
  const recoveredConcepts = recovered && Array.isArray(remediation?.concepts)
    ? remediation.concepts.map(text).filter(Boolean)
    : [];
  return {
    recovered,
    attempts: history.length || (checkResult ? Number(checkResult.attemptNumber) || 1 : 0),
    priorFailedAttempt: Boolean(recovered && priorFailed) || Boolean(checkResult?.recovered),
    recoveredQuestionIds,
    recoveredConcepts,
    remediationStatus: text(remediation?.status),
    reinforcementNote: recovered ? text(remediation?.notes) : ''
  };
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
  const weekNumber = module && Number(module.week) || null;
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
  const evidenceCapturedAt = time(evidence.capturedAt);
  const applyCapturedAt = time(applicationEvidence?.capturedAt);
  const checkCapturedAt = time(checkResult?.date);
  const upstreamChangedAfterEvidence = evidenceCapturedAt != null && [applyCapturedAt, checkCapturedAt].some(value => value != null && value > evidenceCapturedAt);
  const expectedApplyLink = weekNumber ? `apply:${weekNumber}` : '';
  const expectedCheckPrefix = weekNumber ? `check:${weekNumber}:` : '';
  const applyLinkValid = Boolean(expectedApplyLink && applyLink === expectedApplyLink);
  const checkLinkValid = Boolean(expectedCheckPrefix && checkLink.startsWith(expectedCheckPrefix) && checkLink.length > expectedCheckPrefix.length);
  const linkageComplete = Boolean(applyLink && checkLink);
  const linkageValid = applyLinkValid && checkLinkValid;
  if (!linkageValid) missingPrerequisites.push('Link Evidence to the canonical Apply and Check records for this week before claiming demonstrated capability.');
  const demonstrated = fieldsComplete && allCriteriaSatisfied && prerequisitesSatisfied && linkageValid && !upstreamChangedAfterEvidence;
  let reviewStatus = text(evidence.reviewStatus);
  if (![STATUS.DRAFT, STATUS.REVIEW, STATUS.DEMONSTRATED].includes(reviewStatus)) reviewStatus = demonstrated ? STATUS.DEMONSTRATED : STATUS.DRAFT;
  if (!demonstrated && reviewStatus === STATUS.DEMONSTRATED) reviewStatus = STATUS.REVIEW;
  const quality = demonstrated && linkageValid ? 'high' : (demonstrated || (fieldsComplete && prerequisitesSatisfied && !upstreamChangedAfterEvidence) ? 'developing' : 'insufficient');
  const context = evidence.context || {};
  const recoveryProvenance = buildRecoveryProvenance(checkResult, context);
  const proofChain = {
    apply: {
      linked: Boolean(applyLink),
      linkValid: applyLinkValid,
      link: applyLink,
      capturedAt: applicationEvidence?.capturedAt || null,
      deliverable: text(applicationEvidence?.deliverable),
      decisions: text(applicationEvidence?.decisions),
      assumptions: text(applicationEvidence?.assumptions),
      verification: text(applicationEvidence?.verification)
    },
    check: {
      linked: Boolean(checkLink),
      linkValid: checkLinkValid,
      link: checkLink,
      passed: checkPassed,
      score: checkResult?.score ?? null,
      total: checkResult?.total ?? null,
      percentage: checkResult?.percentage ?? null,
      attemptNumber: checkResult?.attemptNumber ?? null,
      date: checkResult?.date || null,
      recovered: recoveryProvenance.recovered
    },
    evidence: {
      capturedAt: evidence.capturedAt || null,
      title,
      quality,
      criteriaSatisfied: criterionResults.filter(c => c.satisfied).length,
      criteriaTotal: criterionResults.length,
      demonstrated
    }
  };
  return {
    week: weekNumber, title, description,
    competency: Array.isArray(module && module.skillTargets) ? module.skillTargets.slice() : (Array.isArray(module && module.skills) ? module.skills.slice() : []),
    reflection, nextAction, applyLink, checkLink, linkageComplete, linkageValid,
    reviewStatus, evidenceQuality: quality, criteria: criterionResults, fieldsComplete, allCriteriaSatisfied,
    applicationEvidence, checkResult, applyReady, checkPassed, prerequisitesSatisfied, missingPrerequisites, demonstrated,
    upstreamChangedAfterEvidence, evidenceCapturedAt: evidence.capturedAt || null,
    recoveryProvenance, proofChain, capturedAt: text(evidence.capturedAt) || null
  };
}

export function canComplete(module, input) { return normalize(module, input).demonstrated; }

export function buildSignals(module, evidence) {
  const e = normalize(module, evidence);
  return {
    home: { week: e.week, evidenceReady: e.demonstrated, evidenceQuality: e.evidenceQuality, prerequisitesSatisfied: e.prerequisitesSatisfied, missingPrerequisites: e.missingPrerequisites, recovered: e.recoveryProvenance.recovered, linkageComplete: e.linkageComplete, linkageValid: e.linkageValid, upstreamChangedAfterEvidence: e.upstreamChangedAfterEvidence, proofChain: e.proofChain },
    skills: e.competency.map(skill => ({ skill, demonstratedCapability: e.demonstrated, evidenceQuality: e.evidenceQuality, week: e.week, recoveryAssisted: e.recoveryProvenance.recovered, recoveryConcepts: e.recoveryProvenance.recoveredConcepts, evidenceLinkageComplete: e.linkageComplete, evidenceLinkageValid: e.linkageValid })),
    journal: { week: e.week, reflection: e.reflection, nextAction: e.nextAction, recovery: e.recoveryProvenance, applyLink: e.applyLink, checkLink: e.checkLink, linkageValid: e.linkageValid, upstreamChangedAfterEvidence: e.upstreamChangedAfterEvidence },
    portfolio: { week: e.week, title: e.title, description: e.description, competency: e.competency, reflection: e.reflection, nextAction: e.nextAction, applyLink: e.applyLink, checkLink: e.checkLink, linkageComplete: e.linkageComplete, linkageValid: e.linkageValid, reviewStatus: e.reviewStatus, evidenceQuality: e.evidenceQuality, criteria: e.criteria, capturedAt: e.capturedAt, upstreamChangedAfterEvidence: e.upstreamChangedAfterEvidence, recoveryProvenance: e.recoveryProvenance, proofChain: e.proofChain, demonstratedCapability: e.demonstrated }
  };
}

const api = { STATUS, normalize, canComplete, buildSignals };
if (typeof module !== 'undefined' && module.exports) module.exports = api;
if (typeof window !== 'undefined') window.ECRHEvidence = api;
