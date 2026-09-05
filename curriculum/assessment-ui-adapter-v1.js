/* Electrical Career Readiness Hub — production UI adapter v4.
 * This external entry point intentionally owns the UI bootstrap so the existing
 * production shell remains usable even if the legacy inline script cannot parse.
 * All progression state is sourced from the canonical learning state store.
 */
(function () {
  'use strict';
  const STAGES = ['learn', 'apply', 'check', 'evidence'];
  const LEGACY_KEY = 'ecrh-v35';
  const esc = value => String(value ?? '').replace(/[&<>\"']/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '\"':'&quot;', "'":'&#39;' }[char]));
  const $ = id => document.getElementById(id);
  let catalog = {}, assessments = {}, store = null, state = null;

  function legacy() { try { return JSON.parse(localStorage.getItem(LEGACY_KEY) || '{}') || {}; } catch (_) { return {}; } }
  function writeLegacy(next) { localStorage.setItem(LEGACY_KEY, JSON.stringify(next)); }
  function weekCount(s, i) { return STAGES.filter(k => s?.progressByWeek?.[String(i + 1)]?.[k]).length; }
  function nextAction(s) { for (let i=1;i<=24;i++) for (const k of STAGES) if (!s.progressByWeek?.[String(i)]?.[k]) return { week:i, stage:k }; return null; }
  function stageLabel(k) { return k.charAt(0).toUpperCase()+k.slice(1); }
  function weekTitle(i) { return catalog[String(i)]?.title || `Week ${i}`; }
  function publish() { state = store.getState(); renderAll(); }

  function renderNav() {
    const nav = [['home','Home','⌂'],['course','Course','▤'],['skills','Skills','◈'],['journal','Journal','✎'],['portfolio','Portfolio','▣'],['settings','Settings','⚙']];
    $('nav').innerHTML = nav.map(n => `<button data-page="${n[0]}" aria-label="${n[1]}"><span class="navicon">${n[2]}</span><span>${n[1]}</span></button>`).join('');
    document.querySelectorAll('[data-page]').forEach(b => b.onclick = () => go(b.dataset.page));
  }
  function go(id) { document.querySelectorAll('.page').forEach(p=>p.classList.toggle('active',p.id===id)); document.querySelectorAll('.nav button').forEach(b=>b.classList.toggle('active',b.dataset.page===id)); if(innerWidth<761)$('sidebar').classList.remove('open'); renderAll(); }

  function renderHome() {
    const n=nextAction(state), p=state.hubSignals?.overallProgress || 0, h=state.hubSignals?.journal?.hoursThisWeek || 0;
    $('pct').textContent=Math.round(p)+'%'; $('pbar').style.width=Math.round(p)+'%'; $('meta').textContent=`${Math.round(p*96/100)} / 96 activities`;
    $('hours').textContent=Number(h).toFixed(1)+'h'; $('target').textContent=(legacy().target||6)+'h'; $('streak').textContent=(state.hubSignals?.journal?.streak||0)+'-day study streak'; $('streakM').textContent=state.hubSignals?.journal?.streak||0;
    $('evM').textContent=state.hubSignals?.portfolio?.evidenceCount||0;
    $('nextTitle').textContent=n?`Week ${n.week}`:'Program complete'; $('nextType').textContent=n?stageLabel(n.stage):'Complete';
    $('coach').textContent=n?({learn:'Build understanding first.',apply:'Apply it to a practical case.',check:'Check your reasoning.',evidence:'Capture evidence before moving on.'}[n.stage]):'You completed the pathway.';
    $('coachText').textContent=n?`Continue ${stageLabel(n.stage).toLowerCase()} for ${weekTitle(n.week)}.`:'Review your portfolio and prepare for senior-role interviews.';
    $('homeOpen').onclick=()=>n&&openLesson(n.week,n.stage);
    $('mission').innerHTML=`<div class="mission"><b>${n?`Week ${n.week}: ${stageLabel(n.stage)}`:'Pathway complete'}</b><div class="muted">${n?esc(weekTitle(n.week)):'Your next step is portfolio and interview readiness.'}</div></div>`;
    const signals=state.hubSignals||{}, gaps=signals.prioritySkillGaps||[];
    $('summary').innerHTML=[['course','24-week guided pathway'],['skills','Readiness from demonstrated capability'],['journal',`${signals.journal?.entryCount||0} reflections recorded`],['portfolio',`${signals.portfolio?.evidenceCount||0} evidence records`],['settings','Progress protection and preferences']].map(x=>`<button data-page="${x[0]}"><b>${x[0][0].toUpperCase()+x[0].slice(1)}</b><small style="display:block;color:var(--muted)">${esc(x[1])}</small></button>`).join('');
    $('feed').innerHTML=`<div class="feeditem"><b>Canonical learning state</b><div class="muted">${Math.round(p)}% of the 96-stage pathway completed.</div></div><div class="feeditem"><b>Next best action</b><div class="muted">${n?`Week ${n.week} — ${stageLabel(n.stage)}`:'All stages complete.'}</div></div>`;
    $('gaps').innerHTML=(gaps.length?gaps.slice(0,4):[{skill:'No priority gaps detected'}]).map(g=>`<div class="goal"><b>${esc(g.skill||g.name)}</b><small>${esc(g.reason||'Use course evidence to strengthen this capability.')}</small></div>`).join('');
  }

  function renderCourse() {
    const n=nextAction(state);
    $('modules').innerHTML=Array.from({length:24},(_,x)=>x+1).map(i=>{const open=n?.week===i, d=catalog[String(i)]||{};return `<div class="week ${open?'open':''}"><button class="weekhead" aria-expanded="${open}"><span class="wno">W${String(i).padStart(2,'0')}</span><span class="phase">${esc(d.phase||'')}</span><span class="wtitle">${esc(d.title||`Week ${i}`)}</span><span class="wcount">${weekCount(state,i)}/4</span></button><div class="weekbody">${STAGES.map(k=>`<div class="stage"><span>${state.progressByWeek?.[String(i)]?.[k]?'✓':STAGES.indexOf(k)+1}</span><b>${stageLabel(k)}</b><span>${k==='learn'?'Build understanding.':k==='apply'?'Produce a practical output.':k==='check'?'Validate your reasoning.':'Capture reviewable evidence.'}</span><button class="btn ${state.progressByWeek?.[String(i)]?.[k]?'':'primary'}" data-canonical-open="${i}:${k}">${state.progressByWeek?.[String(i)]?.[k]?'Review':'Open'}</button></div>`).join('')}</div></div>`}).join('');
    document.querySelectorAll('.weekhead').forEach(h=>h.onclick=()=>{h.parentElement.classList.toggle('open');h.setAttribute('aria-expanded',h.parentElement.classList.contains('open'));});
    document.querySelectorAll('[data-canonical-open]').forEach(b=>b.onclick=()=>{const [i,k]=b.dataset.canonicalOpen.split(':');openLesson(+i,k);});
  }

  function renderSkills() {
    const items=state.hubSignals?.skills?.demonstratedCapability||[];
    $('skills').innerHTML=(items.length?items:[{skill:'Learning evidence',score:Math.round((state.hubSignals?.portfolio?.evidenceCompletionRate||0)*5),target:5}]).map(x=>`<div class="skillrow"><div class="skillhead"><span>${esc(x.skill||x.name)}</span><b>${esc(x.score ?? x.current ?? 0)}/5${x.target?` → ${esc(x.target)}/5`:''}</b></div><div class="bar"><span style="width:${Math.min(100,((x.score??x.current??0)/5)*100)}%"></span></div></div>`).join('');
    $('advice').innerHTML=(state.hubSignals?.prioritySkillGaps||[]).slice(0,6).map(x=>`<div class="goal"><b>${esc(x.skill||x.name)}</b><small>${esc(x.reason||'Complete related Learn, Apply and Evidence work.')}</small></div>`).join('')||'<div class="empty">No priority gaps yet.</div>';
  }

  function renderJournal() {
    const entries=state.hubSignals?.journal?.entries||[];
    $('logs').innerHTML=entries.slice().reverse().map(x=>`<div class="goal"><b>${esc(x.date)} — ${esc(x.hours||0)} h</b><div class="muted">${esc(x.study||'—')}<br>Learned: ${esc(x.learn||'—')}<br>Next: ${esc(x.next||'—')}</div></div>`).join('')||'<div class="empty">No reflections yet.</div>';
    $('jdate').value=$('jdate').value||new Date().toISOString().slice(0,10);
  }

  function renderPortfolio() {
    const entries=state.hubSignals?.portfolio?.entries||[];
    $('portfolioGrid').innerHTML=entries.map(x=>`<div class="evidence"><span class="pill ok">${esc(x.week?`Week ${x.week}`:'Evidence')}</span><h3>${esc(x.title||'Evidence')}</h3><div class="muted">${esc(x.description||x.summary||'')}</div></div>`).join('')||'<div class="empty">Complete Evidence stages to build your portfolio.</div>';
    const p=state.hubSignals?.portfolio||{}; $('readiness').innerHTML=`<div class="goal"><b>${p.evidenceCount||0}</b><small>Evidence records</small></div><div class="goal"><b>${Math.round((p.evidenceCompletionRate||0)*100)}%</b><small>Evidence completion rate</small></div><div class="goal"><b>${state.hubSignals?.skills?.knowledgeChecksPassed||0}</b><small>Knowledge checks passed</small></div>`;
  }

  function renderAll(){if(!state)return;renderHome();renderCourse();renderSkills();renderJournal();renderPortfolio();}

  function questionsFor(week){const a=assessments[String(week)];return Array.isArray(a)&&a.length?a:(catalog[String(week)]?.check?.questions||[]);}
  function openLesson(week,stage){
    const d=catalog[String(week)]||{}, p=state.progressByWeek?.[String(week)]||{}, ctx=state.contextByWeek?.[String(week)]||{}, qs=questionsFor(week); let body='';
    if(stage==='learn') body=`<div class="learning-hero"><b>Objective</b><p>${esc(d.objective||'')}</p></div><div class="learning-card"><h3>${esc(d.learn?.heading||'What to understand')}</h3><ul>${(d.learn?.concepts||d.learn?.bullets||[]).map(x=>`<li>${esc(x)}</li>`).join('')}</ul><p><b>Senior reasoning:</b> ${esc(d.learn?.seniorReasoning||d.learn?.takeaway||'')}</p></div>`;
    if(stage==='apply') body=`<div class="learning-hero"><b>Scenario</b><p>${esc(d.apply?.scenario||'')}</p></div><div class="learning-grid"><div class="learning-card"><h3>Do this</h3><ol>${(d.apply?.tasks||[]).map(x=>`<li>${esc(x)}</li>`).join('')}</ol></div><div class="learning-card"><h3>Deliverable</h3><p>${esc(d.apply?.deliverable||'')}</p></div></div><div class="evidence-form"><label>Application notes<textarea id="canon-note">${esc(ctx.applicationNotes||'')}</textarea></label><button class="btn" id="canon-save-note">Save application notes</button></div>`;
    if(stage==='check') body=`<div class="learning-hero"><b>Knowledge check</b><p>${esc(d.check?.passRule||'Answer all questions correctly to unlock Evidence.')}</p></div>${qs.map((q,n)=>`<div class="question"><b>${n+1}. ${esc(q.prompt||q.q)}</b>${Array.isArray(q.options)&&Number.isInteger(q.correctIndex)?q.options.map((o,i)=>`<label><input type="radio" name="cq${n}" value="${i}"> ${esc(o)}</label>`).join(''):`<textarea id="ca${n}" placeholder="Explain your reasoning."></textarea>`}</div>`).join('')}<button class="btn primary" id="canon-score">Score check</button>${ctx.assessmentResult?`<div class="result ${ctx.assessmentResult.passed?'':'warn'}"><b>Last score: ${esc(ctx.assessmentResult.score)}/${esc(ctx.assessmentResult.total)}</b> — ${ctx.assessmentResult.passed?'Pass.':'Not yet passed.'}</div>`:''}`;
    if(stage==='evidence') body=`<div class="learning-hero"><b>Evidence requirement</b><p>${esc(d.evidence?.prompt||'')}</p><div class="rubric">${(d.evidence?.criteria||[]).map((x,n)=>`<div class="rubric-row"><span>${n+1}. ${esc(x)}</span><span class="tag">Required</span></div>`).join('')}</div></div><div class="evidence-form"><label>Evidence title<input id="canon-et" value="${esc(ctx.evidence?.title||'')}"></label><label>What does it prove?<textarea id="canon-ed">${esc(ctx.evidence?.description||'')}</textarea></label><button class="btn primary" id="canon-save-evidence">Save & link evidence</button></div>`;
    $('modalCard').innerHTML=`<div style="display:flex;justify-content:space-between;gap:10px"><div><div class="k">Week ${week} • ${stageLabel(stage)}</div><h2>${esc(d.title||`Week ${week}`)}</h2><span class="pill">${esc(d.phase||'')}</span></div><button class="btn" id="canon-close">Close</button></div>${body}<div class="mission" style="margin-top:12px"><b>Stage gate</b><p class="muted">${p[stage]?'Completed.':'Complete the required work honestly before marking this stage complete.'}</p></div><button class="btn primary" id="canon-complete">${p[stage]?'Completed — review':'Mark stage complete'}</button>`;
    $('modal').classList.add('show'); $('canon-close').onclick=()=>$('modal').classList.remove('show');
    if(stage==='apply') $('canon-save-note').onclick=()=>{const notes=$('canon-note').value.trim();const result=store.updateStageContext(String(week),{applicationNotes:notes});if(!result.ok)return alert(result.reason||'Could not save application notes.');state=result.state;renderAll();openLesson(week,stage);};
    if(stage==='check') $('canon-score').onclick=()=>scoreCheck(week);
    if(stage==='evidence') $('canon-save-evidence').onclick=()=>{const title=$('canon-et').value.trim(),description=$('canon-ed').value.trim();if(!title||!description)return alert('Add an evidence title and description first.');const result=store.captureEvidence({weekId:String(week),title,description,date:new Date().toISOString()});if(!result.ok)return alert(result.reason||'Evidence could not be captured.');state=result.state;$('modal').classList.remove('show');renderAll();};
    $('canon-complete').onclick=()=>completeStage(week,stage);
  }
  function scoreCheck(week){
    const qs=questionsFor(week), responses={}; qs.forEach((q,n)=>{const c=document.querySelector(`input[name="cq${n}"]:checked`),a=$(`ca${n}`);responses[q.id||`q${n+1}`]=c?c.value:(a?a.value:'');});
    let score=0; const authored=qs.length&&qs.every(q=>Array.isArray(q.options)&&Number.isInteger(q.correctIndex));
    if(authored) qs.forEach((q,n)=>{const c=document.querySelector(`input[name="cq${n}"]:checked`);if(c&&Number(c.value)===q.correctIndex)score++;}); else score=0;
    const passed=authored?score===qs.length:qs.length===0;
    const result=store.recordAssessmentResult({weekId:String(week),result:{score,total:qs.length,passed,completionReady:passed,date:new Date().toISOString(),responses}});
    if(!result.ok)return alert(result.reason||'Check result could not be recorded.');
    state=result.state;renderAll();openLesson(week,'check');
  }
  function completeStage(week,stage){
    const context=store.getState().contextByWeek?.[String(week)]||{}; const result=store.completeStage({weekId:String(week),stage,context});
    if(!result.ok){alert(result.reason||'Stage requirements are not satisfied yet.');return;} state=result.state; $('modal').classList.remove('show'); renderAll();
  }

  async function boot(){
    try {
      const [{loadCanonicalCatalog,loadAssessmentCatalog},{createLearningStateStore}]=await Promise.all([import('./canonical-catalog-v1.js'),import('./learning-state-store-v1.js')]);
      [catalog,assessments]=await Promise.all([loadCanonicalCatalog(),loadAssessmentCatalog()]);
      store=createLearningStateStore({catalog});
      store.syncLegacyState(legacy());
      state=store.getState();
      store.subscribe(next=>{state=next;renderAll();});
      window.ECRHCanonical={ready:true,catalog,assessments,store,completeStage,openLesson};
      renderNav(); go('home');
      $('menu').onclick=()=>$('sidebar').classList.toggle('open');
      $('modal').onclick=e=>{if(e.target===$('modal'))$('modal').classList.remove('show');};
      document.addEventListener('keydown',e=>{if(e.key==='Escape')$('modal').classList.remove('show');});
      $('saveLog').onclick=()=>{const date=$('jdate').value,hours=+$('jhours').value||0,study=$('jstudy').value,learn=$('jlearn').value,hard=$('jhard').value,next=$('jnext').value;if(!date||(!study&&!learn&&!hard&&!next&&hours<=0))return alert('Add a date and study information.');const result=store.addJournalEntry({date,hours,study,learn,hard,next});if(!result.ok)return alert(result.reason||'Journal entry could not be saved.');state=result.state;['jhours','jstudy','jlearn','jhard','jnext'].forEach(id=>$(id).value='');renderAll();};
      $('saveSettings').onclick=()=>{const s=legacy();s.target=Math.max(1,Math.min(20,+$('targetInput').value||6));writeLegacy(s);renderAll();};
      $('targetInput').value=legacy().target||6;
      $('resume').onclick=()=>{const n=nextAction(state);if(n)openLesson(n.week,n.stage);};
      $('homeOpen').onclick=()=>{const n=nextAction(state);if(n)openLesson(n.week,n.stage);};
      $('backup').onclick=()=>{const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([JSON.stringify({app:'Electrical Career Readiness Hub',version:'4.0.0',legacy:legacy(),canonical:state},null,2)],{type:'application/json'}));a.download='electrical-career-readiness-backup.json';a.click();};
      $('restoreBtn').onclick=()=>$('restore').click(); $('restore').onchange=()=>{const f=$('restore').files[0];if(!f)return;const r=new FileReader();r.onload=()=>{try{const x=JSON.parse(r.result),s=x.legacy||x.state;if(s){writeLegacy(s);store.syncLegacyState(s);}}catch(_){alert('Backup could not be read.')}};r.readAsText(f);};
      renderAll();
    } catch(error) { console.warn('Canonical UI adapter unavailable:',error); }
  }
  boot();
})();
