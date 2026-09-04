/* Electrical Career Readiness Hub — Evidence Engine v1
 * Canonical Evidence -> Portfolio -> Skills -> Home/Journal contract.
 * Browser-safe, dependency-free, intentionally non-destructive.
 */
(function (root) {
  'use strict';

  const REQUIRED = ['title', 'description'];
  const STATUS = { DRAFT: 'draft', REVIEW: 'needs-review', DEMONSTRATED: 'demonstrated' };

  function text(value) {
    return String(value == null ? '' : value).trim();
  }

  function normalize(module, input) {
    const evidence = input || {};
    const criteria = Array.isArray(module && module.evidence && module.evidence.criteria)
      ? module.evidence.criteria : [];
    const criterionResults = criteria.map(function (label, index) {
      const id = 'criterion_' + (index + 1);
      return {
        id: id,
        label: text(label),
        satisfied: evidence[id] === true || evidence[id] === 'true'
      };
    });

    const title = text(evidence.title);
    const description = text(evidence.description);
    const reflection = text(evidence.reflection);
    const nextAction = text(evidence.nextAction);
    const allCriteriaSatisfied = criterionResults.length === 0 || criterionResults.every(function (c) { return c.satisfied; });
    const fieldsComplete = REQUIRED.every(function (field) { return text(evidence[field]).length > 0; });
    const demonstrated = fieldsComplete && allCriteriaSatisfied;

    let reviewStatus = text(evidence.reviewStatus);
    if (![STATUS.DRAFT, STATUS.REVIEW, STATUS.DEMONSTRATED].includes(reviewStatus)) {
      reviewStatus = demonstrated ? STATUS.DEMONSTRATED : STATUS.DRAFT;
    }
    if (!demonstrated && reviewStatus === STATUS.DEMONSTRATED) reviewStatus = STATUS.REVIEW;

    const quality = demonstrated ? 'high' : (fieldsComplete ? 'developing' : 'insufficient');

    return {
      week: module && Number(module.week) || null,
      title: title,
      description: description,
      competency: Array.isArray(module && module.skillTargets) ? module.skillTargets.slice() : [],
      reflection: reflection,
      nextAction: nextAction,
      reviewStatus: reviewStatus,
      evidenceQuality: quality,
      criteria: criterionResults,
      fieldsComplete: fieldsComplete,
      allCriteriaSatisfied: allCriteriaSatisfied,
      demonstrated: demonstrated,
      capturedAt: text(evidence.capturedAt) || null
    };
  }

  function canComplete(module, input) {
    return normalize(module, input).demonstrated;
  }

  function buildSignals(module, evidence) {
    const e = normalize(module, evidence);
    return {
      home: {
        week: e.week,
        evidenceReady: e.demonstrated,
        evidenceQuality: e.evidenceQuality
      },
      skills: e.competency.map(function (skill) {
        return {
          skill: skill,
          demonstratedCapability: e.demonstrated,
          evidenceQuality: e.evidenceQuality,
          week: e.week
        };
      }),
      journal: {
        week: e.week,
        reflection: e.reflection,
        nextAction: e.nextAction
      },
      portfolio: {
        week: e.week,
        title: e.title,
        description: e.description,
        competency: e.competency,
        reflection: e.reflection,
        reviewStatus: e.reviewStatus,
        evidenceQuality: e.evidenceQuality,
        capturedAt: e.capturedAt
      }
    };
  }

  const api = { STATUS, normalize, canComplete, buildSignals };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.ECRHEvidence = api;
})(typeof window !== 'undefined' ? window : globalThis);
