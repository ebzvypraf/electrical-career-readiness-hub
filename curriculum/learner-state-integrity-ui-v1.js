/* Electrical Career Readiness Hub — learner state integrity UI v1.
 * Read-only production diagnostic for persisted learner progress.
 * Detects impossible stage states and prerequisite violations without mutating state.
 */
(function () {
  'use strict';

  const esc = value => String(value ?? '').replace(/[&<>\"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '\"':'&quot;', "'":'&#39;' }[c]));

  function inspect() {
    const store = window.ECRHCanonical?.store?.();
    const state = store?.getState?.();
    if (!state) throw new Error('Canonical learning state is not available.');

    const issues = [];
    const rows = [];
    for (let week = 1; week <= 24; week += 1) {
      const id = String(week);
      const progress = state.progressByWeek?.[id] || {};
      const context = state.contextByWeek?.[id] || {};
      const remediation = context.remediation || null;
      const check = context.assessmentResult || null;
      const apply = context.applicationEvidence || null;
      const done = ['learn', 'apply', 'check', 'evidence'].filter(stage => Boolean(progress[stage]));
      const prerequisiteViolations = [];

      if (progress.apply && !progress.learn) prerequisiteViolations.push('Apply without Learn');
      if (progress.check && !progress.apply) prerequisiteViolations.push('Check without Apply');
      if (progress.evidence && !progress.check) prerequisiteViolations.push('Evidence without Check');
      if (week > 1 && progress.learn && !state.progressByWeek?.[String(week - 1)]?.evidence) prerequisiteViolations.push('Learn unlocked before prior Evidence');
      if (progress.apply && !apply) prerequisiteViolations.push('Apply marked complete without application record');
      if (progress.check && !check?.passed) prerequisiteViolations.push('Check marked complete without passed assessment');
      if (progress.evidence && (!apply || !check?.passed)) prerequisiteViolations.push('Evidence marked complete without Apply + passed Check');
      if (remediation?.status === 'complete' && !check?.passed) prerequisiteViolations.push('Remediation complete without a passed Check');
      if (remediation?.status === 'ready-to-retry' && check?.passed) prerequisiteViolations.push('Retry-ready remediation remains after a passed Check');

      prerequisiteViolations.forEach(issue => issues.push({ week, issue }));
      rows.push({ week, completed: done.length, remediation: remediation?.status || '—', check: check ? (check.passed ? 'passed' : 'failed') : '—', issues: prerequisiteViolations.length });
    }

    return {
      issues,
      rows,
      clean: issues.length === 0,
      completedStages: Object.values(state.progressByWeek || {}).reduce((sum, progress) => sum + ['learn', 'apply', 'check', 'evidence'].filter(stage => Boolean(progress?.[stage])).length, 0)
    };
  }

  function render(result, error) {
    const settings = document.getElementById('settings');
    if (!settings) return;
    let card = settings.querySelector('[data-state-integrity]');
    if (!card) {
      card = document.createElement('div');
      card.dataset.stateIntegrity = 'true';
      card.className = 'card s12';
      settings.querySelector('.grid')?.appendChild(card);
    }
    if (error) {
      card.innerHTML = '<div class="k">Learner state integrity</div><h2>Diagnostic unavailable</h2><div class="result warn">The persisted canonical learning state could not be inspected. No learning state was changed.</div>';
      return;
    }

    const flagged = result.rows.filter(row => row.issues > 0);
    card.innerHTML = `<div class="k">Learner state integrity</div><h2>${result.clean ? 'Progress state is internally consistent' : 'Progress state needs attention'}</h2><div class="metrics"><div class="metric"><small>Stage records</small><b>${result.completedStages}/96</b></div><div class="metric"><small>Weeks checked</small><b>24/24</b></div><div class="metric"><small>Violations</small><b>${result.issues.length}</b></div><div class="metric"><small>State mode</small><b>Read-only</b></div></div><div class="result ${result.clean ? '' : 'warn'}" style="margin-top:12px"><b>${result.clean ? 'No impossible prerequisite states detected.' : 'Review the flagged weeks before final release.'}</b>${result.issues.length ? `<ul>${result.issues.map(item => `<li>Week ${esc(item.week)} — ${esc(item.issue)}</li>`).join('')}</ul>` : '<div>The stored learner state respects Learn → Apply → Check → Evidence prerequisites and remediation consistency.</div>'}</div><small class="muted">Checked ${esc(new Date().toLocaleString())}. This diagnostic never changes learner progress.</small>`;
  }

  function run() {
    try { render(inspect(), null); }
    catch (error) { render(null, error); }
  }

  const boot = () => setTimeout(run, 0);
  document.addEventListener('DOMContentLoaded', boot, { once: true });
  document.addEventListener('click', event => {
    if (event.target?.dataset?.page === 'settings') setTimeout(run, 75);
  }, true);
})();
