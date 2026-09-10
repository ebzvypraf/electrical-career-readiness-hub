import assert from 'node:assert/strict';
import { canCompleteStage, applyStageCompletion } from '../curriculum/learning-engine-v2.js';
import { chooseNextBestAction } from '../curriculum/adaptive-action-engine-v1.js';

const empty = () => ({ learn: false, apply: false, check: false, evidence: false });
const completeApply = {
  tasks: [true, true],
  deliverable: 'Sanitized drawing package',
  decisions: 'Recorded design decisions',
  assumptions: 'Recorded assumptions and interfaces',
  verification: 'Defined QA verification'
};

assert.equal(
  canCompleteStage('evidence', { evidence: { title: 'Draft', description: 'Draft only' } }),
  false,
  'draft Evidence must never satisfy the canonical gate'
);
assert.equal(
  canCompleteStage('evidence', { evidence: { demonstrated: true } }),
  true,
  'demonstrated Evidence must satisfy the canonical gate'
);

let progress = { '1': empty() };
progress['1'].learn = true;
const applied = applyStageCompletion(progress, '1', 'apply', { applicationEvidence: completeApply });
assert.equal(applied.ok, true);
progress = { '1': applied.progress };
const checked = applyStageCompletion(progress, '1', 'check', {
  assessmentResult: { completionReady: true, passed: true }
});
assert.equal(checked.ok, true);
progress = { '1': checked.progress };
assert.equal(progress['1'].check, true);
assert.equal(canCompleteStage('evidence', { evidence: { demonstrated: false } }), false);

const action = chooseNextBestAction({
  catalog: { '1': { title: 'Foundations' } },
  progressByWeek: { '1': progress['1'] },
  contextByWeek: {
    '1': {
      evidence: {
        proofChain: {
          apply: { linked: true },
          check: { linked: true },
          evidence: { captured: true, demonstratedCapability: true }
        }
      }
    }
  },
  hubSignals: {
    nextBestAction: { weekId: '1', stage: 'evidence', label: 'Evidence' }
  }
});

assert.equal(action.proofProgress, '4/4');
assert.equal(action.proofStatus, 'demonstrated');
assert.equal(action.nextProofStage, null);
assert.equal(action.nextProofLabel, 'Complete');

console.log('proof-chain-contract-v1: PASS');
