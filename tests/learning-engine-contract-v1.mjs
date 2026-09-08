import assert from 'node:assert/strict';
import {
  STAGES,
  isStageUnlocked,
  canCompleteStage,
  applyStageCompletion,
  mergeLearningProgress
} from '../curriculum/learning-engine-v2.js';
import { canCompleteApply, normalizeApplyEvidence } from '../curriculum/apply-evidence-engine-v1.js';

const empty = () => ({ learn: false, apply: false, check: false, evidence: false });
const completeApply = normalizeApplyEvidence({
  tasks: [true, true],
  deliverable: 'Sanitized drawing package',
  decisions: 'Recorded design decisions',
  assumptions: 'Recorded assumptions and interfaces',
  verification: 'Defined QA verification'
});

assert.deepEqual(STAGES, ['learn', 'apply', 'check', 'evidence']);
assert.equal(canCompleteStage('learn', { learnViewedAt: new Date().toISOString() }), true);
assert.equal(canCompleteStage('learn', {}), false);
assert.equal(canCompleteApply(completeApply), true);
assert.equal(canCompleteStage('apply', { applicationEvidence: completeApply }), true, 'Apply must be completable from the structured Apply record');
assert.equal(canCompleteStage('apply', { applicationNotes: 'legacy note only' }), false, 'Legacy notes alone must not satisfy the structured Apply gate');

let progress = { '1': empty(), '2': empty() };
assert.equal(isStageUnlocked(progress, '1', 'learn'), true);
assert.equal(isStageUnlocked(progress, '1', 'apply'), false);
assert.equal(isStageUnlocked(progress, '2', 'learn'), false);

progress['1'].learn = true;
assert.equal(isStageUnlocked(progress, '1', 'apply'), true);
assert.equal(isStageUnlocked(progress, '1', 'check'), false);

const applyResult = applyStageCompletion(progress, '1', 'apply', { applicationEvidence: completeApply });
assert.equal(applyResult.ok, true);
progress = { ...progress, '1': applyResult.progress };
assert.equal(progress['1'].apply, true);

const checkResult = applyStageCompletion(progress, '1', 'check', {
  assessmentResult: { completionReady: true, passed: true }
});
assert.equal(checkResult.ok, true);
progress = { ...progress, '1': checkResult.progress };
assert.equal(isStageUnlocked(progress, '1', 'evidence'), true);

progress['1'].evidence = true;
assert.equal(isStageUnlocked(progress, '2', 'learn'), true);
assert.equal(isStageUnlocked(progress, '2', 'apply'), false);

const canonical = mergeLearningProgress(progress, { '1': { learn: false } }, ['1', '2']);
assert.equal(canonical['1'].learn, false, 'merge should remain deterministic; caller decides precedence');
console.log('learning-engine-contract-v1: PASS');
