/* Electrical Career Readiness Hub — canonical learning state regression suite v1.
 * Deterministic, dependency-light scenarios for the Learn → Apply → Check → Evidence
 * state machine and downstream projections. This module is intentionally read-only:
 * it constructs fixture states and reports failures without touching learner storage.
 */
import { STAGES, emptyProgress, isStageUnlocked, canCompleteStage } from './learning-engine-v2.js';
import { validateLearningState } from './learning-state-contract-v1.js';

const deepClone = value => JSON.parse(JSON.stringify(value));
const baseCatalog = () => Object.fromEntries(Array.from({ length: 24 }, (_, i) => {
  const id = String(i + 1);
  return [id, { id, week: Number(id), title: `Week ${id}`, skills: ['Electrical design'] }];
}));
const baseProgress = () => Object.fromEntries(Array.from({ length: 24 }, (_, i) => [String(i + 1), emptyProgress()]));
const journal = (weekId, stage, extra = {}) => ({ id: `${stage}-${weekId}`, date: '2026-01-01', weekId: String(weekId), stage, learn: stage === 'check' ? 'Check passed.' : '', reflection: stage === 'check' ? 'Reflection.' : '', nextAction: stage === 'check' ? 'Capture Evidence.' : '', ...extra });
const applyEvidence = () => ({ tasks: [true, true], tasksComplete: true, deliverable: 'Issued drawing package', decisions: 'Documented design decisions', assumptions: 'Recorded design assumptions', verification: 'Peer-check completed' });
const passedCheck = (attempt = 1, recovered = false) => ({ score: 3, total: 4, percentage: 75, passed: true, completionReady: true, attemptNumber: attempt, recovered, date: `2026-01-01T00:00:0${attempt}Z`, assessmentHistory: recovered ? [{ passed: false, score: 2, total: 4, date: '2025-12-31T00:00:00Z' }, { passed: true, score: 3, total: 4, date: `2026-01-01T00:00:0${attempt}Z` }] : [{ passed: true, score: 3, total: 4, date: `2026-01-01T00:00:0${attempt}Z` }] });
const demonstratedEvidence = (weekId = '1', attempt = 1, recovered = false) => ({ id: `portfolio-week-${weekId}`, week: Number(weekId), title: 'Issued drawing package', description: 'Demonstrated design deliverable', reviewStatus: 'demonstrated', evidenceQuality: 'high', criteria: ['Complete', 'Verified'], competency: ['Electrical design'], fieldsComplete: true, allCriteriaSatisfied: true, applyReady: true, checkPassed: true, prerequisitesSatisfied: true, demonstrated: true, applyLink: `apply:${weekId}`, checkLink: `check:${weekId}:2026-01-01T00:00:0${attempt}Z`, linkageComplete: true, linkageValid: true, proofChain: { applyLinked: true, checkLinked: true, evidenceCaptured: true, demonstratedCapability: true }, lineage: { lineageId: `lineage-${weekId}-${attempt}`, checkAttempt: attempt }, recoveryProvenance: recovered ? { recovered: true, priorFailure: true } : null, ledgerRecord: { lineageId: `lineage-${weekId}-${attempt}` } });

function assert(name, condition, details = '') { return condition ? null : { name, details }; }

export function runLearningStateRegression() {
  const failures = [];

  // 1. Stage ordering: later stages remain locked until prerequisites exist.
  {
    const progress = baseProgress();
    failures.push(assert('apply requires learn', !isStageUnlocked(progress, '1', 'apply')));
    failures.push(assert('check requires apply', !isStageUnlocked({ ...progress, '1': { learn: true, apply: false, check: false, evidence: false } }, '1', 'check')));
    failures.push(assert('week 2 learn requires week 1 evidence', !isStageUnlocked({ ...progress, '1': { learn: true, apply: true, check: true, evidence: false } }, '2', 'learn')));
  }

  // 2. Apply gate: all structured fields are required.
  {
    failures.push(assert('apply rejects incomplete record', !canCompleteStage('apply', { applicationEvidence: { tasks: [true], deliverable: 'x' } })));
    failures.push(assert('apply accepts complete record', canCompleteStage('apply', { applicationEvidence: applyEvidence() })));
  }

  // 3. Happy path: complete Check + demonstrated Evidence + downstream projections is valid.
  {
    const progress = baseProgress();
    progress['1'] = { learn: true, apply: true, check: true, evidence: true };
    const context = { '1': { applicationEvidence: applyEvidence(), assessmentResult: passedCheck(), evidence: demonstratedEvidence() } };
    const result = validateLearningState({ catalog: baseCatalog(), progressByWeek: progress, contextByWeek: context, journalEntries: [journal('1', 'apply', { source: 'apply-completion' }), journal('1', 'check')], portfolioEntries: [demonstratedEvidence()], evidenceLedger: [{ lineageId: 'lineage-1-1' }], nextBestAction: { weekId: '2', stage: 'learn' } });
    failures.push(assert('happy path contract passes', result.ok, JSON.stringify(result.issues)));
  }

  // 4. Recovery path: a passed retry must retain a prior failed attempt and recovery provenance.
  {
    const progress = baseProgress();
    progress['1'] = { learn: true, apply: true, check: true, evidence: true };
    const evidence = demonstratedEvidence('1', 2, true);
    const context = { '1': { applicationEvidence: applyEvidence(), assessmentResult: passedCheck(2, true), evidence } };
    const result = validateLearningState({ catalog: baseCatalog(), progressByWeek: progress, contextByWeek: context, journalEntries: [journal('1', 'apply', { source: 'apply-completion' }), journal('1', 'check')], portfolioEntries: [evidence], evidenceLedger: [{ lineageId: 'lineage-1-2' }], nextBestAction: { weekId: '2', stage: 'learn' } });
    failures.push(assert('recovery path contract passes', result.ok, JSON.stringify(result.issues)));
  }

  // 5. Stale evidence path: an upstream change must never remain a completed demonstrated state.
  {
    const progress = baseProgress();
    progress['1'] = { learn: true, apply: true, check: true, evidence: true };
    const stale = { ...demonstratedEvidence(), upstreamChangedAfterEvidence: true };
    const result = validateLearningState({ catalog: baseCatalog(), progressByWeek: progress, contextByWeek: { '1': { applicationEvidence: applyEvidence(), assessmentResult: passedCheck(), evidence: stale } }, journalEntries: [journal('1', 'apply', { source: 'apply-completion' }), journal('1', 'check')], portfolioEntries: [stale], evidenceLedger: [{ lineageId: 'lineage-1-1' }], nextBestAction: { weekId: '1', stage: 'evidence' } });
    failures.push(assert('stale evidence is rejected', !result.ok && result.issues.some(issue => issue.code === 'evidence-progress-while-stale')));
  }

  const failed = failures.filter(Boolean);
  return { ok: failed.length === 0, suiteVersion: 'v1', scenarioCount: 5, failed, passed: 5 - failed.length };
}

const api = { runLearningStateRegression };
if (typeof module !== 'undefined' && module.exports) module.exports = api;
if (typeof window !== 'undefined') window.ECRHLearningStateRegression = api;
