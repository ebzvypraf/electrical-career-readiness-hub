/*
 * Electrical Career Readiness Hub — assessment priority integration v1.
 * Additive UI layer: turns persisted Check feedback into Home and Skills actions.
 */
(function () {
  'use strict';
  const esc = value => String(value ?? '').replace(/[&<>\"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[c]));
  const $ = id => document.getElementById(id);

  function api() { return window.ECRHCanonical; }
  function state() { try { return api()?.store?.getState?.() || null; } catch (_) { return null; } }
  function priorities(s) {
    const context = s?.contextByWeek || {};
    return Object.entries(context).map(([week, ctx]) => ({
      week: Number(week),
      feedback: ctx?.assessmentResult?.feedback,
      date: ctx?.assessmentResult?.date || ''
    })).filter(x => x.week && x.feedback?.reinforcement?.length).sort((a,b) => String(b.date).localeCompare(String(a.date)));
  }
  function renderHome(s) {
    const host = $('feed'); if (!host) return;
    const items = priorities(s).slice(0, 3);
    const existing = host.querySelector('[data-assessment-priority]');
    if (!items.length) { existing?.remove(); return; }
    const top = items[0], f = top.feedback;
    const html = `<div class="feeditem" data-assessment-priority><b>Check-stage reinforcement</b><div class="muted">Week ${top.week}: ${f.failedCount} item${f.failedCount === 1 ? '' : 's'} need reinforcement. Focus: ${esc((f.priorityConcepts || []).slice(0,4).join(', ') || 'review failed concepts')}.</div><button class="btn" data-assessment-open="${top.week}">Review reinforcement</button></div>`;
    if (existing) existing.outerHTML = html; else host.insertAdjacentHTML('afterbegin', html);
    host.querySelectorAll('[data-assessment-open]').forEach(b => b.onclick = () => {
      const week = Number(b.dataset.assessmentOpen);
      const n = document.querySelector(`[data-canonical-open="${week}:check"]`);
      if (n) n.click();
      else window.ECRHCanonical?.openLesson?.(week, 'check');
    });
  }
  function renderSkills(s) {
    const host = $('advice'); if (!host) return;
    const items = priorities(s).slice(0, 4);
    const existing = host.querySelector('[data-assessment-skill-priority]');
    if (!items.length) { existing?.remove(); return; }
    const html = `<div class="goal" data-assessment-skill-priority><b>Assessment reinforcement</b><small>${items.map(x => `W${String(x.week).padStart(2,'0')}: ${esc((x.feedback.priorityConcepts || []).slice(0,3).join(', ') || 'review failed concepts')}`).join(' • ')}</small></div>`;
    if (existing) existing.outerHTML = html; else host.insertAdjacentHTML('afterbegin', html);
  }
  function render() { const s = state(); if (!s) return; renderHome(s); renderSkills(s); }
  new MutationObserver(() => setTimeout(render, 0)).observe(document.documentElement, {subtree:true, childList:true});
  document.addEventListener('click', () => setTimeout(render, 0), true);
  document.addEventListener('DOMContentLoaded', render, {once:true});
})();
