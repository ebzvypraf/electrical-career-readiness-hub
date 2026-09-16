/*
 * Electrical Career Readiness Hub — UI Learning Engine bridge v1
 * Connects the existing browser UI state to the canonical Learning Engine v2
 * without replacing the locked application shell.
 */
import {
  DEFAULT_WEEK_IDS,
  loadCatalog,
  nextStage,
  buildIntegrationSnapshot,
  buildHubSignals
} from './learning-engine-v2.js';

const STORAGE_KEY = 'ecrh-v35';
const STAGES = ['learn', 'apply', 'check', 'evidence'];
const stageLabels = { learn: 'Learn', apply: 'Apply', check: 'Check', evidence: 'Evidence' };

function readState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (_) {
    return null;
  }
}

function toCanonicalProgress(state) {
  const weeks = Array.isArray(state?.weeks) ? state.weeks : [];
  return DEFAULT_WEEK_IDS.reduce((out, id, index) => {
    out[id] = { learn: false, apply: false, check: false, evidence: false, ...(weeks[index] || {}) };
    return out;
  }, {});
}

function journalEntries(state) {
  return Array.isArray(state?.journal)
    ? state.journal.map((entry) => ({ ...entry, weekId: entry.weekId ?? entry.week }))
    : [];
}

function portfolioEntries(state) {
  return Object.entries(state?.evidence || {}).map(([weekId, entry]) => ({
    week: Number(weekId) + 1,
    title: entry?.title || `Week ${Number(weekId) + 1} evidence`,
    ...entry
  }));
}

function contextByWeek(state) {
  const checks = state?.checks || {};
  const evidence = state?.evidence || {};
  const notes = state?.notes || {};
  return DEFAULT_WEEK_IDS.reduce((out, id, index) => {
    out[id] = {
      applicationEvidence: { notes: notes[index] || '' },
      assessmentResult: checks[index] || null,
      evidence: evidence[index] || null
    };
    return out;
  }, {});
}

function updateHome(snapshot, signals) {
  const next = signals.nextBestAction;
  const pct = Number(signals.overallProgress || 0);
  const pctEl = document.getElementById('pct');
  const barEl = document.getElementById('pbar');
  const metaEl = document.getElementById('meta');
  const nextTitle = document.getElementById('nextTitle');
  const nextType = document.getElementById('nextType');
  const coach = document.getElementById('coach');
  const coachText = document.getElementById('coachText');
  const ev = document.getElementById('evM');

  if (pctEl) pctEl.textContent = `${pct}%`;
  if (barEl) barEl.style.width = `${pct}%`;
  if (metaEl) metaEl.textContent = `${signals.completedStages} / ${signals.totalStages} activities`;
  if (ev) ev.textContent = String(snapshot.weeks.filter((week) => week.progress.evidence).length);

  if (next) {
    if (nextTitle) nextTitle.textContent = next.week;
    if (nextType) nextType.textContent = next.label;
    if (coach) coach.textContent = `Continue with ${next.label}.`;
    if (coachText) coachText.textContent = next.prompt || `Complete ${next.label} before advancing.`;
  } else {
    if (nextTitle) nextTitle.textContent = 'Program complete';
    if (nextType) nextType.textContent = 'Complete';
    if (coach) coach.textContent = 'You completed the pathway.';
    if (coachText) coachText.textContent = 'Review your portfolio and prepare for senior-role interviews.';
  }
}

function updateSkills(signals) {
  const root = document.getElementById('skills');
  if (!root || !Array.isArray(signals.demonstratedCapability)) return;
  const items = signals.demonstratedCapability;
  root.innerHTML = items.map((item) => {
    const readiness = Math.max(0, Math.min(100, Number(item.readiness || 0)));
    const score = Number(item.score || 0);
    const target = Number(item.target || 5);
    const recommended = item.recommendedWeekId
      ? `Week ${item.recommendedWeekId} • ${stageLabels[item.recommendedStage] || item.recommendedStage || 'Review'}`
      : 'No immediate gap';
    return `<div class="skillrow"><div class="skillhead"><span>${escapeHtml(item.skill)}</span><b>${score}/${target}</b></div><div class="bar"><span style="width:${readiness}%"></span></div><small class="muted">${readiness}% readiness • ${escapeHtml(recommended)}</small></div>`;
  }).join('') || '<div class="empty">Complete learning stages to build competency signals.</div>';
}

function updateGaps(signals) {
  const root = document.getElementById('gaps');
  if (!root) return;
  const gaps = Array.isArray(signals.prioritySkillGaps) ? signals.prioritySkillGaps.slice(0, 4) : [];
  root.innerHTML = gaps.map((gap) => `<div class="goal"><b>${escapeHtml(gap.skill)}</b><small>${gap.readiness}% readiness • ${escapeHtml(gap.reason || 'Build stronger demonstrated capability.')}</small></div>`).join('') || '<div class="empty">No priority gaps identified by the learning engine.</div>';
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
}

async function refresh(catalog) {
  const state = readState();
  if (!state) return;
  const progressByWeek = toCanonicalProgress(state);
  const contexts = contextByWeek(state);
  const journals = journalEntries(state);
  const portfolio = portfolioEntries(state);
  const ids = Object.keys(catalog).sort((a, b) => Number(a) - Number(b));
  const snapshot = buildIntegrationSnapshot(catalog, progressByWeek, contexts);
  const signals = buildHubSignals(catalog, progressByWeek, contexts, journals, portfolio);
  // Keep the engine's next-stage decision visible even if a consumer changes its ordering.
  signals.nextBestAction = signals.nextBestAction || (() => {
    const next = nextStage(progressByWeek, ids);
    return next ? { weekId: next.weekId, stage: next.stage, label: stageLabels[next.stage] } : null;
  })();
  updateHome(snapshot, signals);
  updateSkills(signals);
  updateGaps(signals);
}

async function init() {
  try {
    const catalog = await loadCatalog();
    await refresh(catalog);
    const originalSetItem = localStorage.setItem.bind(localStorage);
    localStorage.setItem = function(key, value) {
      const result = originalSetItem(key, value);
      if (key === STORAGE_KEY) queueMicrotask(() => refresh(catalog));
      return result;
    };
    window.addEventListener('storage', (event) => {
      if (event.key === STORAGE_KEY) refresh(catalog);
    });
    window.ECRHLearningEngineBridge = { refresh: () => refresh(catalog), version: '1.0.0' };
  } catch (error) {
    console.warn('[ECRH] Learning Engine bridge unavailable:', error);
  }
}

init();
