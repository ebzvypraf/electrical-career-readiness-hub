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
export const LEARNING_JOURNAL_KEY = 'ecrh-canonical-journal-v1';
export const LEARNING_PORTFOLIO_KEY = 'ecrh-canonical-portfolio-v1';

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

function contextFromLegacyState(state) {
  const weeks = Array.isArray(state?.weeks) ? state.weeks : [];
  const notes = state?.notes || {};
  const checks = state?.checks || {};
  const evidence = state?.evidence || {};
  return Object.fromEntries(weeks.map((_, index) => [String(index + 1), {
    applicationNotes: String(notes[index] || ''),
    assessmentResult: checks[index] ? { ...checks[index], completionReady: Boolean(checks[index].completionReady ?? checks[index].passed) } : null,
    evidence: evidence[index] || null
  }]));
}

function normalizeJournalEntry(entry = {}, index = 0) {
  return {
    id: String(entry.id || `journal-legacy-${entry.date || 'undated'}-${index}`),
    date: String(entry.date || new Date().toISOString().slice(0, 10)),
    hours: Number(entry.hours) || 0,
    study: String(entry.study || '').trim(),
    learn: String(entry.learn || '').trim(),
    hard: String(entry.hard || '').trim(),
    next: String(entry.next || '').trim()
  };
}

function normalizePortfolioEntry(entry = {}, week = null) {
  return {
    id: String(entry.id || `portfolio-week-${week ?? 'unassigned'}`),
    week: week == null ? (entry.week == null ? null : Number(entry.week)) : Number(week),
    title: String(entry.title || '').trim(),
    description: String(entry.description || '').trim(),
    date: String(entry.date || new Date().toISOString())
  };
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
  const savedJournal = readJson(storage, LEARNING_JOURNAL_KEY, null);
  const savedPortfolio = readJson(storage, LEARNING_PORTFOLIO_KEY, null);
  let progressByWeek = mergeLearningProgress(savedProgress, {}, weekIds);
  let contextByWeek = savedContext || {};
  let journals = Array.isArray(savedJournal) ? savedJournal : (Array.isArray(journalEntries) ? journalEntries : []);
  let portfolio = Array.isArray(savedPortfolio) ? savedPortfolio : (Array.isArray(portfolioEntries) ? portfolioEntries : []);
  const listeners = new Set();

  const snapshot = () => buildHubSignals(catalog, progressByWeek, contextByWeek, journals, portfolio);
  const state = () => ({ progressByWeek, contextByWeek, journalEntries: journals, portfolioEntries: portfolio, hubSignals: snapshot() });
  const publish = () => {
    const next = state();
    writeJson(storage, LEARNING_STATE_KEY, progressByWeek);
    writeJson(storage, LEARNING_CONTEXT_KEY, contextByWeek);
    writeJson(storage, LEARNING_JOURNAL_KEY, journals);
    writeJson(storage, LEARNING_PORTFOLIO_KEY, portfolio);
    listeners.forEach(listener => listener(next));
    return next;
  };

  const setWeekContext = (weekId, patch = {}) => {
    const id = String(weekId);
    contextByWeek = {
      ...contextByWeek,
      [id]: { ...(contextByWeek?.[id] || {}), ...patch }
    };
    return publish();
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
    syncLegacyState(legacyState = {}) {
      const incomingWeeks = Array.isArray(legacyState.weeks) ? legacyState.weeks : [];
      progressByWeek = mergeLearningProgress(
        progressByWeek,
        Object.fromEntries(incomingWeeks.map((week, index) => [String(index + 1), week])),
        weekIds
      );

      const incomingContext = contextFromLegacyState(legacyState);
      contextByWeek = { ...contextByWeek, ...incomingContext };

      if (Array.isArray(legacyState.journal)) {
        journals = legacyState.journal.map((entry, index) => normalizeJournalEntry(entry, index));
      }

      if (legacyState.evidence && typeof legacyState.evidence === 'object') {
        const imported = Object.entries(legacyState.evidence)
          .map(([index, entry]) => normalizePortfolioEntry(entry, Number(index) + 1))
          .filter(entry => entry.title && entry.description);
        const byWeek = new Map(portfolio.map(entry => [entry.week == null ? `id:${entry.id}` : `week:${entry.week}`, entry]));
        imported.forEach(entry => byWeek.set(`week:${entry.week}`, entry));
        portfolio = Array.from(byWeek.values());
      }

      return publish();
    },
    updateStageContext(weekId, patch = {}) {
      return { ok: true, state: setWeekContext(weekId, patch) };
    },
    addJournalEntry(entry = {}) {
      const normalized = normalizeJournalEntry(entry);
      if (!normalized.study && !normalized.learn && !normalized.hard && !normalized.next && normalized.hours <= 0) {
        return { ok: false, reason: 'Journal entry is empty' };
      }
      journals = [...journals, normalized];
      return { ok: true, entry: normalized, state: publish() };
    },
    replaceJournalEntries(entries) {
      journals = Array.isArray(entries) ? entries.map(normalizeJournalEntry) : [];
      return publish();
    },
    recordAssessmentResult({ weekId, result = {} } = {}) {
      const id = String(weekId);
      const normalized = {
        score: Number(result.score) || 0,
        total: Number(result.total) || 0,
        passed: Boolean(result.passed),
        completionReady: Boolean(result.completionReady ?? result.passed),
        date: String(result.date || new Date().toISOString()),
        responses: result.responses && typeof result.responses === 'object' ? result.responses : {}
      };
      contextByWeek = {
        ...contextByWeek,
        [id]: { ...(contextByWeek?.[id] || {}), assessmentResult: normalized }
      };
      return { ok: true, result: normalized, state: publish() };
    },
    addPortfolioEntry(entry = {}) {
      const normalized = normalizePortfolioEntry(entry);
      if (!normalized.title || !normalized.description) return { ok: false, reason: 'Portfolio evidence needs a title and description' };
      portfolio = [...portfolio.filter(item => !(normalized.week != null && Number(item?.week) === normalized.week)), normalized];
      return { ok: true, entry: normalized, state: publish() };
    },
    captureEvidence({ weekId, title, description, date } = {}) {
      const id = String(weekId);
      const normalized = normalizePortfolioEntry({ title, description, date }, Number(id));
      if (!normalized.title || !normalized.description) return { ok: false, reason: 'Portfolio evidence needs a title and description' };
      portfolio = [...portfolio.filter(item => Number(item?.week) !== Number(id)), normalized];
      contextByWeek = {
        ...contextByWeek,
        [id]: {
          ...(contextByWeek?.[id] || {}),
          evidence: { title: normalized.title, description: normalized.description, date: normalized.date }
        }
      };
      const result = commitStageCompletion({
        catalog,
        progressByWeek,
        weekId: id,
        stage: 'evidence',
        context: contextByWeek[id],
        contextByWeek,
        journalEntries: journals,
        portfolioEntries: portfolio
      });
      if (!result.ok) return { ...result, state: publish() };
      progressByWeek = result.progressByWeek;
      contextByWeek = result.contextByWeek;
      return { ok: true, entry: normalized, state: publish() };
    },
    replacePortfolioEntries(entries) {
      portfolio = Array.isArray(entries) ? entries.map(entry => normalizePortfolioEntry(entry)) : [];
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
      journals = [];
      portfolio = [];
      return publish();
    }
  };
}
