/* Electrical Career Readiness Hub — Portfolio learning trace UI v1.
 * Projects canonical Portfolio evidence back to the exact Week + catalog skills
 * and provides a direct return path into the canonical Course stage.
 * This is a projection only; the learning-state store remains authoritative.
 */
(function () {
  'use strict';
  const esc = value => String(value ?? '').replace(/[&<>\"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '\"':'&quot;', "'":'&#39;' }[c]));
  const wait = (tries = 80) => {
    const api = window.ECRHCanonical;
    if (!api?.store || !api?.catalog) return tries ? setTimeout(() => wait(tries - 1), 100) : null;
    const store = api.store;
    const state = () => store.getState();
    const render = () => {
      const grid = document.getElementById('portfolioGrid');
      if (!grid) return;
      const entries = Array.isArray(state().portfolioEntries) ? state().portfolioEntries.slice().sort((a,b) => Number(b.week || 0) - Number(a.week || 0)) : [];
      grid.querySelectorAll('[data-portfolio-trace]').forEach(node => node.remove());
      entries.forEach(entry => {
        const weekId = String(entry.week ?? '');
        if (!weekId || !api.catalog[weekId]) return;
        const skills = Array.isArray(api.catalog[weekId].skills) ? api.catalog[weekId].skills.filter(Boolean) : [];
        const cards = [...grid.children];
        const card = cards.find(node => node.textContent?.includes(`Week ${weekId}`) && node.textContent?.includes(entry.title || ''));
        if (!card) return;
        const trace = document.createElement('div');
        trace.dataset.portfolioTrace = weekId;
        trace.style.cssText = 'margin-top:8px;padding-top:8px;border-top:1px solid rgba(127,127,127,.18)';
        const demonstrated = entry.reviewStatus === 'demonstrated' && entry.upstreamChangedAfterEvidence !== true;
        trace.innerHTML = `<small class="muted"><b>Learning trace:</b> Week ${esc(weekId)} • ${demonstrated ? 'demonstrated proof' : 'developing / review'}${skills.length ? ` • Skills: ${skills.map(esc).join(' · ')}` : ''}</small><div style="margin-top:6px"><button class="btn" type="button" data-portfolio-open="${esc(weekId)}">Open source week</button></div>`;
        trace.querySelector('[data-portfolio-open]').onclick = () => {
          const stage = entry.upstreamChangedAfterEvidence ? 'apply' : (entry.reviewStatus === 'demonstrated' ? 'evidence' : 'apply');
          api.openStage?.(weekId, stage);
        };
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