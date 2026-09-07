/*
 * Electrical Career Readiness Hub — remediation impact UI v1.
 * Surfaces measurable recovery from failed Checks across Home, Skills, Journal and Portfolio
 * without changing the canonical scoring model.
 */
(function () {
  'use strict';

  const esc = value => String(value ?? '').replace(/[&<>\"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '\"':'&quot;', "'":'&#39;' }[c]));
  const canonical = () => window.ECRHCanonical;
  const getState = () => {
    try { return canonical()?.store?.()?.getState?.() || null; } catch (_) { return null; }
  };

  function buildRecoverySummary(state) {
    const byWeek = state?.contextByWeek || {};
    const records = Object.entries(byWeek).map(([weekId, ctx]) => {
      const remediation = ctx?.remediation;
      const check = ctx?.assessmentResult;
      if (!remediation || !check) return null;
      const recovered = check.passed && remediation.status === 'complete';
      return {
        weekId,
        recovered,
        active: !recovered && ['required', 'in-progress', 'ready-to-retry'].includes(String(remediation.status)),
        concepts: Array.isArray(remediation.concepts) ? remediation.concepts : [],
        startedAt: remediation.startedAt || null,
        completedAt: remediation.completedAt || null,
        checkScore: check.score,
        checkTotal: check.total,
        percentage: check.percentage
      };
    }).filter(Boolean);

    const recoveredWeeks = records.filter(x => x.recovered);
    const activeWeeks = records.filter(x => x.active);
    return {
      records,
      recoveredWeeks,
      activeWeeks,
      recoveredCount: recoveredWeeks.length,
      activeCount: activeWeeks.length,
      lastRecovered: recoveredWeeks.slice().sort((a, b) => String(b.completedAt || '').localeCompare(String(a.completedAt || '')))[0] || null
    };
  }

  function replaceOrInsert(parent, id, html) {
    if (!parent) return;
    let node = parent.querySelector(`[data-remediation-impact="${id}"]`);
    if (!html) { node?.remove(); return; }
    if (!node) {
      node = document.createElement('div');
      node.dataset.remediationImpact = id;
      node.style.marginTop = '12px';
      parent.prepend(node);
    }
    node.innerHTML = html;
  }

  function render() {
    const state = getState();
    if (!state) return;
    const summary = buildRecoverySummary(state);
    const last = summary.lastRecovered;
    const recoveredText = summary.recoveredCount === 1 ? '1 Check recovery' : `${summary.recoveredCount} Check recoveries`;

    const homeFeed = document.getElementById('feed');
    replaceOrInsert(homeFeed, 'home', (summary.recoveredCount || summary.activeCount) ? `
      <div class="feeditem">
        <b>Capability recovery</b>
        <div class="muted">${esc(recoveredText)} recorded${last ? `; latest recovery was Week ${esc(last.weekId)}${last.percentage != null ? ` at ${esc(last.percentage)}%` : ''}.` : '.'}</div>
      </div>` : '');

    const skillsAdvice = document.getElementById('advice');
    replaceOrInsert(skillsAdvice, 'skills', (summary.recoveredCount || summary.activeCount) ? `
      <div class="goal">
        <b>${summary.recoveredCount} recovered Check${summary.recoveredCount === 1 ? '' : 's'}</b>
        <small>${summary.activeCount ? `${summary.activeCount} assessment gap${summary.activeCount === 1 ? '' : 's'} still need reinforcement.` : 'Previously failed concepts have been successfully reassessed.'}</small>
      </div>` : '');

    const journalLogs = document.getElementById('logs');
    replaceOrInsert(journalLogs, 'journal', summary.recoveredCount ? `
      <div class="goal">
        <b>Recovery milestones</b>
        <div class="muted">${summary.recoveredWeeks.slice(-3).reverse().map(x => `Week ${esc(x.weekId)} — Check recovered${x.percentage != null ? ` (${esc(x.percentage)}%)` : ''}`).join('<br>')}</div>
      </div>` : '');

    const readiness = document.getElementById('readiness');
    replaceOrInsert(readiness, 'portfolio', (summary.recoveredCount || summary.activeCount) ? `
      <div class="goal">
        <b>${summary.recoveredCount} recovery milestone${summary.recoveredCount === 1 ? '' : 's'}</b>
        <small>Successful remediation is now recognized alongside portfolio evidence readiness.</small>
      </div>` : '');
  }

  function scheduleRender() { setTimeout(render, 0); }
  new MutationObserver(scheduleRender).observe(document.documentElement, { subtree: true, childList: true, characterData: true });
  document.addEventListener('click', scheduleRender, true);
  document.addEventListener('DOMContentLoaded', scheduleRender, { once: true });
})();
