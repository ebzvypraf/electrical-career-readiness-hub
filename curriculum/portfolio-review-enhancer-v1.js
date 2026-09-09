/* Electrical Career Readiness Hub — Portfolio Review enhancer v1.
 * Adds a self-review workflow to canonical portfolio evidence without replacing
 * the production portfolio renderer. Review status remains evidence-bound: a
 * record can only be marked demonstrated when all captured rubric criteria pass.
 */
(function () {
  'use strict';

  function text(value) { return String(value == null ? '' : value).trim(); }
  function esc(value) { return text(value).replace(/[&<>\"']/g, function (char) { return ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '\"':'&quot;', "'":'&#39;' }[char]); }); }
  function api() { return typeof window !== 'undefined' ? window.ECRHCanonical : null; }
  function store() { const canonical = api(); return typeof canonical?.store === 'function' ? canonical.store() : canonical?.store || null; }
  function entries() { const s = store(); return s && s.getState ? (s.getState().portfolioEntries || []) : []; }

  function statusMeta(entry) {
    const status = text(entry.reviewStatus) || 'draft';
    if (status === 'demonstrated') return { label: 'Demonstrated', cls: 'ok', note: 'All required evidence criteria are satisfied.' };
    if (status === 'needs-review') return { label: 'Needs review', cls: 'warn', note: 'Use self-review to identify what still needs strengthening.' };
    return { label: 'Developing', cls: '', note: 'Keep developing this evidence before treating it as demonstrated.' };
  }

  function criteriaComplete(entry) {
    const criteria = Array.isArray(entry.criteria) ? entry.criteria : [];
    return criteria.length === 0 || criteria.every(function (criterion) { return criterion && criterion.satisfied === true; });
  }

  function decorate() {
    const grid = document.getElementById('portfolioGrid');
    if (!grid || grid.dataset.portfolioReviewEnhanced === '1') return;
    const items = entries();
    if (!items.length) return;
    const cards = Array.from(grid.querySelectorAll('.evidence'));
    cards.forEach(function (card, index) {
      const entry = items[index];
      if (!entry || card.dataset.reviewEnhanced === '1') return;
      const meta = statusMeta(entry);
      const criteriaOk = criteriaComplete(entry);
      const review = document.createElement('div');
      review.className = 'learning-card';
      review.style.marginTop = '12px';
      review.innerHTML = '<div style="display:flex;justify-content:space-between;gap:10px;align-items:center;flex-wrap:wrap">' +
        '<div><b>Self-review status</b><div class="muted">' + esc(meta.note) + '</div></div>' +
        '<span class="pill ' + meta.cls + '">' + esc(meta.label) + '</span></div>' +
        '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px">' +
        '<button class="btn" type="button" data-portfolio-review="developing">Keep developing</button>' +
        '<button class="btn" type="button" data-portfolio-review="needs-review">Needs review</button>' +
        '<button class="btn primary" type="button" data-portfolio-review="demonstrated" ' + (criteriaOk ? '' : 'disabled aria-disabled="true"') + '>Mark demonstrated</button>' +
        '</div>' + (!criteriaOk ? '<small class="muted" style="display:block;margin-top:8px">Complete every required evidence criterion before marking this capability demonstrated.</small>' : '') +
        '<div class="muted" style="margin-top:8px">Competency: ' + esc((entry.competency || []).join(', ') || 'Learning capability') + '</div>';
      card.appendChild(review);
      card.dataset.reviewEnhanced = '1';

      review.querySelectorAll('[data-portfolio-review]').forEach(function (button) {
        button.addEventListener('click', function () {
          const action = button.dataset.portfolioReview;
          const current = entries().find(function (candidate) { return String(candidate.id) === String(entry.id); }) || entry;
          if (action === 'demonstrated' && !criteriaComplete(current)) {
            window.alert('This evidence cannot be marked demonstrated until all required criteria are satisfied.');
            return;
          }
          const s = store();
          if (!s || typeof s.addPortfolioEntry !== 'function') return;
          const nextStatus = action === 'demonstrated' ? 'demonstrated' : action === 'needs-review' ? 'needs-review' : 'draft';
          const result = s.addPortfolioEntry({ ...current, reviewStatus: nextStatus });
          if (!result.ok) window.alert(result.reason || 'Portfolio review could not be saved.');
        });
      });
    });
    grid.dataset.portfolioReviewEnhanced = '1';
  }

  function enhanceReadiness() {
    const target = document.getElementById('readiness');
    if (!target) return;
    const items = entries();
    const demonstrated = items.filter(function (x) { return text(x.reviewStatus) === 'demonstrated'; }).length;
    const review = items.filter(function (x) { return text(x.reviewStatus) === 'needs-review'; }).length;
    const developing = items.filter(function (x) { return !text(x.reviewStatus) || text(x.reviewStatus) === 'draft'; }).length;
    if (target.dataset.reviewSummary === String(items.length) + ':' + demonstrated + ':' + review + ':' + developing) return;
    target.innerHTML += '<div class="goal"><b>' + demonstrated + '</b><small>Demonstrated evidence</small></div><div class="goal"><b>' + review + '</b><small>Needs review</small></div><div class="goal"><b>' + developing + '</b><small>Developing evidence</small></div>';
    target.dataset.reviewSummary = String(items.length) + ':' + demonstrated + ':' + review + ':' + developing;
  }

  function run() { decorate(); enhanceReadiness(); }
  function init() {
    if (typeof document === 'undefined') return;
    const observer = new MutationObserver(run);
    observer.observe(document.body, { childList: true, subtree: true });
    run();
  }
  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();
  }
})();
