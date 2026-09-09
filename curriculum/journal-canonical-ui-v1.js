/* Electrical Career Readiness Hub — canonical Journal UI bridge v1.
 * Makes the existing Journal surface write through the shared learning-state store
 * while preserving the existing form and legacy state compatibility.
 */
(function () {
  'use strict';

  const LEGACY_KEY = 'ecrh-v35';
  const CANONICAL_KEY = 'ecrh-canonical-journal-v1';
  let installed = false;

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

  function render(entries) {
    const host = document.getElementById('logs');
    if (!host) return;
    const list = Array.isArray(entries) ? entries : [];
    if (!list.length) {
      host.innerHTML = '<div class="empty">No reflections yet. Your first meaningful study note will appear here.</div>';
      return;
    }
    host.innerHTML = list.slice().reverse().map(entry => {
      const date = String(entry?.date || '').slice(0, 10);
      const hours = Number(entry?.hours) || 0;
      const study = String(entry?.study || '').trim();
      const learn = String(entry?.learn || entry?.reflection || '').trim();
      const hard = String(entry?.hard || '').trim();
      const next = String(entry?.next || entry?.nextAction || '').trim();
      const esc = value => String(value ?? '').replace(/[&<>\"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '\"': '&quot;', "'": '&#39;' }[char]));
      return `<div class="goal"><b>${esc(date || 'Undated reflection')}</b>${hours > 0 ? ` · ${esc(hours)}h` : ''}${entry?.stage ? ` · <span class="tag">${esc(entry.stage)}</span>` : ''}<small>${esc(study || 'Learning reflection')}</small>${learn ? `<p>${esc(learn)}</p>` : ''}${hard ? `<p><b>Difficulty:</b> ${esc(hard)}</p>` : ''}${next ? `<p><b>Next:</b> ${esc(next)}</p>` : ''}</div>`;
    }).join('');
  }

  function install() {
    if (installed) return true;
    const store = getStore();
    if (!store) return false;
    installed = true;

    store.subscribe(next => {
      const entries = Array.isArray(next?.journalEntries) ? next.journalEntries : [];
      render(entries);
      writeLegacyJournals(entries);
    });

    document.addEventListener('click', event => {
      const button = event.target?.closest?.('#saveLog');
      if (!button) return;
      const activeStore = getStore();
      if (!activeStore) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      const result = activeStore.addJournalEntry({
        id: `journal-${Date.now()}`,
        date: document.getElementById('jdate')?.value || new Date().toISOString().slice(0, 10),
        hours: Number(document.getElementById('jhours')?.value) || 0,
        study: document.getElementById('jstudy')?.value?.trim() || '',
        learn: document.getElementById('jlearn')?.value?.trim() || '',
        hard: document.getElementById('jhard')?.value?.trim() || '',
        next: document.getElementById('jnext')?.value?.trim() || ''
      });
      if (!result?.ok) {
        window.alert(result?.reason || 'Journal entry could not be saved.');
        return;
      }
      ['jhours', 'jstudy', 'jlearn', 'jhard', 'jnext'].forEach(id => { const node = document.getElementById(id); if (node) node.value = ''; });
      const dateNode = document.getElementById('jdate');
      if (dateNode) dateNode.value = new Date().toISOString().slice(0, 10);
      render(result.state?.journalEntries || []);
    }, true);
    return true;
  }

  function waitForCanonical() {
    if (install()) return;
    window.setTimeout(waitForCanonical, 50);
  }

  if (typeof window !== 'undefined' && typeof document !== 'undefined') waitForCanonical();
})();
