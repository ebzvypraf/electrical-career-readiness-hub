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

const staleEvidenceAfterPassingCheck = chooseNextBestAction({
  catalog,
  progressByWeek: progress,
  contextByWeek: {
    '1': {
      evidence: {
        upstreamChangedAfterEvidence: true,
        invalidationReason: 'new-check-attempt',
        lineage: { lineageId: 'lineage-001' },
        proofChain: {
          apply: { linked: true },
          check: { linked: true },
          evidence: { captured: true, demonstratedCapability: true }
        }
      },
      assessmentHistory: [{ completedAt: '2026-09-16T12:00:00Z', passed: true }]
    }
  },
  hubSignals: {}
});
assert.equal(staleEvidenceAfterPassingCheck.stage, 'evidence');
assert.equal(staleEvidenceAfterPassingCheck.source, 'stale-evidence-recovery');
assert.equal(staleEvidenceAfterPassingCheck.recovery.required, true);
assert.equal(staleEvidenceAfterPassingCheck.recovery.priorLineageId, 'lineage-001');
assert.equal(staleEvidenceAfterPassingCheck.label, 'Recover Evidence');

const staleEvidenceAfterFailedCheck = chooseNextBestAction({
  catalog,
  progressByWeek: progress,
  contextByWeek: {
    '1': {
      evidence: {
        upstreamChangedAfterEvidence: true,
        invalidationReason: 'new-check-attempt',
        proofChain: {
          apply: { linked: true },
          check: { linked: true },
          evidence: { captured: true, demonstratedCapability: true }
        }
      },
      assessmentHistory: [{ completedAt: '2026-09-16T12:00:00Z', passed: 'false' }]
    }
  },
  hubSignals: {}
});
assert.equal(staleEvidenceAfterFailedCheck.stage, 'check');
assert.equal(staleEvidenceAfterFailedCheck.source, 'stale-evidence-recovery');
assert.equal(staleEvidenceAfterFailedCheck.latestCheckFailed, true);

console.log('adaptive-action-contract-v1: PASS');
