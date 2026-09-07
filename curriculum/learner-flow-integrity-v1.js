/*
 * Electrical Career Readiness Hub — learner flow integrity v1.
 * Read-only in-browser smoke tests for the canonical 24-week learning journey.
 * Validates stage gates, cross-week sequencing, remediation retry readiness,
 * and downstream hub signal generation without mutating learner state.
 */
import { STAGES, createLearningState, applyStageCompletion, buildHubSignals } from './learning-engine-v2.js';
import { startRemediation, completeRemediation, canRetryCheck } from './remediation-engine-v1.js';

const PANEL_ID = 'learner-flow-integrity-panel';
const esc = value => String(value ?? '').replace(/[&<>\"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '\"':'&quot;', "'":'&#39;' }[c]));

function result(name, ok, detail) { return { name, ok: Boolean(ok), detail: String(detail || '') }; }

export function runLearnerFlowSmokeTest(catalog = {}) {
  const weekIds = Object.keys(catalog || {}).sort((a, b) => Number(a) - Number(b));
  const checks = [];
  checks.push(result('24-week catalog', weekIds.length === 24 && weekIds.every((id, index) => id === String(index + 1)), `${weekIds.length}/24 canonical weeks present.`));

  let progress = createLearningState(weekIds);
  let validJourney = true;
  for (const id of weekIds) {
    const learn = applyStageCompletion(progress, id, 'learn', { learnViewedAt: 'smoke-test' });
    validJourney = validJourney && learn.ok;
    progress[id] = learn.progress;
    const apply = applyStageCompletion(progress, id, 'apply', { applicationNotes: 'Smoke-test application record.' });
    validJourney = validJourney && apply.ok;
    progress[id] = apply.progress;
    const check = applyStageCompletion(progress, id, 'check', { assessmentResult: { passed: true, completionReady: true } });
    validJourney = validJourney && check.ok;
    progress[id] = check.progress;
    const evidence = applyStageCompletion(progress, id, 'evidence', { evidence: { demonstrated: true } });
    validJourney = validJourney && evidence.ok;
    progress[id] = evidence.progress;
  }
  checks.push(result('Sequential 24-week journey', validJourney && Object.values(progress).every(p => STAGES.every(stage => p[stage])), validJourney ? 'Every week completed through Learn → Apply → Check → Evidence.' : 'At least one canonical stage gate rejected the valid sequential path.'));

  const fresh = createLearningState(weekIds);
  const invalidApply = applyStageCompletion(fresh, '1', 'apply', { applicationNotes: 'Should remain locked.' });
  const invalidCheck = applyStageCompletion(fresh, '1', 'check', { assessmentResult: { passed: true, completionReady: true } });
  const invalidEvidence = applyStageCompletion(fresh, '1', 'evidence', { evidence: { demonstrated: true } });
  checks.push(result('Stage skip protection', !invalidApply.ok && !invalidCheck.ok && !invalidEvidence.ok, 'Apply, Check and Evidence cannot bypass earlier stages.'));

  const week1Learn = applyStageCompletion(fresh, '1', 'learn', { learnViewedAt: 'smoke-test' });
  fresh['1'] = week1Learn.progress;
  const prematureWeek2 = applyStageCompletion(fresh, '2', 'learn', { learnViewedAt: 'smoke-test' });
  checks.push(result('Cross-week progression gate', !prematureWeek2.ok, 'Week 2 Learn remains locked until Week 1 Evidence is complete.'));

  const failedAssessment = {
    passed: false,
    completionReady: false,
    feedback: { failedCount: 1, reinforcement: [{ questionId: 'smoke-q1', concepts: ['controlled design reasoning'] }] }
  };
  const remediation = startRemediation(failedAssessment, null, '2026-01-01T00:00:00.000Z');
  const completed = completeRemediation(remediation, 'Reviewed the failed concept and can explain the correct reasoning.', '2026-01-01T01:00:00.000Z');
  checks.push(result('Remediation → retry gate', completed.ok && canRetryCheck(completed.remediation), completed.ok ? 'Failed Check produces targeted reinforcement and unlocks retry after a recorded note.' : completed.reason));

  const signals = buildHubSignals(catalog, progress, {}, [], []);
  checks.push(result('Downstream hub signals', signals.overallProgress === 100 && signals.completedStages === signals.totalStages, `${signals.completedStages}/${signals.totalStages} stages reflected in Home/Skills signal generation.`));

  return { ok: checks.every(check => check.ok), checks, generatedAt: new Date().toISOString() };
}

function render() {
  const canonical = window.ECRHCanonical;
  const state = canonical?.getState?.();
  const catalog = state?.hubSignals?.catalog || canonical?.catalog?.() || {};
  if (!Object.keys(catalog).length) return;
  const report = runLearnerFlowSmokeTest(catalog);
  const settings = document.getElementById('settings');
  if (!settings) return;
  let panel = document.getElementById(PANEL_ID);
  if (!panel) {
    panel = document.createElement('div');
    panel.id = PANEL_ID;
    panel.className = 'card s12';
    const grid = settings.querySelector('.grid');
    (grid || settings).appendChild(panel);
  }
  const passed = report.checks.filter(check => check.ok).length;
  panel.innerHTML = `<div class="k">Engineering validation</div><h2>Learner Flow Integrity</h2><p class="muted">Read-only smoke test of the canonical 24-week Learn → Apply → Check → Evidence journey. It does not modify learner progress.</p><div class="goal"><b>${report.ok ? 'PASS' : 'ATTENTION REQUIRED'} — ${passed}/${report.checks.length} checks</b><small>Generated ${esc(new Date(report.generatedAt).toLocaleString())}</small></div><div class="history" style="margin-top:10px">${report.checks.map(check => `<div class="goal"><b>${check.ok ? '✓' : '✕'} ${esc(check.name)}</b><small>${esc(check.detail)}</small></div>`).join('')}</div>`;
}

let renderTimer = null;
function scheduleRender() { clearTimeout(renderTimer); renderTimer = setTimeout(render, 50); }
new MutationObserver(scheduleRender).observe(document.documentElement, { subtree: true, childList: true });
document.addEventListener('DOMContentLoaded', scheduleRender, { once: true });
document.addEventListener('click', scheduleRender, true);

if (typeof window !== 'undefined') window.ECRHLearnerFlowIntegrity = { runLearnerFlowSmokeTest };
