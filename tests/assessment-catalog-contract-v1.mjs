import fs from 'node:fs';
import path from 'node:path';

const file = path.resolve('curriculum/assessment-bank-v1.json');
const catalog = JSON.parse(fs.readFileSync(file, 'utf8'));

if (!Array.isArray(catalog.weeks) || catalog.weeks.length !== 24) {
  throw new Error(`Expected 24 assessment weeks; found ${catalog.weeks?.length ?? 0}.`);
}

const ids = new Set();
for (const week of catalog.weeks) {
  if (!Number.isInteger(week.week) || week.week < 1 || week.week > 24) {
    throw new Error(`Invalid week number: ${week.week}`);
  }
  if (!Array.isArray(week.questions) || week.questions.length !== 5) {
    throw new Error(`Week ${week.week} must contain exactly 5 authored questions.`);
  }
  for (const question of week.questions) {
    if (!question.id || ids.has(question.id)) {
      throw new Error(`Assessment question id must be present and unique: ${question.id ?? '(missing)'}`);
    }
    ids.add(question.id);
    if (!question.prompt?.trim()) throw new Error(`${question.id}: prompt is required.`);
    if (!Array.isArray(question.options) || question.options.length < 3) {
      throw new Error(`${question.id}: expected at least 3 answer options.`);
    }
    if (!Number.isInteger(question.correctIndex) || question.correctIndex < 0 || question.correctIndex >= question.options.length) {
      throw new Error(`${question.id}: correctIndex is outside the option range.`);
    }
  }
}

console.log(`Assessment contract valid: ${catalog.weeks.length} weeks, ${ids.size} authored questions.`);
