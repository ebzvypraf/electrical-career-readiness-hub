/* Electrical Career Readiness Hub — canonical Journal UI bridge v1.2.
 * Makes the existing Journal surface write through the shared learning-state store
 * while preserving the existing form and legacy state compatibility.
 *
 * Manual Journal entries are linked to the learner's current canonical next action
 * when one exists, so the Journal can be traced back to the same 24-week learning
 * pathway without inventing a second progress model.
 *
 * v1.2 adds a stage-aware learning thread: Journal history can be filtered by
 * Learn / Apply / Check / Evidence and the current canonical next action is shown
 * above the history. The store remains the sole source of progression truth.
 */
(function () {
  'use strict';

  const LEGACY_KEY = 'ecrh-v35';
  const CANONICAL_KEY = 'ecrh-canonical-journal-v1';
  const STAGES = ['all', 'learn', 'apply', 'check', 'evidence'];
  let installed = false;
  let activeFilter = 'all';

  function getStore() {
    const api = typeof window !== 'undefined' ? window.ECRHCanonical : null;
    if (!api) return null;
    const store = typeof api.store === 'function' ? api.store() : api.store;
    return store && typeof store.addJournalEntry === 'function' ? store : null;
  }

  function readLegacy() {
    try { return JSON.parse(localStorage.getItem(LEGACY_KEY) || '{}') || {}; } catch (_) { return {}; }
  }

  function writeLegacyJournals(entries) {
    try {
      const state = readLegacy();
      state.journal = Array.isArray(entries) ? entries : [];
      localStorage.setItem(LEGACY_KEY, JSON.stringify(state));
      window.dispatchEvent(new StorageEvent('storage', { key: LEGACY_KEY, newValue: JSON.stringify(state) }));
    } catch (_) {}
  }

  function esc(value) {
    return String(value ?? '').replace(/[&<>\"']/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '\"':'&quot;', "'":'&#39;' }[char]));
  }

  function currentLearningLink(store) {
    try {
      const next = store?.getState?.()?.hubSignals?.nextBestAction;
      if (!next || next.weekId == null || !next.stage) return {};
      return { weekId: String(next.weekId), stage: String(next.stage) };
    } catch (_) { return {}; }
  }

  function ensureThreadHost() {
    const host = document.getElementById('logs');
    if (!host) return null;
    let thread = document.getElementById('journalLearningThread');
    if (!thread) {
      thread = document.createElement('div');
      thread.id = 'journalLearningThread';
      thread.style.marginBottom = '14px';
      host.parentElement?.insertBefore(thread, host);
    }
    return thread;
  }

  function renderThread(entries, store) {
    const thread = ensureThreadHost();
    if (!thread) return;
    const state = store?.getState?.() || {};
    const next = state.hubSignals?.nextBestAction || null;
    const list = Array.isArray(entries) ? entries : [];
    const counts = STAGES.slice(1).reduce((acc, stage) => {
      acc[stage] = list.filter(entry => String(entry?.stage || '') === stage).length;
      return acc;
    }, {});
    const nextText = next
      ? `Week ${esc(next.weekId)} · ${esc(next.label || next.stage)}${next.week ? ` · ${esc(next.week)}` : ''}`
      : '24-week pathway complete';
    const nextPrompt = next?.prompt || 'Review your strongest evidence and prepare for the next career-readiness step.';
    thread.innerHTML = `<div class="goal" style="margin-bottom:8px"><b>Current learning thread</b><small>Next canonical action: ${nextText}</small><small>${esc(nextPrompt)}</small></div>
      <div class="summary" style="grid-template-columns:repeat(5,1fr);gap:6px;margin-bottom:8px">
        ${STAGES.map(stage => `<button type="button" class="btn ${activeFilter === stage ? 'primary' : ''}" data-journal-filter="${stage}" style="min-width:0">${stage === 'all' ? `All (${list.length})` : `${stage[0].toUpperCase()}${stage.slice(1)} (${counts[stage]})`}</button>`).join('')}
      </div>`;
    thread.querySelectorAll('[data-journal-filter]').forEach(button => {
      button.onclick = () => {
        activeFilter = String(button.dataset.journalFilter || 'all');
        render(entries, store);
      };
    });
  }

  function render(entries, store = getStore()) {
    const host = document.getElementById('logs');
    if (!host) return;
    const list = Array.isArray(entries) ? entries : [];
    renderThread(list, store);
    const filtered = activeFilter === 'all'
      ? list
      : list.filter(entry => String(entry?.stage || '').toLowerCase() === activeFilter);
    if (!filtered.length) {
      host.innerHTML = `<div class="empty">No ${activeFilter === 'all' ? '' : esc(activeFilter + ' ')}reflections yet. Your next canonical learning action can create the next traceable entry.</div>`;
      return;
    }
    host.innerHTML = filtered.slice().reverse().map(entry => {
      const date = String(entry?.date || '').slice(0, 10);
      const hours = Number(entry?.hours) || 0;
      const study = String(entry?.study || '').trim();
      const learn = String(entry?.learn || entry?.reflection || '').trim();
      const hard = String(entry?.hard || '').trim();
      const next = String(entry?.next || entry?.nextAction || '').trim();
      const week = entry?.weekId == null || entry?.weekId === '' ? '' : ` · Week ${String(entry.weekId)}`;
      const stage = entry?.stage ? ` · <span class="tag">${esc(entry.stage)}</span>` : '';
      return `<div class="goal"><b>${esc(date || 'Undated reflection')}</b>${hours > 0 ? ` · ${esc(hours)}h` : ''}${esc(week)}${stage}<small>${esc(study || 'Learning reflection')}</small>${learn ? `<p>${esc(learn)}</p>` : ''}${hard ? `<p><b>Difficulty:</b> ${esc(hard)}</p>` : ''}${next ? `<p><b>Next:</b> ${esc(next)}</p>` : ''}</div>`;
    }).join('');
  }

  function install() {
    if (installed) return true;
    const store = getStore();
    if (!store) return false;
    installed = true;

    store.subscribe(next => {
      const entries = Array.isArray(next?.journalEntries) ? next.journalEntries : [];
      render(entries, store);
      writeLegacyJournals(entries);
    });

    document.addEventListener('click', event => {
      const button = event.target?.closest?.('#saveLog');
      if (!button) return;
      const activeStore = getStore();
      if (!activeStore) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      const link = currentLearningLink(activeStore);
      const result = activeStore.addJournalEntry({
        id: `journal-${Date.now()}`,
        date: document.getElementById('jdate')?.value || new Date().toISOString().slice(0, 10),
        hours: Number(document.getElementById('jhours')?.value) || 0,
        study: document.getElementById('jstudy')?.value?.trim() || '',
        learn: document.getElementById('jlearn')?.value?.trim() || '',
        hard: document.getElementById('jhard')?.value?.trim() || '',
        next: document.getElementById('jnext')?.value?.trim() || '',
        ...link
      });
      if (!result?.ok) {
        window.alert(result?.reason || 'Journal entry could not be saved.');
        return;
      }
      ['jhours', 'jstudy', 'jlearn', 'jhard', 'jnext'].forEach(id => { const node = document.getElementById(id); if (node) node.value = ''; });
      const dateNode = document.getElementById('jdate');
      if (dateNode) dateNode.value = new Date().toISOString().slice(0, 10);
      render(result.state?.journalEntries || [], activeStore);
    }, true);
    return true;
  }

  function waitForCanonical() {
    if (install()) return;
    window.setTimeout(waitForCanonical, 50);
  }

  if (typeof window !== 'undefined' && typeof document !== 'undefined') waitForCanonical();
})();
