/* Electrical Career Readiness Hub — Assessment Feedback Engine v1. */
import './assessment-feedback-ui-v1.js';
import './assessment-priority-ui-v1.js';
import './remediation-ui-v1.js';
export const ASSESSMENT_FEEDBACK_VERSION = '1.0.0';

function clean(value) { return String(value ?? '').trim(); }

export function buildAssessmentFeedback(questions = [], result = {}) {
  const qs = Array.isArray(questions) ? questions : [];
  const results = Array.isArray(result?.results) ? result.results : [];
  const failed = results.filter(item => !item.correct);
  const byId = new Map(qs.map((q, i) => [clean(q?.id) || `q${i + 1}`, q]));
  const reinforcement = failed.map(item => {
    const q = byId.get(clean(item?.id));
    const concepts = Array.isArray(q?.requiredConcepts) ? q.requiredConcepts.map(clean).filter(Boolean) : [];
    return { questionId: clean(item?.id), prompt: clean(q?.prompt || q?.q), concepts, explanation: clean(q?.answer || q?.why) || 'Review the related learning material, then explain the reasoning in your own words before retrying the check.' };
  });
  return { engineVersion: ASSESSMENT_FEEDBACK_VERSION, status: failed.length ? 'reinforce' : (results.length ? 'ready' : 'not-assessed'), failedCount: failed.length, passedCount: results.filter(item => item.correct).length, reinforcement, priorityConcepts: [...new Set(reinforcement.flatMap(item => item.concepts))] };
}

export function shouldReinforce(result = {}) { return Boolean(result?.completionReady !== true || result?.passed !== true); }

if (typeof window !== 'undefined') window.ECRHAssessmentFeedback = { buildAssessmentFeedback, shouldReinforce };
