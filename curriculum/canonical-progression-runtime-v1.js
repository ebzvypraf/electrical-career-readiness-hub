/*
 * Electrical Career Readiness Hub — canonical progression runtime v1.
 *
 * This bridge makes the existing Course buttons commit through the Learning
 * Engine's authoritative Learn → Apply → Check → Evidence transaction while
 * preserving the locked ecrh-v35 local state shape used by the production shell.
 */

import { loadCanonicalCatalog, loadAssessmentCatalog } from './canonical-catalog-v1.js';
import { commitStageCompletion } from './learning-engine-v2.js';
import { canCompleteCheck, scoreQuestionSet } from './assessment-engine-v1.js';

const STATE_KEY = 'ecrh-v35';
const STAGES = ['learn', 'apply', 'check', 'evidence'];
let catalog = null;
let assessments = {};
let originalComplete = null;
let installed = false;

function readState() {
  try { return JSON.parse(localStorage.getItem(STATE_KEY) || 'null') || {}; }
  catch (_) { return {}; }
}

function writeState(state) {
  localStorage.setItem(STATE_KEY, JSON.stringify(state));
  try {
    window.dispatchEvent(new StorageEvent('storage', { key: STATE_KEY, newValue: JSON.stringify(state) }));
  } catch (_) {}
}

function progressFromState(state) {
  const weeks = Array.isArray(state.weeks) ? state.weeks : [];
  const progress = {};
  for (let i = 1; i <= 24; i += 1) progress[String(i)] = { ...(weeks[i - 1] || {}) };
  return progress;
}

function contextForWeek(state, weekIndex) {
  return {
    applicationNotes: String(state.notes?.[weekIndex] || ''),
    assessmentResult: state.checks?.[weekIndex] || null,
    evidence: state.evidence?.[weekIndex] || null
  };
}

function canonicalQuestions(weekNumber) {
  const authored = assessments[String(weekNumber)];
  if (Array.isArray(authored) && authored.length) return authored;
  return Array.isArray(catalog?.[String(weekNumber)]?.check?.questions)
    ? catalog[String(weekNumber)].check.questions
    : [];
}

function scoreCheckForWeek(weekNumber, responses) {
  const questions = canonicalQuestions(weekNumber);
  return scoreQuestionSet(questions, responses);
}

function installComplete() {
  if (installed || !window.ECRH) return;
  installed = true;
  originalComplete = window.ECRH.complete;
  window.ECRH.complete = function canonicalComplete(weekIndex, stageIndex) {
    const weekNumber = Number(weekIndex) + 1;
    const stage = STAGES[Number(stageIndex)];
    if (!catalog?.[String(weekNumber)] || !stage) return originalComplete?.(weekIndex, stageIndex);

    const state = readState();
    const context = contextForWeek(state, weekIndex);
    const result = commitStageCompletion({
      catalog,
      progressByWeek: progressFromState(state),
      weekId: String(weekNumber),
      stage,
      context,
      contextByWeek: Object.fromEntries(Array.from({ length: 24 }, (_, i) => [String(i + 1), contextForWeek(state, i)])),
      journalEntries: Array.isArray(state.journal) ? state.journal : [],
      portfolioEntries: Object.values(state.evidence || {})
    });

    if (!result.ok) {
      alert(result.reason);
      return;
    }

    state.weeks = Array.from({ length: 24 }, (_, i) => ({
      ...(state.weeks?.[i] || {}),
      ...(result.progressByWeek?.[String(i + 1)] || {})
    }));
    writeState(state);
    window.ECRH.close?.();
    window.location.reload();
  };
}

function exposeCheckHelper() {
  window.ECRH.scoreCanonicalCheck = function scoreCanonicalCheck(weekNumber, responses) {
    const result = scoreCheckForWeek(Number(weekNumber), responses || {});
    const state = readState();
    state.checks = state.checks || {};
    state.checks[Number(weekNumber) - 1] = {
      ...result,
      passed: Boolean(canCompleteCheck(result)),
      date: new Date().toISOString()
    };
    writeState(state);
    return result;
  };
}

async function boot() {
  try {
    [catalog, assessments] = await Promise.all([
      loadCanonicalCatalog(),
      loadAssessmentCatalog()
    ]);
    installComplete();
    exposeCheckHelper();
    window.ECRHCanonical = {
      catalog,
      assessments,
      commitStageCompletion,
      scoreCheckForWeek,
      ready: true
    };
  } catch (error) {
    console.warn('Canonical progression runtime unavailable:', error);
  }
}

boot();
