/*
 * Electrical Career Readiness Hub — Assessment Engine v1
 *
 * Purpose: provide one deterministic scoring contract for Learn → Apply → Check → Evidence.
 * This module is intentionally UI-agnostic so Home, Course, Skills, Journal and Portfolio
 * can consume the same assessment result without duplicating scoring rules.
 */

export const ASSESSMENT_ENGINE_VERSION = '1.0.0';

const REQUIRED_CONCEPTS = ['design', 'check', 'verify', 'confirm', 'coordinate', 'input', 'interface', 'assumption', 'standard', 'issue', 'safety', 'compliance', 'trace', 'impact'];

function clean(value) {
  return String(value ?? '').trim();
}

function normalizeQuestion(question, index) {
  const options = Array.isArray(question?.options)
    ? question.options.map(clean).filter(Boolean)
    : [];

  let correctIndex = Number.isInteger(question?.correctIndex) ? question.correctIndex : null;
  if (correctIndex !== null && (correctIndex < 0 || correctIndex >= options.length)) correctIndex = null;

  return {
    id: clean(question?.id) || `q${index + 1}`,
    prompt: clean(question?.prompt || question?.q),
    options,
    correctIndex,
    answer: clean(question?.answer || question?.why),
    requiredConcepts: Array.isArray(question?.requiredConcepts)
      ? question.requiredConcepts.map(clean).filter(Boolean).map(x => x.toLowerCase())
      : []
  };
}

export function normalizeQuestions(questions = []) {
  return Array.isArray(questions) ? questions.map(normalizeQuestion) : [];
}

function textConceptScore(response, question) {
  const text = clean(response).toLowerCase();
  if (!text) return { score: 0, matchedConcepts: [] };

  const concepts = question.requiredConcepts.length
    ? question.requiredConcepts
    : REQUIRED_CONCEPTS.filter(term => question.answer.toLowerCase().includes(term));

  const matchedConcepts = concepts.filter(term => text.includes(term));
  const ratio = concepts.length ? matchedConcepts.length / concepts.length : 0;
  return { score: ratio >= 0.5 ? 1 : 0, matchedConcepts };
}

/**
 * Score a single question.
 *
 * Preferred contract: responses[id] is an option index and question.correctIndex exists.
 * Compatibility contract: responses[id] is free text and the question has an expected answer;
 * in that case the result is a transparent concept-match check, not a claim of human grading.
 */
export function scoreQuestion(question, response) {
  const q = normalizeQuestion(question, 0);

  if (q.correctIndex !== null && q.options.length) {
    const selected = Number(response);
    const answered = Number.isInteger(selected) && selected >= 0 && selected < q.options.length;
    return {
      id: q.id,
      answered,
      correct: answered && selected === q.correctIndex,
      mode: 'choice',
      score: answered && selected === q.correctIndex ? 1 : 0,
      matchedConcepts: []
    };
  }

  const result = textConceptScore(response, q);
  return {
    id: q.id,
    answered: clean(response).length > 0,
    correct: result.score === 1,
    mode: 'self-check',
    score: result.score,
    matchedConcepts: result.matchedConcepts
  };
}

export function scoreQuestionSet(questions = [], responses = {}) {
  const normalized = normalizeQuestions(questions);
  const results = normalized.map(q => scoreQuestion(q, responses[q.id]));
  const total = results.length;
  const score = results.reduce((sum, r) => sum + r.score, 0);
  const passed = total > 0 && score === total;

  return {
    engineVersion: ASSESSMENT_ENGINE_VERSION,
    score,
    total,
    percentage: total ? Math.round((score / total) * 100) : 0,
    passed,
    results,
    completionReady: passed,
    gradingNote: results.some(r => r.mode === 'self-check')
      ? 'Self-check mode uses transparent concept matching; it is not a substitute for human review.'
      : 'Choice mode uses the module-authored correct option.'
  };
}

export function canCompleteCheck(result) {
  return Boolean(result?.completionReady && result?.passed);
}
