/* Electrical Career Readiness Hub — remediation UI v2.
 * Bridges failed Check results into targeted reinforcement and an explicit retry-ready state.
 */
(function () {
  'use strict';
  const esc = value => String(value ?? '').replace(/[&<>\"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[c]));
  const $ = id => document.getElementById(id);
  function api() { return window.ECRHCanonical; }
  function store() { try { return api()?.store?.() || null; } catch (_) { return null; } }
  function state() { try { return store()?.getState?.() || null; } catch (_) { return null; } }
  function render() {
    const card = $('modalCard'); const s = state();
    if (!card || !s) return;
    const match = String(card.querySelector('.k')?.textContent || '').match(/Week\s+(\d+)\s+•\s+Check/i);
    if (!match) return;
    const week = match[1];
    const ctx = s.contextByWeek?.[week] || {};
    const assessment = ctx.assessmentResult;
    const remediation = ctx.remediation;
    if (!assessment || assessment.passed || !remediation) return;

    const concepts = (remediation.concepts || assessment.feedback?.priorityConcepts || []).slice(0, 6);
    const actionPlan = Array.isArray(remediation.actionPlan) ? remediation.actionPlan.slice(0, 4) : [];
    const actions = (remediation.actions || []).slice(0, 4);
    const note = remediation.notes || '';
    const ready = remediation.status === 'ready-to-retry';
    const actionMarkup = actionPlan.length
      ? actionPlan.map((item, i) => `<div class="mission" style="margin-top:8px"><b>${esc(item.concept || `Reinforcement ${i + 1}`)}</b><ol style="margin:7px 0 0 18px">${(item.steps || []).map(step => `<li>${esc(step)}</li>`).join('')}</ol>${item.evidencePrompt ? `<small>Evidence cue: ${esc(item.evidencePrompt)}</small>` : ''}</div>`).join('')
      : `<div class="mission" style="margin-top:10px"><b>Reinforcement action</b><div class="muted">${esc(actions.join(' ') || 'Explain the corrected reasoning in your own words, then verify it against the failed Check item.')}</div></div>`;
    const markup = `<h3>Targeted reinforcement</h3><p class="muted">Your Check did not pass. Work through the targeted actions below, record what you reviewed, then retry the Check.</p><div class="rubric">${(concepts.length ? concepts : ['Review the failed Check items and correct the reasoning.']).map(x => `<div class="rubric-row"><span>${esc(x)}</span><span class="tag">Focus</span></div>`).join('')}</div>${actionMarkup}${ready ? '<div class="result" style="margin-top:10px"><b>Reinforcement recorded.</b> Retry the Knowledge Check above, then use the Evidence stage to capture a concrete example of the recovered capability.</div>' : `<div class="evidence-form"><label>Reinforcement note<textarea id="canon-remediation-note" placeholder="Summarize the reasoning you reviewed, practiced or verified.">${esc(note)}</textarea></label><button class="btn primary" id="canon-complete-remediation">Mark reinforcement complete</button></div>`}<div class="muted" style="margin-top:8px"><span class="pill ${ready ? 'ok' : ''}">${ready ? 'Retry unlocked' : 'Reinforcement in progress'}</span></div>`;

    let panel = card.querySelector('[data-remediation-panel]');
    if (!panel) {
      panel = document.createElement('div');
      panel.className = 'learning-card';
      panel.dataset.remediationPanel = 'true';
      panel.style.marginTop = '12px';
      const scoreButton = $('canon-score');
      if (scoreButton?.parentElement) scoreButton.parentElement.insertBefore(panel, scoreButton);
      else card.appendChild(panel);
    }
    panel.innerHTML = markup;

    if (!ready) {
      const completeButton = $('canon-complete-remediation');
      if (completeButton) completeButton.onclick = () => {
        const result = store()?.completeRemediation?.({ weekId: week, notes: $('canon-remediation-note')?.value || '' });
        if (!result?.ok) return alert(result?.reason || 'Could not record remediation.');
        render();
      };
    }
  }
  function scheduleRender() { setTimeout(render, 0); }
  new MutationObserver(scheduleRender).observe(document.documentElement, { subtree: true, childList: true, characterData: true });
  document.addEventListener('click', scheduleRender, true);
  document.addEventListener('DOMContentLoaded', scheduleRender, { once: true });
})();
