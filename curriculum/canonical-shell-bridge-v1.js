/* Canonical shell bridge: keeps Home/Skills/Journal/Portfolio navigation and legacy forms
 * attached to the canonical learning state after the Course runtime takes ownership. */
(function () {
  'use strict';
  const wait = (tries = 80) => {
    const api = window.ECRHCanonical;
    if (!api?.store) return tries ? setTimeout(() => wait(tries - 1), 100) : null;
    const store = api.store;
    const state = () => store.getState();
    const go = id => {
      document.querySelectorAll('.page').forEach(p => p.classList.toggle('active', p.id === id));
      document.querySelectorAll('.nav button').forEach(b => b.classList.toggle('active', b.dataset.page === id));
      api.refresh();
      if (id === 'journal') renderJournal();
    };
    document.querySelectorAll('[data-page]').forEach(b => b.onclick = () => go(b.dataset.page));
    const renderJournal = () => {
      const el = document.getElementById('logs'); if (!el) return;
      const entries = state().journalEntries || [];
      el.innerHTML = entries.slice().reverse().map(x => `<div class="goal"><b>${String(x.date || '')} — ${Number(x.hours || 0)} h</b><div class="muted">${String(x.study || '—').replace(/[&<>\"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[c]))}<br>Learned: ${String(x.learn || '—').replace(/[&<>\"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[c]))}<br>Next: ${String(x.nextAction || x.next || '—').replace(/[&<>\"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[c]))}</div></div>`).join('') || '<div class="empty">No reflections yet.</div>';
    };
    const save = document.getElementById('saveLog');
    if (save) save.onclick = () => {
      const date = document.getElementById('jdate')?.value;
      const hours = Number(document.getElementById('jhours')?.value || 0);
      const study = document.getElementById('jstudy')?.value.trim() || '';
      const learn = document.getElementById('jlearn')?.value.trim() || '';
      const hard = document.getElementById('jhard')?.value.trim() || '';
      const next = document.getElementById('jnext')?.value.trim() || '';
      if (!date || (!study && !learn && !hard && !next && hours <= 0)) return alert('Add a date and study information.');
      const result = store.addJournalEntry({ date, hours, study, learn, hard, next, nextAction: next });
      if (!result.ok) return alert(result.reason || 'Journal entry could not be saved.');
      ['jhours','jstudy','jlearn','jhard','jnext'].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
      renderJournal();
      go('journal');
    };
    const resume = document.getElementById('resume');
    const homeOpen = document.getElementById('homeOpen');
    const openNext = () => { const n = state().hubSignals?.nextBestAction; if (n) api.openStage(n.weekId, n.stage); };
    if (resume) resume.onclick = openNext;
    if (homeOpen) homeOpen.onclick = openNext;
    const modules = document.getElementById('modules');
    if (modules) new MutationObserver(() => {
      if (!modules.querySelector('[data-canonical-week]')) api.refresh();
    }).observe(modules, { childList: true, subtree: true });
    document.querySelectorAll('[data-page]').forEach(b => b.onclick = () => go(b.dataset.page));
    renderJournal();
    window.ECRHCanonical.shellReady = true;
  };
  wait();
})();
