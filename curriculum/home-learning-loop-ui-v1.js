/* Electrical Career Readiness Hub — Home learning-loop status v2.5. */
(function () {
  'use strict';
  const STAGES = ['learn', 'apply', 'check', 'evidence'];
  const LABELS = { learn: 'Learn', apply: 'Apply', check: 'Check', evidence: 'Evidence' };
  const esc = value => String(value ?? '').replace(/[&<>\"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '\"':'&quot;', "'":'&#39;' }[c]));
  const api = () => typeof window !== 'undefined' ? window.ECRHCanonical : null;
  const store = () => { const a = api(); return typeof a?.store === 'function' ? a.store() : a?.store || null; };
  const passed = (value, status) => { const v = String(value ?? '').toLowerCase(), s = String(status ?? '').toLowerCase(); if (value === true || value === 1 || ['true','passed','pass'].includes(v) || ['passed','pass','complete','completed','success','successful'].includes(s)) return true; if (value === false || value === 0 || ['false','failed','fail'].includes(v) || ['failed','fail','incomplete','unsuccessful'].includes(s)) return false; return null; };
  const history = list => (Array.isArray(list) ? list.filter(x => x && typeof x === 'object').map((item,index)=>({item,index})).sort((a,b)=>{ const at=Date.parse(String(a.item?.completedAt||a.item?.createdAt||a.item?.timestamp||a.item?.date||'')), bt=Date.parse(String(b.item?.completedAt||b.item?.createdAt||b.item?.timestamp||b.item?.date||'')); const ah=Number.isFinite(at), bh=Number.isFinite(bt); if(ah&&bh&&at!==bt)return at-bt; if(ah!==bh)return ah?-1:1; const aa=Number(a.item?.attemptNumber), ba=Number(b.item?.attemptNumber), aah=Number.isFinite(aa), bah=Number.isFinite(ba); if(aah&&bah&&aa!==ba)return aa-ba; if(aah!==bah)return aah?-1:1; return a.index-b.index; }).map(x=>x.item) : []);
  function render() {
    const a=api(), s=store(), home=document.getElementById('home'); if(!a||!s||!home)return;
    const state=s.getState?.()||{}, next=state.hubSignals?.nextBestAction;
    const weekId=String(next?.weekId||Object.keys(state.progressByWeek||{}).sort((x,y)=>Number(x)-Number(y)).find(id=>STAGES.some(k=>!state.progressByWeek?.[id]?.[k]))||''); if(!weekId)return;
    const week=a.catalog?.[weekId]||{}, context=state.contextByWeek?.[weekId]||{}, progress=state.progressByWeek?.[weekId]||{};
    let panel=document.getElementById('home-learning-loop'); if(!panel){ panel=document.createElement('div'); panel.id='home-learning-loop'; panel.className='card s12'; const grid=home.querySelector('.grid'); if(!grid)return; grid.insertBefore(panel,grid.children[1]||null); }
    const latest=history(context.assessmentHistory).at(-1)||context.assessmentResult||null, latestPassed=passed(latest?.passed,latest?.status);
    const statuses=STAGES.map(stage=>{ if(progress[stage])return['complete','Complete']; if(stage==='check'&&latestPassed===false)return['remediation','Reinforcement needed']; if(stage==='check'&&latestPassed===true)return['ready','Passed']; if(stage==='learn'&&context.learnViewedAt)return['ready','Viewed']; return['pending','Pending']; });
    const firstIncomplete=STAGES.findIndex((stage,i)=>!progress[stage]); const actionStage=latestPassed===false&&firstIncomplete===2?'check':(firstIncomplete<0?null:STAGES[firstIncomplete]);
    const journal=(state.journalEntries||[]).filter(e=>String(e?.weekId||'')===weekId).length, portfolio=(state.portfolioEntries||[]).filter(e=>String(e?.week||'')===weekId).length;
    const remediation=context.remediation||{}, concepts=Array.isArray(remediation.concepts)?remediation.concepts.filter(Boolean).slice(0,3):[];
    const signature=`${weekId}|${statuses.map(x=>x.join(':')).join('|')}|${journal}|${portfolio}|${latestPassed}|${state.hubSignals?.overallProgress||0}`; if(panel.dataset.signature===signature)return; panel.dataset.signature=signature;
    const title=latestPassed===false?'Remediation':(next?.label||LABELS[actionStage]||'Complete');
    const prompt=latestPassed===false?(remediation.nextAction||`Complete targeted reinforcement for Week ${weekId}, then retry the Check.`):(next?.prompt||week.integration?.homeAction||`Continue ${title.toLowerCase()} for this week.`);
    const downstream=latestPassed===false?`Latest Check was not passed${concepts.length?`; reinforce ${concepts.join(', ')}`:''}, then retry the Check.`:portfolio?'Portfolio evidence captured for this week.':journal?`Journal trail recorded: ${journal} entr${journal===1?'y':'ies'}.`:'Journal and Portfolio will update from the canonical stage actions.';
    panel.innerHTML=`<div class="k">Learning loop</div><h2>Week ${esc(weekId)} — ${esc(week.title||'Current learning module')}</h2><p class="muted">Your progress is tracked through one connected learning loop. Complete each stage in order; Evidence becomes reusable career proof.</p><div class="summary">${STAGES.map((stage,i)=>`<div class="goal"><b>${i+1}. ${LABELS[stage]}</b><small><span class="pill ${statuses[i][0]==='complete'||statuses[i][0]==='ready'?'ok':''}">${esc(statuses[i][1])}</span></small></div>`).join('')}</div><div class="mission" style="margin-top:10px"><b>Next: ${esc(title)}</b><div class="muted">${esc(prompt)}</div><div class="muted" style="margin-top:7px"><b>Downstream proof:</b> ${esc(downstream)}</div>${actionStage?`<button class="btn primary" id="home-learning-loop-open" style="margin-top:10px">Open ${esc(LABELS[actionStage])}</button>`:''}</div>`;
    const btn=document.getElementById('home-learning-loop-open'); if(btn)btn.onclick=()=>{ const direct=document.querySelector(`[data-canonical-open="${esc(weekId)}:${esc(actionStage)}"]`); if(direct){direct.click();return;} const legacy=document.querySelector(`[data-open="${Number(weekId)-1}:${STAGES.indexOf(actionStage)}"]`); if(legacy){legacy.click();return;} document.querySelector('[data-page="course"]')?.click(); };
  }
  function boot(){ const s=store(); if(!s){setTimeout(boot,250);return;} render(); s.subscribe(()=>setTimeout(render,0)); new MutationObserver(render).observe(document.body,{childList:true,subtree:true}); }
  if(typeof document!=='undefined'){ if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true}); else boot(); }
})();
