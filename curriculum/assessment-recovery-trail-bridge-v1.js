/* Electrical Career Readiness Hub — assessment recovery trail bridge v1.
 * Persists the authoritative per-attempt recovery flag into assessmentHistory.
 * Keeps Check history and adaptive progression on the same recovery semantics.
 */
(function () {
  'use strict';

  function api() { return typeof window !== 'undefined' ? window.ECRHCanonical : null; }
  function getStore() {
    try {
      const candidate = api()?.store;
      return typeof candidate === 'function' ? candidate() : candidate || null;
    } catch (_) { return null; }
  }

  let busy = false;

  function sync(state) {
    if (busy || !state?.contextByWeek) return;
    const store = getStore();
    if (!store?.updateStageContext) return;

    for (const [weekId, context] of Object.entries(state.contextByWeek)) {
      const result = context?.assessmentResult;
      const history = Array.isArray(context?.assessmentHistory)
        ? context.assessmentHistory
        : (Array.isArray(result?.assessmentHistory) ? result.assessmentHistory : []);
      if (!history.length || typeof result?.recovered !== 'boolean') continue;

      const latestIndex = history.length - 1;
      const latest = history[latestIndex] || {};
      if (latest.recovered === result.recovered) continue;

      const nextHistory = history.map((attempt, index) =>
        index === latestIndex ? { ...attempt, recovered: result.recovered } : attempt
      );
      busy = true;
      try {
        store.updateStageContext(weekId, {
          assessmentHistory: nextHistory,
          assessmentResult: { ...result, assessmentHistory: nextHistory }
        });
      } finally {
        busy = false;
      }
    }
  }

  function boot() {
    if (typeof document === 'undefined') return;
    const store = getStore();
    if (!store?.subscribe) {
      setTimeout(boot, 250);
      return;
    }
    store.subscribe(sync);
  }

  boot();
})();
