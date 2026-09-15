/* Electrical Career Readiness Hub — downstream learning-flow integrity v1.
 * Read-only audit of canonical stage completion against Journal and Portfolio
 * projections. It does not change learner state; it verifies that the four-stage
 * engine leaves the expected downstream trail across the Hub surfaces.
 */
(function () {
  'use strict';

  const esc = value => String(value ?? '').replace(/[&<>\"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '\"':'&quot;', "'":'&#39;' }[c]));
  const getStore = () => {
    try {
      const candidate = window.ECRHCanonical?.store;
      return typeof candidate === 'function' ? candidate() : candidate || null;
    } catch (_) { return null; }
  };

  function audit(state) {
    const issues = [];
    const progress = state?.progressByWeek || {};
    const journal = Array.isArray(state?.journalEntries) ? state.journalEntries : [];
    const portfolio = Array.isArray(state?.portfolioEntries) ? state.portfolioEntries : [];

    Object.entries(progress).forEach(([weekId, p]) => {
      const entries = journal.filter(entry => String(entry?.weekId || '') === String(weekId));
      const stages = new Set(entries.map(entry => String(entry?.stage || '').toLowerCase()));
      if (p?.learn && !stages.has('learn')) issues.push(`Week ${weekId}: Learn complete without Journal projection`);
      if (p?.apply && !stages.has('apply')) issues.push(`Week ${weekId}: Apply complete without Journal projection`);
      if (p?.check && !stages.has('check')) issues.push(`Week ${weekId}: Check complete without Journal projection`);
      if (p?.evidence && !stages.has('evidence')) issues.push(`Week ${weekId}: Evidence complete without Journal projection`);
      if (p?.evidence) {
        const linkedPortfolio = portfolio.filter(entry => String(entry?.week ?? '') === String(weekId));
        if (!linkedPortfolio.length) issues.push(`Week ${weekId}: Evidence complete without Portfolio entry`);
      }
    });

    const orphanJournal = journal.filter(entry => entry?.weekId && !progress[String(entry.weekId)]);
    const orphanPortfolio = portfolio.filter(entry => entry?.week != null && !progress[String(entry.week)]);
    orphanJournal.forEach(entry => issues.push(`Journal entry ${entry.id || 'unnamed'} points to missing Week ${entry.weekId}`));
    orphanPortfolio.forEach(entry => issues.push(`Portfolio entry ${entry.id || 'unnamed'} points to missing Week ${entry.week}`));

    return { ok: issues.length === 0, issues, checkedWeeks: Object.keys(progress).length };
  }

  function render() {
    const settings = document.getElementById('settings');
    const store = getStore();
    if (!settings || !store?.getState) return;
    const report = audit(store.getState());
    let panel = document.getElementById('learner-flow-downstream-integrity');
    if (!panel) {
      panel = document.createElement('div');
      panel.id = 'learner-flow-downstream-integrity';
      panel.className = 'card s12';
      const grid = settings.querySelector('.grid');
      (grid || settings).appendChild(panel);
    }
    panel.innerHTML = `<div class="k">Engineering validation</div><h2>Downstream Learning Trail</h2><p class="muted">Read-only audit that completed canonical stages leave the expected Journal and Portfolio trail, with no orphan records.</p><div class="goal"><b>${report.ok ? 'PASS' : 'ATTENTION REQUIRED'} — ${report.checkedWeeks} weeks checked</b><small>${report.ok ? 'Canonical completion and downstream projections are aligned.' : `${report.issues.length} issue${report.issues.length === 1 ? '' : 's'} detected.`}</small></div>${report.issues.length ? `<div class="history" style="margin-top:10px">${report.issues.slice(0, 12).map(issue => `<div class="goal"><b>✕</b><small>${esc(issue)}</small></div>`).join('')}</div>` : ''}<small class="muted">Read-only diagnostic. Last checked: ${esc(new Date().toLocaleString())}</small>`;
  }

  function boot() {
    const store = getStore();
    if (!store) { setTimeout(boot, 250); return; }
    render();
    store.subscribe(() => setTimeout(render, 0));
    new MutationObserver(render).observe(document.body, { childList: true, subtree: true });
  }

  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
    else boot();
  }

  if (typeof window !== 'undefined') window.ECRHDownstreamLearningIntegrity = { audit };
})();
