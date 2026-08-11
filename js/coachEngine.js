'use strict';

/**
 * =========================================
 * ASCEND PERSONALIZED AI COACH ENGINE
 * =========================================
 * Rule-based personalized coach that reads REAL data from existing modules.
 * Uses public APIs only — never touches localStorage directly.
 *
 * Data sources (all read-only through public APIs):
 * - window.ASCEND_XP            (player level, XP, progress)
 * - window.ASCEND_DASHBOARD     (workouts, streak, weekly history)
 * - window.ASCEND_BODY          (BMI, measurements, weight)
 * - window.ASCEND_WORKOUT_HISTORY (recent workouts — falls back to dashboard)
 * - window.ASCEND_ACHIEVEMENTS  (unlocked achievements, progress)
 *
 * Public API: window.ASCEND_COACH
 *   - initialize()
 *   - generateDailyAdvice()    → string[]
 *   - generateWeeklySummary()  → object
 *   - generateGoals()          → object[]
 *   - generateMotivation()     → string
 *   - render()
 *   - showDailyAdvice()
 *   - showWeeklySummary()
 *   - showGoals()
 *   - showMotivation()
 */

const ASCEND_COACH = (() => {
  /* ========== INTERNAL STATE ========== */
  let lastMotivationIndex = -1;

  /* ========== DATA COLLECTION (public APIs only) ========== */

  /**
   * Collects a read-only snapshot of all user data through public APIs.
   * Every access is guarded so the coach works even when modules are missing.
   * @returns {Object} Context object with xp, dashboard, body, achievements, workoutHistory
   */
  function collectContext() {
    const ctx = {
      xp: null,
      xpProgress: null,
      dashboard: null,
      body: null,
      achievements: null,
      unlockedAchievements: null,
      totalAchievements: 0,
      workoutHistory: [],
      hasData: false
    };

    // XP / Level data
    if (window.ASCEND_XP) {
      if (typeof window.ASCEND_XP.getPlayer === 'function') {
        ctx.xp = window.ASCEND_XP.getPlayer();
      }
      if (typeof window.ASCEND_XP.getXPProgress === 'function') {
        ctx.xpProgress = window.ASCEND_XP.getXPProgress();
      }
    }

    // Dashboard stats (workouts, streak, weekly history)
    if (window.ASCEND_DASHBOARD && typeof window.ASCEND_DASHBOARD.getStats === 'function') {
      ctx.dashboard = window.ASCEND_DASHBOARD.getStats();
    }

    // Body measurements (BMI, weight, healthy range)
    if (window.ASCEND_BODY && typeof window.ASCEND_BODY.getMeasurements === 'function') {
      ctx.body = window.ASCEND_BODY.getMeasurements();
    }

    // Workout history — try dedicated module, fall back to dashboard weekly history
    ctx.workoutHistory = getWorkoutHistory(ctx);

    // Achievements
    if (window.ASCEND_ACHIEVEMENTS) {
      if (typeof window.ASCEND_ACHIEVEMENTS.getAchievements === 'function') {
        ctx.achievements = window.ASCEND_ACHIEVEMENTS.getAchievements();
      }
      if (typeof window.ASCEND_ACHIEVEMENTS.getUnlocked === 'function') {
        ctx.unlockedAchievements = window.ASCEND_ACHIEVEMENTS.getUnlocked();
      }
      if (typeof window.ASCEND_ACHIEVEMENTS.getTotalCount === 'function') {
        ctx.totalAchievements = window.ASCEND_ACHIEVEMENTS.getTotalCount();
      }
    }

    ctx.hasData = Boolean(ctx.xp || ctx.dashboard);
    return ctx;
  }

  /**
   * Retrieves workout history through ASCEND_WORKOUT_HISTORY if available,
   * otherwise falls back to the dashboard's weeklyHistory map.
   * This avoids duplicating localStorage — we read whatever the existing
   * modules already persist.
   */
  function getWorkoutHistory(ctx) {
    // Try the dedicated workout history module first
    if (window.ASCEND_WORKOUT_HISTORY) {
      if (typeof window.ASCEND_WORKOUT_HISTORY.getHistory === 'function') {
        return window.ASCEND_WORKOUT_HISTORY.getHistory() || [];
      }
      if (typeof window.ASCEND_WORKOUT_HISTORY.getRecent === 'function') {
        return window.ASCEND_WORKOUT_HISTORY.getRecent(10) || [];
      }
      if (typeof window.ASCEND_WORKOUT_HISTORY.getAll === 'function') {
        return window.ASCEND_WORKOUT_HISTORY.getAll() || [];
      }
    }

    // Fall back to dashboard weekly history (already persisted by ASCEND_DASHBOARD)
    if (ctx.dashboard && ctx.dashboard.weeklyHistory) {
      return Object.entries(ctx.dashboard.weeklyHistory)
        .map(([date, entry]) => ({ date, ...entry }))
        .sort((a, b) => new Date(b.date) - new Date(a.date));
    }

    return [];
  }

  /* ========== DATE HELPERS ========== */

  function getTodayDateString() {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  function formatDateStr(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  function getDaysBetween(dateStr1, dateStr2) {
    if (!dateStr1 || !dateStr2) return Infinity;
    const d1 = new Date(dateStr1);
    const d2 = new Date(dateStr2);
    const diffTime = Math.abs(d2 - d1);
    return Math.floor(diffTime / (1000 * 60 * 60 * 24));
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, '&#38;')
      .replace(/</g, '&#60;')
      .replace(/>/g, '&#62;')
      .replace(/"/g, '&#34;')
      .replace(/'/g, '&#39;');
  }

  /**
   * Calculates stats for the current week (Mon–Sun) from the weekly history map.
   * @param {Object} weeklyHistory Map of YYYY-MM-DD → workout entry
   * @returns {Object} { workouts, minutes, calories, bestWorkout }
   */
  function getWeekStats(weeklyHistory) {
    const now = new Date();
    const currentDayIndex = (now.getDay() + 6) % 7; // Monday = 0
    const monday = new Date(now);
    monday.setDate(now.getDate() - currentDayIndex);
    monday.setHours(0, 0, 0, 0);

    let workouts = 0;
    let minutes = 0;
    let calories = 0;
    let bestWorkout = null;

    for (let i = 0; i < 7; i++) {
      const dayDate = new Date(monday);
      dayDate.setDate(monday.getDate() + i);
      const dateStr = formatDateStr(dayDate);
      const entry = weeklyHistory[dateStr];
      if (entry && entry.duration > 0) {
        workouts++;
        minutes += entry.duration || 0;
        calories += entry.calories || 0;
        if (!bestWorkout || (entry.calories || 0) > (bestWorkout.calories || 0)) {
          bestWorkout = { ...entry, date: dateStr };
        }
      }
    }

    return { workouts, minutes, calories, bestWorkout };
  }

  /* ========== DAILY ADVICE GENERATION ========== */

  /**
   * Public API: generateDailyAdvice()
   * Generates 1–3 personalized advice strings based on real user data.
   * @returns {string[]} Array of advice strings
   */
  function generateDailyAdvice() {
    const ctx = collectContext();
    const advice = [];

    // 1. Streak / consistency advice
    const streakAdvice = generateStreakAdvice(ctx);
    if (streakAdvice) advice.push(streakAdvice);

    // 2. Body / BMI advice
    const bodyAdvice = generateBodyAdvice(ctx);
    if (bodyAdvice) advice.push(bodyAdvice);

    // 3. Nutrition advice (protein / hydration)
    const nutritionAdvice = generateNutritionAdvice(ctx);
    if (nutritionAdvice) advice.push(nutritionAdvice);

    // 4. Achievement progress advice
    const achievementAdvice = generateAchievementAdvice(ctx);
    if (achievementAdvice) advice.push(achievementAdvice);

    // 5. XP / Level advice
    const xpAdvice = generateXPAdvice(ctx);
    if (xpAdvice) advice.push(xpAdvice);

    // Fallback for brand-new users with no data
    if (advice.length === 0) {
      advice.push('Welcome to ASCEND. Complete your first workout to unlock personalized coaching.');
    }

    // Return the top 3 most relevant
    return advice.slice(0, 3);
  }

  function generateStreakAdvice(ctx) {
    if (!ctx.dashboard) return null;

    const streak = ctx.dashboard.currentStreak || 0;
    const lastDate = ctx.dashboard.lastWorkoutDate;
    const today = getTodayDateString();
    const workedOutToday = lastDate === today;

    if (workedOutToday && streak >= 3) {
      return `You've trained ${streak} days in a row. Recovery is important tomorrow.`;
    }
    if (workedOutToday && streak > 0) {
      return `Great work today! You're on a ${streak}-day streak. Keep building momentum.`;
    }
    if (workedOutToday && streak === 0) {
      return 'Great work today! Every workout counts.';
    }
    if (lastDate) {
      const days = getDaysBetween(lastDate, today);
      if (days >= 2) {
        return `You haven't trained for ${days} days. Let's get back on track today.`;
      }
    }
    if (streak === 0) {
      return 'Every journey starts with one workout. Start today.';
    }
    return null;
  }

  function generateBodyAdvice(ctx) {
    if (!ctx.body || ctx.body.bmi === null || ctx.body.bmi === undefined) return null;

    const bmi = ctx.body.bmi;
    const category = ctx.body.bmiCategory;
    const summary = ctx.body.summary;

    // Weight change advice takes priority
    if (summary && summary.weightDiff !== null && summary.weightDiff !== 0) {
      if (summary.weightDiff < 0) {
        return `You've lost ${Math.abs(summary.weightDiff).toFixed(1)} kg since your last update. Great progress!`;
      }
      return `You've gained ${summary.weightDiff.toFixed(1)} kg since your last update. Keep tracking.`;
    }

    // BMI category advice
    if (category) {
      if (category.label === 'Underweight') {
        return `Your BMI is ${bmi.toFixed(1)} — consider adding nutrient-dense meals to support your training.`;
      }
      if (category.label === 'Healthy') {
        return `Your BMI is ${bmi.toFixed(1)} — you're in a healthy range. Keep it up.`;
      }
      if (category.label === 'Overweight') {
        return `Your BMI is ${bmi.toFixed(1)} — regular training and balanced nutrition will help you optimize.`;
      }
      if (category.label === 'Obese') {
        return `Your BMI is ${bmi.toFixed(1)} — start with low-impact workouts and build gradually.`;
      }
    }

    return null;
  }

  function generateNutritionAdvice(ctx) {
    if (!ctx.body || !ctx.body.measurements) return null;

    const weight = ctx.body.measurements.weight;
    if (weight === null || weight === undefined) return null;

    const proteinGrams = Math.round(weight * 2.0);
    const waterLiters = (weight * 0.035).toFixed(1);

    // Alternate between protein and hydration advice by day
    const day = new Date().getDate();
    if (day % 2 === 0) {
      return `Aim for ${proteinGrams}g protein daily to support your training.`;
    }
    return `Drink at least ${waterLiters}L of water today to stay hydrated.`;
  }

  function generateAchievementAdvice(ctx) {
    if (!ctx.achievements || !Array.isArray(ctx.achievements)) return null;

    // Find the locked achievement closest to unlocking
    const locked = ctx.achievements.filter((a) => !a.unlocked && a.progress);
    if (locked.length === 0) return null;

    const closest = locked.reduce((best, current) => {
      if (!best) return current;
      return (current.progress.percent || 0) > (best.progress.percent || 0) ? current : best;
    }, null);

    if (!closest || !closest.progress) return null;

    const current = closest.progress.current || 0;
    const target = closest.progress.target || 1;
    const label = closest.progress.label || 'progress';

    if (closest.progress.percent >= 90) {
      return `You're so close to unlocking "${closest.title}" — ${current}/${target} ${label}.`;
    }
    if (closest.progress.percent >= 50) {
      return `You're halfway to unlocking "${closest.title}" — ${current}/${target} ${label}.`;
    }
    return null;
  }

  function generateXPAdvice(ctx) {
    if (!ctx.xpProgress) return null;

    const remaining = ctx.xpProgress.remainingToNext || 0;
    const level = ctx.xpProgress.level || 1;
    const nextLevel = level + 1;
    const progressInLevel = ctx.xpProgress.progressInLevel || 0;

    if (remaining > 0 && remaining <= 120) {
      return `You're only ${remaining} XP from Level ${nextLevel}. One workout will get you there!`;
    }
    if (progressInLevel > 0 && progressInLevel < 50) {
      return `You just reached Level ${level}. Keep climbing!`;
    }
    return null;
  }

  /* ========== WEEKLY SUMMARY GENERATION ========== */

  /**
   * Public API: generateWeeklySummary()
   * Builds a summary of the current week's training using dashboard data.
   * @returns {Object} { workouts, minutes, calories, xp, level, streak, bestWorkout, suggestion }
   */
  function generateWeeklySummary() {
    const ctx = collectContext();
    const summary = {
      workouts: 0,
      minutes: 0,
      calories: 0,
      xp: 0,
      level: 1,
      streak: 0,
      bestWorkout: null,
      suggestion: ''
    };

    if (ctx.dashboard) {
      const weekStats = getWeekStats(ctx.dashboard.weeklyHistory || {});
      summary.workouts = weekStats.workouts;
      summary.minutes = weekStats.minutes;
      summary.calories = weekStats.calories;
      summary.bestWorkout = weekStats.bestWorkout;
      summary.streak = ctx.dashboard.currentStreak || 0;
    }

    if (ctx.xp) {
      summary.xp = ctx.xp.xp || 0;
      summary.level = ctx.xp.level || 1;
    }

    summary.suggestion = generateImprovementSuggestion(ctx, summary);

    return summary;
  }

  function generateImprovementSuggestion(ctx, summary) {
    if (summary.workouts === 0) {
      return 'No workouts this week yet. Start with a short session today.';
    }
    if (summary.workouts < 3) {
      return `You've completed ${summary.workouts} workout${summary.workouts === 1 ? '' : 's'} this week. Aim for 3+ to build consistency.`;
    }
    if (summary.minutes < 90) {
      return 'Great start! Try adding a longer session to increase your weekly volume.';
    }
    if (summary.streak >= 7) {
      return 'Excellent consistency! Focus on recovery and sleep to sustain your streak.';
    }
    return 'Solid week! Keep the momentum going and try a new workout style.';
  }

  /* ========== GOAL SUGGESTION GENERATION ========== */

  /**
   * Public API: generateGoals()
   * Generates 1–5 personalized goal objects based on real user data.
   * @returns {Object[]} Array of { icon, title, detail, progress }
   */
  function generateGoals() {
    return _generateGoals(collectContext());
  }

  /** Internal goal generator — shared by generateGoals() and the coach brief */
  function _generateGoals(ctx) {
    const goals = [];

    // 1. XP / Level goal
    if (ctx.xpProgress) {
      const nextLevel = (ctx.xpProgress.level || 1) + 1;
      const remaining = ctx.xpProgress.remainingToNext || 0;
      goals.push({
        icon: '⬆',
        title: `Reach Level ${nextLevel}`,
        detail: `${remaining} XP to go`,
        progress: ctx.xpProgress.percent || 0
      });
    }

    // 2. Next achievement goal
    if (ctx.achievements && Array.isArray(ctx.achievements)) {
      const locked = ctx.achievements.filter((a) => !a.unlocked && a.progress);
      const closest = locked.reduce((best, current) => {
        if (!best) return current;
        return (current.progress.percent || 0) > (best.progress.percent || 0) ? current : best;
      }, null);

      if (closest) {
        goals.push({
          icon: closest.icon || '🏆',
          title: `Unlock "${closest.title}"`,
          detail: `${closest.progress.current || 0}/${closest.progress.target || 1} ${closest.progress.label || ''}`,
          progress: closest.progress.percent || 0
        });
      }
    }

    // 3. Weekly workouts goal
    if (ctx.dashboard) {
      const weekStats = getWeekStats(ctx.dashboard.weeklyHistory || {});
      const target = 3;
      const current = Math.min(weekStats.workouts, target);
      goals.push({
        icon: '📅',
        title: `Complete ${target} workouts this week`,
        detail: `${current}/${target} done`,
        progress: Math.min(100, Math.round((current / target) * 100))
      });
    }

    // 4. Body / weight goal
    if (ctx.body && ctx.body.healthyWeight && ctx.body.measurements) {
      const weight = ctx.body.measurements.weight;
      const healthy = ctx.body.healthyWeight;
      if (weight !== null && weight !== undefined) {
        if (weight > healthy.max) {
          const diff = (weight - healthy.max).toFixed(1);
          goals.push({
            icon: '⚖',
            title: `Lose ${diff} kg to reach healthy range`,
            detail: `Current: ${weight.toFixed(1)} kg · Target: ≤${healthy.max.toFixed(1)} kg`,
            progress: Math.min(100, Math.round((healthy.max / weight) * 100))
          });
        } else if (weight < healthy.min) {
          const diff = (healthy.min - weight).toFixed(1);
          goals.push({
            icon: '⚖',
            title: `Gain ${diff} kg to reach healthy range`,
            detail: `Current: ${weight.toFixed(1)} kg · Target: ≥${healthy.min.toFixed(1)} kg`,
            progress: Math.min(100, Math.round((weight / healthy.min) * 100))
          });
        }
      }
    }

    // 5. Streak milestone goal
    if (ctx.dashboard) {
      const streak = ctx.dashboard.currentStreak || 0;
      const milestones = [3, 7, 14, 30, 50, 100];
      const nextMilestone = milestones.find((m) => m > streak);
      if (nextMilestone) {
        goals.push({
          icon: '🔥',
          title: `Reach a ${nextMilestone}-day streak`,
          detail: `${streak}/${nextMilestone} days`,
          progress: Math.min(100, Math.round((streak / nextMilestone) * 100))
        });
      }
    }

    // Fallback for new users
    if (goals.length === 0) {
      goals.push({
        icon: '🏋',
        title: 'Complete your first workout',
        detail: 'Start your ASCEND journey',
        progress: 0
      });
    }

    return goals.slice(0, 5);
  }

  /* ========== MOTIVATIONAL MESSAGE GENERATION ========== */

  /**
   * Public API: generateMotivation()
   * Generates a motivational message that varies based on user progress.
   * Uses a rotation mechanism to avoid repeating the same message.
   * @returns {string} Motivational message
   */
  function generateMotivation() {
    const ctx = collectContext();
    const messages = [];

    const streak = ctx.dashboard ? (ctx.dashboard.currentStreak || 0) : 0;
    const level = ctx.xp ? (ctx.xp.level || 1) : 1;
    const totalWorkouts = ctx.dashboard ? (ctx.dashboard.totalWorkouts || 0) : 0;
    const unlockedCount = ctx.unlockedAchievements ? ctx.unlockedAchievements.length : 0;

    // Streak-based messages
    if (streak >= 30) {
      messages.push(`${streak} days of discipline. You're proof that consistency compounds.`);
    } else if (streak >= 14) {
      messages.push('Two weeks strong. The mountain is getting smaller under your feet.');
    } else if (streak >= 7) {
      messages.push('A full week of showing up. That\'s how champions are built.');
    } else if (streak >= 3) {
      messages.push('Three days in. The habit is forming — keep climbing.');
    } else if (streak === 0 && totalWorkouts === 0) {
      messages.push('The mountain seems tall, but every step counts. Today is day one.');
    }

    // Level-based messages
    if (level >= 5) {
      messages.push(`Level ${level} — you're ascending faster than most. Keep pushing.`);
    } else if (level >= 3) {
      messages.push(`Level ${level} and climbing. Your effort is showing.`);
    } else if (level >= 2) {
      messages.push(`Level ${level}! You're building real momentum now.`);
    }

    // Workout-based messages
    if (totalWorkouts >= 50) {
      messages.push(`${totalWorkouts} workouts deep. You don't find time — you make it.`);
    } else if (totalWorkouts >= 10) {
      messages.push(`${totalWorkouts} sessions done. You're past the hardest part — starting.`);
    } else if (totalWorkouts > 0 && totalWorkouts < 5) {
      messages.push("You've started. That's more than most. Now do it again tomorrow.");
    }

    // Achievement-based messages
    if (unlockedCount >= 10) {
      messages.push(`${unlockedCount} achievements unlocked. Your trophy case is growing.`);
    } else if (unlockedCount >= 3) {
      messages.push(`${unlockedCount} badges earned. Each one tells a story of consistency.`);
    }

    // General motivational messages (always available)
    messages.push('Discipline is choosing between what you want now and what you want most.');
    messages.push('Small daily improvements compound into staggering results.');
    messages.push("You don't have to be extreme, just consistent.");
    messages.push('The body achieves what the mind believes.');
    messages.push('Show up. That\'s the whole game.');

    // Pick a message, avoiding the last one used
    let index;
    if (messages.length > 1) {
      do {
        index = Math.floor(Math.random() * messages.length);
      } while (index === lastMotivationIndex && messages.length > 1);
    } else {
      index = 0;
    }
    lastMotivationIndex = index;

    return messages[index];
  }

  /* ========== CHAT RESPONSE ENGINE ========== */

  /**
   * Generates a personalized response for the chat input.
   * Returns null when the question doesn't match a personalized topic,
   * so the original keyword-based coachReply can handle it.
   * @param {string} question User's question
   * @returns {string|null} Personalized response or null to defer to original
   */
  function generateResponse(question) {
    const q = String(question || '').toLowerCase();
    const ctx = collectContext();

    // Personalized topics
    if (q.includes('progress') || q.includes('how am i') || q.includes('my stats')) {
      return generateProgressResponse(ctx);
    }
    if (q.includes('streak') || q.includes('consistency') || q.includes('consecutive')) {
      return generateStreakResponse(ctx);
    }
    if (q.includes('level') || q.includes('xp') || q.includes('rank')) {
      return generateLevelResponse(ctx);
    }
    if (q.includes('goal') || q.includes('target') || q.includes('next')) {
      return generateGoalResponse(ctx);
    }
    if (q.includes('weight') || q.includes('bmi') || q.includes('body')) {
      return generateBodyResponse(ctx);
    }
    if (q.includes('workout') && (q.includes('history') || q.includes('recent') || q.includes('last'))) {
      return generateHistoryResponse(ctx);
    }
    if (q.includes('achievement') || q.includes('badge') || q.includes('unlock')) {
      return generateAchievementResponse(ctx);
    }
    if (q.includes('week') || q.includes('summary')) {
      return generateWeeklyResponse(ctx);
    }
    if (q.includes('train today') || q.includes('workout today') || q.includes("today's focus") || q.includes('what should i') || q.includes('focus on')) {
      return generateFocusResponse(ctx);
    }

    // null = defer to the original keyword-based coachReply
    return null;
  }

  /** Personalized answer for “what should I do today” style questions */
  function generateFocusResponse(ctx) {
    const focus = generateTodayFocus(ctx);
    return `Today's focus: ${focus.label}. ${focus.message}`;
  }

  function generateProgressResponse(ctx) {
    const parts = [];
    if (ctx.dashboard) {
      parts.push(`You've completed ${ctx.dashboard.totalWorkouts || 0} workouts, ${ctx.dashboard.totalMinutes || 0} minutes, and burned ${ctx.dashboard.caloriesBurned || 0} calories.`);
    }
    if (ctx.xp) {
      parts.push(`You're at Level ${ctx.xp.level || 1} with ${ctx.xp.xp || 0} XP.`);
    }
    if (ctx.dashboard && ctx.dashboard.currentStreak > 0) {
      parts.push(`Current streak: ${ctx.dashboard.currentStreak} days.`);
    }
    return parts.length ? parts.join(' ') : 'Start your first workout to see your progress here.';
  }

  function generateStreakResponse(ctx) {
    if (!ctx.dashboard) return 'Start training to build your streak!';
    const streak = ctx.dashboard.currentStreak || 0;
    if (streak === 0) return 'Your streak is at 0. Complete a workout today to start a new one!';
    return `You're on a ${streak}-day streak. ${streak >= 7 ? 'Outstanding consistency!' : 'Keep it going!'}`;
  }

  function generateLevelResponse(ctx) {
    if (!ctx.xpProgress) return 'Start training to earn XP and level up!';
    const p = ctx.xpProgress;
    return `You're at Level ${p.level} with ${p.currentXP} XP. You need ${p.remainingToNext} more XP to reach Level ${p.level + 1}.`;
  }

  function generateGoalResponse(ctx) {
    const goals = generateGoals();
    if (goals.length === 0) return 'Complete your first workout to unlock personalized goals.';
    const g = goals[0];
    return `Your top goal: ${g.title} — ${g.detail}.`;
  }

  function generateBodyResponse(ctx) {
    if (!ctx.body || ctx.body.bmi === null) return 'Log your body measurements to get personalized body composition advice.';
    const bmi = ctx.body.bmi.toFixed(1);
    const cat = ctx.body.bmiCategory ? ctx.body.bmiCategory.label : '—';
    return `Your BMI is ${bmi} (${cat}). ${ctx.body.weightVerdict ? ctx.body.weightVerdict.text : ''}`;
  }

  function generateHistoryResponse(ctx) {
    if (!ctx.workoutHistory || ctx.workoutHistory.length === 0) {
      return 'No workout history yet. Complete your first session to start tracking.';
    }
    const recent = ctx.workoutHistory.slice(0, 3);
    const lines = recent.map((w) => `${w.workoutName || 'Workout'} — ${w.duration || 0} min, ${w.calories || 0} kcal`);
    return `Your recent workouts:\n${lines.join('\n')}`;
  }

  function generateAchievementResponse(ctx) {
    if (!ctx.achievements) return 'Start training to unlock achievements!';
    const unlocked = ctx.unlockedAchievements ? ctx.unlockedAchievements.length : 0;
    const total = ctx.totalAchievements || 0;
    return `You've unlocked ${unlocked} of ${total} achievements. Keep training to earn more!`;
  }

  function generateWeeklyResponse(ctx) {
    const summary = generateWeeklySummary();
    return `This week: ${summary.workouts} workouts, ${summary.minutes} min, ${summary.calories} kcal. ${summary.suggestion}`;
  }

  /* ========== TODAY'S FOCUS & COACH BRIEF ========== */

  /**
   * Greets the user by time of day, using the auth profile name when available.
   * @returns {string} e.g. "Good morning, Rejoice."
   */
  function generateGreeting() {
    const hour = new Date().getHours();
    const part = hour < 12 ? 'Good morning' : (hour < 18 ? 'Good afternoon' : 'Good evening');
    let name = '';
    try {
      if (typeof getCurrentUser === 'function') {
        const user = getCurrentUser();
        if (user) {
          const raw = String(user.name || user.email || '').trim();
          if (raw) name = raw.split(' ')[0];
        }
      }
    } catch (err) { /* greeting stays generic */ }
    return name ? `${part}, ${name}.` : `${part}.`;
  }

  /**
   * One-line status headline derived from real streak / activity data.
   * @returns {string}
   */
  function generateHeadline(ctx) {
    const dash = ctx.dashboard;
    if (!dash) return 'Welcome to ASCEND Coach.';
    const streak = dash.currentStreak || 0;
    const total = dash.totalWorkouts || 0;
    const today = getTodayDateString();
    const last = dash.lastWorkoutDate;
    const workedOutToday = last === today;

    if (streak > 0 && workedOutToday) return `You're on a ${streak}-day streak.`;
    if (streak > 0) return `You're on a ${streak}-day streak — keep it alive today.`;
    if (last) {
      const away = getDaysBetween(last, today);
      if (away >= 2) return `You haven't trained in ${away} days.`;
    }
    if (total === 0) return 'Your ASCEND journey starts today.';
    return `You've completed ${total} workout${total === 1 ? '' : 's'} so far.`;
  }

  /**
   * Deterministic "Today's Focus" recommendation based on real activity.
   * @returns {Object} { label, message }
   */
  function generateTodayFocus(ctx) {
    const dash = ctx.dashboard;
    const total = dash ? (dash.totalWorkouts || 0) : 0;
    const streak = dash ? (dash.currentStreak || 0) : 0;
    const today = getTodayDateString();
    const last = dash ? dash.lastWorkoutDate : null;
    const workedOutToday = last === today;
    const away = last ? getDaysBetween(last, today) : Infinity;
    const week = getWeekStats((dash && dash.weeklyHistory) || {});
    const xpProg = ctx.xpProgress;
    const remaining = xpProg ? (xpProg.remainingToNext || 0) : Infinity;
    const nextLevel = xpProg ? ((xpProg.level || 1) + 1) : 2;

    if (total === 0) {
      return { label: 'START', message: 'Your first session is the whole game today. Keep it simple and finish it.' };
    }
    if (away >= 3) {
      return { label: 'MOMENTUM', message: `You've been away ${away} days. A shorter session today is the fastest way back.` };
    }
    if (workedOutToday && streak >= 7) {
      return { label: 'RECOVERY', message: 'You trained today and your week is strong. Protect it with recovery, not volume.' };
    }
    if (workedOutToday) {
      return { label: 'CONSISTENCY', message: 'You trained today. Consistency is the habit — showing up tomorrow keeps it alive.' };
    }
    if (remaining <= 120) {
      return { label: 'PROGRESS', message: `You're ${remaining} XP from Level ${nextLevel}. One completed workout moves you much closer.` };
    }
    if (week.workouts >= 4) {
      return { label: 'RECOVERY', message: `You're having a strong week (${week.workouts} sessions). Recovery matters as much as the sessions.` };
    }
    if (streak >= 3) {
      return { label: 'CONSISTENCY', message: `Your ${streak}-day streak is your strongest signal. Keep it alive today.` };
    }
    if (streak >= 1) {
      return { label: 'CONSISTENCY', message: "You're building momentum. Keep today's session simple and complete it." };
    }
    return { label: 'MOMENTUM', message: 'Every run of consistency starts with a single day. Make today that day.' };
  }

  /* In-memory signal tracking for brief acknowledgments (no storage) */
  let seenUnlocks = null;
  let seenLevel = null;

  function detectFreshSignals(ctx) {
    const signals = [];

    // Newly unlocked achievements since the last brief render
    const unlocked = (ctx.unlockedAchievements || []).map((a) => a.id);
    const currentUnlocks = new Set(unlocked);
    if (seenUnlocks === null) {
      seenUnlocks = currentUnlocks;
    } else {
      const fresh = unlocked.filter((id) => !seenUnlocks.has(id));
      if (fresh.length) {
        const def = (ctx.achievements || []).find((a) => a.id === fresh[fresh.length - 1]);
        if (def) signals.push({ type: 'achievement', title: def.title });
      }
      seenUnlocks = currentUnlocks;
    }

    // Level up since the last brief render
    const level = ctx.xp ? (ctx.xp.level || 1) : 1;
    if (seenLevel === null) {
      seenLevel = level;
    } else if (level > seenLevel) {
      signals.push({ type: 'levelUp', level });
      seenLevel = level;
    }

    return signals;
  }

  /**
   * Structured coach brief — the premium dashboard-card payload.
   * @returns {Object} { greeting, headline, focus, stats, nextGoal, cta, acknowledgment }
   */
  function generateCoachBrief() {
    const ctx = collectContext();
    const signals = detectFreshSignals(ctx);

    const stats = {
      level: ctx.xp ? (ctx.xp.level || 1) : 1,
      xp: ctx.xp ? (ctx.xp.xp || 0) : 0,
      xpToNext: ctx.xpProgress ? (ctx.xpProgress.remainingToNext || 0) : 0,
      streak: ctx.dashboard ? (ctx.dashboard.currentStreak || 0) : 0,
      workouts: ctx.dashboard ? (ctx.dashboard.totalWorkouts || 0) : 0
    };

    const goals = _generateGoals(ctx);
    const nextGoal = goals.length ? goals[0] : { title: 'Complete your first workout', detail: 'Start your ASCEND journey' };

    let acknowledgment = null;
    if (signals.length) {
      const last = signals[signals.length - 1];
      acknowledgment = last.type === 'levelUp'
        ? { type: 'levelUp', text: `Level up — you're now Level ${last.level}. Your next target is Level ${last.level + 1}.` }
        : { type: 'achievement', text: `New achievement unlocked — ${last.title}.` };
    }

    return {
      greeting: generateGreeting(),
      headline: generateHeadline(ctx),
      focus: generateTodayFocus(ctx),
      stats,
      nextGoal,
      cta: { label: "START TODAY'S WORKOUT" },
      acknowledgment
    };
  }

  /** Renders the premium coach brief card into #coachBrief */
  function renderBrief() {
    const el = document.getElementById('coachBrief');
    if (!el) return;
    const brief = generateCoachBrief();
    const stats = brief.stats;
    const ack = brief.acknowledgment
      ? `<div class="coach-brief-ack" role="status">${escapeHtml(brief.acknowledgment.text)}</div>`
      : '';
    el.innerHTML = `
      <div class="coach-brief-main">
        <span class="eyebrow-sm">ASCEND Coach</span>
        <h3>${escapeHtml(brief.greeting)}</h3>
        <p class="coach-brief-headline">${escapeHtml(brief.headline)}</p>
        ${ack}
        <div class="coach-focus">
          <span class="coach-focus-label">Today's Focus</span>
          <strong>${escapeHtml(brief.focus.label)}</strong>
          <p>${escapeHtml(brief.focus.message)}</p>
        </div>
        <button type="button" class="btn-primary" onclick="if(window.openWorkoutSession)openWorkoutSession()">▶ ${escapeHtml(brief.cta.label)}</button>
      </div>
      <div class="coach-brief-side">
        <div class="coach-brief-stat"><span>Level</span><b>${stats.level}</b></div>
        <div class="coach-brief-stat"><span>XP</span><b>${stats.xp}</b></div>
        <div class="coach-brief-stat"><span>Streak</span><b>${stats.streak} day${stats.streak === 1 ? '' : 's'}</b></div>
        <div class="coach-brief-stat"><span>Workouts</span><b>${stats.workouts}</b></div>
        <div class="coach-brief-goal">
          <span>Next goal</span>
          <b>${escapeHtml(brief.nextGoal.title)}</b>
          <small>${escapeHtml(brief.nextGoal.detail)}</small>
        </div>
      </div>
    `;
  }

  /* Debounced re-render so bursts of events only refresh the card once */
  let briefRefreshTimer = null;
  function scheduleBriefRefresh() {
    if (briefRefreshTimer) return;
    briefRefreshTimer = setTimeout(() => {
      briefRefreshTimer = null;
      renderBrief();
    }, 60);
  }

  /* ========== RENDERING ========== */

  /**
   * Appends a rich HTML message to the coach chat area.
   * Uses innerHTML for structured content (lists, stats, goals).
   * All dynamic values are escaped via escapeHtml().
   */
  function appendCoachMessage(html, who) {
    const wrap = document.getElementById('coachMsgs');
    if (!wrap) return;
    const m = document.createElement('div');
    m.className = `msg ${who || 'bot'} coach-msg-rich`;
    m.innerHTML = html;
    wrap.appendChild(m);
    wrap.scrollTop = wrap.scrollHeight;
  }

  /** Renders the daily advice as a rich bot message */
  function showDailyAdvice() {
    const advice = generateDailyAdvice();
    const items = advice.map((a) => `<li>${escapeHtml(a)}</li>`).join('');
    appendCoachMessage(`
      <div class="coach-msg-title">📊 Daily Advice</div>
      <ul class="coach-msg-list">${items}</ul>
    `);
  }

  /** Renders the weekly summary as a rich bot message */
  function showWeeklySummary() {
    const s = generateWeeklySummary();
    const best = s.bestWorkout
      ? `${escapeHtml(s.bestWorkout.workoutName || 'Workout')} — ${s.bestWorkout.duration || 0} min, ${s.bestWorkout.calories || 0} kcal`
      : 'No workouts yet this week';

    appendCoachMessage(`
      <div class="coach-msg-title">📈 Weekly Summary</div>
      <div class="coach-msg-stats">
        <div class="coach-msg-stat"><span>Workouts</span><b>${s.workouts}</b></div>
        <div class="coach-msg-stat"><span>Minutes</span><b>${s.minutes}</b></div>
        <div class="coach-msg-stat"><span>Calories</span><b>${s.calories}</b></div>
        <div class="coach-msg-stat"><span>Streak</span><b>${s.streak} days</b></div>
        <div class="coach-msg-stat"><span>Level</span><b>${s.level}</b></div>
        <div class="coach-msg-stat"><span>XP</span><b>${s.xp}</b></div>
      </div>
      <div class="coach-msg-section"><span>Best Workout</span><p>${best}</p></div>
      <div class="coach-msg-section"><span>Suggestion</span><p>${escapeHtml(s.suggestion)}</p></div>
    `);
  }

  /** Renders goal suggestions as a rich bot message */
  function showGoals() {
    const goals = generateGoals();
    const items = goals.map((g) => `
      <div class="coach-msg-goal">
        <span class="coach-msg-goal-icon">${g.icon}</span>
        <div class="coach-msg-goal-text">
          <strong>${escapeHtml(g.title)}</strong>
          <span>${escapeHtml(g.detail)}</span>
        </div>
        <div class="coach-msg-goal-bar"><i style="width:${g.progress}%"></i></div>
      </div>
    `).join('');

    appendCoachMessage(`
      <div class="coach-msg-title">🎯 Your Goals</div>
      <div class="coach-msg-goals">${items}</div>
    `);
  }

  /** Renders a motivational message as a rich bot message */
  function showMotivation() {
    const msg = generateMotivation();
    appendCoachMessage(`
      <div class="coach-msg-title">💪 Motivation</div>
      <p class="coach-msg-quote">${escapeHtml(msg)}</p>
    `);
  }

  /* ========== INITIALIZATION ========== */

  /**
   * Public API: initialize()
   * Overrides the mock coachReply with a personalized response engine,
   * then renders the initial personalized greeting + daily advice.
   */
  function initialize() {
    // Override the mock coachReply with personalized response engine.
    // If the question matches a personalized topic, use real data.
    // Otherwise, defer to the original keyword-based coachReply.
    if (typeof window.coachReply === 'function') {
      const originalCoachReply = window.coachReply;
      window.coachReply = function (text) {
        const personalized = generateResponse(text);
        if (personalized !== null) return personalized;
        return originalCoachReply(text);
      };
    }

    // Keep the coach brief in sync with meaningful ASCEND events
    if (typeof window.addEventListener === 'function') {
      window.addEventListener('ascend:levelUp', scheduleBriefRefresh);
      window.addEventListener('ascend:workoutCompleted', scheduleBriefRefresh);
    }

    // Replace the static greeting with personalized daily advice
    render();
    renderBrief();
  }

  /**
   * Public API: render()
   * Re-renders the coach area with fresh personalized content.
   */
  function render() {
    const wrap = document.getElementById('coachMsgs');
    if (!wrap) return;

    wrap.innerHTML = '';
    const advice = generateDailyAdvice();
    const items = advice.map((a) => `<li>${escapeHtml(a)}</li>`).join('');
    appendCoachMessage(`
      <div class="coach-msg-title">👋 Welcome to ASCEND Coach</div>
      <p>Here's your personalized coaching for today:</p>
      <ul class="coach-msg-list">${items}</ul>
    `);
  }

  /* ========== PUBLIC API ========== */

  return {
    initialize,
    generateDailyAdvice,
    generateWeeklySummary,
    generateGoals,
    generateMotivation,
    generateTodayFocus,
    generateCoachBrief,
    render,
    renderBrief,
    showDailyAdvice,
    showWeeklySummary,
    showGoals,
    showMotivation
  };
})();

window.ASCEND_COACH = ASCEND_COACH;

// Auto-initialize on DOM ready (after all data modules have loaded)
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => ASCEND_COACH.initialize());
} else {
  ASCEND_COACH.initialize();
}