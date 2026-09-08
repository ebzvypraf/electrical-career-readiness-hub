/*
 * Electrical Career Readiness Hub — assessment history bridge v1.
 * Read-only integration layer for the canonical Check attempt trail.
 * Persistence belongs to the canonical learning-state store; this bridge
 * exposes stable summaries to Home, Skills, Journal and Portfolio without
 * wrapping or mutating the assessment command path.
 */
(function () {
  'use strict';

  const HISTORY_VERSION = '1.1.0';
  let installed = false;
  let unsubscribe = null;
  let renderQueued = false;

  const getStore = () => {
    try { return window.ECRHCanonical?.store?.() || null; } catch (_) { return null; }
  };
  const clean = value => String(value ?? '').trim();

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
    if (!store || typeof store.getState !== 'function') return false;

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
    return String(value ?? '').replace(/[&<>\"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '\"':'&quot;', "'":'&#39;' }[c]));
  }

  function render() {
    renderQueued = false;
    if (!installed || !window.ECRHAssessmentHistory) return;
    const summary = window.ECRHAssessmentHistory.getSummary();
    if (!summary.attempts) return;

    const home = document.getElementById('feed');
    if (home && !home.querySelector('[data-assessment-history="home"]')) {
      const node = document.createElement('div');
      node.dataset.assessmentHistory = 'home';
      node.className = 'feeditem';
      node.innerHTML = `<b>Check learning trail</b><div class="muted">${summary.attempts} assessment attempt${summary.attempts === 1 ? '' : 's'} recorded${summary.recoveredWeeks.length ? `, including ${summary.recoveredWeeks.length} recovered Check${summary.recoveredWeeks.length === 1 ? '' : 's'}` : ''}.</div>`;
      home.prepend(node);
    }

    const advice = document.getElementById('advice');
    if (advice && !advice.querySelector('[data-assessment-history="skills"]')) {
      const node = document.createElement('div');
      node.dataset.assessmentHistory = 'skills';
      node.className = 'goal';
      node.innerHTML = `<b>Assessment progression</b><small>${summary.passedAttempts} passed attempt${summary.passedAttempts === 1 ? '' : 's'} across the recorded learning trail. Repeated attempts remain visible as progression evidence.</small>`;
      advice.prepend(node);
    }

    const logs = document.getElementById('logs');
    if (logs && !logs.querySelector('[data-assessment-history="journal"]')) {
      const node = document.createElement('div');
      node.dataset.assessmentHistory = 'journal';
      node.className = 'goal';
      node.innerHTML = `<b>Assessment attempt trail</b><div class="muted">${summary.records.slice().reverse().slice(0, 4).map(item => { const last = item.history[item.history.length - 1]; return `Week ${esc(item.weekId)} — ${esc(last?.score)}/${esc(last?.total)}${last?.percentage != null ? ` (${esc(last.percentage)}%)` : ''}${last?.passed ? ' — passed' : ' — reinforcement needed'}`; }).join('<br>')}</div>`;
      logs.prepend(node);
    }

    const readiness = document.getElementById('readiness');
    if (readiness && !readiness.querySelector('[data-assessment-history="portfolio"]')) {
      const node = document.createElement('div');
      node.dataset.assessmentHistory = 'portfolio';
      node.className = 'goal';
      node.innerHTML = `<b>Assessment provenance</b><small>Portfolio readiness can now be interpreted alongside Check attempts and successful recovery, rather than only the latest score.</small>`;
      readiness.prepend(node);
    }
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
