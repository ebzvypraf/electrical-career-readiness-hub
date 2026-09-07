/* Electrical Career Readiness Hub — Assessment Feedback Engine v1. */
import './assessment-feedback-ui-v1.js';
import './assessment-priority-ui-v1.js';
import './remediation-ui-v1.js';
import './journal-portfolio-signals-ui-v1.js';
import './evidence-impact-ui-v1.js';
import './skill-gap-action-ui-v1.js';
export const ASSESSMENT_FEEDBACK_VERSION = '1.1.0';

function clean(value) { return String(value ?? '').trim(); }

function buildApplicationContext(applicationEvidence = {}) {
  const tasks = Array.isArray(applicationEvidence?.tasks) ? applicationEvidence.tasks : [];
  const completedTasks = tasks.filter(task => task?.complete === true || task?.completed === true).length;
  const totalTasks = tasks.length;
  return {
    available: Boolean(applicationEvidence && (totalTasks || applicationEvidence.deliverable || applicationEvidence.decisions || applicationEvidence.assumptions || applicationEvidence.verification)),
    tasksComplete: totalTasks > 0 ? completedTasks === totalTasks : Boolean(applicationEvidence?.tasksComplete),
    completedTasks,
    totalTasks,
    deliverableCaptured: Boolean(clean(applicationEvidence?.deliverable)),
    decisionsCaptured: Boolean(clean(applicationEvidence?.decisions)),
    assumptionsCaptured: Boolean(clean(applicationEvidence?.assumptions)),
    verificationCaptured: Boolean(clean(applicationEvidence?.verification))
  };
}

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
  const applicationContext = buildApplicationContext(result?.applicationEvidence || result?.context?.applicationEvidence || {});
  const applicationPrompt = applicationContext.available
    ? (applicationContext.tasksComplete && applicationContext.deliverableCaptured && applicationContext.decisionsCaptured && applicationContext.assumptionsCaptured && applicationContext.verificationCaptured
      ? 'Apply record is complete. Use the Check to verify whether the documented practical decisions hold up under technical questioning.'
      : 'Apply record is present but incomplete. Revisit the missing practical details before treating Check success as strong applied understanding.')
    : 'No structured Apply record was supplied to the Check context.';
  return { engineVersion: ASSESSMENT_FEEDBACK_VERSION, status: failed.length ? 'reinforce' : (results.length ? 'ready' : 'not-assessed'), failedCount: failed.length, passedCount: results.filter(item => item.correct).length, reinforcement, priorityConcepts: [...new Set(reinforcement.flatMap(item => item.concepts))], applicationContext, applicationPrompt };
}

export function shouldReinforce(result = {}) { return Boolean(result?.completionReady !== true || result?.passed !== true); }

if (typeof window !== 'undefined') window.ECRHAssessmentFeedback = { buildAssessmentFeedback, shouldReinforce };
