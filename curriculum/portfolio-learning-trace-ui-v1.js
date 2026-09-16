/* Electrical Career Readiness Hub — Portfolio learning trace UI v1.2.
 * Projects canonical Portfolio evidence back to the exact Week + catalog skills
 * and provides a direct return path into the canonical Course stage.
 * This is a projection only; the learning-state store remains authoritative.
 * v1.1 prefers the stable Week identity published by the Portfolio review layer,
 * with rendered-text matching retained only as a compatibility fallback.
 * v1.2 surfaces the canonical weekly Portfolio proof prompt and makes the
 * Evidence -> Portfolio handoff actionable without duplicating curriculum data.
 */
(function () {
  'use strict';
  const esc = value => String(value ?? '').replace(/[&<>\"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '\"':'&quot;', "'":'&#39;' }[c]));
  const wait = (tries = 80) => {
    const api = window.ECRHCanonical;
    if (!api?.store || !api?.catalog) return tries ? setTimeout(() => wait(tries - 1), 100) : null;
    const store = api.store;
    const state = () => store.getState();
    const entryWeekId = entry => {
      const candidate = entry?.weekId ?? entry?.week ?? entry?.sourceWeek;
      return candidate == null || candidate === '' ? null : String(Number(candidate));
    };
    const findCard = (grid, weekId, entry) => {
      const cards = [...grid.children];
      const stable = cards.find(node => String(node.dataset?.portfolioWeek || '') === weekId);
      if (stable) return stable;
      return cards.find(node => node.textContent?.includes(`Week ${weekId}`) && node.textContent?.includes(entry.title || '')) || null;
    };
    const render = () => {
      const grid = document.getElementById('portfolioGrid');
      if (!grid) return;
      const entries = Array.isArray(state().portfolioEntries) ? state().portfolioEntries.slice().sort((a,b) => Number(b.week || 0) - Number(a.week || 0)) : [];
      grid.querySelectorAll('[data-portfolio-trace]').forEach(node => node.remove());
      entries.forEach(entry => {
        const weekId = entryWeekId(entry);
        const week = weekId ? api.catalog[weekId] : null;
        if (!week) return;
        const skills = Array.isArray(week.skills) ? week.skills.filter(Boolean) : [];
        const portfolioPrompt = week.integration?.portfolioPrompt || week.evidence?.prompt || '';
        const card = findCard(grid, weekId, entry);
        if (!card) return;
        card.dataset.portfolioWeek = weekId;
        const demonstrated = entry.reviewStatus === 'demonstrated' && entry.upstreamChangedAfterEvidence !== true;
        const trace = document.createElement('div');
        trace.dataset.portfolioTrace = weekId;
        trace.style.cssText = 'margin-top:8px;padding-top:8px;border-top:1px solid rgba(127,127,127,.18)';
        trace.innerHTML = `<small class="muted"><b>Learning trace:</b> Week ${esc(weekId)} • ${demonstrated ? 'demonstrated proof' : 'developing / review'}${skills.length ? ` • Skills: ${skills.map(esc).join(' · ')}` : ''}</small>${portfolioPrompt ? `<div style="margin-top:8px"><b>Canonical proof prompt</b><div class="muted">${esc(portfolioPrompt)}</div></div>` : ''}<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px"><button class="btn" type="button" data-portfolio-open="${esc(weekId)}">Open source week</button>${!demonstrated ? `<button class="btn primary" type="button" data-portfolio-evidence="${esc(weekId)}">Open Evidence</button>` : ''}</div>`;
        trace.querySelector('[data-portfolio-open]').onclick = () => {
          const stage = entry.upstreamChangedAfterEvidence ? 'apply' : (entry.reviewStatus === 'demonstrated' ? 'evidence' : 'apply');
          api.openStage?.(weekId, stage);
        };
        trace.querySelector('[data-portfolio-evidence]')?.addEventListener('click', () => api.openStage?.(weekId, 'evidence'));
        card.appendChild(trace);
      });
    };
    let scheduled = false;
    const schedule = () => { if (scheduled) return; scheduled = true; setTimeout(() => { scheduled = false; render(); }, 0); };
    store.subscribe(schedule);
    const observer = new MutationObserver(schedule);
    const grid = document.getElementById('portfolioGrid');
    if (grid) observer.observe(grid, { childList: true, subtree: true });
    window.ECRHCanonical.portfolioLearningTrace = { ready: true, render };
    render();
  };
  wait();
})();