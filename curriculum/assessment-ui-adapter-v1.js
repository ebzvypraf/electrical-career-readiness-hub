/*
 * Electrical Career Readiness Hub — Assessment UI Adapter v1
 *
 * Bridges the existing Course modal to the canonical assessment engine without
 * rewriting the locked production entry point. It upgrades authored Week 4–10
 * checks from generic A/B/C prompts to module-specific multiple choice, stores
 * the canonical result in the existing local progress record, and preserves
 * the existing Learn → Apply → Check → Evidence stage gate.
 */
(function () {
  'use strict';

  const CONTENT_URL = '/curriculum/learning-content-v1.json';
  const BANK_URL = '/curriculum/assessment-question-bank-v1.json';
  const STATE_KEY = 'ecrh-v35';
  let bankByWeek = {};
  let assessmentEngine = null;

  const escapeHtml = value => String(value ?? '').replace(/[&<>\"']/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[char]));

  async function load() {
    try {
      const [bank, engine] = await Promise.all([
        fetch(BANK_URL, { cache: 'no-store' }).then(response => {
          if (!response.ok) throw new Error(`Question bank HTTP ${response.status}`);
          return response.json();
        }),
        import('./assessment-engine-v1.js')
      ]);

      (bank.weeks || []).forEach(module => {
        bankByWeek[module.week] = module.questions || [];
      });
      assessmentEngine = engine;
      installObserver();
    } catch (error) {
      console.warn('Assessment UI adapter unavailable:', error);
    }
  }

  function getWeekFromModal() {
    const heading = document.querySelector('#modalCard .k');
    const match = heading && heading.textContent.match(/Week\s+(\d+)/i);
    return match ? Number(match[1]) : null;
  }

  function renderAuthoredChoices() {
    const week = getWeekFromModal();
    const questions = bankByWeek[week];
    if (!week || !questions?.length) return;

    document.querySelectorAll('#modalCard .question').forEach((question, index) => {
      const item = questions[index];
      if (!item) return;
      question.innerHTML = `<b>${index + 1}. ${escapeHtml(item.prompt)}</b>` +
        item.options.map((option, optionIndex) =>
          `<label><input type="radio" name="q${index}" value="${optionIndex}"> ${escapeHtml(option)}</label>`
        ).join('');
    });

    const reasoning = document.querySelector('#modalCard .expected-reasoning');
    if (reasoning) {
      reasoning.textContent = 'Choose the response that best demonstrates the authored senior-level reasoning for this module.';
    }
  }

  function readState() {
    try { return JSON.parse(localStorage.getItem(STATE_KEY) || 'null'); }
    catch (_) { return null; }
  }

  function writeCanonicalResult(week, result) {
    const state = readState();
    if (!state) return;
    state.checks = state.checks || {};
    state.checks[week - 1] = {
      score: result.score,
      total: result.total,
      passed: result.passed,
      percentage: result.percentage,
      engineVersion: result.engineVersion,
      gradingMode: 'choice',
      date: new Date().toISOString()
    };
    localStorage.setItem(STATE_KEY, JSON.stringify(state));
  }

  function showCanonicalResult(result) {
    const existing = document.querySelector('#modalCard .canonical-assessment-result');
    const html = `<div class="result canonical-assessment-result ${result.passed ? '' : 'warn'}">` +
      `<b>Score: ${result.score}/${result.total} (${result.percentage}%)</b> — ` +
      `${result.passed ? 'Pass. Evidence is now available.' : 'Not yet passed. Review the reasoning and try again.'}</div>`;
    if (existing) {
      existing.outerHTML = html;
      return;
    }
    const scoreButton = [...document.querySelectorAll('#modalCard button')]
      .find(button => /score check/i.test(button.textContent));
    if (scoreButton) scoreButton.insertAdjacentHTML('afterend', html);
  }

  function installAssessmentOverride() {
    if (!window.ECRH || !assessmentEngine) {
      setTimeout(installAssessmentOverride, 50);
      return;
    }

    window.ECRH.check = function canonicalCheck(weekIndex) {
      const week = weekIndex + 1;
      const questions = bankByWeek[week] || [];
      if (!questions.length) {
        alert('This module is not yet using the authored assessment bank.');
        return;
      }

      const responses = {};
      questions.forEach((question, index) => {
        const selected = document.querySelector(`input[name="q${index}"]:checked`);
        responses[question.id] = selected ? selected.value : null;
      });

      const result = assessmentEngine.scoreQuestionSet(questions, responses);
      writeCanonicalResult(week, result);
      showCanonicalResult(result);
    };
  }

  function installObserver() {
    installAssessmentOverride();
    const observer = new MutationObserver(() => {
      if (document.querySelector('#modal.show')) renderAuthoredChoices();
    });
    observer.observe(document.body, { childList: true, subtree: true });
    renderAuthoredChoices();
  }

  // Keep CONTENT_URL referenced as an explicit contract for future v2 question
  // hydration; the current bank is intentionally authoritative for Week 4–10.
  void CONTENT_URL;
  load();
})();
