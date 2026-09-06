/*
 * Electrical Career Readiness Hub — interview readiness enhancer v1.
 * Turns canonical evidence into competency-level interview readiness signals.
 * Additive only: preserves the existing production renderer and shell.
 */
(function () {
  'use strict';

  const api = () => window.ECRHCanonical || null;
  const esc = value => String(value ?? '').replace(/[&<>\"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '\"':'&quot;', "'":'&#39;' }[c]));

  function state() { return api()?.store?.getState?.() || null; }
  function catalog() { return api()?.catalog || {}; }

  function capabilityRows(s) {
    const skills = Array.isArray(s?.hubSignals?.skills) ? s.hubSignals.skills : [];
    return skills.map(item => {
      const evidenceCount = Number(item.demonstratedWeeks || 0);
      const quality = Number(item.evidenceQuality || 0);
      const readiness = Number(item.readiness || 0);
      const multiArtifact = evidenceCount >= 2;
      const interviewReady = readiness >= 70 && quality >= 50 && multiArtifact;
      return { ...item, evidenceCount, quality, readiness, multiArtifact, interviewReady };
    }).sort((a, b) => b.readiness - a.readiness);
  }

  function portfolioEntries(s) {
    return Array.isArray(s?.hubSignals?.portfolio?.entries) ? s.hubSignals.portfolio.entries : [];
  }

  function artifactSummary(s) {
    const entries = portfolioEntries(s);
    const demonstrated = entries.filter(e => String(e.reviewStatus || '') === 'demonstrated' || String(e.evidenceQuality || '') === 'high').length;
    const developing = entries.filter(e => String(e.evidenceQuality || '') === 'developing').length;
    const needsReview = entries.filter(e => String(e.reviewStatus || '') === 'needs-review').length;
    const competencies = new Set();
    entries.forEach(e => {
      const week = catalog()[String(e.week)] || {};
      (week.skills || []).forEach(skill => competencies.add(String(skill)));
    });
    return { total: entries.length, demonstrated, developing, needsReview, competencies: competencies.size };
  }

  function render() {
    const root = document.getElementById('portfolioGrid');
    if (!root) return;
    const s = state();
    if (!s) return;
    const rows = capabilityRows(s);
    const summary = artifactSummary(s);
    const ready = rows.filter(x => x.interviewReady);
    const near = rows.filter(x => !x.interviewReady && x.readiness >= 50);
    const old = document.getElementById('interview-readiness-panel');
    if (old) old.remove();

    const panel = document.createElement('div');
    panel.id = 'interview-readiness-panel';
    panel.className = 'mission';
    panel.style.marginTop = '14px';
    panel.innerHTML = `
      <div style="display:flex;justify-content:space-between;gap:12px;align-items:flex-start;flex-wrap:wrap">
        <div>
          <b>Interview-ready capability</b>
          <div class="muted">A capability is interview-ready when it has strong cross-stage readiness, quality evidence, and at least two supporting artifacts.</div>
        </div>
        <span class="pill ${ready.length ? 'ok' : ''}">${ready.length} ready</span>
      </div>
      <div style="display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;margin-top:12px">
        <div class="goal"><b>${summary.total}</b><small>Artifacts</small></div>
        <div class="goal"><b>${summary.demonstrated}</b><small>Strong / demonstrated</small></div>
        <div class="goal"><b>${summary.needsReview}</b><small>Needs review</small></div>
        <div class="goal"><b>${summary.competencies}</b><small>Competencies covered</small></div>
      </div>
      <div style="margin-top:12px">
        ${ready.slice(0, 4).map(x => `<div class="goal"><b>${esc(x.skill)}</b><small>Ready to discuss • ${x.evidenceCount} artifacts • ${x.readiness}% readiness</small></div>`).join('') || '<div class="empty">No competency has reached the interview-ready threshold yet. Strengthen evidence quality and build a second supporting artifact for the strongest capability.</div>'}
        ${near.slice(0, 3).map(x => `<div class="goal"><b>${esc(x.skill)}</b><small>Next target • ${x.evidenceCount} artifact(s) • ${x.readiness}% readiness — add evidence depth and/or another practical artifact.</small></div>`).join('')}
      </div>`;
    root.parentElement?.insertBefore(panel, root);
  }

  function enhanceCards() {
    const root = document.getElementById('portfolioGrid');
    if (!root) return;
    const s = state();
    const entries = portfolioEntries(s);
    root.querySelectorAll('.evidence').forEach((card, index) => {
      const entry = entries[index];
      if (!entry || card.querySelector('.canonical-evidence-meta')) return;
      const quality = String(entry.evidenceQuality || 'insufficient');
      const status = String(entry.reviewStatus || 'draft');
      const meta = document.createElement('div');
      meta.className = 'canonical-evidence-meta muted';
      meta.style.marginTop = '10px';
      meta.innerHTML = `<div><b>Evidence quality:</b> ${esc(quality)}</div><div><b>Self-review:</b> ${esc(status)}</div>${entry.reflection ? `<div><b>Reflection:</b> ${esc(entry.reflection)}</div>` : ''}`;
      card.appendChild(meta);
    });
  }

  function renderAll() { render(); enhanceCards(); }
  function boot() {
    renderAll();
    const observer = new MutationObserver(() => renderAll());
    observer.observe(document.body, { childList: true, subtree: true });
    window.addEventListener('ecrh:statechange', renderAll);
    let last = '';
    setInterval(() => {
      const s = state();
      const stamp = JSON.stringify({ p: s?.hubSignals?.overallProgress, e: s?.hubSignals?.portfolio?.evidenceCount, r: s?.hubSignals?.skills?.map(x => [x.skill, x.readiness, x.evidenceQuality]) });
      if (stamp !== last) { last = stamp; renderAll(); }
    }, 1000);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true }); else boot();
})();
