/* Electrical Career Readiness Hub — assessment response retention v2.
 * Restores the learner's latest canonical Check responses when the Check modal
 * is reopened, so failed attempts and recovery work can be reviewed and retried
 * without losing the learner's previous reasoning.
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

    const lookup = (id, index) => {
      const candidates = [String(id || ''), String(index), `q${Number(index) + 1}`];
      return Object.keys(responses).find(key => candidates.includes(String(key)));
    };

    card.querySelectorAll('input[type="radio"]').forEach(input => {
      const name = String(input.name || '');
      const index = name.match(/^canonical-q(\d+)$/)?.[1];
      if (index == null) return;
      const key = lookup('', index);
      if (key != null && Number(responses[key]) === Number(input.value)) input.checked = true;
    });

    card.querySelectorAll('textarea[id^="canonical-answer-"]').forEach(textarea => {
      const index = String(textarea.id).slice('canonical-answer-'.length);
      const key = lookup('', index);
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
