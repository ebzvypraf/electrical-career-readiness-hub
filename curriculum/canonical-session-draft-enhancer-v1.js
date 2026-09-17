/*
 * Electrical Career Readiness Hub — canonical session draft enhancer v1.2.
 * Keeps interrupted Apply / Check / Evidence work resumable through the shared
 * canonical learning-state store instead of a second draft persistence model.
 * Existing local session drafts are migrated once for continuity, then the
 * canonical store becomes the only active source for resumable work.
 */
(function () {
  'use strict';
  const LEGACY_KEY = 'ecrh-canonical-session-drafts-v1';
  const STAGES = ['apply', 'check', 'evidence'];
  let saveTimer = null;
  let lastDraftSignature = '';

  const getApi = () => window.ECRHCanonical;
  const getStore = () => {
    const api = getApi();
    return typeof api?.store === 'function' ? api.store() : api?.store || null;
  };
  const state = () => getStore()?.getState?.() || {};
  const contextFor = weekId => state().contextByWeek?.[String(weekId)] || {};
  const draftFor = (weekId, stage) => contextFor(weekId)?.sessionDraft?.[String(stage)] || null;
  const draftKey = (weekId, stage) => `${String(weekId)}:${String(stage)}`;

  const readLegacy = () => {
    try {
      const raw = localStorage.getItem(LEGACY_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  };
  const clearLegacy = () => {
    try { localStorage.removeItem(LEGACY_KEY); } catch {}
  };

  const collect = (weekId, stage) => {
    const draft = { weekId: String(weekId), stage: String(stage), savedAt: new Date().toISOString() };
    if (stage === 'apply') {
      draft.tasks = [...document.querySelectorAll('.apply-task')].map(x => Boolean(x.checked));
      ['applyDeliverable', 'applyDecisions', 'applyAssumptions', 'applyVerification', 'applyNotes'].forEach(id => {
        const el = document.getElementById(id); if (el) draft[id] = el.value;
      });
    }
    if (stage === 'check') {
      draft.responses = {};
      document.querySelectorAll('.question input[type="radio"]:checked').forEach(el => {
        const name = String(el.name || '');
        const canonical = name.match(/^canonical-q-(.*)$/);
        const legacy = name.match(/^(?:cq)(\d+)$/);
        const token = canonical?.[1] ?? (legacy ? legacy[1] : null);
        if (token != null) draft.responses[token] = Number(el.value);
      });
    }
    if (stage === 'evidence') {
      draft.criteria = [...document.querySelectorAll('.criterion[data-index]')].map(x => Boolean(x.checked));
      ['evidenceTitle', 'evidenceDescription', 'evidenceReflection', 'evidenceNext'].forEach(id => {
        const el = document.getElementById(id); if (el) draft[id] = el.value;
      });
      const canonicalFields = [['canonical-et', 'evidenceTitle'], ['canonical-ed', 'evidenceDescription'], ['canon-er', 'evidenceReflection'], ['canon-ena', 'evidenceNext']];
      canonicalFields.forEach(([source, target]) => {
        const el = document.getElementById(source); if (el) draft[target] = el.value;
      });
      ['canon-eal', 'canon-ecl'].forEach(id => {
        const el = document.getElementById(id); if (el) draft[id] = el.value;
      });
      const qualityCriteria = [...document.querySelectorAll('[id^="criterion_"]')].map(x => Boolean(x.checked));
      if (qualityCriteria.length) draft.criteria = qualityCriteria;
    }
    return draft;
  };

  const hasMeaningful = draft => {
    if (!draft) return false;
    if (draft.stage === 'apply') return Boolean((draft.tasks || []).some(Boolean) || draft.applyDeliverable || draft.applyDecisions || draft.applyAssumptions || draft.applyVerification || draft.applyNotes);
    if (draft.stage === 'check') return Object.keys(draft.responses || {}).length > 0;
    if (draft.stage === 'evidence') return Boolean((draft.criteria || []).some(Boolean) || draft.evidenceTitle || draft.evidenceDescription || draft.evidenceReflection || draft.evidenceNext || draft['canon-eal'] || draft['canon-ecl']);
    return false;
  };

  const signatureFor = draft => JSON.stringify(draft || {});

  const save = (weekId, stage) => {
    const store = getStore();
    if (!store || !STAGES.includes(String(stage)) || weekId == null || typeof store.updateStageContext !== 'function') return false;
    const draft = collect(weekId, stage);
    const signature = signatureFor({
      tasks: draft.tasks,
      applyDeliverable: draft.applyDeliverable,
      applyDecisions: draft.applyDecisions,
      applyAssumptions: draft.applyAssumptions,
      applyVerification: draft.applyVerification,
      applyNotes: draft.applyNotes,
      responses: draft.responses,
      criteria: draft.criteria,
      evidenceTitle: draft.evidenceTitle,
      evidenceDescription: draft.evidenceDescription,
      evidenceReflection: draft.evidenceReflection,
      evidenceNext: draft.evidenceNext,
      canonEal: draft['canon-eal'],
      canonEcl: draft['canon-ecl']
    });
    if (!hasMeaningful(draft)) return clear(weekId, stage);
    if (signature === lastDraftSignature) return true;
    lastDraftSignature = signature;
    const currentContext = contextFor(weekId);
    const sessionDraft = { ...(currentContext.sessionDraft || {}), [String(stage)]: draft };
    store.updateStageContext(String(weekId), { sessionDraft });
    return true;
  };

  const scheduleSave = (weekId, stage) => {
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      saveTimer = null;
      save(weekId, stage);
    }, 400);
  };

  const clear = (weekId, stage) => {
    const store = getStore();
    if (!store || weekId == null || !STAGES.includes(String(stage)) || typeof store.updateStageContext !== 'function') return false;
    const currentContext = contextFor(weekId);
    const currentDrafts = { ...(currentContext.sessionDraft || {}) };
    if (!Object.prototype.hasOwnProperty.call(currentDrafts, String(stage))) return true;
    delete currentDrafts[String(stage)];
    store.updateStageContext(String(weekId), { sessionDraft: currentDrafts });
    lastDraftSignature = '';
    return true;
  };

  const restore = (weekId, stage) => {
    const draft = draftFor(weekId, stage);
    if (!draft) return false;
    if (stage === 'apply') {
      (draft.tasks || []).forEach((checked, i) => {
        const el = document.querySelector(`.apply-task[data-index="${i}"]`);
        if (el) el.checked = Boolean(checked);
      });
      ['applyDeliverable', 'applyDecisions', 'applyAssumptions', 'applyVerification', 'applyNotes'].forEach(id => {
        const el = document.getElementById(id); if (el && draft[id] != null) el.value = draft[id];
      });
    }
    if (stage === 'check') {
      Object.entries(draft.responses || {}).forEach(([qid, value]) => {
        const escaped = typeof CSS !== 'undefined' && CSS.escape ? CSS.escape(qid) : String(qid).replace(/[^a-zA-Z0-9_-]/g, '\\$&');
        const el = document.querySelector(`input[name="canonical-q-${escaped}"][value="${value}"]`);
        if (el) el.checked = true;
      });
    }
    if (stage === 'evidence') {
      (draft.criteria || []).forEach((checked, i) => {
        const el = document.querySelector(`.criterion[data-index="${i}"]`);
        if (el) el.checked = Boolean(checked);
      });
      ['evidenceTitle', 'evidenceDescription', 'evidenceReflection', 'evidenceNext'].forEach(id => {
        const el = document.getElementById(id); if (el && draft[id] != null && !el.value) el.value = draft[id];
      });
      [['canonical-et', 'evidenceTitle'], ['canonical-ed', 'evidenceDescription'], ['canon-er', 'evidenceReflection'], ['canon-ena', 'evidenceNext']].forEach(([canonicalId, legacyId]) => {
        const canonical = document.getElementById(canonicalId);
        const legacy = document.getElementById(legacyId);
        const value = draft[legacyId];
        if (canonical && value != null && !canonical.value) canonical.value = value;
      });
      ['canon-eal', 'canon-ecl'].forEach(id => {
        const el = document.getElementById(id); if (el && draft[id] != null && !el.value) el.value = draft[id];
      });
      (draft.criteria || []).forEach((checked, i) => {
        const quality = document.getElementById('criterion_' + (i + 1));
        if (quality) quality.checked = Boolean(checked);
      });
    }
    const card = document.getElementById('modalCard');
    if (card) {
      const key = draftKey(weekId, stage);
      let notice = card.querySelector('[data-canonical-draft-notice]');
      if (!notice) {
        notice = document.createElement('div');
        notice.dataset.canonicalDraftNotice = 'true';
        notice.className = 'goal';
        notice.style.margin = '10px 0';
        card.insertBefore(notice, card.children[1] || null);
      }
      if (notice.dataset.draftKey !== key) {
        notice.dataset.draftKey = key;
        const when = draft.savedAt ? new Date(draft.savedAt) : null;
        notice.innerHTML = `<b>Draft restored</b><small>${when && !Number.isNaN(when.getTime()) ? `Your unfinished ${stage} work was restored from ${when.toLocaleString()}.` : `Your unfinished ${stage} work was restored.`} It is not counted as completed until you save it through the canonical learning action.</small>`;
      }
    }
    lastDraftSignature = signatureFor({
      tasks: draft.tasks,
      applyDeliverable: draft.applyDeliverable,
      applyDecisions: draft.applyDecisions,
      applyAssumptions: draft.applyAssumptions,
      applyVerification: draft.applyVerification,
      applyNotes: draft.applyNotes,
      responses: draft.responses,
      criteria: draft.criteria,
      evidenceTitle: draft.evidenceTitle,
      evidenceDescription: draft.evidenceDescription,
      evidenceReflection: draft.evidenceReflection,
      evidenceNext: draft.evidenceNext,
      canonEal: draft['canon-eal'],
      canonEcl: draft['canon-ecl']
    });
    return true;
  };

  const migrateLegacy = () => {
    const store = getStore();
    if (!store || typeof store.updateStageContext !== 'function') return;
    const legacy = readLegacy();
    const entries = Object.values(legacy || {}).filter(item => item && STAGES.includes(String(item.stage)) && item.weekId != null);
    if (!entries.length) return;
    entries.forEach(item => {
      const existing = draftFor(item.weekId, item.stage);
      if (!existing) {
        const currentContext = contextFor(item.weekId);
        const sessionDraft = { ...(currentContext.sessionDraft || {}), [String(item.stage)]: item };
        store.updateStageContext(String(item.weekId), { sessionDraft });
      }
    });
    clearLegacy();
  };

  const detectOpenStage = () => {
    const card = document.getElementById('modalCard');
    if (!card) return null;
    const header = card.querySelector('.k')?.textContent || '';
    const match = header.match(/Week\s+(\d+)\s+•\s+(Learn|Apply|Check|Evidence)/i);
    if (!match) return null;
    const stage = match[2].toLowerCase();
    return STAGES.includes(stage) ? { weekId: match[1], stage } : null;
  };

  const restoreCurrent = () => {
    const current = detectOpenStage();
    if (current) restore(current.weekId, current.stage);
    return current;
  };

  const bindModal = () => {
    const modal = document.getElementById('modalCard');
    if (!modal || modal.dataset.canonicalDraftListeners === '1') return;
    modal.dataset.canonicalDraftListeners = '1';
    const scheduleCurrentSave = () => {
      const current = detectOpenStage();
      if (current) scheduleSave(current.weekId, current.stage);
    };
    modal.addEventListener('input', event => {
      if (event.target?.matches?.('input, textarea')) scheduleCurrentSave();
    });
    modal.addEventListener('change', event => {
      if (event.target?.matches?.('input[type="checkbox"], input[type="radio"]')) scheduleCurrentSave();
    });
    modal.addEventListener('focusout', event => {
      if (event.target?.matches?.('input, textarea')) {
        const current = detectOpenStage();
        if (current) save(current.weekId, current.stage);
      }
    });
  };

  const bindCompletionCleanup = () => {
    const store = getStore();
    if (!store?.subscribe || store.__canonicalDraftCleanupBound) return;
    store.__canonicalDraftCleanupBound = true;
    store.subscribe(next => {
      const progress = next?.progressByWeek || {};
      STAGES.forEach(stage => {
        Object.keys(next?.contextByWeek || {}).forEach(weekId => {
          if (progress?.[weekId]?.[stage] && next.contextByWeek?.[weekId]?.sessionDraft?.[stage]) clear(weekId, stage);
        });
      });
    });
  };

  const attach = (api, weekId, stage) => {
    setTimeout(() => {
      bindModal();
      restore(weekId, stage);
    }, 0);
  };

  const wait = (tries = 100) => {
    const api = getApi();
    if (!api?.store || typeof api.openStage !== 'function') return tries ? setTimeout(() => wait(tries - 1), 100) : null;
    if (api.sessionDraftEnhancerReady) return;
    migrateLegacy();
    bindCompletionCleanup();
    const originalOpenStage = api.openStage;
    api.openStage = function (weekId, stage) {
      originalOpenStage(weekId, stage);
      if (STAGES.includes(String(stage))) attach(api, weekId, String(stage));
    };
    const card = document.getElementById('modalCard');
    if (card) {
      const observer = new MutationObserver(() => {
        const current = restoreCurrent();
        if (current) bindModal();
      });
      observer.observe(card, { childList:true, subtree:true });
    }
    api.sessionDraftEnhancerReady = true;
    window.ECRHCanonicalSessionDrafts = { save, restore, clear };
  };

  wait();
})();