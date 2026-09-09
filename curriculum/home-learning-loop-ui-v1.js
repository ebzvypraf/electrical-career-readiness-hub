/* Electrical Career Readiness Hub — Home learning-loop status v2.
 * Surfaces the canonical active-week Learn → Apply → Check → Evidence state on Home.
 * Additive UI only; canonical learning-state store remains the source of truth.
 */
(function () {
  'use strict';

  const STAGES = ['learn', 'apply', 'check', 'evidence'];
  const LABELS = { learn: 'Learn', apply: 'Apply', check: 'Check', evidence: 'Evidence' };
  const esc = value => String(value ?? '').replace(/[&<>\"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '\"':'&quot;', "'":'&#39;' }[c]));

  function api() { return typeof window !== 'undefined' ? window.ECRHCanonical : null; }
  function store() { const a = api(); return typeof a?.store === 'function' ? a.store() : a?.store || null; }

  function activeWeek(state) {
    const next = state?.hubSignals?.nextBestAction;
    if (next?.weekId) return String(next.weekId);
    const ids = Object.keys(state?.progressByWeek || {}).sort((a, b) => Number(a) - Number(b));
    return ids.find(id => STAGES.some(stage => !(state.progressByWeek?.[id]?.[stage]))) || null;
  }

  function stageState(state, weekId, stage) {
    const progress = state?.progressByWeek?.[weekId] || {};
    const context = state?.contextByWeek?.[weekId] || {};
    if (progress[stage]) return { status: 'complete', label: 'Complete' };
    if (stage === 'apply') {
      const e = context.applicationEvidence || {};
      return { status: e.tasksComplete && e.deliverable && e.decisions && e.assumptions && e.verification ? 'ready' : 'pending', label: e.tasksComplete ? 'Ready to complete' : 'In progress' };
    }
    if (stage === 'check') return { status: context.assessmentResult?.passed ? 'ready' : 'pending', label: context.assessmentResult?.passed ? 'Passed' : 'Pending' };
    if (stage === 'evidence') {
      const e = context.evidence || {};
      return { status: e.evidenceQuality === 'high' ? 'ready' : (e.title && e.description ? 'in-progress' : 'pending'), label: e.evidenceQuality === 'high' ? 'High-quality proof' : (e.title ? 'Captured' : 'Pending') };
    }
    return { status: context.learnViewedAt ? 'ready' : 'pending', label: context.learnViewedAt ? 'Viewed' : 'Pending' };
  }

  function openNextStage(weekId, stage) {
    const stageIndex = STAGES.indexOf(stage);
    if (stageIndex < 0) return;
    const trigger = document.querySelector(`[data-open="${Number(weekId) - 1}:${stageIndex}"]`);
    if (trigger) trigger.click();
  }

  function render() {
    const home = document.getElementById('home');
    const s = store();
    if (!home || !s?.getState) return;
    const state = s.getState();
    const weekId = activeWeek(state);
    if (!weekId) return;
    const week = api()?.catalog?.[weekId] || {};
    let panel = document.getElementById('home-learning-loop');
    if (!panel) {
      panel = document.createElement('div');
      panel.id = 'home-learning-loop';
      panel.className = 'card s12';
      const grid = home.querySelector('.grid');
      if (!grid) return;
      grid.insertBefore(panel, grid.children[1] || null);
    }
    const readiness = STAGES.map(stage => stageState(state, weekId, stage));
    const nextStage = STAGES.find((stage, i) => readiness[i].status !== 'complete') || null;
    const signature = `${weekId}|${readiness.map(x => `${x.status}:${x.label}`).join('|')}|${state.hubSignals?.portfolio?.evidenceCount || 0}|${nextStage || 'complete'}`;
    if (panel.dataset.signature === signature) return;
    panel.dataset.signature = signature;
    const activeStage = state.hubSignals?.nextBestAction?.label || nextStage || 'Complete';
    panel.innerHTML = `<div class="k">Learning loop</div><h2>Week ${esc(weekId)} — ${esc(week.title || 'Current learning module')}</h2><p class="muted">Your progress is tracked through one connected learning loop. Complete each stage in order; Evidence becomes reusable career proof.</p><div class="summary">${STAGES.map((stage, index) => { const x = readiness[index]; const cls = x.status === 'complete' || x.status === 'ready' ? 'ok' : ''; return `<div class="goal"><b>${index + 1}. ${LABELS[stage]}</b><small><span class="pill ${cls}">${esc(x.label)}</span></small></div>`; }).join('')}</div><div class="mission" style="margin-top:10px"><b>Next: ${esc(activeStage)}</b><div class="muted">${esc(state.hubSignals?.nextBestAction?.prompt || week.integration?.homeAction || `Continue ${activeStage.toLowerCase()} for this week.`)}</div>${nextStage ? `<button class="btn primary" id="home-learning-loop-open" style="margin-top:10px">Open ${esc(LABELS[nextStage])}</button>` : ''}</div>`;
    const openButton = document.getElementById('home-learning-loop-open');
    if (openButton && nextStage) openButton.onclick = () => openNextStage(weekId, nextStage);
  }

  function boot() {
    const s = store();
    if (!s) { setTimeout(boot, 250); return; }
    render();
    s.subscribe(() => setTimeout(render, 0));
    new MutationObserver(render).observe(document.body, { childList: true, subtree: true });
  }

  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
    else boot();
  }
})();