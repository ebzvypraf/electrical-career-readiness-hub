/* Electrical Career Readiness Hub — canonical shell bridge v1.4.
 * Keeps Home/Skills/Journal/Portfolio navigation and legacy forms attached to
 * the canonical learning state after the Course runtime takes ownership.
 * Capability displays use verified proof-chain evidence rather than stage flags alone.
 */
(function () {
  'use strict';
  const esc = value => String(value ?? '').replace(/[&<>\"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '\"':'&quot;', "'":'&#39;' }[c]));
  const wait = (tries = 80) => {
    const api = window.ECRHCanonical;
    if (!api?.store) return tries ? setTimeout(() => wait(tries - 1), 100) : null;
    const store = api.store;
    const state = () => store.getState();
    const verifiedEvidence = (s) => (Array.isArray(s?.portfolioEntries) ? s.portfolioEntries : []).filter(entry => entry && entry.reviewStatus === 'demonstrated' && entry.linkageValid === true && entry.upstreamChangedAfterEvidence !== true);
    const capabilityIntegrity = (s) => {
      const entries = verifiedEvidence(s);
      const bySkill = new Map();
      entries.forEach(entry => {
        const weekId = String(entry.week ?? '');
        const source = s.contextByWeek?.[weekId]?.evidence || {};
        const competencies = Array.isArray(source.competency) ? source.competency : (Array.isArray(entry.competency) ? entry.competency : []);
        competencies.forEach(skill => {
          const key = String(skill).trim(); if (!key) return;
          const item = bySkill.get(key) || { evidenceCount: 0, qualityTotal: 0, weeks: new Set() };
          item.evidenceCount += 1;
          item.qualityTotal += entry.evidenceQuality === 'high' ? 100 : (entry.evidenceQuality === 'developing' ? 60 : 0);
          item.weeks.add(weekId);
          bySkill.set(key, item);
        });
      });
      return { entries, bySkill };
    };
    const renderJournal = () => {
      const el = document.getElementById('logs'); if (!el) return;
      const entries = state().journalEntries || [];
      el.innerHTML = entries.slice().reverse().map(x => {
        const context = [x.weekId ? `Week ${esc(x.weekId)}` : '', x.stage ? esc(String(x.stage).toUpperCase()) : ''].filter(Boolean).join(' • ');
        return `<div class="goal"><b>${esc(x.date || '')} — ${Number(x.hours || 0)} h</b>${context ? `<small class="muted">${context}</small>` : ''}<div class="muted">${esc(x.study || '—')}<br>Learned: ${esc(x.learn || '—')}<br>Reflection: ${esc(x.reflection || '—')}<br>Next: ${esc(x.nextAction || x.next || '—')}</div></div>`;
      }).join('') || '<div class="empty">No reflections yet.</div>';
    };
    const renderPortfolio = () => {
      const s = state();
      const el = document.getElementById('portfolioGrid');
      const readiness = document.getElementById('readiness');
      const entries = Array.isArray(s.portfolioEntries) ? s.portfolioEntries.slice().sort((a,b) => Number(b.week || 0) - Number(a.week || 0)) : [];
      if (el) el.innerHTML = entries.length ? entries.map(x => {
        const criteria = Array.isArray(x.criteria) ? x.criteria : [];
        const satisfied = criteria.filter(c => c?.satisfied).length;
        const quality = x.evidenceQuality || (x.reviewStatus === 'demonstrated' ? 'high' : 'developing');
        const recovery = x.recoveryProvenance?.recovered ? ' • recovered after reinforcement' : '';
        const linkage = x.linkageValid ? 'Linked proof chain' : (x.linkageComplete ? 'Links captured — validation needed' : 'Proof links incomplete');
        return `<article class="evidence"><div style="display:flex;justify-content:space-between;gap:8px"><div><b>Week ${esc(x.week ?? '—')} — ${esc(x.title || 'Untitled evidence')}</b><div class="muted">${esc(x.description || 'No description recorded.')}</div></div><span class="pill ${x.reviewStatus === 'demonstrated' ? 'ok' : ''}">${esc(quality)}</span></div><small class="muted">${esc(linkage)}${criteria.length ? ` • Criteria ${satisfied}/${criteria.length}` : ''}${recovery}</small><div class="muted" style="margin-top:6px">Reflection: ${esc(x.reflection || '—')}<br>Next: ${esc(x.nextAction || '—')}</div></article>`;
      }).join('') : '<div class="empty">No Portfolio evidence yet. Complete Apply → Check → Evidence in the Course.</div>';
      if (readiness) {
        const cap = s.hubSignals?.demonstratedCapability || {};
        const integrity = capabilityIntegrity(s);
        const verifiedCount = integrity.entries.length;
        const quality = verifiedCount ? Math.round(integrity.entries.reduce((sum, entry) => sum + (entry.evidenceQuality === 'high' ? 100 : (entry.evidenceQuality === 'developing' ? 60 : 0)), 0) / verifiedCount) : 0;
        const checks = Number(cap.knowledgeChecks ?? 0) || 0;
        const baseScore = Number(cap.score ?? 0) || 0;
        const score = verifiedCount ? Math.min(baseScore, Math.round(Math.min(100, verifiedCount * 10 + quality * 0.5))) : 0;
        const target = Number(cap.target ?? 100) || 100;
        const coverage = cap.coverage || {};
        const readinessLabel = score >= target ? 'verified-ready' : (verifiedCount ? 'verified-developing' : 'proof-required');
        readiness.innerHTML = `<div class="mission"><b>${esc(readinessLabel.replace(/-/g,' '))}</b><div class="bar" style="margin:9px 0"><span style="width:${Math.max(0,Math.min(100,score))}%"></span></div><div class="muted">${Math.round(score)}% verified capability signal • ${verifiedCount} verified evidence item(s) • ${checks} knowledge check(s)</div></div><div class="goal"><b>Verified evidence quality</b><small>${quality}% across valid proof-chain evidence</small></div><div class="goal"><b>Stage coverage</b><small>Learn ${coverage.learn || 0}% • Apply ${coverage.apply || 0}% • Check ${coverage.check || 0}% • Evidence ${coverage.evidence || 0}%</small></div>${cap.recommendedWeekId ? `<div class="goal"><b>Recommended next</b><small>Week ${esc(cap.recommendedWeekId)} • ${esc(cap.recommendedStage || 'Continue the learning path')}</small></div>` : ''}`;
      }
    };
    const renderSkills = () => {
      const s = state();
      const list = document.getElementById('skills');
      const advice = document.getElementById('advice');
      const capabilities = Array.isArray(s.hubSignals?.demonstratedCapability) ? s.hubSignals.demonstratedCapability : [];
      const integrity = capabilityIntegrity(s);
      if (list) list.innerHTML = capabilities.length ? capabilities.map(cap => {
        const readiness = Math.max(0, Math.min(100, Number(cap.readiness) || 0));
        const checks = Number(cap.knowledgeChecks) || 0;
        const verifiedData = integrity.bySkill.get(String(cap.skill));
        const demonstrated = verifiedData?.evidenceCount || 0;
        const quality = verifiedData ? Math.round(verifiedData.qualityTotal / Math.max(1, verifiedData.evidenceCount)) : 0;
        const verified = demonstrated > 0 && quality >= 80;
        const displayReadiness = verified ? Math.max(readiness, Math.min(100, Math.round((demonstrated * 20) + (quality * 0.4)))) : Math.min(readiness, 59);
        const label = verified ? 'Demonstrated' : (displayReadiness >= 60 ? 'Developing' : 'Needs practice');
        const coverage = cap.coverage || {};
        return `<article class="skillrow"><div class="skillhead"><b>${esc(cap.skill)}</b><span class="pill ${verified ? 'ok' : ''}">${label}</span></div><div class="bar"><span style="width:${displayReadiness}%"></span></div><small class="muted">${displayReadiness}% verified readiness • ${demonstrated} verified evidence item(s) • ${checks} passed Check(s) • ${quality}% verified evidence quality</small><small class="muted">Coverage: Learn ${coverage.learn || 0}% • Apply ${coverage.apply || 0}% • Check ${coverage.check || 0}% • Evidence ${coverage.evidence || 0}%</small></article>`;
      }).join('') : '<div class="empty">Complete the learning stages to build a canonical competency profile.</div>';
      if (advice) {
        const gaps = Array.isArray(s.hubSignals?.prioritySkillGaps) ? s.hubSignals.prioritySkillGaps : [];
        advice.innerHTML = gaps.length ? gaps.slice(0, 5).map(g => `<div class="goal"><b>${esc(g.skill)}</b><small>${Number(g.readiness) || 0}% readiness • ${esc(g.reason || 'Needs stronger demonstrated capability.')}</small>${g.recommendedWeekId ? `<small>Next: Week ${esc(g.recommendedWeekId)} • ${esc(g.recommendedStageLabel || g.recommendedStage || 'Continue')}</small>` : ''}</div>`).join('') : '<div class="empty">No priority gaps. Keep building evidence across the 24-week path.</div>';
      }
    };
    const go = id => {
      document.querySelectorAll('.page').forEach(p => p.classList.toggle('active', p.id === id));
      document.querySelectorAll('.nav button').forEach(b => b.classList.toggle('active', b.dataset.page === id));
      api.refresh();
      if (id === 'journal') renderJournal();
      if (id === 'portfolio') renderPortfolio();
      if (id === 'skills') renderSkills();
    };
    document.querySelectorAll('[data-page]').forEach(b => b.onclick = () => go(b.dataset.page));
    const save = document.getElementById('saveLog');
    if (save) save.onclick = () => {
      const date = document.getElementById('jdate')?.value;
      const hours = Number(document.getElementById('jhours')?.value || 0);
      const study = document.getElementById('jstudy')?.value.trim() || '';
      const learn = document.getElementById('jlearn')?.value.trim() || '';
      const hard = document.getElementById('jhard')?.value.trim() || '';
      const next = document.getElementById('jnext')?.value.trim() || '';
      if (!date || (!study && !learn && !hard && !next && hours <= 0)) return alert('Add a date and study information.');
      const result = store.addJournalEntry({ date, hours, study, learn, hard, next, nextAction: next });
      if (!result.ok) return alert(result.reason || 'Journal entry could not be saved.');
      ['jhours','jstudy','jlearn','jhard','jnext'].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
      go('journal');
    };
    const openNext = () => { const n = state().hubSignals?.nextBestAction; if (n) api.openStage(n.weekId, n.stage); };
    const resume = document.getElementById('resume');
    const homeOpen = document.getElementById('homeOpen');
    if (resume) resume.onclick = openNext;
    if (homeOpen) homeOpen.onclick = openNext;
    const modules = document.getElementById('modules');
    if (modules) new MutationObserver(() => {
      if (!modules.querySelector('[data-canonical-week]')) api.refresh();
    }).observe(modules, { childList: true, subtree: true });
    const skills = document.getElementById('skills');
    if (skills) new MutationObserver(() => {
      if (!skills.querySelector('.skillrow')) renderSkills();
    }).observe(skills, { childList: true, subtree: true });
    store.subscribe(() => {
      api.refresh();
      renderSkills();
      renderJournal();
      renderPortfolio();
    });
    renderSkills();
    renderJournal();
    renderPortfolio();
    window.ECRHCanonical.shellReady = true;
  };
  wait();
})();
