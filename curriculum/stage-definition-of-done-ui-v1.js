/* Electrical Career Readiness Hub — stage definition-of-done UI v1.1.
 * Makes the canonical completion contract visible inside each learning modal.
 * Uses the canonical Learning Engine gate as the readiness source of truth.
 * Read-only projection: the canonical learning state/store remains authoritative.
 */
import { canCompleteStage } from './learning-engine-v2.js';

(function () {
  'use strict';

  const LABELS = { learn: 'Learn', apply: 'Apply', check: 'Check', evidence: 'Evidence' };
  const ACTIONS = { learn: 'canonicalLearn', apply: 'canonicalApply', check: 'canonicalCheck', evidence: 'canonicalEvidence' };
  const escapeHtml = value => String(value ?? '').replace(/[&<>\\"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '\\"':'&quot;', "'":'&#39;' }[c]));
  const api = () => window.ECRHCanonical;
  const store = () => {
    const x = api();
    return typeof x?.store === 'function' ? x.store() : x?.store || null;
  };
  const contextFor = week => store()?.getState?.()?.contextByWeek?.[String(week)] || {};
  const progressFor = week => store()?.getState?.()?.progressByWeek?.[String(week)] || {};

  function currentStage() {
    const card = document.getElementById('modalCard');
    const marker = card?.querySelector('.k');
    const match = String(marker?.textContent || '').match(/Week\s+(\d+)\s+•\s+(Learn|Apply|Check|Evidence)/i);
    return match ? { week: match[1], stage: match[2].toLowerCase() } : null;
  }

  function contextForUi(week, stage) {
    const context = { ...contextFor(week) };
    if (stage === 'learn') {
      const input = document.getElementById('canonical-learn-takeaway');
      if (input) context.learnTakeaway = String(input.value || '').trim();
    }
    return context;
  }

  function checks(week, stage) {
    const c = contextForUi(week, stage);
    if (stage === 'learn') return [
      { ok: Boolean(c.learnViewedAt), text: 'Learn content reviewed.' },
      { ok: String(c.learnTakeaway || '').trim().length >= 40, text: 'Active-recall takeaway saved (40+ characters).' }
    ];

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
    return [{ ok: Boolean(e.demonstrated), text: 'Evidence captured and demonstrated through the canonical proof chain.' }];
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

    const context = contextForUi(current.week, current.stage);
    const progress = progressFor(current.week);
    const items = checks(current.week, current.stage);
    const canonicalReady = canCompleteStage(current.stage, context);
    const stageCompleted = Boolean(progress[current.stage]);
    const signature = JSON.stringify({
      key: current.week + ':' + current.stage,
      stageCompleted,
      canonicalReady,
      items
    });

    if (panel.dataset.signature === signature) return;
    panel.dataset.signature = signature;

    const summary = stageCompleted
      ? 'Stage completed.'
      : canonicalReady
        ? 'Ready to complete this stage.'
        : 'Complete every requirement below before marking this stage complete.';

    panel.innerHTML =
      '<b>Definition of done — ' + LABELS[current.stage] + '</b>' +
      '<small>' + summary + '</small>' +
      '<div class="rubric">' +
        items.map(item =>
          '<div class="rubric-row"><span>' +
            (item.ok ? '✓' : '○') + ' ' + escapeHtml(item.text) +
          '</span><span class="tag' + (item.ok ? ' pill ok' : '') + '">' +
            (item.ok ? 'Done' : 'Required') +
          '</span></div>'
        ).join('') +
      '</div>';

    const action = document.getElementById(ACTIONS[current.stage]);
    if (!action || stageCompleted) return;

    if (current.stage === 'learn') {
      action.disabled = !canonicalReady;
      action.title = canonicalReady
        ? 'Learn is ready to complete.'
        : 'Complete the active-recall takeaway before finishing Learn.';
      action.textContent = canonicalReady
        ? 'Mark Learn complete & continue to Apply'
        : 'Save takeaway to unlock Learn completion';
    }
  }

  function init() {
    if (typeof document === 'undefined') return;

    const observer = new MutationObserver(render);
    observer.observe(document.body, { childList: true, subtree: true });

    document.body.addEventListener('input', () => requestAnimationFrame(render), true);
    document.body.addEventListener('change', () => requestAnimationFrame(render), true);

    const s = store();
    s?.subscribe?.(render);
    render();
  }

  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
    else init();
  }
})();
