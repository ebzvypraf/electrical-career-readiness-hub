/* Electrical Career Readiness Hub — Evidence criteria UI v1.
 * Bridges the canonical Evidence rubric into the learner's capture form.
 * The Evidence engine remains authoritative; this only exposes its required
 * criterion fields and submits them through the canonical state store.
 */
(function () {
  'use strict';

  const esc = value => String(value ?? '').replace(/[&<>\"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '\"':'&quot;', "'":'&#39;' }[c]));
  const canonical = () => window.ECRHCanonical;

  function weekIdFromModal() {
    const header = document.querySelector('#modalCard .k');
    const match = header?.textContent?.match(/Week\s+(\d+)\s+•\s+Evidence/i);
    return match ? String(Number(match[1])) : null;
  }

  function injectCriteria() {
    const weekId = weekIdFromModal();
    if (!weekId) return;
    const card = document.getElementById('modalCard');
    if (!card) return;
    const rows = Array.from(card.querySelectorAll('.rubric-row'));
    if (!rows.length) return;
    const existing = canonical()?.store?.()?.getState?.()?.contextByWeek?.[weekId]?.evidence || null;
    rows.forEach((row, index) => {
      if (row.querySelector('[data-evidence-criterion]')) return;
      const label = row.querySelector('span:first-child')?.textContent?.trim() || `Criterion ${index + 1}`;
      const id = `criterion_${index + 1}`;
      const checked = existing?.[id] === true || existing?.[id] === 'true';
      const control = `<label style="display:flex;align-items:center;gap:6px;font-weight:700"><input type="checkbox" data-evidence-criterion="${id}" ${checked ? 'checked' : ''}> Confirmed</label>`;
      const status = row.querySelector('.tag');
      if (status) status.innerHTML = control;
      else row.insertAdjacentHTML('beforeend', control);
      row.setAttribute('data-evidence-criterion-label', label);
    });
    card.dataset.evidenceCriteriaWeek = weekId;
  }

  function handleSave(event) {
    const button = event.target.closest('#canonical-save-evidence');
    if (!button) return;
    const weekId = weekIdFromModal();
    if (!weekId) return;
    const title = document.getElementById('canonical-et')?.value.trim() || '';
    const description = document.getElementById('canonical-ed')?.value.trim() || '';
    if (!title || !description) return;
    const criteria = {};
    document.querySelectorAll('#modalCard [data-evidence-criterion]').forEach(input => { criteria[input.dataset.evidenceCriterion] = Boolean(input.checked); });
    if (Object.keys(criteria).length && !Object.values(criteria).every(Boolean)) {
      event.preventDefault();
      event.stopImmediatePropagation();
      alert('Confirm every Evidence criterion before saving demonstrated evidence.');
      return;
    }
    const store = canonical()?.store;
    if (!store?.captureEvidence) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    const result = store.captureEvidence({ weekId, title, description, ...criteria, date: new Date().toISOString() });
    if (!result?.ok) {
      alert(result?.reason || 'Evidence could not be captured.');
      return;
    }
    const modal = document.getElementById('modal');
    if (modal) modal.classList.remove('show');
  }

  function schedule() { setTimeout(injectCriteria, 0); }
  document.addEventListener('click', handleSave, true);
  document.addEventListener('click', schedule, true);
  new MutationObserver(schedule).observe(document.documentElement, { subtree: true, childList: true });
  document.addEventListener('DOMContentLoaded', schedule, { once: true });
})();
