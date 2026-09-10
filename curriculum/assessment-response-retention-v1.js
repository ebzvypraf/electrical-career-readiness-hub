/* Electrical Career Readiness Hub — assessment response retention v1.
 * Restores the learner's latest Check responses when the canonical Check modal
 * is reopened, so failed attempts and recovery work can be reviewed and retried
 * without losing the learner's previous reasoning.
 */
(function () {
  'use strict';
  const getState = () => window.ECRHCanonical?.getState?.() || null;
  const escId = value => String(value ?? '').replace(/[^0-9A-Za-z_-]/g, '');
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

    card.querySelectorAll('input[type="radio"]').forEach(input => {
      const name = String(input.name || '');
      const questionIndex = name.match(/^cq(\d+)$/)?.[1];
      if (questionIndex == null) return;
      const keys = Object.keys(responses);
      const key = keys.find(candidate => candidate === questionIndex || candidate === `q${Number(questionIndex) + 1}` || escId(candidate) === escId(questionIndex));
      if (key != null && Number(responses[key]) === Number(input.value)) input.checked = true;
    });

    card.querySelectorAll('textarea[id^="ca"]').forEach(textarea => {
      const questionIndex = String(textarea.id).slice(2);
      const keys = Object.keys(responses);
      const key = keys.find(candidate => candidate === questionIndex || candidate === `q${Number(questionIndex) + 1}` || escId(candidate) === escId(questionIndex));
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
