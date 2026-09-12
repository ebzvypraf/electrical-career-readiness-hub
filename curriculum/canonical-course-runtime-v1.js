/*
 * Electrical Career Readiness Hub — canonical Course runtime v1.
 * Replaces the legacy Course renderer with the authored 24-week catalog and
 * routes Learn → Apply → Check → Evidence through the canonical state store.
 */
import { loadCanonicalCatalog } from './canonical-catalog-v1.js';
import { createLearningStateStore } from './learning-state-store-v1.js';
import { commitStageCompletion, isStageUnlocked, STAGES, STAGE_LABELS } from './learning-engine-v2.js';

const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
const stageCopy = {
  learn: 'Build understanding, design intent and senior reasoning.',
  apply: 'Complete the practical scenario and record decisions.',
  check: 'Prove your reasoning with the authored knowledge check.',
  evidence: 'Capture sanitized proof linked to Apply and Check.'
};

let catalog = {};
let store = null;
let rendering = false;
let lastCanonicalSignature = '';

function legacyState() {
  try { return JSON.parse(localStorage.getItem('ecrh-v35') || '{}'); } catch { return {}; }
}
function state() { return store?.getState() || { progressByWeek:{}, contextByWeek:{}, journalEntries:[], portfolioEntries:[], hubSignals:{} }; }
function progressFor(id) { return state().progressByWeek?.[String(id)] || { learn:false, apply:false, check:false, evidence:false }; }
function contextFor(id) { return state().contextByWeek?.[String(id)] || {}; }
function completedCount() { return Object.values(state().progressByWeek || {}).reduce((n,p) => n + STAGES.filter(s => p?.[s]).length, 0); }
function nextCanonical() { return state().hubSignals?.nextBestAction || null; }

function commit(stage, weekId, context = {}) {
  const current = state();
  const result = commitStageCompletion({
    catalog,
    progressByWeek: current.progressByWeek,
    weekId: String(weekId),
    stage,
    context,
    contextByWeek: current.contextByWeek,
    journalEntries: current.journalEntries,
    portfolioEntries: current.portfolioEntries
  });
  if (!result.ok) { alert(result.reason); return false; }
  store.replaceProgress(result.progressByWeek);
  if (result.contextByWeek?.[String(weekId)]) store.updateStageContext(String(weekId), result.contextByWeek[String(weekId)]);
  return true;
}

function syncLegacyView() {
  const s = state();
  const h = s.hubSignals || {};
  const next = h.nextBestAction;
  const pct = Number(h.overallProgress || 0);
  const set = (id, value) => { const el = document.getElementById(id); if (el) el.textContent = value; };
  set('pct', pct + '%');
  const bar = document.getElementById('pbar'); if (bar) bar.style.width = pct + '%';
  set('meta', `${h.completedStages || completedCount()} / ${h.totalStages || 96} activities`);
  set('evM', String(h.studyMomentum?.portfolioCount || s.portfolioEntries?.length || 0));
  set('hours', Number(h.studyMomentum?.studyHoursThisWeek || 0).toFixed(1) + 'h');
  set('nextTitle', next ? `Week ${next.weekId} — ${next.week}` : 'Program complete');
  set('nextType', next ? STAGE_LABELS[next.stage] : 'Complete');
  set('coachText', next?.prompt || (next ? stageCopy[next.stage] : 'Review your portfolio and prepare for senior-role interviews.'));
  const gaps = (h.prioritySkillGaps || []).slice(0,4);
  const gapHtml = gaps.length ? gaps.map(g => `<div class="goal"><b>${esc(g.skill)}</b><small>${g.readiness}% readiness${g.recommendedWeekId ? ` • Week ${g.recommendedWeekId} ${esc(g.recommendedStageLabel || '')}` : ''}</small></div>`).join('') : '<div class="empty">No priority gaps detected.</div>';
  const gapEl = document.getElementById('gaps'); if (gapEl) gapEl.innerHTML = gapHtml;
  const adviceEl = document.getElementById('advice'); if (adviceEl) adviceEl.innerHTML = gapHtml;
  renderCanonicalSkills();
}

function renderCanonicalSkills() {
  const el = document.getElementById('skills');
  if (!el) return;
  const skills = state().hubSignals?.skills || [];
  if (!skills.length) return;
  el.innerHTML = skills.map(item => `<div class="skillrow">
    <div class="skillhead"><span>${esc(item.skill)}</span><b>${item.score}/5 • ${item.readiness}% readiness</b></div>
    <div class="bar"><span style="width:${Math.max(0,Math.min(100,Number(item.readiness)||0))}%"></span></div>
    <small class="muted">Learn ${item.coverage?.learn || 0}% • Apply ${item.coverage?.apply || 0}% • Check ${item.coverage?.check || 0}% • Evidence ${item.coverage?.evidence || 0}% • ${item.evidenceCount || 0} demonstrated week(s)</small>
  </div>`).join('');
}

function renderCourse() {
  const el = document.getElementById('modules');
  if (!el || !Object.keys(catalog).length || rendering) return;
  rendering = true;
  const next = nextCanonical();
  el.innerHTML = Object.entries(catalog).map(([id, module]) => {
    const p = progressFor(id);
    const done = STAGES.filter(s => p[s]).length;
    const open = String(next?.weekId || '1') === String(id);
    const skills = (module.skillTargets || module.skills || []).map(s => `<span class="tag">${esc(s)}</span>`).join(' ');
    return `<div class="week ${open ? 'open' : ''}" data-canonical-week="${id}">
      <button class="weekhead" aria-expanded="${open}"><span class="wno">W${String(id).padStart(2,'0')}</span><span class="phase">${esc(module.phase)}</span><span class="wtitle">${esc(module.title)}</span><span class="wcount">${done}/4</span></button>
      <div class="weekbody"><div style="padding:10px 0 4px"><span class="pill">${module.estimatedHours || 6}h estimated</span> ${skills}</div>
      ${STAGES.map((stage, index) => {
        const unlocked = isStageUnlocked(state().progressByWeek, id, stage);
        const complete = Boolean(p[stage]);
        return `<div class="stage"><span>${complete ? '✓' : index + 1}</span><b>${STAGE_LABELS[stage]}</b><span>${stageCopy[stage]}</span><button class="btn ${complete ? '' : (unlocked ? 'primary' : '')}" data-canonical-open="${id}:${stage}" ${unlocked ? '' : 'disabled'}>${complete ? 'Review' : (unlocked ? 'Open' : 'Locked')}</button></div>`;
      }).join('')}
      </div></div>`;
  }).join('');
  el.querySelectorAll('.weekhead').forEach(button => button.onclick = () => { const card = button.parentElement; card.classList.toggle('open'); button.setAttribute('aria-expanded', card.classList.contains('open')); });
  el.querySelectorAll('[data-canonical-open]').forEach(button => button.onclick = () => { const [id, stage] = button.dataset.canonicalOpen.split(':'); openStage(id, stage); });
  rendering = false;
}

function modal(title, body) {
  const card = document.getElementById('modalCard');
  if (!card) return;
  card.innerHTML = `<div style="display:flex;justify-content:space-between;gap:10px"><div>${title}</div><button class="btn" id="canonicalClose">Close</button></div>${body}`;
  document.getElementById('modal')?.classList.add('show');
  document.getElementById('canonicalClose').onclick = close;
}
function close() { document.getElementById('modal')?.classList.remove('show'); }

function openStage(weekId, stage) {
  const id = String(weekId);
  const module = catalog[id];
  if (!module || !STAGES.includes(stage)) return;
  if (!isStageUnlocked(state().progressByWeek, id, stage)) { alert('Complete the previous stage first.'); return; }
  const p = progressFor(id);
  const c = contextFor(id);
  let body = '';
  if (stage === 'learn') {
    body = `<div class="learning-hero"><b>Objective</b><p>${esc(module.learn?.objective || module.objective)}</p></div>
      <div class="learning-grid"><div class="learning-card"><h3>Core concepts</h3><ul>${(module.learn?.concepts || []).map(x => `<li>${esc(x)}</li>`).join('')}</ul></div><div class="learning-card"><h3>Senior reasoning</h3><p>${esc(module.learn?.seniorReasoning || '')}</p></div></div>
      <button class="btn primary" id="canonicalLearn">${p.learn ? 'Learn completed — review' : 'Mark Learn viewed & complete'}</button>`;
  }
  if (stage === 'apply') {
    const app = c.applicationEvidence || {};
    body = `<div class="learning-hero"><b>Scenario</b><p>${esc(module.apply?.scenario)}</p></div>
      <div class="learning-card"><h3>Tasks</h3>${(module.apply?.tasks || []).map((task, i) => `<label style="display:block;padding:7px 0"><input type="checkbox" class="apply-task" data-index="${i}" ${app.tasks?.[i] ? 'checked' : ''}> ${esc(task)}</label>`).join('')}</div>
      <div class="evidence-form"><label>Deliverable<input id="applyDeliverable" value="${esc(app.deliverable || module.apply?.deliverable || '')}"></label>
      <label>Decisions / reasoning<textarea id="applyDecisions">${esc(app.decisions || '')}</textarea></label>
      <label>Assumptions / missing inputs<textarea id="applyAssumptions">${esc(app.assumptions || '')}</textarea></label>
      <label>Verification / QA<textarea id="applyVerification">${esc(app.verification || '')}</textarea></label>
      <label>Application notes<textarea id="applyNotes">${esc(app.notes || '')}</textarea></label>
      <button class="btn primary" id="canonicalApply">${p.apply ? 'Apply completed — review' : 'Save Apply evidence & complete'}</button></div>`;
  }
  if (stage === 'check') {
    const qs = module.check?.questions || [];
    const saved = c.assessmentResult?.responses || {};
    body = `<div class="learning-hero"><b>Authored knowledge check</b><p>Pass the module-authored check. The canonical assessment engine scores the actual options and records the attempt trail.</p></div>
      ${qs.map((q, i) => { const qid = esc(q.id || `q${i+1}`); return `<div class="question"><b>${i+1}. ${esc(q.prompt || q.q)}</b>${(q.options || []).map((option, oi) => `<label><input type="radio" name="canonical-q-${qid}" value="${oi}" ${String(saved[q.id || `q${i+1}`]) === String(oi) ? 'checked' : ''}> ${esc(option)}</label>`).join('')}</div>`; }).join('')}
      ${c.assessmentResult ? `<div class="result ${c.assessmentResult.passed ? '' : 'warn'}"><b>Latest: ${c.assessmentResult.score}/${c.assessmentResult.total} (${c.assessmentResult.percentage ?? 0}%)</b> — ${c.assessmentResult.passed ? 'Pass' : 'Not yet passed'}${c.assessmentResult.recovered ? ' • recovered after reinforcement' : ''}</div>` : ''}
      <button class="btn primary" id="canonicalCheck">${p.check ? 'Check completed — review' : 'Submit knowledge check'}</button>`;
  }
  if (stage === 'evidence') {
    const e = c.evidence || {};
    body = `<div class="learning-hero"><b>Evidence requirement</b><p>${esc(module.evidence?.prompt)}</p><div class="rubric">${(module.evidence?.criteria || []).map((x, i) => `<label class="rubric-row"><span>${i+1}. ${esc(x)}</span><input type="checkbox" class="criterion" data-index="${i}" ${e.criteria?.[i]?.satisfied ? 'checked' : ''}></label>`).join('')}</div></div>
      <div class="evidence-form"><label>Evidence title<input id="evidenceTitle" value="${esc(e.title || '')}" placeholder="Sanitized work sample title"></label>
      <label>What does it prove?<textarea id="evidenceDescription">${esc(e.description || '')}</textarea></label>
      <label>Reflection<textarea id="evidenceReflection">${esc(e.reflection || '')}</textarea></label>
      <label>Next action<textarea id="evidenceNext">${esc(e.nextAction || '')}</textarea></label>
      <button class="btn primary" id="canonicalEvidence">${p.evidence ? 'Evidence completed — review' : 'Capture linked evidence'}</button></div>`;
  }
  modal(`<div><div class="k">Week ${id} • ${STAGE_LABELS[stage]}</div><h2>${esc(module.title)}</h2><span class="pill">${esc(module.phase)}</span></div>`, body);
  if (stage === 'learn') document.getElementById('canonicalLearn').onclick = () => {
    if (p.learn) return close();
    const now = new Date().toISOString();
    const ok = commit('learn', id, { learnViewedAt: now });
    if (ok) { close(); refresh(); }
  };
  if (stage === 'apply') document.getElementById('canonicalApply').onclick = () => {
    if (p.apply) return close();
    const tasks = [...document.querySelectorAll('.apply-task')].map(x => x.checked);
    const result = store.saveApplicationEvidence({ weekId:id, tasks, deliverable:document.getElementById('applyDeliverable').value.trim(), decisions:document.getElementById('applyDecisions').value.trim(), assumptions:document.getElementById('applyAssumptions').value.trim(), verification:document.getElementById('applyVerification').value.trim(), notes:document.getElementById('applyNotes').value.trim() });
    if (!result.ok) return alert(result.reason);
    const ok = commit('apply', id, { applicationEvidence: result.evidence });
    if (ok) { close(); refresh(); }
  };
  if (stage === 'check') document.getElementById('canonicalCheck').onclick = () => {
    if (p.check) return close();
    const responses = {};
    (module.check?.questions || []).forEach((q, i) => {
      const qid = q.id || `q${i+1}`;
      const selected = document.querySelector(`input[name="canonical-q-${CSS.escape(String(qid))}"]:checked`);
      if (selected) responses[qid] = Number(selected.value);
    });
    const result = store.recordAssessmentResult({ weekId:id, result:{ responses } });
    if (!result.ok) return alert(result.reason || 'Assessment could not be recorded.');
    if (!result.result.passed) { refresh(); openStage(id, 'check'); return; }
    const ok = commit('check', id, { assessmentResult: result.result });
    if (ok) { close(); refresh(); }
  };
  if (stage === 'evidence') document.getElementById('canonicalEvidence').onclick = () => {
    if (p.evidence) return close();
    const criteria = {};
    document.querySelectorAll('.criterion').forEach((x, i) => { criteria[`criterion_${i+1}`] = x.checked; });
    const current = contextFor(id);
    const check = current.assessmentResult;
    const attemptKey = check?.date ? String(check.date).replace(/[^0-9A-Za-z_-]/g,'') : 'latest';
    const result = store.captureEvidence({
      weekId:id,
      title:document.getElementById('evidenceTitle').value.trim(),
      description:document.getElementById('evidenceDescription').value.trim(),
      reflection:document.getElementById('evidenceReflection').value.trim(),
      nextAction:document.getElementById('evidenceNext').value.trim(),
      date:new Date().toISOString(),
      reviewStatus:'demonstrated',
      applyLink:`apply:${id}`,
      checkLink:`check:${id}:${attemptKey}`,
      ...criteria
    });
    if (!result.ok) return alert(result.reason || 'Evidence could not be captured.');
    close(); refresh();
  };
}

function renderPortfolioCanonical() {
  const grid = document.getElementById('portfolioGrid');
  const readiness = document.getElementById('readiness');
  if (!grid || !store) return;
  const entries = state().portfolioEntries || [];
  grid.innerHTML = entries.length ? entries.map(e => `<div class="evidence"><span class="pill ok">Week ${e.week ?? '—'}</span><h3>${esc(e.title)}</h3><div class="muted">${esc(e.description)}</div><small class="muted">${esc(e.evidenceQuality || e.reviewStatus || 'recorded')}</small></div>`).join('') : '<div class="empty">Complete Apply, Check and Evidence to build portfolio proof.</div>';
  const h = state().hubSignals || {};
  readiness.innerHTML = `<div class="goal"><b>${h.evidenceCompletionRate || 0}%</b><small>Evidence completion across 24 weeks</small></div><div class="goal"><b>${h.knowledgeChecksPassed || 0}</b><small>Knowledge checks passed</small></div><div class="goal"><b>${h.studyMomentum?.reflectionCount || 0}</b><small>Learning reflections</small></div>`;
}

function refresh() {
  if (!store) return;
  syncLegacyView();
  renderCourse();
  renderPortfolioCanonical();
}

async function init() {
  try {
    catalog = await loadCanonicalCatalog();
    store = createLearningStateStore({ catalog });
    store.syncLegacyState(legacyState());
    store.subscribe(() => refresh());
    window.ECRHCanonical = { catalog, store, openStage, refresh };
    refresh();
    const modules = document.getElementById('modules');
    if (modules) {
      const observer = new MutationObserver(() => {
        if (!rendering && Object.keys(catalog).length && modules.dataset.canonicalOwner !== 'true') refresh();
      });
      observer.observe(modules, { childList:true, subtree:true });
      modules.dataset.canonicalOwner = 'true';
    }
    const originalGo = window.ECRH?.go;
    void originalGo;
  } catch (error) {
    console.error('Canonical Course runtime failed', error);
    const el = document.getElementById('modules');
    if (el) el.innerHTML = `<div class="empty">The canonical 24-week curriculum could not be loaded. Refresh and try again.</div>`;
  }
}

init();
