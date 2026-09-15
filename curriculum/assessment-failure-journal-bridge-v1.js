/* Electrical Career Readiness Hub — failed Check → Journal bridge v1.
 * Records an actionable Journal milestone when a Check attempt fails.
 * Persistence remains owned by the canonical learning-state store; this bridge
 * only projects the failed assessment into the learner's longitudinal Journal.
 */
(function () {
  'use strict';

  let installed = false;
  let rendering = false;

  const clean = value => String(value ?? '').trim();
  const getStore = () => {
    try {
      const candidate = window.ECRHCanonical?.store;
      return typeof candidate === 'function' ? candidate() : candidate || null;
    } catch (_) { return null; }
  };

  function failureId(weekId, attempt) {
    const stamp = clean(attempt?.date || 'attempt').replace(/[^0-9A-Za-z_-]/g, '');
    return `check-failure-${String(weekId)}-${stamp}`;
  }

  function bridge(state) {
    if (rendering || !state) return;
    const store = getStore();
    if (!store || typeof store.addJournalEntry !== 'function') return;

    const entries = Array.isArray(state.journalEntries) ? state.journalEntries : [];
    const ids = new Set(entries.map(entry => String(entry?.id || '')));
    const additions = [];

    Object.entries(state.contextByWeek || {}).forEach(([weekId, context]) => {
      const history = Array.isArray(context?.assessmentHistory) ? context.assessmentHistory : [];
      const latest = history.at(-1);
      if (!latest || latest.passed !== false) return;

      const id = failureId(weekId, latest);
      if (ids.has(id)) return;

      const feedbackConcepts = Array.isArray(context?.remediation?.concepts)
        ? context.remediation.concepts
        : (Array.isArray(latest?.feedback?.priorityConcepts) ? latest.feedback.priorityConcepts : []);
      const concepts = feedbackConcepts.map(clean).filter(Boolean).slice(0, 5);
      const score = Number.isFinite(Number(latest?.percentage))
        ? `${latest.percentage}%`
        : (Number.isFinite(Number(latest?.score)) && Number.isFinite(Number(latest?.total)) && Number(latest.total) > 0
          ? `${latest.score}/${latest.total}`
          : 'not passed');

      additions.push({
        id,
        date: clean(latest.date).slice(0, 10) || new Date().toISOString().slice(0, 10),
        hours: 0,
        study: `Week ${weekId}: Check attempt requires reinforcement (${score}).`,
        learn: concepts.length ? `Focus concepts: ${concepts.join(', ')}.` : 'Review the failed Check items and correct the reasoning.',
        hard: concepts.length ? `The latest Check identified gaps in ${concepts.join(', ')}.` : 'The latest Check was not passed.',
        reflection: clean(latest?.feedback?.summary || 'Identify what was misunderstood, reinforce the targeted concepts, and verify the corrected reasoning.'),
        nextAction: `Complete targeted reinforcement for Week ${weekId}, then retry the Check.`,
        weekId,
        stage: 'check'
      });
    });

    if (!additions.length) return;
    rendering = true;
    try {
      additions.forEach(entry => store.addJournalEntry(entry));
    } finally {
      rendering = false;
    }
  }

  function init() {
    if (installed) return true;
    const store = getStore();
    if (!store || typeof store.subscribe !== 'function') return false;
    installed = true;
    store.subscribe(bridge);
    return true;
  }

  function boot() {
    if (!init()) setTimeout(boot, 100);
  }

  if (typeof window !== 'undefined') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
    new MutationObserver(() => { if (!installed) boot(); }).observe(document.documentElement, { subtree: true, childList: true });
    boot();
    window.ECRHAssessmentFailureJournalBridge = { init, bridge };
  }
})();
