/* Electrical Career Readiness Hub — Skills → learning-action bridge v1.1.
 * Turns each canonical skill recommendation into a direct return path into
 * the existing Course stage without creating a second progression model.
 * v1.1 resolves Skills rows by their stable canonical skill key instead of
 * assuming DOM order matches the canonical skill signal order.
 */
(function () {
  'use strict';

  function esc(value) {
    return String(value == null ? '' : value).replace(/[&<>\"']/g, function (ch) {
      return ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '\"':'&quot;', "'":'&#39;' })[ch];
    });
  }

  function skillKey(value) {
    return String(value == null ? '' : value).trim().toLowerCase();
  }

  function getStore() {
    var api = typeof window !== 'undefined' ? window.ECRHCanonical : null;
    if (!api) return null;
    var store = typeof api.store === 'function' ? api.store() : api.store;
    return store && typeof store.getState === 'function' ? store : null;
  }

  function openRecommended(weekId, stage) {
    var selector = '[data-canonical-open="' + String(weekId) + ':' + String(stage) + '"]';
    var direct = document.querySelector(selector);
    if (direct) { direct.click(); return; }
    var course = document.querySelector('[data-page="course"]');
    if (course) course.click();
    var attempts = 0;
    var timer = setInterval(function () {
      var button = document.querySelector(selector);
      if (button) {
        clearInterval(timer);
        button.click();
      }
      if (++attempts > 20) clearInterval(timer);
    }, 150);
  }

  function render() {
    var host = document.getElementById('skills');
    if (!host) return;
    var store = getStore();
    if (!store) return;
    var skills = store.getState()?.hubSignals?.skills || [];
    host.querySelectorAll('[data-skill-next-action]').forEach(function (node) { node.remove(); });
    Array.from(host.querySelectorAll('.skillrow')).forEach(function (row) {
      var item = skills.find(function (skill) {
        return skillKey(skill?.skill) === String(row.dataset.skillKey || '');
      });
      if (!item || !item.recommendedWeekId || !item.recommendedStage) return;
      var stage = String(item.recommendedStage);
      var label = String(item.recommendedStageLabel || stage);
      var wrap = document.createElement('div');
      wrap.dataset.skillNextAction = '1';
      wrap.style.marginTop = '8px';
      wrap.innerHTML = '<button class="btn" type="button" data-skill-open="1">Open Week ' + esc(item.recommendedWeekId) + ' • ' + esc(label) + '</button>';
      wrap.querySelector('[data-skill-open]').addEventListener('click', function () {
        openRecommended(item.recommendedWeekId, stage);
      });
      row.appendChild(wrap);
    });
  }

  function init() {
    if (typeof document === 'undefined') return;
    var attempts = 0;
    var timer = setInterval(function () {
      var store = getStore();
      if (store) {
        clearInterval(timer);
        render();
        if (store.subscribe) store.subscribe(function () { setTimeout(render, 0); });
      }
      if (++attempts > 60) clearInterval(timer);
    }, 250);
    document.addEventListener('click', function (event) {
      if (event.target?.closest?.('[data-page="skills"]')) setTimeout(render, 0);
    });
  }

  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
    else init();
  }
})();
