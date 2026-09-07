/*
 * Electrical Career Readiness Hub — learner flow integrity v1.1.
 * Read-only smoke tests for the canonical 24-week learning journey.
 * Validates both the simulated engine contract and the learner's persisted
 * canonical state without mutating progress.
 */
import { STAGES, createLearningState, applyStageCompletion, buildHubSignals } from './learning-engine-v2.js';
import { startRemediation, completeRemediation, canRetryCheck } from './remediation-engine-v1.js';

const PANEL_ID = 'learner-flow-integrity-panel';
const esc = value => String(value ?? '').replace(/[&<>\"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '\"':'&quot;', "'":'&#39;' }[c]));

function result(name, ok, detail) { return { name, ok: Boolean(ok), detail: String(detail || '') }; }
function weekShape(weekIds) { return Object.fromEntries(weekIds.map(id => [String(id), { week: Number(id), title: `Week ${id}`, skills: [], integration: {} }])); }

function persistedStateChecks(state, ids) {
  const checks = [];
  const progress = state?.progressByWeek || {};
  const contexts = state?.contextByWeek || {};
  const invalid = [];

  ids.forEach(id => {
    const p = progress[id] || {};
    if (p.apply && !p.learn) invalid.push(`Week ${id}: Apply without Learn`);
    if (p.check && !p.apply) invalid.push(`Week ${id}: Check without Apply`);
    if (p.evidence && (!p.apply || !p.check)) invalid.push(`Week ${id}: Evidence without Apply + Check`);

    const check = contexts[id]?.assessmentResult;
    const application = contexts[id]?.applicationEvidence;
    const evidence = contexts[id]?.evidence;
    const remediation = contexts[id]?.remediation;
    if (p.apply && !application) invalid.push(`Week ${id}: Apply marked complete without application record`);
    if (p.check && !(check?.passed && check?.completionReady)) invalid.push(`Week ${id}: Check marked complete without passed assessment`);
    if (p.evidence && !(evidence?.demonstrated || (evidence?.title?.trim() && evidence?.description?.trim()))) invalid.push(`Week ${id}: Evidence marked complete without evidence record`);
    if (remediation?.status === 'complete' && !(check?.passed)) invalid.push(`Week ${id}: remediation complete without passed Check`);
  });

  ids.slice(1).forEach((id, index) => {
    const previous = ids[index];
    if (progress[id]?.learn && !progress[previous]?.evidence) invalid.push(`Week ${id}: Learn unlocked before Week ${previous} Evidence`);
  });

  checks.push(result('Persisted canonical state integrity', invalid.length === 0, invalid.length ? `${invalid.length} issue(s): ${invalid.slice(0, 3).join('; ')}${invalid.length > 3 ? '…' : ''}` : 'No impossible stage, assessment, evidence, remediation, or cross-week states detected.'));
  return checks;
}

export function runLearnerFlowSmokeTest(weekIds = [], state = null) {
  const ids = weekIds.map(String).sort((a, b) => Number(a) - Number(b));
  const checks = [];
  checks.push(result('24-week canonical state', ids.length === 24 && ids.every((id, index) => id === String(index + 1)), `${ids.length}/24 canonical week state records present.`));

  let progress = createLearningState(ids);
  let validJourney = true;
  for (const id of ids) {
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

  const fresh = createLearningState(ids);
  const invalidApply = applyStageCompletion(fresh, '1', 'apply', { applicationNotes: 'Should remain locked.' });
  const invalidCheck = applyStageCompletion(fresh, '1', 'check', { assessmentResult: { passed: true, completionReady: true } });
  const invalidEvidence = applyStageCompletion(fresh, '1', 'evidence', { evidence: { demonstrated: true } });
  checks.push(result('Stage skip protection', !invalidApply.ok && !invalidCheck.ok && !invalidEvidence.ok, 'Apply, Check and Evidence cannot bypass earlier stages.'));

  const week1Learn = applyStageCompletion(fresh, '1', 'learn', { learnViewedAt: 'smoke-test' });
  fresh['1'] = week1Learn.progress;
  const prematureWeek2 = applyStageCompletion(fresh, '2', 'learn', { learnViewedAt: 'smoke-test' });
  checks.push(result('Cross-week progression gate', !prematureWeek2.ok, 'Week 2 Learn remains locked until Week 1 Evidence is complete.'));

  const failedAssessment = { passed: false, completionReady: false, feedback: { failedCount: 1, reinforcement: [{ questionId: 'smoke-q1', concepts: ['controlled design reasoning'] }] } };
  const remediation = startRemediation(failedAssessment, null, '2026-01-01T00:00:00.000Z');
  const completed = completeRemediation(remediation, 'Reviewed the failed concept and can explain the correct reasoning.', '2026-01-01T01:00:00.000Z');
  checks.push(result('Remediation → retry gate', completed.ok && canRetryCheck(completed.remediation), completed.ok ? 'Failed Check produces targeted reinforcement and unlocks retry after a recorded note.' : completed.reason));

  const simulatedContext = Object.fromEntries(ids.map(id => [id, { assessmentResult: { passed: true, completionReady: true }, evidence: { demonstrated: true } }]));
  const signals = buildHubSignals(weekShape(ids), progress, simulatedContext, [], []);
  checks.push(result('Downstream hub signals', signals.overallProgress === 100 && signals.completedStages === signals.totalStages, `${signals.completedStages}/${signals.totalStages} simulated stages reflected in Home/Skills signal generation.`));

  if (state) checks.push(...persistedStateChecks(state, ids));
  return { ok: checks.every(check => check.ok), checks, generatedAt: new Date().toISOString() };
}

function render() {
  const state = window.ECRHCanonical?.getState?.();
  const weekIds = Object.keys(state?.progressByWeek || {}).sort((a, b) => Number(a) - Number(b));
  if (!weekIds.length) return;
  const report = runLearnerFlowSmokeTest(weekIds, state);
  const settings = document.getElementById('settings');
  if (!settings) return;
  let panel = document.getElementById(PANEL_ID);
  if (!panel) { panel = document.createElement('div'); panel.id = PANEL_ID; panel.className = 'card s12'; const grid = settings.querySelector('.grid'); (grid || settings).appendChild(panel); }
  const passed = report.checks.filter(check => check.ok).length;
  panel.innerHTML = `<div class="k">Engineering validation</div><h2>Learner Flow Integrity</h2><p class="muted">Read-only smoke test of the canonical 24-week Learn → Apply → Check → Evidence journey. It also audits the persisted learner state and does not modify progress.</p><div class="goal"><b>${report.ok ? 'PASS' : 'ATTENTION REQUIRED'} — ${passed}/${report.checks.length} checks</b><small>Generated ${esc(new Date(report.generatedAt).toLocaleString())}</small></div><div class="history" style="margin-top:10px">${report.checks.map(check => `<div class="goal"><b>${check.ok ? '✓' : '✕'} ${esc(check.name)}</b><small>${esc(check.detail)}</small></div>`).join('')}</div>`;
}

let renderTimer = null;
function scheduleRender() { clearTimeout(renderTimer); renderTimer = setTimeout(render, 50); }
new MutationObserver(scheduleRender).observe(document.documentElement, { subtree: true, childList: true });
document.addEventListener('DOMContentLoaded', scheduleRender, { once: true });
document.addEventListener('click', scheduleRender, true);

if (typeof window !== 'undefined') window.ECRHLearnerFlowIntegrity = { runLearnerFlowSmokeTest };
