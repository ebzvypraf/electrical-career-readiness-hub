/* Electrical Career Readiness Hub — actionable skill-gap UI v1. */
(function () {
  'use strict';
  const run = () => {
    const api = window.ECRHCanonical;
    const state = api?.store?.getState?.();
    const signals = state?.hubSignals;
    if (!signals) return;
    const gaps = Array.isArray(signals.prioritySkillGaps) ? signals.prioritySkillGaps : [];
    const mount = (root, key) => {
      if (!root) return;
      const old = root.querySelector('[data-skill-gap-actions]');
      if (old) old.remove();
      if (!gaps.length) return;
      const wrap = document.createElement('div');
      wrap.dataset.skillGapActions = key;
      wrap.className = 'goal';
      const gap = gaps[0];
      const week = gap.recommendedWeekId;
      const stage = gap.recommendedStage;
      wrap.innerHTML = `<b>Next skill action: ${escapeHtml(gap.skill || 'Priority capability')}</b><small>${escapeHtml(gap.reason || 'Complete the recommended learning stage to strengthen this capability.')}</small>${week && stage ? `<button class="btn primary" type="button" data-skill-gap-open="${escapeHtml(String(week))}:${escapeHtml(String(stage))}" style="margin-top:8px">Open ${escapeHtml(gap.recommendedStageLabel || stage)} — Week ${escapeHtml(String(week))}</button>` : ''}`;
      root.prepend(wrap);
    };
    mount(document.getElementById('gaps'), 'home');
    mount(document.getElementById('advice'), 'skills');
    document.querySelectorAll('[data-skill-gap-open]').forEach(btn => {
      btn.onclick = () => {
        const [week, stage] = btn.dataset.skillGapOpen.split(':');
        if (typeof api.openLesson === 'function') api.openLesson(Number(week), stage);
        else document.querySelector(`[data-canonical-open="${CSS.escape(week)}:${CSS.escape(stage)}"]`)?.click();
      };
    });
  };
  const escapeHtml = value => String(value ?? '').replace(/[&<>\"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '\"':'&quot;', "'":'&#39;' }[c]));
  const observe = () => {
    run();
    const api = window.ECRHCanonical;
    if (api?.store?.subscribe) api.store.subscribe(() => run());
    new MutationObserver(run).observe(document.body, { childList: true, subtree: true });
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', observe, { once: true }); else observe();
})();
