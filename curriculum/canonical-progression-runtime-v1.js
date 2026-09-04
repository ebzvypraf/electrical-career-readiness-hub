/*
 * Electrical Career Readiness Hub — canonical progression runtime v2.
 * Bridges the existing production shell to the canonical 24-week catalog and
 * authoritative Learn → Apply → Check → Evidence transaction.
 */
import { loadCanonicalCatalog, loadAssessmentCatalog } from './canonical-catalog-v1.js';
import { commitStageCompletion } from './learning-engine-v2.js';
import { scoreQuestionSet, canCompleteCheck } from './assessment-engine-v1.js';

const STATE_KEY = 'ecrh-v35';
const STAGES = ['learn', 'apply', 'check', 'evidence'];
let catalog = {};
let assessments = {};
let originalComplete = null;
let installed = false;
let rendering = false;

const esc = value => String(value ?? '').replace(/[&<>\"']/g, char => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '\"': '&quot;', "'": '&#39;'
}[char]));

function readState() {
  try { return JSON.parse(localStorage.getItem(STATE_KEY) || 'null') || {}; }
  catch (_) { return {}; }
}
function writeState(state) {
  localStorage.setItem(STATE_KEY, JSON.stringify(state));
  try { window.dispatchEvent(new StorageEvent('storage', { key: STATE_KEY, newValue: JSON.stringify(state) })); } catch (_) {}
}
function progressFromState(state) {
  const weeks = Array.isArray(state.weeks) ? state.weeks : [];
  const result = {};
  for (let i = 1; i <= 24; i += 1) result[String(i)] = { ...(weeks[i - 1] || {}) };
  return result;
}
function contextForWeek(state, index) {
  return {
    applicationNotes: String(state.notes?.[index] || ''),
    assessmentResult: state.checks?.[index] ? {
      ...state.checks[index],
      completionReady: Boolean(state.checks[index].completionReady ?? state.checks[index].passed)
    } : null,
    evidence: state.evidence?.[index] || null
  };
}
function questionsFor(weekNumber) {
  const authored = assessments[String(weekNumber)];
  if (Array.isArray(authored) && authored.length) return authored;
  return Array.isArray(catalog[String(weekNumber)]?.check?.questions) ? catalog[String(weekNumber)].check.questions : [];
}
function stageFromModal() {
  const node = document.querySelector('#modalCard .k');
  const match = node?.textContent?.match(/Week\s+(\d+)\s+•\s+(Learn|Apply|Check|Evidence)/i);
  return match ? { week: Number(match[1]), stage: match[2].toLowerCase() } : null;
}
function renderModal() {
  if (rendering) return;
  const target = stageFromModal();
  if (!target || !catalog[String(target.week)]) return;
  const card = document.getElementById('modalCard');
  if (!card) return;
  rendering = true;
  try {
    const state = readState();
    const week = catalog[String(target.week)];
    const index = target.week - 1;
    const progress = state.weeks?.[index] || {};
    const evidence = state.evidence?.[index];
    const check = state.checks?.[index];
    let body = '';

    if (target.stage === 'learn') {
      body = `<div class="learning-hero"><b>Objective</b><p>${esc(week.objective)}</p></div>` +
        `<div class="learning-card"><h3>${esc(week.learn?.heading || 'What to understand')}</h3>` +
        `<ul>${(week.learn?.concepts || week.learn?.bullets || []).map(x => `<li>${esc(x)}</li>`).join('')}</ul>` +
        `<p><b>Senior reasoning:</b> ${esc(week.learn?.seniorReasoning || week.learn?.takeaway || '')}</p></div>`;
    }
    if (target.stage === 'apply') {
      body = `<div class="learning-hero"><b>Scenario</b><p>${esc(week.apply?.scenario || '')}</p></div>` +
        `<div class="learning-grid"><div class="learning-card"><h3>Do this</h3><ol>${(week.apply?.tasks || []).map(x => `<li>${esc(x)}</li>`).join('')}</ol></div>` +
        `<div class="learning-card"><h3>Deliverable</h3><p>${esc(week.apply?.deliverable || '')}</p><span class="tag">Practical</span> <span class="tag">Sanitized</span> <span class="tag">Reviewable</span></div></div>` +
        `<div class="evidence-form"><label>Application notes<textarea id="canonical-note" placeholder="Record decisions, assumptions, interfaces and verification.">${esc(state.notes?.[index] || '')}</textarea></label><button class="btn" id="canonical-save-note">Save application notes</button></div>`;
    }
    if (target.stage === 'check') {
      const questions = questionsFor(target.week);
      body = `<div class="learning-hero"><b>Knowledge check</b><p>${esc(week.check?.passRule || 'Answer all questions correctly to unlock Evidence.')}</p></div>`;
      body += questions.map((q, n) => {
        const options = Array.isArray(q.options) && Number.isInteger(q.correctIndex)
          ? q.options.map((option, oi) => `<label><input type="radio" name="canonical-q${n}" value="${oi}"> ${esc(option)}</label>`).join('')
          : `<textarea id="canonical-answer-${n}" placeholder="Explain your reasoning, inputs, checks, interfaces and approval considerations."></textarea>`;
        return `<div class="question"><b>${n + 1}. ${esc(q.prompt || q.q)}</b>${options}</div>`;
      }).join('');
      body += `<button class="btn primary" style="margin-top:12px" id="canonical-score">Score check</button>`;
      if (check) body += `<div class="result ${check.passed ? '' : 'warn'}"><b>Last score: ${esc(check.score)}/${esc(check.total)}</b> — ${check.passed ? 'Pass. Evidence is available.' : 'Not yet passed.'}</div>`;
    }
    if (target.stage === 'evidence') {
      body = `<div class="learning-hero"><b>Evidence requirement</b><p>${esc(week.evidence?.prompt || '')}</p><div class="rubric">${(week.evidence?.criteria || []).map((x, n) => `<div class="rubric-row"><span>${n + 1}. ${esc(x)}</span><span class="tag">Required</span></div>`).join('')}</div></div>` +
        (evidence ? `<div class="saved"><b>Evidence saved</b><p>${esc(evidence.title)}</p><div>${esc(evidence.description)}</div></div>` : '') +
        `<div class="evidence-form"><label>Evidence title<input id="canonical-et" value="${esc(evidence?.title || '')}" placeholder="e.g. sanitized design review record"></label><label>What does it prove?<textarea id="canonical-ed" placeholder="Explain your contribution, reasoning and verification.">${esc(evidence?.description || '')}</textarea></label><button class="btn primary" id="canonical-save-evidence">Save & link evidence</button></div>`;
    }

    const completed = Boolean(progress[target.stage]);
    card.innerHTML = `<div style="display:flex;justify-content:space-between;gap:10px"><div><div class="k">Week ${target.week} • ${target.stage.charAt(0).toUpperCase() + target.stage.slice(1)}</div><h2>${esc(week.title)}</h2><span class="pill">${esc(week.phase)}</span></div><button class="btn" id="canonical-close">Close</button></div>` +
      body + `<div class="mission" style="margin-top:12px"><b>Stage gate</b><p class="muted">${completed ? 'Completed.' : 'Complete the required work honestly before marking this stage complete.'}</p></div>` +
      `<button class="btn primary" id="canonical-complete">${completed ? 'Completed — review' : 'Mark stage complete'}</button>`;

    document.getElementById('canonical-close').onclick = () => window.ECRH?.close?.();
    document.getElementById('canonical-complete').onclick = () => window.ECRH?.complete?.(index, STAGES.indexOf(target.stage));
    if (target.stage === 'apply') document.getElementById('canonical-save-note').onclick = () => {
      const next = readState(); next.notes = next.notes || {}; next.notes[index] = document.getElementById('canonical-note').value.trim(); writeState(next); renderModal();
    };
    if (target.stage === 'check') document.getElementById('canonical-score').onclick = () => scoreCheck(target.week, questionsFor(target.week));
    if (target.stage === 'evidence') document.getElementById('canonical-save-evidence').onclick = () => {
      const title = document.getElementById('canonical-et').value.trim();
      const description = document.getElementById('canonical-ed').value.trim();
      if (!title || !description) { alert('Add an evidence title and description first.'); return; }
      const next = readState(); next.evidence = next.evidence || {}; next.evidence[index] = { title, description, date: new Date().toISOString() }; writeState(next); renderModal();
    };
  } finally { rendering = false; }
}
function scoreCheck(weekNumber, questions) {
  const responses = {};
  questions.forEach((q, index) => {
    const choice = document.querySelector(`input[name="canonical-q${index}"]:checked`);
    const answer = document.getElementById(`canonical-answer-${index}`);
    responses[q.id || `q${index + 1}`] = choice ? choice.value : (answer ? answer.value : '');
  });
  const result = scoreQuestionSet(questions, responses);
  const state = readState(); state.checks = state.checks || {};
  state.checks[weekNumber - 1] = { ...result, passed: Boolean(canCompleteCheck(result)), completionReady: Boolean(canCompleteCheck(result)), date: new Date().toISOString() };
  writeState(state); renderModal();
}
function installCompletionBridge() {
  if (installed || !window.ECRH) return;
  installed = true;
  originalComplete = window.ECRH.complete;
  window.ECRH.complete = function canonicalComplete(index, stageIndex) {
    const weekId = String(Number(index) + 1);
    const stage = STAGES[Number(stageIndex)];
    if (!catalog[weekId] || !stage) return originalComplete?.(index, stageIndex);
    const state = readState();
    const contextByWeek = Object.fromEntries(Array.from({ length: 24 }, (_, i) => [String(i + 1), contextForWeek(state, i)]));
    const result = commitStageCompletion({
      catalog,
      progressByWeek: progressFromState(state),
      weekId,
      stage,
      context: contextForWeek(state, index),
      contextByWeek,
      journalEntries: Array.isArray(state.journal) ? state.journal : [],
      portfolioEntries: Object.values(state.evidence || {})
    });
    if (!result.ok) { alert(result.reason); return; }
    state.weeks = Array.from({ length: 24 }, (_, i) => ({ ...(state.weeks?.[i] || {}), ...(result.progressByWeek?.[String(i + 1)] || {}) }));
    writeState(state);
    window.ECRH.close?.();
    window.location.reload();
  };
}
function installObserver() {
  const observer = new MutationObserver(() => {
    if (!rendering && document.getElementById('modal')?.classList.contains('show')) renderModal();
  });
  observer.observe(document.body, { childList: true, subtree: true });
}
async function boot() {
  try {
    [catalog, assessments] = await Promise.all([loadCanonicalCatalog(), loadAssessmentCatalog()]);
    installCompletionBridge();
    window.ECRHCanonical = { ready: true, catalog, assessments, commitStageCompletion, scoreCheck };
    installObserver();
    if (document.getElementById('modal')?.classList.contains('show')) renderModal();
  } catch (error) { console.warn('Canonical progression runtime unavailable:', error); }
}
boot();
