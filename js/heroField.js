'use strict';

/**
 * =========================================
 * ASCEND HERO — PROGRESS FIELD
 * =========================================
 * A premium, subtle interactive "field of progress" behind the hero copy.
 *
 * Adapted from the Anime.js "shared cursor-driven offset, clamped to the
 * container, with staggered easing" concept using ONLY native JS/CSS
 * (Anime.js is NOT installed in this project, so no dependency was added).
 *
 * - ~22 nodes in a deterministic radial formation (center core, 3 trait cores,
 *   mid ring, outer ring).
 * - The cursor disturbs the field: a global parallax offset plus a per-node
 *   proximity push, eased per-node with a fixed stagger so nearby circles
 *   respond more strongly while the field returns home when the cursor leaves.
 * - Consumes EXISTING ASCEND progression data (XP / level / streak / workouts /
 *   achievements) to shape the field. It NEVER creates or stores its own
 *   progression state.
 * - Purely decorative: aria-hidden, pointer-events:none, respects
 *   prefers-reduced-motion, and degrades to a gentle CSS drift on touch devices.
 *
 * Public API: window.ASCEND_HERO_FIELD = { init, refresh, destroy }
 */

(function () {
  // Prevent duplicate module execution (matches existing ASCEND module pattern)
  if (window.ASCEND_HERO_FIELD_INITIALIZED) return;
  window.ASCEND_HERO_FIELD_INITIALIZED = true;

  /* ---------- configuration ---------- */
  const TRAITS = [
    { trait: 'STRENGTH', tint: 'tint-red' },
    { trait: 'CONSISTENCY', tint: 'tint-beige' },
    { trait: 'MOMENTUM', tint: 'tint-emerald' }
  ];
  const MID_COUNT = 6;
  const OUTER_COUNT = 12;
  const CORE_RADIUS = 0.13;   // trait ring radius (fraction of field size)
  const MID_RADIUS = 0.24;
  const OUTER_RADIUS = 0.42;
  const PARALLAX = 0.055;     // global cursor offset scale
  const PUSH_RADIUS = 340;    // proximity radius (px) for per-node disturbance
  const PUSH_FORCE = 26;      // max proximity push (px)
  const NEAR_LABEL_DIST = 120; // distance (px) at which a trait label emerges
  const EASE_BASE = 0.12;     // lerp factor, staggered per node via `lag`

  /* ---------- state ---------- */
  let heroEl = null;
  let fieldEl = null;
  let nodes = [];            // { el, bx, by, dx, dy, depth, lag, role, traitIndex }
  let bounds = null;
  let fieldCenter = { x: 0, y: 0 };
  let rafId = 0;
  let loopActive = false;
  let cursor = { x: 0, y: 0, active: false };
  let cursorTarget = { x: 0, y: 0 };
  let reducedMotion = false;
  let interactive = false;
  let currentExpansion = 0;
  let lastBuildSize = 0;
  let lastData = null;
  let state = 'idle';        // idle | active | destroyed
  let resizeRaf = 0;

  const motionQuery = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
  const hoverQuery = window.matchMedia ? window.matchMedia('(hover: hover) and (pointer: fine)') : null;

  /* ---------- read existing ASCEND progression data ---------- */
  function readProgress() {
    let player = null;
    let stats = null;
    let unlocked = [];

    try {
      if (window.ASCEND_XP && typeof window.ASCEND_XP.getPlayer === 'function') {
        player = window.ASCEND_XP.getPlayer();
      }
    } catch (err) { /* decorative — ignore */ }

    try {
      if (window.ASCEND_DASHBOARD && typeof window.ASCEND_DASHBOARD.getStats === 'function') {
        stats = window.ASCEND_DASHBOARD.getStats();
      }
    } catch (err) { /* ignore */ }

    try {
      if (window.ASCEND_ACHIEVEMENTS && typeof window.ASCEND_ACHIEVEMENTS.getUnlocked === 'function') {
        const list = window.ASCEND_ACHIEVEMENTS.getUnlocked();
        if (Array.isArray(list)) unlocked = list;
      }
    } catch (err) { /* ignore */ }

    let xpPercent = 0;
    try {
      if (window.ASCEND_XP && typeof window.ASCEND_XP.getXPProgress === 'function') {
        const p = window.ASCEND_XP.getXPProgress();
        if (p && typeof p.percent === 'number') xpPercent = p.percent;
      }
    } catch (err) { /* ignore */ }

    return {
      level: player && typeof player.level === 'number' ? player.level : 1,
      streak: stats && typeof stats.currentStreak === 'number' ? stats.currentStreak : 0,
      workouts: stats && typeof stats.totalWorkouts === 'number' ? stats.totalWorkouts : 0,
      unlockedCount: unlocked.length,
      xpPercent
    };
  }

  /* ---------- node building (deterministic radial formation) ---------- */
  function addNode(bx, by, size, depth, role, traitIndex) {
    const el = document.createElement('div');
    el.className = 'hero-node';

    if (role === 'center') el.classList.add('tint-red');
    if (role === 'trait') el.classList.add('trait', TRAITS[traitIndex].tint);
    if (role === 'mid' || role === 'outer') el.classList.add(role);

    el.style.width = size + 'px';
    el.style.height = size + 'px';
    el.style.transform = 'translate3d(' + bx.toFixed(2) + 'px,' + by.toFixed(2) + 'px,0)';

    if (role === 'trait') {
      const label = document.createElement('span');
      label.className = 'hero-label';
      label.textContent = TRAITS[traitIndex].trait;
      el.appendChild(label);
    }

    fieldEl.appendChild(el);

    const idx = nodes.length;
    nodes.push({
      el,
      bx,
      by,
      dx: 0,
      dy: 0,
      depth,
      lag: 0.55 + (((idx * 37) % 10) / 10) * 0.45, // deterministic stagger 0.55–1.0
      role,
      traitIndex
    });
  }

  function buildField(expansion) {
    if (!fieldEl) return;

    // remove previous nodes (ring divs are kept)
    nodes.forEach((n) => n.el.remove());
    nodes = [];

    const size = fieldEl.clientWidth || 420;
    lastBuildSize = size;

    // center core node — the ASCEND core
    addNode(0, 0, 18, 1, 'center', undefined);

    // three trait core nodes on a small ring
    TRAITS.forEach((t, i) => {
      const angle = -Math.PI / 2 + (i * 2 * Math.PI) / TRAITS.length;
      const r = CORE_RADIUS * size * expansion;
      addNode(Math.cos(angle) * r, Math.sin(angle) * r, 11, 0.62, 'trait', i);
    });

    // mid ring
    for (let i = 0; i < MID_COUNT; i++) {
      const p = polar(i, MID_COUNT, MID_RADIUS * expansion, size);
      addNode(p.x, p.y, 7, 0.8, 'mid', undefined);
    }

    // outer ring
    for (let i = 0; i < OUTER_COUNT; i++) {
      const p = polar(i, OUTER_COUNT, OUTER_RADIUS * expansion, size);
      addNode(p.x, p.y, 5, 1, 'outer', undefined);
    }
  }

  function polar(i, count, radiusFrac, size) {
    const angle = (i / count) * Math.PI * 2 - Math.PI / 2 + ((i % 5) - 2) * 0.04;
    const r = radiusFrac * size;
    return { x: Math.cos(angle) * r, y: Math.sin(angle) * r };
  }

  /* ---------- data → field signals (existing progression only) ---------- */
  function applyProgress(data) {
    if (!fieldEl) return;

    // XP progress within the current level → field brightness
    const glow = 0.28 + (Math.max(0, Math.min(100, data.xpPercent)) / 100) * 0.72;
    fieldEl.style.setProperty('--glow', glow.toFixed(2));

    const ringNodes = nodes.filter((n) => n.role === 'mid' || n.role === 'outer');

    // Workouts → solid nodes (outer/mid ring fill in as you train)
    const doneCount = Math.min(data.workouts, ringNodes.length);
    ringNodes.forEach((n, i) => n.el.classList.toggle('is-done', i < doneCount));

    // Streak → glowing "active" nodes (baseline 3, +1 per streak day)
    const activeCount = Math.min(3 + data.streak, ringNodes.length);
    ringNodes.forEach((n, i) => n.el.classList.toggle('is-active', i < activeCount));

    // Achievements → trait nodes gain an emerald halo at thresholds
    const thresholds = [1, 4, 8];
    nodes.forEach((n) => {
      if (n.role === 'trait' && n.traitIndex !== undefined) {
        n.el.classList.toggle('is-achieved', data.unlockedCount >= thresholds[n.traitIndex]);
      }
    });
  }

  /* ---------- refresh ---------- */
  function refresh() {
    if (state !== 'active') return;

    const data = readProgress();
    const expansion = 1 + Math.min(Math.max(data.level - 1, 0), 9) * 0.02;

    // Level up → field becomes slightly more expansive (rebuild positions)
    if (Math.abs(expansion - currentExpansion) > 0.001) {
      currentExpansion = expansion;
      buildField(expansion);
    }

    lastData = data;
    applyProgress(data);
  }

  /* ---------- cursor interaction ---------- */
  function onMouseMove(e) {
    if (!interactive || reducedMotion) return;
    if (!bounds) refreshBounds();

    const cx = bounds.left + bounds.width / 2;
    const cy = bounds.top + bounds.height / 2;
    const hw = bounds.width / 2;
    const hh = bounds.height / 2;

    cursorTarget.x = Math.max(-hw, Math.min(hw, e.clientX - cx));
    cursorTarget.y = Math.max(-hh, Math.min(hh, e.clientY - cy));
    cursor.x = e.clientX;
    cursor.y = e.clientY;
    cursor.active = true;

    startLoop();
  }

  function onMouseLeave() {
    cursor.active = false;
    cursorTarget.x = 0;
    cursorTarget.y = 0;
    nodes.forEach((n) => n.el.classList.remove('is-near'));
  }

  function frame() {
    const parX = cursorTarget.x * PARALLAX;
    const parY = cursorTarget.y * PARALLAX;
    let anyMoving = false;
    let nearestTrait = null;

    for (const n of nodes) {
      // global parallax — outer/deeper nodes shift more
      let tx = parX * n.depth;
      let ty = parY * n.depth;

      // proximity disturbance — nodes near the cursor are pushed away
      if (cursor.active && fieldCenter) {
        const sx = fieldCenter.x + n.bx;
        const sy = fieldCenter.y + n.by;
        const dx = sx - cursor.x;
        const dy = sy - cursor.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const influence = Math.max(0, 1 - dist / PUSH_RADIUS) * n.depth;
        if (influence > 0) {
          const inv = dist || 1;
          tx += (dx / inv) * PUSH_FORCE * influence;
          ty += (dy / inv) * PUSH_FORCE * influence;
        }
        // only the closest trait node reveals its label
        if (n.role === 'trait' && (!nearestTrait || dist < nearestTrait.dist)) {
          nearestTrait = { node: n, dist };
        }
      }

      // staggered elastic easing toward target
      const k = EASE_BASE * n.lag;
      n.dx += (tx - n.dx) * k;
      n.dy += (ty - n.dy) * k;

      if (Math.abs(n.dx) > 0.05 || Math.abs(n.dy) > 0.05) anyMoving = true;

      n.el.style.transform = 'translate3d(' + (n.bx + n.dx).toFixed(2) + 'px,' + (n.by + n.dy).toFixed(2) + 'px,0)';
    }

    // reveal the label of the nearest trait node (cursor near the field)
    nodes.forEach((n) => {
      if (n.role === 'trait') {
        n.el.classList.toggle('is-near', Boolean(nearestTrait && nearestTrait.node === n && nearestTrait.dist < NEAR_LABEL_DIST));
      }
    });

    if (cursor.active || anyMoving) {
      rafId = requestAnimationFrame(frame);
    } else {
      loopActive = false;
      rafId = 0;
    }
  }

  function startLoop() {
    if (loopActive || reducedMotion || !interactive) return;
    loopActive = true;
    rafId = requestAnimationFrame(frame);
  }

  /* ---------- bounds / capability handling ---------- */
  function refreshBounds() {
    if (!heroEl) return;
    bounds = heroEl.getBoundingClientRect();
    if (fieldEl) {
      const rect = fieldEl.getBoundingClientRect();
      fieldCenter = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    }
  }

  function scheduleBoundsRefresh() {
    if (resizeRaf) return;
    resizeRaf = requestAnimationFrame(() => {
      resizeRaf = 0;
      refreshBounds();
      // keep node offsets proportional when the vmin-sized field changes
      if (fieldEl && Math.abs((fieldEl.clientWidth || 0) - lastBuildSize) > 1) {
        buildField(currentExpansion || 1);
        if (lastData) applyProgress(lastData);
      }
    });
  }

  function syncCapabilities() {
    reducedMotion = motionQuery ? motionQuery.matches : false;
    interactive = hoverQuery ? hoverQuery.matches : false;

    if (reducedMotion || !interactive) {
      // settle the field at rest
      cursor.active = false;
      cursorTarget.x = 0;
      cursorTarget.y = 0;
      if (rafId) cancelAnimationFrame(rafId);
      rafId = 0;
      loopActive = false;
      nodes.forEach((n) => {
        n.dx = 0;
        n.dy = 0;
        n.el.classList.remove('is-near');
        n.el.style.transform = 'translate3d(' + n.bx.toFixed(2) + 'px,' + n.by.toFixed(2) + 'px,0)';
      });
    }
  }

  function onProgressionEvent() {
    refresh();
  }

  function onWindowFocus() {
    refresh();
    refreshBounds();
  }

  /* ---------- lifecycle ---------- */
  function bindEvents() {
    if (!heroEl) return;
    heroEl.addEventListener('mousemove', onMouseMove);
    heroEl.addEventListener('mouseleave', onMouseLeave);
    window.addEventListener('resize', scheduleBoundsRefresh);
    window.addEventListener('scroll', scheduleBoundsRefresh);
    window.addEventListener('focus', onWindowFocus);
    window.addEventListener('ascend:levelUp', onProgressionEvent);
  }

  function unbindEvents() {
    if (!heroEl) return;
    heroEl.removeEventListener('mousemove', onMouseMove);
    heroEl.removeEventListener('mouseleave', onMouseLeave);
    window.removeEventListener('resize', scheduleBoundsRefresh);
    window.removeEventListener('scroll', scheduleBoundsRefresh);
    window.removeEventListener('focus', onWindowFocus);
    window.removeEventListener('ascend:levelUp', onProgressionEvent);
  }

  function init() {
    if (state === 'active') return; // already initialized — never double-init

    heroEl = document.querySelector('.hero');
    fieldEl = document.getElementById('heroField');

    if (!heroEl || !fieldEl) {
      state = 'destroyed';
      return;
    }

    state = 'active';

    syncCapabilities();
    refresh();
    bindEvents();
    refreshBounds();

    if (motionQuery && typeof motionQuery.addEventListener === 'function') {
      motionQuery.addEventListener('change', syncCapabilities);
    }
    if (hoverQuery && typeof hoverQuery.addEventListener === 'function') {
      hoverQuery.addEventListener('change', syncCapabilities);
    }
  }

  function destroy() {
    if (state !== 'active') return;
    state = 'destroyed';

    unbindEvents();
    if (rafId) cancelAnimationFrame(rafId);
    rafId = 0;
    loopActive = false;

    if (fieldEl) {
      nodes.forEach((n) => n.el.remove());
    }
    nodes = [];
    heroEl = null;
    fieldEl = null;
    bounds = null;
    fieldCenter = { x: 0, y: 0 };
    currentExpansion = 0;
    lastBuildSize = 0;
    lastData = null;
  }

  /* ---------- boot ---------- */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  window.addEventListener('load', refreshBounds);

  window.ASCEND_HERO_FIELD = {
    init,
    refresh,
    destroy
  };
})();
