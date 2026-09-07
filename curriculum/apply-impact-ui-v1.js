/* Electrical Career Readiness Hub — Apply impact UI v1.
 * Surfaces structured Apply evidence on Skills without replacing the canonical UI.
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
    if (row.querySelector('[data-apply-impact]')) return;
    const label = row.querySelector('.skillhead span');
    const item = label ? bySkill.get(String(label.textContent).trim()) : null;
    if (!item || !item.applicationEvidenceWeeks) return;
    const badge = document.createElement('small');
    badge.dataset.applyImpact = '1';
    badge.style.color = 'var(--teal)';
    badge.style.fontWeight = '750';
    badge.textContent = `${item.applicationEvidenceWeeks} applied week${item.applicationEvidenceWeeks === 1 ? '' : 's'} • +${item.applyImpact} readiness`;
    row.appendChild(badge);
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
