/* Electrical Career Readiness Hub — Apply gate bridge v1.
 * Bridges the structured Apply evidence record into the canonical stage gate
 * without inventing learner-authored notes. The learning engine historically
 * accepted applicationNotes as its Apply completion signal; structured Apply
 * evidence is now the authoritative source for that gate in the UI runtime.
 */
(function () {
  'use strict';

  const ready = evidence => Boolean(
    evidence &&
    evidence.tasksComplete === true &&
    String(evidence.deliverable || '').trim() &&
    String(evidence.decisions || '').trim() &&
    String(evidence.assumptions || '').trim() &&
    String(evidence.verification || '').trim()
  );

  function bridge() {
    const api = window.ECRHCanonical;
    if (!api || typeof api.store !== 'function') return false;
    const store = api.store();
    if (!store || typeof store.completeStage !== 'function' || store.__applyGateBridgeV1) return Boolean(store);

    const original = store.completeStage.bind(store);
    store.completeStage = function (args = {}) {
      if (String(args.stage) === 'apply') {
        const id = String(args.weekId);
        const current = store.getState?.().contextByWeek?.[id] || {};
        const evidence = current.applicationEvidence;
        if (ready(evidence)) {
          return original({
            ...args,
            context: {
              ...(args.context || {}),
              applicationEvidence: evidence,
              applicationNotes: String(args.context?.applicationNotes || '').trim() || '[structured Apply evidence complete]'
            }
          });
        }
      }
      return original(args);
    };
    store.__applyGateBridgeV1 = true;
    return true;
  }

  if (typeof window === 'undefined') return;
  if (!bridge()) {
    let attempts = 0;
    const timer = setInterval(() => {
      attempts += 1;
      if (bridge() || attempts >= 80) clearInterval(timer);
    }, 100);
  }
})();
