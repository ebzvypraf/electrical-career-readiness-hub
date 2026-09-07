/* Electrical Career Readiness Hub — Apply impact engine v1.
 * Converts structured Apply evidence into readiness signals without replacing the canonical engine.
 */
export const APPLY_IMPACT_VERSION = '1.0.0';

export function buildApplyImpact(catalog = {}, contextByWeek = {}, baseSignals = {}) {
  const skills = Array.isArray(baseSignals.skills) ? baseSignals.skills.map(item => ({ ...item })) : [];
  const bySkill = new Map(skills.map(item => [String(item.skill), item]));
  const evidenceBySkill = {};
  Object.entries(catalog || {}).forEach(([weekId, week]) => {
    const apply = contextByWeek?.[String(weekId)]?.applicationEvidence;
    if (!apply?.tasksComplete || !apply?.deliverable || !apply?.decisions || !apply?.assumptions || !apply?.verification) return;
    (week?.skills || []).forEach(skill => {
      const key = String(skill);
      evidenceBySkill[key] = (evidenceBySkill[key] || 0) + 1;
      const item = bySkill.get(key);
      if (item) item.applicationEvidenceWeeks = (item.applicationEvidenceWeeks || 0) + 1;
    });
  });
  skills.forEach(item => {
    const weeks = Math.max(1, Number(item.weeks) || 1);
    const applicationEvidenceWeeks = Number(item.applicationEvidenceWeeks) || 0;
    item.applicationEvidenceWeeks = applicationEvidenceWeeks;
    item.applicationEvidenceCoverage = Math.round((applicationEvidenceWeeks / weeks) * 100);
    // Apply is intentionally capped as an incremental readiness lift: it cannot manufacture
    // readiness without the canonical stage coverage that already feeds this score.
    const base = Number(item.readiness) || 0;
    const lift = Math.min(8, Math.round(item.applicationEvidenceCoverage * 0.08));
    item.readiness = Math.min(100, base + lift);
    item.applyImpact = lift;
  });
  const demonstratedCapability = Array.isArray(baseSignals.demonstratedCapability)
    ? baseSignals.demonstratedCapability.map(item => {
        const enriched = skills.find(skill => String(skill.skill) === String(item.skill));
        return enriched ? { ...item, readiness: enriched.readiness, score: Math.min(5, Math.round(enriched.readiness / 20)), applicationEvidenceWeeks: enriched.applicationEvidenceWeeks, applicationEvidenceCoverage: enriched.applicationEvidenceCoverage, applyImpact: enriched.applyImpact } : item;
      })
    : [];
  const prioritySkillGaps = (Array.isArray(baseSignals.prioritySkillGaps) ? baseSignals.prioritySkillGaps : []).map(gap => {
    const enriched = skills.find(skill => String(skill.skill) === String(gap.skill));
    return enriched ? { ...gap, readiness: enriched.readiness, applicationEvidenceWeeks: enriched.applicationEvidenceWeeks, applicationEvidenceCoverage: enriched.applicationEvidenceCoverage } : gap;
  }).sort((a, b) => a.readiness - b.readiness);
  return { ...baseSignals, skills, demonstratedCapability, prioritySkillGaps, applyImpact: { version: APPLY_IMPACT_VERSION, evidenceBySkill, totalApplicationEvidence: Object.values(evidenceBySkill).reduce((sum, n) => sum + n, 0) } };
}

if (typeof window !== 'undefined') window.ECRHApplyImpact = { APPLY_IMPACT_VERSION, buildApplyImpact };
