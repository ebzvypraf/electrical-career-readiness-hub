/* Electrical Career Readiness Hub — Check proof UI enhancer v1.2.
 * Makes the canonical Apply → Check dependency and recovery trail visible
 * inside the learner-facing Check modal and provides a deterministic
 * post-assessment handoff to Evidence or remediation. The store remains
 * authoritative for completion and persistence.
 */
(function () {
  'use strict';
  const text = value => String(value == null ? '' : value).trim();
  const esc = value => text(value).replace(/[&<>\"']/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '\"':'&quot;', "'":'&#39;' }[char]));
  const root = () => typeof window !== 'undefined' ? window : null;
  const canonical = () => root() && root().ECRHCanonical;
  const store = () => { const api = canonical(); return typeof api?.store === 'function' ? api.store() : api?.store || null; };
  function currentWeek() { const card = document.getElementById('modalCard'); const marker = card && card.querySelector('.k'); const match = marker && text(marker.textContent).match(/Week\s+(\d+)/i); return match ? Number(match[1]) : null; }
  function context(week) { const s = store(); return s && s.getState ? (s.getState().contextByWeek?.[String(week)] || {}) : {}; }
  function proofState(week) {
    const ctx = context(week); const apply = ctx.applicationEvidence || {}; const check = ctx.assessmentResult || {};
    const history = Array.isArray(ctx.assessmentHistory) ? ctx.assessmentHistory : (Array.isArray(check.assessmentHistory) ? check.assessmentHistory : []);
    const applyReady = Boolean(apply.tasksComplete && apply.deliverable && apply.decisions && apply.assumptions && apply.verification);
    const passed = check.passed === true && (check.completionReady === true || check.passed === true);
    const failed = history.some(item => item && item.passed === false) || check.passed === false;
    const recovered = passed && (check.recovered === true || history.some(item => item && item.passed === false));
    const remediation = ctx.remediation || {};
    return { applyReady, passed, failed, recovered, remediationStatus: text(remediation.status || '') || 'none', historyCount: history.length };
  }
  function markup(state) {
    const row = (ok, label, detail) => '<div class="rubric-row"><span><strong>' + (ok ? 'Ready' : 'Blocked') + '</strong> — ' + esc(label) + '</span><span class="tag' + (ok ? ' pill ok' : '') + '">' + esc(detail) + '</span></div>';
    const status = state.passed ? (state.recovered ? 'Passed after recovery' : 'Passed') : (state.applyReady ? 'Ready to assess' : 'Apply required first');
    const note = state.passed ? 'The current Check result is valid. Capture Evidence next to demonstrate the capability.' : state.failed ? (state.remediationStatus === 'ready-to-retry' ? 'Targeted reinforcement is ready. Complete remediation, then retry the Check.' : 'The previous Check was not passed. Use the remediation path before retrying.') : 'Complete the structured Apply record first. The Check can then validate the concepts against the practical work.';
    return '<div class="learning-card" id="canonical-check-proof-gate"><h3>Check proof & recovery</h3><p class="muted">Check validates the knowledge behind the practical Apply work. The canonical store retains failed attempts and recovery history.</p><div class="rubric">' + row(state.applyReady, 'Apply proof', state.applyReady ? 'Complete' : 'Complete Apply first') + row(state.passed, 'Current Check', status) + row(!state.failed || state.recovered, 'Recovery trail', state.recovered ? 'Recovered' : (state.failed ? 'Remediation needed' : 'No recovery needed')) + '</div><div class="result' + (state.passed ? '' : ' warn') + '"><b>' + esc(status) + '</b><p>' + esc(note) + '</p></div></div>';
  }
  function findStageButton(week, stage) {
    const weeks = Array.from(document.querySelectorAll('.week'));
    const target = weeks.find(node => { const no = node.querySelector('.wno'); return no && Number((text(no.textContent).match(/\d+/) || [])[0]) === Number(week); });
    if (!target) return null;
    return Array.from(target.querySelectorAll('button')).find(button => new RegExp('^\\s*' + stage + '\\b', 'i').test(text(button.textContent))) || Array.from(target.querySelectorAll('button')).find(button => text(button.textContent).toLowerCase().includes(stage.toLowerCase()));
  }
  function handoffMarkup(state) {
    if (state.passed) return '<div class="learning-card" id="canonical-check-handoff"><h3>Next action</h3><p class="muted">Check is complete. Preserve this result and continue directly to the Evidence stage.</p><button type="button" class="btn primary" data-canonical-handoff="evidence">Continue to Evidence</button></div>';
    if (state.failed && state.remediationStatus !== 'complete') return '<div class="learning-card" id="canonical-check-handoff"><h3>Next action</h3><p class="muted">The Check is not passed yet. Complete the targeted remediation before retrying.</p><button type="button" class="btn" data-canonical-handoff="remediation">Review remediation</button></div>';
    return '';
  }
  function enhance() {
    const card = document.getElementById('modalCard'); if (!card) return;
    if (!/Check|Knowledge Check/i.test(text(card.textContent))) return;
    const week = currentWeek(); if (!week) return;
    const questions = card.querySelectorAll('.question'); if (!questions.length) return;
    const state = proofState(week); let gate = document.getElementById('canonical-check-proof-gate');
    if (!gate) { gate = document.createElement('div'); gate.className = 'learning-card'; questions[0].parentNode.insertBefore(gate, questions[0]); }
    gate.outerHTML = markup(state);
    let handoff = document.getElementById('canonical-check-handoff');
    const html = handoffMarkup(state);
    if (!html) { if (handoff) handoff.remove(); return; }
    if (!handoff) { handoff = document.createElement('div'); handoff.className = 'learning-card'; card.appendChild(handoff); }
    handoff.outerHTML = html;
  }
  function handleHandoff(event) {
    const target = event.target && event.target.closest ? event.target.closest('[data-canonical-handoff]') : null;
    if (!target) return;
    event.preventDefault(); event.stopImmediatePropagation();
    const week = currentWeek(); const action = target.getAttribute('data-canonical-handoff');
    if (!week) return;
    if (action === 'evidence') {
      const modal = document.getElementById('modal'); if (modal) modal.classList.remove('show');
      const button = findStageButton(week, 'Evidence');
      if (button) { button.click(); return; }
      const courseNav = Array.from(document.querySelectorAll('[data-page="course"]')).find(Boolean);
      if (courseNav) courseNav.click();
      return;
    }
    if (action === 'remediation') {
      const button = Array.from(document.querySelectorAll('button')).find(item => /remediation/i.test(text(item.textContent)) && !item.closest('#canonical-check-handoff'));
      if (button) { button.click(); return; }
      const api = canonical(); const remediation = api && (api.startRemediation || api.remediate);
      if (typeof remediation === 'function') { remediation(String(week)); }
      enhance();
    }
  }
  function init() { if (typeof document === 'undefined') return; document.addEventListener('click', handleHandoff, true); const observer = new MutationObserver(enhance); observer.observe(document.body, { childList: true, subtree: true }); enhance(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
