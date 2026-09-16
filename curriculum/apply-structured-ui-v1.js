/* Electrical Career Readiness Hub — structured Apply UI v1.3.
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

  function readForm(modal) {
    return {
      tasks: [...modal.querySelectorAll('[data-apply-task]')].map(input => input.checked),
      deliverable: document.getElementById('apply-deliverable')?.value || '',
      decisions: document.getElementById('apply-decisions')?.value || '',
      assumptions: document.getElementById('apply-assumptions')?.value || '',
      verification: document.getElementById('apply-verification')?.value || ''
    };
  }

  function readiness(form) {
    const fields = [
      form.tasks.length > 0 && form.tasks.every(Boolean),
      Boolean(String(form.deliverable).trim()),
      Boolean(String(form.decisions).trim()),
      Boolean(String(form.assumptions).trim()),
      Boolean(String(form.verification).trim())
    ];
    return { fields, complete: fields.filter(Boolean).length, total: fields.length, ready: fields.every(Boolean) };
  }

  function renderStatus(modal) {
    const status = modal.querySelector('[data-apply-gate-status]');
    if (!status) return;
    const result = readiness(readForm(modal));
    const existing = getStore()?.getState?.()?.contextByWeek?.[currentWeekId()]?.applicationEvidence;
    const savedReady = Boolean(existing?.tasksComplete && existing?.deliverable && existing?.decisions && existing?.assumptions && existing?.verification);
    const ready = result.ready || savedReady;
    status.dataset.ready = ready ? 'true' : 'false';
    status.innerHTML = ready
      ? '<strong>Apply gate ready</strong><span>All required practical proof fields are complete. You can now move to Check.</span>'
      : `<strong>Apply gate in progress</strong><span>${result.complete}/${result.total} required proof areas complete. Finish the remaining fields before moving to Check.</span>`;
  }

  function renderDownstreamHandoff(modal) {
    const handoff = modal.querySelector('[data-apply-downstream-handoff]');
    if (!handoff) return;
    const weekId = currentWeekId();
    const week = window.ECRHCanonical?.catalog?.[weekId] || {};
    const integration = week.integration || {};
    const result = readiness(readForm(modal));
    const existing = getStore()?.getState?.()?.contextByWeek?.[weekId]?.applicationEvidence;
    const savedReady = Boolean(existing?.tasksComplete && existing?.deliverable && existing?.decisions && existing?.assumptions && existing?.verification);
    if (!(result.ready || savedReady)) {
      handoff.hidden = true;
      return;
    }
    handoff.hidden = false;
    handoff.innerHTML = '<strong>Ready for the next proof steps</strong>' +
      `<span>Check: validate your reasoning against the week’s requirements.</span>` +
      `<span>Journal: ${escapeHtml(integration.journalPrompt || 'Record what you learned, what you would improve, and your next action.')}</span>` +
      `<span>Portfolio: ${escapeHtml(integration.portfolioPrompt || 'Capture a sanitized, reviewable proof artifact from this work.')}</span>` +
      renderActionButtons(savedReady);
    wireDownstreamActions(handoff);
  }

  function renderActionButtons(savedReady) {
    if (!savedReady) return '';
    return '<div data-apply-downstream-actions style="display:flex;flex-wrap:wrap;gap:8px;margin-top:6px">' +
      '<button type="button" class="btn primary" data-apply-next="course">Return to Course</button>' +
      '<button type="button" class="btn" data-apply-next="journal">Open Journal</button>' +
      '<button type="button" class="btn" data-apply-next="portfolio">Open Portfolio</button>' +
      '</div>';
  }

  function wireDownstreamActions(handoff) {
    handoff.querySelectorAll('[data-apply-next]').forEach(button => {
      if (button.dataset.wired === 'true') return;
      button.dataset.wired = 'true';
      button.addEventListener('click', () => {
        const page = button.dataset.applyNext;
        const target = [...document.querySelectorAll('[data-page]')].find(candidate => candidate.dataset.page === page);
        if (target) target.click();
        const modal = document.getElementById('modal');
        if (modal) modal.classList.remove('show');
      });
    });
  }

  function enhance() {
    const modal = document.getElementById('modalCard');
    const weekId = currentWeekId();
    const store = getStore();
    if (!modal || !weekId || !store || (modal.dataset.applyStructuredV11 === weekId && modal.querySelector('#apply-task-checks'))) return;

    const state = store.getState?.() || {};
    const existing = state.contextByWeek?.[weekId]?.applicationEvidence || {};
    const tasks = Array.isArray(existing.tasks) ? existing.tasks : [];
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
      '<div data-apply-gate-status role="status" aria-live="polite" style="display:grid;gap:4px;margin:10px 0;padding:10px 12px;border:1px solid var(--border);border-radius:10px"><strong>Apply gate in progress</strong><span>0/5 required proof areas complete. Finish the remaining fields before moving to Check.</span></div>' +
      '<div class="rubric" id="apply-task-checks">' +
      catalogTasks.map((task, i) => `<label class="rubric-row" style="gap:10px;justify-content:flex-start"><input type="checkbox" data-apply-task="${i}" ${taskValues[i] ? 'checked' : ''}> <span>${escapeHtml(task)}</span></label>`).join('') +
      '</div>' +
      '<div class="evidence-form">' +
      '<label>Deliverable<textarea id="apply-deliverable" placeholder="What reviewable design output did you produce?">' + escapeHtml(existing.deliverable || '') + '</textarea></label>' +
      '<label>Design decisions<textarea id="apply-decisions" placeholder="Which engineering decisions did you make, and why?">' + escapeHtml(existing.decisions || '') + '</textarea></label>' +
      '<label>Assumptions & interfaces<textarea id="apply-assumptions" placeholder="What assumptions, inputs, interfaces or dependencies did you define?">' + escapeHtml(existing.assumptions || '') + '</textarea></label>' +
      '<label>Verification<textarea id="apply-verification" placeholder="How did you verify the result against requirements, standards or coordination inputs?">' + escapeHtml(existing.verification || '') + '</textarea></label>' +
      '</div>' +
      '<div data-apply-downstream-handoff role="status" aria-live="polite" hidden style="display:grid;gap:5px;margin-top:12px;padding:12px;border:1px solid var(--border);border-radius:10px"></div>';

    save.parentNode.parentNode.insertBefore(wrapper, save.parentNode);
    modal.dataset.applyStructuredV11 = weekId;

    wrapper.querySelectorAll('input, textarea').forEach(input => input.addEventListener('input', () => { renderStatus(modal); renderDownstreamHandoff(modal); }));
    wrapper.querySelectorAll('input[type="checkbox"]').forEach(input => input.addEventListener('change', () => { renderStatus(modal); renderDownstreamHandoff(modal); }));
    renderStatus(modal);
    renderDownstreamHandoff(modal);

    save.addEventListener('click', function (event) {
      event.preventDefault();
      event.stopImmediatePropagation();
      const form = readForm(modal);
      const result = store.saveApplicationEvidence({
        weekId,
        tasks: form.tasks,
        deliverable: form.deliverable,
        decisions: form.decisions,
        assumptions: form.assumptions,
        verification: form.verification,
        notes: note.value || ''
      });
      if (!result.ok) {
        alert(result.reason);
        return;
      }
      renderStatus(modal);
      renderDownstreamHandoff(modal);
      alert('Structured Apply record saved. Complete all required proof areas before moving to Check.');
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
