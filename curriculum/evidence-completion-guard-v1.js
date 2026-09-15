/* Electrical Career Readiness Hub — Evidence completion guard v1.3.
 * Keeps the canonical Course runtime as the source of truth while preventing
 * an Evidence stage from being submitted with an incomplete proof package.
 * This is a UI preflight only: it does not create or mutate learning state.
 * v1.3 aligns the preflight with the canonical Evidence save control while
 * retaining the prior selector as a compatibility fallback.
 */
(function () {
  'use strict';
  if (window.__ECRHEvidenceCompletionGuardInstalled) return;
  window.__ECRHEvidenceCompletionGuardInstalled = true;

  const get = id => document.getElementById(id);
  const saveSelector = '#canonical-save-evidence, #canonicalEvidence';
  const getSaveButton = () => document.querySelector(saveSelector);
  const text = id => get(id)?.value?.trim() || '';
  const ensureStatus = () => {
    const button = getSaveButton();
    if (!button || get('evidenceCompletionStatus')) return;
    const wrap = document.createElement('div');
    wrap.id = 'evidenceCompletionStatus';
    wrap.className = 'muted';
    wrap.style.cssText = 'margin-top:8px;font-size:12px';
    wrap.setAttribute('role', 'status');
    wrap.setAttribute('aria-live', 'polite');
    button.parentNode?.insertBefore(wrap, button.nextSibling);
  };
  const validate = () => {
    const criteria = [...document.querySelectorAll('.criterion')];
    const evidenceCriteria = [...document.querySelectorAll('[data-evidence-criterion]')];
    const controls = evidenceCriteria.length ? evidenceCriteria : criteria;
    const checked = controls.filter(x => x.checked).length;
    const required = controls.length;
    const missing = [];
    if (!text('evidenceTitle')) missing.push('evidence title');
    if (!text('evidenceDescription')) missing.push('what it proves');
    if (!text('evidenceReflection')) missing.push('reflection');
    if (!text('evidenceNext')) missing.push('next action');
    if (required && checked !== required) {
      const remaining = required - checked;
      missing.push(`${remaining} evidence criteri${remaining === 1 ? 'on' : 'a'} remaining`);
    }
    return { ok: missing.length === 0, missing, checked, required };
  };
  const render = () => {
    const button = getSaveButton();
    if (!button) return;
    ensureStatus();
    const result = validate();
    const status = get('evidenceCompletionStatus');
    if (status) {
      status.textContent = result.ok
        ? 'Proof package complete — ready to capture linked Evidence.'
        : `Before capture: ${result.missing.join(' • ')}`;
    }
    button.setAttribute('aria-describedby', 'evidenceCompletionStatus');
  };

  document.addEventListener('click', event => {
    const button = event.target?.closest?.(saveSelector);
    if (!button) return;
    const result = validate();
    if (result.ok) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    render();
    const firstMissing = !text('evidenceTitle') ? get('evidenceTitle')
      : !text('evidenceDescription') ? get('evidenceDescription')
      : !text('evidenceReflection') ? get('evidenceReflection')
      : !text('evidenceNext') ? get('evidenceNext')
      : document.querySelector('[data-evidence-criterion]:not(:checked), .criterion:not(:checked)');
    firstMissing?.focus?.();
  }, true);

  const observer = new MutationObserver(render);
  observer.observe(document.body, { childList: true, subtree: true });
  ['input', 'change'].forEach(type => document.addEventListener(type, event => {
    if (event.target?.matches?.('#evidenceTitle, #evidenceDescription, #evidenceReflection, #evidenceNext, [data-evidence-criterion], .criterion')) render();
  }, true));
  render();
})();
