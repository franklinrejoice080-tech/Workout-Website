'use strict';

/**
 * =========================================
 * ASCEND ACHIEVEMENT & REWARDS SYSTEM (v1.3)
 * =========================================
 * Configuration-driven achievement engine.
 * Adding an achievement = one object in ACHIEVEMENT_DEFINITIONS.
 * UI, checks, and unlock logic adapt automatically to catalog size.
 *
 * Storage key: ascend_achievements (isolated from Dashboard & XP)
 * Public API: window.ASCEND_ACHIEVEMENTS
 */

const ACHIEVEMENTS_STORAGE_KEY = 'ascend_achievements';
const ACHIEVEMENTS_VERSION = 1;

/** @type {Object|null} */
let achievementState = null;

/** Cache for selective DOM updates */
let lastRenderState = { unlockedCount: -1, progressSignature: '' };

/**
 * Single source of truth for every achievement.
 * To add a future achievement, append one object — no other file changes required.
 *
 * Fields:
 * - id, category, title, description, icon, rarity, rewardXP
 * - metric + target + progressLabel  → threshold achievements
 * - evaluate(ctx)                    → custom logic (must return { current, target, label, met? })
 */
const ACHIEVEMENT_DEFINITIONS = [
  /* ── Workout ── */
  {
    id: 'first-workout',
    category: 'workout',
    title: 'First Workout',
    description: 'Complete your first training session on ASCEND.',
    icon: '🏋',
    rarity: 'common',
    rewardXP: 50,
    metric: 'totalWorkouts',
    target: 1,
    progressLabel: 'Workouts'
  },
  {
    id: 'ten-workouts',
    category: 'workout',
    title: 'Ten Workouts',
    description: 'Log ten completed training sessions.',
    icon: '💪',
    rarity: 'common',
    rewardXP: 100,
    metric: 'totalWorkouts',
    target: 10,
    progressLabel: 'Workouts'
  },
  {
    id: 'twenty-five-workouts',
    category: 'workout',
    title: 'Twenty-Five Workouts',
    description: 'Build real consistency with twenty-five sessions.',
    icon: '🔥',
    rarity: 'rare',
    rewardXP: 150,
    metric: 'totalWorkouts',
    target: 25,
    progressLabel: 'Workouts'
  },
  {
    id: 'fifty-workouts',
    category: 'workout',
    title: 'Fifty Workouts',
    description: 'Half a hundred sessions — serious dedication.',
    icon: '⚡',
    rarity: 'epic',
    rewardXP: 250,
    metric: 'totalWorkouts',
    target: 50,
    progressLabel: 'Workouts'
  },
  {
    id: 'hundred-workouts',
    category: 'workout',
    title: 'Century Club',
    description: 'Reach one hundred completed workouts.',
    icon: '👑',
    rarity: 'legendary',
    rewardXP: 500,
    metric: 'totalWorkouts',
    target: 100,
    progressLabel: 'Workouts'
  },

  /* ── XP / Level ── */
  {
    id: 'reach-level-2',
    category: 'xp',
    title: 'Level 2',
    description: 'Reach player Level 2.',
    icon: '⬆',
    rarity: 'common',
    rewardXP: 75,
    metric: 'level',
    target: 2,
    progressLabel: 'Level'
  },
  {
    id: 'reach-level-3',
    category: 'xp',
    title: 'Level 3',
    description: 'Climb to Level 3 and keep ascending.',
    icon: '📈',
    rarity: 'common',
    rewardXP: 100,
    metric: 'level',
    target: 3,
    progressLabel: 'Level'
  },
  {
    id: 'reach-level-5',
    category: 'xp',
    title: 'Level 5',
    description: 'Reach Level 5 — a rising athlete.',
    icon: '🎯',
    rarity: 'rare',
    rewardXP: 200,
    metric: 'level',
    target: 5,
    progressLabel: 'Level'
  },
  {
    id: 'reach-level-7',
    category: 'xp',
    title: 'Level 7',
    description: 'Break through to Level 7.',
    icon: '🏆',
    rarity: 'epic',
    rewardXP: 300,
    metric: 'level',
    target: 7,
    progressLabel: 'Level'
  },
  {
    id: 'reach-level-10',
    category: 'xp',
    title: 'Level 10',
    description: 'Reach the elite Level 10 rank.',
    icon: '🌟',
    rarity: 'legendary',
    rewardXP: 500,
    metric: 'level',
    target: 10,
    progressLabel: 'Level'
  },

  /* ── Streak ── */
  {
    id: 'streak-3',
    category: 'streak',
    title: '3-Day Streak',
    description: 'Train three days in a row.',
    icon: '🔥',
    rarity: 'common',
    rewardXP: 50,
    metric: 'currentStreak',
    target: 3,
    progressLabel: 'Days'
  },
  {
    id: 'streak-7',
    category: 'streak',
    title: '7-Day Streak',
    description: 'One full week of daily training.',
    icon: '⚡',
    rarity: 'rare',
    rewardXP: 100,
    metric: 'currentStreak',
    target: 7,
    progressLabel: 'Days'
  },
  {
    id: 'streak-14',
    category: 'streak',
    title: '14-Day Streak',
    description: 'Two weeks of unbroken consistency.',
    icon: '🏆',
    rarity: 'epic',
    rewardXP: 200,
    metric: 'currentStreak',
    target: 14,
    progressLabel: 'Days'
  },
  {
    id: 'streak-30',
    category: 'streak',
    title: '30-Day Streak',
    description: 'A full month of daily discipline.',
    icon: '👑',
    rarity: 'legendary',
    rewardXP: 300,
    metric: 'currentStreak',
    target: 30,
    progressLabel: 'Days'
  },

  /* ── Calories ── */
  {
    id: 'burn-500',
    category: 'calories',
    title: '500 Calories',
    description: 'Burn 500 total calories across all workouts.',
    icon: '🔥',
    rarity: 'common',
    rewardXP: 40,
    metric: 'caloriesBurned',
    target: 500,
    progressLabel: 'Calories'
  },
  {
    id: 'burn-1000',
    category: 'calories',
    title: '1,000 Calories',
    description: 'Burn 1,000 total calories.',
    icon: '💥',
    rarity: 'common',
    rewardXP: 50,
    metric: 'caloriesBurned',
    target: 1000,
    progressLabel: 'Calories'
  },
  {
    id: 'burn-2500',
    category: 'calories',
    title: '2,500 Calories',
    description: 'Burn 2,500 total calories.',
    icon: '⚡',
    rarity: 'rare',
    rewardXP: 125,
    metric: 'caloriesBurned',
    target: 2500,
    progressLabel: 'Calories'
  },
  {
    id: 'burn-5000',
    category: 'calories',
    title: '5,000 Calories',
    description: 'Burn 5,000 total calories.',
    icon: '🏆',
    rarity: 'epic',
    rewardXP: 200,
    metric: 'caloriesBurned',
    target: 5000,
    progressLabel: 'Calories'
  },
  {
    id: 'burn-10000',
    category: 'calories',
    title: '10,000 Calories',
    description: 'Burn 10,000 total calories — furnace mode.',
    icon: '👑',
    rarity: 'legendary',
    rewardXP: 400,
    metric: 'caloriesBurned',
    target: 10000,
    progressLabel: 'Calories'
  },

  /* ── Training Time ── */
  {
    id: 'train-1-hour',
    category: 'training',
    title: '1 Hour Trained',
    description: 'Accumulate one hour of active training.',
    icon: '⏱',
    rarity: 'common',
    rewardXP: 50,
    metric: 'totalMinutes',
    target: 60,
    progressLabel: 'Minutes'
  },
  {
    id: 'train-5-hours',
    category: 'training',
    title: '5 Hours Trained',
    description: 'Five hours of total training time.',
    icon: '🕐',
    rarity: 'common',
    rewardXP: 100,
    metric: 'totalMinutes',
    target: 300,
    progressLabel: 'Minutes'
  },
  {
    id: 'train-10-hours',
    category: 'training',
    title: '10 Hours Trained',
    description: 'Ten hours invested in your ascent.',
    icon: '⏳',
    rarity: 'rare',
    rewardXP: 150,
    metric: 'totalMinutes',
    target: 600,
    progressLabel: 'Minutes'
  },
  {
    id: 'train-25-hours',
    category: 'training',
    title: '25 Hours Trained',
    description: 'Twenty-five hours of focused training.',
    icon: '🏆',
    rarity: 'epic',
    rewardXP: 250,
    metric: 'totalMinutes',
    target: 1500,
    progressLabel: 'Minutes'
  },
  {
    id: 'train-50-hours',
    category: 'training',
    title: '50 Hours Trained',
    description: 'Fifty hours — mastery takes time.',
    icon: '👑',
    rarity: 'legendary',
    rewardXP: 400,
    metric: 'totalMinutes',
    target: 3000,
    progressLabel: 'Minutes'
  },

  /* ── Special ── */
  {
    id: 'early-supporter',
    category: 'special',
    title: 'Early Supporter',
    description: 'Joined ASCEND during the achievement era.',
    icon: '🌱',
    rarity: 'common',
    rewardXP: 25,
    target: 1,
    progressLabel: 'Joined',
    evaluate(ctx) {
      const joined = Boolean(ctx.state.initializedAt);
      return {
        current: joined ? 1 : 0,
        target: 1,
        label: 'Joined',
        met: joined
      };
    }
  },
  {
    id: 'weekend-warrior',
    category: 'special',
    title: 'Weekend Warrior',
    description: 'Complete a workout on Saturday or Sunday.',
    icon: '🌤',
    rarity: 'rare',
    rewardXP: 75,
    target: 1,
    progressLabel: 'Weekend Sessions',
    evaluate(ctx) {
      const date = ctx.completedAt || new Date();
      const day = date.getDay();
      const isWeekend = day === 0 || day === 6;
      const done = isWeekend && ctx.event === 'workoutCompleted';
      const prior = ctx.state.flags?.weekendWarrior ? 1 : 0;
      const current = done ? 1 : prior;
      return {
        current,
        target: 1,
        label: 'Weekend Sessions',
        met: current >= 1
      };
    }
  },
  {
    id: 'morning-momentum',
    category: 'special',
    title: 'Morning Momentum',
    description: 'Complete a workout before 9:00 AM — start strong.',
    icon: '🌅',
    rarity: 'rare',
    rewardXP: 75,
    target: 1,
    progressLabel: 'Morning Sessions',
    evaluate(ctx) {
      const date = ctx.completedAt || new Date();
      const isMorning = date.getHours() < 9;
      const done = isMorning && ctx.event === 'workoutCompleted';
      const prior = ctx.state.flags?.morningMomentum ? 1 : 0;
      const current = done ? 1 : prior;
      return {
        current,
        target: 1,
        label: 'Morning Sessions',
        met: current >= 1
      };
    }
  },
  {
    id: 'weekly-warrior',
    category: 'special',
    title: 'Weekly Warrior',
    description: 'Complete three workouts in the current week.',
    icon: '📅',
    rarity: 'epic',
    rewardXP: 150,
    target: 3,
    progressLabel: 'This Week',
    evaluate(ctx) {
      const count = countWorkoutsThisWeek(ctx.stats.weeklyHistory || {});
      return {
        current: Math.min(count, 3),
        target: 3,
        label: 'This Week',
        met: count >= 3
      };
    }
  },
  {
    id: 'perfect-start',
    category: 'special',
    title: 'Perfect Start',
    description: 'Complete three workouts within your first seven days.',
    icon: '🚀',
    rarity: 'common',
    rewardXP: 50,
    target: 3,
    progressLabel: 'Early Workouts',
    evaluate(ctx) {
      const init = ctx.state.initializedAt ? new Date(ctx.state.initializedAt) : new Date();
      const daysSince = Math.floor((Date.now() - init.getTime()) / (1000 * 60 * 60 * 24));
      const inWindow = daysSince <= 7;
      const workouts = ctx.stats.totalWorkouts || 0;
      const current = inWindow ? Math.min(workouts, 3) : (workouts >= 3 ? 3 : workouts);
      return {
        current,
        target: 3,
        label: 'Early Workouts',
        met: workouts >= 3 && daysSince <= 7
      };
    }
  },
  {
    id: 'consistency-club',
    category: 'special',
    title: 'Consistency Club',
    description: 'Maintain a 10-day streak with at least 15 total workouts.',
    icon: '💎',
    rarity: 'legendary',
    rewardXP: 350,
    target: 100,
    progressLabel: 'Progress',
    evaluate(ctx) {
      const streakPct = Math.min(100, Math.round(((ctx.stats.currentStreak || 0) / 10) * 50));
      const workoutPct = Math.min(100, Math.round(((ctx.stats.totalWorkouts || 0) / 15) * 50));
      const combined = Math.min(100, streakPct + workoutPct);
      const met = (ctx.stats.currentStreak || 0) >= 10 && (ctx.stats.totalWorkouts || 0) >= 15;
      return {
        current: combined,
        target: 100,
        label: 'Progress',
        met,
        displayCurrent: combined,
        displayTarget: 100
      };
    }
  }
];

/* =========================================
   INTERNAL HELPERS
   ========================================= */

function getDefaultState() {
  return {
    version: ACHIEVEMENTS_VERSION,
    initializedAt: new Date().toISOString(),
    unlocked: {},
    flags: {}
  };
}

function loadStateFromStorage() {
  try {
    const raw = localStorage.getItem(ACHIEVEMENTS_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return {
      version: parsed.version || ACHIEVEMENTS_VERSION,
      initializedAt: parsed.initializedAt || new Date().toISOString(),
      unlocked: parsed.unlocked && typeof parsed.unlocked === 'object' ? parsed.unlocked : {},
      flags: parsed.flags && typeof parsed.flags === 'object' ? parsed.flags : {}
    };
  } catch (err) {
    console.warn('[ASCEND Achievements] Failed to load state:', err);
    return null;
  }
}

function saveStateToStorage() {
  try {
    localStorage.setItem(ACHIEVEMENTS_STORAGE_KEY, JSON.stringify(achievementState));
  } catch (err) {
    console.warn('[ASCEND Achievements] Failed to save state:', err);
  }
}

function getDashboardStats() {
  if (window.ASCEND_DASHBOARD && typeof window.ASCEND_DASHBOARD.getStats === 'function') {
    return window.ASCEND_DASHBOARD.getStats();
  }
  return {
    totalWorkouts: 0,
    totalMinutes: 0,
    caloriesBurned: 0,
    currentStreak: 0,
    weeklyHistory: {}
  };
}

function getPlayerStats() {
  if (window.ASCEND_XP && typeof window.ASCEND_XP.getPlayer === 'function') {
    return window.ASCEND_XP.getPlayer();
  }
  return { level: 1, xp: 0 };
}

function countWorkoutsThisWeek(history) {
  const now = new Date();
  const currentDayIndex = (now.getDay() + 6) % 7;
  const monday = new Date(now);
  monday.setDate(now.getDate() - currentDayIndex);
  monday.setHours(0, 0, 0, 0);

  let count = 0;
  for (let i = 0; i < 7; i++) {
    const dayDate = new Date(monday);
    dayDate.setDate(monday.getDate() + i);
    const dateStr = formatDateString(dayDate);
    if (history[dateStr] && history[dateStr].duration > 0) count += 1;
  }
  return count;
}

function formatDateString(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatUnlockDate(isoString) {
  try {
    const d = new Date(isoString);
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  } catch {
    return '';
  }
}

function formatProgressNumber(value) {
  return Number(value).toLocaleString();
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function getMetricValue(metric, stats, player) {
  const map = {
    totalWorkouts: stats.totalWorkouts || 0,
    totalMinutes: stats.totalMinutes || 0,
    caloriesBurned: stats.caloriesBurned || 0,
    currentStreak: stats.currentStreak || 0,
    level: player.level || 1
  };
  return map[metric] ?? 0;
}

function buildEvaluationContext(eventContext = {}) {
  return {
    event: eventContext.event || 'check',
    completedAt: eventContext.completedAt || null,
    stats: getDashboardStats(),
    player: getPlayerStats(),
    state: achievementState,
    helpers: { countWorkoutsThisWeek, formatDateString }
  };
}

/**
 * Computes progress for any achievement definition.
 * @param {Object} def Achievement config object
 * @param {Object} ctx Evaluation context
 * @returns {Object} { current, target, label, percent, met }
 */
function computeProgress(def, ctx) {
  let current;
  let target;
  let label;
  let met;

  if (typeof def.evaluate === 'function') {
    const result = def.evaluate(ctx);
    current = result.displayCurrent !== undefined ? result.displayCurrent : result.current;
    target = result.displayTarget !== undefined ? result.displayTarget : result.target;
    label = result.label || def.progressLabel || 'Progress';
    met = result.met !== undefined ? result.met : current >= target;
  } else {
    current = getMetricValue(def.metric, ctx.stats, ctx.player);
    target = def.target;
    label = def.progressLabel || def.metric;
    met = current >= target;
  }

  target = Math.max(1, target);
  const percent = Math.min(100, Math.max(0, Math.round((current / target) * 100)));

  return { current, target, label, percent, met };
}

function persistSpecialFlags(defId, ctx) {
  if (defId === 'weekend-warrior' && ctx.event === 'workoutCompleted') {
    const date = ctx.completedAt || new Date();
    const day = date.getDay();
    if (day === 0 || day === 6) achievementState.flags.weekendWarrior = true;
  }
  if (defId === 'morning-momentum' && ctx.event === 'workoutCompleted') {
    const date = ctx.completedAt || new Date();
    if (date.getHours() < 9) achievementState.flags.morningMomentum = true;
  }
}

function showAchievementUnlockToast(def) {
  if (window.ASCEND_XP && typeof window.ASCEND_XP.showNotification === 'function') {
    window.ASCEND_XP.showNotification({
      type: 'achievement',
      title: 'Achievement Unlocked',
      message: `${def.title}<br>+${def.rewardXP} XP`,
      icon: def.icon,
      duration: 4200
    });
  }
}

function animateStatNumber(el, startVal, endVal, suffix, duration) {
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
    el.textContent = Math.round(startVal + diff * easeProgress).toLocaleString() + suffix;
    if (progress < 1) requestAnimationFrame(step);
    else el.textContent = endVal.toLocaleString() + suffix;
  }

  requestAnimationFrame(step);
}

/* =========================================
   PUBLIC API
   ========================================= */

/**
 * Public API: initialize()
 * Loads achievement state, sets first-run metadata, runs initial check.
 */
function ensureInitialized() {
  if (achievementState) return;

  const stored = loadStateFromStorage();

  achievementState = stored || getDefaultState();

  if (!stored) {
    saveStateToStorage();
  }
}

function initialize() {
  ensureInitialized();

  checkAchievements({ event: 'initialize' });
  render();
}
/**
 * Public API: getAchievements()
 * Returns all definitions enriched with progress and unlock state.
 * @returns {Array<Object>}
 */
function getAchievements() {
  ensureInitialized();
  const ctx = buildEvaluationContext();
  return ACHIEVEMENT_DEFINITIONS.map((def) => {
    const progress = computeProgress(def, ctx);
    const unlockRecord = achievementState.unlocked[def.id] || null;
    return {
      ...def,
      progress,
      unlocked: Boolean(unlockRecord),
      unlockedAt: unlockRecord ? unlockRecord.unlockedAt : null
    };
  });
}

/**
 * Public API: getUnlocked()
 * @returns {Array<Object>}
 */
function getUnlocked() {
  return getAchievements().filter((a) => a.unlocked);
}

/**
 * Public API: unlock(id)
 * Unlocks an achievement by id. Guarded against duplicates.
 * @param {string} id
 * @returns {Object|null} Unlock record or null if already unlocked / not found
 */
function unlock(id) {
  const def = ACHIEVEMENT_DEFINITIONS.find((d) => d.id === id);
  if (!def || achievementState.unlocked[id]) return null;

  const unlockedAt = new Date().toISOString();
  achievementState.unlocked[id] = { unlockedAt };
  saveStateToStorage();

  showAchievementUnlockToast(def);

  if (window.ASCEND_XP && typeof window.ASCEND_XP.addXP === 'function') {
    window.ASCEND_XP.addXP(def.rewardXP, `Achievement: ${def.title}`, { skipNotification: true });
  }

  return achievementState.unlocked[id];
}

/**
 * Public API: checkAchievements(context)
 * Evaluates all achievements after meaningful events only.
 * @param {Object} [context] { event, completedAt }
 * @returns {Array<string>} Newly unlocked achievement ids
 */
function checkAchievements(context = {}) {
  ensureInitialized();
  
  const ctx = buildEvaluationContext(context);
  const newlyUnlocked = [];

  ACHIEVEMENT_DEFINITIONS.forEach((def) => {
    if (achievementState.unlocked[def.id]) return;

    persistSpecialFlags(def.id, ctx);
    const progress = computeProgress(def, ctx);

    if (progress.met) {
      const record = unlock(def.id);
      if (record) newlyUnlocked.push(def.id);
    }
  });

  if (newlyUnlocked.length) {
    saveStateToStorage();
    render(true);
  }

  return newlyUnlocked;
}

/**
 * Builds a single achievement card from config + runtime state.
 * Rendering is fully data-driven — scales to any catalog size.
 * @param {Object} achievement
 * @returns {string} HTML string
 */
function buildAchievementCardHTML(achievement) {
  const { id, title, description, icon, rarity, category, rewardXP, progress, unlocked, unlockedAt } = achievement;
  const rarityClass = `rarity-${rarity || 'common'}`;
  const stateClass = unlocked ? 'is-unlocked' : 'is-locked';

  const progressText = unlocked
    ? `<span class="ach-progress-text ach-progress-complete">Unlocked · +${rewardXP} XP</span>`
    : `<span class="ach-progress-text">${formatProgressNumber(progress.current)} / ${formatProgressNumber(progress.target)} ${escapeHtml(progress.label)}</span>`;

  const progressBar = unlocked
    ? `<div class="ach-progress-bar"><div class="ach-progress-fill" style="width:100%;"></div></div>`
    : `<div class="ach-progress-bar"><div class="ach-progress-fill" style="width:${progress.percent}%;"></div></div>`;

  const iconMarkup = unlocked
    ? `<div class="ach-icon ach-icon-unlocked">${icon}</div>`
    : `<div class="ach-icon ach-icon-locked"><span class="ach-icon-blur">${icon}</span><span class="ach-icon-mask">?</span></div>`;

  const footer = unlocked && unlockedAt
    ? `<div class="ach-footer"><span class="ach-date">${formatUnlockDate(unlockedAt)}</span><span class="ach-xp-badge">+${rewardXP} XP</span></div>`
    : `<div class="ach-footer ach-footer-locked"><span class="ach-rarity-label">${escapeHtml(rarity)}</span><span class="ach-reward-preview">+${rewardXP} XP</span></div>`;

  return `
    <article class="ach-card ${rarityClass} ${stateClass}" data-achievement-id="${escapeHtml(id)}" data-category="${escapeHtml(category)}">
      <div class="ach-card-glow" aria-hidden="true"></div>
      ${iconMarkup}
      <div class="ach-body">
        <span class="ach-category">${escapeHtml(category)}</span>
        <h4 class="ach-title">${escapeHtml(title)}</h4>
        <p class="ach-desc">${escapeHtml(description)}</p>
        ${progressText}
        ${progressBar}
        ${footer}
      </div>
    </article>
  `;
}

/**
 * Public API: render(force)
 * Updates dashboard stat and achievement grid. Selective updates when possible.
 * @param {boolean} [force=false]
 */
function render(force = false) {
  const all = getAchievements();
  const unlockedCount = all.filter((a) => a.unlocked).length;
  const totalCount = ACHIEVEMENT_DEFINITIONS.length;
  const progressSignature = all.map((a) => `${a.id}:${a.unlocked ? 1 : 0}:${a.progress.percent}`).join('|');

  // Dashboard stat: Achievements Unlocked
  const elStat = document.getElementById('statAchievements');
  const elTotal = document.getElementById('statAchievementsTotal');
  if (elStat && (force || lastRenderState.unlockedCount !== unlockedCount)) {
    const cur = parseInt(elStat.textContent.replace(/[^0-9]/g, ''), 10) || 0;
    animateStatNumber(elStat, cur, unlockedCount, '', 700);
    lastRenderState.unlockedCount = unlockedCount;
  }
  if (elTotal) {
    elTotal.textContent = `of ${totalCount} earned`;
  }

  // Achievement grid — rebuild only when progress/unlock state changes
  const grid = document.getElementById('achievementsGrid');
  if (!grid) return;

  if (!force && progressSignature === lastRenderState.progressSignature) return;
  lastRenderState.progressSignature = progressSignature;

  grid.innerHTML = all.map(buildAchievementCardHTML).join('');
}

/* =========================================
   INIT & EXPORT
   ========================================= */

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initialize);
} else {
  initialize();
}

window.ASCEND_ACHIEVEMENTS = {
  initialize,
  checkAchievements,
  unlock,
  getAchievements,
  getUnlocked,
  render,
  getDefinitions: () => [...ACHIEVEMENT_DEFINITIONS],
  getTotalCount: () => ACHIEVEMENT_DEFINITIONS.length
};
