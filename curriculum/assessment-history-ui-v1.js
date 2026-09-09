/* Electrical Career Readiness Hub — Check attempt history UI v3.
 * Makes assessment recovery visible without changing grading or progression rules.
 * Uses persisted per-attempt recovery state so historical failures do not
 * incorrectly label later ordinary passes as recovered.
 */
(function () {
  'use strict';
  const KEY = 'ecrh-assessment-history-ui-v1';
  const esc = v => String(v ?? '').replace(/[&<>\"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '\"':'&quot;', "'":'&#39;' }[c]));
  function api() { return typeof window !== 'undefined' ? window.ECRHCanonical : null; }
  function store() {
    try {
      const candidate = api()?.store;
      return typeof candidate === 'function' ? candidate() : candidate || null;
    } catch (_) { return null; }
  }
  function state() { try { return store()?.getState?.() || null; } catch (_) { return null; } }
  function weekFromModal() {
    const text = document.querySelector('#modalCard .k')?.textContent || '';
    const m = text.match(/Week\s+(\d+)\s+•\s+Check/i);
    return m ? String(Number(m[1])) : null;
  }
  function render() {
    const card = document.getElementById('modalCard');
    if (!card || !/Week\s+\d+\s+•\s+Check/i.test(card.querySelector('.k')?.textContent || '')) return;
    card.querySelector(`#${KEY}`)?.remove();
    const week = weekFromModal();
    const ctx = state()?.contextByWeek?.[week];
    const history = Array.isArray(ctx?.assessmentHistory) ? ctx.assessmentHistory : (Array.isArray(ctx?.assessmentResult?.assessmentHistory) ? ctx.assessmentResult.assessmentHistory : []);
    if (!history.length) return;
    const remediation = ctx?.remediation || null;
    const latest = history[history.length - 1];
    const hasPersistedRecovery = history.some(a => typeof a?.recovered === 'boolean');
    const recovered = hasPersistedRecovery ? latest?.recovered === true : Boolean(latest?.passed && history.slice(0, -1).some(a => a?.passed === false));
    const rows = history.slice().reverse().map((a, i) => {
      const missed = Array.isArray(a?.missedQuestionIds) ? a.missedQuestionIds.length : 0;
      const recoveredAttempt = a?.recovered === true || (!hasPersistedRecovery && i === 0 && recovered);
      const label = a?.passed ? (recoveredAttempt ? 'Recovered pass' : 'Pass') : 'Not passed';
      return `<div class="rubric-row"><span><b>Attempt ${esc(a?.attemptNumber || history.length - i)}</b> — ${esc(label)}<small style="display:block;color:var(--muted)">${esc(a?.score ?? 0)}/${esc(a?.total ?? 0)}${a?.percentage != null ? ` (${esc(a.percentage)}%)` : ''} · ${esc(a?.date || 'undated')}${missed ? ` · ${missed} missed` : ''}</small></span><span class="pill ${a?.passed ? 'ok' : ''}">${a?.passed ? 'Passed' : 'Review'}</span></div>`;
    }).join('');
    const note = recovered
      ? 'This Check was passed after an earlier failed attempt. The recovery is retained as part of your learning trail.'
      : remediation?.status === 'ready-to-retry'
        ? 'Targeted reinforcement is complete. Retry is unlocked.'
        : history.some(a => a?.passed === false) && remediation?.status !== 'complete'
          ? 'A previous attempt needs targeted reinforcement before another retry.'
          : 'Your assessment trail is recorded here for review.';
    const box = document.createElement('div');
    box.id = KEY;
    box.className = 'learning-card';
    box.style.marginTop = '12px';
    box.innerHTML = `<h3>Assessment trail</h3><p class="muted">${esc(note)}</p><div class="rubric">${rows}</div>`;
    const result = card.querySelector('#canonical-check-bridge-result, .result');
    (result || card.querySelector('#canon-score'))?.before(box);
  }
  function boot() {
    if (typeof document === 'undefined') return;
    const observer = new MutationObserver(() => render());
    observer.observe(document.body, { childList: true, subtree: true });
    document.addEventListener('click', () => setTimeout(render, 0), true);
    setTimeout(render, 250);
  }
  boot();
})();
