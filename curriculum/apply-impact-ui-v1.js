/* Electrical Career Readiness Hub — Apply impact UI v1.2.
 * Surfaces structured Apply evidence on Skills without replacing the canonical UI.
 * v1.1 adds explicit proof coverage so a learner can see how much of each skill's
 * targeted practical work has actually been evidenced.
 * v1.2 exposes a direct resume action when that skill has an unfinished Apply draft,
 * even when the global next-best action has moved to another stage.
 */
import { buildApplyImpact } from './apply-impact-engine-v1.js';

function enhance() {
  const api = typeof window !== 'undefined' ? window.ECRHCanonical : null;
  const store = api?.store;
  if (!store) return;
  const state = store.getState?.();
  if (!state) return;
  const impacted = buildApplyImpact(api.catalog || {}, state.contextByWeek || {}, state.hubSignals || {});
  const bySkill = new Map((impacted.skills || []).map(item => [String(item.skill), item]));
  document.querySelectorAll('#skills .skillrow').forEach(row => {
    const label = row.querySelector('.skillhead span');
    const item = label ? bySkill.get(String(label.textContent).trim()) : null;
    if (!item) return;
    if (item.applicationEvidenceWeeks && !row.querySelector('[data-apply-impact]')) {
      const badge = document.createElement('small');
      badge.dataset.applyImpact = '1';
      badge.style.color = 'var(--teal)';
      badge.style.fontWeight = '750';
      const coverage = Number(item.applicationEvidenceCoverage) || 0;
      badge.textContent = `${item.applicationEvidenceWeeks} applied week${item.applicationEvidenceWeeks === 1 ? '' : 's'} • ${coverage}% proof coverage • +${item.applyImpact} readiness`;
      row.appendChild(badge);
    }
    const draftWeeks = Array.isArray(item.applicationDraftWeeks) ? item.applicationDraftWeeks : [];
    let resume = row.querySelector('[data-apply-draft-resume]');
    if (!draftWeeks.length) {
      if (resume) resume.remove();
      return;
    }
    const weekId = String(draftWeeks[0]);
    if (!resume) {
      resume = document.createElement('button');
      resume.type = 'button';
      resume.className = 'btn';
      resume.dataset.applyDraftResume = '1';
      resume.style.justifySelf = 'start';
      row.appendChild(resume);
    }
    resume.textContent = `Resume Apply draft · Week ${weekId}`;
    resume.title = `Resume the unfinished Apply work for ${item.skill} from Week ${weekId}.`;
    resume.onclick = () => {
      const canonical = window.ECRHCanonical;
      if (typeof canonical?.openStage === 'function') canonical.openStage(weekId, 'apply');
    };
  });
}

function boot() {
  enhance();
  const store = window.ECRHCanonical?.store;
  store?.subscribe?.(() => enhance());
}

if (typeof window !== 'undefined') {
  if (window.ECRHCanonical?.ready) boot();
  else window.addEventListener('ECRHCanonicalReady', boot, { once: true });
  new MutationObserver(enhance).observe(document.documentElement, { childList: true, subtree: true });
}
