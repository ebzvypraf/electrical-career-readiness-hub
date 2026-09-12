/* Electrical Career Readiness Hub — canonical UI entrypoint v12.
 * The production index already loads this adapter. Keep that stable entrypoint,
 * but hand ownership to the canonical 24-week Course runtime and shell bridge.
 */
(async function () {
  'use strict';
  try {
    await import('./canonical-course-runtime-v1.js');
    await import('./canonical-shell-bridge-v1.js');
  } catch (error) {
    console.error('[ECRH canonical UI]', error);
  }
})();
