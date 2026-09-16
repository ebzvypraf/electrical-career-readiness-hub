import assert from 'node:assert/strict';
import {
  STAGES,
  commitStageCompletion,
  buildHubSignals,
  createLearningState
} from '../curriculum/learning-engine-v2.js';

const catalog = {
  '1': {
    title: 'Week 1 — Electrical Documentation Foundations',
    skills: ['Electrical Documentation'],
    integration: {
      journalPrompt: 'Record what changed in your drawing approach.',
      homeAction: 'Complete the Week 1 learning path.',
      portfolioPrompt: 'Capture the reviewed drawing package.'
    }
  },
  '2': {
    title: 'Week 2 — MicroStation Connect Foundations',
    skills: ['MicroStation Connect'],
    integration: {}
  }
};

let progressByWeek = createLearningState(['1', '2']);
let contextByWeek = {};
let journalEntries = [];
let portfolioEntries = [];

const commit = (stage, context = {}) => {
  const result = commitStageCompletion({
    catalog,
    progressByWeek,
    contextByWeek,
    journalEntries,
    portfolioEntries,
    weekId: '1',
    stage,
    context
  });
  assert.equal(result.ok, true, `${stage} should complete`);
  progressByWeek = result.progressByWeek;
  contextByWeek = result.contextByWeek;
  return result;
};

commit('learn', { learnViewedAt: '2026-09-16T12:00:00Z' });
journalEntries = [{
  date: '2026-09-16',
  hours: 1,
  study: 'Week 1 documentation',
  reflection: 'I can now distinguish the drawing purpose from the drafting task.',
  nextAction: 'Apply the documentation workflow to the practice package.',
  weekId: '1',
  stage: 'learn'
}];
commit('apply', {
  applicationEvidence: {
    tasks: ['completed drawing review'],
    deliverable: 'Reviewed electrical drawing package',
    decisions: 'Used a controlled title-block workflow',
    assumptions: 'Practice package uses the canonical template',
    verification: 'Checked sheet consistency before submission'
  }
});
commit('check', {
  assessmentResult: { completionReady: true, passed: true }
});
commit('evidence', {
  evidence: {
    demonstrated: true,
    evidenceQuality: 'high'
  }
});

assert.deepEqual(progressByWeek['1'], {
  learn: true,
  apply: true,
  check: true,
  evidence: true
});

const signals = buildHubSignals(catalog, progressByWeek, contextByWeek, journalEntries, portfolioEntries);
const documentation = signals.demonstratedCapability.find(item => item.skill === 'Electrical Documentation');
assert.ok(documentation, 'completed skill should appear in demonstrated capability');
assert.equal(documentation.coverage.learn, 100);
assert.equal(documentation.coverage.apply, 100);
assert.equal(documentation.coverage.check, 100);
assert.equal(documentation.coverage.evidence, 100);
assert.equal(documentation.journalEntries, undefined, 'public capability contract should remain stable');
assert.equal(documentation.journalCoverage, 50);
assert.equal(documentation.journalReflections, 1);
assert.equal(documentation.journalNextActions, 1);
assert.equal(documentation.evidenceQuality, 100);
assert.equal(signals.overallProgress, 50);
assert.equal(signals.completedStages, 4);
assert.equal(signals.totalStages, 8);

const blocked = commitStageCompletion({
  catalog,
  progressByWeek,
  contextByWeek,
  journalEntries,
  portfolioEntries,
  weekId: '2',
  stage: 'apply',
  context: {
    applicationEvidence: {
      tasks: ['task'],
      deliverable: 'deliverable',
      decisions: 'decision',
      assumptions: 'assumption',
      verification: 'verification'
    }
  }
});
assert.equal(blocked.ok, false);
assert.match(blocked.reason, /locked/i);

assert.deepEqual(STAGES, ['learn', 'apply', 'check', 'evidence']);
console.log('learning-engine-integration-contract-v1: PASS');
