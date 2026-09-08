/*
 * Electrical Career Readiness Hub — assessment recovery → Journal bridge v1.
 * Records successful Check recovery after targeted remediation as a durable
 * learner milestone, so Home/Skills/Journal can distinguish recovery from
 * an ordinary first-pass Check without changing the canonical stage gates.
 */
(function () {
  'use strict';

  let initialized = false;
  let unsubscribe = null;
  const clean = value => String(value ?? '').trim();
  const getStore = () => {
    try { return window.ECRHCanonical?.store?.() || null; } catch (_) { return null; }
  };

  function recoveryId(weekId, remediation, assessment) {
    const stamp = clean(remediation?.completedAt || assessment?.date || 'session').replace(/[^0-9A-Za-z_-]/g, '');
    return `recovery-${String(weekId)}-${stamp}`;
  }

  function bridge(state) {
    const store = getStore();
    if (!store || !state) return;
    const entries = Array.isArray(state.journalEntries) ? state.journalEntries : [];
    const byId = new Set(entries.map(entry => String(entry?.id || '')));

    Object.entries(state.contextByWeek || {}).forEach(([weekId, context]) => {
      const remediation = context?.remediation;
      const assessment = context?.assessmentResult;
      if (remediation?.status !== 'complete' || !assessment?.passed || !assessment?.completionReady) return;

      const id = recoveryId(weekId, remediation, assessment);
      if (byId.has(id)) return;

      const concepts = Array.isArray(remediation?.concepts) ? remediation.concepts.map(clean).filter(Boolean) : [];
      const score = Number.isFinite(Number(assessment?.percentage))
        ? `${assessment.percentage}%`
        : (Number.isFinite(Number(assessment?.score)) && Number.isFinite(Number(assessment?.total)) && Number(assessment.total) > 0
          ? `${assessment.score}/${assessment.total}`
          : 'passed');

      store.addJournalEntry({
        id,
        date: clean(remediation?.completedAt || assessment?.date).slice(0, 10) || new Date().toISOString().slice(0, 10),
        hours: 0,
        study: `Week ${weekId}: Check recovered after targeted reinforcement`,
        learn: concepts.length ? `Reinforced: ${concepts.join(', ')}.` : 'Targeted reinforcement completed before the successful retry.',
        reflection: clean(remediation?.notes || 'The failed Check was reviewed, reinforced and successfully recovered.'),
        nextAction: `Capture the recovered capability as Evidence for Week ${weekId}.`,
        weekId,
        stage: 'check'
      });
    });
  }

  function init() {
    if (initialized) return true;
    const store = getStore();
    if (!store || typeof store.subscribe !== 'function') return false;
    initialized = true;
    unsubscribe = store.subscribe(bridge);
    return Boolean(unsubscribe);
  }

  function scheduleInit() {
    if (init()) return;
    setTimeout(scheduleInit, 100);
  }

  document.addEventListener('DOMContentLoaded', scheduleInit, { once: true });
  new MutationObserver(scheduleInit).observe(document.documentElement, { subtree: true, childList: true });
  scheduleInit();

  if (typeof window !== 'undefined') window.ECRHAssessmentRecoveryJournalBridge = { init, bridge };
})();
