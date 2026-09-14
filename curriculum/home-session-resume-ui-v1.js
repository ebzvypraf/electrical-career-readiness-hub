/* Electrical Career Readiness Hub — Home session resume v1.
 * Surfaces meaningful unfinished Course drafts on Home and routes the learner
 * back to the exact Week + stage through the canonical Course runtime.
 * Draft state is temporary working state; canonical progress remains authoritative.
 */
(function () {
  'use strict';

  const KEY = 'ecrh-canonical-session-drafts-v1';
  const STAGES = ['learn', 'apply', 'check', 'evidence'];
  const LABELS = { apply: 'Apply', check: 'Check', evidence: 'Evidence' };

  function readDrafts() {
    try {
      const raw = localStorage.getItem(KEY);
      const value = raw ? JSON.parse(raw) : {};
      return value && typeof value === 'object' ? value : {};
    } catch (_) { return {}; }
  }

  function meaningful(draft) {
    if (!draft || !['apply', 'check', 'evidence'].includes(String(draft.stage))) return false;
    if (draft.stage === 'apply') return Boolean((draft.tasks || []).some(Boolean) || draft.applyDeliverable || draft.applyDecisions || draft.applyAssumptions || draft.applyVerification || draft.applyNotes);
    if (draft.stage === 'check') return Object.keys(draft.responses || {}).length > 0;
    return Boolean((draft.criteria || []).some(Boolean) || draft.evidenceTitle || draft.evidenceDescription || draft.evidenceReflection || draft.evidenceNext);
  }

  function latestDraft() {
    return Object.values(readDrafts()).filter(meaningful).sort((a, b) => String(b.savedAt || '').localeCompare(String(a.savedAt || '')))[0] || null;
  }

  function store() {
    const api = typeof window !== 'undefined' ? window.ECRHCanonical : null;
    return typeof api?.store === 'function' ? api.store() : api?.store || null;
  }

  function isStillIncomplete(draft) {
    const s = store();
    const progress = s?.getState?.().progressByWeek?.[String(draft.weekId)] || {};
    return !progress[String(draft.stage)];
  }

  function render() {
    const home = document.getElementById('home');
    if (!home) return;
    let panel = document.getElementById('home-session-resume');
    const draft = latestDraft();
    if (!draft || !isStillIncomplete(draft)) {
      if (panel) panel.remove();
      return;
    }
    const saved = draft.savedAt ? new Date(draft.savedAt) : null;
    const stamp = saved && !Number.isNaN(saved.getTime()) ? saved.toLocaleString() : 'earlier';
    const signature = `${draft.weekId}|${draft.stage}|${draft.savedAt || ''}`;
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
    panel.innerHTML = `<div class="k">Resume your work</div><h2>Week ${String(draft.weekId)} — ${label}</h2><p class="muted">You have unfinished ${label} work saved from ${stamp}. Drafts never count as completion until you save through the canonical learning action.</p><button class="btn primary" id="home-session-resume-open">Resume ${label}</button>`;
    const button = document.getElementById('home-session-resume-open');
    if (button) button.onclick = () => {
      const api = typeof window !== 'undefined' ? window.ECRHCanonical : null;
      if (typeof api?.openStage === 'function') api.openStage(String(draft.weekId), String(draft.stage));
      else document.querySelector('[data-page="course"]')?.click();
    };
  }

  function boot() {
    render();
    const s = store();
    if (s?.subscribe) s.subscribe(() => setTimeout(render, 0));
    new MutationObserver(render).observe(document.body, { childList: true, subtree: true });
  }

  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
    else boot();
  }
})();
