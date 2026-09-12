/* Electrical Career Readiness Hub — verified capability contract v1.1.
 * Single proof-backed read-model for Course, Home, Skills, Journal and Portfolio.
 * Capability is never upgraded from stage flags or a free-form link alone.
 */
function normalizeWeekId(value) {
  const id = String(value ?? '').trim();
  return /^\d+$/.test(id) ? id : '';
}

function assessmentAttemptIdFromLink(checkLink, weekId) {
  const prefix = `check:${weekId}:`;
  if (!String(checkLink || '').startsWith(prefix)) return '';
  return String(checkLink).slice(prefix.length).trim();
}

function hasPassedLinkedCheck(state, weekId, checkLink) {
  const attemptId = assessmentAttemptIdFromLink(checkLink, weekId);
  if (!attemptId) return false;
  const history = Array.isArray(state?.contextByWeek?.[weekId]?.assessmentHistory)
    ? state.contextByWeek[weekId].assessmentHistory
    : [];
  return history.some(attempt => {
    const date = String(attempt?.date || '').replace(/[^0-9A-Za-z_-]/g, '');
    const generatedId = `check-${weekId}-${date}`;
    return generatedId === attemptId && attempt?.passed === true && attempt?.completionReady === true;
  });
}

function evidenceIsVerified(entry, state, catalog) {
  if (!entry || entry.reviewStatus !== 'demonstrated' || entry.upstreamChangedAfterEvidence === true) return false;
  const weekId = normalizeWeekId(entry.week);
  if (!weekId || !catalog?.[weekId]) return false;
  if (entry.linkageComplete !== true) return false;
  if (entry.applyLink !== `apply:${weekId}`) return false;
  if (!hasPassedLinkedCheck(state, weekId, entry.checkLink)) return false;
  const criteria = Array.isArray(entry.criteria) ? entry.criteria : [];
  if (!criteria.length || criteria.some(item => item?.satisfied !== true)) return false;
  return true;
}

export function buildVerifiedCapability({ state = {}, catalog = {} } = {}) {
  const portfolio = Array.isArray(state.portfolioEntries) ? state.portfolioEntries : [];
  const entries = portfolio.filter(entry => evidenceIsVerified(entry, state, catalog));
  const bySkill = new Map();

  entries.forEach(entry => {
    const weekId = normalizeWeekId(entry.week);
    const skills = Array.isArray(catalog?.[weekId]?.skills) ? catalog[weekId].skills : [];
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

  const quality = entries.length
    ? Math.round(entries.reduce((sum, entry) => sum + (entry.evidenceQuality === 'high' ? 100 : (entry.evidenceQuality === 'developing' ? 60 : 0)), 0) / entries.length)
    : 0;

  return {
    entries,
    evidenceCount: entries.length,
    evidenceQuality: quality,
    verifiedWeeks: Array.from(new Set(entries.map(entry => normalizeWeekId(entry.week)))).filter(Boolean).sort((a, b) => Number(a) - Number(b)),
    skills,
    verified: entries.length > 0
  };
}
