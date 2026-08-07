'use strict';

/**
 * =========================================
 * ASCEND DASHBOARD & STREAK ENGINE (Version 1.2)
 * =========================================
 * Premium Apple + Nike style fitness statistics & Daily Streak Engine.
 * Reads from and persists to localStorage (`ascend_dashboard_stats`).
 * Features:
 * - Dynamic 7-day training calendar with duration intensity & desktop hover tooltips
 * - Today's Goal tracker with estimated time and calories
 * - Daily Streak Engine (single increment per calendar day, consecutive day tracking)
 * - Configurable Streak Milestones (3, 7, 14, 30, 50, 100 days)
 * - Selective DOM updates for optimal performance
 */

const DASHBOARD_STORAGE_KEY = 'ascend_dashboard_stats';

/**
 * Reusable Streak Milestones configuration object
 */
const STREAK_MILESTONES = {
  3:   { bonusXP: 25,  title: '3-Day Streak!',   icon: '🔥', message: 'Consistency is becoming a habit!' },
  7:   { bonusXP: 50,  title: '7-Day Streak!',   icon: '⚡', message: 'One week strong. Keep climbing!' },
  14:  { bonusXP: 100, title: '14-Day Streak!',  icon: '🏆', message: 'Two weeks of discipline. Outstanding!' },
  30:  { bonusXP: 200, title: '30-Day Streak!',  icon: '👑', message: 'An incredible month of consistency!' },
  50:  { bonusXP: 350, title: '50-Day Streak!',  icon: '💎', message: 'You are becoming unstoppable!' },
  100: { bonusXP: 700, title: '100-Day Streak!', icon: '🌟', message: 'Elite consistency achieved!' }
};

const DEFAULT_DASHBOARD_STATS = {
  totalWorkouts: 0,
  totalMinutes: 0,
  caloriesBurned: 0,
  currentStreak: 0,
  lastWorkoutDate: null, // YYYY-MM-DD
  weeklyHistory: {}      // Map of YYYY-MM-DD -> { workoutName, duration, calories }
};

// Cache for selective DOM update comparison
let lastRenderedState = {};

/**
 * Gets local date string formatted as YYYY-MM-DD
 * @returns {string} Date YYYY-MM-DD
 */
function getTodayDateString() {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Calculates calendar day difference between two YYYY-MM-DD date strings
 * @param {string} dateStr1 
 * @param {string} dateStr2 
 * @returns {number} Days difference
 */
function getDaysBetween(dateStr1, dateStr2) {
  if (!dateStr1 || !dateStr2) return Infinity;
  const d1 = new Date(dateStr1);
  const d2 = new Date(dateStr2);
  const diffTime = Math.abs(d2 - d1);
  return Math.floor(diffTime / (1000 * 60 * 60 * 24));
}

/**
 * Returns motivational subtitle based on streak length and today's workout status
 * @param {number} streak 
 * @param {boolean} workedOutToday 
 * @returns {string} Motivational string
 */
function getStreakMotivationalText(streak, workedOutToday) {
  if (workedOutToday) {
    return 'Streak active! Great work today. 🔥';
  }
  if (streak === 0) return 'Every journey starts with one workout.';
  if (streak <= 2) return 'Great start. Keep the momentum.';
  if (streak <= 6) return 'Consistency is becoming a habit.';
  if (streak <= 13) return 'One week strong. Keep climbing.';
  if (streak <= 29) return 'Your discipline is paying off.';
  if (streak <= 49) return 'An incredible month of consistency.';
  if (streak <= 99) return 'You are becoming unstoppable.';
  return 'Elite consistency achieved.';
}

/**
 * Public API: getStats()
 * Retrieves dashboard stats from localStorage.
 * Initializes default values safely if missing.
 * Validates streak continuity.
 * @returns {Object} Statistics object
 */
function getStats() {
  let stats = { ...DEFAULT_DASHBOARD_STATS };
  try {
    const raw = localStorage.getItem(DASHBOARD_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      stats = {
        totalWorkouts: Math.max(0, Number(parsed.totalWorkouts) || 0),
        totalMinutes: Math.max(0, Number(parsed.totalMinutes) || 0),
        caloriesBurned: Math.max(0, Number(parsed.caloriesBurned) || 0),
        currentStreak: Math.max(0, Number(parsed.currentStreak) || 0),
        lastWorkoutDate: parsed.lastWorkoutDate || null,
        weeklyHistory: parsed.weeklyHistory || {}
      };
    } else {
      saveStatsToStorage(stats);
    }
  } catch (err) {
    console.warn('[ASCEND Dashboard] Failed to read stats from localStorage:', err);
  }

  // Validate streak continuity: reset if more than 1 day missed
  if (stats.lastWorkoutDate) {
    const today = getTodayDateString();
    const daysPassed = getDaysBetween(stats.lastWorkoutDate, today);
    if (daysPassed > 1 && stats.lastWorkoutDate !== today) {
      stats.currentStreak = 0;
      saveStatsToStorage(stats);
    }
  }

  return stats;
}

/**
 * Internal: Save stats object to localStorage
 * @param {Object} stats 
 */
function saveStatsToStorage(stats) {
  try {
    const clean = {
      totalWorkouts: Math.max(0, Number(stats.totalWorkouts) || 0),
      totalMinutes: Math.max(0, Number(stats.totalMinutes) || 0),
      caloriesBurned: Math.max(0, Number(stats.caloriesBurned) || 0),
      currentStreak: Math.max(0, Number(stats.currentStreak) || 0),
      lastWorkoutDate: stats.lastWorkoutDate || null,
      weeklyHistory: stats.weeklyHistory || {}
    };
    localStorage.setItem(DASHBOARD_STORAGE_KEY, JSON.stringify(clean));
  } catch (err) {
    console.warn('[ASCEND Dashboard] Failed to save stats to localStorage:', err);
  }
}

/**
 * Public API: updateStats()
 * Updates specified fields, persists state, and re-renders UI selectively.
 * @param {Object} partialStats 
 * @returns {Object} Updated full stats object
 */
function updateStats(partialStats = {}) {
  const current = getStats();
  const updated = {
    ...current,
    totalWorkouts: typeof partialStats.totalWorkouts === 'number' ? Math.max(0, partialStats.totalWorkouts) : current.totalWorkouts,
    totalMinutes: typeof partialStats.totalMinutes === 'number' ? Math.max(0, partialStats.totalMinutes) : current.totalMinutes,
    caloriesBurned: typeof partialStats.caloriesBurned === 'number' ? Math.max(0, partialStats.caloriesBurned) : current.caloriesBurned,
    currentStreak: typeof partialStats.currentStreak === 'number' ? Math.max(0, partialStats.currentStreak) : current.currentStreak,
    lastWorkoutDate: partialStats.lastWorkoutDate !== undefined ? partialStats.lastWorkoutDate : current.lastWorkoutDate,
    weeklyHistory: partialStats.weeklyHistory || current.weeklyHistory
  };
  saveStatsToStorage(updated);
  renderDashboard(true);
  return updated;
}

/**
 * Public API: resetStats()
 * Resets all dashboard statistics to 0
 */
function resetStats() {
  saveStatsToStorage({ ...DEFAULT_DASHBOARD_STATS });
  renderDashboard(true);
}

/**
 * Smooth number count-up animation
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
 * Public API: renderDashboard()
 * Selectively updates only DOM elements that have actually changed.
 * @param {boolean} animate Whether to use smooth count-up transitions
 */
function updateXPDisplay() {
  if (!window.ASCEND_XP) {
    console.warn('[ASCEND Dashboard] XP system is not loaded yet.');
    return;
  }

  const progress = window.ASCEND_XP.getXPProgress();

  const levelEl = document.getElementById('statLevel');
  const xpEl = document.getElementById('statXP');
  const nextXPEl = document.getElementById('statXPNext');
  const progressFillEl = document.getElementById('xpProgressFill');

  if (levelEl) {
    levelEl.textContent = progress.level;
  }

  if (xpEl) {
    xpEl.textContent = `${progress.currentXP} XP`;
  }

  if (nextXPEl) {
    nextXPEl.textContent = `${progress.remainingToNext} XP to next level`;
  }

  if (progressFillEl) {
    progressFillEl.style.width = `${progress.percent}%`;
  }
}
function renderDashboard(animate = true) {
  const stats = getStats();
  const today = getTodayDateString();
  const workedOutToday = stats.lastWorkoutDate === today;

  // 1. Total Workouts
  if (lastRenderedState.totalWorkouts !== stats.totalWorkouts) {
    const el = document.getElementById('statWorkouts');
    if (el) {
      const cur = parseInt(el.textContent.replace(/,/g, ''), 10) || 0;
      if (animate) animateNumber(el, cur, stats.totalWorkouts, '');
      else el.textContent = stats.totalWorkouts.toLocaleString();
    }
    lastRenderedState.totalWorkouts = stats.totalWorkouts;
  }

  // 2. Total Minutes
  if (lastRenderedState.totalMinutes !== stats.totalMinutes) {
    const el = document.getElementById('statMinutes');
    if (el) {
      const cur = parseInt(el.textContent.replace(/[^0-9]/g, ''), 10) || 0;
      if (animate) animateNumber(el, cur, stats.totalMinutes, ' min');
      else el.textContent = stats.totalMinutes.toLocaleString() + ' min';
    }
    lastRenderedState.totalMinutes = stats.totalMinutes;
  }

  // 3. Calories Burned
  if (lastRenderedState.caloriesBurned !== stats.caloriesBurned) {
    const el = document.getElementById('statCalories');
    if (el) {
      const cur = parseInt(el.textContent.replace(/[^0-9]/g, ''), 10) || 0;
      if (animate) animateNumber(el, cur, stats.caloriesBurned, ' kcal');
      else el.textContent = stats.caloriesBurned.toLocaleString() + ' kcal';
    }
    lastRenderedState.caloriesBurned = stats.caloriesBurned;
  }

  // 4. Current Streak & Motivational Subtitle
  if (lastRenderedState.currentStreak !== stats.currentStreak || lastRenderedState.workedOutToday !== workedOutToday) {
    const elStreak = document.getElementById('statStreak');
    const elMotiv = document.getElementById('streakMotivation');
    if (elStreak) {
      const cur = parseInt(elStreak.textContent.replace(/[^0-9]/g, ''), 10) || 0;
      if (animate) animateNumber(elStreak, cur, stats.currentStreak, ' days');
      else elStreak.textContent = stats.currentStreak.toLocaleString() + ' days';
    }
    if (elMotiv) {
      elMotiv.textContent = getStreakMotivationalText(stats.currentStreak, workedOutToday);
    }
    lastRenderedState.currentStreak = stats.currentStreak;
    lastRenderedState.workedOutToday = workedOutToday;
  }

  // 5. Today's Goal Card
  renderTodayGoal(workedOutToday);

  // 6. Weekly 7-Day Calendar
  renderWeeklyCalendar(stats.weeklyHistory);
  // 7. Recent workout history
  renderRecentWorkouts(getRecentWorkoutHistory(5));
  // 8. XP / Level display
updateXPDisplay();
  // 9. Achievements stat & grid (delegated to achievements module)
  if (window.ASCEND_ACHIEVEMENTS && typeof window.ASCEND_ACHIEVEMENTS.render === 'function') {
    window.ASCEND_ACHIEVEMENTS.render();
  }
}

/**
 * Render Today's Goal Card status and estimated workout specs
 * @param {boolean} workedOutToday 
 */
function renderTodayGoal(workedOutToday) {
  const elBadge = document.getElementById('todayGoalBadge');
  const elMeta = document.getElementById('todayGoalMeta');

  if (elBadge) {
    if (workedOutToday) {
      elBadge.className = 'goal-badge done';
      elBadge.innerHTML = '✔ Completed';
    } else {
      elBadge.className = 'goal-badge pending';
      elBadge.innerHTML = '○ Not completed';
    }
  }

  // Extract selected workout specs from active template or defaults
  if (elMeta) {
    let activeMins = 35;
    let activeCals = 320;
    if (window.workoutEngine && window.workoutEngine.getActiveSession()) {
      const sess = window.workoutEngine.getActiveSession();
      if (sess.totalWorkoutTime) activeMins = sess.totalWorkoutTime;
      if (sess.estimatedCalories) activeCals = sess.estimatedCalories;
    }
    elMeta.innerHTML = `
      <span>Est. Time: <b>${activeMins}m</b></span>
      <span>Est. Calories: <b>${activeCals} kcal</b></span>
    `;
  }
}

/**
 * Render Weekly 7-Day Calendar grid with duration intensity and desktop tooltips
 * @param {Object} history Map of YYYY-MM-DD -> workout entry
 */
function getRecentWorkoutHistory(count = 5) {
  if (window.ASCEND_WORKOUT_HISTORY && typeof window.ASCEND_WORKOUT_HISTORY.getRecent === 'function') {
    return window.ASCEND_WORKOUT_HISTORY.getRecent(count);
  }

  const stats = getStats();
  const entries = Object.entries(stats.weeklyHistory || {}).map(([date, item]) => ({
    workoutName: item.workoutName || 'Workout',
    category: item.category || 'Unknown',
    difficulty: item.difficulty || 'Unknown',
    duration: item.duration || 0,
    caloriesBurned: item.calories || 0,
    exercisesCompleted: item.exercisesCompleted || [],
    completedAt: item.completedAt || `${date}T00:00:00.000Z`,
    xpEarned: item.xpEarned || 0,
    completedSuccessfully: true
  }));

  return entries
    .sort((a, b) => new Date(b.completedAt) - new Date(a.completedAt))
    .slice(0, count);
}

function formatWorkoutHistoryDate(isoString) {
  try {
    const date = new Date(isoString);
    return date.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
  } catch (err) {
    return isoString || 'Unknown date';
  }
}

function renderRecentWorkouts(history = []) {
  const container = document.getElementById('recentWorkoutsList');
  if (!container) return;

  if (!Array.isArray(history) || history.length === 0) {
    container.innerHTML = `
      <div class="recent-history-empty">
        <p>No workout history yet. Complete a session to see your recent workouts here.</p>
      </div>
    `;
    lastRenderedState.recentHistoryCount = 0;
    return;
  }

  const itemsHtml = history.slice(0, 5).map((entry) => {
    const dateLabel = formatWorkoutHistoryDate(entry.completedAt);
    const categoryLabel = entry.category ? `${entry.category}` : 'Workout';
    return `
      <div class="recent-workout-entry">
        <div class="recent-workout-header">
          <div class="recent-workout-title">${entry.workoutName || 'Workout'}</div>
          <div class="recent-workout-meta">${categoryLabel}</div>
        </div>
        <div class="recent-workout-stats">
          <span>${dateLabel}</span>
          <span>${entry.duration || 0}m</span>
          <span>${entry.caloriesBurned || 0} kcal</span>
          <span>${entry.xpEarned || 0} XP</span>
        </div>
      </div>
    `;
  }).join('');

  container.innerHTML = itemsHtml;
  lastRenderedState.recentHistoryCount = history.length;
}

function renderWeeklyCalendar(history = {}) {
  const container = document.getElementById('weeklyCalendarGrid');
  if (!container) return;

  const now = new Date();
  const currentDayIndex = (now.getDay() + 6) % 7; // Monday = 0, Sunday = 6
  const monday = new Date(now);
  monday.setDate(now.getDate() - currentDayIndex);

  const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  let html = '';

  for (let i = 0; i < 7; i++) {
    const dayDate = new Date(monday);
    dayDate.setDate(monday.getDate() + i);

    const year = dayDate.getFullYear();
    const month = String(dayDate.getMonth() + 1).padStart(2, '0');
    const day = String(dayDate.getDate()).padStart(2, '0');
    const dateStr = `${year}-${month}-${day}`;

    const isToday = i === currentDayIndex;
    const entry = history[dateStr];
    const completed = Boolean(entry && entry.duration > 0);

    let intensityClass = '';
    if (completed) {
      if (entry.duration >= 45) intensityClass = 'intensity-high';
      else if (entry.duration >= 30) intensityClass = 'intensity-medium';
      else intensityClass = 'intensity-low';
    }

    const pillClasses = `day-pill ${isToday ? 'today' : ''} ${completed ? 'completed' : ''} ${intensityClass}`;
    const iconContent = completed ? '✔' : '•';

    const tooltipContent = completed
      ? `<div class="day-tooltip">
          <strong>${entry.workoutName || 'Workout'}</strong>
          <span>⏱ ${entry.duration || 35} mins · 🔥 ${entry.calories || 320} kcal</span>
         </div>`
      : `<div class="day-tooltip">
          <strong>${dayNames[i]}</strong>
          <span>${isToday ? 'Today — Workout Pending' : 'Rest / No Workout'}</span>
         </div>`;

    html += `
      <div class="${pillClasses}">
        <span class="day-name">${dayNames[i]}</span>
        <div class="day-icon">${iconContent}</div>
        ${tooltipContent}
      </div>
    `;
  }

  container.innerHTML = html;
}

/**
 * Public API: recordCompletedWorkout()
 * Reads dynamic workout specs, updates Total Workouts, Total Minutes, Calories,
 * Daily Streak (single increment per calendar day), Weekly History, and checks Streak Milestones.
 * Triggers XP bonus rewards and reusable notifications without page reload.
 * @param {Object} workoutSession Active session object from workoutEngine
 * @returns {Object} Updated stats object
 */
function recordCompletedWorkout(workoutSession = {}) {
  const stats = getStats();
  const today = getTodayDateString();

  // 1. Dynamic duration & calories extraction
  let minutes = 0;
  if (typeof workoutSession.totalWorkoutTime === 'number' && workoutSession.totalWorkoutTime > 0) {
    minutes = workoutSession.totalWorkoutTime;
  } else if (Array.isArray(workoutSession.exercises) && workoutSession.exercises.length > 0) {
    const restTotal = workoutSession.exercises.reduce((sum, ex) => sum + (Number(ex.restDuration) || 0), 0);
    const durTotal = workoutSession.exercises.reduce((sum, ex) => sum + (Number(ex.durationSeconds) || 60), 0);
    minutes = Math.max(1, Math.round((restTotal + durTotal) / 60));
  } else {
    minutes = 35;
  }

  let calories = 0;
  if (typeof workoutSession.estimatedCalories === 'number' && workoutSession.estimatedCalories > 0) {
    calories = workoutSession.estimatedCalories;
  } else if (Array.isArray(workoutSession.exercises) && workoutSession.exercises.length > 0) {
    calories = workoutSession.exercises.reduce((sum, ex) => sum + (Number(ex.calories) || 0), 0);
    if (calories <= 0) calories = 320;
  } else {
    calories = 320;
  }

  const workoutName = workoutSession.title || 'Strength Workout';

  // 2. Increment lifetime metrics
  stats.totalWorkouts += 1;
  stats.totalMinutes += minutes;
  stats.caloriesBurned += calories;

  // 3. Log into Weekly History map
  if (!stats.weeklyHistory) stats.weeklyHistory = {};
  stats.weeklyHistory[today] = {
    workoutName,
    category: workoutSession.category || 'Unknown',
    difficulty: workoutSession.difficulty || 'Unknown',
    duration: minutes,
    calories,
    exercisesCompleted: Array.isArray(workoutSession.exercises) ? workoutSession.exercises.map(ex => ex.name || '').filter(Boolean) : [],
    xpEarned: typeof workoutSession._xpEarned === 'number' ? workoutSession._xpEarned : 0,
    completedAt: new Date().toISOString(),
    completedSuccessfully: true
  };

  // 4. Daily Streak Engine
  let streakIncreased = false;
  if (stats.lastWorkoutDate === today) {
    // Already worked out today; streak maintained, no double increment
  } else if (stats.lastWorkoutDate && getDaysBetween(stats.lastWorkoutDate, today) === 1) {
    // Consecutive day workout
    stats.currentStreak += 1;
    stats.lastWorkoutDate = today;
    streakIncreased = true;
  } else {
    // New streak started today
    stats.currentStreak = 1;
    stats.lastWorkoutDate = today;
    streakIncreased = true;
  }

  saveStatsToStorage(stats);

  // 5. Check Streak Milestones & award Bonus XP via ASCEND_XP.addXP()
  if (streakIncreased) {
    const milestone = STREAK_MILESTONES[stats.currentStreak];
    if (milestone && window.ASCEND_XP && typeof window.ASCEND_XP.addXP === 'function') {
      window.ASCEND_XP.addXP(milestone.bonusXP, `${milestone.title} Milestone`);
      if (typeof window.ASCEND_XP.showNotification === 'function') {
        window.ASCEND_XP.showNotification({
          type: 'streak',
          title: milestone.title,
          message: milestone.message,
          icon: milestone.icon,
          duration: 4500
        });
      }
    } else if (window.ASCEND_XP && typeof window.ASCEND_XP.showNotification === 'function') {
      window.ASCEND_XP.showNotification({
        type: 'streak',
        title: `🔥 Streak Increased!`,
        message: `${stats.currentStreak} day streak active. Keep climbing!`,
        icon: '🔥'
      });
    }
  }

  renderDashboard(true);

  if (window.ASCEND_ACHIEVEMENTS && typeof window.ASCEND_ACHIEVEMENTS.checkAchievements === 'function') {
    window.ASCEND_ACHIEVEMENTS.checkAchievements({ event: 'workoutCompleted', completedAt: new Date() });
  }

  return stats;
}

/**
 * Public API: getStreakMilestones()
 * Exposes milestone config object for future modules (Achievements, Leaderboards, AI Coach)
 */
function getStreakMilestones() {
  return { ...STREAK_MILESTONES };
}

/**
 * Initialize Dashboard DOM event listeners and initial render
 */
function initDashboard() {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => renderDashboard(true));
  } else {
    renderDashboard(true);
  }
}

initDashboard();

// Expose public API on window.ASCEND_DASHBOARD
window.ASCEND_DASHBOARD = {
  getStats,
  updateStats,
  renderDashboard,
  resetStats,
  recordCompletedWorkout,
  getStreakMilestones
};