/* Electrical Career Readiness Hub — evidence impact UI v1.
 * Additive presentation layer: shows how demonstrated Portfolio Evidence contributes
 * to the canonical Skills/readiness profile without creating another state model.
 */
(function () {
  'use strict';
  const ready = () => window.ECRHCanonical?.ready && window.ECRHCanonical?.store;
  const esc = value => String(value ?? '').replace(/[&<>\"']/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '\"':'&quot;', "'":'&#39;' }[char]));
  const findWeek = (state, week) => state?.contextByWeek?.[String(week)]?.evidence || null;
  function render() {
    if (!ready()) return;
    const state = window.ECRHCanonical.store.getState();
    const entries = state?.portfolioEntries || [];
    const skills = state?.hubSignals?.demonstratedCapability || [];
    const portfolio = document.getElementById('portfolioGrid');
    if (portfolio) {
      portfolio.querySelectorAll('[data-evidence-impact]').forEach(node => node.remove());
      portfolio.querySelectorAll('.evidence').forEach(card => {
        const week = card.querySelector('.pill')?.textContent?.match(/(\d+)/)?.[1];
        if (!week) return;
        const evidence = findWeek(state, week);
        const linked = skills.filter(item => Number(item?.recommendedWeekId) === Number(week) || Number(item?.evidenceCount) > 0);
        const impact = document.createElement('div');
        impact.dataset.evidenceImpact = 'true';
        impact.className = 'mission';
        impact.style.marginTop = '10px';
        impact.innerHTML = `<b>Capability impact</b><div class="muted">${evidence?.evidenceQuality ? `Evidence quality: ${esc(evidence.evidenceQuality)}.` : 'Evidence is linked to the canonical learning record.'} ${linked.length ? `Tracked across ${linked.length} skill signal${linked.length === 1 ? '' : 's'}.` : 'Skill impact will become clearer as related learning progresses.'}</div>`;
        card.appendChild(impact);
      });
    }
    const skillsBox = document.getElementById('skills');
    if (skillsBox) {
      skillsBox.querySelectorAll('[data-evidence-signal]').forEach(node => node.remove());
      skills.slice(0, 8).forEach(item => {
        if (!item?.evidenceCount) return;
        const row = [...skillsBox.children].find(node => node.textContent.includes(String(item.skill)));
        if (!row) return;
        const signal = document.createElement('small');
        signal.dataset.evidenceSignal = 'true';
        signal.className = 'muted';
        signal.textContent = `${item.evidenceCount} evidence-linked week${item.evidenceCount === 1 ? '' : 's'} • ${item.evidenceQuality || 0}% evidence quality`;
        row.appendChild(signal);
      });
    }
  }
  function boot() {
    if (!ready()) return setTimeout(boot, 50);
    window.ECRHCanonical.store.subscribe(render);
    render();
    new MutationObserver(render).observe(document.body, { childList: true, subtree: true });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
