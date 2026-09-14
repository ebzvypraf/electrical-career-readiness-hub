/* Electrical Career Readiness Hub — Learn stage UI enhancer v1.
 * Makes the canonical Learn gate and downstream handoff visible in the learner-facing Course modal.
 * The canonical learning-state store remains authoritative for persistence.
 */
(function () {
  'use strict';
  const text = value => String(value == null ? '' : value).trim();
  const esc = value => text(value).replace(/[&<>\"']/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '\"':'&quot;', "'":'&#39;' }[char]));
  const root = () => typeof window !== 'undefined' ? window : null;
  const canonical = () => root() && root().ECRHCanonical;
  const store = () => { const api = canonical(); return typeof api?.store === 'function' ? api.store() : api?.store || null; };
  function currentWeek() {
    const card = document.getElementById('modalCard');
    const marker = card && card.querySelector('.k');
    const match = marker && text(marker.textContent).match(/Week\s+(\d+)/i);
    return match ? Number(match[1]) : null;
  }
  function state(week) {
    const s = store();
    const snapshot = s && s.getState ? s.getState() : {};
    const progress = snapshot?.progressByWeek?.[String(week)] || {};
    const context = snapshot?.contextByWeek?.[String(week)] || {};
    const next = snapshot?.hubSignals?.nextBestAction || null;
    return { progress, context, next };
  }
  function markup(week, data) {
    const complete = data.progress.learn === true;
    const next = data.next;
    const nextText = next && next.weekId != null && next.stage
      ? `Next canonical action: Week ${next.weekId} · ${text(next.stage).replace(/^./, c => c.toUpperCase())}.`
      : 'Continue through Apply, Check and Evidence to turn this learning into demonstrated capability.';
    return '<div class="learning-card" id="canonical-learn-gate">' +
      '<h3>Learn stage</h3>' +
      '<p class="muted">Review the core concept, understand the engineering context, and connect it to the practical task that follows.</p>' +
      '<div class="rubric">' +
      '<div class="rubric-row"><span><strong>' + (complete ? 'Complete' : 'In progress') + '</strong> — Learning review</span><span class="tag' + (complete ? ' pill ok' : '') + '">' + (complete ? 'Recorded' : 'Continue learning') + '</span></div>' +
      '<div class="rubric-row"><span><strong>Next</strong> — Apply preparation</span><span class="tag">Practical proof</span></div>' +
      '</div>' +
      '<div class="result' + (complete ? '' : ' warn') + '"><b>' + (complete ? 'Learn is recorded.' : 'Complete the learning review first.') + '</b><p>' + esc(complete ? nextText : 'Use the learning content above, then continue to the Apply stage when the canonical progress state records Learn as complete.') + '</p></div>' +
      '</div>';
  }
  function findStageButton(week, stage) {
    const weeks = Array.from(document.querySelectorAll('.week'));
    const target = weeks.find(node => { const no = node.querySelector('.wno'); return no && Number((text(no.textContent).match(/\d+/) || [])[0]) === Number(week); });
    if (!target) return null;
    return Array.from(target.querySelectorAll('button')).find(button => new RegExp('^\\s*' + stage + '\\b', 'i').test(text(button.textContent))) || Array.from(target.querySelectorAll('button')).find(button => text(button.textContent).toLowerCase().includes(stage.toLowerCase()));
  }
  function enhance() {
    const card = document.getElementById('modalCard');
    if (!card || !/Learn/i.test(text(card.textContent))) return;
    const week = currentWeek();
    if (!week || !store()) return;
    const data = state(week);
    let block = document.getElementById('canonical-learn-gate');
    if (!block) {
      block = document.createElement('div');
      block.className = 'learning-card';
      const anchor = card.querySelector('.learning-hero') || card.querySelector('h2') || card.firstElementChild;
      if (anchor?.parentNode) anchor.parentNode.insertBefore(block, anchor.nextSibling);
      else card.appendChild(block);
    }
    block.outerHTML = markup(week, data);
  }
  function init() {
    if (typeof document === 'undefined') return;
    const observer = new MutationObserver(enhance);
    observer.observe(document.body, { childList: true, subtree: true });
    enhance();
  }
  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
  }
})();
