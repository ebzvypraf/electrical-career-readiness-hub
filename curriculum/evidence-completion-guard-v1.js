/* Electrical Career Readiness Hub — Evidence completion guard v1.4.
 * Keeps the canonical Course runtime as the source of truth while preventing
 * an Evidence stage from being submitted with an incomplete proof package.
 * This is a UI preflight only: it does not create or mutate learning state.
 * v1.4 resolves the canonical field IDs used by Course so the visible
 * definition-of-done check validates the actual Evidence form, not legacy IDs.
 */
(function () {
  'use strict';
  if (window.__ECRHEvidenceCompletionGuardInstalled) return;
  window.__ECRHEvidenceCompletionGuardInstalled = true;

  const get = id => document.getElementById(id);
  const saveSelector = '#canonical-save-evidence, #canonicalEvidence';
  const getSaveButton = () => document.querySelector(saveSelector);
  const value = (...ids) => ids.map(id => get(id)?.value?.trim() || '').find(Boolean) || '';
  const field = (...ids) => ids.map(id => get(id)).find(Boolean) || null;

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

  const controls = () => {
    const evidenceCriteria = [...document.querySelectorAll('[data-evidence-criterion]')];
    if (evidenceCriteria.length) return evidenceCriteria;
    return [...document.querySelectorAll('.criterion')];
  };

  const validate = () => {
    const criteria = controls();
    const checked = criteria.filter(x => x.checked).length;
    const required = criteria.length;
    const missing = [];
    if (!value('canonical-et', 'evidenceTitle')) missing.push('evidence title');
    if (!value('canonical-ed', 'evidenceDescription')) missing.push('what it proves');
    if (!value('canon-er', 'evidenceReflection')) missing.push('reflection');
    if (!value('canon-ena', 'evidenceNext')) missing.push('next action');
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
    const firstMissing = !value('canonical-et', 'evidenceTitle') ? field('canonical-et', 'evidenceTitle')
      : !value('canonical-ed', 'evidenceDescription') ? field('canonical-ed', 'evidenceDescription')
      : !value('canon-er', 'evidenceReflection') ? field('canon-er', 'evidenceReflection')
      : !value('canon-ena', 'evidenceNext') ? field('canon-ena', 'evidenceNext')
      : document.querySelector('[data-evidence-criterion]:not(:checked), .criterion:not(:checked)');
    firstMissing?.focus?.();
  }, true);

  const observer = new MutationObserver(render);
  observer.observe(document.body, { childList: true, subtree: true });
  ['input', 'change'].forEach(type => document.addEventListener(type, event => {
    if (event.target?.matches?.('#canonical-et, #canonical-ed, #canon-er, #canon-ena, #evidenceTitle, #evidenceDescription, #evidenceReflection, #evidenceNext, [data-evidence-criterion], .criterion')) render();
  }, true));
  render();
})();
