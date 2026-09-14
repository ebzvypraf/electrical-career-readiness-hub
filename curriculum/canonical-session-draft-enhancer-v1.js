/*
 * Electrical Career Readiness Hub — canonical session draft enhancer v1.1.
 * Preserves incomplete Course work locally so an interrupted session can resume
 * without creating a second learning-state model. Canonical store writes remain
 * the only source of completion/progression truth.
 */
(function () {
  'use strict';
  const KEY = 'ecrh-canonical-session-drafts-v1';
  const read = () => { try { const raw = localStorage.getItem(KEY); return raw ? JSON.parse(raw) : {}; } catch { return {}; } };
  const write = value => { try { localStorage.setItem(KEY, JSON.stringify(value)); } catch {} };
  const draftKey = (weekId, stage) => `${String(weekId)}:${String(stage)}`;
  const collect = (weekId, stage) => {
    const draft = { weekId: String(weekId), stage: String(stage), savedAt: new Date().toISOString() };
    if (stage === 'apply') {
      draft.tasks = [...document.querySelectorAll('.apply-task')].map(x => Boolean(x.checked));
      ['applyDeliverable','applyDecisions','applyAssumptions','applyVerification','applyNotes'].forEach(id => {
        const el = document.getElementById(id); if (el) draft[id] = el.value;
      });
    }
    if (stage === 'check') {
      draft.responses = {};
      document.querySelectorAll('.question input[type="radio"]:checked').forEach(el => {
        const match = String(el.name || '').match(/^canonical-q-(.*)$/); if (match) draft.responses[match[1]] = Number(el.value);
      });
    }
    if (stage === 'evidence') {
      draft.criteria = [...document.querySelectorAll('.criterion')].map(x => Boolean(x.checked));
      ['evidenceTitle','evidenceDescription','evidenceReflection','evidenceNext'].forEach(id => {
        const el = document.getElementById(id); if (el) draft[id] = el.value;
      });
    }
    return draft;
  };
  const hasMeaningful = draft => {
    if (!draft) return false;
    if (draft.stage === 'apply') return Boolean((draft.tasks || []).some(Boolean) || draft.applyDeliverable || draft.applyDecisions || draft.applyAssumptions || draft.applyVerification || draft.applyNotes);
    if (draft.stage === 'check') return Object.keys(draft.responses || {}).length > 0;
    if (draft.stage === 'evidence') return Boolean((draft.criteria || []).some(Boolean) || draft.evidenceTitle || draft.evidenceDescription || draft.evidenceReflection || draft.evidenceNext);
    return false;
  };
  const save = (weekId, stage) => {
    if (!['apply','check','evidence'].includes(String(stage))) return;
    const draft = collect(weekId, stage); const all = read();
    if (hasMeaningful(draft)) { all[draftKey(weekId, stage)] = draft; write(all); }
    else if (all[draftKey(weekId, stage)]) { delete all[draftKey(weekId, stage)]; write(all); }
  };
  const restore = (weekId, stage) => {
    const draft = read()[draftKey(weekId, stage)]; if (!draft) return false;
    if (stage === 'apply') {
      (draft.tasks || []).forEach((checked, i) => { const el = document.querySelector(`.apply-task[data-index="${i}"]`); if (el) el.checked = Boolean(checked); });
      ['applyDeliverable','applyDecisions','applyAssumptions','applyVerification','applyNotes'].forEach(id => { const el = document.getElementById(id); if (el && draft[id] != null) el.value = draft[id]; });
    }
    if (stage === 'check') {
      Object.entries(draft.responses || {}).forEach(([qid, value]) => { const el = document.querySelector(`input[name="canonical-q-${CSS.escape(qid)}"][value="${value}"]`); if (el) el.checked = true; });
    }
    if (stage === 'evidence') {
      (draft.criteria || []).forEach((checked, i) => { const el = document.querySelector(`.criterion[data-index="${i}"]`); if (el) el.checked = Boolean(checked); });
      ['evidenceTitle','evidenceDescription','evidenceReflection','evidenceNext'].forEach(id => { const el = document.getElementById(id); if (el && draft[id] != null) el.value = draft[id]; });
    }
    const card = document.getElementById('modalCard');
    if (card && !card.querySelector('[data-canonical-draft-notice]')) {
      const notice = document.createElement('div'); notice.dataset.canonicalDraftNotice = 'true'; notice.className = 'goal'; notice.style.margin = '10px 0';
      const when = draft.savedAt ? new Date(draft.savedAt) : null;
      notice.innerHTML = `<b>Draft restored</b><small>${when && !Number.isNaN(when.getTime()) ? `Your unfinished ${stage} work was restored from ${when.toLocaleString()}.` : `Your unfinished ${stage} work was restored.`} It is not counted as completed until you save it through the canonical learning action.</small>`;
      card.insertBefore(notice, card.children[1] || null);
    }
    return true;
  };
  const clear = (weekId, stage) => { const all = read(); const key = draftKey(weekId, stage); if (!all[key]) return; delete all[key]; write(all); };
  const attach = (api, weekId, stage) => {
    setTimeout(() => {
      restore(weekId, stage);
      const modal = document.getElementById('modalCard'); if (!modal) return;
      let timer = null;
      const handler = () => { clearTimeout(timer); timer = setTimeout(() => save(weekId, stage), 250); };
      modal.querySelectorAll('input, textarea').forEach(el => el.addEventListener('input', handler));
      modal.querySelectorAll('input[type="checkbox"], input[type="radio"]').forEach(el => el.addEventListener('change', handler));
      const buttonId = stage === 'apply' ? 'canonicalApply' : stage === 'check' ? 'canonicalCheck' : 'canonicalEvidence';
      const button = document.getElementById(buttonId);
      if (button) button.addEventListener('click', () => setTimeout(() => {
        const progress = api.store?.getState()?.progressByWeek?.[String(weekId)] || {};
        if (progress[stage]) clear(weekId, stage);
      }, 0));
    }, 0);
  };
  const detectOpenStage = () => {
    const card = document.getElementById('modalCard');
    if (!card) return null;
    const header = card.querySelector('.k')?.textContent || '';
    const match = header.match(/Week\s+(\d+)\s+•\s+(Learn|Apply|Check|Evidence)/i);
    if (!match) return null;
    return { weekId: match[1], stage: match[2].toLowerCase() };
  };
  const wait = (tries = 100) => {
    const api = window.ECRHCanonical;
    if (!api?.store || typeof api.openStage !== 'function') return tries ? setTimeout(() => wait(tries - 1), 100) : null;
    if (api.sessionDraftEnhancerReady) return;
    const originalOpenStage = api.openStage;
    api.openStage = function (weekId, stage) {
      originalOpenStage(weekId, stage);
      if (['apply','check','evidence'].includes(String(stage))) attach(api, weekId, stage);
    };
    const card = document.getElementById('modalCard');
    if (card) {
      const observer = new MutationObserver(() => {
        const current = detectOpenStage();
        if (current && ['apply','check','evidence'].includes(current.stage)) attach(api, current.weekId, current.stage);
      });
      observer.observe(card, { childList:true, subtree:true });
    }
    api.sessionDraftEnhancerReady = true;
    window.ECRHCanonicalSessionDrafts = { save, restore, clear };
  };
  wait();
})();
