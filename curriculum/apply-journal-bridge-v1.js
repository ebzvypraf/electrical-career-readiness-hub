/*
 * Electrical Career Readiness Hub — Apply → Journal bridge v1.1.
 * Generated Apply records now preserve a useful learner-facing reflection prompt
 * while keeping system activity distinct from the learner's own reflection.
 */
export const APPLY_JOURNAL_BRIDGE_VERSION = '1.1.0';

export function buildApplyJournalEntry({ weekId, module = {}, evidence = {}, timestamp = new Date().toISOString() } = {}) {
  const id = `apply-${String(weekId)}-${String(timestamp).replace(/[^0-9A-Za-z_-]/g, '')}`;
  const title = module.title || `Week ${weekId} application`;
  const taskCount = Array.isArray(evidence.tasks) ? evidence.tasks.length : 0;
  const completedTasks = Array.isArray(evidence.tasks) ? evidence.tasks.filter(Boolean).length : 0;
  const notes = String(evidence.notes || '').trim();
  const decisions = String(evidence.decisions || '').trim();
  const assumptions = String(evidence.assumptions || '').trim();
  const verification = String(evidence.verification || '').trim();
  return {
    id,
    date: String(timestamp).slice(0, 10),
    hours: 0,
    study: `Applied: ${title}.`,
    learn: `Completed ${completedTasks}/${taskCount || 'all'} practical Apply tasks and produced a reviewable deliverable.`,
    hard: '',
    next: 'Review the application outcome against the Check criteria, then capture Evidence.',
    reflection: notes || `Application record captured for ${title}. Reflect on what changed in your design reasoning, what assumption mattered most, and what you would verify differently next time.`,
    nextAction: 'Review the application outcome against the Check criteria, then capture Evidence.',
    weekId: String(weekId),
    stage: 'apply',
    source: 'apply-completion',
    deliverable: String(evidence.deliverable || '').trim(),
    decisions,
    assumptions,
    verification,
    reflectionPrompt: 'What changed in your design reasoning, which assumption mattered most, and what would you verify differently next time?'
  };
}

export function isApplyJournalEntry(entry, weekId) {
  return entry?.source === 'apply-completion' && String(entry?.weekId) === String(weekId);
}
