/* Electrical Career Readiness Hub — canonical Skills UI bridge v2.5.
 * Keeps the learner-facing Skills page bound to the same canonical store that
 * powers Course, Home, Journal and Portfolio.
 *
 * Assessment and demonstrated-capability counts are read from canonical
 * hub signals so the Skills surface remains state-safe and does not maintain
 * a second curriculum lookup or progress store.
 * v2.2 adds a stable skill key to each rendered row so downstream Skills
 * enhancers resolve by skill identity rather than DOM position.
 * v2.3 makes each skill's canonical next-focus recommendation actionable,
 * allowing Skills to resume the same Course stage used by the learning engine.
 * v2.4 adds a compact proof-status summary derived from canonical Portfolio
 * entries so demonstrated evidence contributes visibly to the skill profile.
 * v2.5 surfaces an existing canonical session draft on the recommended focus,
 * so Skills can resume unfinished work instead of making the learner restart it.
 */
(function () {
  'use strict';

  function getStore() {
    const api = typeof window !== 'undefined' ? window.ECRHCanonical : null;
    if (!api) return null;
    const store = typeof api.store === 'function' ? api.store() : api.store;
    return store && typeof store.getState === 'function' ? store : null;
  }

  function esc(value) {
    return String(value == null ? '' : value).replace(/[&<>\"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '\"': '&quot;', "'": '&#39;' }[ch]));
  }

  function skillKey(value) {
    return String(value == null ? '' : value).trim().toLowerCase();
  }

  function openWeekStage(weekId, stage) {
    const api = window.ECRHCanonical;
    if (api?.openStage) { api.openStage(String(weekId), String(stage)); return; }
    const selector = '[data-canonical-open="' + String(weekId) + ':' + String(stage) + '"]';
    const direct = document.querySelector(selector);
    if (direct) { direct.click(); return; }
    const course = document.querySelector('[data-page="course"]');
    if (course) course.click();
    let attempts = 0;
    const timer = setInterval(() => {
      const button = document.querySelector(selector);
      if (button) { clearInterval(timer); button.click(); }
      if (++attempts > 20) clearInterval(timer);
    }, 150);
  }

  function getSkillProof(entries, skill, catalog) {
    const normalized = Array.isArray(entries) ? entries.filter(entry => entry && entry.week != null && entry.title) : [];
    const key = skillKey(skill);
    const matches = normalized.filter(entry => {
      const week = catalog?.[String(entry.week)];
      const targets = Array.isArray(week?.skills) ? week.skills : [];
      return targets.some(target => skillKey(target) === key);
    });
    const demonstrated = matches.filter(entry => entry.reviewStatus === 'demonstrated' && entry.upstreamChangedAfterEvidence !== true).length;
    const needsReview = matches.filter(entry => entry.reviewStatus === 'needs-review' || entry.upstreamChangedAfterEvidence === true).length;
    const qualityValues = matches
      .map(entry => Number(entry.evidenceQuality || entry.proofChain?.evidence?.quality || 0))
      .filter(value => Number.isFinite(value) && value > 0);
    const quality = qualityValues.length ? Math.round(qualityValues.reduce((sum, value) => sum + value, 0) / qualityValues.length) : 0;
    return { total: matches.length, demonstrated, needsReview, quality };
  }

  function renderEvidenceTrace(host, skills, entries, catalog) {
    host.querySelectorAll('[data-skill-evidence-trace]').forEach(node => node.remove());
    if (!Array.isArray(entries) || !entries.length) return;

    const normalizedEntries = entries.filter(entry => entry && entry.week != null && entry.title);
    Array.from(host.querySelectorAll('.skillrow')).forEach((row) => {
      const item = skills.find(skill => skillKey(skill?.skill) === String(row.dataset.skillKey || ''));
      if (!item?.skill) return;
      const skillName = skillKey(item.skill);
      const matches = normalizedEntries.filter(entry => {
        const week = catalog?.[String(entry.week)];
        const targets = Array.isArray(week?.skills) ? week.skills : [];
        return targets.some(target => skillKey(target) === skillName);
      });
      if (!matches.length) return;

      const wrap = document.createElement('div');
      wrap.dataset.skillEvidenceTrace = '1';
      wrap.style.cssText = 'margin-top:10px;padding-top:9px;border-top:1px solid rgba(127,127,127,.18)';
      const proof = getSkillProof(normalizedEntries, item.skill, catalog);
      const proofSummary = `<div style="margin-bottom:8px"><small class="muted"><b>Proof status:</b> ${proof.demonstrated} demonstrated · ${proof.needsReview} review / developing${proof.quality ? ` · Avg. evidence quality ${proof.quality}%` : ''}</small></div>`;
      const list = matches.slice(0, 4).map(entry => {
        const demonstrated = entry.reviewStatus === 'demonstrated' && entry.upstreamChangedAfterEvidence !== true;
        const status = demonstrated ? 'demonstrated' : 'developing / review';
        const stage = entry.upstreamChangedAfterEvidence ? 'apply' : (demonstrated ? 'evidence' : 'apply');
        return `<div style="margin-top:6px;display:flex;gap:8px;align-items:center;justify-content:space-between;flex-wrap:wrap"><span><b>Week ${esc(entry.week)}</b> • ${esc(entry.title)} <small class="muted">(${esc(status)})</small></span><button class="btn" type="button" data-skill-evidence-open="${esc(entry.week)}:${esc(stage)}">Open proof</button></div>`;
      }).join('');
      const more = matches.length > 4 ? `<small class="muted">+ ${matches.length - 4} more linked evidence item${matches.length - 4 === 1 ? '' : 's'}</small>` : '';
      wrap.innerHTML = `<small class="muted"><b>Portfolio evidence:</b> ${matches.length} linked item${matches.length === 1 ? '' : 's'}</small>${proofSummary}${list}${more}`;
      wrap.querySelectorAll('[data-skill-evidence-open]').forEach(button => {
        button.addEventListener('click', () => {
          const [weekId, stage] = String(button.dataset.skillEvidenceOpen || '').split(':');
          if (weekId && stage) openWeekStage(weekId, stage);
        });
      });
      row.appendChild(wrap);
    });
  }

  function render() {
    const host = document.getElementById('skills');
    if (!host) return;
    const store = getStore();
    if (!store) return;
    const state = store.getState();
    const signals = state?.hubSignals || {};
    const skills = Array.isArray(signals.skills) ? signals.skills : [];
    if (!skills.length) {
      host.innerHTML = '<div class="empty">Complete learning activities to build your canonical competency profile.</div>';
      return;
    }

    host.innerHTML = skills.map(item => {
      const coverage = item.coverage || {};
      const hasRecommendation = item.recommendedWeekId && item.recommendedStageLabel;
      const draft = hasRecommendation
        ? state?.contextByWeek?.[String(item.recommendedWeekId)]?.sessionDraft?.[String(item.recommendedStage)]
        : null;
      const hasDraft = Boolean(draft && item.recommendedStage);
      const recommendation = hasRecommendation
        ? (hasDraft
          ? `Resume saved work: Week ${esc(item.recommendedWeekId)} • ${esc(item.recommendedStageLabel)}`
          : `Next focus: Week ${esc(item.recommendedWeekId)} • ${esc(item.recommendedStageLabel)}`)
        : 'All currently unlocked stages are complete for this skill.';
      const nextAction = hasRecommendation
        ? `<button class="btn${hasDraft ? ' primary' : ''}" type="button" data-skill-next="${esc(item.recommendedWeekId)}">${hasDraft ? `Resume ${esc(item.recommendedStageLabel)} draft` : 'Open next focus'}</button>`
        : '';
      const draftHint = hasDraft
        ? `<small class="muted" style="display:block;margin-top:4px">Your unfinished ${esc(item.recommendedStageLabel)} work is already saved in the canonical learning state.</small>`
        : '';
      return `<div class="skillrow" data-skill-key="${esc(skillKey(item.skill))}">
        <div class="skillhead"><b>${esc(item.skill)}</b><strong>${Number(item.readiness || 0)}%</strong></div>
        <div class="bar"><span style="width:${Math.max(0, Math.min(100, Number(item.readiness || 0)))}%"></span></div>
        <div class="muted">Learn ${Number(coverage.learn || 0)}% · Apply ${Number(coverage.apply || 0)}% · Check ${Number(coverage.check || 0)}% · Evidence ${Number(coverage.evidence || 0)}%</div>
        <div class="muted">Checks passed ${Number(item.knowledgeChecks || 0)} · Demonstrated weeks ${Number(item.evidenceCount || item.demonstratedWeeks || 0)}</div>
        <div class="muted">Evidence quality ${Number(item.evidenceQuality || 0)}% · Journal coverage ${Number(item.journalCoverage || 0)}%</div>
        <div style="display:flex;gap:8px;align-items:center;justify-content:space-between;flex-wrap:wrap"><div><small>${esc(recommendation)}</small>${draftHint}</div>${nextAction}</div>
      </div>`;
    }).join('');

    host.querySelectorAll('[data-skill-next]').forEach(button => {
      button.addEventListener('click', () => {
        const weekId = String(button.dataset.skillNext || '');
        const item = skills.find(skill => String(skill?.recommendedWeekId || '') === weekId);
        const stage = item?.recommendedStage;
        if (weekId && stage) openWeekStage(weekId, stage);
      });
    });

    renderEvidenceTrace(host, skills, state.portfolioEntries, state.catalog || window.ECRHCanonical?.catalog || {});
  }

  function attach() {
    const store = getStore();
    if (!store) return false;
    render();
    if (!window.__ECRHSkillsCanonicalBound) {
      window.__ECRHSkillsCanonicalBound = true;
      store.subscribe(() => render());
    }
    return true;
  }

  if (typeof document === 'undefined') return;
  const timer = setInterval(() => { if (attach()) clearInterval(timer); }, 250);
  setTimeout(() => clearInterval(timer), 15000);
  document.addEventListener('click', event => {
    if (event.target?.closest?.('[data-page="skills"]')) setTimeout(render, 0);
  });
})();
