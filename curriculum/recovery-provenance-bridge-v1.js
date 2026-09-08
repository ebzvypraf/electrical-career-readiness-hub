/*
 * Electrical Career Readiness Hub — recovery provenance bridge v1.
 * Carries a successful remediation/retry into the canonical Evidence and
 * Portfolio records so Skills/Home/Journal can distinguish recovered capability.
 */
(function () {
  'use strict';

  let installed = false;
  const clean = value => String(value ?? '').trim();
  const getStore = () => {
    try { return window.ECRHCanonical?.store?.() || null; } catch (_) { return null; }
  };

  function buildProvenance(context) {
    const history = Array.isArray(context?.assessmentHistory) ? context.assessmentHistory : [];
    const remediation = context?.remediation || null;
    const recovered = Boolean(context?.assessmentResult?.passed && remediation?.status === 'complete' && history.length > 1);
    const priorFailed = history.slice(0, -1).filter(item => item?.passed === false).at(-1) || null;
    return {
      recovered,
      attempts: history.length,
      priorFailedAttempt: Boolean(priorFailed),
      recoveredQuestionIds: Array.isArray(priorFailed?.missedQuestionIds) ? priorFailed.missedQuestionIds.slice() : [],
      recoveredConcepts: Array.isArray(remediation?.concepts) ? remediation.concepts.map(clean).filter(Boolean) : [],
      reinforcementNote: clean(remediation?.notes),
      recordedAt: new Date().toISOString()
    };
  }

  function install() {
    if (installed) return true;
    const store = getStore();
    if (!store || typeof store.captureEvidence !== 'function') return false;

    const originalCapture = store.captureEvidence.bind(store);
    store.captureEvidence = function wrappedCaptureEvidence(payload = {}) {
      const result = originalCapture(payload);
      if (!result?.ok) return result;

      const weekId = String(payload.weekId);
      const state = result.state || store.getState();
      const current = state?.contextByWeek?.[weekId] || {};
      const recoveryProvenance = buildProvenance(current);
      const evidence = { ...(result.evidence || {}), recoveryProvenance };
      const entry = { ...(result.entry || {}), recoveryProvenance };

      const contextResult = store.updateStageContext(weekId, { evidence, recoveryProvenance });
      const portfolioResult = typeof store.addPortfolioEntry === 'function'
        ? store.addPortfolioEntry(entry)
        : null;

      return {
        ...result,
        evidence,
        entry: portfolioResult?.entry || entry,
        state: contextResult?.state || portfolioResult?.state || store.getState()
      };
    };

    installed = true;
    window.ECRHRecoveryProvenance = { version: '1.0.0', buildProvenance };
    return true;
  }

  function boot() {
    if (!install()) setTimeout(boot, 100);
  }

  if (typeof window !== 'undefined') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
    new MutationObserver(boot).observe(document.documentElement, { subtree: true, childList: true });
    boot();
  }
})();
