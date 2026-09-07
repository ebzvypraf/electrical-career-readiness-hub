/* Electrical Career Readiness Hub — Apply → Journal bridge v1. */
export const APPLY_JOURNAL_BRIDGE_VERSION = '1.0.0';

export function buildApplyJournalEntry({ weekId, module = {}, evidence = {}, timestamp = new Date().toISOString() } = {}) {
  const id = `apply-${String(weekId)}-${String(timestamp).replace(/[^0-9A-Za-z_-]/g, '')}`;
  const title = module.title || `Week ${weekId} application`;
  const taskCount = Array.isArray(evidence.tasks) ? evidence.tasks.length : 0;
  const completedTasks = Array.isArray(evidence.tasks) ? evidence.tasks.filter(Boolean).length : 0;
  return {
    id,
    date: String(timestamp).slice(0, 10),
    hours: 0,
    study: `Applied: ${title}.`,
    learn: `Completed ${completedTasks}/${taskCount || 'all'} practical Apply tasks and produced a reviewable deliverable.`,
    hard: '',
    next: 'Review the application outcome against the Check criteria, then capture Evidence.',
    reflection: String(evidence.notes || '').trim() || `Application record captured for ${title}.`,
    nextAction: 'Review the application outcome against the Check criteria, then capture Evidence.',
    weekId: String(weekId),
    stage: 'apply',
    source: 'apply-completion',
    deliverable: String(evidence.deliverable || '').trim(),
    decisions: String(evidence.decisions || '').trim(),
    assumptions: String(evidence.assumptions || '').trim(),
    verification: String(evidence.verification || '').trim()
  };
}

export function isApplyJournalEntry(entry, weekId) {
  return entry?.source === 'apply-completion' && String(entry?.weekId) === String(weekId);
}
