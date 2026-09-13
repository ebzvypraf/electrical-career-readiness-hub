/* Electrical Career Readiness Hub — canonical learning state integrity contract v1.
 * Read-only invariants for the Learn → Apply → Check → Evidence proof chain.
 * The contract never mutates learner state; it exposes actionable diagnostics.
 */

const asWeek = value => String(value ?? '').trim();
const hasCanonicalApplyLink = (entry, weekId) => entry?.applyLink === `apply:${weekId}`;
const hasCanonicalCheckLink = (entry, weekId) => typeof entry?.checkLink === 'string' && entry.checkLink.startsWith(`check:${weekId}:`) && entry.checkLink.length > `check:${weekId}:`.length;

function issue(code, weekId, message, severity = 'error') {
  return { code, weekId: weekId == null ? null : String(weekId), message, severity };
}

export function validateLearningState({ catalog = {}, progressByWeek = {}, contextByWeek = {}, portfolioEntries = [], journalEntries = [], evidenceLedger = [] } = {}) {
  const issues = [];
  const weeks = Object.keys(catalog || {}).sort((a, b) => Number(a) - Number(b));
  const portfolioByWeek = new Map((Array.isArray(portfolioEntries) ? portfolioEntries : []).map(entry => [asWeek(entry?.week), entry]));
  const ledgerByLineage = new Map((Array.isArray(evidenceLedger) ? evidenceLedger : []).filter(item => item?.lineageId).map(item => [String(item.lineageId), item]));
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

    if (progress.check === true && (!assessment || assessment.passed !== true)) {
      issues.push(issue('check-progress-without-pass', weekId, 'Check is marked complete but the current assessment result is not passed.'));
    }

    if (assessment?.passed === true && assessment?.recovered === true) {
      recoveredChecks += 1;
      if (!history.some(item => item?.passed === false)) issues.push(issue('recovery-without-prior-failure', weekId, 'Recovered Check has no persisted prior failed attempt.'));
    }

    if (progress.evidence === true) {
      completedEvidence += 1;
      if (!evidence && !portfolio) issues.push(issue('evidence-progress-without-record', weekId, 'Evidence is marked complete but no canonical Evidence/Portfolio record exists.'));
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
    });

    if (portfolio && evidence && portfolio.reviewStatus === 'demonstrated' && evidence.reviewStatus === 'demonstrated') {
      if (portfolio.lineage?.lineageId && evidence.lineage?.lineageId && String(portfolio.lineage.lineageId) !== String(evidence.lineage.lineageId)) {
        issues.push(issue('portfolio-evidence-lineage-mismatch', weekId, 'Portfolio and canonical Evidence records point to different lineage IDs.'));
      }
    }
  });

  const valid = issues.filter(x => x.severity === 'error');
  return {
    ok: valid.length === 0,
    contractVersion: 'v1',
    checkedAt: new Date().toISOString(),
    weeksChecked: weeks.length,
    counts: {
      completedEvidence,
      demonstratedEvidence,
      recoveredChecks,
      journalEntries: Array.isArray(journalEntries) ? journalEntries.length : 0,
      evidenceLedgerRecords: Array.isArray(evidenceLedger) ? evidenceLedger.length : 0
    },
    issues
  };
}
