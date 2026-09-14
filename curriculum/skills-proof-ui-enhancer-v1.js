/* Electrical Career Readiness Hub — Skills proof projection v1.
 * Surfaces the canonical skill readiness model and traces each skill back to
 * completed learning stages, Journal activity, Check results and demonstrated Evidence.
 * UI only; learning-state store remains authoritative.
 */
(function () {
  'use strict';
  const esc = value => String(value == null ? '' : value).replace(/[&<>\"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '\"':'&quot;', "'":'&#39;' }[c]));
  const root = () => typeof window !== 'undefined' ? window : null;
  const getStore = () => { const c = root()?.ECRHCanonical; return typeof c?.store === 'function' ? c.store() : c?.store || null; };
  const render = () => {
    const host = document.getElementById('skills');
    if (!host) return;
    const store = getStore();
    const state = store?.getState ? store.getState() : null;
    const signals = state?.hubSignals || {};
    const items = Array.isArray(signals.demonstratedCapability) ? signals.demonstratedCapability : [];
    if (!items.length) {
      host.innerHTML = '<div class="empty"><b>Skill evidence is building.</b><p>Complete Learn → Apply → Check → Evidence activities to create traceable capability signals here.</p></div>';
      return;
    }
    const signature = items.map(item => [item.skill,item.readiness,item.evidenceCount,item.knowledgeChecks,item.journalCoverage,item.evidenceQuality,(item.coverage||{}).learn,(item.coverage||{}).apply,(item.coverage||{}).check,(item.coverage||{}).evidence].join(':')).join('|');
    if (host.dataset.proofSignature === signature) return;
    host.dataset.proofSignature = signature;
    host.innerHTML = items.map(item => {
      const coverage = item.coverage || {};
      const score = Math.max(0, Math.min(100, Number(item.readiness) || 0));
      const evidence = Number(item.evidenceCount) || 0;
      const checks = Number(item.knowledgeChecks) || 0;
      const journal = Number(item.journalCoverage) || 0;
      const quality = Number(item.evidenceQuality) || 0;
      const recommendation = item.recommendedWeekId ? `Week ${esc(item.recommendedWeekId)}${item.recommendedStageLabel ? ` · ${esc(item.recommendedStageLabel)}` : ''}` : 'No immediate gap';
      return `<article class="skillrow"><div class="skillhead"><b>${esc(item.skill)}</b><strong>${score}%</strong></div><div class="bar"><span style="width:${score}%"></span></div><div class="muted">Stage coverage — Learn ${Number(coverage.learn)||0}% · Apply ${Number(coverage.apply)||0}% · Check ${Number(coverage.check)||0}% · Evidence ${Number(coverage.evidence)||0}%</div><div class="summary" style="grid-template-columns:repeat(4,1fr);margin-top:4px"><div class="goal"><b>${evidence}</b><small>demonstrated evidence</small></div><div class="goal"><b>${checks}</b><small>passed Checks</small></div><div class="goal"><b>${journal}%</b><small>Journal coverage</small></div><div class="goal"><b>${quality}%</b><small>evidence quality</small></div></div><div class="muted" style="margin-top:7px"><b>Next focus:</b> ${esc(recommendation)}</div></article>`;
    }).join('');
  };
  const boot = () => {
    if (typeof document === 'undefined') return;
    render();
    const observer = new MutationObserver(render);
    observer.observe(document.body, { childList: true, subtree: true });
    const store = getStore();
    if (store?.subscribe) store.subscribe(render);
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true }); else boot();
})();
