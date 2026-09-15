/*
 * Electrical Career Readiness Hub — stage → Journal bridge v1.5.
 * Completes the learner-loop journal trail for Learn and Evidence stages,
 * while persisting the canonical stage-transition timestamp so Journal dates
 * reflect the actual learner action rather than the bridge's observation time.
 * Apply, Check and remediation already have canonical journal bridges in the state store.
 * Learn records now capture the authored week objective/takeaway when the canonical
 * catalog is available, making the Journal a useful learning record rather than a
 * generic completion marker.
 *
 * This module is idempotent: one journal record per completed Learn/Evidence stage.
 * Store compatibility: ECRHCanonical.store is the canonical store object in the
 * current runtime; older builds exposed it as a function. Resolve both forms so
 * the Journal bridge remains attached to the same canonical state boundary.
 */
(function () {
  'use strict';

  let initialized = false;
  let unsubscribe = null;
  const clean = value => String(value ?? '').trim();
  const stateApi = () => window.ECRHCanonical;
  const getStore = () => {
    try {
      const candidate = stateApi()?.store;
      return typeof candidate === 'function' ? candidate() : candidate || null;
    } catch (_) { return null; }
  };
  const getCatalog = () => {
    try { return stateApi()?.catalog || {}; } catch (_) { return {}; }
  };

  function learnJournalContent(weekId, context) {
    const module = getCatalog()?.[String(weekId)] || {};
    const learn = module.learn || {};
    const objective = clean(learn.objective || module.objective);
    const takeaway = clean(learn.takeaway || learn.keyTakeaway || learn.summary);
    const concepts = Array.isArray(learn.concepts) ? learn.concepts.map(clean).filter(Boolean).slice(0, 3) : [];
    const storedSummary = clean(context.learnSummary);
    const learningRecord = storedSummary || objective || takeaway || (concepts.length ? `Key concepts: ${concepts.join('; ')}` : 'Core learning completed and ready for practical application.');
    const reflection = takeaway
      ? `Learn stage completed. Key takeaway: ${takeaway}`
      : 'Learn stage completed. Reflect on which concept or reasoning principle will matter most during Apply.';
    return {
      learn: learningRecord,
      reflection,
      nextAction: `Continue to Apply for Week ${weekId}.`
    };
  }

  function bridge(state) {
    const store = getStore();
    if (!store || !state) return;
    const entries = Array.isArray(state.journalEntries) ? state.journalEntries : [];
    const byId = new Set(entries.map(entry => String(entry?.id || '')));

    Object.entries(state.progressByWeek || {}).forEach(([weekId, progress]) => {
      const context = state.contextByWeek?.[String(weekId)] || {};
      const stageTimestamps = context.stageCompletedAt && typeof context.stageCompletedAt === 'object'
        ? context.stageCompletedAt
        : {};

      if (progress?.learn && !stageTimestamps.learn) {
        const learnCompletedAt = clean(context.learnViewedAt) || new Date().toISOString();
        store.updateStageContext(weekId, {
          stageCompletedAt: { ...stageTimestamps, learn: learnCompletedAt }
        });
        return;
      }

      if (progress?.evidence && !stageTimestamps.evidence) {
        const evidence = context.evidence || {};
        store.updateStageContext(weekId, {
          stageCompletedAt: { ...stageTimestamps, evidence: clean(evidence.capturedAt) || new Date().toISOString() }
        });
        return;
      }

      if (progress?.learn && !byId.has(`learn-${weekId}`)) {
        const content = learnJournalContent(weekId, context);
        store.addJournalEntry({
          id: `learn-${weekId}`,
          date: clean(stageTimestamps.learn).slice(0, 10) || new Date().toISOString().slice(0, 10),
          hours: 0,
          study: `Week ${weekId}: Learn stage completed`,
          learn: content.learn,
          reflection: content.reflection,
          nextAction: content.nextAction,
          weekId,
          stage: 'learn'
        });
        return;
      }

      if (progress?.evidence && !byId.has(`evidence-${weekId}`)) {
        const evidence = context.evidence || {};
        store.addJournalEntry({
          id: `evidence-${weekId}`,
          date: clean(stageTimestamps.evidence || evidence.capturedAt).slice(0, 10) || new Date().toISOString().slice(0, 10),
          hours: 0,
          study: `Week ${weekId}: Evidence captured`,
          learn: clean(evidence.description || 'Demonstrated capability recorded as portfolio evidence.'),
          reflection: clean(evidence.reflection || 'The completed Evidence stage demonstrates applied capability and review readiness.'),
          nextAction: clean(evidence.nextAction || (Number(weekId) < 24 ? `Begin Week ${Number(weekId) + 1} Learn.` : 'Review the completed portfolio and prepare for interview readiness.')),
          weekId,
          stage: 'evidence'
        });
      }
    });
  }

  function init() {
    if (initialized) return true;
    const api = stateApi();
    const store = getStore();
    if (!api || !store || typeof store.subscribe !== 'function') return false;
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

  if (typeof window !== 'undefined') window.ECRHStageJournalBridge = { init, bridge };
})();
