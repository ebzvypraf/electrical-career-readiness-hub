/* Electrical Career Readiness Hub — Home learning-loop status v2.5.
 * Surfaces the canonical active-week Learn → Apply → Check → Evidence state on Home,
 * plus the downstream Journal/Portfolio proof produced by the same canonical store.
 * Additive UI only; canonical learning-state store remains the source of truth.
 * Failed Checks surface their canonical remediation state so Home points the learner
 * back to reinforcement instead of presenting a generic Journal/Portfolio summary.
 * v2.5 uses the same deterministic chronological Check ordering as the assessment
 * history bridge and normalizes persisted pass/fail values before rendering status.
 */
(function () {
  'use strict';

  const STAGES = ['learn', 'apply', 'check', 'evidence'];
  const LABELS = { learn: 'Learn', apply: 'Apply', check: 'Check', evidence: 'Evidence' };
  const esc = value => String(value ?? '').replace(/[&<>\"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '\"':'&quot;', "'":'&#39;' }[c]));

  function api() { return typeof window !== 'undefined' ? window.ECRHCanonical : null; }
  function store() { const a = api(); return typeof a?.store === 'function' ? a.store() : a?.store || null; }

  function normalizePassed(value, status = '') {
    const normalized = String(value ?? '').toLowerCase();
    if (value === true || value === 1 || ['true', 'passed', 'pass'].includes(normalized)) return true;
    if (value === false || value === 0 || ['false', 'failed', 'fail'].includes(normalized)) return false;
    const normalizedStatus = String(status || '').toLowerCase();
    if (['passed', 'pass', 'complete', 'completed', 'success', 'successful'].includes(normalizedStatus)) return true;
    if (['failed', 'fail', 'incomplete', 'unsuccessful'].includes(normalizedStatus)) return false;
    return null;
  }

  function normalizeHistory(history) {
    const records = Array.isArray(history)
      ? history.filter(item => item && typeof item === 'object').map((item, index) => ({ item, index }))
      : [];
    return records.sort((a, b) => {
      const aTime = Date.parse(String(a.item?.completedAt || a.item?.createdAt || a.item?.timestamp || a.item?.date || ''));
      const bTime = Date.parse(String(b.item?.completedAt || b.item?.createdAt || b.item?.timestamp || b.item?.date || ''));
      const aHasTime = Number.isFinite(aTime);
      const bHasTime = Number.isFinite(bTime);
      if (aHasTime && bHasTime && aTime !== bTime) return aTime - bTime;
      if (aHasTime !== bHasTime) return aHasTime ? -1 : 1;
      const aAttempt = Number(a.item?.attemptNumber);
      const bAttempt = Number(b.item?.attemptNumber);
      const aHasAttempt = Number.isFinite(aAttempt);
      const bHasAttempt = Number.isFinite(bAttempt);
      if (aHasAttempt && bHasAttempt && aAttempt !== bAttempt) return aAttempt - bAttempt;
      if (aHasAttempt !== bHasAttempt) return aHasAttempt ? -1 : 1;
      return a.index - b.index;
    }).map(record => record.item);
  }

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
    if (stage === 'check') {
      const history = normalizeHistory(context.assessmentHistory);
      const latest = history[history.length - 1] || context.assessmentResult || null;
      const passed = normalizePassed(latest?.passed, latest?.status);
      if (passed === false) return { status: 'remediation', label: 'Reinforcement needed' };
      if (passed === true) return { status: 'ready', label: 'Passed' };
      return { status: 'pending', label: 'Pending' };
    }
    if (stage === 'evidence') {
      const e = context.evidence || {};
      return { status: e.evidenceQuality === 'high' ? 'ready' : (e.title && e.description ? 'in-progress' : 'pending'), label: e.evidenceQuality === 'high' ? 'High-quality proof' : (e.title ? 'Captured' : 'Pending') };
    }
    return { status: context.learnViewedAt ? 'ready' : 'pending', label: context.learnViewedAt ? 'Viewed' : 'Pending' };
  }

  function openNextStage(weekId, stage) {
    const id = String(weekId);
    const stageName = String(stage || '').toLowerCase();
    if (!STAGES.includes(stageName)) return false;
    const canonicalSelector = `[data-canonical-open="${esc(id)}:${esc(stageName)}"]`;
    const direct = document.querySelector(canonicalSelector);
    if (direct) { direct.click(); return true; }
    const stageIndex = STAGES.indexOf(stageName);
    const legacy = document.querySelector(`[data-open="${Number(id) - 1}:${stageIndex}"]`);
    if (legacy) { legacy.click(); return true; }
    const weeks = Array.from(document.querySelectorAll('.week'));
    const target = weeks.find(node => {
      const no = node.querySelector('.wno');
      return no && Number((String(no.textContent).match(/\d+/) || [])[0]) === Number(id);
    });
    if (!target) return false;
    const buttons = Array.from(target.querySelectorAll('button'));
    const button = buttons.find(item => new RegExp('^\\s*' + stageName + '\\b', 'i').test(String(item.textContent || '')))
      || buttons.find(item => String(item.textContent || '').toLowerCase().includes(stageName));
    if (button) { button.click(); return true; }
    return false;
  }

  function render() {
    const home = document.getElementById('home');
    const s = store();
    if (!home || !s?.getState) return;
    const state = s.getState();
    const weekId = activeWeek(state);
    if (!weekId) return;
    const week = api()?.catalog?.[weekId] || {};
    const context = state.contextByWeek?.[weekId] || {};
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
    const checkHistory = normalizeHistory(context.assessmentHistory);
    const latestCheck = checkHistory[checkHistory.length - 1] || context.assessmentResult || null;
    const checkFailed = nextStage === 'check' && normalizePassed(latestCheck?.passed, latestCheck?.status) === false;
    const weekJournal = (state.journalEntries || []).filter(entry => String(entry?.weekId || '') === String(weekId));
    const weekPortfolio = (state.portfolioEntries || []).filter(entry => String(entry?.week) === String(weekId));
    const journalCount = weekJournal.length;
    const portfolioCount = weekPortfolio.length;
    const demonstrated = weekPortfolio.some(entry => entry?.demonstrated === true || entry?.reviewStatus === 'demonstrated');
    const remediation = context.remediation || {};
    const remediationConcepts = Array.isArray(remediation.concepts) ? remediation.concepts.filter(Boolean).slice(0, 3) : [];
    const signature = `${weekId}|${readiness.map(x => `${x.status}:${x.label}`).join('|')}|${journalCount}|${portfolioCount}|${demonstrated}|${state.hubSignals?.overallProgress || 0}|${nextStage || 'complete'}|${checkFailed}|${remediationConcepts.join(',')}`;
    if (panel.dataset.signature === signature) return;
    panel.dataset.signature = signature;

    const activeStage = checkFailed ? 'Remediation' : (state.hubSignals?.nextBestAction?.label || nextStage || 'Complete');
    const downstream = checkFailed
      ? `Latest Check was not passed${remediationConcepts.length ? `; reinforce ${remediationConcepts.join(', ')}` : ''}, then retry the Check.`
      : demonstrated
        ? 'Portfolio proof is demonstrated for this week.'
        : portfolioCount
          ? `Portfolio evidence captured: ${portfolioCount} record${portfolioCount === 1 ? '' : 's'}.`
          : journalCount
            ? `Journal trail recorded: ${journalCount} entr${journalCount === 1 ? 'y' : 'ies'}.`
            : 'Journal and Portfolio will update from the canonical stage actions.';

    const actionStage = checkFailed ? 'check' : nextStage;
    panel.innerHTML = `<div class="k">Learning loop</div><h2>Week ${esc(weekId)} — ${esc(week.title || 'Current learning module')}</h2><p class="muted">Your progress is tracked through one connected learning loop. Complete each stage in order; Evidence becomes reusable career proof.</p><div class="summary">${STAGES.map((stage, index) => { const x = readiness[index]; const cls = x.status === 'complete' || x.status === 'ready' ? 'ok' : ''; return `<div class="goal"><b>${index + 1}. ${LABELS[stage]}</b><small><span class="pill ${cls}">${esc(x.label)}</span></small></div>`; }).join('')}</div><div class="mission" style="margin-top:10px"><b>Next: ${esc(activeStage)}</b><div class="muted">${esc(checkFailed ? (remediation.nextAction || `Complete targeted reinforcement for Week ${weekId}, then retry the Check.`) : (state.hubSignals?.nextBestAction?.prompt || week.integration?.homeAction || `Continue ${activeStage.toLowerCase()} for this week.`))}</div><div class="muted" style="margin-top:7px"><b>Downstream proof:</b> ${esc(downstream)}</div>${actionStage ? `<button class="btn primary" id="home-learning-loop-open" style="margin-top:10px">Open ${esc(checkFailed ? 'Check' : LABELS[actionStage])}</button>` : ''}</div>`;
    const openButton = document.getElementById('home-learning-loop-open');
    if (openButton && actionStage) openButton.onclick = () => {
      if (!openNextStage(weekId, actionStage)) {
        const courseNav = document.querySelector('[data-page="course"]');
        if (courseNav) courseNav.click();
      }
    };
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
