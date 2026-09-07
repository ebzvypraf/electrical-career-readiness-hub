/* Electrical Career Readiness Hub — canonical learning integrity UI v1.
 * Gives the learner/admin a lightweight production diagnostic for the 24-week
 * Learn -> Apply -> Check -> Evidence catalog and assessment coverage.
 * Read-only: it never changes learning state.
 */
(function () {
  'use strict';

  const SOURCES = [
    '/curriculum/learning-content-v1.json',
    '/curriculum/learning-content-weeks-11-15-v1.json',
    '/curriculum/learning-content-weeks-16-20-v1.json',
    '/curriculum/learning-content-weeks-21-24-v1.json'
  ];
  const ASSESSMENTS = [
    '/curriculum/assessment-bank-weeks-01-03-v1.json',
    '/curriculum/assessment-question-bank-v1.json',
    '/curriculum/assessment-bank-weeks-16-20-v1.json',
    '/curriculum/assessment-bank-weeks-21-24-v1.json'
  ];

  const esc = value => String(value ?? '').replace(/[&<>\"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '\"':'&quot;', "'":'&#39;' }[c]));

  async function load(url) {
    const response = await fetch(url, { cache: 'no-store' });
    if (!response.ok) throw new Error(`${response.status} ${url}`);
    return response.json();
  }

  async function inspect() {
    const [curriculumPayloads, assessmentPayloads] = await Promise.all([
      Promise.all(SOURCES.map(load)),
      Promise.all(ASSESSMENTS.map(load))
    ]);

    const weeks = {};
    curriculumPayloads.flatMap(x => Array.isArray(x?.modules) ? x.modules : []).forEach(module => {
      const id = String(module?.week ?? '');
      if (/^([1-9]|1\d|2[0-4])$/.test(id) && !weeks[id]) weeks[id] = module;
    });

    const assessments = {};
    assessmentPayloads.flatMap(x => Array.isArray(x?.weeks) ? x.weeks : []).forEach(group => {
      const id = String(group?.week ?? '');
      if (!/^([1-9]|1\d|2[0-4])$/.test(id)) return;
      assessments[id] = [...(assessments[id] || []), ...(Array.isArray(group.questions) ? group.questions : [])];
    });

    const rows = Array.from({ length: 24 }, (_, index) => {
      const week = index + 1, id = String(week), module = weeks[id];
      const stages = ['learn', 'apply', 'check', 'evidence'];
      const stageReady = Boolean(module) && stages.every(stage => module?.[stage]);
      const authored = assessments[id] || [];
      const fallback = Array.isArray(module?.check?.questions) ? module.check.questions : [];
      const questions = authored.length ? authored : fallback;
      const deterministic = questions.length > 0 && questions.every(q => Array.isArray(q?.options) && q.options.length >= 2 && Number.isInteger(q?.correctIndex) && q.correctIndex >= 0 && q.correctIndex < q.options.length);
      return { week, title: module?.title || `Week ${week}`, stageReady, questionCount: questions.length, deterministic };
    });

    return {
      curriculumComplete: rows.every(row => row.stageReady),
      assessmentComplete: rows.every(row => row.questionCount > 0),
      deterministicComplete: rows.every(row => row.deterministic),
      rows
    };
  }

  function render(result, error) {
    const settings = document.getElementById('settings');
    if (!settings) return;
    let card = settings.querySelector('[data-learning-integrity]');
    if (!card) {
      card = document.createElement('div');
      card.dataset.learningIntegrity = 'true';
      card.className = 'card s12';
      settings.querySelector('.grid')?.appendChild(card);
    }

    if (error) {
      card.innerHTML = '<div class="k">Learning integrity</div><h2>Diagnostic unavailable</h2><div class="result warn">The canonical curriculum diagnostic could not load. Learning state was not changed.</div>';
      return;
    }

    const good = result.curriculumComplete && result.assessmentComplete && result.deterministicComplete;
    const stageWeeks = result.rows.filter(x => x.stageReady).length;
    const assessedWeeks = result.rows.filter(x => x.questionCount > 0).length;
    const deterministicWeeks = result.rows.filter(x => x.deterministic).length;
    const gaps = result.rows.filter(x => !x.stageReady || !x.questionCount || !x.deterministic);

    card.innerHTML = `<div class="k">Learning integrity</div><h2>${good ? '24-week pathway is structurally ready' : 'Learning pathway needs attention'}</h2><div class="metrics"><div class="metric"><small>Complete weeks</small><b>${stageWeeks}/24</b></div><div class="metric"><small>Assessed weeks</small><b>${assessedWeeks}/24</b></div><div class="metric"><small>Deterministic checks</small><b>${deterministicWeeks}/24</b></div><div class="metric"><small>Stage model</small><b>4/4</b></div></div><div class="result ${good ? '' : 'warn'}" style="margin-top:12px"><b>${good ? 'Ready for learner-flow validation.' : 'Review the flagged weeks before final release.'}</b>${gaps.length ? `<ul>${gaps.map(x => `<li>Week ${esc(x.week)} — ${esc(x.title)}${!x.stageReady ? ': missing stage content' : ''}${!x.questionCount ? ': no assessment' : ''}${x.questionCount && !x.deterministic ? ': assessment needs deterministic options/correctIndex' : ''}</li>`).join('')}</ul>` : '<div>All 24 weeks contain Learn, Apply, Check and Evidence content with deterministic assessment coverage.</div>'}</div><small class="muted">Read-only diagnostic. Last checked: ${esc(new Date().toLocaleString())}</small>`;
  }

  async function run() {
    try { render(await inspect(), null); }
    catch (error) { render(null, error); }
  }

  const boot = () => setTimeout(run, 0);
  document.addEventListener('DOMContentLoaded', boot, { once: true });
  document.addEventListener('click', event => {
    if (event.target?.dataset?.page === 'settings') setTimeout(run, 50);
  }, true);
})();
