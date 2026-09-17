/* Electrical Career Readiness Hub — Learn active-recall enhancer v1.0.
 * Adds a lightweight learner-generated takeaway to the Learn stage and requires
 * that takeaway before Learn can be completed. The canonical store remains the
 * persistence boundary; no parallel progress state is introduced.
 */
(function () {
  'use strict';
  const text = value => String(value == null ? '' : value).trim();
  const esc = value => text(value).replace(/[&<>\"']/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '\"':'&quot;', "'":'&#39;' }[char]));
  const root = () => typeof window !== 'undefined' ? window : null;
  const api = () => root()?.ECRHCanonical || null;
  const store = () => { const a = api(); return typeof a?.store === 'function' ? a.store() : a?.store || null; };
  const currentWeek = () => { const marker = document.querySelector('#modalCard .k'); const match = marker && text(marker.textContent).match(/Week\s+(\d+)/i); return match ? Number(match[1]) : null; };
  const currentStage = () => { const marker = document.querySelector('#modalCard .k'); const match = marker && text(marker.textContent).match(/•\s*(Learn|Apply|Check|Evidence)/i); return match ? match[1].toLowerCase() : null; };
  function context(week) { const s = store(); return s?.getState ? (s.getState().contextByWeek?.[String(week)] || {}) : {}; }
  function enhance() {
    if (currentStage() !== 'learn') return;
    const card = document.getElementById('modalCard'); const week = currentWeek(); const s = store();
    if (!card || !week || !s) return;
    const ctx = context(week); let block = document.getElementById('canonical-learn-recall');
    if (!block) { block = document.createElement('div'); block.id = 'canonical-learn-recall'; block.className = 'learning-card'; const anchor = document.getElementById('canonical-learn-gate') || card.querySelector('.learning-hero'); if (anchor?.parentNode) anchor.parentNode.insertBefore(block, anchor.nextSibling); else card.appendChild(block); }
    const saved = text(ctx.learnTakeaway || '');
    block.innerHTML = '<h3>Active-recall checkpoint</h3><p class="muted">Before marking Learn complete, explain the most important idea in your own words. This creates a traceable learning signal without requiring a quiz.</p><label>Your takeaway<textarea id="canonical-learn-takeaway" placeholder="In your own words: what is the most important thing you learned, and why does it matter for the Apply task?"></textarea></label><button type="button" class="btn" id="canonical-save-learn-takeaway">Save learning takeaway</button><span class="tag" style="margin-left:8px">Required for Learn completion</span>';
    const input = document.getElementById('canonical-learn-takeaway'); if (input) input.value = saved;
    const save = document.getElementById('canonical-save-learn-takeaway');
    if (save) save.onclick = () => { const value = text(input?.value); if (!value) { window.alert('Add a short takeaway in your own words before saving.'); return; } const result = s.updateStageContext(week, { learnTakeaway: value, learnReviewedAt: new Date().toISOString() }); if (!result?.ok) window.alert(result?.reason || 'Learning takeaway could not be saved.'); else enhance(); };
  }
  function installGate() {
    const a = api(); if (!a || a.__learnRecallGateInstalled) return Boolean(a);
    const original = typeof window.ECRH?.complete === 'function' ? window.ECRH.complete : null; if (!original) return false;
    window.ECRH.complete = function guardedComplete(index, stageIndex) {
      if (Number(stageIndex) === 0) {
        const week = Number(index) + 1; const takeaway = text(context(week).learnTakeaway); if (!takeaway) { enhance(); window.alert('Complete the active-recall checkpoint before marking Learn complete.'); return; }
      }
      return original.apply(this, arguments);
    };
    a.__learnRecallGateInstalled = true;
    return true;
  }
  function boot() { enhance(); installGate(); }
  if (typeof document !== 'undefined') { const observer = new MutationObserver(boot); observer.observe(document.body, { childList: true, subtree: true }); if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true }); else boot(); }
})();
