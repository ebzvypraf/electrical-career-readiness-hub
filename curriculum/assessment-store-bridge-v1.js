/* Electrical Career Readiness Hub — canonical Check/store bridge v3.1.
 * Routes learner-facing Check submissions through the shared learning-state store,
 * preserves authored question IDs, and enforces the failed-Check remediation gate.
 * v3.1 adds a direct, canonical Continue to Evidence action after a successful Check
 * so compatible Check surfaces cannot strand the learner between proof stages.
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
  function currentState(store, week) {
    try { return store?.getState?.()?.contextByWeek?.[String(week)] || {}; } catch (_) { return {}; }
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
        document.querySelector(`input[name="canonical-q-${id}"]:checked`) ||
        document.querySelector(`input[name="canonical-q${index}"]:checked`);
      const answer = document.getElementById(`ca${index}`) ||
        document.getElementById(`canonical-answer-${index}`);
      responses[id] = choice ? choice.value : (answer ? answer.value : '');
    });
    return responses;
  }
  function openEvidence(week) {
    const api = getCanonical();
    if (typeof api?.openStage === 'function') {
      api.openStage(String(week), 'evidence');
      return true;
    }
    return false;
  }
  function renderResult(result, week) {
    const card = document.getElementById('modalCard');
    if (!card) return;
    card.querySelector('#canonical-check-bridge-result')?.remove();
    const node = document.createElement('div');
    node.id = 'canonical-check-bridge-result';
    node.className = `result ${result?.passed ? '' : 'warn'}`;
    const score = `${Number(result?.score || 0)}/${Number(result?.total || 0)}`;
    node.innerHTML = `<b>Check recorded: ${score}</b> — ${result?.passed ? 'Pass. Evidence is now available.' : 'Not yet passed. Complete the targeted reinforcement before retrying.'}`;
    const button = document.getElementById('canon-score') || document.getElementById('canonical-score');
    if (button?.parentNode) button.parentNode.insertBefore(node, button.nextSibling);
    if (result?.passed && week) {
      const continueButton = document.createElement('button');
      continueButton.type = 'button';
      continueButton.className = 'btn primary';
      continueButton.id = 'canonicalContinueEvidence';
      continueButton.textContent = 'Continue to Evidence';
      continueButton.setAttribute('aria-label', `Continue to Evidence for Week ${week}`);
      continueButton.style.marginTop = '10px';
      continueButton.onclick = () => openEvidence(week);
      node.appendChild(continueButton);
    }
  }
  function handleClick(event) {
    const target = event.target?.closest?.('#canon-score, #canonical-score');
    if (!target) return;
    const store = getStore();
    const week = currentWeek();
    if (!store || !week) return;
    const context = currentState(store, week);
    const priorAssessment = context.assessmentResult;
    const remediationStatus = context.remediation?.status;
    const retryUnlocked = remediationStatus === 'ready-to-retry' || remediationStatus === 'complete';
    if (priorAssessment && priorAssessment.passed === false && !retryUnlocked) {
      event.preventDefault();
      event.stopImmediatePropagation();
      window.alert('Complete the targeted reinforcement and record your reinforcement note before retrying the Knowledge Check.');
      return;
    }
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
    renderResult(result.result, week);
  }

  if (typeof document === 'undefined') return;
  document.addEventListener('click', handleClick, true);
})();
