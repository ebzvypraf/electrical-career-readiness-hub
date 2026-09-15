/*
 * Electrical Career Readiness Hub — assessment history bridge v1.
 * Read-only integration layer for the canonical Check attempt trail.
 * Persistence belongs to the canonical learning-state store; this bridge
 * exposes stable summaries to Home, Skills, Journal and Portfolio without
 * wrapping or mutating the assessment command path.
 *
 * v1.3 adds an actionable history trail: recent Check records can return
 * directly to their canonical Week + Check stage without creating another
 * progression path.
 */
(function () {
  'use strict';

  const HISTORY_VERSION = '1.3.0';
  let installed = false;
  let unsubscribe = null;
  let renderQueued = false;

  const getStore = () => {
    try {
      const api = window.ECRHCanonical;
      const store = typeof api?.store === 'function' ? api.store() : api?.store;
      return store && typeof store.getState === 'function' ? store : null;
    } catch (_) { return null; }
  };

  function normalizeHistory(history) {
    return Array.isArray(history) ? history.filter(item => item && typeof item === 'object') : [];
  }

  function buildSummary(state) {
    const records = Object.entries(state?.contextByWeek || {})
      .map(([weekId, context]) => ({ weekId, history: normalizeHistory(context?.assessmentHistory) }))
      .filter(item => item.history.length);
    const attempts = records.reduce((sum, item) => sum + item.history.length, 0);
    const passedAttempts = records.reduce((sum, item) => sum + item.history.filter(item => Boolean(item?.passed)).length, 0);
    const recoveredWeeks = records.filter(item => {
      const latest = item.history[item.history.length - 1];
      return item.history.slice(0, -1).some(attempt => attempt?.passed === false) && Boolean(latest?.passed);
    });
    return { attempts, passedAttempts, recoveredWeeks, records };
  }

  function install() {
    if (installed) return true;
    const store = getStore();
    if (!store) return false;

    installed = true;
    window.ECRHAssessmentHistory = {
      version: HISTORY_VERSION,
      getWeekHistory(weekId) {
        const context = store.getState()?.contextByWeek?.[String(weekId)] || {};
        return normalizeHistory(context.assessmentHistory);
      },
      getSummary() { return buildSummary(store.getState()); }
    };

    if (typeof store.subscribe === 'function') unsubscribe = store.subscribe(() => scheduleRender());
    return true;
  }

  function esc(value) {
    return String(value ?? '').replace(/[&<>\\"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '\\"':'&quot;', "'":'&#39;' }[c]));
  }

  function upsert(container, key, className, html) {
    if (!container) return null;
    let node = container.querySelector(`[data-assessment-history="${key}"]`);
    if (!node) {
      node = document.createElement('div');
      node.dataset.assessmentHistory = key;
      node.className = className;
      container.prepend(node);
    }
    node.innerHTML = html;
    return node;
  }

  function bindHistoryActions(host) {
    host?.querySelectorAll('[data-assessment-history-open]').forEach(button => {
      button.onclick = () => {
        const weekId = String(button.dataset.assessmentHistoryOpen || '');
        const api = window.ECRHCanonical;
        if (weekId && typeof api?.openStage === 'function') {
          api.openStage(weekId, 'check');
          return;
        }
        document.querySelector('[data-page="course"]')?.click();
      };
    });
  }

  function render() {
    renderQueued = false;
    if (!installed || !window.ECRHAssessmentHistory) return;
    const summary = window.ECRHAssessmentHistory.getSummary();
    if (!summary.attempts) return;

    const home = document.getElementById('feed');
    upsert(home, 'home', 'feeditem',
      `<b>Check learning trail</b><div class="muted">${summary.attempts} assessment attempt${summary.attempts === 1 ? '' : 's'} recorded${summary.recoveredWeeks.length ? `, including ${summary.recoveredWeeks.length} recovered Check${summary.recoveredWeeks.length === 1 ? '' : 's'}` : ''}.</div>`);

    const advice = document.getElementById('advice');
    upsert(advice, 'skills', 'goal',
      `<b>Assessment progression</b><small>${summary.passedAttempts} passed attempt${summary.passedAttempts === 1 ? '' : 's'} across the recorded learning trail. Repeated attempts remain visible as progression evidence.</small>`);

    const recent = summary.records.slice().reverse().slice(0, 4);
    const logs = document.getElementById('logs');
    upsert(logs, 'journal', 'goal',
      `<b>Assessment attempt trail</b><div class="muted">${recent.map(item => { const last = item.history[item.history.length - 1]; return `<div style="margin-top:8px"><span>Week ${esc(item.weekId)} — ${esc(last?.score)}/${esc(last?.total)}${last?.percentage != null ? ` (${esc(last.percentage)}%)` : ''}${last?.passed ? ' — passed' : ' — reinforcement needed'}</span> <button type="button" class="btn" data-assessment-history-open="${esc(item.weekId)}">Open Check</button></div>`; }).join('')}</div>`);
    bindHistoryActions(logs);

    const readiness = document.getElementById('readiness');
    upsert(readiness, 'portfolio', 'goal',
      `<b>Assessment provenance</b><small>${summary.attempts} recorded attempt${summary.attempts === 1 ? '' : 's'} across the learning trail${summary.recoveredWeeks.length ? `, with ${summary.recoveredWeeks.length} recovered Check${summary.recoveredWeeks.length === 1 ? '' : 's'}` : ''}. Portfolio readiness can be interpreted alongside Check attempts rather than only the latest score.</small>`);
  }

  function scheduleRender() {
    if (renderQueued) return;
    renderQueued = true;
    setTimeout(render, 0);
  }

  function boot() {
    if (!install()) { setTimeout(boot, 100); return; }
    render();
  }

  if (typeof window !== 'undefined') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
    new MutationObserver(() => { if (!installed) boot(); }).observe(document.documentElement, { subtree: true, childList: true });
  }
})();
