/* Electrical Career Readiness Hub — Learn stage UI enhancer v1.2.
 * Makes the canonical Learn gate and downstream handoff visible in the learner-facing Course modal.
 * The canonical learning-state store remains authoritative for persistence.
 * v1.1 makes the completed Learn stage directly actionable, showing the week's
 * skill focus and sending the learner into the same canonical Apply stage used
 * by the learning engine instead of leaving the handoff implicit.
 * v1.2 avoids replacing an unchanged gate on every modal mutation, preventing
 * needless DOM churn while preserving live updates when canonical state changes.
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
    const module = canonical()?.catalog?.[String(week)] || {};
    return { progress, context, next, module };
  }
  function signature(week, data) {
    const module = data.module || {};
    return JSON.stringify({
      week,
      learn: data.progress.learn === true,
      next: data.next ? { weekId: data.next.weekId, stage: data.next.stage } : null,
      skills: Array.isArray(module.skills) ? module.skills.filter(Boolean).slice(0, 3) : []
    });
  }
  function markup(week, data) {
    const complete = data.progress.learn === true;
    const module = data.module || {};
    const skills = Array.isArray(module.skills) ? module.skills.filter(Boolean).slice(0, 3) : [];
    const next = complete ? (data.next && data.next.weekId != null && data.next.stage ? data.next : { weekId: week, stage: 'apply' }) : null;
    const nextText = next
      ? `Next canonical action: Week ${next.weekId} · ${text(next.stage).replace(/^./, c => c.toUpperCase())}.`
      : 'Complete the learning review, then continue to Apply when Learn is recorded.';
    const skillFocus = skills.length ? `<div class="rubric-row"><span><strong>Skill focus</strong> — ${skills.map(esc).join(' · ')}</span><span class="tag">Capability</span></div>` : '';
    const action = complete
      ? `<button type="button" class="btn primary" id="learn-next-action">Continue to Apply</button>`
      : '';
    return '<div class="learning-card" id="canonical-learn-gate">' +
      '<h3>Learn stage</h3>' +
      '<p class="muted">Review the core concept, understand the engineering context, and connect it to the practical task that follows.</p>' +
      '<div class="rubric">' +
      '<div class="rubric-row"><span><strong>' + (complete ? 'Complete' : 'In progress') + '</strong> — Learning review</span><span class="tag' + (complete ? ' pill ok' : '') + '">' + (complete ? 'Recorded' : 'Continue learning') + '</span></div>' +
      '<div class="rubric-row"><span><strong>Next</strong> — Apply preparation</span><span class="tag">Practical proof</span></div>' +
      skillFocus +
      '</div>' +
      '<div class="result' + (complete ? '' : ' warn') + '"><b>' + (complete ? 'Learn is recorded.' : 'Complete the learning review first.') + '</b><p>' + esc(complete ? nextText : 'Use the learning content above, then continue to the Apply stage when the canonical progress state records Learn as complete.') + '</p>' + action + '</div>' +
      '</div>';
  }
  function findStageButton(week, stage) {
    const weeks = Array.from(document.querySelectorAll('.week'));
    const target = weeks.find(node => { const no = node.querySelector('.wno'); return no && Number((text(no.textContent).match(/\d+/) || [])[0]) === Number(week); });
    if (!target) return null;
    return Array.from(target.querySelectorAll('button')).find(button => new RegExp('^\\s*' + stage + '\\b', 'i').test(text(button.textContent))) || Array.from(target.querySelectorAll('button')).find(button => text(button.textContent).toLowerCase().includes(stage.toLowerCase()));
  }
  function openStage(week, stage) {
    const api = canonical();
    if (typeof api?.openStage === 'function') { api.openStage(String(week), String(stage)); return; }
    const button = findStageButton(week, stage);
    if (button) { button.click(); return; }
    const courseNav = Array.from(document.querySelectorAll('[data-page="course"]')).find(Boolean);
    if (courseNav) courseNav.click();
  }
  function enhance() {
    const card = document.getElementById('modalCard');
    if (!card || !/Learn/i.test(text(card.textContent))) { lastSignature = ''; return; }
    const week = currentWeek();
    if (!week || !store()) return;
    const data = state(week);
    const nextSignature = signature(week, data);
    const existing = document.getElementById('canonical-learn-gate');
    if (existing && existing.dataset.signature === nextSignature) return;
    let block = existing;
    if (!block) {
      block = document.createElement('div');
      block.className = 'learning-card';
      const anchor = card.querySelector('.learning-hero') || card.querySelector('h2') || card.firstElementChild;
      if (anchor?.parentNode) anchor.parentNode.insertBefore(block, anchor.nextSibling);
      else card.appendChild(block);
    }
    block.outerHTML = markup(week, data);
    const nextBlock = document.getElementById('canonical-learn-gate');
    if (nextBlock) nextBlock.dataset.signature = nextSignature;
    lastSignature = nextSignature;
    const nextButton = document.getElementById('learn-next-action');
    if (nextButton && !nextButton.dataset.bound) {
      nextButton.dataset.bound = '1';
      nextButton.addEventListener('click', event => {
        event.preventDefault();
        event.stopPropagation();
        document.getElementById('modal')?.classList.remove('show');
        openStage(week, 'apply');
      });
    }
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