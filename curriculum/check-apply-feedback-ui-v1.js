/* Electrical Career Readiness Hub — Check ↔ Apply feedback UI v1.0.
 * Brings the learner's structured Apply record into the Check stage so
 * assessment reasoning is explicitly compared with the work just completed.
 * Uses the canonical learning-state store; no parallel progress model.
 */
(function () {
  'use strict';

  const clean = value => String(value ?? '').trim();
  const escapeHtml = value => clean(value).replace(/[&<>\"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '\"': '&quot;', "'": '&#39;' }[char]));

  function getStore() {
    const api = window.ECRHCanonical;
    if (!api) return null;
    const store = typeof api.store === 'function' ? api.store() : api.store;
    return store && typeof store.getState === 'function' ? store : null;
  }

  function currentWeekId(card) {
    const marker = card?.querySelector('.k');
    const match = clean(marker?.textContent).match(/Week\s+(\d+)\s+•\s+Check/i);
    return match ? String(Number(match[1])) : null;
  }

  function render() {
    const card = document.getElementById('modalCard');
    if (!card) return;
    const weekId = currentWeekId(card);
    if (!weekId) return;

    const state = getStore()?.getState?.() || {};
    const apply = state.contextByWeek?.[weekId]?.applicationEvidence;
    if (!apply) return;

    let panel = card.querySelector('[data-check-apply-feedback]');
    if (!panel) {
      panel = document.createElement('div');
      panel.dataset.checkApplyFeedback = '1';
      panel.className = 'learning-card';
      panel.style.marginTop = '10px';
      const anchor = card.querySelector('#canonical-score, #canonicalCheck, #canonical-submit, button[type="submit"]');
      (anchor?.parentElement || card).insertBefore(panel, anchor?.parentElement ? anchor.parentElement : card.firstChild);
    }

    const fields = [
      ['Deliverable', apply.deliverable],
      ['Design decisions', apply.decisions],
      ['Assumptions & interfaces', apply.assumptions],
      ['Verification', apply.verification]
    ].filter(([, value]) => clean(value));

    const result = state.contextByWeek?.[weekId]?.assessmentResult;
    const outcome = result
      ? (result.passed ? 'Check passed' : 'Check needs reinforcement')
      : 'Check not yet attempted';

    panel.innerHTML = '<h3>Apply → Check reasoning link</h3>' +
      `<p class="muted">${outcome}. Re-check the practical decisions you made in Apply against the assessment questions before you finalize your result.</p>` +
      '<div style="display:grid;gap:7px">' +
      fields.map(([label, value]) => `<div><strong>${escapeHtml(label)}</strong><div class="muted">${escapeHtml(value)}</div></div>`).join('') +
      '</div>' +
      '<p class="muted" style="margin-bottom:0">Use this as a reasoning cross-check: if your assessment answer conflicts with your applied decision or verification method, record the correction in Journal before proceeding to Evidence.</p>';
  }

  function boot() {
    render();
    const store = getStore();
    store?.subscribe?.(render);
  }

  if (typeof window !== 'undefined') {
    if (window.ECRHCanonical?.ready) boot();
    else window.addEventListener('ECRHCanonicalReady', boot, { once: true });
    new MutationObserver(render).observe(document.documentElement, { childList: true, subtree: true });
  }
})();
