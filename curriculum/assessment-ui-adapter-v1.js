/*
 * Electrical Career Readiness Hub — production UI bridge v3.
 * This file remains the existing script entry point in index.html; the real
 * runtime is now the canonical progression module so Course completion,
 * assessments and cross-surface signals share one source of truth.
 */
(function () {
  'use strict';
  import('./canonical-progression-runtime-v1.js').catch(error => {
    console.warn('Canonical progression runtime unavailable:', error);
  });
})();
