import assert from 'node:assert/strict';
import {
  STAGES,
  createLearningState,
  isStageUnlocked,
  nextStage,
  stageProgress,
  totalProgress
} from '../curriculum/learning-engine-v2.js';

const weekIds = Array.from({ length: 24 }, (_, index) => String(index + 1));
let progress = createLearningState(weekIds);

assert.deepEqual(STAGES, ['learn', 'apply', 'check', 'evidence']);
assert.equal(totalProgress(progress), 0);
assert.deepEqual(nextStage(progress, weekIds), { weekId: '1', stage: 'learn' });

for (let weekIndex = 0; weekIndex < weekIds.length; weekIndex += 1) {
  const weekId = weekIds[weekIndex];

  assert.equal(isStageUnlocked(progress, weekId, 'learn'), true);
  assert.equal(isStageUnlocked(progress, weekId, 'apply'), false);
  assert.equal(isStageUnlocked(progress, weekId, 'check'), false);
  assert.equal(isStageUnlocked(progress, weekId, 'evidence'), false);

  progress[weekId].learn = true;
  assert.equal(isStageUnlocked(progress, weekId, 'apply'), true);
  assert.equal(isStageUnlocked(progress, weekId, 'check'), false);

  progress[weekId].apply = true;
  assert.equal(isStageUnlocked(progress, weekId, 'check'), true);
  assert.equal(isStageUnlocked(progress, weekId, 'evidence'), false);

  progress[weekId].check = true;
  assert.equal(isStageUnlocked(progress, weekId, 'evidence'), true);

  progress[weekId].evidence = true;
  assert.equal(stageProgress(progress[weekId]), 4);

  const next = nextStage(progress, weekIds);
  if (weekIndex < weekIds.length - 1) {
    assert.deepEqual(next, { weekId: weekIds[weekIndex + 1], stage: 'learn' });
    assert.equal(isStageUnlocked(progress, weekIds[weekIndex + 1], 'learn'), true);
  } else {
    assert.equal(next, null);
  }
}

assert.equal(totalProgress(progress), 24 * 4);
console.log('24-week-progression-contract-v1: PASS');
