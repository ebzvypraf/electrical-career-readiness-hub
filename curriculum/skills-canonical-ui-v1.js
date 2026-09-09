/* Electrical Career Readiness Hub — canonical Skills UI bridge v1.
 * Keeps the learner-facing Skills page bound to the same canonical store that
 * powers Course, Home, Journal and Portfolio.
 */
(function () {
  'use strict';

  function getStore() {
    const api = typeof window !== 'undefined' ? window.ECRHCanonical : null;
    if (!api) return null;
    const store = typeof api.store === 'function' ? api.store() : api.store;
    return store && typeof store.getState === 'function' ? store : null;
  }

  function esc(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
  }

  function render() {
    const host = document.getElementById('skills');
    if (!host) return;
    const store = getStore();
    if (!store) return;
    const state = store.getState();
    const signals = state?.hubSignals || {};
    const skills = Array.isArray(signals.skills) ? signals.skills : [];
    if (!skills.length) {
      host.innerHTML = '<div class="empty">Complete learning activities to build your canonical competency profile.</div>';
      return;
    }

    host.innerHTML = skills.map(item => {
      const coverage = item.coverage || {};
      const recommendation = item.recommendedWeekId && item.recommendedStageLabel
        ? `Next focus: Week ${esc(item.recommendedWeekId)} • ${esc(item.recommendedStageLabel)}`
        : 'All currently unlocked stages are complete for this skill.';
      return `<div class="skillrow">
        <div class="skillhead"><b>${esc(item.skill)}</b><strong>${Number(item.readiness || 0)}%</strong></div>
        <div class="bar"><span style="width:${Math.max(0, Math.min(100, Number(item.readiness || 0)))}%"></span></div>
        <div class="muted">Learn ${Number(coverage.learn || 0)}% · Apply ${Number(coverage.apply || 0)}% · Check ${Number(coverage.check || 0)}% · Evidence ${Number(coverage.evidence || 0)}%</div>
        <div class="muted">Evidence quality ${Number(item.evidenceQuality || 0)}% · Journal coverage ${Number(item.journalCoverage || 0)}%</div>
        <small>${esc(recommendation)}</small>
      </div>`;
    }).join('');
  }

  function attach() {
    const store = getStore();
    if (!store) return false;
    render();
    if (!window.__ECRHSkillsCanonicalBound) {
      window.__ECRHSkillsCanonicalBound = true;
      store.subscribe(() => render());
    }
    return true;
  }

  if (typeof document === 'undefined') return;
  const timer = setInterval(() => { if (attach()) clearInterval(timer); }, 250);
  setTimeout(() => clearInterval(timer), 15000);
  document.addEventListener('click', event => {
    if (event.target?.closest?.('[data-page="skills"]')) setTimeout(render, 0);
  });
})();
