/* Canonical store lifecycle regression. Uses disposable memory storage only. */
import { createLearningStateStore } from './learning-state-store-v1.js';

export async function runStoreLifecycleRegression(catalog = {}) {
  const storage = { data: new Map(), getItem(key) { return this.data.has(key) ? this.data.get(key) : null; }, setItem(key, value) { this.data.set(key, value); } };
  const store = createLearningStateStore({ catalog, storage });
  const weekId = Object.keys(catalog).sort((a,b) => Number(a)-Number(b))[0];
  if (!weekId) return { ok: false, issue: 'canonical-catalog-empty' };
  const week = catalog[weekId];
  const tasks = Array.isArray(week?.apply?.tasks) && week.apply.tasks.length ? week.apply.tasks.map(() => true) : [true];
  const apply = store.saveApplicationEvidence({ weekId, tasks, deliverable: String(week?.apply?.deliverable || 'Regression deliverable'), decisions: 'Regression decisions', assumptions: 'Regression assumptions', verification: 'Regression verification' });
  if (!apply.ok) return { ok: false, issue: 'apply-api', detail: apply.reason };
  const failed = store.recordAssessmentResult({ weekId, result: { score: 0, total: 3, passed: false, completionReady: false, date: '2026-01-01T00:00:01Z' } });
  if (!failed.ok || failed.result?.passed) return { ok: false, issue: 'failed-check-api' };
  const remediation = store.startRemediation(weekId);
  if (!remediation.ok) return { ok: false, issue: 'remediation-start-api', detail: remediation.reason };
  const completed = store.completeRemediation({ weekId, notes: 'Regression reinforcement completed.' });
  if (!completed.ok) return { ok: false, issue: 'remediation-complete-api', detail: completed.reason };
  const passed = store.recordAssessmentResult({ weekId, result: { score: 3, total: 3, passed: true, completionReady: true, date: '2026-01-01T00:00:02Z' } });
  if (!passed.ok || passed.result?.recovered !== true) return { ok: false, issue: 'recovery-api' };
  const evidence = store.captureEvidence({ weekId, title: String(week.title || `Week ${weekId}`), description: 'Store lifecycle regression evidence', reflection: 'Verified canonical store lifecycle.', nextAction: 'Continue to next stage.', reviewStatus: 'demonstrated', date: '2026-01-01T00:00:03Z', criteria: week?.evidence?.criteria || [] });
  if (!evidence.ok) return { ok: false, issue: 'evidence-api', detail: evidence.reason };
  const state = store.getState();
  const journal = state.journalEntries.filter(x => String(x.weekId) === String(weekId));
  const portfolio = state.portfolioEntries.filter(x => Number(x.week) === Number(weekId));
  const ledger = state.evidenceLedger || [];
  const checks = { applyJournal: journal.some(x => x.stage === 'apply'), checkJournal: journal.some(x => x.stage === 'check'), evidenceJournal: journal.some(x => x.stage === 'evidence'), demonstratedPortfolio: portfolio.some(x => x.reviewStatus === 'demonstrated'), evidenceLedger: ledger.length > 0, recovered: state.contextByWeek?.[weekId]?.assessmentResult?.recovered === true };
  const ok = Object.values(checks).every(Boolean);
  return { ok, suiteVersion: 'v1-store-lifecycle', weekId, checks, issues: Object.entries(checks).filter(([,value]) => !value).map(([key]) => key) };
}

const api = { runStoreLifecycleRegression };
if (typeof module !== 'undefined' && module.exports) module.exports = api;
if (typeof window !== 'undefined') window.ECRHStoreLifecycleRegression = api;
