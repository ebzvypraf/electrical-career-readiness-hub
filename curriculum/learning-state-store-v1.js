/*
 * Electrical Career Readiness Hub — canonical learning state store v1.
 * A framework-free state boundary for Course, Home, Skills, Journal and
 * Portfolio. It persists one canonical learning state and publishes a
 * derived hub snapshot after every accepted progression transaction.
 */
import {
  createLearningState,
  mergeLearningProgress,
  commitStageCompletion,
  buildHubSignals
} from './learning-engine-v2.js';

export const LEARNING_STATE_KEY = 'ecrh-canonical-learning-state-v1';
export const LEARNING_CONTEXT_KEY = 'ecrh-canonical-learning-context-v1';

function readJson(storage, key, fallback) {
  try {
    const raw = storage?.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function writeJson(storage, key, value) {
  try {
    storage?.setItem(key, JSON.stringify(value));
  } catch {
    // Browser storage can be unavailable or full; the in-memory state remains valid.
  }
}

export function createLearningStateStore({
  catalog = {},
  storage = typeof window !== 'undefined' ? window.localStorage : null,
  journalEntries = [],
  portfolioEntries = []
} = {}) {
  const weekIds = Object.keys(catalog || {}).sort((a, b) => Number(a) - Number(b));
  const savedProgress = readJson(storage, LEARNING_STATE_KEY, {});
  const savedContext = readJson(storage, LEARNING_CONTEXT_KEY, {});
  let progressByWeek = mergeLearningProgress(savedProgress, {}, weekIds);
  let contextByWeek = savedContext || {};
  let journals = Array.isArray(journalEntries) ? journalEntries : [];
  let portfolio = Array.isArray(portfolioEntries) ? portfolioEntries : [];
  const listeners = new Set();

  const snapshot = () => buildHubSignals(catalog, progressByWeek, contextByWeek, journals, portfolio);
  const state = () => ({ progressByWeek, contextByWeek, hubSignals: snapshot() });
  const publish = () => {
    const next = state();
    writeJson(storage, LEARNING_STATE_KEY, progressByWeek);
    writeJson(storage, LEARNING_CONTEXT_KEY, contextByWeek);
    listeners.forEach(listener => listener(next));
    return next;
  };

  return {
    getState() { return state(); },
    subscribe(listener) {
      if (typeof listener !== 'function') return () => {};
      listeners.add(listener);
      listener(state());
      return () => listeners.delete(listener);
    },
    replaceProgress(incoming) {
      progressByWeek = mergeLearningProgress(progressByWeek, incoming, weekIds);
      return publish();
    },
    setJournalEntries(entries) {
      journals = Array.isArray(entries) ? entries : [];
      return publish();
    },
    setPortfolioEntries(entries) {
      portfolio = Array.isArray(entries) ? entries : [];
      return publish();
    },
    completeStage({ weekId, stage, context = {} } = {}) {
      const result = commitStageCompletion({
        catalog,
        progressByWeek,
        weekId,
        stage,
        context,
        contextByWeek,
        journalEntries: journals,
        portfolioEntries: portfolio
      });
      if (!result.ok) return result;
      progressByWeek = result.progressByWeek;
      contextByWeek = result.contextByWeek;
      return { ...result, state: publish() };
    },
    resetProgress() {
      progressByWeek = createLearningState(weekIds);
      contextByWeek = {};
      return publish();
    }
  };
}
