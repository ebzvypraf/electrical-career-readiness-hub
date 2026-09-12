/* Electrical Career Readiness Hub — verified capability contract v1.
 * Single read-model for proof-backed capability across Course, Home, Skills,
 * Journal and Portfolio. It never upgrades capability from stage flags alone.
 */
export function buildVerifiedCapability({ state = {}, catalog = {} } = {}) {
  const entries = (Array.isArray(state.portfolioEntries) ? state.portfolioEntries : []).filter(entry => {
    if (!entry || entry.reviewStatus !== 'demonstrated' || entry.upstreamChangedAfterEvidence === true) return false;
    const weekId = String(entry.week ?? '');
    const applyValid = entry.linkageValid === true || (entry.linkageComplete === true && entry.applyLink === `apply:${weekId}`);
    const checkValid = entry.linkageValid === true || (entry.linkageComplete === true && entry.checkLink?.startsWith(`check:${weekId}:`) && entry.checkLink.length > `check:${weekId}:`.length);
    return applyValid && checkValid;
  });
  const bySkill = new Map();
  entries.forEach(entry => {
    const weekId = String(entry.week ?? '');
    const skills = Array.isArray(catalog?.[weekId]?.skills)
      ? catalog[weekId].skills
      : (Array.isArray(state.contextByWeek?.[weekId]?.evidence?.competency)
        ? state.contextByWeek[weekId].evidence.competency
        : (Array.isArray(entry.competency) ? entry.competency : []));
    skills.forEach(skill => {
      const key = String(skill).trim();
      if (!key) return;
      const item = bySkill.get(key) || { skill: key, evidenceCount: 0, qualityTotal: 0, weeks: new Set() };
      item.evidenceCount += 1;
      item.qualityTotal += entry.evidenceQuality === 'high' ? 100 : (entry.evidenceQuality === 'developing' ? 60 : 0);
      item.weeks.add(weekId);
      bySkill.set(key, item);
    });
  });
  const skills = Array.from(bySkill.values()).map(item => ({
    skill: item.skill,
    evidenceCount: item.evidenceCount,
    verifiedWeeks: Array.from(item.weeks).sort((a, b) => Number(a) - Number(b)),
    evidenceQuality: Math.round(item.qualityTotal / Math.max(1, item.evidenceCount)),
    verified: item.evidenceCount > 0 && item.qualityTotal / Math.max(1, item.evidenceCount) >= 80
  })).sort((a, b) => b.evidenceCount - a.evidenceCount || b.evidenceQuality - a.evidenceQuality);
  const quality = entries.length ? Math.round(entries.reduce((sum, entry) => sum + (entry.evidenceQuality === 'high' ? 100 : (entry.evidenceQuality === 'developing' ? 60 : 0)), 0) / entries.length) : 0;
  return {
    entries,
    evidenceCount: entries.length,
    evidenceQuality: quality,
    verifiedWeeks: Array.from(new Set(entries.map(entry => String(entry.week ?? '')))).filter(Boolean).sort((a, b) => Number(a) - Number(b)),
    skills,
    verified: entries.length > 0
  };
}
