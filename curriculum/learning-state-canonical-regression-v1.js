/* Electrical Career Readiness Hub — live canonical catalog regression v4.
 * Runs the Learn → Apply → Check → Evidence progression against the actual
 * 24-week catalog loaded by the production runtime. Read-only: no learner storage.
 * Also validates the real downstream Home/Skills projection and canonical store lifecycle.
 */
import { STAGES, emptyProgress, applyStageCompletion, nextStage, buildHubSignals } from './learning-engine-v2.js';
import { loadCanonicalCatalog, validateCanonicalQuality } from './canonical-catalog-v1.js';
import { validateLearningState } from './learning-state-contract-v1.js';
import { runStoreLifecycleRegression } from './store-lifecycle-regression-v1.js';

const applyEvidence = week => ({
  tasks: Array.isArray(week?.apply?.tasks) && week.apply.tasks.length ? week.apply.tasks.map(() => true) : [true],
  tasksComplete: true,
  deliverable: String(week?.apply?.deliverable || 'Verified learning deliverable'),
  decisions: 'Regression fixture: design decisions documented',
  assumptions: 'Regression fixture: assumptions documented',
  verification: 'Regression fixture: peer-check completed'
});

const passedCheck = week => {
  const total = Math.max(3, Array.isArray(week?.check?.questions) ? week.check.questions.length : 0);
  return { score: total, total, percentage: 100, passed: true, completionReady: true, attemptNumber: 1, recovered: false, date: '2026-01-01T00:00:00Z', assessmentHistory: [{ passed: true, score: total, total, date: '2026-01-01T00:00:00Z' }] };
};

const demonstratedEvidence = (weekId, week) => ({
  id: `canonical-regression-${weekId}`,
  week: Number(weekId),
  title: String(week?.title || `Week ${weekId}`),
  description: 'Canonical catalog regression evidence fixture',
  reviewStatus: 'demonstrated',
  evidenceQuality: 'high',
  criteria: Array.isArray(week?.evidence?.criteria) && week.evidence.criteria.length ? week.evidence.criteria : ['Complete', 'Verified'],
  competency: Array.isArray(week?.skills) ? week.skills : [],
  fieldsComplete: true,
  allCriteriaSatisfied: true,
  applyReady: true,
  checkPassed: true,
  prerequisitesSatisfied: true,
  demonstrated: true,
  applyLink: `apply:${weekId}`,
  checkLink: `check:${weekId}:2026-01-01T00:00:00Z`,
  linkageComplete: true,
  linkageValid: true,
  proofChain: { applyLinked: true, checkLinked: true, evidenceCaptured: true, demonstratedCapability: true },
  lineage: { lineageId: `canonical-regression-${weekId}-1`, checkAttempt: 1 },
  recoveryProvenance: null,
  ledgerRecord: { lineageId: `canonical-regression-${weekId}-1` }
});

const journalEntry = (weekId, stage) => ({ id: `${stage}-${weekId}`, date: '2026-01-01', weekId: String(weekId), stage, source: `${stage}-completion`, reflection: 'Canonical regression reflection', nextAction: 'Continue to the next stage' });

const expectedNextStage = (weekIds, index, stage) => {
  if (stage !== 'evidence') return { weekId: weekIds[index], stage: STAGES[STAGES.indexOf(stage) + 1] };
  return index < weekIds.length - 1 ? { weekId: weekIds[index + 1], stage: 'learn' } : null;
};

export async function runCanonicalLearningStateRegression() {
  const catalog = await loadCanonicalCatalog();
  const weekIds = Object.keys(catalog).sort((a, b) => Number(a) - Number(b));
  const quality = validateCanonicalQuality(catalog, Object.fromEntries(weekIds.map(id => [id, catalog[id].check?.questions || []])));
  const issues = [];
  const progress = Object.fromEntries(weekIds.map(id => [id, emptyProgress()]));
  const contextByWeek = {};
  const journalEntries = [];
  const portfolioEntries = [];
  const evidenceLedger = [];
  let completedStages = 0;

  if (!quality.complete) issues.push({ code: 'catalog-incomplete', detail: JSON.stringify(quality) });
  if (!quality.stageComplete) issues.push({ code: 'catalog-stage-incomplete', detail: `Weeks missing Learn/Apply/Check/Evidence: ${quality.missingStageWeeks.join(', ')}` });

  for (let index = 0; index < weekIds.length; index += 1) {
    const weekId = weekIds[index];
    const week = catalog[weekId];
    contextByWeek[weekId] = {};
    for (const stage of STAGES) {
      const context = stage === 'learn'
        ? { learnViewedAt: '2026-01-01T00:00:00Z' }
        : stage === 'apply'
          ? { applicationEvidence: applyEvidence(week) }
          : stage === 'check'
            ? { assessmentResult: passedCheck(week) }
            : { evidence: demonstratedEvidence(weekId, week) };
      const result = applyStageCompletion(progress, weekId, stage, context);
      if (!result.ok) {
        issues.push({ code: 'stage-transition-failed', weekId, stage, detail: result.reason });
        break;
      }
      progress[weekId] = result.progress;
      contextByWeek[weekId] = { ...contextByWeek[weekId], ...context };
      completedStages += 1;

      const actualNext = nextStage(progress, weekIds);
      const expectedNext = expectedNextStage(weekIds, index, stage);
      if (JSON.stringify(actualNext) !== JSON.stringify(expectedNext)) issues.push({ code: 'next-action-mismatch', weekId, stage, expected: expectedNext, actual: actualNext });
      if (stage === 'apply' || stage === 'check') journalEntries.push(journalEntry(weekId, stage));
      if (stage === 'evidence') {
        const evidence = context.evidence;
        portfolioEntries.push(evidence);
        evidenceLedger.push(evidence.ledgerRecord);
      }
    }
  }

  const hubSignals = buildHubSignals(catalog, progress, contextByWeek, journalEntries, portfolioEntries);
  const contract = validateLearningState({ catalog, progressByWeek: progress, contextByWeek, journalEntries, portfolioEntries, evidenceLedger, hubSignals, nextBestAction: hubSignals?.nextBestAction || null });
  if (!contract.ok) issues.push({ code: 'learning-state-contract-failed', detail: JSON.stringify(contract.issues) });

  if (completedStages !== 96) issues.push({ code: 'stage-count-mismatch', expected: 96, actual: completedStages });
  if (journalEntries.length !== 48) issues.push({ code: 'journal-projection-count-mismatch', expected: 48, actual: journalEntries.length });
  if (portfolioEntries.length !== 24) issues.push({ code: 'portfolio-projection-count-mismatch', expected: 24, actual: portfolioEntries.length });
  if (evidenceLedger.length !== 24) issues.push({ code: 'evidence-ledger-count-mismatch', expected: 24, actual: evidenceLedger.length });
  if (hubSignals?.completedStages !== 96) issues.push({ code: 'hub-progress-projection-mismatch', expected: 96, actual: hubSignals?.completedStages });
  if (hubSignals?.totalStages !== 96) issues.push({ code: 'hub-total-stage-projection-mismatch', expected: 96, actual: hubSignals?.totalStages });
  if (hubSignals?.overallProgress !== 100) issues.push({ code: 'home-progress-projection-mismatch', expected: 100, actual: hubSignals?.overallProgress });
  if (hubSignals?.nextBestAction !== null) issues.push({ code: 'home-terminal-action-mismatch', expected: null, actual: hubSignals?.nextBestAction });
  if (Array.isArray(hubSignals?.prioritySkillGaps) && hubSignals.prioritySkillGaps.length) issues.push({ code: 'skills-terminal-gaps-remain', expected: 0, actual: hubSignals.prioritySkillGaps.length });
  if (Array.isArray(hubSignals?.demonstratedCapability)) {
    const incompleteSkills = hubSignals.demonstratedCapability.filter(item => Number(item?.readiness) < 100);
    if (incompleteSkills.length) issues.push({ code: 'skills-capability-projection-incomplete', expected: 0, actual: incompleteSkills.length });
  }
  if (nextStage(progress, weekIds) !== null) issues.push({ code: 'terminal-state-mismatch', detail: '24-week canonical progression still has a next action' });

  const storeLifecycle = await runStoreLifecycleRegression(catalog);
  if (!storeLifecycle.ok) issues.push({ code: 'store-lifecycle-regression-failed', detail: JSON.stringify(storeLifecycle) });

  return {
    ok: issues.length === 0,
    suiteVersion: 'v4-live-canonical-store-lifecycle',
    weekCount: weekIds.length,
    stageCount: completedStages,
    expectedStageCount: 96,
    journalProjectionCount: journalEntries.length,
    portfolioProjectionCount: portfolioEntries.length,
    evidenceLedgerCount: evidenceLedger.length,
    homeProjection: { overallProgress: hubSignals?.overallProgress ?? null, completedStages: hubSignals?.completedStages ?? null, totalStages: hubSignals?.totalStages ?? null, nextBestAction: hubSignals?.nextBestAction ?? null },
    skillsProjection: { demonstratedCapabilityCount: Array.isArray(hubSignals?.demonstratedCapability) ? hubSignals.demonstratedCapability.length : 0, prioritySkillGapCount: Array.isArray(hubSignals?.prioritySkillGaps) ? hubSignals.prioritySkillGaps.length : 0 },
    storeLifecycle,
    catalogQuality: quality,
    contractOk: contract.ok,
    issues
  };
}

const api = { runCanonicalLearningStateRegression };
if (typeof module !== 'undefined' && module.exports) module.exports = api;
if (typeof window !== 'undefined') window.ECRHCanonicalLearningStateRegression = api;
