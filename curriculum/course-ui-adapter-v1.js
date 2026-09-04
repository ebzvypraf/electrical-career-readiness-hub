/*
 * Electrical Career Readiness Hub — Course UI adapter v1
 *
 * Presentation adapter for the existing index.html Course surface.
 * It consumes the canonical Learning Engine v2 catalog and exposes small,
 * framework-free functions so the production shell can adopt live curriculum
 * content without duplicating lesson definitions.
 */

import { STAGES, STAGE_LABELS, emptyProgress, stageProgress, nextStage, isStageUnlocked } from './learning-engine-v2.js';

export function stageDescription(week, stage) {
  const integration = week?.integration || {};
  const explicit = integration.stageDescriptions?.[stage];
  if (explicit) return explicit;
  return {
    learn: 'Understand the concept, standards, inputs and senior-level decision points.',
    apply: 'Complete the practical task and record assumptions, decisions and verification.',
    check: 'Test the reasoning and confirm the result meets the required quality bar.',
    evidence: 'Capture a sanitized, reviewable artefact that proves the capability.'
  }[stage] || '';
}

export function buildCourseModel(catalog, progressByWeek = {}) {
  const ids = Object.keys(catalog || {});
  return ids.map(weekId => {
    const week = catalog[weekId];
    const progress = { ...emptyProgress(), ...(progressByWeek[weekId] || {}) };
    return {
      weekId,
      weekNumber: week.week ?? Number(weekId),
      title: week.title,
      phase: week.phase || '',
      objective: week.objective || '',
      completed: stageProgress(progress),
      total: STAGES.length,
      progress,
      stages: STAGES.map(stage => ({
        key: stage,
        label: STAGE_LABELS[stage],
        completed: Boolean(progress[stage]),
        unlocked: isStageUnlocked(progressByWeek, weekId, stage),
        description: stageDescription(week, stage)
      }))
    };
  });
}

export function buildCourseState(catalog, progressByWeek = {}) {
  const model = buildCourseModel(catalog, progressByWeek);
  const next = nextStage(progressByWeek, Object.keys(catalog || {}));
  return {
    model,
    next,
    totalStages: model.length * STAGES.length,
    completedStages: model.reduce((n, week) => n + week.completed, 0)
  };
}

export function renderCourseInto(container, courseState, handlers = {}) {
  if (!container) throw new Error('Course container is required');
  const { onOpenStage = () => {} } = handlers;
  container.innerHTML = courseState.model.map(week => `
    <div class="week" data-week-id="${week.weekId}">
      <button class="weekhead" type="button" aria-expanded="false">
        <span class="wno">W${String(week.weekNumber).padStart(2, '0')}</span>
        <span class="phase">${escapeHtml(week.phase)}</span>
        <span class="wtitle">${escapeHtml(week.title)}</span>
        <span class="wcount">${week.completed}/${week.total}</span>
      </button>
      <div class="weekbody">
        ${week.objective ? `<div class="learning-hero"><b>Objective</b><p>${escapeHtml(week.objective)}</p></div>` : ''}
        ${week.stages.map(stage => `
          <div class="stage" data-stage="${stage.key}">
            <div>${stage.completed ? '✓' : stage.key === 'learn' ? '1' : STAGES.indexOf(stage.key) + 1}</div>
            <b>${stage.label}</b>
            <span>${escapeHtml(stage.description)}</span>
            <button class="btn ${stage.completed ? '' : 'primary'}" type="button" data-open-stage="${week.weekId}:${stage.key}" ${stage.unlocked ? '' : 'disabled'}>
              ${stage.completed ? 'Review' : stage.unlocked ? 'Open' : 'Locked'}
            </button>
          </div>
        `).join('')}
      </div>
    </div>
  `).join('');

  container.querySelectorAll('.weekhead').forEach(button => button.addEventListener('click', () => {
    const week = button.parentElement;
    const open = !week.classList.contains('open');
    week.classList.toggle('open', open);
    button.setAttribute('aria-expanded', String(open));
  }));

  container.querySelectorAll('[data-open-stage]').forEach(button => button.addEventListener('click', () => {
    const [weekId, stage] = button.dataset.openStage.split(':');
    onOpenStage(weekId, stage);
  }));

  return container;
}

export function createCourseController({ catalog, getProgress, onOpenStage }) {
  if (!catalog) throw new Error('Catalog is required');
  const progress = () => getProgress?.() || {};
  return {
    getState: () => buildCourseState(catalog, progress()),
    mount: container => renderCourseInto(container, buildCourseState(catalog, progress()), { onOpenStage }),
    refresh: container => renderCourseInto(container, buildCourseState(catalog, progress()), { onOpenStage })
  };
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>\"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '\"': '&quot;', "'": '&#39;' }[char]));
}
