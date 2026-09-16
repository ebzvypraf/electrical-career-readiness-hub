import assert from 'node:assert/strict';
import { chooseNextBestAction } from '../curriculum/adaptive-action-engine-v1.js';

const catalog = { '1': { title: 'Foundations' } };
const progress = { '1': { learn: true, apply: true, check: true, evidence: false } };

const baseContext = {
  evidence: {
    proofChain: {
      apply: { linked: true },
      check: { linked: true },
      evidence: { captured: false, demonstratedCapability: false }
    }
  }
};

const failedLatest = chooseNextBestAction({
  catalog,
  progressByWeek: progress,
  contextByWeek: {
    '1': {
      ...baseContext,
      assessmentHistory: [
        { completedAt: '2026-09-16T09:00:00Z', passed: true },
        { completedAt: '2026-09-16T10:00:00Z', passed: 'false' }
      ]
    }
  },
  hubSignals: {}
});
assert.equal(failedLatest.nextProofStage, 'check');
assert.equal(failedLatest.latestCheckFailed, true);
assert.equal(failedLatest.label, 'Re-establish Check');

const olderFailureLatestPass = chooseNextBestAction({
  catalog,
  progressByWeek: progress,
  contextByWeek: {
    '1': {
      ...baseContext,
      assessmentHistory: [
        { completedAt: '2026-09-16T10:00:00Z', passed: true },
        { completedAt: '2026-09-16T09:00:00Z', passed: 'false' }
      ]
    }
  },
  hubSignals: {}
});
assert.equal(olderFailureLatestPass.latestCheckFailed, false);
assert.equal(olderFailureLatestPass.nextProofStage, 'evidence');

const serializedPass = chooseNextBestAction({
  catalog,
  progressByWeek: progress,
  contextByWeek: {
    '1': {
      ...baseContext,
      assessmentHistory: [{ completedAt: '2026-09-16T11:00:00Z', passed: 'true' }]
    }
  },
  hubSignals: {}
});
assert.equal(serializedPass.latestCheckFailed, false);
assert.equal(serializedPass.nextProofStage, 'evidence');

console.log('adaptive-action-contract-v1: PASS');
