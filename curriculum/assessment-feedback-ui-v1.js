/* Canonical Check-stage reinforcement UI. Additive: observes the existing production modal. */
(function () {
  'use strict';
  const esc = value => String(value ?? '').replace(/[&<>\"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[c]));
  const $ = id => document.getElementById(id);
  let lastKey = '';

  function weekFromModal() {
    const text = $('modalCard')?.querySelector('.k')?.textContent || '';
    const m = text.match(/Week\s+(\d+)/i);
    return m ? Number(m[1]) : null;
  }

  function enhance() {
    const modal = $('modal'), card = $('modalCard');
    if (!modal?.classList.contains('show') || !card) return;
    if (!/•\s*Check/i.test(card.querySelector('.k')?.textContent || '')) return;
    const week = weekFromModal();
    const api = window.ECRHCanonical;
    const result = week && api?.store?.getState ? api.store.getState().contextByWeek?.[String(week)]?.assessmentResult : null;
    const feedback = result?.feedback;
    if (!feedback || !feedback.reinforcement?.length) return;
    const key = `${week}:${result.date}:${feedback.failedCount}`;
    if (key === lastKey || card.querySelector('[data-check-reinforcement]')) return;
    lastKey = key;
    const panel = document.createElement('section');
    panel.setAttribute('data-check-reinforcement', 'true');
    panel.className = 'learning-card';
    panel.style.marginTop = '12px';
    panel.innerHTML = `<h3>Targeted reinforcement</h3><p class="muted">${feedback.failedCount} item${feedback.failedCount === 1 ? '' : 's'} need reinforcement before Evidence can be completed.</p>${feedback.reinforcement.map((item, i) => `<div class="mission" style="margin-top:8px"><b>Review ${i + 1}: ${esc(item.prompt || item.questionId)}</b><p class="muted">${esc(item.explanation)}</p>${item.concepts?.length ? `<small>Focus: ${esc(item.concepts.join(', '))}</small>` : ''}</div>`).join('')}<p class="muted" style="margin-top:10px">Return to the Learn stage for this week, strengthen the identified concepts, then retry Check.</p>`;
    const resultBox = card.querySelector('.result');
    (resultBox || card.querySelector('#canon-score'))?.insertAdjacentElement('afterend', panel);
  }

  new MutationObserver(enhance).observe(document.documentElement, {subtree:true, childList:true, attributes:true, attributeFilter:['class']});
  document.addEventListener('click', () => setTimeout(enhance, 0), true);
  document.addEventListener('DOMContentLoaded', enhance, {once:true});
})();
