/* Electrical Career Readiness Hub — evidence provenance UI v1.
 * Makes the Learn -> Apply -> Check -> Evidence chain visible in Portfolio.
 * This is presentation-only: canonical state and evidence gates remain authoritative.
 */
(function () {
  'use strict';

  const esc = value => String(value ?? '').replace(/[&<>\"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '\"':'&quot;', "'":'&#39;' }[c]));
  const canonical = () => window.ECRHCanonical;
  const getState = () => {
    try { return canonical()?.store?.()?.getState?.() || null; } catch (_) { return null; }
  };

  function render() {
    const state = getState();
    const grid = document.getElementById('portfolioGrid');
    if (!state || !grid) return;
    const contexts = state.contextByWeek || {};
    grid.querySelectorAll('[data-evidence-provenance]').forEach(node => node.remove());

    grid.querySelectorAll('.evidence').forEach(card => {
      const pill = card.querySelector('.pill');
      const match = pill?.textContent?.match(/Week\s+(\d+)/i);
      if (!match) return;
      const weekId = String(Number(match[1]));
      const ctx = contexts[weekId] || {};
      const apply = ctx.applicationEvidence;
      const check = ctx.assessmentResult;
      const remediation = ctx.remediation;
      const evidence = ctx.evidence;
      if (!apply && !check && !evidence) return;

      const recovery = evidence?.recoveryProvenance || (check?.passed && remediation?.status === 'complete' ? { recovered: true, attempts: 0, recoveredConcepts: remediation?.concepts || [] } : null);
      const recoveryMarkup = recovery?.recovered
        ? `<div class="rubric-row"><span>Recovery provenance</span><span class="pill ok">Recovered${recovery.attempts > 1 ? ` after ${esc(recovery.attempts)} attempts` : ''}</span></div>${recovery.recoveredConcepts?.length ? `<div class="muted" style="margin-top:6px">Reinforced: ${esc(recovery.recoveredConcepts.join(', '))}</div>` : ''}`
        : '';
      const node = document.createElement('div');
      node.dataset.evidenceProvenance = 'true';
      node.style.marginTop = '9px';
      node.innerHTML = `<div class="rubric"><div class="rubric-row"><span>Apply record</span><span class="pill ${apply?.tasksComplete ? 'ok' : ''}">${apply?.tasksComplete ? 'Completed' : 'Not recorded'}</span></div><div class="rubric-row"><span>Knowledge Check</span><span class="pill ${check?.passed ? 'ok' : ''}">${check?.passed ? `Passed${check.percentage != null ? ` (${esc(check.percentage)}%)` : ''}` : 'Not passed'}</span></div>${remediation ? `<div class="rubric-row"><span>Remediation</span><span class="pill ${recovery?.recovered ? 'ok' : ''}">${recovery?.recovered ? 'Recovered' : esc(remediation.status || 'Active')}</span></div>` : ''}${recoveryMarkup}<div class="rubric-row"><span>Evidence gate</span><span class="pill ${evidence?.demonstrated ? 'ok' : ''}">${evidence?.demonstrated ? 'Demonstrated' : 'Recorded'}</span></div></div>`;
      card.appendChild(node);
    });
  }

  const schedule = () => setTimeout(render, 0);
  new MutationObserver(schedule).observe(document.documentElement, { subtree: true, childList: true, characterData: true });
  document.addEventListener('click', schedule, true);
  document.addEventListener('DOMContentLoaded', schedule, { once: true });
})();
