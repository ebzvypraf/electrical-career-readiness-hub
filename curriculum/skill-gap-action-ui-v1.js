/* Electrical Career Readiness Hub — actionable skill-gap UI v1. */
(function () {
  'use strict';
  const escapeHtml = value => String(value ?? '').replace(/[&<>\"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '\"':'&quot;', "'":'&#39;' }[c]));
  const run = () => {
    const api = window.ECRHCanonical;
    const store = api?.store?.();
    const state = store?.getState?.();
    const signals = state?.hubSignals;
    if (!signals) return;
    const gaps = Array.isArray(signals.prioritySkillGaps) ? signals.prioritySkillGaps : [];
    const recoveryWeeks = Object.entries(state?.contextByWeek || {}).filter(([, context]) => context?.recoveryProvenance?.recovered || context?.evidence?.recoveryProvenance?.recovered);
    const mount = (root, key) => {
      if (!root) return;
      root.querySelectorAll('[data-skill-gap-actions],[data-recovered-capability]').forEach(node => node.remove());
      if (recoveryWeeks.length) {
        const recovery = document.createElement('div');
        recovery.dataset.recoveredCapability = key;
        recovery.className = 'goal';
        recovery.innerHTML = `<b>Recovered capability</b><small>${recoveryWeeks.length} week${recoveryWeeks.length === 1 ? '' : 's'} now include${recoveryWeeks.length === 1 ? 's' : ''} a successful post-reinforcement Check. Treat this as demonstrated recovery, not a duplicate skill rating.</small>`;
        root.prepend(recovery);
      }
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
  const observe = () => {
    run();
    const api = window.ECRHCanonical;
    if (api?.store?.subscribe) api.store.subscribe(() => run());
    new MutationObserver(run).observe(document.body, { childList: true, subtree: true });
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', observe, { once: true }); else observe();
})();
