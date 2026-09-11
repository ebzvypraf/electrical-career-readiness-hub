/* Electrical Career Readiness Hub — Journal learning-link enhancer v4.
 * Connects Journal to the canonical Learn → Apply → Check → Evidence state
 * and exposes the same proof-chain milestones used by Portfolio.
 * Evidence is considered complete only when the canonical engine marks it demonstrated.
 * This enhances the existing production renderer; it does not replace it.
 */
(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const api = () => window.ECRHCanonical || null;
  const stageOptions = ['learn','apply','check','evidence'];
  const esc = value => String(value ?? '').replace(/[&<>\"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[c]));

  function weekContext(state, weekId) {
    return weekId ? (state?.contextByWeek?.[String(weekId)] || {}) : {};
  }

  function proofStatus(state, weekId) {
    const id = String(weekId || '');
    const progress = state?.progressByWeek?.[id] || {};
    const context = weekContext(state, id);
    const evidence = context.evidence || {};
    const check = context.assessmentResult || {};
    const apply = context.applicationEvidence || {};
    const applyReady = Boolean(
      apply.tasksComplete && apply.deliverable && apply.decisions && apply.assumptions && apply.verification
    );
    const checkPassed = Boolean(check.passed || check.completionReady);
    const demonstrated = Boolean(evidence.demonstrated);
    return {
      learn: Boolean(progress.learn),
      apply: Boolean(progress.apply && applyReady),
      check: Boolean(progress.check && checkPassed),
      evidence: demonstrated,
      applyLink: String(evidence.applyLink || '').trim(),
      checkLink: String(evidence.checkLink || '').trim(),
      evidenceQuality: String(evidence.evidenceQuality || '').trim(),
      demonstrated,
      recovery: Boolean(evidence.recoveryProvenance?.recovered || check.recovered)
    };
  }

  function renderLearningLoop(state, panel, chainPanel) {
    if (!panel || !state) return;
    const signals = state.hubSignals || {};
    const action = signals.nextBestAction || null;
    const capability = Array.isArray(signals.demonstratedCapability) ? signals.demonstratedCapability : [];
    const topSkills = capability.slice().sort((a,b) => Number(a.readiness || 0) - Number(b.readiness || 0)).slice(0, 4);
    const stageLabel = { learn:'Learn', apply:'Apply', check:'Check', evidence:'Evidence' };
    const actionHtml = action
      ? `<div style="font-weight:800">Next: Week ${esc(action.weekId)} — ${esc(action.label || stageLabel[action.stage] || action.stage)}</div><div style="font-size:12px;color:var(--muted)">${esc(action.prompt || 'Continue the next unlocked stage in the learning loop.')}</div>`
      : '<div style="font-weight:800">24-week learning loop complete</div><div style="font-size:12px;color:var(--muted)">All canonical stages are complete. Use Journal to capture continuing professional development.</div>';
    const skillHtml = topSkills.length
      ? topSkills.map(item => `<div style="display:flex;justify-content:space-between;gap:10px;font-size:12px"><span>${esc(item.skill)}</span><strong>${esc(item.readiness)}% · ${esc(item.evidenceCount)} evidence week${Number(item.evidenceCount) === 1 ? '' : 's'}</strong></div>`).join('')
      : '<div style="font-size:12px;color:var(--muted)">Complete demonstrated Evidence stages to build capability signals.</div>';
    panel.innerHTML = `<div style="font-size:13px;font-weight:900;margin-bottom:6px">Canonical learning loop</div><div style="display:grid;gap:8px">${actionHtml}<div style="display:grid;gap:4px;padding-top:4px"><div style="font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.04em;color:var(--muted)">Capability signal</div>${skillHtml}</div></div>`;

    if (chainPanel) {
      const weekId = $('jweek')?.value || '';
      if (!weekId) {
        chainPanel.innerHTML = '<div style="font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.04em;color:var(--muted)">Evidence chain</div><div style="font-size:12px;color:var(--muted)">Select a week to see its Learn → Apply → Check → Evidence proof status.</div>';
        return;
      }
      const status = proofStatus(state, weekId);
      const mark = value => value ? 'Complete' : 'Open';
      const stageRows = [
        ['Learn', status.learn],
        ['Apply', status.apply],
        ['Check', status.check],
        ['Evidence', status.evidence]
      ].map(([label, value]) => `<div style="display:flex;justify-content:space-between;gap:10px;font-size:12px"><span>${label}</span><strong>${mark(value)}</strong></div>`).join('');
      const linkage = status.evidence
        ? `<div style="font-size:12px;color:var(--muted)">Links: ${esc(status.applyLink || 'Apply pending')} → ${esc(status.checkLink || 'Check pending')}</div><div style="font-size:12px;color:var(--muted)">Quality: ${esc(status.evidenceQuality || 'not rated')}${status.recovery ? ' · recovery-assisted' : ''} · demonstrated</div>`
        : '<div style="font-size:12px;color:var(--muted)">Complete the upstream stages and demonstrate Evidence before treating the week as proven.</div>';
      chainPanel.innerHTML = `<div style="font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.04em;color:var(--muted)">Week ${esc(weekId)} evidence chain</div><div style="display:grid;gap:4px">${stageRows}</div>${linkage}`;
    }
  }

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

    const chainPanel = document.createElement('div');
    chainPanel.className = 'journal-evidence-chain';
    chainPanel.style.cssText = 'display:grid;gap:8px;margin-top:10px;border:1px solid var(--line);border-radius:10px;padding:12px;background:#fff';
    form.parentNode.insertBefore(chainPanel, form.nextSibling);

    const panel = document.createElement('div');
    panel.className = 'journal-learning-loop';
    panel.style.cssText = 'display:grid;gap:8px;margin-top:10px;border:1px solid var(--line);border-radius:10px;padding:12px;background:#fff';
    form.parentNode.insertBefore(panel, chainPanel.nextSibling);

    const store = api()?.store;
    const rerender = state => renderLearningLoop(state, panel, chainPanel);
    if (store?.subscribe) store.subscribe(rerender);
    week.addEventListener('change', () => rerender(store?.getState?.() || null));

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
      rerender(store.getState());
    }, true);
  }
  const observer = new MutationObserver(enhance);
  function boot(){ enhance(); observer.observe(document.body,{childList:true,subtree:true}); }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',boot); else boot();
})();
