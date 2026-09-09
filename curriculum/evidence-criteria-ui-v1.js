/* Electrical Career Readiness Hub — Evidence criteria UI v1.
 * Bridges the canonical Evidence rubric into the learner's capture form.
 * The Evidence engine remains authoritative; this only exposes its required
 * criterion fields and submits them through the canonical state store.
 */
(function () {
  'use strict';

  const canonical = () => window.ECRHCanonical;
  const getStore = () => {
    const api = canonical();
    return typeof api?.store === 'function' ? api.store() : api?.store || null;
  };
  const esc = value => String(value ?? '').replace(/[&<>\"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '\"':'&quot;', "'":'&#39;' }[c]));

  function weekIdFromModal() {
    const header = document.querySelector('#modalCard .k');
    const match = header?.textContent?.match(/Week\s+(\d+)\s+•\s+Evidence/i);
    return match ? String(Number(match[1])) : null;
  }

  function canonicalCriteria(weekId) {
    const criteria = canonical()?.catalog?.[weekId]?.evidence?.criteria;
    return Array.isArray(criteria) ? criteria.filter(Boolean).map(String) : [];
  }

  function injectCriteria() {
    const weekId = weekIdFromModal();
    const card = document.getElementById('modalCard');
    if (!weekId || !card) return;

    const criteria = canonicalCriteria(weekId);
    if (!criteria.length) return;

    const state = getStore()?.getState?.();
    const existing = state?.contextByWeek?.[weekId]?.evidence || null;
    let rows = Array.from(card.querySelectorAll('.rubric-row'));

    // If the base modal has no rubric rows, create the canonical rubric rather
    // than silently allowing an Evidence record to bypass its authored criteria.
    if (rows.length < criteria.length) {
      let rubric = card.querySelector('[data-canonical-evidence-rubric]');
      if (!rubric) {
        rubric = document.createElement('div');
        rubric.className = 'rubric';
        rubric.dataset.canonicalEvidenceRubric = 'true';
        const anchor = document.getElementById('canonical-ed')?.closest('label') || card.querySelector('.evidence-form') || card.firstElementChild;
        if (anchor?.parentNode) anchor.parentNode.insertBefore(rubric, anchor.nextSibling);
        else card.appendChild(rubric);
      }
      criteria.forEach((label, index) => {
        if (rubric.querySelector(`[data-evidence-criterion=\"criterion_${index + 1}\"]`)) return;
        const row = document.createElement('div');
        row.className = 'rubric-row';
        row.innerHTML = `<span>${esc(label)}</span><span class="tag"><label style="display:flex;align-items:center;gap:6px;font-weight:700"><input type="checkbox" data-evidence-criterion="criterion_${index + 1}"> Confirmed</label></span>`;
        rubric.appendChild(row);
      });
      rows = Array.from(rubric.querySelectorAll('.rubric-row'));
    }

    rows.slice(0, criteria.length).forEach((row, index) => {
      const id = `criterion_${index + 1}`;
      if (row.querySelector('[data-evidence-criterion]')) return;
      const label = row.querySelector('span:first-child')?.textContent?.trim() || criteria[index];
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

    const required = canonicalCriteria(weekId);
    const inputs = Array.from(document.querySelectorAll('#modalCard [data-evidence-criterion]'));
    if (required.length && inputs.length < required.length) {
      event.preventDefault();
      event.stopImmediatePropagation();
      alert('The Evidence rubric is still loading. Please wait a moment and try again.');
      return;
    }

    const criteria = {};
    inputs.forEach(input => { criteria[input.dataset.evidenceCriterion] = Boolean(input.checked); });
    if (required.length && !required.every((_, index) => criteria[`criterion_${index + 1}`] === true)) {
      event.preventDefault();
      event.stopImmediatePropagation();
      alert('Confirm every Evidence criterion before saving demonstrated evidence.');
      return;
    }

    const store = getStore();
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
