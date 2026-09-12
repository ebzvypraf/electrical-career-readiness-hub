/* Electrical Career Readiness Hub — assessment response retention v4.
 * Restores the learner's latest canonical Check responses when the production
 * Check modal is reopened, so failed attempts and recovery work can be reviewed
 * and retried without losing previous reasoning.
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
    const findKey = index => keys.find(key => String(key) === String(index) || String(key) === `q${Number(index) + 1}`);

    card.querySelectorAll('input[type="radio"]').forEach(input => {
      const name = String(input.name || '');
      const index = name.match(/^(?:canonical-q|cq)(\d+)$/)?.[1];
      if (index == null) return;
      const key = findKey(index);
      if (key != null && String(responses[key]) === String(input.value)) input.checked = true;
    });

    card.querySelectorAll('textarea[id]').forEach(textarea => {
      const match = String(textarea.id).match(/^(?:canonical-answer-|ca)(\d+)$/);
      if (!match) return;
      const key = findKey(match[1]);
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
