/* Electrical Career Readiness Hub — live canonical catalog regression v1.
 * Runs the Learn → Apply → Check → Evidence progression against the actual
 * 24-week catalog loaded by the production runtime. Read-only: no learner storage.
 */
import { STAGES, emptyProgress, applyStageCompletion, nextStage } from './learning-engine-v2.js';
import { loadCanonicalCatalog, validateCanonicalQuality } from './canonical-catalog-v1.js';
import { validateLearningState } from './learning-state-contract-v1.js';

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
  checkLink: 'check:' + weekId + ':2026-01-01T00:00:00Z',
  linkageComplete: true,
  linkageValid: true,
  proofChain: { applyLinked: true, checkLinked: true, evidenceCaptured: true, demonstratedCapability: true },
  lineage: { lineageId: `canonical-regression-${weekId}-1`, checkAttempt: 1 },
  recoveryProvenance: null,
  ledgerRecord: { lineageId: `canonical-regression-${weekId}-1` }
});

const journalEntry = (weekId, stage) => ({ id: `${stage}-${weekId}`, date: '2026-01-01', weekId: String(weekId), stage, source: `${stage}-completion`, reflection: 'Canonical regression reflection', nextAction: 'Continue to the next stage' });

export async function runCanonicalLearningStateRegression() {
  const catalog = await loadCanonicalCatalog();
  const quality = validateCanonicalQuality(catalog, Object.fromEntries(Object.keys(catalog).map(id => [id, catalog[id].check?.questions || []])));
  const issues = [];
  const progress = Object.fromEntries(Object.keys(catalog).map(id => [id, emptyProgress()]));
  const contextByWeek = {};
  const journalEntries = [];
  const portfolioEntries = [];
  const evidenceLedger = [];
  let completedStages = 0;

  if (!quality.complete) issues.push({ code: 'catalog-incomplete', detail: JSON.stringify(quality) });
  if (!quality.stageComplete) issues.push({ code: 'catalog-stage-incomplete', detail: `Weeks missing Learn/Apply/Check/Evidence: ${quality.missingStageWeeks.join(', ')}` });

  for (const weekId of Object.keys(catalog).sort((a, b) => Number(a) - Number(b))) {
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
      if (stage === 'apply' || stage === 'check') journalEntries.push(journalEntry(weekId, stage));
      if (stage === 'evidence') {
        const evidence = context.evidence;
        portfolioEntries.push(evidence);
        evidenceLedger.push(evidence.ledgerRecord);
      }
    }
  }

  const contract = validateLearningState({
    catalog,
    progressByWeek: progress,
    contextByWeek,
    journalEntries,
    portfolioEntries,
    evidenceLedger,
    nextBestAction: nextStage(progress, Object.keys(catalog))
  });
  if (!contract.ok) issues.push({ code: 'learning-state-contract-failed', detail: JSON.stringify(contract.issues) });
  if (completedStages !== 96) issues.push({ code: 'stage-count-mismatch', expected: 96, actual: completedStages });
  if (nextStage(progress, Object.keys(catalog)) !== null) issues.push({ code: 'terminal-state-mismatch', detail: '24-week canonical progression still has a next action' });

  return { ok: issues.length === 0, suiteVersion: 'v1-live-canonical', weekCount: Object.keys(catalog).length, stageCount: completedStages, expectedStageCount: 96, catalogQuality: quality, contractOk: contract.ok, issues };
}

const api = { runCanonicalLearningStateRegression };
if (typeof module !== 'undefined' && module.exports) module.exports = api;
if (typeof window !== 'undefined') window.ECRHCanonicalLearningStateRegression = api;
