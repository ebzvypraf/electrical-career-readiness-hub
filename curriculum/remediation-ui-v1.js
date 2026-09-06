/* Electrical Career Readiness Hub — remediation UI v1.
 * Bridges persisted Check failures into Learn reinforcement and an explicit retry-ready state.
 */
(function () {
  'use strict';
  const esc = value => String(value ?? '').replace(/[&<>\"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[c]));
  const $ = id => document.getElementById(id);
  function api() { return window.ECRHCanonical; }
  function state() { try { return api()?.store?.getState?.() || null; } catch (_) { return null; } }
  function renderLearn() {
    const card = $('modalCard'); const s = state();
    if (!card || !s) return;
    const match = String(card.querySelector('.k')?.textContent || '').match(/Week\s+(\d+)\s+•\s+Learn/i); if (!match) return;
    const week = match[1], remediation = s.contextByWeek?.[week]?.remediation, feedback = s.contextByWeek?.[week]?.assessmentResult?.feedback;
    if (!remediation || !['in-progress','ready-to-retry'].includes(remediation.status) || !feedback?.reinforcement?.length) return;
    if (card.querySelector('[data-remediation-panel]')) return;
    const concepts = (remediation.concepts || feedback.priorityConcepts || []).slice(0, 6);
    const notes = remediation.notes || '';
    card.insertAdjacentHTML('beforeend', `<div class="learning-card" data-remediation-panel style="margin-top:12px"><h3>Targeted reinforcement</h3><p class="muted">Focus on the concepts missed in your last Check, then record what you reinforced before retrying.</p><div class="muted"><b>Focus:</b> ${esc(concepts.join(', ') || 'failed Check items')}</div><label style="display:block;margin-top:10px"><b>What did you reinforce?</b><textarea id="canon-remediation-note" placeholder="Summarize the reasoning you reviewed or practiced.">${esc(notes)}</textarea></label><button class="btn primary" id="canon-complete-remediation">${remediation.status === 'ready-to-retry' ? 'Update reinforcement' : 'Mark reinforcement complete'}</button><div class="muted" style="margin-top:8px">After saving, return to Check to retry the assessment.</div></div>`);
    $('canon-complete-remediation').onclick = () => {
      const result = api()?.store?.completeRemediation?.({ weekId: week, notes: $('canon-remediation-note')?.value || '' });
      if (!result?.ok) return alert(result?.reason || 'Could not record remediation.');
      renderLearn();
    };
  }
  function render() { setTimeout(renderLearn, 0); }
  new MutationObserver(render).observe(document.documentElement, {subtree:true, childList:true});
  document.addEventListener('click', render, true);
  document.addEventListener('DOMContentLoaded', render, {once:true});
})();
