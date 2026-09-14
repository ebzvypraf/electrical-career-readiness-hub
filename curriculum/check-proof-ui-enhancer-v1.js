/* Electrical Career Readiness Hub — Check proof UI enhancer v1.
 * Makes the canonical Apply → Check dependency and recovery trail visible
 * inside the learner-facing Check modal. Read-only UI guidance: the store
 * remains authoritative for completion and persistence.
 */
import './evidence-ui-enhancer-v1.js';

(function () {
  'use strict';
  const text = value => String(value == null ? '' : value).trim();
  const esc = value => text(value).replace(/[&<>\"']/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '\"':'&quot;', "'":'&#39;' }[char]));
  const root = () => typeof window !== 'undefined' ? window : null;
  const canonical = () => root() && root().ECRHCanonical;
  const store = () => { const api = canonical(); return typeof api?.store === 'function' ? api.store() : api?.store || null; };
  function currentWeek() {
    const card = document.getElementById('modalCard');
    const marker = card && card.querySelector('.k');
    const match = marker && text(marker.textContent).match(/Week\s+(\d+)/i);
    return match ? Number(match[1]) : null;
  }
  function context(week) { const s = store(); return s && s.getState ? (s.getState().contextByWeek?.[String(week)] || {}) : {}; }
  function proofState(week) {
    const ctx = context(week);
    const apply = ctx.applicationEvidence || {};
    const check = ctx.assessmentResult || {};
    const history = Array.isArray(ctx.assessmentHistory) ? ctx.assessmentHistory : (Array.isArray(check.assessmentHistory) ? check.assessmentHistory : []);
    const applyReady = Boolean(apply.tasksComplete && apply.deliverable && apply.decisions && apply.assumptions && apply.verification);
    const passed = check.passed === true && (check.completionReady === true || check.passed === true);
    const failed = history.some(item => item && item.passed === false) || (check.passed === false);
    const recovered = passed && (check.recovered === true || history.some(item => item && item.passed === false));
    const remediation = ctx.remediation || {};
    return { applyReady, passed, failed, recovered, remediationStatus: text(remediation.status || '') || 'none', historyCount: history.length, latest: check };
  }
  function markup(state) {
    const row = (ok, label, detail) => '<div class="rubric-row"><span><strong>' + (ok ? 'Ready' : 'Blocked') + '</strong> — ' + esc(label) + '</span><span class="tag' + (ok ? ' pill ok' : '') + '">' + esc(detail) + '</span></div>';
    const status = state.passed ? (state.recovered ? 'Passed after recovery' : 'Passed') : (state.applyReady ? 'Ready to assess' : 'Apply required first');
    const note = state.passed
      ? 'The current Check result is valid. Capture Evidence next to demonstrate the capability.'
      : state.failed
        ? (state.remediationStatus === 'ready-to-retry' ? 'Targeted reinforcement is ready. Complete remediation, then retry the Check.' : 'The previous Check was not passed. Use the remediation path before retrying.')
        : 'Complete the structured Apply record first. The Check can then validate the concepts against the practical work.';
    return '<div class="learning-card" id="canonical-check-proof-gate"><h3>Check proof & recovery</h3>' +
      '<p class="muted">Check validates the knowledge behind the practical Apply work. The canonical store retains failed attempts and recovery history.</p>' +
      '<div class="rubric">' +
      row(state.applyReady, 'Apply proof', state.applyReady ? 'Complete' : 'Complete Apply first') +
      row(state.passed, 'Current Check', status) +
      row(!state.failed || state.recovered, 'Recovery trail', state.recovered ? 'Recovered' : (state.failed ? 'Remediation needed' : 'No recovery needed')) +
      '</div><div class="result' + (state.passed ? '' : ' warn') + '"><b>' + esc(status) + '</b><p>' + esc(note) + '</p></div></div>';
  }
  function enhance() {
    const card = document.getElementById('modalCard');
    if (!card) return;
    const textContent = text(card.textContent);
    if (!/Check|Knowledge Check/i.test(textContent)) return;
    const week = currentWeek(); if (!week) return;
    const questions = card.querySelectorAll('.question');
    if (!questions.length) return;
    const state = proofState(week);
    let gate = document.getElementById('canonical-check-proof-gate');
    if (!gate) { gate = document.createElement('div'); gate.className = 'learning-card'; const anchor = questions[0]; anchor.parentNode.insertBefore(gate, anchor); }
    gate.outerHTML = markup(state);
  }
  function init() {
    if (typeof document === 'undefined') return;
    const observer = new MutationObserver(enhance);
    observer.observe(document.body, { childList: true, subtree: true });
    enhance();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
