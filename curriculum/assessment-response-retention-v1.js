/*
 * Electrical Career Readiness Hub — assessment response retention v6.2.
 * Restores the learner's latest canonical Check responses when the production
 * Check modal is reopened, and surfaces the persisted attempt/recovery trail
 * so Check, remediation and Evidence remain visibly connected.
 * v6.1 aligns the recovery-context insertion point with both canonical and
 * legacy Check submit controls without changing assessment scoring.
 * v6.2 autosaves in-progress Check responses through the existing canonical
 * stage context, reducing lost work without treating a draft as a submission.
 */
(function () {
  'use strict';
  const getState = () => window.ECRHCanonical?.store?.getState?.() || null;
  let saveTimer = null;
  let boundCard = null;

  function weekFromCard(card) {
    const marker = card?.querySelector('.k');
    const match = String(marker?.textContent || '').match(/Week\s+(\d+)\s+•\s+Check/i);
    return match ? String(Number(match[1])) : null;
  }

  function collectResponses(card) {
    const responses = {};
    card?.querySelectorAll('input[type="radio"]:checked').forEach(input => {
      const name = String(input.name || '');
      const canonical = name.match(/^canonical-q-(.+)$/);
      const legacy = name.match(/^(?:canonical-q|cq)(\d+)$/);
      const token = canonical?.[1] ?? (legacy ? legacy[1] : null);
      if (token != null) responses[token] = input.value;
    });
    card?.querySelectorAll('textarea[id]').forEach(textarea => {
      const id = String(textarea.id || '');
      const canonical = id.match(/^canonical-answer-(.+)$/);
      const legacy = id.match(/^(?:canonical-answer-|ca)(\d+)$/);
      const token = canonical?.[1] ?? (legacy ? legacy[1] : null);
      if (token != null && String(textarea.value || '').trim()) responses[token] = textarea.value;
    });
    return responses;
  }

  function persistDraft(card) {
    const weekId = weekFromCard(card);
    const store = window.ECRHCanonical?.store;
    if (!weekId || !store?.updateStageContext) return;
    const responses = collectResponses(card);
    if (!Object.keys(responses).length) return;
    const current = getState()?.contextByWeek?.[weekId]?.assessmentResult || {};
    store.updateStageContext(weekId, {
      assessmentResult: {
        ...current,
        responses,
        draft: true,
        draftSavedAt: new Date().toISOString()
      }
    });
  }

  function scheduleDraftSave(card, immediate = false) {
    if (saveTimer) clearTimeout(saveTimer);
    if (immediate) return persistDraft(card);
    saveTimer = setTimeout(() => {
      saveTimer = null;
      persistDraft(card);
    }, 450);
  }

  function restoreLatestResponses() {
    const card = document.getElementById('modalCard');
    if (!card) return;
    const weekId = weekFromCard(card);
    if (!weekId) return;
    const result = getState()?.contextByWeek?.[weekId]?.assessmentResult;
    const responses = result?.responses;
    if (!responses || typeof responses !== 'object') return;

    const keys = Object.keys(responses);
    const findKey = token => {
      const value = String(token ?? '');
      return keys.find(key => String(key) === value)
        ?? keys.find(key => String(key).toLowerCase() === value.toLowerCase())
        ?? (value.match(/^q(\d+)$/i) ? keys.find(key => String(key) === value) : null);
    };

    card.querySelectorAll('input[type="radio"]').forEach(input => {
      const name = String(input.name || '');
      const canonical = name.match(/^canonical-q-(.+)$/);
      const legacy = name.match(/^(?:canonical-q|cq)(\d+)$/);
      const token = canonical?.[1] ?? (legacy ? legacy[1] : null);
      if (token == null) return;
      const key = findKey(token) ?? (legacy ? findKey(`q${Number(legacy[1]) + 1}`) : null);
      if (key != null && String(responses[key]) === String(input.value)) input.checked = true;
    });

    card.querySelectorAll('textarea[id]').forEach(textarea => {
      const id = String(textarea.id);
      const canonical = id.match(/^canonical-answer-(.+)$/);
      const legacy = id.match(/^(?:canonical-answer-|ca)(\d+)$/);
      const token = canonical?.[1] ?? (legacy ? legacy[1] : null);
      if (token == null) return;
      const key = findKey(token) ?? (legacy ? findKey(`q${Number(legacy[1]) + 1}`) : null);
      if (key != null && !textarea.value) textarea.value = String(responses[key] ?? '');
    });
  }

  function bindDraftAutosave(card) {
    if (!card || boundCard === card) return;
    boundCard = card;
    const handler = event => {
      if (event.target?.matches?.('input[type="radio"], textarea')) scheduleDraftSave(card);
    };
    card.addEventListener('input', handler);
    card.addEventListener('change', handler);
    card.addEventListener('focusout', event => {
      if (event.target?.matches?.('input[type="radio"], textarea')) scheduleDraftSave(card, true);
    });
  }

  function renderAttemptContext() {
    const card = document.getElementById('modalCard');
    if (!card) return;
    const weekId = weekFromCard(card);
    if (!weekId) return;
    const current = getState()?.contextByWeek?.[weekId];
    const result = current?.assessmentResult;
    if (!result) return;

    let panel = card.querySelector('#canonical-check-recovery-context');
    if (!panel) {
      panel = document.createElement('div');
      panel.id = 'canonical-check-recovery-context';
      panel.className = 'result';
      const button = card.querySelector('#canonical-score, #canonicalCheck');
      button?.parentElement?.insertBefore(panel, button);
    }
    if (!panel) return;

    const history = Array.isArray(result.assessmentHistory) ? result.assessmentHistory : [];
    const attempt = Number(result.attemptNumber || history.length || 1);
    const missed = Array.isArray(result.missedQuestionIds) ? result.missedQuestionIds.length : 0;
    const remediation = current?.remediation || null;
    const status = String(remediation?.status || '');
    const recovered = Boolean(result.recovered);
    const parts = [`Attempt ${attempt}`];
    if (result.draft) parts.push('draft autosaved');
    if (missed) parts.push(`${missed} missed item${missed === 1 ? '' : 's'}`);
    if (recovered) parts.push('recovered after reinforcement');
    if (!result.passed && status === 'required') parts.push('targeted reinforcement required');
    if (status === 'ready-to-retry') parts.push('reinforcement complete — retry ready');
    if (status === 'complete') parts.push('reinforcement completed');
    panel.textContent = parts.join(' • ');
  }

  function refreshCheckContext() {
    const card = document.getElementById('modalCard');
    restoreLatestResponses();
    if (card) bindDraftAutosave(card);
    renderAttemptContext();
  }

  if (typeof MutationObserver !== 'undefined') {
    const observer = new MutationObserver(() => {
      if (document.getElementById('modal')?.classList.contains('show')) refreshCheckContext();
    });
    observer.observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
  }
  window.ECRHAssessmentResponseRetention = { restoreLatestResponses, renderAttemptContext, refreshCheckContext, persistDraft: () => persistDraft(document.getElementById('modalCard')) };
})();
