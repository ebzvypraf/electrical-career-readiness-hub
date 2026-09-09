/* Electrical Career Readiness Hub — structured Apply UI v1.
 * Converts the canonical Apply modal into an auditable learner-authored record.
 * Uses the existing canonical learning-state store; no parallel progress model.
 */
(function () {
  'use strict';

  function getStore() {
    const api = window.ECRHCanonical;
    if (!api) return null;
    const store = typeof api.store === 'function' ? api.store() : api.store;
    return store && typeof store.saveApplicationEvidence === 'function' ? store : null;
  }

  function currentWeekId() {
    const label = document.querySelector('#modalCard .k');
    const match = label?.textContent?.match(/Week\s+(\d+)\s+•\s+Apply/i);
    return match ? String(Number(match[1])) : null;
  }

  function enhance() {
    const modal = document.getElementById('modalCard');
    const weekId = currentWeekId();
    const store = getStore();
    if (!modal || !weekId || !store || (modal.dataset.applyStructuredV1 === weekId && modal.querySelector('#apply-task-checks'))) return;

    const state = store.getState?.() || {};
    const existing = state.contextByWeek?.[weekId]?.applicationEvidence || {};
    const tasks = Array.isArray(state.contextByWeek?.[weekId]?.applicationEvidence?.tasks)
      ? state.contextByWeek[weekId].applicationEvidence.tasks
      : [];
    const catalogTasks = Array.isArray(window.ECRHCanonical?.catalog?.[weekId]?.apply?.tasks)
      ? window.ECRHCanonical.catalog[weekId].apply.tasks
      : [];
    const taskValues = tasks.length === catalogTasks.length ? tasks : catalogTasks.map(() => false);
    const note = document.getElementById('canonical-note');
    const save = document.getElementById('canonical-save-note');
    if (!save || !note) return;

    const wrapper = document.createElement('div');
    wrapper.className = 'learning-card';
    wrapper.style.marginTop = '10px';
    wrapper.innerHTML = '<h3>Structured Apply record</h3>' +
      '<p class="muted">Complete every practical task and capture the decisions, assumptions and verification behind your work. This record is the Apply stage gate.</p>' +
      '<div class="rubric" id="apply-task-checks">' +
      catalogTasks.map((task, i) => `<label class="rubric-row" style="gap:10px;justify-content:flex-start"><input type="checkbox" data-apply-task="${i}" ${taskValues[i] ? 'checked' : ''}> <span>${escapeHtml(task)}</span></label>`).join('') +
      '</div>' +
      '<div class="evidence-form">' +
      '<label>Deliverable<textarea id="apply-deliverable" placeholder="What reviewable design output did you produce?">' + escapeHtml(existing.deliverable || '') + '</textarea></label>' +
      '<label>Design decisions<textarea id="apply-decisions" placeholder="Which engineering decisions did you make, and why?">' + escapeHtml(existing.decisions || '') + '</textarea></label>' +
      '<label>Assumptions & interfaces<textarea id="apply-assumptions" placeholder="What assumptions, inputs, interfaces or dependencies did you define?">' + escapeHtml(existing.assumptions || '') + '</textarea></label>' +
      '<label>Verification<textarea id="apply-verification" placeholder="How did you verify the result against requirements, standards or coordination inputs?">' + escapeHtml(existing.verification || '') + '</textarea></label>' +
      '</div>';

    save.parentNode.parentNode.insertBefore(wrapper, save.parentNode);
    modal.dataset.applyStructuredV1 = weekId;

    save.addEventListener('click', function (event) {
      event.preventDefault();
      event.stopImmediatePropagation();
      const taskChecks = [...modal.querySelectorAll('[data-apply-task]')].map(input => input.checked);
      const result = store.saveApplicationEvidence({
        weekId,
        tasks: taskChecks,
        deliverable: document.getElementById('apply-deliverable')?.value || '',
        decisions: document.getElementById('apply-decisions')?.value || '',
        assumptions: document.getElementById('apply-assumptions')?.value || '',
        verification: document.getElementById('apply-verification')?.value || '',
        notes: note.value || ''
      });
      if (!result.ok) {
        alert(result.reason);
        return;
      }
      alert('Structured Apply record saved. The Apply stage gate is now ready when all required fields are complete.');
      enhance();
    }, true);
  }

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>\"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '\"': '&quot;', "'": '&#39;' }[char]));
  }

  if (typeof window === 'undefined') return;
  const observer = new MutationObserver(enhance);
  observer.observe(document.body, { childList: true, subtree: true });
  let attempts = 0;
  const timer = setInterval(() => {
    attempts += 1;
    enhance();
    if (attempts >= 120) clearInterval(timer);
  }, 100);
})();
