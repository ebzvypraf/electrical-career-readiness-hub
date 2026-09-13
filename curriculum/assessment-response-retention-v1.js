/* Electrical Career Readiness Hub — assessment response retention v5.
 * Restores the learner's latest canonical Check responses when the production
 * Check modal is reopened, so failed attempts and recovery work can be reviewed
 * and retried without losing previous reasoning.
 * v5 aligns restoration with the canonical Course runtime's question-ID selectors.
 */
(function () {
  'use strict';
  const getState = () => window.ECRHCanonical?.store?.getState?.() || null;

  function restoreLatestResponses() {
    const card = document.getElementById('modalCard');
    if (!card) return;
    const marker = card.querySelector('.k');
    const match = String(marker?.textContent || '').match(/Week\s+(\d+)\s+•\s+Check/i);
    if (!match) return;
    const weekId = String(Number(match[1]));
    const result = getState()?.contextByWeek?.[weekId]?.assessmentResult;
    const responses = result?.responses;
    if (!responses || typeof responses !== 'object') return;

    const keys = Object.keys(responses);
    const findKey = token => {
      const value = String(token ?? '');
      return keys.find(key => String(key) === value)
        ?? keys.find(key => String(key).toLowerCase() === value.toLowerCase())
        ?? (value.match(/^q(\d+)$/i) ? keys.find(key => String(key) === value) : null);
    };

    card.querySelectorAll('input[type="radio"]').forEach(input => {
      const name = String(input.name || '');
      const canonical = name.match(/^canonical-q-(.+)$/);
      const legacy = name.match(/^(?:canonical-q|cq)(\d+)$/);
      const token = canonical?.[1] ?? (legacy ? legacy[1] : null);
      if (token == null) return;
      const key = findKey(token) ?? (legacy ? findKey(`q${Number(legacy[1]) + 1}`) : null);
      if (key != null && String(responses[key]) === String(input.value)) input.checked = true;
    });

    card.querySelectorAll('textarea[id]').forEach(textarea => {
      const id = String(textarea.id);
      const canonical = id.match(/^canonical-answer-(.+)$/);
      const legacy = id.match(/^(?:canonical-answer-|ca)(\d+)$/);
      const token = canonical?.[1] ?? (legacy ? legacy[1] : null);
      if (token == null) return;
      const key = findKey(token) ?? (legacy ? findKey(`q${Number(legacy[1]) + 1}`) : null);
      if (key != null && !textarea.value) textarea.value = String(responses[key] ?? '');
    });
  }

  if (typeof MutationObserver !== 'undefined') {
    const observer = new MutationObserver(() => {
      if (document.getElementById('modal')?.classList.contains('show')) restoreLatestResponses();
    });
    observer.observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
  }
  window.ECRHAssessmentResponseRetention = { restoreLatestResponses };
})();
