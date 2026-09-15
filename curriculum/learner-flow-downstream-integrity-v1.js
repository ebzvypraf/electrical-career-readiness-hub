/* Electrical Career Readiness Hub — downstream learning-flow integrity v1.1.
 * Read-only audit of canonical stage completion against Journal and Portfolio
 * projections. It does not change learner state; it verifies that the four-stage
 * engine leaves an actionable downstream trail across the Hub surfaces.
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
  const text = value => String(value ?? '').trim();

  function audit(state) {
    const issues = [];
    const progress = state?.progressByWeek || {};
    const contexts = state?.contextByWeek || {};
    const journal = Array.isArray(state?.journalEntries) ? state.journalEntries : [];
    const portfolio = Array.isArray(state?.portfolioEntries) ? state.portfolioEntries : [];

    Object.entries(progress).forEach(([weekId, p]) => {
      const entries = journal.filter(entry => String(entry?.weekId || '') === String(weekId));
      const stages = new Set(entries.map(entry => String(entry?.stage || '').toLowerCase()));
      const linkedNextActions = new Set(entries.map(entry => text(entry?.nextAction || entry?.next).toLowerCase()).filter(Boolean));
      if (p?.learn && !stages.has('learn')) issues.push(`Week ${weekId}: Learn complete without Journal projection`);
      if (p?.apply && !stages.has('apply')) issues.push(`Week ${weekId}: Apply complete without Journal projection`);
      if (p?.check && !stages.has('check')) issues.push(`Week ${weekId}: Check complete without Journal projection`);
      if (p?.evidence && !stages.has('evidence')) issues.push(`Week ${weekId}: Evidence complete without Journal projection`);
      if (p?.apply && !entries.some(entry => text(entry?.stage).toLowerCase() === 'apply' && text(entry?.nextAction || entry?.next))) issues.push(`Week ${weekId}: Apply complete without actionable Journal next step`);
      if (p?.check && !entries.some(entry => text(entry?.stage).toLowerCase() === 'check' && text(entry?.nextAction || entry?.next))) issues.push(`Week ${weekId}: Check complete without actionable Journal next step`);
      if (p?.evidence && !entries.some(entry => text(entry?.stage).toLowerCase() === 'evidence' && text(entry?.nextAction || entry?.next))) issues.push(`Week ${weekId}: Evidence complete without actionable Journal next step`);

      const check = contexts[weekId]?.assessmentResult;
      const application = contexts[weekId]?.applicationEvidence;
      const evidence = contexts[weekId]?.evidence;
      const remediation = contexts[weekId]?.remediation;
      if (p?.apply && !application) issues.push(`Week ${weekId}: Apply marked complete without application record`);
      if (p?.check && !(check?.passed && check?.completionReady)) issues.push(`Week ${weekId}: Check marked complete without passed assessment`);
      if (p?.evidence && !(evidence?.demonstrated || (evidence?.title?.trim() && evidence?.description?.trim()))) issues.push(`Week ${weekId}: Evidence marked complete without evidence record`);
      if (remediation?.status === 'complete' && !(check?.passed)) issues.push(`Week ${weekId}: remediation complete without passed Check`);

      if (p?.evidence) {
        const linkedPortfolio = portfolio.filter(entry => String(entry?.week ?? '') === String(weekId));
        if (!linkedPortfolio.length) {
          issues.push(`Week ${weekId}: Evidence complete without Portfolio entry`);
        } else {
          const hasProvenance = linkedPortfolio.some(entry => {
            const chain = entry?.proofChain || {};
            const linkedEvidence = chain.evidence || {};
            return Boolean(text(linkedEvidence.title) || text(entry?.evidenceTitle) || text(entry?.title));
          });
          if (!hasProvenance) issues.push(`Week ${weekId}: Portfolio entry exists but lacks evidence provenance`);
        }
      }
    });

    const orphanJournal = journal.filter(entry => entry?.weekId && !progress[String(entry.weekId)]);
    const orphanPortfolio = portfolio.filter(entry => entry?.week != null && !progress[String(entry.week)]);
    orphanJournal.forEach(entry => issues.push(`Journal entry ${entry.id || 'unnamed'} points to missing Week ${entry.weekId}`));
    orphanPortfolio.forEach(entry => issues.push(`Portfolio entry ${entry.id || 'unnamed'} points to missing Week ${entry.week}`));

    return { ok: issues.length === 0, issues, checkedWeeks: Object.keys(progress).length, journalNextActionCount: journal.filter(entry => text(entry?.nextAction || entry?.next)).length };
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
    panel.innerHTML = `<div class="k">Engineering validation</div><h2>Downstream Learning Trail</h2><p class="muted">Read-only audit that completed canonical stages leave the expected Journal and Portfolio trail, including actionable next steps and evidence provenance.</p><div class="goal"><b>${report.ok ? 'PASS' : 'ATTENTION REQUIRED'} — ${report.checkedWeeks} weeks checked</b><small>${report.ok ? `Canonical completion and downstream projections are aligned. ${report.journalNextActionCount} Journal next-action records found.` : `${report.issues.length} issue${report.issues.length === 1 ? '' : 's'} detected.`}</small></div>${report.issues.length ? `<div class="history" style="margin-top:10px">${report.issues.slice(0, 12).map(issue => `<div class="goal"><b>✕</b><small>${esc(issue)}</small></div>`).join('')}</div>` : ''}<small class="muted">Read-only diagnostic. Last checked: ${esc(new Date().toLocaleString())}</small>`;
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
