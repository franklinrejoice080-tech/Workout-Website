'use strict';

/**
 * =========================================
 * ASCEND WORKOUT DISCOVERY & SELECTION ENGINE
 * =========================================
 * Apple × Nike inspired category discovery, workout selection, and session launch flow.
 */

(function () {
  if (window.ASCEND_WORKOUT_DISCOVERY_INITIALIZED) {
    return;
  }
  window.ASCEND_WORKOUT_DISCOVERY_INITIALIZED = true;

  const CATEGORY_MAP = {
    'strength': { name: 'Strength Training', emoji: '💪' },
    'cardio': { name: 'Cardio', emoji: '🏃' },
    'yoga': { name: 'Yoga', emoji: '🧘' },
    'hiit': { name: 'HIIT', emoji: '🔥' },
    'bodybuilding': { name: 'Bodybuilding', emoji: '🏋' },
    'calisthenics': { name: 'Calisthenics', emoji: '🤸' },
    'beginner': { name: 'Beginner Workouts', emoji: '🚶' },
    'mobility': { name: 'Mobility', emoji: '⚡' }
  };

  let workoutsDatabase = [];
  let currentCategory = null;
  let currentWorkout = null;
  let overlayEl = null;
  let contentEl = null;
  let previousActiveElement = null;

  /**
   * Load workouts from data/workouts.json
   */
  async function loadWorkouts() {
    try {
      const res = await fetch('data/workouts.json');
      if (res.ok) {
        workoutsDatabase = await res.json();
      }
    } catch (err) {
      console.warn('[ASCEND Workouts] Could not load workouts.json, using fallback:', err);
    }
  }

  /**
   * Ensures Discovery Modal DOM structure exists
   */
  function ensureDiscoveryDOM() {
    if (overlayEl) return;

    let existing = document.getElementById('workoutDiscoveryOverlay');
    if (existing) {
      overlayEl = existing;
    } else {
      overlayEl = document.createElement('div');
      overlayEl.id = 'workoutDiscoveryOverlay';
      overlayEl.className = 'ascend-discovery-overlay';
      overlayEl.setAttribute('role', 'dialog');
      overlayEl.setAttribute('aria-modal', 'true');
      overlayEl.setAttribute('aria-hidden', 'true');

      overlayEl.innerHTML = `
        <div class="ascend-discovery-card" id="workoutDiscoveryCard">
          <div id="workoutDiscoveryContent"></div>
        </div>
      `;

      document.body.appendChild(overlayEl);
    }

    contentEl = document.getElementById('workoutDiscoveryContent');

    overlayEl.addEventListener('click', (evt) => {
      if (evt.target === overlayEl) {
        closeDiscoveryModal();
      }
    });

    document.addEventListener('keydown', (evt) => {
      if (!overlayEl || !overlayEl.classList.contains('show')) return;
      if (evt.key === 'Escape') {
        evt.preventDefault();
        closeDiscoveryModal();
      }
    });
  }

  /**
   * Open category workout selection list
   * @param {string} catId Category identifier
   */
  function openCategory(catId) {
    ensureDiscoveryDOM();
    currentCategory = catId;
    currentWorkout = null;

    const catInfo = CATEGORY_MAP[catId] || { name: 'Workouts', emoji: '🏋' };
    const matchingWorkouts = workoutsDatabase.filter(w => w.category === catId);

    previousActiveElement = document.activeElement;

    renderCategoryWorkoutsView(catInfo, matchingWorkouts);
    showOverlay();
  }

  /**
   * Renders the category workouts selection list
   */
  function renderCategoryWorkoutsView(catInfo, workouts) {
    if (!contentEl) return;

    let html = `
      <div class="ascend-disc-head">
        <div class="ascend-disc-title-group">
          <span class="ascend-disc-eyebrow">${catInfo.emoji} DISCIPLINE</span>
          <h2 class="ascend-disc-title">${catInfo.name}</h2>
          <span class="ascend-disc-sub">${workouts.length} ${workouts.length === 1 ? 'workout' : 'workouts'} available</span>
        </div>
        <button type="button" class="ascend-disc-close-btn" id="discCloseBtn" aria-label="Close workout selection">✕</button>
      </div>
    `;

    if (workouts.length === 0) {
      html += `
        <div class="ascend-disc-empty">
          <div class="ascend-disc-empty-icon">⚡</div>
          <h3>No workouts available yet.</h3>
          <p>Check back soon or explore other training disciplines.</p>
          <button type="button" class="ascend-disc-btn secondary" id="discBackToCatsBtn">← Back to Categories</button>
        </div>
      `;
    } else {
      html += `<div class="ascend-disc-grid">`;
      workouts.forEach(w => {
        html += `
          <div class="ascend-disc-workout-card" data-workout-id="${w.id}">
            <div class="ascend-disc-card-head">
              <span class="ascend-disc-diff-tag diff-${(w.difficulty || 'intermediate').toLowerCase().replace(/\s+/g, '-')}">${w.difficulty}</span>
              <span class="ascend-disc-duration">⏱ ${w.duration} mins</span>
            </div>
            <h3 class="ascend-disc-workout-name">${w.name}</h3>
            <p class="ascend-disc-workout-desc">${w.description}</p>
            <div class="ascend-disc-workout-foot">
              <span class="ascend-disc-ex-count">${w.exercises ? w.exercises.length : 0} exercises · 🔥 ${w.calories || 300} kcal</span>
              <button type="button" class="ascend-disc-btn primary select-workout-btn" data-workout-id="${w.id}">View Workout</button>
            </div>
          </div>
        `;
      });
      html += `</div>`;
    }

    contentEl.innerHTML = html;
    attachCategoryEvents();
  }

  /**
   * Open detailed workout overview before starting
   * @param {Object} workout Workout object
   */
  function openWorkoutDetails(workout) {
    if (!workout || !contentEl) return;
    currentWorkout = workout;

    const catInfo = CATEGORY_MAP[workout.category] || { name: 'Workout', emoji: '🏋' };

    let exercisesHtml = '';
    if (Array.isArray(workout.exercises)) {
      workout.exercises.forEach((ex, idx) => {
        exercisesHtml += `
          <div class="ascend-disc-detail-ex-item">
            <div class="ascend-disc-ex-num">${idx + 1}</div>
            <div class="ascend-disc-ex-info">
              <h4>${ex.name}</h4>
              <span class="ascend-disc-ex-target">${ex.muscle || 'Full Body'} · ${ex.repsOrDuration || '3 sets'}</span>
            </div>
            <div class="ascend-disc-ex-meta">
              <span>Rest: ${ex.restDuration || 30}s</span>
            </div>
          </div>
        `;
      });
    }

    contentEl.innerHTML = `
      <div class="ascend-disc-detail-head">
        <button type="button" class="ascend-disc-back-btn" id="detailBackBtn">← Back to ${catInfo.name}</button>
        <button type="button" class="ascend-disc-close-btn" id="discCloseBtn" aria-label="Close workout overview">✕</button>
      </div>

      <div class="ascend-disc-detail-body">
        <div class="ascend-disc-detail-tags">
          <span class="ascend-disc-cat-pill">${catInfo.emoji} ${catInfo.name}</span>
          <span class="ascend-disc-diff-tag diff-${(workout.difficulty || 'intermediate').toLowerCase().replace(/\s+/g, '-')}">${workout.difficulty}</span>
        </div>

        <h2 class="ascend-disc-detail-title">${workout.name}</h2>
        <p class="ascend-disc-detail-desc">${workout.description}</p>

        <div class="ascend-disc-detail-stats-bar">
          <div class="ascend-disc-stat-pill">
            <span class="lbl">Duration</span>
            <span class="val">⏱ ${workout.duration} mins</span>
          </div>
          <div class="ascend-disc-stat-pill">
            <span class="lbl">Est. Calories</span>
            <span class="val">🔥 ${workout.calories} kcal</span>
          </div>
          <div class="ascend-disc-stat-pill">
            <span class="lbl">Exercises</span>
            <span class="val">🏋 ${workout.exercises ? workout.exercises.length : 0} items</span>
          </div>
        </div>

        <div class="ascend-disc-ex-list-section">
          <h3>Workout Routine (${workout.exercises ? workout.exercises.length : 0} Exercises)</h3>
          <div class="ascend-disc-ex-list">
            ${exercisesHtml}
          </div>
        </div>
      </div>

      <div class="ascend-disc-detail-actions">
        <button type="button" class="ascend-disc-btn start-now-btn" id="startDiscoveryWorkoutBtn">
          <span>⚡ START WORKOUT</span>
        </button>
      </div>
    `;

    attachDetailEvents();
  }

  /**
   * Attach category view event listeners
   */
  function attachCategoryEvents() {
    const closeBtn = document.getElementById('discCloseBtn');
    if (closeBtn) closeBtn.addEventListener('click', closeDiscoveryModal);

    const backBtn = document.getElementById('discBackToCatsBtn');
    if (backBtn) backBtn.addEventListener('click', closeDiscoveryModal);

    const workoutCards = contentEl.querySelectorAll('.ascend-disc-workout-card');
    workoutCards.forEach(card => {
      card.addEventListener('click', () => {
        const id = card.getAttribute('data-workout-id');
        const w = workoutsDatabase.find(item => item.id === id);
        if (w) openWorkoutDetails(w);
      });
    });
  }

  /**
   * Attach workout detail view event listeners
   */
  function attachDetailEvents() {
    const closeBtn = document.getElementById('discCloseBtn');
    if (closeBtn) closeBtn.addEventListener('click', closeDiscoveryModal);

    const backBtn = document.getElementById('detailBackBtn');
    if (backBtn && currentCategory) {
      backBtn.addEventListener('click', () => {
        const catInfo = CATEGORY_MAP[currentCategory] || { name: 'Workouts', emoji: '🏋' };
        const matching = workoutsDatabase.filter(w => w.category === currentCategory);
        renderCategoryWorkoutsView(catInfo, matching);
      });
    }

    const startBtn = contentEl.querySelector('#startDiscoveryWorkoutBtn');
    if (startBtn && currentWorkout) {
      startBtn.addEventListener('click', () => {
        launchSelectedWorkout(currentWorkout);
      });
    }
  }

  /**
   * Launches selected workout session via existing script.js / workoutEngine session architecture
   * @param {Object} workout 
   */
  function launchSelectedWorkout(workout) {
    if (!workout) return;

    // Convert workout model into workoutEngine session format
    const exercises = Array.isArray(workout.exercises) ? workout.exercises.map(ex => ({
      id: `ex-${ex.id}-${Math.random().toString(36).slice(2, 7)}`,
      name: ex.name,
      detail: ex.instructions || ex.muscle || '',
      repsOrDuration: ex.repsOrDuration || '3 × 10 reps',
      durationSeconds: ex.durationSeconds || 45,
      restDuration: ex.restDuration || 30,
      calories: ex.calories || 60
    })) : [];

    const session = {
      id: workout.id || null,
      title: workout.name,
      category: workout.category,
      difficulty: workout.difficulty || null,
      exercises,
      estimatedCalories: workout.calories || exercises.reduce((s, e) => s + e.calories, 0),
      totalWorkoutTime: workout.duration || 35
    };

    closeDiscoveryModal();

    // Trigger existing openWorkoutSession flow
    if (typeof window.openWorkoutSession === 'function') {
      window.openWorkoutSession(session);
    } else {
      console.warn('[ASCEND Workouts] openWorkoutSession function not available globally.');
    }
  }

  function showOverlay() {
    if (!overlayEl) return;
    document.body.classList.add('ascend-modal-open');
    overlayEl.setAttribute('aria-hidden', 'false');
    void overlayEl.offsetWidth;
    overlayEl.classList.add('show');

    const focusable = contentEl.querySelector('button, [tabindex="0"]');
    if (focusable) setTimeout(() => focusable.focus(), 80);
  }

  function closeDiscoveryModal() {
    if (!overlayEl || !overlayEl.classList.contains('show')) return;
    overlayEl.classList.remove('show');
    overlayEl.setAttribute('aria-hidden', 'true');
    setTimeout(() => {
      document.body.classList.remove('ascend-modal-open');
      if (previousActiveElement && typeof previousActiveElement.focus === 'function') {
        try { previousActiveElement.focus(); } catch (e) {}
      }
    }, 350);
  }

  /**
   * Initializes category cards on `#catGrid`
   */
  function initCategoryCards() {
    const catGrid = document.getElementById('catGrid');
    if (!catGrid) return;

    const catIdList = ['strength', 'cardio', 'yoga', 'hiit', 'bodybuilding', 'calisthenics', 'beginner', 'mobility'];

    const cards = catGrid.querySelectorAll('.cat-card');
    cards.forEach((card, index) => {
      const catId = card.getAttribute('data-category') || catIdList[index] || 'strength';
      card.setAttribute('data-category', catId);
      card.setAttribute('role', 'button');
      card.setAttribute('tabindex', '0');
      card.setAttribute('aria-label', `Explore ${card.querySelector('h4')?.textContent || 'Category'} Workouts`);

      card.addEventListener('click', () => openCategory(catId));
      card.addEventListener('keydown', (evt) => {
        if (evt.key === 'Enter' || evt.key === ' ') {
          evt.preventDefault();
          openCategory(catId);
        }
      });
    });
  }

  // Initialize on load
  document.addEventListener('DOMContentLoaded', async () => {
    await loadWorkouts();
    initCategoryCards();
  });

  // Backup load check if DOMContentLoaded already fired
  if (document.readyState !== 'loading') {
    loadWorkouts().then(() => initCategoryCards());
  }

  // Expose public API
  window.ASCEND_WORKOUT_DISCOVERY = {
    openCategory,
    openWorkoutDetails,
    close: closeDiscoveryModal,
    setWorkouts: (list) => { workoutsDatabase = list; }
  };
})();
