/* Electrical Career Readiness Hub — Evidence UI enhancer v1.
 * Adds the canonical evidence rubric/reflection fields to the existing Course modal
 * without replacing the production shell or legacy UI adapter.
 */
import './portfolio-review-enhancer-v1.js';

(function () {
  'use strict';
  function text(value) { return String(value == null ? '' : value).trim(); }
  function esc(value) { return text(value).replace(/[&<>\"']/g, function (char) { return ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '\"':'&quot;', "'":'&#39;' }[char]); }); }
  function root() { return typeof window !== 'undefined' ? window : null; }
  function api() { return root() && root().ECRHCanonical; }
  function getStore() { const canonical = api(); return typeof canonical?.store === 'function' ? canonical.store() : canonical?.store || null; }
  function currentWeek() { const card = document.getElementById('modalCard'); const marker = card && card.querySelector('.k'); const match = marker && text(marker.textContent).match(/Week\s+(\d+)/i); return match ? Number(match[1]) : null; }
  function evidenceContext(week) { const store = getStore(); return store && store.getState ? (store.getState().contextByWeek?.[String(week)]?.evidence || {}) : {}; }
  function weekContext(week) { const store = getStore(); return store && store.getState ? (store.getState().contextByWeek?.[String(week)] || {}) : {}; }
  function time(value) { const n = Date.parse(value || ''); return Number.isFinite(n) ? n : null; }
  function isStaleEvidence(week, evidence) {
    const ctx = weekContext(week); const captured = time(evidence?.capturedAt || evidence?.date);
    if (captured == null) return false;
    const apply = time(ctx?.applicationEvidence?.capturedAt);
    const check = time(ctx?.assessmentResult?.date);
    return [apply, check].some(value => value != null && value > captured);
  }

  function enhance() {
    const card = document.getElementById('modalCard');
    if (!card || !document.getElementById('canonical-save-evidence') || card.dataset.evidenceEnhanced === '1') return;
    const week = currentWeek(); const canonical = api(); const module = canonical && canonical.catalog && canonical.catalog[String(week)];
    const criteria = Array.isArray(module?.evidence?.criteria) ? module.evidence.criteria : []; const existing = evidenceContext(week) || {};
    const anchor = document.getElementById('canonical-ed'); const form = anchor && anchor.closest('.evidence-form'); if (!form) return;
    const block = document.createElement('div'); block.className = 'evidence-form'; block.id = 'canonical-evidence-quality';
    const stale = isStaleEvidence(week, existing);
    block.innerHTML = (stale ? '<div class="result warn"><b>Evidence needs recapture.</b><p>This saved Evidence is older than a later Apply or Check result. The previous proof remains in history, but it cannot represent the latest learning state until you capture it again.</p></div>' : '') +
      '<div class="learning-card"><h3>Evidence quality</h3>' +
      '<p class="muted">Connect the proof to the practical Apply decision and the Check learning result. High-quality evidence shows the chain, not only the final artifact.</p>' +
      (criteria.length ? '<div class="rubric">' + criteria.map(function (label, index) { const id = 'criterion_' + (index + 1); const checked = existing[id] === true || existing[id] === 'true'; return '<label class="rubric-row" style="cursor:pointer;gap:10px;align-items:flex-start"><span style="display:flex;gap:8px;align-items:flex-start"><input type="checkbox" id="' + id + '" ' + (checked ? 'checked' : '') + '> <span>' + (index + 1) + '. ' + esc(label) + '</span></span><span class="tag">Required</span></label>'; }).join('') + '</div>' : '<div class="saved">No additional rubric criteria are defined for this week.</div>') +
      '<label>Apply decision / artifact link<textarea id="canon-eal" placeholder="Which Apply decision, deliverable, or verification does this Evidence prove?">' + esc(existing.applyLink || '') + '</textarea></label>' +
      '<label>Check / recovery link<textarea id="canon-ecl" placeholder="Which Check concept or recovered question does this Evidence demonstrate?">' + esc(existing.checkLink || '') + '</textarea></label>' +
      '<label>Reflection<textarea id="canon-er" placeholder="What did you learn, decide, or improve through this evidence?">' + esc(existing.reflection || '') + '</textarea></label>' +
      '<label>Next action<textarea id="canon-ena" placeholder="What will you do next to strengthen or apply this capability?">' + esc(existing.nextAction || '') + '</textarea></label>' +
      '<p class="muted">Evidence can still be demonstrated when the core rubric is satisfied, but it is rated <strong>high</strong> only when both learning links are explicitly recorded.</p>' +
      '</div>';
    form.insertBefore(block, document.getElementById('canonical-save-evidence')); card.dataset.evidenceEnhanced = '1';
  }

  function capture(event) {
    const target = event.target && event.target.closest ? event.target.closest('#canonical-save-evidence') : null; if (!target) return;
    const store = getStore(); if (!store || typeof store.captureEvidence !== 'function') return;
    enhance(); const week = currentWeek(); if (!week) return;
    const titleEl = document.getElementById('canonical-et'); const descriptionEl = document.getElementById('canonical-ed'); const title = text(titleEl && titleEl.value); const description = text(descriptionEl && descriptionEl.value); if (!title || !description) return;
    event.preventDefault(); event.stopImmediatePropagation();
    const input = { weekId: String(week), title, description, applyLink: text(document.getElementById('canon-eal')?.value), checkLink: text(document.getElementById('canon-ecl')?.value), reflection: text(document.getElementById('canon-er')?.value), nextAction: text(document.getElementById('canon-ena')?.value), date: new Date().toISOString() };
    const module = api()?.catalog?.[String(week)]; const criteria = Array.isArray(module?.evidence?.criteria) ? module.evidence.criteria : [];
    criteria.forEach(function (_, index) { const checkbox = document.getElementById('criterion_' + (index + 1)); input['criterion_' + (index + 1)] = Boolean(checkbox && checkbox.checked); });
    const result = store.captureEvidence(input); if (!result.ok) { window.alert(result.reason || 'Evidence could not be captured.'); return; }
    const modal = document.getElementById('modal'); if (modal) modal.classList.remove('show');
  }

  function init() { if (typeof document === 'undefined') return; document.addEventListener('click', capture, true); const observer = new MutationObserver(enhance); observer.observe(document.body, { childList: true, subtree: true }); enhance(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
