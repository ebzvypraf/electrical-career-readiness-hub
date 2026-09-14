/* Electrical Career Readiness Hub — canonical learning state integrity contract v4.
 * Read-only invariants for the Learn → Apply → Check → Evidence proof chain.
 * Also validates downstream Home, Journal and Portfolio projections so a
 * committed stage cannot leave downstream surfaces partially advanced.
 * The contract never mutates learner state; it exposes actionable diagnostics.
 * v4 adds a lightweight production diagnostic surface fed only by the
 * canonical validation result. It does not write learner state.
 */

const asWeek = value => String(value ?? '').trim();
const hasCanonicalApplyLink = (entry, weekId) => entry?.applyLink === `apply:${weekId}`;
const hasCanonicalCheckLink = (entry, weekId) => typeof entry?.checkLink === 'string' && entry.checkLink.startsWith(`check:${weekId}:`) && entry.checkLink.length > `check:${weekId}:`.length;
const isApplyJournalEntry = entry => entry?.source === 'apply-completion';

function issue(code, weekId, message, severity = 'error') {
  return { code, weekId: weekId == null ? null : String(weekId), message, severity };
}

function applyRecordReady(context = {}) {
  const a = context?.applicationEvidence;
  return Boolean(a && a.tasksComplete && a.deliverable && a.decisions && a.assumptions && a.verification);
}

function publishIntegrityDiagnostic(result) {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  window.ECRHCanonical = window.ECRHCanonical || {};
  window.ECRHCanonical.learningStateIntegrity = result;
  const id = 'ecrh-integrity-diagnostic';
  let el = document.getElementById(id);
  if (!el) {
    el = document.createElement('div');
    el.id = id;
    el.setAttribute('role', 'status');
    el.style.cssText = 'position:fixed;right:12px;bottom:12px;z-index:9999;max-width:360px;padding:8px 10px;border:1px solid #d1d5db;border-radius:10px;background:#fff;box-shadow:0 8px 24px rgba(15,23,42,.12);font:12px/1.35 system-ui,-apple-system,Segoe UI,sans-serif;color:#334155;';
    document.body.appendChild(el);
  }
  const errors = Array.isArray(result?.issues) ? result.issues.filter(item => item?.severity === 'error') : [];
  el.textContent = errors.length
    ? `Learning-state integrity: ${errors.length} issue${errors.length === 1 ? '' : 's'} detected`
    : `Learning-state integrity: PASS · ${result?.weeksChecked ?? 0} weeks checked`;
  el.style.borderColor = errors.length ? '#fecaca' : '#bbf7d0';
  el.style.background = errors.length ? '#fff7f7' : '#f0fdf4';
  el.style.color = errors.length ? '#991b1b' : '#166534';
}

export function validateLearningState({ catalog = {}, progressByWeek = {}, contextByWeek = {}, portfolioEntries = [], journalEntries = [], evidenceLedger = [], hubSignals = {}, nextBestAction = null } = {}) {
  const issues = [];
  const weeks = Object.keys(catalog || {}).sort((a, b) => Number(a) - Number(b));
  const portfolioByWeek = new Map((Array.isArray(portfolioEntries) ? portfolioEntries : []).map(entry => [asWeek(entry?.week), entry]));
  const ledgerByLineage = new Map((Array.isArray(evidenceLedger) ? evidenceLedger : []).filter(item => item?.lineageId).map(item => [String(item.lineageId), item]));
  const journal = Array.isArray(journalEntries) ? journalEntries : [];
  let completedEvidence = 0;
  let demonstratedEvidence = 0;
  let recoveredChecks = 0;

  weeks.forEach(weekId => {
    const progress = progressByWeek?.[weekId] || {};
    const context = contextByWeek?.[weekId] || {};
    const evidence = context.evidence || null;
    const portfolio = portfolioByWeek.get(weekId) || null;
    const assessment = context.assessmentResult || null;
    const history = Array.isArray(context.assessmentHistory) ? context.assessmentHistory : (Array.isArray(assessment?.assessmentHistory) ? assessment.assessmentHistory : []);
    const weekJournal = journal.filter(entry => asWeek(entry?.weekId) === weekId);

    if (progress.apply === true && !applyRecordReady(context)) issues.push(issue('apply-progress-without-record', weekId, 'Apply is marked complete but the canonical structured Apply record is incomplete.'));
    if (progress.apply === true && applyRecordReady(context) && !weekJournal.some(isApplyJournalEntry)) issues.push(issue('apply-progress-without-journal', weekId, 'Apply is marked complete but its canonical Apply → Journal projection is missing.'));
    if (progress.check === true && (!assessment || assessment.passed !== true)) issues.push(issue('check-progress-without-pass', weekId, 'Check is marked complete but the current assessment result is not passed.'));
    if (progress.check === true && assessment?.passed === true && !weekJournal.some(entry => entry?.stage === 'check' && entry?.weekId != null)) issues.push(issue('check-progress-without-journal', weekId, 'Check is marked complete but its canonical Check → Journal projection is missing.'));
    if (assessment?.passed === true && assessment?.recovered === true) {
      recoveredChecks += 1;
      if (!history.some(item => item?.passed === false)) issues.push(issue('recovery-without-prior-failure', weekId, 'Recovered Check has no persisted prior failed attempt.'));
    }
    if (progress.evidence === true) {
      completedEvidence += 1;
      if (!evidence && !portfolio) issues.push(issue('evidence-progress-without-record', weekId, 'Evidence is marked complete but no canonical Evidence/Portfolio record exists.'));
      if (evidence?.upstreamChangedAfterEvidence === true || portfolio?.upstreamChangedAfterEvidence === true) issues.push(issue('evidence-progress-while-stale', weekId, 'Evidence is marked complete while its upstream Apply/Check proof has been invalidated.'));
    }
    [evidence, portfolio].filter(Boolean).forEach(entry => {
      const stale = entry.upstreamChangedAfterEvidence === true || entry.reviewStatus === 'draft';
      const demonstrated = entry.reviewStatus === 'demonstrated' || entry.demonstrated === true;
      if (!demonstrated || stale) return;
      demonstratedEvidence += 1;
      const applyValid = entry.linkageValid === true || (entry.linkageComplete === true && hasCanonicalApplyLink(entry, weekId));
      const checkValid = entry.linkageValid === true || (entry.linkageComplete === true && hasCanonicalCheckLink(entry, weekId));
      if (!entry.applyReady || !entry.checkPassed) issues.push(issue('demonstrated-without-prerequisites', weekId, 'Demonstrated Evidence is missing Apply-ready or Check-passed proof.'));
      if (!applyValid || !checkValid) issues.push(issue('demonstrated-without-valid-lineage', weekId, 'Demonstrated Evidence does not contain a valid canonical Apply → Check linkage.'));
      if (entry.lineage?.lineageId && !ledgerByLineage.has(String(entry.lineage.lineageId)) && !entry.ledgerRecord) issues.push(issue('missing-evidence-ledger-lineage', weekId, 'Demonstrated Evidence has a lineage ID but no retained ledger record.'));
      if (!portfolio) issues.push(issue('demonstrated-without-portfolio-projection', weekId, 'Demonstrated Evidence exists without a corresponding Portfolio projection.'));
    });
    if (portfolio && evidence && portfolio.reviewStatus === 'demonstrated' && evidence.reviewStatus === 'demonstrated') {
      if (portfolio.lineage?.lineageId && evidence.lineage?.lineageId && String(portfolio.lineage.lineageId) !== String(evidence.lineage.lineageId)) issues.push(issue('portfolio-evidence-lineage-mismatch', weekId, 'Portfolio and canonical Evidence records point to different lineage IDs.'));
    }
  });

  const currentAction = nextBestAction || hubSignals?.nextBestAction || null;
  if (currentAction?.weekId != null && currentAction?.stage === 'evidence') {
    const id = asWeek(currentAction.weekId);
    if (progressByWeek?.[id]?.evidence === true) issues.push(issue('home-points-to-completed-evidence', id, 'Home next-best-action still points to Evidence after that week is marked complete.'));
  }

  const valid = issues.filter(x => x.severity === 'error');
  const result = {
    ok: valid.length === 0,
    contractVersion: 'v4',
    checkedAt: new Date().toISOString(),
    weeksChecked: weeks.length,
    counts: { completedEvidence, demonstratedEvidence, recoveredChecks, journalEntries: journal.length, evidenceLedgerRecords: Array.isArray(evidenceLedger) ? evidenceLedger.length : 0 },
    issues
  };
  publishIntegrityDiagnostic(result);
  return result;
}

const api = { validateLearningState };
if (typeof module !== 'undefined' && module.exports) module.exports = api;
if (typeof window !== 'undefined') window.ECRHLearningStateContract = api;
