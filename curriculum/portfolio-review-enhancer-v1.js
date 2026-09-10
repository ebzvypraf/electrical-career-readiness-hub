/* Electrical Career Readiness Hub — Portfolio Review enhancer v3.
 * Keeps self-review controls synchronized with the canonical portfolio state
 * and exposes the canonical Apply -> Check -> Evidence proof chain for review-ready artifacts.
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

  function proofChainMarkup(entry) {
    const chain = entry.proofChain || {};
    const apply = chain.apply || {};
    const check = chain.check || {};
    const evidence = chain.evidence || {};
    const applyProof = [
      apply.deliverable ? '<div><b>Deliverable:</b> ' + esc(apply.deliverable) + '</div>' : '',
      apply.decisions ? '<div><b>Decisions:</b> ' + esc(apply.decisions) + '</div>' : '',
      apply.assumptions ? '<div><b>Assumptions:</b> ' + esc(apply.assumptions) + '</div>' : '',
      apply.verification ? '<div><b>Verification:</b> ' + esc(apply.verification) + '</div>' : ''
    ].join('');
    const checkScore = Number.isFinite(Number(check.percentage)) ? String(check.percentage) + '%' : (Number.isFinite(Number(check.score)) && Number.isFinite(Number(check.total)) ? String(check.score) + '/' + String(check.total) : 'Passed');
    const checkProof = check.passed ? '<div><b>Result:</b> Passed (' + esc(checkScore) + ')' + (check.recovered ? ' · Recovery demonstrated' : '') + '</div>' : '<div><b>Result:</b> Check result not available</div>';
    const criteriaText = Number.isFinite(Number(evidence.criteriaTotal)) && Number(evidence.criteriaTotal) > 0 ? String(evidence.criteriaSatisfied || 0) + '/' + String(evidence.criteriaTotal) + ' criteria satisfied' : 'Core evidence captured';
    return '<div data-proof-chain-panel="1" class="learning-card" style="margin-top:12px">' +
      '<div style="display:flex;justify-content:space-between;gap:10px;align-items:center;flex-wrap:wrap"><div><b>Proof chain</b><div class="muted">Review-ready trace from practical application to assessed learning to demonstrated evidence.</div></div><span class="pill ' + (entry.demonstratedCapability ? 'ok' : '') + '">' + (entry.demonstratedCapability ? 'Capability demonstrated' : esc(entry.evidenceQuality || 'Developing')) + '</span></div>' +
      '<div style="display:grid;gap:10px;margin-top:12px">' +
      '<div><b>1 · Apply</b><div class="muted">' + (applyProof || (apply.linked ? 'Apply record linked.' : 'Apply record link not captured.')) + '</div></div>' +
      '<div><b>2 · Check</b><div class="muted">' + checkProof + '</div></div>' +
      '<div><b>3 · Evidence</b><div class="muted"><b>' + esc(evidence.title || entry.title || 'Evidence captured') + '</b> · ' + esc(criteriaText) + (evidence.quality ? ' · Quality: ' + esc(evidence.quality) : '') + '</div></div>' +
      '</div></div>';
  }

  function reviewMarkup(entry) {
    const meta = statusMeta(entry);
    const criteriaOk = criteriaComplete(entry);
    return '<div style="display:flex;justify-content:space-between;gap:10px;align-items:center;flex-wrap:wrap">' +
      '<div><b>Self-review status</b><div class="muted">' + esc(meta.note) + '</div></div>' +
      '<span class="pill ' + meta.cls + '">' + esc(meta.label) + '</span></div>' +
      '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px">' +
      '<button class="btn" type="button" data-portfolio-review="developing">Keep developing</button>' +
      '<button class="btn" type="button" data-portfolio-review="needs-review">Needs review</button>' +
      '<button class="btn primary" type="button" data-portfolio-review="demonstrated" ' + (criteriaOk ? '' : 'disabled aria-disabled="true"') + '>Mark demonstrated</button>' +
      '</div>' + (!criteriaOk ? '<small class="muted" style="display:block;margin-top:8px">Complete every required evidence criterion before marking this capability demonstrated.</small>' : '') +
      '<div class="muted" style="margin-top:8px">Competency: ' + esc((entry.competency || []).join(', ') || 'Learning capability') + '</div>';
  }

  function bindReview(review, entryId) {
    review.querySelectorAll('[data-portfolio-review]').forEach(function (button) {
      button.addEventListener('click', function () {
        const action = button.dataset.portfolioReview;
        const current = entries().find(function (candidate) { return String(candidate.id) === String(entryId); });
        if (!current) return;
        if (action === 'demonstrated' && !criteriaComplete(current)) {
          window.alert('This evidence cannot be marked demonstrated until all required criteria are satisfied.');
          return;
        }
        const s = store();
        if (!s || typeof s.addPortfolioEntry !== 'function') return;
        const nextStatus = action === 'demonstrated' ? 'demonstrated' : action === 'needs-review' ? 'needs-review' : 'draft';
        const result = s.addPortfolioEntry({ ...current, reviewStatus: nextStatus });
        if (!result?.ok) window.alert(result?.reason || 'Portfolio review could not be saved.');
      });
    });
  }

  function decorate() {
    const grid = document.getElementById('portfolioGrid');
    if (!grid) return;
    const items = entries();
    const cards = Array.from(grid.querySelectorAll('.evidence'));
    cards.forEach(function (card, index) {
      const entry = items[index];
      if (!entry) return;
      let proof = card.querySelector('[data-proof-chain-panel]');
      if (!proof) {
        card.insertAdjacentHTML('beforeend', proofChainMarkup(entry));
      } else {
        const next = document.createElement('div');
        next.innerHTML = proofChainMarkup(entry);
        const replacement = next.firstElementChild;
        if (replacement) proof.replaceWith(replacement);
      }
      let review = card.querySelector('[data-portfolio-review-panel]');
      if (!review) {
        review = document.createElement('div');
        review.dataset.portfolioReviewPanel = '1';
        review.className = 'learning-card';
        review.style.marginTop = '12px';
        card.appendChild(review);
      }
      const signature = JSON.stringify({
        id: entry.id,
        status: entry.reviewStatus || 'draft',
        criteria: entry.criteria || [],
        competency: entry.competency || [],
        proofChain: entry.proofChain || {},
        demonstratedCapability: Boolean(entry.demonstratedCapability)
      });
      if (review.dataset.signature === signature) return;
      review.dataset.signature = signature;
      review.innerHTML = reviewMarkup(entry);
      bindReview(review, entry.id);
    });
  }

  function enhanceReadiness() {
    const target = document.getElementById('readiness');
    if (!target) return;
    const items = entries();
    const demonstrated = items.filter(function (x) { return text(x.reviewStatus) === 'demonstrated'; }).length;
    const review = items.filter(function (x) { return text(x.reviewStatus) === 'needs-review'; }).length;
    const developing = items.filter(function (x) { return !text(x.reviewStatus) || text(x.reviewStatus) === 'draft'; }).length;
    const signature = items.length + ':' + demonstrated + ':' + review + ':' + developing;
    if (target.dataset.reviewSummary === signature) return;
    target.innerHTML = '<div class="goal"><b>' + demonstrated + '</b><small>Demonstrated evidence</small></div><div class="goal"><b>' + review + '</b><small>Needs review</small></div><div class="goal"><b>' + developing + '</b><small>Developing evidence</small></div>';
    target.dataset.reviewSummary = signature;
  }

  function run() { decorate(); enhanceReadiness(); }

  function init() {
    if (typeof document === 'undefined') return;
    const observer = new MutationObserver(run);
    observer.observe(document.body, { childList: true, subtree: true });
    const s = store();
    if (s?.subscribe) s.subscribe(function () { setTimeout(run, 0); });
    run();
  }

  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
    else init();
  }
})();
