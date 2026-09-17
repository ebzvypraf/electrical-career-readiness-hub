/* Electrical Career Readiness Hub — Evidence UI enhancer v1.5.
 * Makes the canonical Apply → Check → Evidence proof chain visible before
 * evidence capture, prevents an unproven/stale chain from being demonstrated,
 * and preserves actionable downstream choices after evidence capture.
 * This is a projection only; the learning-state store remains authoritative.
 * v1.5 makes in-progress Evidence resumable by autosaving the proof package
 * into the existing canonical week context without marking Evidence complete.
 */
import './portfolio-review-enhancer-v1.js';
import './check-proof-ui-enhancer-v1.js';
import './learn-stage-ui-enhancer-v1.js';

(function () {
  'use strict';
  let draftSaveTimer = null;
  let draftSignature = '';

  function text(value) { return String(value == null ? '' : value).trim(); }
  function esc(value) { return text(value).replace(/[&<>\"']/g, function (char) { return ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '\"':'&quot;', "'":'&#39;' }[char]); }); }
  function root() { return typeof window !== 'undefined' ? window : null; }
  function api() { return root() && root().ECRHCanonical; }
  function getStore() { const canonical = api(); return typeof canonical?.store === 'function' ? canonical.store() : canonical?.store || null; }
  function currentWeek() { const card = document.getElementById('modalCard'); const marker = card && card.querySelector('.k'); const match = marker && text(marker.textContent).match(/Week\s+(\d+)/i); return match ? Number(match[1]) : null; }
  function weekContext(week) { const store = getStore(); return store && store.getState ? (store.getState().contextByWeek?.[String(week)] || {}) : {}; }
  function evidenceContext(week) { return weekContext(week).evidence || {}; }
  function evidenceDraft(week) { return weekContext(week).evidenceDraft || {}; }
  function time(value) { const n = Date.parse(value || ''); return Number.isFinite(n) ? n : null; }
  function isStaleEvidence(week, evidence) { const ctx = weekContext(week); const captured = time(evidence?.capturedAt || evidence?.date); if (captured == null) return false; const apply = time(ctx?.applicationEvidence?.capturedAt); const check = time(ctx?.assessmentResult?.date); return [apply, check].some(value => value != null && value > captured); }
  function proofState(week) { const ctx = weekContext(week), apply = ctx.applicationEvidence || {}, check = ctx.assessmentResult || {}, evidence = ctx.evidence || {}; const applyReady = Boolean(apply.tasksComplete && apply.deliverable && apply.decisions && apply.assumptions && apply.verification); const checkPassed = Boolean(check.passed === true && (check.completionReady === true || check.passed === true)); const stale = isStaleEvidence(week, evidence); return { applyReady, checkPassed, stale, evidenceDemonstrated: Boolean(evidence.demonstrated) && !stale }; }
  function fieldValue(ids) { const list = Array.isArray(ids) ? ids : [ids]; for (const id of list) { const node = document.getElementById(id); if (node) return text(node.value); } return ''; }
  function setFieldValue(ids, value) { const list = Array.isArray(ids) ? ids : [ids]; list.forEach(id => { const node = document.getElementById(id); if (node && !text(node.value)) node.value = String(value || ''); }); }
  function collectDraft(week) {
    const criteria = Array.from(document.querySelectorAll('.criterion[data-index]')).map(node => Boolean(node.checked));
    const qualityCriteria = Array.from(document.querySelectorAll('[id^="criterion_"]')).map(node => Boolean(node.checked));
    const normalizedCriteria = qualityCriteria.length ? qualityCriteria : criteria;
    return {
      title: fieldValue(['canonical-et', 'evidenceTitle']),
      description: fieldValue(['canonical-ed', 'evidenceDescription']),
      applyLink: fieldValue(['canon-eal']),
      checkLink: fieldValue(['canon-ecl']),
      reflection: fieldValue(['canon-er', 'evidenceReflection']),
      nextAction: fieldValue(['canon-ena', 'evidenceNext']),
      criteria: normalizedCriteria,
      savedAt: new Date().toISOString(),
      weekId: String(week)
    };
  }
  function hasDraftContent(draft) {
    return Boolean(draft && (text(draft.title) || text(draft.description) || text(draft.applyLink) || text(draft.checkLink) || text(draft.reflection) || text(draft.nextAction) || (Array.isArray(draft.criteria) && draft.criteria.some(Boolean))));
  }
  function draftStatusText(status) { const node = document.getElementById('evidenceDraftStatus'); if (node) node.textContent = status; }
  function persistDraft(week, immediate) {
    const store = getStore();
    if (!store || week == null || typeof store.updateStageContext !== 'function') return;
    const draft = collectDraft(week);
    if (!hasDraftContent(draft)) return;
    const signature = JSON.stringify({ title:draft.title, description:draft.description, applyLink:draft.applyLink, checkLink:draft.checkLink, reflection:draft.reflection, nextAction:draft.nextAction, criteria:draft.criteria });
    if (!immediate && signature === draftSignature) return;
    draftSignature = signature;
    store.updateStageContext(String(week), { evidenceDraft: draft });
    draftStatusText('Draft saved automatically');
  }
  function scheduleDraftSave(week, immediate) {
    if (draftSaveTimer) clearTimeout(draftSaveTimer);
    if (immediate) { persistDraft(week, true); return; }
    draftSaveTimer = setTimeout(function () { draftSaveTimer = null; persistDraft(week, false); }, 650);
    draftStatusText('Saving draft…');
  }
  function restoreDraft(week) {
    const draft = evidenceDraft(week);
    const existing = evidenceContext(week);
    const source = hasDraftContent(draft) ? draft : existing;
    if (!source || typeof source !== 'object') return;
    setFieldValue(['canonical-et', 'evidenceTitle'], source.title || '');
    setFieldValue(['canonical-ed', 'evidenceDescription'], source.description || '');
    setFieldValue(['canon-eal'], source.applyLink || '');
    setFieldValue(['canon-ecl'], source.checkLink || '');
    setFieldValue(['canon-er', 'evidenceReflection'], source.reflection || '');
    setFieldValue(['canon-ena', 'evidenceNext'], source.nextAction || '');
    if (Array.isArray(source.criteria)) {
      document.querySelectorAll('.criterion[data-index]').forEach(function (node) { const index = Number(node.dataset.index); if (Number.isInteger(index) && source.criteria[index] != null) node.checked = Boolean(source.criteria[index]); });
      source.criteria.forEach(function (checked, index) { const node = document.getElementById('criterion_' + (index + 1)); if (node) node.checked = Boolean(checked); });
    }
    if (hasDraftContent(draft)) {
      draftSignature = JSON.stringify({ title:text(draft.title), description:text(draft.description), applyLink:text(draft.applyLink), checkLink:text(draft.checkLink), reflection:text(draft.reflection), nextAction:text(draft.nextAction), criteria:Array.isArray(draft.criteria) ? draft.criteria : [] });
      draftStatusText(`Draft restored${draft.savedAt ? ` • ${new Date(draft.savedAt).toLocaleString()}` : ''}`);
    }
  }
  function ensureDraftStatus() {
    const button = document.getElementById('canonical-save-evidence');
    if (!button || document.getElementById('evidenceDraftStatus')) return;
    const status = document.createElement('div');
    status.id = 'evidenceDraftStatus';
    status.className = 'muted';
    status.style.cssText = 'margin-top:4px;font-size:12px';
    status.setAttribute('role', 'status');
    status.setAttribute('aria-live', 'polite');
    button.parentNode?.insertBefore(status, button);
  }
  function bindDraftAutosave() {
    const card = document.getElementById('modalCard');
    if (!card || card.dataset.evidenceDraftAutosave === '1') return;
    card.dataset.evidenceDraftAutosave = '1';
    const schedule = function () { const week = currentWeek(); if (week != null) scheduleDraftSave(week, false); };
    card.addEventListener('input', function (event) { if (event.target?.matches?.('#canonical-et, #canonical-ed, #evidenceTitle, #evidenceDescription, #canon-eal, #canon-ecl, #canon-er, #evidenceReflection, #canon-ena, #evidenceNext, #criterion_[id^="criterion_"]')) schedule(); });
    card.addEventListener('change', function (event) { if (event.target?.matches?.('.criterion, [id^="criterion_"]')) schedule(); });
    card.addEventListener('focusout', function (event) { if (event.target?.matches?.('#canonical-et, #canonical-ed, #evidenceTitle, #evidenceDescription, #canon-eal, #canon-ecl, #canon-er, #evidenceReflection, #canon-ena, #evidenceNext, .criterion, [id^="criterion_"]')) { const week = currentWeek(); if (week != null) scheduleDraftSave(week, true); } });
  }
  function gateMarkup(state) { const row = (ok, label, detail) => '<div class="rubric-row"><span><strong>' + (ok ? 'Ready' : 'Blocked') + '</strong> — ' + esc(label) + '</span><span class="tag' + (ok ? ' pill ok' : '') + '">' + esc(detail) + '</span></div>'; const ready = state.applyReady && state.checkPassed && !state.stale; return '<div class="learning-card" id="canonical-proof-gate"><h3>Proof-chain gate</h3><p class="muted">Evidence is the final proof step. It becomes demonstrable only when the current Apply record and current Check result are valid and not superseded.</p><div class="rubric">' + row(state.applyReady, 'Apply record', state.applyReady ? 'Complete' : 'Required first') + row(state.checkPassed, 'Check result', state.checkPassed ? 'Passed' : 'Pass Check first') + row(!state.stale, 'Evidence freshness', state.stale ? 'Recapture required' : 'Current') + '</div><div class="result' + (ready ? '' : ' warn') + '"><b>' + (ready ? 'Evidence capture is unlocked.' : 'Evidence capture is blocked.') + '</b><p>' + (ready ? 'Record the artifact, satisfy the rubric, and preserve the Apply → Check links.' : 'Return to the incomplete upstream stage shown above. The canonical store will reject Evidence until the proof chain is valid.') + '</p></div></div>'; }
  function enhance() { const card = document.getElementById('modalCard'); if (!card || !document.getElementById('canonical-save-evidence')) return; const week = currentWeek(); ensureDraftStatus(); bindDraftAutosave(); const canonical = api(); const module = canonical && canonical.catalog && canonical.catalog[String(week)]; const criteria = Array.isArray(module?.evidence?.criteria) ? module.evidence.criteria : []; const existing = evidenceContext(week) || {}; const draft = evidenceDraft(week) || {}; const source = hasDraftContent(draft) ? { ...existing, ...draft } : existing; const anchor = document.getElementById('canonical-ed') || document.getElementById('evidenceDescription'); const form = anchor && anchor.closest('.evidence-form'); if (!form) return; const state = proofState(week); const stale = state.stale; const saveButton = document.getElementById('canonical-save-evidence'); if (saveButton) { saveButton.disabled = !(state.applyReady && state.checkPassed); saveButton.title = saveButton.disabled ? 'Complete Apply and pass Check before capturing Evidence.' : 'Capture canonical Evidence'; } let block = document.getElementById('canonical-evidence-quality'); if (!block) { block = document.createElement('div'); block.className = 'evidence-form'; block.id = 'canonical-evidence-quality'; form.insertBefore(block, saveButton); } block.innerHTML = gateMarkup(state) + (stale ? '<div class="result warn"><b>Evidence needs recapture.</b><p>This saved Evidence is older than a later Apply or Check result. The previous proof remains in history, but it cannot represent the latest learning state until you capture it again.</p></div>' : '') + '<div class="learning-card"><h3>Evidence quality</h3><p class="muted">Connect the proof to the practical Apply decision and the Check learning result. High-quality evidence shows the chain, not only the final artifact.</p>' + (criteria.length ? '<div class="rubric">' + criteria.map(function (label, index) { const id = 'criterion_' + (index + 1); const checked = source[id] === true || source[id] === 'true' || (Array.isArray(source.criteria) && source.criteria[index] === true); return '<label class="rubric-row" style="cursor:pointer;gap:10px;align-items:flex-start"><span style="display:flex;gap:8px;align-items:flex-start"><input type="checkbox" id="' + id + '" ' + (checked ? 'checked' : '') + '> <span>' + (index + 1) + '. ' + esc(label) + '</span></span><span class="tag">Required</span></label>'; }).join('') + '</div>' : '<div class="saved">No additional rubric criteria are defined for this week.</div>') + '<label>Apply decision / artifact link<textarea id="canon-eal" placeholder="Which Apply decision, deliverable, or verification does this Evidence prove?">' + esc(source.applyLink || '') + '</textarea></label><label>Check / recovery link<textarea id="canon-ecl" placeholder="Which Check concept or recovered question does this Evidence demonstrate?">' + esc(source.checkLink || '') + '</textarea></label><label>Reflection<textarea id="canon-er" placeholder="What did you learn, decide, or improve through this evidence?">' + esc(source.reflection || '') + '</textarea></label><label>Next action<textarea id="canon-ena" placeholder="What will you do next to strengthen or apply this capability?">' + esc(source.nextAction || '') + '</textarea></label><p class="muted">A demonstrated Evidence record requires the canonical Apply and Check links, satisfied criteria, and a current upstream proof chain.</p></div>'; restoreDraft(week); card.dataset.evidenceEnhanced = '1'; }
  function findStageButton(week, stage) { const weeks = Array.from(document.querySelectorAll('.week')); const target = weeks.find(function (node) { const no = node.querySelector('.wno'); return no && Number((text(no.textContent).match(/\d+/) || [])[0]) === Number(week); }); if (!target) return null; return Array.from(target.querySelectorAll('button')).find(function (button) { return new RegExp('^\\s*' + stage + '\\b', 'i').test(text(button.textContent)); }) || Array.from(target.querySelectorAll('button')).find(function (button) { return text(button.textContent).toLowerCase().includes(stage.toLowerCase()); }); }
  function nextCanonicalAction(week) { const store = getStore(); const state = store && store.getState ? store.getState() : null; const next = state?.hubSignals?.nextBestAction; if (next && next.weekId != null && next.stage) return { week: Number(next.weekId), stage: text(next.stage).toLowerCase() }; const fallback = Number(week) + 1; return { week: fallback, stage: 'learn' }; }
  function handoffAfterEvidence(week) { const next = nextCanonicalAction(week); if (!next || !Number.isFinite(next.week)) return; const button = findStageButton(next.week, next.stage); if (button) { button.click(); return; } const courseNav = Array.from(document.querySelectorAll('[data-page="course"]')).find(Boolean); if (courseNav) courseNav.click(); }
  function downstreamButtons(week) { const card = document.getElementById('modalCard'); if (!card) return; let panel = document.getElementById('canonical-evidence-handoff'); if (!panel) { panel = document.createElement('div'); panel.id = 'canonical-evidence-handoff'; panel.className = 'learning-card'; const anchor = document.getElementById('canonical-save-evidence'); if (anchor?.parentElement) anchor.parentElement.appendChild(panel); } const next = nextCanonicalAction(week); panel.innerHTML = '<h3>Evidence captured</h3><p class="muted">Your proof is stored. Choose where to continue so the Evidence step does not hide the next part of your learning loop.</p><div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn" type="button" data-evidence-journal>Open Journal</button><button class="btn" type="button" data-evidence-portfolio>Open Portfolio</button>' + (next && Number.isFinite(next.week) ? '<button class="btn primary" type="button" data-evidence-next>Next learning action</button>' : '') + '</div>'; panel.querySelector('[data-evidence-journal]').onclick = () => { document.getElementById('modal')?.classList.remove('show'); Array.from(document.querySelectorAll('[data-page="journal"]')).find(Boolean)?.click(); }; panel.querySelector('[data-evidence-portfolio]').onclick = () => { document.getElementById('modal')?.classList.remove('show'); Array.from(document.querySelectorAll('[data-page="portfolio"]')).find(Boolean)?.click(); }; panel.querySelector('[data-evidence-next]')?.addEventListener('click', () => { document.getElementById('modal')?.classList.remove('show'); handoffAfterEvidence(week); }); panel.dataset.week = String(week); }
  function capture(event) { const target = event.target && event.target.closest ? event.target.closest('#canonical-save-evidence') : null; if (!target) return; const store = getStore(); if (!store || typeof store.captureEvidence !== 'function') return; enhance(); const week = currentWeek(); if (!week) return; const state = proofState(week); if (!state.applyReady || !state.checkPassed) { event.preventDefault(); event.stopImmediatePropagation(); window.alert('Evidence is locked until the structured Apply record is complete and the Check stage has passed.'); return; } const titleEl = document.getElementById('canonical-et') || document.getElementById('evidenceTitle'); const descriptionEl = document.getElementById('canonical-ed') || document.getElementById('evidenceDescription'); const title = text(titleEl && titleEl.value); const description = text(descriptionEl && descriptionEl.value); if (!title || !description) return; event.preventDefault(); event.stopImmediatePropagation(); const input = { weekId: String(week), title, description, applyLink: text(document.getElementById('canon-eal')?.value), checkLink: text(document.getElementById('canon-ecl')?.value), reflection: text(document.getElementById('canon-er')?.value), nextAction: text(document.getElementById('canon-ena')?.value), date: new Date().toISOString() }; const module = api()?.catalog?.[String(week)]; const criteria = Array.isArray(module?.evidence?.criteria) ? module.evidence.criteria : []; criteria.forEach(function (_, index) { const checkbox = document.getElementById('criterion_' + (index + 1)); input['criterion_' + (index + 1)] = Boolean(checkbox && checkbox.checked); }); const result = store.captureEvidence(input); if (!result.ok) { window.alert(result.reason || 'Evidence could not be captured.'); return; } store.updateStageContext(String(week), { evidenceDraft: null }); draftSignature = ''; draftStatusText('Evidence captured — draft cleared'); downstreamButtons(week); }
  function init() { if (typeof document === 'undefined') return; document.addEventListener('click', capture, true); const observer = new MutationObserver(enhance); observer.observe(document.body, { childList: true, subtree: true }); enhance(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();