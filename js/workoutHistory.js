'use strict';

const WORKOUT_HISTORY_KEY = 'ascend_workout_history';
const WORKOUT_HISTORY_LIMIT = 50;

function loadWorkoutHistory() {
  try {
    const raw = localStorage.getItem(WORKOUT_HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map(entry => ({ ...entry }));
  } catch (err) {
    console.warn('[ASCEND Workout History] Failed to load workout history:', err);
    return [];
  }
}

function saveWorkoutHistory(history) {
  try {
    const payload = Array.isArray(history) ? history.slice(0, WORKOUT_HISTORY_LIMIT) : [];
    localStorage.setItem(WORKOUT_HISTORY_KEY, JSON.stringify(payload));
    return payload;
  } catch (err) {
    console.warn('[ASCEND Workout History] Failed to save workout history:', err);
    return [];
  }
}

function normalizeWorkoutHistoryRecord(session, xpEarned = 0) {
  if (!session) return null;

  const completedAt = session.completedAt || new Date().toISOString();
  const workoutId = session.id || null;
  const recordId = session._historyRecordId || `${workoutId || session.title || 'workout'}|${completedAt}`;

  return {
    recordId,
    workoutId,
    workoutName: session.title || 'Workout',
    category: session.category || 'Unknown',
    difficulty: session.difficulty || 'Unknown',
    duration: typeof session.totalWorkoutTime === 'number' ? session.totalWorkoutTime : 0,
    caloriesBurned: typeof session.estimatedCalories === 'number' ? session.estimatedCalories : 0,
    exercisesCompleted: Array.isArray(session.exercises) ? session.exercises.map(ex => ex.name || '').filter(Boolean) : [],
    completedAt,
    xpEarned: Number(xpEarned) || 0,
    completedSuccessfully: Boolean(session.completed),
    metadata: {
      createdAt: new Date().toISOString()
    }
  };
}

function addWorkoutHistoryRecord(session, xpEarned = 0) {
  if (!session) return null;
  if (session._historyLogged) return null;

  const history = loadWorkoutHistory();
  const record = normalizeWorkoutHistoryRecord(session, xpEarned);
  if (!record) return null;

  const exists = history.some(item => item.recordId === record.recordId);
  if (exists) {
    session._historyLogged = true;
    return record;
  }

  const updatedHistory = [record, ...history].slice(0, WORKOUT_HISTORY_LIMIT);
  saveWorkoutHistory(updatedHistory);
  session._historyLogged = true;
  session._historyRecordId = record.recordId;
  return record;
}

function getWorkoutHistory() {
  const history = loadWorkoutHistory();
  return history.sort((a, b) => new Date(b.completedAt) - new Date(a.completedAt));
}

function getRecentWorkoutHistory(count = 5) {
  return getWorkoutHistory().slice(0, Math.max(0, Number(count) || 5));
}

function clearWorkoutHistory() {
  try {
    localStorage.removeItem(WORKOUT_HISTORY_KEY);
  } catch (err) {
    console.warn('[ASCEND Workout History] Failed to clear workout history:', err);
  }
}

window.ASCEND_WORKOUT_HISTORY = {
  addRecord: addWorkoutHistoryRecord,
  getHistory: getWorkoutHistory,
  getRecent: getRecentWorkoutHistory,
  clearHistory: clearWorkoutHistory
};

if (typeof window !== 'undefined' && window.addEventListener) {
  window.addEventListener('load', () => {
    if (window.ASCEND_DASHBOARD && typeof window.ASCEND_DASHBOARD.renderDashboard === 'function') {
      window.ASCEND_DASHBOARD.renderDashboard(true);
    }
  });
}
