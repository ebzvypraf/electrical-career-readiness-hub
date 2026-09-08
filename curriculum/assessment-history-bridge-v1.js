/*
 * Electrical Career Readiness Hub — assessment history bridge v1.
 * Persists every canonical Check attempt without replacing the authoritative
 * assessment result. The latest result remains the stage gate; history becomes
 * the learner's visible recovery/learning trail.
 */
(function () {
  'use strict';

  const HISTORY_VERSION = '1.0.0';
  let installed = false;

  const clean = value => String(value ?? '').trim();

  function buildAttempt(result, timestamp) {
    return {
      version: HISTORY_VERSION,
      date: String(result?.date || timestamp),
      score: Number(result?.score) || 0,
      total: Number(result?.total) || 0,
      percentage: Number.isFinite(Number(result?.percentage)) ? Number(result.percentage) : null,
      passed: Boolean(result?.passed),
      completionReady: Boolean(result?.completionReady),
      engineVersion: clean(result?.engineVersion),
      gradingNote: clean(result?.gradingNote),
      resultCount: Array.isArray(result?.results) ? result.results.length : 0,
      missedQuestionIds: Array.isArray(result?.results)
        ? result.results.filter(item => item && item.correct === false).map(item => clean(item.id)).filter(Boolean)
        : []
    };
  }

  function install() {
    if (installed || !window.ECRHCanonical?.ready) return false;
    const store = window.ECRHCanonical.store?.();
    if (!store || typeof store.recordAssessmentResult !== 'function') return false;

    const original = store.recordAssessmentResult.bind(store);
    store.recordAssessmentResult = function wrappedRecordAssessmentResult(payload = {}) {
      const result = original(payload);
      if (!result?.ok) return result;

      const weekId = String(payload.weekId);
      const current = result.state?.contextByWeek?.[weekId] || store.getState()?.contextByWeek?.[weekId] || {};
      const previous = Array.isArray(current.assessmentHistory) ? current.assessmentHistory : [];
      const attempt = buildAttempt(result.result, new Date().toISOString());
      const history = [...previous, attempt].slice(-12);
      const updated = store.updateStageContext(weekId, {
        assessmentHistory: history,
        assessmentAttemptCount: history.length,
        assessmentFirstPass: history.length === 1 && Boolean(attempt.passed),
        assessmentRecovered: history.length > 1 && Boolean(attempt.passed)
      });

      return {
        ...result,
        attempt,
        assessmentHistory: history,
        state: updated?.state || store.getState()
      };
    };

    installed = true;
    window.ECRHAssessmentHistory = {
      version: HISTORY_VERSION,
      getWeekHistory(weekId) {
        return store.getState()?.contextByWeek?.[String(weekId)]?.assessmentHistory || [];
      },
      getSummary() {
        const state = store.getState();
        const records = Object.entries(state?.contextByWeek || {}).map(([weekId, context]) => ({
          weekId,
          history: Array.isArray(context?.assessmentHistory) ? context.assessmentHistory : []
        })).filter(item => item.history.length);
        const attempts = records.reduce((sum, item) => sum + item.history.length, 0);
        const passedAttempts = records.reduce((sum, item) => sum + item.history.filter(x => x.passed).length, 0);
        const recoveredWeeks = records.filter(item => item.history.length > 1 && item.history[item.history.length - 1]?.passed);
        return { attempts, passedAttempts, recoveredWeeks, records };
      }
    };
    return true;
  }

  function esc(value) {
    return String(value ?? '').replace(/[&<>\"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '\"':'&quot;', "'":'&#39;' }[c]));
  }

  function render() {
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
      node.innerHTML = `<b>Assessment attempt trail</b><div class="muted">${summary.records.slice(-4).reverse().map(item => { const last = item.history[item.history.length - 1]; return `Week ${esc(item.weekId)} — ${esc(last?.score)}/${esc(last?.total)}${last?.percentage != null ? ` (${esc(last.percentage)}%)` : ''}${last?.passed ? ' — passed' : ' — reinforcement needed'}`; }).join('<br>')}</div>`;
      logs.prepend(node);
    }

    const readiness = document.getElementById('readiness');
    if (readiness && !readiness.querySelector('[data-assessment-history="portfolio"]')) {
      const node = document.createElement('div');
      node.dataset.assessmentHistory = 'portfolio';
      node.className = 'goal';
      node.innerHTML = `<b>Assessment provenance</b><small>Portfolio readiness can now be interpreted alongside the number of Check attempts and successful recovery, rather than only the latest score.</small>`;
      readiness.prepend(node);
    }
  }

  function boot() {
    if (!install()) { setTimeout(boot, 100); return; }
    render();
    setTimeout(render, 250);
  }

  if (typeof window !== 'undefined') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
    new MutationObserver(() => { if (!installed) boot(); else render(); }).observe(document.documentElement, { subtree: true, childList: true });
  }
})();
