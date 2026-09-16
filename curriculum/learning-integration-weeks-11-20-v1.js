/*
 * Electrical Career Readiness Hub — downstream learning integration for Weeks 11-20.
 * Keeps integration prompts out of lesson payloads while exposing the same
 * Home → Journal → Portfolio contract used by the final phase of the course.
 */

const INTEGRATION = {
  '11': {
    homeAction: 'Complete the Week 11 earthing and bonding exercise, then identify one design input that must be verified before issue.',
    journalPrompt: 'Reflect on how you separated documented earthing intent from unverified engineering inputs, and record one escalation habit to use in future work.',
    portfolioPrompt: 'Add a sanitized earthing/bonding design exercise showing safety interfaces, assumptions, QA checks and verification boundaries.'
  },
  '12': {
    homeAction: 'Complete the Week 12 multidisciplinary coordination exercise and record the highest-risk interface requiring action.',
    journalPrompt: 'Reflect on one coordination conflict, how you identified ownership, and what you would do earlier to prevent a field issue.',
    portfolioPrompt: 'Add a sanitized coordination register or marked-up plan demonstrating clash identification, ownership, access awareness and traceable actions.'
  },
  '13': {
    homeAction: 'Complete the Week 13 3D coordination exercise and verify that model information remains traceable to controlled drawings and schedules.',
    journalPrompt: 'Reflect on the difference between a 3D visual check and an information/coordination check, and record one model QA habit.',
    portfolioPrompt: 'Add a sanitized OpenBuildings/3D coordination review showing model structure, spatial checking, issues and document traceability.'
  },
  '14': {
    homeAction: 'Complete the Week 14 clash-detection exercise and close at least two representative coordination issues with documented resolutions.',
    journalPrompt: 'Reflect on how you prioritised clashes and distinguished meaningful constructability issues from acceptable conditions.',
    portfolioPrompt: 'Add a sanitized Navisworks clash report or issue register showing prioritisation, ownership, resolution and close-out evidence.'
  },
  '15': {
    homeAction: 'Complete the Week 15 hazardous-area readiness exercise and identify the information that must be confirmed before affected equipment decisions.',
    journalPrompt: 'Reflect on your responsibility boundary for hazardous-area decisions and record how you would escalate missing classification information.',
    portfolioPrompt: 'Add a sanitized hazardous-area interface/hold-point case showing classification dependencies, electrical impacts and escalation boundaries.'
  },
  '16': {
    homeAction: 'Complete the Week 16 switchboard/MCC layout exercise and perform a maintainability and cross-document coordination check.',
    journalPrompt: 'Reflect on how cable entry, access and maintainability changed your layout decisions, and record one QA check you will repeat.',
    portfolioPrompt: 'Add a sanitized switchboard or MCC GA case showing arrangement logic, maintainability constraints, assumptions and document coordination.'
  },
  '17': {
    homeAction: 'Complete the Week 17 control-interface exercise and trace each representative signal from field device to panel/PLC interface.',
    journalPrompt: 'Reflect on one signal/interface discrepancy and how you protected ownership, termination and verification boundaries.',
    portfolioPrompt: 'Add a sanitized I/O or termination mapping case demonstrating signal traceability, interface ownership and discrepancy management.'
  },
  '18': {
    homeAction: 'Complete the Week 18 load and cable-sizing workflow using controlled inputs, explicit assumptions and a documented verification boundary.',
    journalPrompt: 'Reflect on which calculation input most affected the result and how you would handle an uncertain or marginal design input.',
    portfolioPrompt: 'Add a sanitized calculation/design-note case showing traceable inputs, method, assumptions, checks and engineering escalation.'
  },
  '19': {
    homeAction: 'Complete the Week 19 design-check exercise and classify each finding by technical risk, coordination impact or documentation severity.',
    journalPrompt: 'Reflect on the difference between finding an error and writing a comment that helps the designer resolve its underlying cause.',
    portfolioPrompt: 'Add a sanitized design-check register demonstrating structured checking, cross-document traceability, comment quality and closure readiness.'
  },
  '20': {
    homeAction: 'Complete the Week 20 redline exercise and verify that every significant change is incorporated consistently across affected documents.',
    journalPrompt: 'Reflect on one redline that required broader impact assessment and record how you would verify the revision before issue.',
    portfolioPrompt: 'Add a sanitized redline disposition/revision case showing change classification, affected documents, clarification, incorporation and post-update QA.'
  }
};

export function integrationForWeek(weekId) {
  const value = INTEGRATION[String(weekId)];
  return value ? { ...value } : {};
}

export const INTEGRATION_WEEK_IDS = Object.keys(INTEGRATION);
