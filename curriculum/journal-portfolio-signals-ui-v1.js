/* Electrical Career Readiness Hub — Journal + Portfolio canonical signal UI v1.
 * Additive enhancer: exposes richer canonical learning relationships without replacing shell UI.
 */
(function () {
  'use strict';
  const esc = value => String(value ?? '').replace(/[&<>\"']/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '\"':'&quot;', "'":'&#39;' }[char]));
  const getStore = () => window.ECRHCanonical?.store || null;
  let lastJournal = '', lastPortfolio = '';

  function enhance() {
    const store = getStore();
    if (!store) return false;
    const state = store.getState?.();
    if (!state) return false;
    const journals = state.hubSignals?.journal?.entries || state.journalEntries || [];
    const portfolio = state.hubSignals?.portfolio?.entries || state.portfolioEntries || [];
    const logs = document.getElementById('logs');
    if (logs && journals.length) {
      const signature = journals.map(x => `${x.id}|${x.date}|${x.weekId}|${x.stage}|${x.reflection}|${x.nextAction}`).join('||');
      if (signature !== lastJournal) {
        lastJournal = signature;
        logs.querySelectorAll('.goal').forEach((card, index) => {
          const entry = journals.slice().reverse()[index];
          if (!entry || card.querySelector('.canonical-journal-meta')) return;
          const meta = document.createElement('div');
          meta.className = 'canonical-journal-meta';
          meta.style.cssText = 'margin-top:8px;display:flex;gap:6px;flex-wrap:wrap;align-items:center;font-size:10px';
          if (entry.weekId) meta.innerHTML += `<span class="pill">Week ${esc(entry.weekId)}</span>`;
          if (entry.stage) meta.innerHTML += `<span class="tag">${esc(entry.stage)}</span>`;
          if (entry.reflection) meta.innerHTML += `<span class="muted">Reflection captured</span>`;
          if (entry.nextAction) meta.innerHTML += `<span class="muted">Next: ${esc(entry.nextAction)}</span>`;
          card.appendChild(meta);
        });
      }
    }
    const grid = document.getElementById('portfolioGrid');
    if (grid && portfolio.length) {
      const signature = portfolio.map(x => `${x.id}|${x.week}|${x.evidenceQuality}|${x.reviewStatus}|${x.reflection}|${x.nextAction}|${(x.criteria||[]).length}`).join('||');
      if (signature !== lastPortfolio) {
        lastPortfolio = signature;
        grid.querySelectorAll('.evidence').forEach((card, index) => {
          const entry = portfolio[index];
          if (!entry || card.querySelector('.canonical-portfolio-meta')) return;
          const meta = document.createElement('div');
          meta.className = 'canonical-portfolio-meta';
          meta.style.cssText = 'margin-top:10px;padding-top:8px;border-top:1px solid var(--line);display:grid;gap:5px;font-size:11px';
          const quality = entry.evidenceQuality ? `<span class="pill ${entry.evidenceQuality === 'high' ? 'ok' : ''}">${esc(entry.evidenceQuality)} quality</span>` : '';
          const review = entry.reviewStatus ? `<span class="tag">${esc(entry.reviewStatus)}</span>` : '';
          const criteria = Array.isArray(entry.criteria) && entry.criteria.length ? `<span class="muted">${entry.criteria.filter(x => x?.satisfied).length}/${entry.criteria.length} evidence criteria satisfied</span>` : '';
          const reflection = entry.reflection ? `<span><b>Reflection:</b> ${esc(entry.reflection)}</span>` : '';
          const next = entry.nextAction ? `<span><b>Next:</b> ${esc(entry.nextAction)}</span>` : '';
          meta.innerHTML = `<div style="display:flex;gap:6px;flex-wrap:wrap">${quality}${review}${criteria}</div>${reflection}${next}`;
          card.appendChild(meta);
        });
      }
    }
    return true;
  }

  function boot() {
    if (enhance()) {
      const store = getStore();
      store?.subscribe?.(() => setTimeout(enhance, 0));
    }
    const observer = new MutationObserver(() => enhance());
    observer.observe(document.body, { childList: true, subtree: true });
    setTimeout(boot, 500);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true }); else boot();
})();
