/* Electrical Career Readiness Hub — Home learning-loop status v2.9. */
(function () {
  'use strict';
  const STAGES = ['learn', 'apply', 'check', 'evidence'];
  const LABELS = { learn: 'Learn', apply: 'Apply', check: 'Check', evidence: 'Evidence' };
  const SESSION = {
    learn: { minutes: '15–20 min', focus: 'Understand the core idea and explain it in your own words.', done: 'Saved active-recall takeaway' },
    apply: { minutes: '25–40 min', focus: 'Complete the practical tasks and document the engineering reasoning behind your work.', done: 'Saved structured Apply record' },
    check: { minutes: '10–15 min', focus: 'Answer the authored questions and use the feedback to confirm or correct your reasoning.', done: 'Passed the current Check' },
    evidence: { minutes: '10–20 min', focus: 'Capture a concise, reviewable proof package linked to the Apply and Check work.', done: 'Demonstrated Evidence captured' }
  };
  const esc = value => String(value ?? '').replace(/[&<>\"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '\"':'&quot;', "'":'&#39;' }[c]));
  const api = () => typeof window !== 'undefined' ? window.ECRHCanonical : null;
  const store = () => { const a = api(); return typeof a?.store === 'function' ? a.store() : a?.store || null; };
  const passed = (value, status) => { const v = String(value ?? '').toLowerCase(), s = String(status ?? '').toLowerCase(); if (value === true || value === 1 || ['true','passed','pass'].includes(v) || ['passed','pass','complete','completed','success','successful'].includes(s)) return true; if (value === false || value === 0 || ['false','failed','fail'].includes(v) || ['failed','fail','incomplete','unsuccessful'].includes(s)) return false; return null; };
  const history = list => (Array.isArray(list) ? list.filter(x => x && typeof x === 'object').map((item,index)=>({item,index})).sort((a,b)=>{ const at=Date.parse(String(a.item?.completedAt||a.item?.createdAt||a.item?.timestamp||a.item?.date||'')), bt=Date.parse(String(b.item?.completedAt||b.item?.createdAt||b.item?.timestamp||b.item?.date||'')); const ah=Number.isFinite(at), bh=Number.isFinite(bt); if(ah&&bh&&at!==bt)return at-bt; if(ah!==bh)return ah?-1:1; const aa=Number(a.item?.attemptNumber), ba=Number(b.item?.attemptNumber), aah=Number.isFinite(aa), bah=Number.isFinite(ba); if(aah&&bah&&aa!==ba)return aa-ba; return a.index-b.index; }).map(x=>x.item) : []);
  function render() {
    const a=api(), s=store(), home=document.getElementById('home'); if(!a||!s||!home)return;
    const state=s.getState?.()||{}, next=state.hubSignals?.nextBestAction;
    const weekId=String(next?.weekId||Object.keys(state.progressByWeek||{}).sort((x,y)=>Number(x)-Number(y)).find(id=>STAGES.some(k=>!state.progressByWeek?.[id]?.[k]))||''); if(!weekId)return;
    const week=a.catalog?.[weekId]||{}, context=state.contextByWeek?.[weekId]||{}, progress=state.progressByWeek?.[weekId]||{}, integration=week.integration||{};
    let panel=document.getElementById('home-learning-loop'); if(!panel){ panel=document.createElement('div'); panel.id='home-learning-loop'; panel.className='card s12'; const grid=home.querySelector('.grid'); if(!grid)return; grid.insertBefore(panel,grid.children[1]||null); }
    const latest=history(context.assessmentHistory).at(-1)||context.assessmentResult||null, latestPassed=passed(latest?.passed,latest?.status);
    const statuses=STAGES.map(stage=>{ if(progress[stage])return['complete','Complete']; if(stage==='check'&&latestPassed===false)return['remediation','Reinforcement needed']; if(stage==='check'&&latestPassed===true)return['ready','Passed']; if(stage==='learn'&&context.learnViewedAt)return['ready','Viewed']; return['pending','Pending']; });
    const firstIncomplete=STAGES.findIndex((stage)=>!progress[stage]);
    const canonicalStage=STAGES.includes(next?.stage) ? String(next.stage) : null;
    const actionStage=latestPassed===false&&firstIncomplete===2?'check':(canonicalStage||((firstIncomplete<0)?null:STAGES[firstIncomplete]));
    const journal=(state.journalEntries||[]).filter(e=>String(e?.weekId||'')===weekId).length, portfolio=(state.portfolioEntries||[]).filter(e=>String(e?.week||'')===weekId).length;
    const remediation=context.remediation||{}, concepts=Array.isArray(remediation.concepts)?remediation.concepts.filter(Boolean).slice(0,3):[];
    const proof=next?.proofChain||{};
    const proofProgress=Number.isFinite(Number(next?.proofProgress?.split?.('/')?.[0]))?next.proofProgress:null;
    const proofComplete=next?.proofStatus==='demonstrated' || proof.completedStages===4;
    const signature=`${weekId}|${statuses.map(x=>x.join(':')).join('|')}|${journal}|${portfolio}|${latestPassed}|${state.hubSignals?.overallProgress||0}|${integration.journalPrompt||''}|${integration.portfolioPrompt||''}|${next?.proofProgress||''}|${next?.source||''}|${next?.reason||''}|${actionStage||''}`;
    if(panel.dataset.signature===signature)return;
    panel.dataset.signature=signature;
    const title=latestPassed===false?'Remediation':(next?.label||LABELS[actionStage]||'Complete');
    const prompt=latestPassed===false?(remediation.nextAction||`Complete targeted reinforcement for Week ${weekId}, then retry the Check.`):(next?.prompt||integration.homeAction||`Continue ${title.toLowerCase()} for this week.`);
    const downstream=latestPassed===false?`Latest Check was not passed${concepts.length?`; reinforce ${concepts.join(', ')}`:''}, then retry the Check.`:proofComplete?'Proof chain demonstrated for this week.':next?.proofProgress?`Proof chain: ${next.proofProgress}. Complete the next proof stage before moving on.`:portfolio?'Portfolio evidence captured for this week.':journal?`Journal trail recorded: ${journal} entr${journal===1?'y':'ies'}.`:'Journal and Portfolio will update from the canonical stage actions.';
    const journalPrompt=integration.journalPrompt||'Record what you learned, what you produced, what was difficult, and what you will do next.';
    const portfolioPrompt=integration.portfolioPrompt||week?.evidence?.prompt||'Capture a sanitized proof artifact that demonstrates the capability you practiced.';
    const sessionStage=actionStage||next?.stage||'learn';
    const session=SESSION[sessionStage]||SESSION.learn;
    const actionLabel=latestPassed===false?'Resume recovery':`Start ${LABELS[sessionStage]} session`;
    panel.innerHTML=`<div class="k">Learning loop</div><h2>Week ${esc(weekId)} — ${esc(week.title||'Current learning module')}</h2><p class="muted">One connected path. Work only on the current stage, then continue from the canonical next action.</p><div class="summary">${STAGES.map((stage,i)=>`<div class="goal"><b>${i+1}. ${LABELS[stage]}</b><small><span class="pill ${statuses[i][0]==='complete'||statuses[i][0]==='ready'?'ok':''}">${esc(statuses[i][1])}</span></small></div>`).join('')}</div><div class="mission" style="margin-top:10px"><b>Next: ${esc(title)}</b><div class="muted">${esc(prompt)}</div><div class="muted" style="margin-top:7px"><b>Today’s focus:</b> ${esc(session.focus)}</div><div class="muted" style="margin-top:4px"><b>Typical session:</b> ${esc(session.minutes)} • <b>Done when:</b> ${esc(session.done)}</div><div class="muted" style="margin-top:7px"><b>Downstream proof:</b> ${esc(downstream)}</div>${next?.reason?`<div class="muted" style="margin-top:7px"><b>Why this is next:</b> ${esc(next.reason)}</div>`:''}${actionStage?`<button class="btn primary" id="home-learning-loop-open" style="margin-top:10px">${esc(actionLabel)}</button>`:''}</div><div class="learning-grid" style="margin-top:10px"><div class="learning-card"><h3>Journal reflection</h3><p class="muted">${esc(journalPrompt)}</p><button class="btn" id="home-learning-loop-journal">Open Journal</button></div><div class="learning-card"><h3>Portfolio evidence</h3><p class="muted">${esc(portfolioPrompt)}</p><button class="btn" id="home-learning-loop-portfolio">Open Portfolio</button></div></div>`;
    const btn=document.getElementById('home-learning-loop-open'); if(btn)btn.onclick=()=>{ const direct=document.querySelector(`[data-canonical-open="${weekId}:${actionStage}"]`); if(direct){direct.click();return;} const legacy=document.querySelector(`[data-open="${Number(weekId)-1}:${STAGES.indexOf(actionStage)}"]`); if(legacy){legacy.click();return;} document.querySelector('[data-page="course"]')?.click(); };
    const journalBtn=document.getElementById('home-learning-loop-journal'); if(journalBtn)journalBtn.onclick=()=>document.querySelector('[data-page="journal"]')?.click();
    const portfolioBtn=document.getElementById('home-learning-loop-portfolio'); if(portfolioBtn)portfolioBtn.onclick=()=>document.querySelector('[data-page="portfolio"]')?.click();
  }
  function boot(){ const s=store(); if(!s){setTimeout(boot,250);return;} render(); s.subscribe(()=>setTimeout(render,0)); new MutationObserver(render).observe(document.body,{childList:true,subtree:true}); }
  if(typeof document!=='undefined'){ if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true}); else boot(); }
})();
