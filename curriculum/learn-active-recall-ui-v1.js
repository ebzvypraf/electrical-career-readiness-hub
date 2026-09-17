/* Electrical Career Readiness Hub — Learn active-recall enhancer v1.3.
 * Adds a lightweight learner-generated takeaway to the Learn stage and requires
 * a substantive takeaway before Learn can be completed. The canonical store
 * remains the persistence boundary; no parallel progress state is introduced.
 * v1.3 autosaves the active-recall response while the learner types so closing
 * or leaving the stage does not discard substantive learning work.
 */
(function () {
  'use strict';
  const MIN_CHARS = 40;
  const AUTOSAVE_DELAY = 700;
  const text = value => String(value == null ? '' : value).trim();
  const esc = value => text(value).replace(/[&<>\"']/g, char => ({ '&':'&lt;', '<':'&lt;', '>':'&gt;', '\"':'&quot;', "'":'&#39;' }[char]));
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
    block.innerHTML = '<h3>Active-recall checkpoint</h3><p class="muted">Before marking Learn complete, explain the most important idea in your own words and connect it to the Apply task. A substantive response helps turn reading into a usable reasoning trace.</p><label>Your takeaway<textarea id="canonical-learn-takeaway" minlength="' + MIN_CHARS + '" placeholder="In your own words: what is the most important thing you learned, why does it matter, and how will it affect the Apply task?">' + esc(saved) + '</textarea></label><div id="canonical-learn-recall-status" class="muted" style="margin-top:6px;font-size:12px" role="status" aria-live="polite"></div><button type="button" class="btn" id="canonical-save-learn-takeaway">Save learning takeaway</button><span class="tag" style="margin-left:8px">Required for Learn completion</span>';
    const input = document.getElementById('canonical-learn-takeaway');
    const status = document.getElementById('canonical-learn-recall-status');
    const save = document.getElementById('canonical-save-learn-takeaway');
    let autosaveTimer = null;
    let lastSaved = saved;
    const updateStatus = () => {
      const count = text(input?.value).length;
      if (status) status.textContent = count >= MIN_CHARS
        ? `${count} characters — ${lastSaved === text(input?.value) ? 'saved and ready to complete.' : 'ready; saving automatically...'}`
        : `${count}/${MIN_CHARS} characters — explain the idea, why it matters, and its effect on the Apply task.`;
    };
    const persist = (silent = false) => {
      const value = text(input?.value);
      if (!value || value === lastSaved) { updateStatus(); return true; }
      const result = s.updateStageContext(week, { learnTakeaway: value, learnReviewedAt: new Date().toISOString() });
      if (result?.ok) {
        lastSaved = value;
        if (!silent && status) status.textContent = 'Saved learning takeaway.';
      } else if (status) status.textContent = 'Could not save the learning takeaway yet.';
      updateStatus();
      return Boolean(result?.ok);
    };
    const queueAutosave = () => {
      clearTimeout(autosaveTimer);
      autosaveTimer = setTimeout(() => persist(true), AUTOSAVE_DELAY);
    };
    input?.addEventListener('input', () => { updateStatus(); queueAutosave(); });
    input?.addEventListener('blur', () => { clearTimeout(autosaveTimer); persist(true); });
    updateStatus();
    if (save) save.onclick = () => {
      clearTimeout(autosaveTimer);
      const value = text(input?.value);
      if (value.length < MIN_CHARS) { window.alert(`Expand your takeaway to at least ${MIN_CHARS} characters so it captures an idea and its application.`); input?.focus?.(); return; }
      if (persist(false)) enhance();
    };
  }
  function installGate() {
    const a = api(); if (!a || a.__learnRecallGateInstalled) return Boolean(a);
    const original = typeof window.ECRH?.complete === 'function' ? window.ECRH.complete : null; if (!original) return false;
    window.ECRH.complete = function guardedComplete(index, stageIndex) {
      if (Number(stageIndex) === 0) {
        const week = Number(index) + 1; const takeaway = text(context(week).learnTakeaway); if (takeaway.length < MIN_CHARS) { enhance(); window.alert(`Complete the active-recall checkpoint with at least ${MIN_CHARS} characters before marking Learn complete.`); return; }
      }
      return original.apply(this, arguments);
    };
    a.__learnRecallGateInstalled = true;
    return true;
  }
  function boot() { enhance(); installGate(); }
  if (typeof document !== 'undefined') { const observer = new MutationObserver(boot); observer.observe(document.body, { childList: true, subtree: true }); if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true }); else boot(); }
})();
