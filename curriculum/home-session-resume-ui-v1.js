/* Electrical Career Readiness Hub — Home session resume v1.2.
 * Surfaces unfinished canonical Course work from the same context boundary used
 * by Learn → Apply → Check → Evidence.
 * v1.2 removes the separate localStorage draft source so Home does not depend on
 * a second progression store.
 */
(function () {
  'use strict';

  const STAGES = ['apply', 'check', 'evidence'];
  const LABELS = { apply: 'Apply', check: 'Check', evidence: 'Evidence' };
  let subscribedStore = null;

  function getStore() {
    const api = typeof window !== 'undefined' ? window.ECRHCanonical : null;
    return typeof api?.store === 'function' ? api.store() : api?.store || null;
  }

  function meaningful(stage, draft) {
    if (!draft || typeof draft !== 'object') return false;
    if (stage === 'apply') {
      return Boolean(
        (draft.tasks || []).some(Boolean) ||
        draft.deliverable ||
        draft.applyDeliverable ||
        draft.decisions ||
        draft.applyDecisions ||
        draft.assumptions ||
        draft.applyAssumptions ||
        draft.verification ||
        draft.applyVerification ||
        draft.notes ||
        draft.applyNotes
      );
    }
    if (stage === 'check') return Object.keys(draft.responses || {}).length > 0;
    return Boolean(
      (draft.criteria || []).some(item => Boolean(item?.satisfied ?? item)) ||
      draft.title ||
      draft.evidenceTitle ||
      draft.description ||
      draft.evidenceDescription ||
      draft.reflection ||
      draft.evidenceReflection ||
      draft.nextAction ||
      draft.evidenceNext
    );
  }

  function canonicalDrafts(store) {
    const state = store?.getState?.() || {};
    const contexts = state.contextByWeek || {};
    const progress = state.progressByWeek || {};
    const drafts = [];

    Object.entries(contexts).forEach(([weekId, context]) => {
      const weekProgress = progress[String(weekId)] || {};
      const sessionDraft = context?.sessionDraft || {};

      STAGES.forEach(stage => {
        if (weekProgress[stage]) return;
        const draft = sessionDraft[stage];
        if (!meaningful(stage, draft)) return;
        drafts.push({ weekId: String(weekId), stage, draft, savedAt: draft.savedAt || '' });
      });

      if (!weekProgress.check && meaningful('check', context?.assessmentResult) && context?.assessmentResult?.draft) {
        drafts.push({
          weekId: String(weekId),
          stage: 'check',
          draft: context.assessmentResult,
          savedAt: context.assessmentResult.draftSavedAt || ''
        });
      }
    });

    return drafts.sort((a, b) => String(b.savedAt).localeCompare(String(a.savedAt)));
  }

  function render() {
    const home = document.getElementById('home');
    const store = getStore();
    if (!home || !store) return;

    const draft = canonicalDrafts(store)[0] || null;
    let panel = document.getElementById('home-session-resume');

    if (!draft) {
      if (panel) panel.remove();
      return;
    }

    const saved = draft.savedAt ? new Date(draft.savedAt) : null;
    const stamp = saved && !Number.isNaN(saved.getTime()) ? saved.toLocaleString() : 'earlier';
    const signature = draft.weekId + '|' + draft.stage + '|' + draft.savedAt;

    if (!panel) {
      panel = document.createElement('div');
      panel.id = 'home-session-resume';
      panel.className = 'card s12';
      const grid = home.querySelector('.grid');
      if (!grid) return;
      grid.insertBefore(panel, grid.children[1] || null);
    }

    if (panel.dataset.signature === signature) return;
    panel.dataset.signature = signature;

    const label = LABELS[draft.stage] || draft.stage;
    panel.innerHTML =
      '<div class="k">Resume your work</div>' +
      '<h2>Week ' + draft.weekId + ' — ' + label + '</h2>' +
      '<p class="muted">You have unfinished ' + label + ' work saved from ' + stamp + '. Drafts never count as completion until the canonical learning action is completed.</p>' +
      '<button class="btn primary" id="home-session-resume-open">Resume ' + label + '</button>';

    const button = document.getElementById('home-session-resume-open');
    if (button) button.onclick = () => {
      const api = typeof window !== 'undefined' ? window.ECRHCanonical : null;
      if (typeof api?.openStage === 'function') api.openStage(String(draft.weekId), String(draft.stage));
      else document.querySelector('[data-page="course"]')?.click();
    };
  }

  function boot() {
    render();
    const store = getStore();
    if (store && store !== subscribedStore && store.subscribe) {
      subscribedStore = store;
      store.subscribe(() => setTimeout(render, 0));
    }
    new MutationObserver(render).observe(document.body, { childList: true, subtree: true });
  }

  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
    else boot();
  }
})();
