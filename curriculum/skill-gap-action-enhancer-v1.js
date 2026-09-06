/* Electrical Career Readiness Hub — actionable skill-gap UI enhancer v1. */
(function () {
  'use strict';
  const api = () => window.ECRHCanonical || null;
  const goToRecommendation = (weekId, stage) => {
    if (!weekId || !stage) return;
    const nav = document.querySelector('[data-page="course"]');
    if (nav) nav.click();
    window.setTimeout(() => {
      const button = document.querySelector(`[data-canonical-open="${String(weekId)}:${String(stage)}"]`);
      if (button && !button.disabled) button.click();
    }, 40);
  };
  const renderAction = (host, action, label) => {
    if (!host || host.querySelector('.skill-gap-action')) return;
    if (!action?.weekId || !action?.stage) return;
    const button = document.createElement('button');
    button.className = 'btn primary skill-gap-action';
    button.type = 'button';
    button.textContent = label || `Open Week ${action.weekId} ${action.stageLabel || action.stage}`;
    button.style.marginTop = '8px';
    button.onclick = () => goToRecommendation(action.weekId, action.stage);
    host.appendChild(button);
  };
  const enhanceHome = () => {
    const root = document.getElementById('gaps');
    const signals = api()?.store?.getState?.().hubSignals;
    const gaps = signals?.prioritySkillGaps || [];
    if (!root || !gaps.length) return;
    Array.from(root.children).forEach((host, index) => {
      const gap = gaps[index];
      if (gap) renderAction(host, gap, gap.recommendedWeekId ? `Work on Week ${gap.recommendedWeekId} ${gap.recommendedStageLabel || gap.recommendedStage}` : 'Strengthen this skill');
    });
  };
  const enhanceSkills = () => {
    const root = document.getElementById('advice');
    const signals = api()?.store?.getState?.().hubSignals;
    const gaps = signals?.prioritySkillGaps || [];
    if (!root || !gaps.length) return;
    Array.from(root.children).forEach((host, index) => {
      const gap = gaps[index];
      if (gap) renderAction(host, gap, gap.recommendedWeekId ? `Open Week ${gap.recommendedWeekId} ${gap.recommendedStageLabel || gap.recommendedStage}` : 'Strengthen this skill');
    });
  };
  const observe = () => { enhanceHome(); enhanceSkills(); };
  const observer = new MutationObserver(observe);
  observer.observe(document.body, { childList: true, subtree: true });
  window.addEventListener('load', observe, { once: true });
})();
