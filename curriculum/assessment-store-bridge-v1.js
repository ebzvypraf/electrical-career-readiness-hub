/* Electrical Career Readiness Hub — canonical Check/store bridge v2.
 * Routes the learner-facing Check submission through the shared learning-state store
 * while matching the current production Check UI controls and preserving authored
 * question IDs in the canonical response record.
 */
(function () {
  'use strict';

  function getCanonical() { return typeof window !== 'undefined' ? window.ECRHCanonical : null; }
  function getStore() {
    const api = getCanonical();
    if (!api) return null;
    const store = typeof api.store === 'function' ? api.store() : api.store;
    return store && typeof store.recordAssessmentResult === 'function' ? store : null;
  }
  function currentWeek() {
    const marker = document.querySelector('#modalCard .k');
    const match = marker?.textContent?.match(/Week\s+(\d+)\s+•\s+Check/i);
    return match ? Number(match[1]) : null;
  }
  function questionsFor(week) {
    const api = getCanonical();
    const authored = api?.assessments?.[String(week)];
    if (Array.isArray(authored) && authored.length) return authored;
    const fallback = api?.catalog?.[String(week)]?.check?.questions;
    return Array.isArray(fallback) ? fallback : [];
  }
  function collectResponses(week) {
    const responses = {};
    questionsFor(week).forEach((question, index) => {
      const id = question?.id || `q${index + 1}`;
      const choice = document.querySelector(`input[name="cq${index}"]:checked`) ||
        document.querySelector(`input[name="canonical-q${index}"]:checked`);
      const answer = document.getElementById(`ca${index}`) ||
        document.getElementById(`canonical-answer-${index}`);
      responses[id] = choice ? choice.value : (answer ? answer.value : '');
    });
    return responses;
  }
  function renderResult(result) {
    const card = document.getElementById('modalCard');
    if (!card) return;
    card.querySelector('#canonical-check-bridge-result')?.remove();
    const node = document.createElement('div');
    node.id = 'canonical-check-bridge-result';
    node.className = `result ${result?.passed ? '' : 'warn'}`;
    const score = `${Number(result?.score || 0)}/${Number(result?.total || 0)}`;
    node.innerHTML = `<b>Check recorded: ${score}</b> — ${result?.passed ? 'Pass. Evidence is now available.' : 'Not yet passed. Targeted remediation has been recorded.'}`;
    const button = document.getElementById('canon-score') || document.getElementById('canonical-score');
    if (button?.parentNode) button.parentNode.insertBefore(node, button.nextSibling);
  }
  function handleClick(event) {
    const target = event.target?.closest?.('#canon-score, #canonical-score');
    if (!target) return;
    const store = getStore();
    const week = currentWeek();
    if (!store || !week) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    const result = store.recordAssessmentResult({
      weekId: String(week),
      result: { responses: collectResponses(week), date: new Date().toISOString() }
    });
    if (!result?.ok) {
      window.alert(result?.reason || 'Check could not be recorded.');
      return;
    }
    renderResult(result.result);
  }

  if (typeof document === 'undefined') return;
  document.addEventListener('click', handleClick, true);
})();
