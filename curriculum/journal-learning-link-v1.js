/* Electrical Career Readiness Hub — Journal learning-link enhancer v1.
 * Adds a canonical Week/Stage link, reflection and next-action fields to the
 * existing Journal surface without replacing the production renderer.
 */
(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const api = () => window.ECRHCanonical || null;
  const stageOptions = ['learn','apply','check','evidence'];
  const esc = value => String(value ?? '').replace(/[&<>\"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[c]));

  function enhance() {
    const form = document.querySelector('#journal .form');
    const save = $('saveLog');
    if (!form || !save || form.dataset.learningLinkReady === '1') return;
    form.dataset.learningLinkReady = '1';
    const wrap = document.createElement('div');
    wrap.className = 'learning-link';
    wrap.style.cssText = 'display:grid;gap:8px;border:1px solid var(--line);border-radius:10px;padding:10px;background:#fbfcfe';
    const week = document.createElement('select'); week.id = 'jweek'; week.style.cssText = 'width:100%;border:1px solid var(--line);border-radius:10px;padding:10px;background:#fff';
    const stage = document.createElement('select'); stage.id = 'jstage'; stage.style.cssText = week.style.cssText;
    const refl = document.createElement('textarea'); refl.id = 'jreflection'; refl.placeholder = 'Reflection: what changed in your understanding or practice?';
    const next = document.createElement('textarea'); next.id = 'jnextAction'; next.placeholder = 'Next action: what will you do next in the learning loop?';
    [refl,next].forEach(x => { x.style.cssText = 'width:100%;border:1px solid var(--line);border-radius:10px;padding:10px;background:#fff;min-height:70px;resize:vertical'; });
    const label = (text,node) => { const l=document.createElement('label'); l.textContent=text; l.style.cssText='font-size:12px;font-weight:800'; l.appendChild(node); return l; };
    const catalog = api()?.catalog || {};
    week.innerHTML = '<option value="">Link this reflection to a week…</option>' + Object.keys(catalog).sort((a,b)=>Number(a)-Number(b)).map(id => `<option value="${esc(id)}">Week ${esc(id)} — ${esc(catalog[id]?.title || '')}</option>`).join('');
    stage.innerHTML = '<option value="">Stage (optional)…</option>' + stageOptions.map(s => `<option value="${s}">${s.charAt(0).toUpperCase()+s.slice(1)}</option>`).join('');
    wrap.appendChild(label('Learning link', week)); wrap.appendChild(label('Stage', stage)); wrap.appendChild(label('Reflection', refl)); wrap.appendChild(label('Next action', next));
    form.insertBefore(wrap, save);
    save.addEventListener('click', function (event) {
      const store = api()?.store; if (!store) return;
      event.preventDefault(); event.stopImmediatePropagation();
      const entry = {
        id: `journal-${Date.now()}`,
        date: $('jdate')?.value,
        hours: $('jhours')?.value,
        study: $('jstudy')?.value,
        learn: $('jlearn')?.value,
        hard: $('jhard')?.value,
        next: $('jnext')?.value,
        reflection: refl.value,
        nextAction: next.value,
        weekId: week.value || null,
        stage: stage.value || null
      };
      const result = store.addJournalEntry(entry);
      if (!result.ok) return alert(result.reason || 'Could not save reflection.');
      ['jhours','jstudy','jlearn','jhard','jnext','jreflection','jnextAction'].forEach(id => { const n=$(id); if(n) n.value=''; });
      week.value=''; stage.value='';
    }, true);
  }
  const observer = new MutationObserver(enhance);
  function boot(){ enhance(); observer.observe(document.body,{childList:true,subtree:true}); }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',boot); else boot();
})();
