/* Electrical Career Readiness Hub — stage definition-of-done UI v1.
 * Makes the canonical completion contract visible inside each learning modal.
 * Read-only projection: the canonical learning state/store remains authoritative.
 */
(function () {
  'use strict';
  const LABELS = { learn: 'Learn', apply: 'Apply', check: 'Check', evidence: 'Evidence' };
  const escapeHtml = value => String(value ?? '').replace(/[&<>\"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '\"':'&quot;', "'":'&#39;' }[c]));
  const api = () => window.ECRHCanonical;
  const store = () => { const x = api(); return typeof x?.store === 'function' ? x.store() : x?.store || null; };
  const contextFor = week => store()?.getState?.()?.contextByWeek?.[String(week)] || {};
  const progressFor = week => store()?.getState?.()?.progressByWeek?.[String(week)] || {};
  function currentStage() {
    const card = document.getElementById('modalCard');
    const marker = card?.querySelector('.k');
    const match = String(marker?.textContent || '').match(/Week\s+(\d+)\s+•\s+(Learn|Apply|Check|Evidence)/i);
    return match ? { week: match[1], stage: match[2].toLowerCase() } : null;
  }
  function checks(week, stage) {
    const c = contextFor(week), p = progressFor(week);
    if (stage === 'learn') return [{ ok: Boolean(p.learn), text: 'Learn content reviewed and the learning checkpoint completed.' }];
    if (stage === 'apply') {
      const a = c.applicationEvidence || {};
      return [
        { ok: Array.isArray(a.tasks) && a.tasks.length > 0 && a.tasks.every(Boolean), text: 'All practical tasks completed.' },
        { ok: Boolean(String(a.deliverable || '').trim()), text: 'Deliverable recorded.' },
        { ok: Boolean(String(a.decisions || '').trim()), text: 'Decisions / reasoning recorded.' },
        { ok: Boolean(String(a.assumptions || '').trim()), text: 'Assumptions / missing inputs recorded.' },
        { ok: Boolean(String(a.verification || '').trim()), text: 'Verification / QA recorded.' }
      ];
    }
    if (stage === 'check') {
      const r = c.assessmentResult || {};
      return [{ ok: Boolean(r.passed && r.completionReady), text: 'Authored knowledge check passed.' }];
    }
    const e = c.evidence || {};
    return [
      { ok: Boolean(e.demonstrated), text: 'Evidence captured and demonstrated through the canonical proof chain.' }
    ];
  }
  function render() {
    const current = currentStage();
    const card = document.getElementById('modalCard');
    if (!current || !card) return;
    let panel = document.getElementById('canonical-definition-of-done');
    if (!panel) {
      panel = document.createElement('div');
      panel.id = 'canonical-definition-of-done';
      panel.className = 'goal';
      panel.style.margin = '10px 0';
      const anchor = card.querySelector('.learning-hero') || card.children[1];
      card.insertBefore(panel, anchor || null);
    }
    const items = checks(current.week, current.stage);
    const complete = items.every(item => item.ok);
    panel.innerHTML = `<b>Definition of done — ${LABELS[current.stage]}</b><small>${complete ? 'Ready to complete this stage.' : 'Complete every requirement below before marking this stage complete.'}</small><div class="rubric">${items.map(item => `<div class="rubric-row"><span>${item.ok ? '✓' : '○'} ${escapeHtml(item.text)}</span><span class="tag${item.ok ? ' pill ok' : ''}">${item.ok ? 'Done' : 'Required'}</span></div>`).join('')}</div>`;
    panel.dataset.stageKey = `${current.week}:${current.stage}`;
  }
  function init() {
    if (typeof document === 'undefined') return;
    const observer = new MutationObserver(render);
    observer.observe(document.body, { childList: true, subtree: true });
    const s = store();
    s?.subscribe?.(render);
    render();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
