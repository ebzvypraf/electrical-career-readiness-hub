/*
 * Electrical Career Readiness Hub — Canonical Learning UI Adapter v2
 * Bridges the locked production shell to the canonical 24-week curriculum,
 * assessment engine and cross-surface learning signals without replacing the
 * existing entry point.
 */
(function () {
  'use strict';
  const STATE_KEY = 'ecrh-v35';
  const CANONICAL_URL = '/curriculum/canonical-catalog-v1.js';
  const ASSESSMENT_ENGINE_URL = './assessment-engine-v1.js';
  let catalog = {};
  let engine = null;
  let lastSignature = '';
  let renderingModal = false;
  let observerReady = false;

  const escapeHtml = value => String(value ?? '').replace(/[&<>\"']/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[char]));

  function readState() {
    try { return JSON.parse(localStorage.getItem(STATE_KEY) || 'null'); }
    catch (_) { return null; }
  }

  function canonicalProgress() {
    const state = readState() || {};
    const progress = {};
    const source = Array.isArray(state.weeks) ? state.weeks : [];
    for (let i = 1; i <= 24; i += 1) progress[String(i)] = { ...(source[i - 1] || {}) };
    return progress;
  }

  function buildSignals() {
    if (!engine || !Object.keys(catalog).length) return null;
    const state = readState() || {};
    return engine.buildHubSignals(catalog, canonicalProgress(), {}, Array.isArray(state.journal) ? state.journal : [], Object.values(state.evidence || {}));
  }

  function weekStageFromModal() {
    const key = document.querySelector('#modalCard .k');
    const match = key && key.textContent.match(/Week\s+(\d+)\s+•\s+(Learn|Apply|Check|Evidence)/i);
    return match ? { week: Number(match[1]), stage: match[2].toLowerCase() } : null;
  }

  function stageIndex(stage) { return ['learn', 'apply', 'check', 'evidence'].indexOf(stage); }
  function stageDescription(stage) {
    return ({
      learn: 'Build understanding and connect the concept to design intent.',
      apply: 'Complete a practical scenario and document decisions.',
      check: 'Test your reasoning with the module-authored knowledge check.',
      evidence: 'Capture sanitized proof that another designer can review.'
    })[stage] || '';
  }

  function renderCanonicalModal() {
    if (renderingModal) return;
    const target = weekStageFromModal();
    if (!target || !catalog[String(target.week)]) return;
    const modalCard = document.querySelector('#modalCard');
    if (!modalCard) return;
    renderingModal = true;
    try {
      const week = catalog[String(target.week)];
      const stage = target.stage;
      const state = readState() || {};
      const weekState = (state.weeks || [])[target.week - 1] || {};
      const evidence = state.evidence?.[target.week - 1];
      const check = state.checks?.[target.week - 1];
      let body = '';

      if (stage === 'learn') {
        body = `<div class="learning-hero"><b>Objective</b><p>${escapeHtml(week.objective)}</p></div>` +
          `<div class="learning-card"><h3>${escapeHtml(week.learn?.heading || 'What to understand')}</h3>` +
          `<ul>${(week.learn?.concepts || week.learn?.bullets || []).map(x => `<li>${escapeHtml(x)}</li>`).join('')}</ul>` +
          `<p><b>Senior reasoning:</b> ${escapeHtml(week.learn?.seniorReasoning || week.learn?.takeaway || 'Connect the concept to controlled, reviewable design work.')}</p></div>`;
      }

      if (stage === 'apply') {
        body = `<div class="learning-hero"><b>Scenario</b><p>${escapeHtml(week.apply?.scenario || '')}</p></div>` +
          `<div class="learning-grid"><div class="learning-card"><h3>Do this</h3><ol>${(week.apply?.tasks || []).map(x => `<li>${escapeHtml(x)}</li>`).join('')}</ol></div>` +
          `<div class="learning-card"><h3>Deliverable</h3><p>${escapeHtml(week.apply?.deliverable || '')}</p><span class="tag">Practical</span> <span class="tag">Sanitized</span> <span class="tag">Reviewable</span></div></div>` +
          `<div class="evidence-form"><label>Application notes<textarea id="canonical-note" placeholder="Record decisions, assumptions, interfaces and verification.">${escapeHtml(state.notes?.[target.week - 1] || '')}</textarea></label>` +
          `<button class="btn" id="canonical-save-note">Save application notes</button></div>`;
      }

      if (stage === 'check') {
        const questions = Array.isArray(week.check?.questions) ? week.check.questions : [];
        const authored = questions.some(q => Array.isArray(q.options) && Number.isInteger(q.correctIndex));
        if (authored) {
          body = `<div class="learning-hero"><b>Module-authored knowledge check</b><p>${escapeHtml(week.check?.passRule || 'Select the strongest response for every question.')}</p></div>` +
            questions.map((q, n) => `<div class="question"><b>${n + 1}. ${escapeHtml(q.prompt || q.q)}</b>${(q.options || []).map((o, oi) => `<label><input type="radio" name="canonical-q${n}" value="${oi}"> ${escapeHtml(o)}</label>`).join('')}</div>`).join('') +
            `<button class="btn primary" style="margin-top:12px" id="canonical-score">Score check</button>`;
        } else {
          body = `<div class="learning-hero"><b>Self-check</b><p>${escapeHtml(week.check?.passRule || 'Answer each question in your own words. Concept matching is transparent and is not a substitute for human review.')}</p></div>` +
            questions.map((q, n) => `<div class="question"><b>${n + 1}. ${escapeHtml(q.prompt || q.q)}</b><textarea id="canonical-answer-${n}" placeholder="Explain your reasoning, inputs, checks, interfaces and approval considerations."></textarea></div>`).join('') +
            `<button class="btn primary" style="margin-top:12px" id="canonical-score">Score self-check</button>`;
        }
        if (check) body += `<div class="result ${check.passed ? '' : 'warn'}"><b>Last score: ${escapeHtml(check.score)}/${escapeHtml(check.total)}</b> — ${check.passed ? 'Pass. Evidence is available.' : 'Not yet passed.'}</div>`;
      }

      if (stage === 'evidence') {
        body = `<div class="learning-hero"><b>Evidence requirement</b><p>${escapeHtml(week.evidence?.prompt || '')}</p><div class="rubric">${(week.evidence?.criteria || []).map((x, n) => `<div class="rubric-row"><span>${n + 1}. ${escapeHtml(x)}</span><span class="tag">Required</span></div>`).join('')}</div></div>` +
          (evidence ? `<div class="saved"><b>Evidence saved</b><p>${escapeHtml(evidence.title)}</p><div>${escapeHtml(evidence.description)}</div></div>` : '') +
          `<div class="evidence-form"><label>Evidence title<input id="canonical-et" value="${escapeHtml(evidence?.title || '')}" placeholder="e.g. sanitized design review record"></label>` +
          `<label>What does it prove?<textarea id="canonical-ed" placeholder="Explain your contribution, reasoning and verification.">${escapeHtml(evidence?.description || '')}</textarea></label>` +
          `<button class="btn primary" id="canonical-save-evidence">Save & link evidence</button></div>`;
      }

      const completed = Boolean(weekState[stage]);
      modalCard.innerHTML = `<div style="display:flex;justify-content:space-between;gap:10px"><div><div class="k">Week ${target.week} • ${stage.charAt(0).toUpperCase() + stage.slice(1)}</div><h2>${escapeHtml(week.title)}</h2><span class="pill">${escapeHtml(week.phase)}</span></div><button class="btn" id="canonical-close">Close</button></div>` +
        `<div class="mission" style="margin-top:12px"><b>${escapeHtml(stage.charAt(0).toUpperCase() + stage.slice(1))} stage</b><p class="muted">${escapeHtml(stageDescription(stage))}</p></div>` + body +
        `<div class="mission" style="margin-top:12px"><b>Stage gate</b><p class="muted">${completed ? 'Completed.' : 'Complete the required work honestly before marking this stage complete.'}</p></div>` +
        `<button class="btn primary" id="canonical-complete">${completed ? 'Completed — review' : 'Mark stage complete'}</button>`;

      document.getElementById('canonical-close').onclick = () => window.ECRH?.close?.();
      document.getElementById('canonical-complete').onclick = () => { if (window.ECRH?.complete) window.ECRH.complete(target.week - 1, stageIndex(stage)); };

      if (stage === 'apply') document.getElementById('canonical-save-note').onclick = () => {
        const current = readState() || {};
        current.notes = current.notes || {};
        current.notes[target.week - 1] = document.getElementById('canonical-note').value.trim();
        localStorage.setItem(STATE_KEY, JSON.stringify(current));
        renderCanonicalModal();
        refreshSurfaces(true);
      };

      if (stage === 'check') document.getElementById('canonical-score').onclick = () => scoreCanonicalCheck(target.week, questions);

      if (stage === 'evidence') document.getElementById('canonical-save-evidence').onclick = () => {
        const title = document.getElementById('canonical-et').value.trim();
        const description = document.getElementById('canonical-ed').value.trim();
        if (!title || !description) { alert('Add an evidence title and description first.'); return; }
        const current = readState() || {};
        current.evidence = current.evidence || {};
        current.evidence[target.week - 1] = { title, description, date: new Date().toISOString() };
        localStorage.setItem(STATE_KEY, JSON.stringify(current));
        renderCanonicalModal();
        refreshSurfaces(true);
      };
    } finally {
      renderingModal = false;
    }
  }

  function scoreCanonicalCheck(weekNumber, questions) {
    if (!engine) return;
    const responses = {};
    questions.forEach((question, index) => {
      const choice = document.querySelector(`input[name="canonical-q${index}"]:checked`);
      const answer = document.getElementById(`canonical-answer-${index}`);
      responses[question.id || `q${index + 1}`] = choice ? choice.value : (answer ? answer.value : '');
    });
    const result = engine.scoreQuestionSet(questions, responses);
    const state = readState() || {};
    state.checks = state.checks || {};
    state.checks[weekNumber - 1] = { score: result.score, total: result.total, passed: result.passed, percentage: result.percentage, engineVersion: result.engineVersion, gradingMode: result.gradingNote?.startsWith('Choice') ? 'choice' : 'self-check', date: new Date().toISOString() };
    localStorage.setItem(STATE_KEY, JSON.stringify(state));
    renderCanonicalModal();
    refreshSurfaces(true);
  }

  function ensureSignalCard(id, containerId, html) {
    const container = document.getElementById(containerId);
    if (!container) return;
    let card = document.getElementById(id);
    if (!card) {
      card = document.createElement('div');
      card.id = id;
      card.className = 'goal';
      card.setAttribute('data-canonical-signal', 'true');
      container.prepend(card);
    }
    card.innerHTML = html;
  }

  function refreshSurfaces(force) {
    const signals = buildSignals();
    if (!signals) return;
    const signature = JSON.stringify({ p: signals.overallProgress, n: signals.nextBestAction, s: signals.skills.map(x => [x.skill, x.readiness]), j: signals.journal.studyHours, e: signals.evidence.evidenceReadyWeeks });
    if (!force && signature === lastSignature) return;
    lastSignature = signature;
    const next = signals.nextBestAction;
    if (next) {
      const homeNext = document.getElementById('nextTitle');
      const homeType = document.getElementById('nextType');
      const coach = document.getElementById('coach');
      const coachText = document.getElementById('coachText');
      if (homeNext) homeNext.textContent = next.week;
      if (homeType) homeType.textContent = next.label;
      if (coach) coach.textContent = `${next.label}: ${next.week}`;
      if (coachText) coachText.textContent = next.prompt || stageDescription(next.stage);
    }
    const pct = document.getElementById('pct');
    const bar = document.getElementById('pbar');
    const meta = document.getElementById('meta');
    if (pct) pct.textContent = `${signals.overallProgress}%`;
    if (bar) bar.style.width = `${signals.overallProgress}%`;
    if (meta) meta.textContent = `${signals.completedStages} / ${signals.totalStages} activities`;
    const hours = document.getElementById('hours');
    const ev = document.getElementById('evM');
    if (hours) hours.textContent = `${signals.journal.studyHours.toFixed(1)}h`;
    if (ev) ev.textContent = signals.evidence.evidenceReadyWeeks;

    ensureSignalCard('canonical-home-signal', 'mission', `<b>Canonical 24-week engine</b><div class="muted">${signals.overallProgress}% complete • Next: ${escapeHtml(next ? `${next.week} — ${next.label}` : 'Program complete')}</div>`);

    const skills = document.getElementById('skills');
    if (skills) skills.innerHTML = signals.skills.map(item => `<div class="skillrow"><div class="skillhead"><span>${escapeHtml(item.skill)}</span><b>${item.readiness}% readiness</b></div><div class="bar"><span style="width:${item.readiness}%"></span></div><small class="muted">${item.demonstratedWeeks}/${item.weeks} demonstrated • ${item.completedWeeks}/${item.weeks} fully completed</small></div>`).join('') || '<div class="empty">No canonical skill signals yet.</div>';

    ensureSignalCard('canonical-skills-signal', 'advice', `<b>${signals.prioritySkillGaps.length ? 'Priority gaps identified' : 'No priority gaps'}</b><small>${signals.prioritySkillGaps.slice(0, 3).map(x => escapeHtml(`${x.skill} (${x.readiness}%)`)).join(' • ') || 'Keep progressing through the pathway.'}</small>`);
    ensureSignalCard('canonical-journal-signal', 'logs', `<b>${signals.journal.studyHours.toFixed(1)} study hours</b><small>${signals.journal.reflectionCount} reflections • Next action: ${escapeHtml(signals.journal.nextAction || 'Continue the next learning stage.')}</small>`);
    ensureSignalCard('canonical-portfolio-signal', 'readiness', `<b>${signals.portfolio.evidenceCount} evidence records</b><small>${signals.evidence.evidenceRate}% of weeks have evidence • Evidence-ready weeks: ${signals.evidence.evidenceReadyWeeks}/24</small>`);
  }

  async function load() {
    try {
      const [{ loadCanonicalCatalog }, assessment] = await Promise.all([import(CANONICAL_URL), import(ASSESSMENT_ENGINE_URL)]);
      catalog = await loadCanonicalCatalog();
      engine = assessment;
      installObserver();
      refreshSurfaces(true);
    } catch (error) { console.warn('Canonical learning UI adapter unavailable:', error); }
  }

  function installObserver() {
    if (observerReady) return;
    observerReady = true;
    const observer = new MutationObserver(() => {
      if (!renderingModal && document.querySelector('#modal.show')) renderCanonicalModal();
      refreshSurfaces(false);
    });
    observer.observe(document.body, { childList: true, subtree: true });
    window.addEventListener('storage', () => refreshSurfaces(true));
    setInterval(() => refreshSurfaces(false), 1000);
    refreshSurfaces(true);
  }

  load();
})();
