/* Electrical Career Readiness Hub — canonical UI entrypoint v22.0.
 * Keep the stable production entrypoint and install the proof-backed capability
 * read model at the canonical store boundary before downstream surfaces render it.
 * v20.1 prevents duplicate remediation panels when the dedicated remediation UI
 * and this compatibility adapter observe the same failed Check modal.
 * v20.2 preserves the Home resume-draft action when canonical downstream sync
 * refreshes the primary action button.
 * v20.3 loads the dedicated Check feedback UI through the stable production entrypoint.
 * v21.0 bound generic choices to authored answer text.
 * v22.0 binds the live Check UI to the deterministic authored assessment banks
 * v22.1 gives Home the canonical next-action label instead of a generic Open activity button.
 * v22.2 keeps the prominent Hero CTA aligned to the same canonical next-action label.
 * v22.3 loads the shared stage Definition-of-Done projection into every canonical session.
 * (prompt, options and correctIndex) already defined for all 24 canonical weeks.
 */
(async function () {
  'use strict';
  try {
    await import('./canonical-course-runtime-v1.js');
    await import('./canonical-shell-bridge-v1.js');
    const { installVerifiedCapability } = await import('./capability-integrity-v1.js');
    const { validateLearningState } = await import('./learning-state-contract-v1.js');
    await import('./assessment-feedback-ui-v1.js');
    await import('./stage-definition-of-done-ui-v1.js');
    const started = Date.now();
    while (!window.ECRHCanonical?.openStage && Date.now() - started < 5000) await new Promise(r => setTimeout(r, 50));
    const api = window.ECRHCanonical;
    const store = api?.store;
    if (!api || !store) return;
    installVerifiedCapability(store, api.catalog || {});

    const authoredAssessments = {};
    const assessmentSources = [
      './assessment-bank-weeks-01-03-v1.json',
      './assessment-question-bank-v1.json',
      './assessment-bank-weeks-11-15-v1.json',
      './assessment-bank-weeks-16-20-v1.json',
      './assessment-bank-weeks-21-24-v1.json'
    ];
    try {
      const payloads = await Promise.all(assessmentSources.map(async source => {
        const response = await fetch(`./${source.replace(/^\.\//, '')}`, { cache: 'no-store' });
        if (!response.ok) return null;
        return response.json();
      }));
      payloads.filter(Boolean).forEach(payload => {
        (payload.weeks || []).forEach(module => {
          if (module?.week != null) authoredAssessments[String(module.week)] = module;
        });
      });
    } catch (error) {
      console.warn('[ECRH authored deterministic assessment banks]', error);
    }

    const refreshIntegrity = () => {
      const current = store.getState?.() || {};
      const integrity = validateLearningState({
        catalog: api.catalog || {},
        progressByWeek: current.progressByWeek || {},
        contextByWeek: current.contextByWeek || {},
        portfolioEntries: current.portfolioEntries || [],
        journalEntries: current.journalEntries || [],
        evidenceLedger: current.evidenceLedger || [],
        hubSignals: current.hubSignals || {},
        nextBestAction: current.nextBestAction || current.hubSignals?.nextBestAction || null
      });
      api.learningStateIntegrity = integrity;
      if (!integrity.ok) console.warn('[ECRH learning-state contract]', integrity.issues);
      return integrity;
    };
    refreshIntegrity();

    const esc = value => String(value ?? '').replace(/[&<>\"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '\"':'&quot;', "'":'&#39;' }[c]));
    const recoverySummary = action => action?.source === 'stale-evidence-recovery' ? action.recoveryRoute?.checklist || null : null;
    const stageLabel = stage => ({ learn: 'Learn', apply: 'Apply', check: 'Check', evidence: 'Evidence' }[String(stage)] || String(stage || 'activity'));
    const checklistHtml = checklist => checklist ? `<div class="goal" id="canonicalRecoveryChecklist"><b>Recovery checklist</b><small>Apply: ${checklist.apply?.ready ? 'ready' : 'required'} • Check: ${checklist.check?.ready ? 'ready' : 'required'} • Evidence: ${checklist.evidence?.status === 'recapture-required' ? 'recapture required' : 'ready'}</small>${checklist.priorEvidenceStale ? '<small>Previous Evidence is stale and will be superseded by the new proof.</small>' : ''}</div>` : '';

    const canonicalActionButtonLabel = (action, state = {}) => {
      const weekId = action?.recoveryRoute?.weekId || action?.weekId;
      const stage = action?.recoveryRoute?.resumeStage || action?.nextProofStage || action?.stage;
      const context = weekId != null ? state?.contextByWeek?.[String(weekId)] || {} : {};
      const draft = stage ? context?.sessionDraft?.[String(stage)] : null;
      const progress = weekId != null ? state?.progressByWeek?.[String(weekId)] || {} : {};
      const hasDraft = Boolean(draft && !progress[String(stage)]);
      return action?.source === 'stale-evidence-recovery'
        ? `Resume: ${action.recoveryRoute?.resumeLabel || action.nextProofLabel || 'Recovery'}`
        : hasDraft
          ? `Resume ${stageLabel(stage)} draft`
          : action?.nextProofLabel
            ? action.nextProofLabel
            : stage
              ? `Start ${stageLabel(stage)}`
              : 'Continue learning';
    };

    const bindAuthoredCheck = weekId => {
      const authoredModule = authoredAssessments[String(weekId)];
      const questions = authoredModule?.questions;
      if (!Array.isArray(questions) || !questions.length) return;
      const card = document.getElementById('modalCard');
      if (!card) return;
      const blocks = Array.from(card.querySelectorAll('.question'));
      if (!blocks.length) return;
      blocks.slice(0, questions.length).forEach((block, questionIndex) => {
        const authored = questions[questionIndex] || {};
        const options = Array.isArray(authored.options) ? authored.options.filter(Boolean) : [];
        const correctIndex = Number.isInteger(authored.correctIndex) ? authored.correctIndex : -1;
        if (!options.length || correctIndex < 0 || correctIndex >= options.length) return;

        const prompt = block.querySelector('b');
        if (prompt && authored.prompt) prompt.textContent = `${questionIndex + 1}. ${authored.prompt}`;

        const labels = Array.from(block.querySelectorAll('label'));
        options.forEach((option, slot) => {
          const label = labels[slot];
          if (!label) return;
          const input = label.querySelector('input[type="radio"]');
          if (input) input.value = String(slot);
          const textNode = Array.from(label.childNodes).find(node => node.nodeType === Node.TEXT_NODE);
          if (textNode) textNode.nodeValue = ` ${String.fromCharCode(65 + slot)} — ${option}`;
          else label.appendChild(document.createTextNode(` ${String.fromCharCode(65 + slot)} — ${option}`));
        });
        labels.slice(options.length).forEach(label => { label.hidden = true; });
        block.dataset.authoredAssessment = 'true';
        block.dataset.correctIndex = String(correctIndex);
      });
    };

    const syncDownstreamSurfaces = (state = {}) => {
      refreshIntegrity();
      const action = state?.nextBestAction || state?.hubSignals?.nextBestAction || null;
      const capability = state?.verifiedCapability || store.getVerifiedCapability?.() || null;
      const ledger = Array.isArray(state?.evidenceLedger) ? state.evidenceLedger : [];
      if (action) {
        const title = document.getElementById('nextTitle');
        const type = document.getElementById('nextType');
        const coach = document.getElementById('coach');
        const coachText = document.getElementById('coachText');
        const open = document.getElementById('homeOpen');
        const weekId = action?.recoveryRoute?.weekId || action?.weekId;
        const stage = action?.recoveryRoute?.resumeStage || action?.nextProofStage || action?.stage;
        const context = weekId != null ? state?.contextByWeek?.[String(weekId)] || {} : {};
        const draft = stage ? context?.sessionDraft?.[String(stage)] : null;
        const progress = weekId != null ? state?.progressByWeek?.[String(weekId)] || {} : {};
        const hasDraft = Boolean(draft && !progress[String(stage)]);
        if (title) title.textContent = action.week || `Week ${action.weekId || ''}`;
        if (type) type.textContent = action.label || action.nextProofLabel || action.stage || 'Learn';
        if (coach) coach.textContent = action.proofStatus === 'demonstrated' ? 'Capability demonstrated.' : `Next proof step: ${action.nextProofLabel || action.stage || 'Learn'}.`;
        if (coachText) coachText.textContent = action.prompt || action.reason || 'Continue the canonical learning sequence.';
        if (open) {
          const resumable = weekId != null && stage;
          open.textContent = canonicalActionButtonLabel(action, state);
          open.dataset.canonicalAction = resumable ? JSON.stringify({ weekId: String(weekId), stage: String(stage) }) : '';
        }
      }
      const advice = document.getElementById('advice');
      if (advice && action) {
        advice.innerHTML = `<div class="mission"><b>${esc(action.label || 'Next best action')}</b><div class="muted">${esc(action.reason || action.prompt || '')}</div><div style="margin-top:6px"><span class="pill">Proof ${esc(action.proofProgress || '0/4')}</span>${action.nextProofLabel ? ` <span class="tag">Next: ${esc(action.nextProofLabel)}</span>` : ''}${action.source === 'stale-evidence-recovery' ? ' <span class="tag">Recovery</span>' : ''}</div></div>${checklistHtml(recoverySummary(action))}`;
      }
      const readiness = document.getElementById('readiness');
      if (readiness && capability) {
        const verifiedCount = Number(capability.verifiedEvidenceCount || 0);
        const skillCount = Array.isArray(capability.skills) ? capability.skills.length : 0;
        readiness.innerHTML = `<div class="skillrow"><div class="skillhead"><b>Verified evidence</b><b>${verifiedCount}</b></div><div class="muted">${skillCount} skill signal${skillCount === 1 ? '' : 's'} backed by the canonical proof chain.</div>${ledger.length ? `<div class="muted">${ledger.length} ledger record${ledger.length === 1 ? '' : 's'} retained for longitudinal proof history.</div>` : ''}</div>`;
      }
      const logs = document.getElementById('logs');
      if (logs && action && !document.getElementById('canonicalGuidanceJournal')) {
        const note = document.createElement('div');
        note.id = 'canonicalGuidanceJournal';
        note.className = 'mission';
        note.innerHTML = `<b>Current learning direction</b><div class="muted">${esc(action.prompt || action.reason || `Continue with ${action.nextProofLabel || action.stage || 'the next stage'}.`)}</div>`;
        logs.before(note);
      } else if (logs && action) {
        const note = document.getElementById('canonicalGuidanceJournal');
        const text = note?.querySelector('.muted');
        if (text) text.textContent = action.prompt || action.reason || `Continue with ${action.nextProofLabel || action.stage || 'the next stage'}.`;
      }
    };

    syncDownstreamSurfaces(store.getState?.() || {});
    store.subscribe?.(syncDownstreamSurfaces);

    const originalOpenStage = api.openStage;
    if (!originalOpenStage) return;

    const openCanonicalAction = () => {
      const current = store.getState?.() || {};
      const action = current?.nextBestAction || current?.hubSignals?.nextBestAction || null;
      const weekId = action?.recoveryRoute?.weekId || action?.weekId;
      const stage = action?.recoveryRoute?.resumeStage || action?.nextProofStage || action?.stage;
      if (weekId != null && stage) {
        api.openStage(String(weekId), String(stage));
        return true;
      }
      return false;
    };

    const homeOpen = document.getElementById('homeOpen');
    if (homeOpen) {
      homeOpen.onclick = openCanonicalAction;
      homeOpen.setAttribute('aria-label', 'Open the canonical next best learning action');
    }
    const resume = document.getElementById('resume');
    if (resume) {
      resume.onclick = openCanonicalAction;
      const current = store.getState?.() || {};
      const action = current?.nextBestAction || current?.hubSignals?.nextBestAction || null;
      if (action) resume.textContent = canonicalActionButtonLabel(action, current);
      resume.setAttribute('aria-label', 'Open the canonical next best learning action');
    }

    api.openStage = function (weekId, stage) {
      originalOpenStage(weekId, stage);
      if (stage !== 'check') return;
      setTimeout(() => {
        bindAuthoredCheck(weekId);
        const currentStore = window.ECRHCanonical?.store;
        const context = currentStore?.getState?.()?.contextByWeek?.[String(weekId)] || {};
        const remediation = context.remediation;
        const card = document.getElementById('modalCard');
        const button = document.getElementById('canonicalCheck');
        if (!card || !button || !context.assessmentResult || context.assessmentResult.passed || !remediation || remediation.status === 'complete') return;
        if (document.getElementById('adapterRemediation') || card.querySelector('[data-remediation-panel]')) return;
        const concepts = Array.isArray(remediation.concepts) && remediation.concepts.length ? remediation.concepts : ['the failed Check items'];
        const actions = Array.isArray(remediation.actions) && remediation.actions.length ? remediation.actions : ['Review the missed concepts and explain the correct senior-level reasoning in your own words.'];
        const route = currentStore.getState()?.nextBestAction?.recoveryRoute;
        const checklist = route?.checklist;
        const panel = document.createElement('div');
        panel.id = 'adapterRemediation';
        panel.style.cssText = 'margin-top:12px;border:1px solid #fed7aa;background:#fffaf5;border-radius:11px;padding:12px';
        panel.innerHTML = `<h3 style="margin:0 0 6px">Targeted reinforcement required</h3><p class="muted">The latest Check was not passed. Complete the targeted reinforcement before retrying.</p><p><b>Focus:</b> ${concepts.map(esc).join(', ')}</p><ol>${actions.map(x => `<li>${esc(x)}</li>`).join('')}</ol>${checklistHtml(checklist)}<label style="display:block;font-size:12px;font-weight:800">Reinforcement note<textarea id="adapterRemediationNotes" placeholder="What did you review, what changed in your reasoning, and how did you verify it?"></textarea></label><button class="btn primary" id="adapterCompleteRemediation">Complete reinforcement & unlock retry</button>`;
        button.before(panel);
        document.getElementById('adapterCompleteRemediation').onclick = () => {
          const notes = document.getElementById('adapterRemediationNotes')?.value.trim() || '';
          if (!notes) return alert('Add a short reinforcement note before retrying the Check.');
          const current = currentStore.getState()?.contextByWeek?.[String(weekId)] || {};
          if (current.remediation?.status === 'required') {
            const start = currentStore.startRemediation(weekId);
            if (!start.ok) return alert(start.reason || 'Could not start reinforcement.');
          }
          const done = currentStore.completeRemediation({ weekId: String(weekId), notes });
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
