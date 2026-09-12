/* Electrical Career Readiness Hub — canonical UI entrypoint v13.
 * Keep the stable production entrypoint and add the missing failed-Check
 * reinforcement interaction on top of the canonical Course runtime.
 */
(async function () {
  'use strict';
  try {
    await import('./canonical-course-runtime-v1.js');
    await import('./canonical-shell-bridge-v1.js');
    const started = Date.now();
    while (!window.ECRHCanonical?.openStage && Date.now() - started < 5000) await new Promise(r => setTimeout(r, 50));
    const originalOpenStage = window.ECRHCanonical?.openStage;
    if (!originalOpenStage) return;
    window.ECRHCanonical.openStage = function (weekId, stage) {
      originalOpenStage(weekId, stage);
      if (stage !== 'check') return;
      setTimeout(() => {
        const store = window.ECRHCanonical?.store;
        const context = store?.getState?.()?.contextByWeek?.[String(weekId)] || {};
        const remediation = context.remediation;
        const card = document.getElementById('modalCard');
        const button = document.getElementById('canonicalCheck');
        if (!card || !button || !context.assessmentResult || context.assessmentResult.passed || !remediation || remediation.status === 'complete') return;
        if (document.getElementById('adapterRemediation')) return;
        const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
        const concepts = Array.isArray(remediation.concepts) && remediation.concepts.length ? remediation.concepts : ['the failed Check items'];
        const actions = Array.isArray(remediation.actions) && remediation.actions.length ? remediation.actions : ['Review the missed concepts and explain the correct senior-level reasoning in your own words.'];
        const panel = document.createElement('div');
        panel.id = 'adapterRemediation';
        panel.style.cssText = 'margin-top:12px;border:1px solid #fed7aa;background:#fffaf5;border-radius:11px;padding:12px';
        panel.innerHTML = `<h3 style="margin:0 0 6px">Targeted reinforcement required</h3><p class="muted">The latest Check was not passed. Complete the targeted reinforcement before retrying.</p><p><b>Focus:</b> ${concepts.map(esc).join(', ')}</p><ol>${actions.map(x => `<li>${esc(x)}</li>`).join('')}</ol><label style="display:block;font-size:12px;font-weight:800">Reinforcement note<textarea id="adapterRemediationNotes" placeholder="What did you review, what changed in your reasoning, and how did you verify it?"></textarea></label><button class="btn primary" id="adapterCompleteRemediation">Complete reinforcement & unlock retry</button>`;
        button.before(panel);
        document.getElementById('adapterCompleteRemediation').onclick = () => {
          const notes = document.getElementById('adapterRemediationNotes')?.value.trim() || '';
          if (!notes) return alert('Add a short reinforcement note before retrying the Check.');
          const current = store.getState()?.contextByWeek?.[String(weekId)] || {};
          if (current.remediation?.status === 'required') {
            const start = store.startRemediation(weekId);
            if (!start.ok) return alert(start.reason || 'Could not start reinforcement.');
          }
          const done = store.completeRemediation({ weekId: String(weekId), notes });
          if (!done.ok) return alert(done.reason || 'Reinforcement could not be completed.');
          document.getElementById('canonicalClose')?.click();
          setTimeout(() => window.ECRHCanonical.openStage(String(weekId), 'check'), 0);
        };
        button.disabled = true;
        button.textContent = 'Complete reinforcement first';
      }, 0);
    };
  } catch (error) {
    console.error('[ECRH canonical UI]', error);
  }
})();
