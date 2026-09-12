/* Electrical Career Readiness Hub — Evidence Engine v1.5.
 * Canonical Evidence -> Portfolio -> Skills -> Home/Journal contract.
 * Adds an explicit serializable ledger record so canonical persistence can retain
 * append/supersession lineage without changing the active Portfolio projection.
 */
import './evidence-ui-enhancer-v1.js';
import './interview-readiness-enhancer-v1.js';
import './skill-gap-action-enhancer-v1.js';
import './journal-learning-link-v1.js';

export const STATUS = { DRAFT: 'draft', REVIEW: 'needs-review', DEMONSTRATED: 'demonstrated' };
export const LEDGER_VERSION = 'evidence-lineage-ledger-v1';
const REQUIRED = ['title', 'description'];
function text(value) { return String(value == null ? '' : value).trim(); }
function time(value) { const n = Date.parse(value || ''); return Number.isFinite(n) ? n : null; }
function lineageToken(value) { return text(value).replace(/[^0-9A-Za-z_.:-]/g, '-').slice(0, 160); }

export function buildEvidenceLineage({ week, applyLink = '', checkLink = '', capturedAt = '', supersedesLineageId = '', recovery = false } = {}) {
  const normalizedWeek = week == null ? '' : String(week);
  const apply = lineageToken(applyLink), check = lineageToken(checkLink), captured = lineageToken(capturedAt);
  const base = [normalizedWeek, apply, check, captured].filter(Boolean).join('|');
  return { lineageId: base ? `evidence:${base}` : '', week: normalizedWeek || null, applyLink: apply || null, checkLink: check || null, capturedAt: captured || null, supersedesLineageId: lineageToken(supersedesLineageId) || null, recovery: Boolean(recovery) };
}
function buildRecoveryProvenance(checkResult, context = {}) {
  const history = Array.isArray(context?.assessmentHistory) ? context.assessmentHistory : (Array.isArray(checkResult?.assessmentHistory) ? checkResult.assessmentHistory : []);
  const remediation = context?.remediation || null, hasPersistedRecovery = typeof checkResult?.recovered === 'boolean';
  const recovered = hasPersistedRecovery ? checkResult.recovered : Boolean(checkResult?.passed && remediation?.status === 'complete' && history.length > 1);
  const currentAttemptDate = text(checkResult?.date), currentAttemptIndex = history.length ? history.findIndex(item => text(item?.date) === currentAttemptDate) : -1;
  const priorAttempts = currentAttemptIndex >= 0 ? history.slice(0, currentAttemptIndex) : history.slice(0, -1);
  const priorFailed = recovered ? priorAttempts.filter(item => item?.passed === false).at(-1) || null : null;
  const recoveredQuestionIds = Array.isArray(priorFailed?.missedQuestionIds) ? priorFailed.missedQuestionIds.slice() : [];
  const recoveredConcepts = recovered && Array.isArray(remediation?.concepts) ? remediation.concepts.map(text).filter(Boolean) : [];
  return { recovered, attempts: history.length || (checkResult ? Number(checkResult.attemptNumber) || 1 : 0), priorFailedAttempt: Boolean(recovered && priorFailed) || Boolean(checkResult?.recovered), recoveredQuestionIds, recoveredConcepts, remediationStatus: text(remediation?.status), reinforcementNote: recovered ? text(remediation?.notes) : '' };
}
export function buildEvidenceLedgerRecord(evidence = {}, previousEvidence = null, event = 'captured') {
  const lineage = evidence?.lineage || {}, supersedesLineageId = evidence?.supersedesLineageId || lineage?.supersedesLineageId || previousEvidence?.lineage?.lineageId || previousEvidence?.lineageId || null;
  return { ledgerVersion: LEDGER_VERSION, event: text(event) || 'captured', recordedAt: text(evidence?.capturedAt) || new Date().toISOString(), lineageId: lineage?.lineageId || evidence?.lineageId || null, supersedesLineageId, week: evidence?.week == null ? null : Number(evidence.week), reviewStatus: text(evidence?.reviewStatus), evidenceQuality: text(evidence?.evidenceQuality), demonstrated: Boolean(evidence?.demonstrated), recapture: Boolean(evidence?.recapture || supersedesLineageId), recovery: Boolean(evidence?.recoveryProvenance?.recovered || lineage?.recovery), applyLink: text(evidence?.applyLink || lineage?.applyLink), checkLink: text(evidence?.checkLink || lineage?.checkLink), proofChain: evidence?.proofChain || null };
}

export function normalize(module, input) {
  const evidence = input || {}, criteria = Array.isArray(module && module.evidence && module.evidence.criteria) ? module.evidence.criteria : [];
  const criterionResults = criteria.map(function (label, index) { const id = 'criterion_' + (index + 1); return { id, label: text(label), satisfied: evidence[id] === true || evidence[id] === 'true' }; });
  const title = text(evidence.title), description = text(evidence.description), reflection = text(evidence.reflection), nextAction = text(evidence.nextAction);
  const applyLink = text(evidence.applyLink), checkLink = text(evidence.checkLink), weekNumber = module && Number(module.week) || null;
  const allCriteriaSatisfied = criterionResults.length === 0 || criterionResults.every(c => c.satisfied), fieldsComplete = REQUIRED.every(field => text(evidence[field]).length > 0);
  const applicationEvidence = evidence.applicationEvidence || evidence.context && evidence.context.applicationEvidence || null, checkResult = evidence.checkResult || evidence.context && evidence.context.assessmentResult || null;
  const applyReady = Boolean(applicationEvidence && applicationEvidence.tasksComplete && applicationEvidence.deliverable && applicationEvidence.decisions && applicationEvidence.assumptions && applicationEvidence.verification), checkPassed = Boolean(checkResult && (checkResult.passed || checkResult.completionReady)), prerequisitesSatisfied = applyReady && checkPassed;
  const missingPrerequisites = [];
  if (!applyReady) missingPrerequisites.push('Complete and save the structured Apply record, including all tasks, deliverable, decisions, assumptions, and verification.');
  if (!checkPassed) missingPrerequisites.push('Pass the Check stage before submitting Evidence.');
  const evidenceCapturedAt = time(evidence.capturedAt), applyCapturedAt = time(applicationEvidence?.capturedAt), checkCapturedAt = time(checkResult?.date);
  const upstreamChangedAfterEvidence = evidenceCapturedAt != null && [applyCapturedAt, checkCapturedAt].some(value => value != null && value > evidenceCapturedAt);
  const expectedApplyLink = weekNumber ? `apply:${weekNumber}` : '', expectedCheckPrefix = weekNumber ? `check:${weekNumber}:` : '';
  const applyLinkValid = Boolean(expectedApplyLink && applyLink === expectedApplyLink), checkLinkValid = Boolean(expectedCheckPrefix && checkLink.startsWith(expectedCheckPrefix) && checkLink.length > expectedCheckPrefix.length);
  const linkageComplete = Boolean(applyLink && checkLink), linkageValid = applyLinkValid && checkLinkValid;
  if (!linkageValid) missingPrerequisites.push('Link Evidence to the canonical Apply and Check records for this week before claiming demonstrated capability.');
  const demonstrated = fieldsComplete && allCriteriaSatisfied && prerequisitesSatisfied && linkageValid && !upstreamChangedAfterEvidence;
  let reviewStatus = text(evidence.reviewStatus); if (![STATUS.DRAFT, STATUS.REVIEW, STATUS.DEMONSTRATED].includes(reviewStatus)) reviewStatus = demonstrated ? STATUS.DEMONSTRATED : STATUS.DRAFT;
  if (!demonstrated && reviewStatus === STATUS.DEMONSTRATED) reviewStatus = STATUS.REVIEW;
  const quality = demonstrated && linkageValid ? 'high' : (demonstrated || (fieldsComplete && prerequisitesSatisfied && !upstreamChangedAfterEvidence) ? 'developing' : 'insufficient');
  const context = evidence.context || {}, recoveryProvenance = buildRecoveryProvenance(checkResult, context), priorEvidence = context.previousEvidence || context.priorEvidence || null;
  const derivedSupersedes = evidence.supersedesLineageId || evidence.context?.supersedesLineageId || priorEvidence?.lineage?.lineageId || priorEvidence?.lineageId || '';
  const isRecapture = Boolean(derivedSupersedes || priorEvidence || evidence.recoveryProvenance?.recovered || recoveryProvenance.recovered);
  const lineage = buildEvidenceLineage({ week: weekNumber, applyLink, checkLink, capturedAt: evidence.capturedAt, supersedesLineageId: derivedSupersedes, recovery: isRecapture });
  const proofChain = { apply: { linked: Boolean(applyLink), linkValid: applyLinkValid, link: applyLink, capturedAt: applicationEvidence?.capturedAt || null, deliverable: text(applicationEvidence?.deliverable), decisions: text(applicationEvidence?.decisions), assumptions: text(applicationEvidence?.assumptions), verification: text(applicationEvidence?.verification) }, check: { linked: Boolean(checkLink), linkValid: checkLinkValid, link: checkLink, passed: checkPassed, score: checkResult?.score ?? null, total: checkResult?.total ?? null, percentage: checkResult?.percentage ?? null, attemptNumber: checkResult?.attemptNumber ?? null, date: checkResult?.date || null, recovered: recoveryProvenance.recovered }, evidence: { capturedAt: evidence.capturedAt || null, title, quality, criteriaSatisfied: criterionResults.filter(c => c.satisfied).length, criteriaTotal: criterionResults.length, demonstrated, lineageId: lineage.lineageId, supersedesLineageId: lineage.supersedesLineageId, recapture: isRecapture } };
  const normalized = { week: weekNumber, title, description, competency: Array.isArray(module && module.skillTargets) ? module.skillTargets.slice() : (Array.isArray(module && module.skills) ? module.skills.slice() : []), reflection, nextAction, applyLink, checkLink, linkageComplete, linkageValid, reviewStatus, evidenceQuality: quality, criteria: criterionResults, fieldsComplete, allCriteriaSatisfied, applicationEvidence, checkResult, applyReady, checkPassed, prerequisitesSatisfied, missingPrerequisites, demonstrated, upstreamChangedAfterEvidence, evidenceCapturedAt: evidence.capturedAt || null, recoveryProvenance, lineage, proofChain, capturedAt: text(evidence.capturedAt) || null, recapture: isRecapture, supersedesLineageId: lineage.supersedesLineageId };
  normalized.ledgerRecord = buildEvidenceLedgerRecord(normalized, priorEvidence, isRecapture ? 'recaptured' : 'captured');
  return normalized;
}
export function canComplete(module, input) { return normalize(module, input).demonstrated; }
export function buildSignals(module, evidence) { const e = normalize(module, evidence); return { home: { week: e.week, evidenceReady: e.demonstrated, evidenceQuality: e.evidenceQuality, prerequisitesSatisfied: e.prerequisitesSatisfied, missingPrerequisites: e.missingPrerequisites, recovered: e.recoveryProvenance.recovered, linkageComplete: e.linkageComplete, linkageValid: e.linkageValid, upstreamChangedAfterEvidence: e.upstreamChangedAfterEvidence, lineage: e.lineage, proofChain: e.proofChain }, skills: e.competency.map(skill => ({ skill, demonstratedCapability: e.demonstrated, evidenceQuality: e.evidenceQuality, week: e.week, recoveryAssisted: e.recoveryProvenance.recovered, recoveryConcepts: e.recoveryProvenance.recoveredConcepts, evidenceLinkageComplete: e.linkageComplete, evidenceLinkageValid: e.linkageValid, evidenceLineageId: e.lineage.lineageId, evidenceRecapture: e.recapture })), journal: { week: e.week, reflection: e.reflection, nextAction: e.nextAction, recovery: e.recoveryProvenance, applyLink: e.applyLink, checkLink: e.checkLink, linkageValid: e.linkageValid, upstreamChangedAfterEvidence: e.upstreamChangedAfterEvidence, evidenceLineageId: e.lineage.lineageId, supersedesLineageId: e.supersedesLineageId }, portfolio: { week: e.week, title: e.title, description: e.description, competency: e.competency, reflection: e.reflection, nextAction: e.nextAction, applyLink: e.applyLink, checkLink: e.checkLink, linkageComplete: e.linkageComplete, linkageValid: e.linkageValid, reviewStatus: e.reviewStatus, evidenceQuality: e.evidenceQuality, criteria: e.criteria, capturedAt: e.capturedAt, upstreamChangedAfterEvidence: e.upstreamChangedAfterEvidence, recoveryProvenance: e.recoveryProvenance, lineage: e.lineage, proofChain: e.proofChain, demonstratedCapability: e.demonstrated, recapture: e.recapture, supersedesLineageId: e.supersedesLineageId, ledgerRecord: e.ledgerRecord } }; }
const api = { STATUS, LEDGER_VERSION, normalize, canComplete, buildSignals, buildEvidenceLineage, buildEvidenceLedgerRecord };
if (typeof module !== 'undefined' && module.exports) module.exports = api;
if (typeof window !== 'undefined') window.ECRHEvidence = api;
