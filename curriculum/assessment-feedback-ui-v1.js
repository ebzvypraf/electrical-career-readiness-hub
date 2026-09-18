/* Canonical Check-stage feedback UI. Additive: observes the existing production modal. */
(function () {
  'use strict';
  Promise.all([
    import('./assessment-failure-journal-bridge-v1.js'),
    import('./assessment-recovery-trail-bridge-v1.js')
  ]).catch(() => {});
  const esc = value => String(value ?? '').replace(/[&<>\"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[c]));
  const $ = id => document.getElementById(id);
  let lastKey = '';

  function weekFromModal() {
    const text = $('modalCard')?.querySelector('.k')?.textContent || '';
    const m = text.match(/Week\s+(\d+)/i);
    return m ? Number(m[1]) : null;
  }

  function openStage(week, stage) {
    const api = window.ECRHCanonical;
    if (!week || !stage || typeof api?.openStage !== 'function') return;
    $('modal')?.classList.remove('show');
    setTimeout(() => api.openStage(String(week), stage), 0);
  }

  function hasEvidenceHandoff(card) {
    return Array.from(card.querySelectorAll('button, a')).some(el => /evidence/i.test(el.textContent || ''));
  }

  function enhance() {
    const modal = $('modal'), card = $('modalCard');
    if (!modal?.classList.contains('show') || !card) return;
    if (!/•\s*Check/i.test(card.querySelector('.k')?.textContent || '')) return;
    const week = weekFromModal();
    const api = window.ECRHCanonical;
    const result = week && api?.store?.getState ? api.store.getState().contextByWeek?.[String(week)]?.assessmentResult : null;
    if (!result) return;

    if (result.passed && result.completionReady && !hasEvidenceHandoff(card)) {
      const key = `${week}:${result.date}:passed`;
      if (key === lastKey || card.querySelector('[data-check-evidence-handoff]')) return;
      lastKey = key;
      const panel = document.createElement('section');
      panel.setAttribute('data-check-evidence-handoff', 'true');
      panel.className = 'learning-card';
      panel.style.marginTop = '12px';
      panel.innerHTML = `<h3>Check complete</h3><p class="muted">You passed the knowledge check. Capture the proof while this result is fresh.</p><button type="button" class="btn primary" data-check-open-evidence="true" style="margin-top:8px">Capture Evidence</button>`;
      panel.querySelector('[data-check-open-evidence]')?.addEventListener('click', () => openStage(week, 'evidence'));
      const resultBox = card.querySelector('.result');
      (resultBox || card.querySelector('#canon-score'))?.insertAdjacentElement('afterend', panel);
      return;
    }

    const feedback = result.feedback;
    if (!feedback || !feedback.reinforcement?.length) return;
    const key = `${week}:${result.date}:${feedback.failedCount}`;
    if (key === lastKey || card.querySelector('[data-check-reinforcement]')) return;
    lastKey = key;
    const panel = document.createElement('section');
    panel.setAttribute('data-check-reinforcement', 'true');
    panel.className = 'learning-card';
    panel.style.marginTop = '12px';
    panel.innerHTML = `<h3>Targeted reinforcement</h3><p class="muted">${feedback.failedCount} item${feedback.failedCount === 1 ? '' : 's'} need reinforcement before Evidence can be completed.</p>${feedback.reinforcement.map((item, i) => `<div class="mission" style="margin-top:8px"><b>Review ${i + 1}: ${esc(item.prompt || item.questionId)}</b><p class="muted">${esc(item.explanation)}</p>${item.concepts?.length ? `<small>Focus: ${esc(item.concepts.join(', '))}</small>` : ''}</div>`).join('')}<p class="muted" style="margin-top:10px">Strengthen the identified concepts in Learn, then retry Check.</p><button type="button" class="btn primary" data-check-review-learn="true" style="margin-top:8px">Review Learn reinforcement</button>`;
    panel.querySelector('[data-check-review-learn]')?.addEventListener('click', () => openStage(week, 'learn'));
    const resultBox = card.querySelector('.result');
    (resultBox || card.querySelector('#canon-score'))?.insertAdjacentElement('afterend', panel);
  }

  new MutationObserver(enhance).observe(document.documentElement, {subtree:true, childList:true, attributes:true, attributeFilter:['class']});
  document.addEventListener('click', () => setTimeout(enhance, 0), true);
  document.addEventListener('DOMContentLoaded', enhance, {once:true});
})();
