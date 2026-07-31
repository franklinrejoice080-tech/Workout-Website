'use strict';

/**
 * =========================================
 * ASCEND XP PROGRESS SYSTEM & GAMIFICATION
 * =========================================
 * Modular XP, Player Leveling, and Reusable Notification Engine.
 *
 * Persists state under localStorage key (`ascendPlayer`).
 * Connectable with future modules (Achievements, Daily Streak, AI Coach,
 * Workout History, Leaderboards) via clean public functions.
 */

const ASCEND_PLAYER_KEY = 'ascendPlayer';

/**
 * Default initial player state
 */
const DEFAULT_PLAYER = {
  xp: 0,
  level: 1,
  totalWorkouts: 0,
  streak: 0,
  lastWorkoutDate: null
};

// In-memory player state
let player = loadPlayer();

/* =========================================
   PUBLIC API: STORAGE & PLAYER STATE
   ========================================= */

/**
 * Public API: loadPlayer()
 * Loads player data from localStorage. Initializes safely to defaults if empty.
 * Other modules should call this instead of directly accessing localStorage.
 * @returns {Object} Deep copy of player state object
 */
function loadPlayer() {
  try {
    const saved = localStorage.getItem(ASCEND_PLAYER_KEY);
    if (!saved) {
      localStorage.setItem(ASCEND_PLAYER_KEY, JSON.stringify(DEFAULT_PLAYER));
      return { ...DEFAULT_PLAYER };
    }
    const parsed = JSON.parse(saved);
    return {
      xp: Math.max(0, Number(parsed.xp) || 0),
      level: Math.max(1, Number(parsed.level) || 1),
      totalWorkouts: Math.max(0, Number(parsed.totalWorkouts) || 0),
      streak: Math.max(0, Number(parsed.streak) || 0),
      lastWorkoutDate: parsed.lastWorkoutDate || null
    };
  } catch (err) {
    console.warn('[ASCEND XP] Failed to load player state:', err);
    return { ...DEFAULT_PLAYER };
  }
}

/**
 * Public API: savePlayer()
 * Persists current in-memory player state to localStorage.
 */
function savePlayer() {
  try {
    localStorage.setItem(ASCEND_PLAYER_KEY, JSON.stringify(player));
  } catch (err) {
    console.warn('[ASCEND XP] Failed to save player state:', err);
  }
}

/**
 * Public API: getPlayer()
 * Returns a clean, decoupled copy of the active player object.
 * Safe for external modules (AI Coach, Achievements, Leaderboard) to query.
 * @returns {Object} Copy of player state { xp, level, totalWorkouts, streak, lastWorkoutDate }
 */
function getPlayer() {
  return { ...player };
}

/* =========================================
   LEVEL ALGORITHM & XP CALCULATIONS
   ========================================= */

/**
 * Calculates Level integer based on total accumulated XP
 * Level 1: 0 - 299 XP (300 needed)
 * Level 2: 300 - 699 XP (400 needed)
 * Level 3: 700 - 1199 XP (500 needed)
 * Level 4: 1200 - 1799 XP (600 needed)
 * Level 5+: 1800 + (level - 5) * 700 XP
 * @param {number} xp 
 * @returns {number} Level number
 */
function getLevelFromXP(xp) {
  if (xp < 300) return 1;
  if (xp < 700) return 2;
  if (xp < 1200) return 3;
  if (xp < 1800) return 4;
  return 5 + Math.floor((xp - 1800) / 700);
}

/**
 * Gets the total XP threshold required to start a given level
 * @param {number} level 
 * @returns {number} Total XP at start of level
 */
function getCurrentLevelXP(level) {
  if (level <= 1) return 0;
  if (level === 2) return 300;
  if (level === 3) return 700;
  if (level === 4) return 1200;
  return 1800 + ((level - 5) * 700);
}

/**
 * Gets the total XP threshold required to reach the next level
 * @param {number} level 
 * @returns {number} Total XP at start of next level
 */
function getNextLevelXP(level) {
  if (level === 1) return 300;
  if (level === 2) return 700;
  if (level === 3) return 1200;
  if (level === 4) return 1800;
  return 1800 + ((level - 4) * 700);
}

/**
 * Public API: getXPProgress()
 * Calculates detailed metrics for current level progression.
 * @returns {Object} Progress details { currentXP, level, levelStartXP, levelNextXP, progressInLevel, neededForLevel, remainingToNext, percent }
 */
function getXPProgress() {
  const currentXP = player.xp;
  const level = player.level;
  const levelStartXP = getCurrentLevelXP(level);
  const levelNextXP = getNextLevelXP(level);
  const progressInLevel = Math.max(0, currentXP - levelStartXP);
  const neededForLevel = Math.max(1, levelNextXP - levelStartXP);
  const remainingToNext = Math.max(0, levelNextXP - currentXP);
  const percent = Math.min(100, Math.max(0, Math.round((progressInLevel / neededForLevel) * 100)));

  return {
    currentXP,
    level,
    levelStartXP,
    levelNextXP,
    progressInLevel,
    neededForLevel,
    remainingToNext,
    percent
  };
}

/* =========================================
   PUBLIC API: XP MUTATION & WORKOUT ENGINE
   ========================================= */

/**
 * Public API: addXP(amount, source)
 * Awards XP to the player. Automatically handles level-up calculations,
 * triggers UI notifications, updates localStorage, and re-renders progress.
 * @param {number} amount Amount of XP to award (must be > 0)
 * @param {string} [source='Activity'] Action source description for notifications
 * @returns {Object} Result object { xp, level, levelUp: boolean }
 */
function addXP(amount = 0, source = 'Activity Completed') {
  const xpAwarded = Math.max(0, Number(amount) || 0);
  if (xpAwarded <= 0) return { xp: player.xp, level: player.level, levelUp: false };

  const oldLevel = player.level;
  player.xp += xpAwarded;
  player.level = getLevelFromXP(player.xp);
  const levelUp = player.level > oldLevel;

  savePlayer();

  // Show reusable XP notification
  showNotification({
    type: 'xp',
    title: `+${xpAwarded} XP Earned`,
    message: source,
    icon: '⚡'
  });

  // If player leveled up, trigger Level Up notification
  if (levelUp) {
    setTimeout(() => {
      showNotification({
        type: 'levelUp',
        title: `LEVEL UP! Level ${player.level}`,
        message: 'Congratulations! You reached a new rank on ASCEND.',
        icon: '👑',
        duration: 4000
      });
    }, 600);
  }

  renderXP(true);

  return {
    xp: player.xp,
    level: player.level,
    levelUp
  };
}

/**
 * Public API: completeWorkout(amount)
 * Called when a workout session finishes. Awards XP, increments workout count,
 * and updates persistent storage.
 * @param {number} [amount=120] XP reward amount for completing a workout
 * @returns {Object} Updated player state
 */
function completeWorkout(amount = 120) {
  player.totalWorkouts += 1;
  savePlayer();
  return addXP(amount, 'Workout Completed');
}

/* =========================================
   REUSABLE NOTIFICATION SYSTEM
   ========================================= */

/**
 * Public API: showNotification({ type, title, message, icon, duration })
 * Reusable UI Toast Notification component used for +XP, Level Up, Achievements,
 * Streak Increments, and Challenge Completions.
 * @param {Object} options Notification options
 */
function showNotification({
  type = 'info',
  title = 'ASCEND Update',
  message = '',
  icon = '✨',
  duration = 3200
} = {}) {
  let container = document.getElementById('ascendNotificationContainer');
  if (!container) {
    container = document.createElement('div');
    container.id = 'ascendNotificationContainer';
    container.className = 'ascend-notification-container';
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  toast.className = `ascend-toast type-${type}`;
  toast.innerHTML = `
    <div class="ascend-toast-icon">${icon}</div>
    <div class="ascend-toast-body">
      <div class="ascend-toast-title">${title}</div>
      ${message ? `<div class="ascend-toast-msg">${message}</div>` : ''}
    </div>
  `;

  container.appendChild(toast);

  // Auto remove after duration
  setTimeout(() => {
    toast.classList.add('toast-out');
    toast.addEventListener('animationend', () => toast.remove(), { once: true });
  }, duration);
}

/* =========================================
   UI RENDERING & NUMERIC ANIMATION
   ========================================= */

/**
 * Animates a DOM element's text content from start to end value smoothly
 * @param {HTMLElement} el 
 * @param {number} startVal 
 * @param {number} endVal 
 * @param {string} suffix 
 * @param {number} duration 
 */
function animateNumber(el, startVal, endVal, suffix = '', duration = 800) {
  if (!el) return;
  if (startVal === endVal) {
    el.textContent = endVal.toLocaleString() + suffix;
    return;
  }

  const startTime = performance.now();
  const diff = endVal - startVal;

  function step(currentTime) {
    const elapsed = currentTime - startTime;
    const progress = Math.min(elapsed / duration, 1);
    const easeProgress = 1 - Math.pow(1 - progress, 3);
    const currentVal = Math.round(startVal + diff * easeProgress);

    el.textContent = currentVal.toLocaleString() + suffix;

    if (progress < 1) {
      requestAnimationFrame(step);
    } else {
      el.textContent = endVal.toLocaleString() + suffix;
    }
  }

  requestAnimationFrame(step);
}

/**
 * Public API: renderXP(animate)
 * Updates the XP progress card UI elements (Level badge, XP totals, fill bar, and remaining XP).
 * @param {boolean} [animate=true] Whether to use smooth count-up and fill bar transitions
 */
function renderXP(animate = true) {
  const p = getXPProgress();

  const elLevelBadge = document.getElementById('xpLevelBadge');
  const elTotalVal = document.getElementById('xpTotalVal');
  const elNextVal = document.getElementById('xpNextVal');
  const elBarFill = document.getElementById('xpBarFill');
  const elNeededText = document.getElementById('xpNeededText');
  const elPercentText = document.getElementById('xpPercentText');

  if (elLevelBadge) elLevelBadge.textContent = `Level ${p.level}`;
  if (elNeededText) elNeededText.textContent = `${p.remainingToNext.toLocaleString()} XP until Level ${p.level + 1}`;

  if (elBarFill) {
    elBarFill.style.width = `${p.percent}%`;
    elBarFill.classList.toggle('pulse', p.percent >= 98);
  }

  if (animate) {
    if (elTotalVal) {
      const cur = parseInt(elTotalVal.textContent.replace(/[^0-9]/g, ''), 10) || 0;
      animateNumber(elTotalVal, cur, p.currentXP, ' XP');
    }
    if (elNextVal) {
      elNextVal.textContent = `${p.progressInLevel.toLocaleString()} / ${p.neededForLevel.toLocaleString()} XP`;
    }
    if (elPercentText) {
      const curPct = parseInt(elPercentText.textContent.replace(/[^0-9]/g, ''), 10) || 0;
      animateNumber(elPercentText, curPct, p.percent, '%');
    }
  } else {
    if (elTotalVal) elTotalVal.textContent = `${p.currentXP.toLocaleString()} XP`;
    if (elNextVal) elNextVal.textContent = `${p.progressInLevel.toLocaleString()} / ${p.neededForLevel.toLocaleString()} XP`;
    if (elPercentText) elPercentText.textContent = `${p.percent}%`;
  }
}

/**
 * Automatically initializes XP module on load
 */
function initXP() {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => renderXP(true));
  } else {
    renderXP(true);
  }
}

initXP();

/* =========================================
   PUBLIC API EXPORT
   ========================================= */

window.ASCEND_XP = {
  getPlayer,
  getXPProgress,
  getXPPROGRESS: getXPProgress, // Backward compatibility alias
  addXP,
  completeWorkout,
  renderXP,
  savePlayer,
  loadPlayer,
  showNotification
};