/* ---------- init hero ---------- */
window.addEventListener('load', ()=>{ document.querySelector('.hero').classList.add('loaded'); });

/* ---------- nav scroll ---------- */
const nav = document.getElementById('nav');
window.addEventListener('scroll', ()=>{
  nav.classList.toggle('scrolled', window.scrollY > 40);
});

/* ---------- scroll reveal ---------- */
const io = new IntersectionObserver((entries)=>{
  entries.forEach(e=>{ if(e.isIntersecting){ e.target.classList.add('in'); io.unobserve(e.target); } });
},{threshold:0.15});
document.querySelectorAll('.reveal').forEach(el=>io.observe(el));

/* ---------- toast ---------- */
function showToast(msg){
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(()=>t.classList.remove('show'), 2600);
}

/* ---------- workout engine foundation ---------- */
// This keeps workout logic reusable and isolated from the existing UI code.
// It provides the internal data structures needed for future workout sessions
// without changing any visible behavior yet.
const startTodayWorkoutButton = document.getElementById('startTodayWorkoutBtn');
if (startTodayWorkoutButton) {
  startTodayWorkoutButton.addEventListener('click', (event) => {
    event.preventDefault();
    openWorkoutSession();
  });
}

const workoutEngine = (() => {
  let activeSession = null;

  function createExercise({
    name,
    detail = '',
    repsOrDuration = '',
    restDuration = 0,
    calories = 0
  } = {}) {
    return {
      id: `${name}-${Math.random().toString(36).slice(2, 8)}`,
      name,
      detail,
      repsOrDuration,
      restDuration,
      calories
    };
  }

  function createWorkoutSession({
    title = 'Workout',
    exercises = [],
    estimatedCalories = 0,
    totalWorkoutTime = 0
  } = {}) {
    const normalizedExercises = exercises.map((exercise, index) => {
      if (typeof exercise === 'string') {
        return createExercise({ name: exercise, repsOrDuration: '1 round' });
      }

      return {
        ...exercise,
        id: exercise.id || `${(exercise.name || `exercise-${index + 1}`).toLowerCase().replace(/\s+/g, '-')}-${Math.random().toString(36).slice(2, 8)}`,
        repsOrDuration: exercise.repsOrDuration ?? '',
        restDuration: exercise.restDuration ?? 0,
        calories: exercise.calories ?? 0
      };
    });

    const computedCalories = estimatedCalories || normalizedExercises.reduce((sum, exercise) => sum + (exercise.calories || 0), 0);
    const computedTime = totalWorkoutTime || normalizedExercises.reduce((sum, exercise) => sum + (Number(exercise.restDuration) || 0), 0) + normalizedExercises.length * 60;

    return {
      title,
      exercises: normalizedExercises,
      estimatedCalories: computedCalories,
      totalWorkoutTime: computedTime,
      currentExerciseIndex: 0,
      completed: false,
      started: false,
      completedAt: null
    };
  }

  function setCurrentExerciseIndex(session, index) {
    if (!session || !Array.isArray(session.exercises)) return null;
    const safeIndex = Math.max(0, Math.min(index, session.exercises.length - 1));
    session.currentExerciseIndex = safeIndex;
    return session;
  }

  function getCurrentExercise(session) {
    if (!session || !Array.isArray(session.exercises) || session.exercises.length === 0) return null;
    return session.exercises[Math.min(session.currentExerciseIndex, session.exercises.length - 1)] || null;
  }

  function advanceToNextExercise(session) {
    if (!session || !Array.isArray(session.exercises) || session.exercises.length === 0) return { session, completed: false, finished: false };

    if (session.currentExerciseIndex >= session.exercises.length - 1) {
      markWorkoutComplete(session);
      return { session, completed: true, finished: true };
    }

    session.currentExerciseIndex += 1;
    return { session, completed: false, finished: false };
  }

  function markWorkoutComplete(session) {
    if (!session) return null;
    session.completed = true;
    session.completedAt = new Date().toISOString();
    return session;
  }

  function resetWorkoutSession(session) {
    if (!session) return null;
    session.currentExerciseIndex = 0;
    session.completed = false;
    session.started = false;
    session.completedAt = null;
    return session;
  }

  function getWorkoutSummary(session) {
    if (!session) return null;

    const totalExercises = session.exercises.length;
    const currentExerciseIndex = totalExercises ? Math.min(session.currentExerciseIndex, totalExercises - 1) : 0;
    const currentExercise = totalExercises ? session.exercises[currentExerciseIndex] : null;

    const completedExercises = session.completed ? totalExercises : Math.min(currentExerciseIndex + 1, totalExercises);

    return {
      title: session.title,
      exerciseCount: totalExercises,
      currentExerciseIndex: currentExerciseIndex,
      currentExercise,
      completed: session.completed,
      estimatedCalories: session.estimatedCalories,
      totalWorkoutTime: session.totalWorkoutTime,
      completedExercises,
      progressPercent: totalExercises ? Math.round(((currentExerciseIndex + 1) / totalExercises) * 100) : 100
    };
  }

  function setActiveSession(session) {
    activeSession = session;
    return activeSession;
  }

  function getActiveSession() {
    return activeSession;
  }

  return {
    createExercise,
    createWorkoutSession,
    setCurrentExerciseIndex,
    getCurrentExercise,
    advanceToNextExercise,
    markWorkoutComplete,
    resetWorkoutSession,
    getWorkoutSummary,
    setActiveSession,
    getActiveSession
  };
})();


/* ---------- auth ---------- */
const authStorageKey = 'ascend-users';
const currentUserKey = 'ascend-current-user';
let authMode = 'login';

function escapeHtml(value){
  return String(value)
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;')
    .replace(/'/g,'&#39;');
}

function getStoredUsers(){
  try { return JSON.parse(localStorage.getItem(authStorageKey)) || []; }
  catch { return []; }
}

function saveStoredUsers(users){
  localStorage.setItem(authStorageKey, JSON.stringify(users));
}

function getCurrentUser(){
  try { return JSON.parse(localStorage.getItem(currentUserKey)); }
  catch { return null; }
}

function setCurrentUser(user){
  if(user){ localStorage.setItem(currentUserKey, JSON.stringify(user)); }
  else { localStorage.removeItem(currentUserKey); }
}

function renderAuthNav(){
  const container = document.getElementById('navAuth');
  const user = getCurrentUser();
  if(user){
    container.innerHTML = `
      <div class="user-menu-wrapper">
        <button class="user-pill" type="button" aria-haspopup="menu" aria-expanded="false" onclick="toggleUserMenu()">
          <span class="user-pill-icon">👤</span>
          Hello, ${escapeHtml(user.name.split(' ')[0] || user.name)}
        </button>
        <div class="user-dropdown" id="userDropdown" role="menu">
          <a href="#progress" role="menuitem" onclick="closeUserMenu()">Dashboard</a>
          <a href="#about" role="menuitem" onclick="closeUserMenu()">Profile</a>
          <button type="button" role="menuitem" onclick="logout()">Logout</button>
        </div>
      </div>`;
  } else {
    container.innerHTML = `
      <a href="#" class="btn-ghost" onclick="openAuthModal('login'); return false;">Login</a>
      <a href="#" class="btn-solid" onclick="openAuthModal('signup'); return false;">Sign Up</a>`;
  }
}

function toggleUserMenu(){
  const dropdown = document.getElementById('userDropdown');
  const button = document.querySelector('.user-pill');
  if(!dropdown) return;
  const open = dropdown.classList.toggle('show');
  button?.setAttribute('aria-expanded', open ? 'true' : 'false');
}

function closeUserMenu(){
  const dropdown = document.getElementById('userDropdown');
  const button = document.querySelector('.user-pill');
  dropdown?.classList.remove('show');
  button?.setAttribute('aria-expanded', 'false');
}

function logout(){
  setCurrentUser(null);
  renderAuthNav();
  closeUserMenu();
  showToast('You have been logged out.');
}

function openAuthModal(mode){
  authMode = mode;
  const overlay = document.getElementById('authOverlay');
  const title = document.getElementById('authTitle');
  const subtitle = document.getElementById('authSubtitle');
  const submitBtn = document.getElementById('authSubmitBtn');
  const switchText = document.getElementById('authSwitchText');
  const switchBtn = document.getElementById('authSwitchBtn');
  const nameWrap = document.getElementById('signupNameWrap');
  const confirmWrap = document.getElementById('confirmPasswordWrap');
  const form = document.getElementById('authForm');
  const email = document.getElementById('authEmail');
  const password = document.getElementById('authPassword');
  const confirm = document.getElementById('authConfirmPassword');

  title.textContent = mode === 'signup' ? 'Create your ASCEND account' : 'Log in to ASCEND';
  subtitle.textContent = mode === 'signup' ? 'Start your daily streak with a smarter routine.' : 'Access your daily plan, progress, and coach.';
  submitBtn.textContent = mode === 'signup' ? 'Create Account' : 'Log In';
  switchText.textContent = mode === 'signup' ? 'Already have an account?' : 'Don’t have an account?';
  switchBtn.textContent = mode === 'signup' ? 'Log in' : 'Create one';
  nameWrap.classList.toggle('hidden', mode !== 'signup');
  confirmWrap.classList.toggle('hidden', mode !== 'signup');
  form.reset();
  clearAuthFeedback();
  overlay.classList.add('show');
  overlay.setAttribute('aria-hidden','false');
  document.body.style.overflow = 'hidden';
  setTimeout(()=>{ (mode === 'signup' ? document.getElementById('signupName') : email).focus(); }, 50);
}

function closeAuthModal(){
  const overlay = document.getElementById('authOverlay');
  overlay.classList.remove('show');
  overlay.setAttribute('aria-hidden','true');
  document.body.style.overflow = '';
  clearAuthFeedback();
}

function switchAuthMode(){
  openAuthModal(authMode === 'login' ? 'signup' : 'login');
}

function setAuthError(message){
  const errorBox = document.getElementById('authError');
  errorBox.textContent = message;
  errorBox.classList.add('show');
  const successBox = document.getElementById('authSuccess');
  successBox.classList.remove('show');
}

function setAuthSuccess(message){
  const successBox = document.getElementById('authSuccess');
  successBox.textContent = message;
  successBox.classList.add('show');
  const errorBox = document.getElementById('authError');
  errorBox.classList.remove('show');
}

function clearAuthFeedback(){
  document.getElementById('authError').className = 'auth-error';
  document.getElementById('authSuccess').className = 'auth-success';
}

function setSubmitLoading(isLoading, label){
  const btn = document.getElementById('authSubmitBtn');
  btn.disabled = isLoading;
  btn.classList.toggle('loading', isLoading);
  btn.innerHTML = isLoading ? '<span class="auth-spinner"></span>' + label : label;
}

function togglePasswordVisibility(inputId, button){
  const input = document.getElementById(inputId);
  const show = input.type === 'password';
  input.type = show ? 'text' : 'password';
  button.textContent = show ? '🙈' : '👁';
  button.setAttribute('aria-label', show ? 'Hide password' : 'Show password');
}

function handleForgotPassword(){
  setAuthError('Password reset is not enabled in this demo yet. Please create a new account or use your existing password.');
}

function handleAuthSubmit(event){
  event.preventDefault();
  const name = document.getElementById('signupName')?.value.trim() || '';
  const email = document.getElementById('authEmail').value.trim().toLowerCase();
  const password = document.getElementById('authPassword').value;
  const confirmPassword = document.getElementById('authConfirmPassword').value;
  const remember = document.getElementById('authRemember').checked;

  clearAuthFeedback();

  if(authMode === 'signup'){
    if(!name){ setAuthError('Please enter your name.'); return; }
    if(!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)){ setAuthError('Please enter a valid email address.'); return; }
    if(password.length < 6){ setAuthError('Password must be at least 6 characters.'); return; }
    if(password !== confirmPassword){ setAuthError('Passwords do not match.'); return; }
  } else {
    if(!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)){ setAuthError('Please enter a valid email address.'); return; }
    if(!password){ setAuthError('Please enter your password.'); return; }
  }

  const actionLabel = authMode === 'signup' ? 'Creating account...' : 'Signing you in...';
  setSubmitLoading(true, actionLabel);

  setTimeout(()=>{
    const users = getStoredUsers();
    if(authMode === 'signup'){
      const existing = users.find(user => user.email.toLowerCase() === email);
      if(existing){
        setSubmitLoading(false, 'Create Account');
        setAuthError('An account with this email already exists.');
        return;
      }
      const newUser = { name, email, password, remember };
      users.push(newUser);
      saveStoredUsers(users);
      setCurrentUser({ name, email, remember });
      renderAuthNav();
      setAuthSuccess(`Welcome aboard, ${name}! Your account is ready.`);
      setSubmitLoading(false, 'Create Account');
      setTimeout(()=>{ closeAuthModal(); showToast(`Welcome, ${name}!`); }, 900);
    } else {
      const match = users.find(user => user.email.toLowerCase() === email && user.password === password);
      if(!match){
        setSubmitLoading(false, 'Log In');
        setAuthError('The email or password is incorrect.');
        return;
      }
      setCurrentUser({ name: match.name, email: match.email, remember });
      renderAuthNav();
      setAuthSuccess(`Welcome back, ${match.name}!`);
      setSubmitLoading(false, 'Log In');
      setTimeout(()=>{ closeAuthModal(); showToast(`Welcome back, ${match.name}!`); }, 900);
    }
  }, 700);
}

function attachAuthEvents(){
  document.getElementById('authForm').addEventListener('submit', handleAuthSubmit);
  document.getElementById('authOverlay').addEventListener('click', (event)=>{
    if(event.target.id === 'authOverlay') closeAuthModal();
  });
  document.addEventListener('click', (event)=>{
    if(!event.target.closest('.user-menu-wrapper')) closeUserMenu();
  });
}

/* ---------- daily workout ring ---------- */
let workoutDone = false;
let currentWorkoutSession = null;
let workoutSessionActive = false;
let workoutSessionPaused = false;

/* ---------- exercise countdown timer ---------- */
const workoutTimer = {
  intervalId: null,
  remainingSeconds: 0,
  running: false,
  boundUpdate: null
};

function formatTime(s){
  const mm = String(Math.floor(s/60)).padStart(2,'0');
  const ss = String(s%60).padStart(2,'0');
  return `${mm}:${ss}`;
}

function startExerciseTimer(session){
  if(!session) return;
  // prevent multiple timers
  if(workoutTimer.intervalId) return;

  workoutTimer.mode = 'exercise';

  const exercise = workoutEngine.getCurrentExercise(session);
  if(!exercise) return;

  // remainingSeconds stored on session to persist pause/resume
  if(typeof session._exerciseRemaining === 'number' && session._exerciseRemaining > 0){
    workoutTimer.remainingSeconds = session._exerciseRemaining;
  } else {
    workoutTimer.remainingSeconds = Number(exercise.durationSeconds) || 60;
    session._exerciseRemaining = workoutTimer.remainingSeconds;
    session._exerciseComplete = false;
  }

  workoutTimer.running = true;
  // update UI immediately
  renderWorkoutSession();

  workoutTimer.intervalId = setInterval(()=>{
    workoutTimer.remainingSeconds -= 1;
    session._exerciseRemaining = workoutTimer.remainingSeconds;
    if(workoutTimer.remainingSeconds <= 0){
      clearInterval(workoutTimer.intervalId);
      workoutTimer.intervalId = null;
      workoutTimer.running = false;
      session._exerciseRemaining = 0;
      session._exerciseComplete = true;
      // when exercise ends — either start rest or finish workout
      const idx = (typeof session.currentExerciseIndex === 'number') ? session.currentExerciseIndex : Number(session.currentExerciseIndex) || 0;
      const nextIndex = idx + 1;
      const hasNext = Array.isArray(session.exercises) && (nextIndex < session.exercises.length);
      renderWorkoutSession();
      showToast('Exercise Complete');
      if(hasNext){
        // begin rest automatically before next exercise
        startRestTimer(session);
      } else {
        // final exercise — mark workout complete
        session.status = 'completed';
        workoutEngine.markWorkoutComplete(session);
        renderWorkoutSession();
      }
      return;
    }
    // update visible timer
    renderWorkoutSession();
  }, 1000);
}

function pauseTimer(session){
  if(workoutTimer.intervalId){
    clearInterval(workoutTimer.intervalId);
    workoutTimer.intervalId = null;
    workoutTimer.running = false;
    if(session){
      if(workoutTimer.mode === 'exercise') session._exerciseRemaining = workoutTimer.remainingSeconds;
      if(workoutTimer.mode === 'rest') session._restRemaining = workoutTimer.remainingSeconds;
    }
  }
}

function resumeTimer(session){
  if(!session) return;
  if(workoutTimer.intervalId) return; // already running
  // resume based on current mode
  if(workoutTimer.mode === 'rest' || session._inRest){
    // if rest remaining exists, resume rest
    if(typeof session._restRemaining === 'number' && session._restRemaining > 0){
      startRestTimer(session);
      return;
    }
    // nothing to resume -> no-op
    return;
  }

  // default resume exercise
  if(typeof session._exerciseRemaining === 'number' && session._exerciseRemaining > 0){
    startExerciseTimer(session);
    return;
  }
  // otherwise start fresh exercise
  startExerciseTimer(session);
}

function startRestTimer(session){
  if(!session) return;
  // prevent multiple timers
  if(workoutTimer.intervalId) return;
  workoutTimer.mode = 'rest';
  const idx = (typeof session.currentExerciseIndex === 'number') ? session.currentExerciseIndex : Number(session.currentExerciseIndex) || 0;
  const current = session.exercises[idx];
  const restFrom = Number(current && current.restDuration) || 30;
  // if rest remaining saved (paused), use it
  if(typeof session._restRemaining === 'number' && session._restRemaining > 0){
    workoutTimer.remainingSeconds = session._restRemaining;
  } else {
    workoutTimer.remainingSeconds = restFrom;
    session._restRemaining = workoutTimer.remainingSeconds;
  }
  session._inRest = true;
  workoutTimer.running = true;
  renderWorkoutSession();
  workoutTimer.intervalId = setInterval(()=>{
    workoutTimer.remainingSeconds -= 1;
    session._restRemaining = workoutTimer.remainingSeconds;
    if(workoutTimer.remainingSeconds <= 0){
      clearInterval(workoutTimer.intervalId);
      workoutTimer.intervalId = null;
      workoutTimer.running = false;
      session._restRemaining = 0;
      session._inRest = false;
      // advance to next exercise and start it
      workoutEngine.setActiveSession(session);
      // reset any per-exercise state for the new exercise
      session._exerciseRemaining = undefined;
      session._exerciseComplete = false;
      renderWorkoutSession();
      if(result && result.completed){
    session.status = 'completed';

    workoutEngine.markWorkoutComplete(session);

    // Award XP and save workout
    if(window.ASCEND_XP){
        window.ASCEND_XP.completeWorkout();
    }

    renderWorkoutSession();

    showToast("Workout Complete! +120 XP 💪");

} else {
        // start next exercise automatically
        startExerciseTimer(session);
      }
      return;
    }
    renderWorkoutSession();
  }, 1000);
}
      const result = workoutEngine.advanceToNextExercise(session);

function getWorkoutSessionActionMarkup(session){
  if(!session) return '';

  if(session.completed){
    return `
      <button onclick="returnHomeFromWorkout()">Return Home</button>
      <button class="primary" onclick="startWorkoutAgain()">Start Again</button>
      <button class="success" onclick="viewDashboardFromWorkout()">View Dashboard</button>
    `;
  }

  return `
    <button class="primary" onclick="startWorkoutSessionAction()">Start Workout</button>
    <button onclick="pauseWorkout()">Pause</button>
    <button onclick="resumeWorkout()">Resume</button>
    <button onclick="skipExercise()">Next Exercise</button>
    <button class="success" onclick="endWorkout()">End Workout</button>
    <button onclick="returnHomeFromWorkout()">Return Home</button>
  `;
}

function getWorkoutSessionMarkup(session){
  if(!session) return '<div class="workout-session-empty">No workout session is available.</div>';

  const summary = workoutEngine.getWorkoutSummary(session);
  const currentExercise = summary.currentExercise;
  const exerciseNumber = summary.exerciseCount ? summary.currentExerciseIndex + 1 : 0;
  const totalExercises = summary.exerciseCount;
  const progressPercent = summary.progressPercent;
  const isPaused = Boolean(session.status === 'paused' || workoutSessionPaused);
  const statusText = session.completed ? 'Completed' : isPaused ? 'Paused' : session.started ? 'Running' : 'Ready';

  if(session.completed){
    return `
      <div class="workout-session-head">
        <span class="eyebrow-sm">Workout Complete</span>
        <h3>${summary.title}</h3>
        <p style="color:var(--gray); line-height:1.6;">You finished your session with focus and consistency.</p>
        <div class="workout-session-meta">
          <span>Total time: ${summary.totalWorkoutTime} min</span>
          <span>Calories burned: ${summary.estimatedCalories} kcal</span>
          <span>Exercises completed: ${summary.completedExercises}</span>
        </div>
      </div>
      <div class="workout-session-body">
        <div class="exercise-card">
          <h4>Session complete</h4>
          <p>Your workout has been logged in the engine and is ready for future sessions.</p>
        </div>
      </div>
    `;
  }

  return `
    <div class="workout-session-head">
      <span class="eyebrow-sm">Workout Session</span>
      <h3>${summary.title}</h3>
      <p style="color:var(--gray); line-height:1.6;">A focused session is ready to begin. Progress updates as you move through each exercise.</p>
      <div class="workout-session-meta">
        <span>Exercise ${exerciseNumber} of ${totalExercises}</span>
        <span>Status: ${statusText}</span>
        <span>Calories: ${summary.estimatedCalories} kcal</span>
        <span>Time: ${summary.totalWorkoutTime} min</span>
      </div>
      <div style="margin-top:16px;">
        <div style="height:6px; border-radius:999px; background:rgba(245,245,242,0.08); overflow:hidden;">
          <div style="height:100%; width:${progressPercent}%; background:var(--red); border-radius:999px;"></div>
        </div>
        <div style="margin-top:8px; font-size:12px; color:var(--gray);">Progress ${progressPercent}%</div>
      </div>
    </div>
    <div class="workout-session-body">
      <div class="exercise-card">
        <h4>${currentExercise ? currentExercise.name : 'Workout complete'}</h4>
        <p>${currentExercise ? (currentExercise.repsOrDuration || 'Set your pace') : 'You have finished the workout.'}</p>
        <div class="exercise-timer-wrap" style="margin-top:12px;">
          ${ (session._inRest || workoutTimer.mode === 'rest') ? (()=>{
              const curIdx = (typeof session.currentExerciseIndex === 'number') ? session.currentExerciseIndex : Number(session.currentExerciseIndex) || 0;
              const nextIdx = Math.min(curIdx + 1, (session.exercises||[]).length - 1);
              const nextEx = session.exercises && session.exercises[nextIdx];
              const restRem = typeof session._restRemaining === 'number' ? session._restRemaining : 0;
              return `
                <div style="font-size:14px; font-weight:700;">Rest Time</div>
                <div style="font-size:28px; font-weight:700; margin-top:6px;">${formatTime(restRem)}</div>
                <div style="font-size:12px; color:var(--gray); margin-top:6px;">Next: ${nextEx ? nextEx.name : '—'} (Exercise ${nextIdx+1} of ${totalExercises})</div>
              `;
            })()
           : session._exerciseComplete ? `<div class="exercise-complete" style="font-weight:600;color:var(--beige);">Exercise Complete</div>` : `
            <div style="font-size:28px; font-weight:700;">${formatTime(typeof session._exerciseRemaining === 'number' ? session._exerciseRemaining : (currentExercise ? (currentExercise.durationSeconds || 60) : 0))}</div>
            <div style="font-size:12px; color:var(--gray); margin-top:6px;">${session.status === 'paused' || workoutSessionPaused ? 'Paused' : session.status === 'running' ? 'In progress' : 'Ready'}</div>
          `}
        </div>
      </div>
    </div>
  `;
}

function renderWorkoutSession(){
  const viewport = document.getElementById('workoutSessionViewport');
  const actions = document.getElementById('workoutSessionActions');
  const activeSession = workoutEngine.getActiveSession() || currentWorkoutSession;
  if(!viewport) return;
  viewport.innerHTML = getWorkoutSessionMarkup(activeSession);
  if(actions){
    actions.innerHTML = getWorkoutSessionActionMarkup(activeSession);
  }
}

function startWorkoutSessionAction(){
  const activeSession = workoutEngine.getActiveSession() || currentWorkoutSession;
  if(!activeSession) return;
  activeSession.started = true;
  activeSession.status = 'running';
  workoutSessionPaused = false;
  renderWorkoutSession();
  showToast('Workout started.');
  // start the exercise countdown timer for the current exercise
  startExerciseTimer(activeSession);
}

function createWorkoutTemplateSession(){
  const createdSession = workoutEngine.createWorkoutSession({
    title: 'Strength Workout',
    exercises: [
      { name: 'Push Ups', repsOrDuration: '3 x 12 reps', restDuration: 45, calories: 110 },
      { name: 'Bench Press', repsOrDuration: '3 x 10 reps', restDuration: 60, calories: 140 },
      { name: 'Shoulder Press', repsOrDuration: '3 x 10 reps', restDuration: 45, calories: 120 },
      { name: 'Rows', repsOrDuration: '3 x 12 reps', restDuration: 45, calories: 125 },
      { name: 'Plank', repsOrDuration: '3 x 45 sec', restDuration: 30, calories: 80 }
    ],
    estimatedCalories: 320,
    totalWorkoutTime: 35
  });

  // compute a sensible per-exercise duration (seconds) from repsOrDuration when possible
  createdSession.exercises.forEach((ex)=>{
    const txt = String(ex.repsOrDuration || '').toLowerCase();
    let dur = 60;
    const minMatch = txt.match(/(\d+)\s*min/);
    const secMatch = txt.match(/(\d+)\s*(?:sec|s)\b/);
    if(minMatch){ dur = Number(minMatch[1]) * 60; }
    else if(secMatch){ dur = Number(secMatch[1]); }
    else if(txt.includes('rep')){ dur = 90; }
    ex.durationSeconds = dur;
  });

  createdSession.started = false;
  createdSession.status = 'ready';
  createdSession.currentExerciseIndex = 0;
  createdSession.completed = false;
  createdSession.completedAt = null;
  createdSession._exerciseRemaining = undefined;
  createdSession._exerciseComplete = false;
  createdSession._restRemaining = undefined;
  createdSession._inRest = false;

  return createdSession;
}

function openWorkoutSession(){
  const overlay = document.getElementById('workoutSessionOverlay');
  if(!overlay) return;

  const createdSession = createWorkoutTemplateSession();

  currentWorkoutSession = createdSession;
  workoutEngine.setActiveSession(createdSession);
  workoutSessionActive = true;
  workoutSessionPaused = false;
  renderWorkoutSession();
  overlay.classList.add('show');
  document.body.style.overflow = 'hidden';

  const hero = document.querySelector('.hero');
  const dailySection = document.getElementById('daily');
  if(hero) hero.style.display = 'none';
  if(dailySection) dailySection.style.display = 'none';

  const allSections = Array.from(document.querySelectorAll('section, footer, .bottom-nav'));
  allSections.forEach((section)=>{
    if(section.id !== 'daily' && section.classList.contains('hero') === false) {
      section.style.display = 'none';
    }
  });

  const nav = document.getElementById('nav');
  if(nav) nav.style.display = 'none';
  overlay.setAttribute('aria-hidden', 'false');
}

function closeWorkoutSession(){
  const overlay = document.getElementById('workoutSessionOverlay');
  if(overlay){
    overlay.classList.remove('show');
    overlay.setAttribute('aria-hidden', 'true');
  }

  document.body.style.overflow = '';
  const hero = document.querySelector('.hero');
  const dailySection = document.getElementById('daily');
  const nav = document.getElementById('nav');

  if(hero) hero.style.display = '';
  if(dailySection) dailySection.style.display = '';
  if(nav) nav.style.display = '';

  const allSections = Array.from(document.querySelectorAll('section, footer, .bottom-nav'));
  allSections.forEach((section)=>{
    if(section.id !== 'daily' && section.classList.contains('hero') === false) {
      section.style.display = '';
    }
  });

  currentWorkoutSession = null;
  workoutEngine.setActiveSession(null);
  workoutSessionActive = false;
  workoutSessionPaused = false;
  // ensure any running timer is stopped
  pauseTimer();
}

function returnHomeFromWorkout(){
  closeWorkoutSession();
  window.location.hash = 'home';
  showToast('Returned home.');
}

function startWorkoutAgain(){
  const recreatedSession = createWorkoutTemplateSession();
  currentWorkoutSession = recreatedSession;
  workoutEngine.setActiveSession(recreatedSession);
  recreatedSession.started = true;
  recreatedSession.status = 'running';
  workoutSessionActive = true;
  workoutSessionPaused = false;
  renderWorkoutSession();
  showToast('Workout restarted from Exercise 1.');
  startExerciseTimer(recreatedSession);
}

function viewDashboardFromWorkout(){
  closeWorkoutSession();
  const dashboard = document.getElementById('progress');
  if(dashboard){
    dashboard.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  window.location.hash = 'progress';
  showToast('Viewing dashboard.');
}

function startWorkout(){
  openWorkoutSession();
}

function pauseWorkout(){
  const activeSession = workoutEngine.getActiveSession() || currentWorkoutSession;
  if(!activeSession) return;
  activeSession.status = 'paused';
  workoutSessionPaused = true;
  // pause countdown timer
  pauseTimer(activeSession);
  renderWorkoutSession();
  showToast('Workout paused.');
}

function resumeWorkout(){
  const activeSession = workoutEngine.getActiveSession() || currentWorkoutSession;
  if(!activeSession) return;
  activeSession.status = 'running';
  workoutSessionPaused = false;
  // resume countdown timer
  resumeTimer(activeSession);
  renderWorkoutSession();
  showToast('Workout resumed.');
}

function skipExercise(){
  const activeSession = workoutEngine.getActiveSession() || currentWorkoutSession;
  if(!activeSession) return;
  activeSession.status = activeSession.completed ? 'completed' : 'running';
  // clear any running timer for current exercise/rest
  pauseTimer(activeSession);
  const result = workoutEngine.advanceToNextExercise(activeSession);
  currentWorkoutSession = activeSession;
  workoutEngine.setActiveSession(activeSession);
  // reset per-exercise timer state for the newly active exercise
  activeSession._exerciseRemaining = undefined;
  activeSession._exerciseComplete = false;
  renderWorkoutSession();
  if(result && result.completed){
    showToast('Workout complete — great work! 🎉');
  } else {
    showToast('Exercise skipped.');
  }
}

function endWorkout(){
  const activeSession = workoutEngine.getActiveSession() || currentWorkoutSession;
  if(!activeSession) return;
  // stop timer and mark complete
  pauseTimer(activeSession);
  activeSession.status = 'completed';
  workoutEngine.markWorkoutComplete(activeSession);
  currentWorkoutSession = activeSession;
  workoutEngine.setActiveSession(activeSession);
  renderWorkoutSession();
  showToast('Workout ended.');
}

window.workoutEngine = workoutEngine;
window.createWorkoutSession = (options) => workoutEngine.createWorkoutSession(options);
window.setWorkoutActiveSession = (session) => workoutEngine.setActiveSession(session);
window.getWorkoutActiveSession = () => workoutEngine.getActiveSession();
window.openWorkoutSession = openWorkoutSession;
window.startWorkout = startWorkout;
window.pauseWorkout = pauseWorkout;
window.resumeWorkout = resumeWorkout;
window.skipExercise = skipExercise;
window.endWorkout = endWorkout;
window.returnHomeFromWorkout = returnHomeFromWorkout;
window.startWorkoutAnother = startWorkoutAgain;
window.startWorkoutAgain = startWorkoutAgain;
window.viewDashboardFromWorkout = viewDashboardFromWorkout;
window.startWorkoutSessionAction = startWorkoutSessionAction;

/* ---------- categories ---------- */
const categories = [
  {emoji:'💪', name:'Strength Training', desc:'Build raw power with compound lifts.', time:'45m', diff:'Advanced'},
  {emoji:'🏃', name:'Cardio', desc:'Elevate your heart rate, build endurance.', time:'30m', diff:'All Levels'},
  {emoji:'🧘', name:'Yoga', desc:'Improve flexibility and calm the mind.', time:'25m', diff:'Beginner'},
  {emoji:'🔥', name:'HIIT', desc:'Short bursts, maximum intensity.', time:'20m', diff:'Intermediate'},
  {emoji:'🏋', name:'Bodybuilding', desc:'Hypertrophy-focused muscle building.', time:'50m', diff:'Advanced'},
  {emoji:'🤸', name:'Calisthenics', desc:'Master your own bodyweight.', time:'35m', diff:'Intermediate'},
  {emoji:'🚶', name:'Beginner Workouts', desc:'The perfect place to start.', time:'20m', diff:'Beginner'},
  {emoji:'⚡', name:'Mobility', desc:'Move better, recover faster.', time:'15m', diff:'All Levels'},
];
const catGrid = document.getElementById('catGrid');
categories.forEach(c=>{
  const el = document.createElement('div');
  el.className='cat-card';
  el.innerHTML = `
    <div class="cat-arrow">↗</div>
    <span class="cat-emoji">${c.emoji}</span>
    <h4>${c.name}</h4>
    <p>${c.desc}</p>
    <div class="cat-foot"><span>${c.time}</span><span class="diff">${c.diff}</span></div>`;
  catGrid.appendChild(el);
});

/* ---------- generator chips ---------- */
document.querySelectorAll('.chip-group').forEach(group=>{
  group.querySelectorAll('.chip').forEach(chip=>{
    chip.addEventListener('click', ()=>{
      group.querySelectorAll('.chip').forEach(c=>c.classList.remove('active'));
      chip.classList.add('active');
    });
  });
});

const exercisePool = {
  'Lose Fat': ['Jump Rope','Kettlebell Swings','Mountain Climbers','Burpees','Rowing Intervals','Jumping Lunges'],
  'Build Muscle': ['Barbell Squats','Bench Press','Deadlifts','Pull-ups','Overhead Press','Barbell Rows'],
  'Endurance': ['Interval Sprints','Cycling','Rowing','Step-ups','Battle Ropes','Shadow Boxing'],
  'Mobility': ['Hip Openers','Worlds Greatest Stretch','Cat-Cow Flow','Thoracic Rotations','90/90 Stretch','Ankle Circles']
};
function getActive(group){ return document.querySelector(`.chip-group[data-group="${group}"] .chip.active`).dataset.val; }

function generatePlan(){
  const level = getActive('level');
  const goal = getActive('goal');
  const equip = getActive('equip');
  const days = parseInt(document.getElementById('gDays').value);
  const time = document.getElementById('gTime').value;
  const pool = exercisePool[goal] || exercisePool['Lose Fat'];

  let html = `<h4>Your Weekly Plan</h4>`;
  const dayNames = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
  for(let i=0;i<days;i++){
    const shuffled = [...pool].sort(()=>0.5-Math.random()).slice(0,4);
    html += `<div class="plan-day">
      <div class="dhead">${dayNames[i]} <span>${time} · ${level}</span></div>
      ${shuffled.map(ex=>`<div class="plan-ex"><span>${ex}</span><span>3 × 12</span></div>`).join('')}
    </div>`;
  }
  html += `<div class="plan-day" style="border-color:rgba(40,199,111,0.3); background:rgba(40,199,111,0.06);">
    <div class="dhead" style="color:var(--green);">Goal: ${goal} <span style="color:var(--green);">${equip}</span></div>
    <div class="plan-ex"><span>Estimated adherence boost</span><span style="color:var(--green);">+34%</span></div>
  </div>`;
  document.getElementById('genResult').innerHTML = html;
}

/* ---------- dashboard counters ---------- */
function animateCount(el, target, suffix=''){
  let cur = 0;
  const step = Math.max(1, Math.ceil(target/40));
  const iv = setInterval(()=>{
    cur += step;
    if(cur>=target){ cur = target; clearInterval(iv); }
    el.textContent = cur + suffix;
  }, 30);
}
const dashObserver = new IntersectionObserver((entries)=>{
  entries.forEach(e=>{
    if(e.isIntersecting){
      animateCount(document.getElementById('statStreak'), 47);
      animateCount(document.getElementById('statCal'), 3120);
      animateCount(document.getElementById('statHours'), 22);
      dashObserver.disconnect();
    }
  });
},{threshold:0.3});
dashObserver.observe(document.getElementById('progress'));

/* bar chart */
const barData = [{d:'Mon',v:42},{d:'Tue',v:58},{d:'Wed',v:20},{d:'Thu',v:65},{d:'Fri',v:48},{d:'Sat',v:75},{d:'Sun',v:30}];
const barChart = document.getElementById('barChart');
const maxV = Math.max(...barData.map(b=>b.v));
barData.forEach(b=>{
  const bar = document.createElement('div');
  bar.className='bar'; bar.style.height='0px';
  bar.innerHTML = `<span>${b.d}</span>`;
  barChart.appendChild(bar);
  setTimeout(()=>{ bar.style.height = (b.v/maxV*100)+'%'; }, 200);
});

/* mini rings */
const muscleData = [{name:'Legs', pct:80, color:'#D72638'},{name:'Back', pct:60, color:'#28C76F'},{name:'Chest', pct:45, color:'#E8DED1'},{name:'Core', pct:70, color:'#D72638'}];
const ringList = document.getElementById('ringList');
muscleData.forEach(m=>{
  const circ = 2*Math.PI*22;
  const item = document.createElement('div');
  item.className='ring-list-item';
  item.innerHTML = `
    <div class="mini-ring">
      <svg width="54" height="54" viewBox="0 0 54 54">
        <circle class="bg" cx="27" cy="27" r="22"></circle>
        <circle class="fg" cx="27" cy="27" r="22" stroke="${m.color}" stroke-dasharray="${circ}" stroke-dashoffset="${circ}"></circle>
      </svg>
    </div>
    <div><b>${m.name}</b><span>${m.pct}% weekly volume</span></div>`;
  ringList.appendChild(item);
  const fg = item.querySelector('.fg');
  setTimeout(()=>{ fg.style.strokeDashoffset = circ - (circ*m.pct/100); }, 300);
});

/* ---------- challenges ---------- */
const challenges = [
  {icon:'🗓', cls:'c1', title:'7-Day Challenge', desc:'One workout daily, no excuses.', pct:57, days:'4 / 7 days'},
  {icon:'🚀', cls:'c2', title:'30-Day Transformation', desc:'Full program: train, eat, recover.', pct:23, days:'7 / 30 days'},
  {icon:'💯', cls:'c3', title:'100 Push-ups', desc:'Build to 100 consecutive reps.', pct:64, days:'64 / 100 reps'},
  {icon:'🦵', cls:'c1', title:'100 Squats', desc:'Leg endurance, one day at a time.', pct:40, days:'40 / 100 reps'},
  {icon:'🌅', cls:'c2', title:'Morning Routine', desc:'Train before 8am for 14 days.', pct:78, days:'11 / 14 days'},
  {icon:'🔗', cls:'c3', title:'Consistency Challenge', desc:'No missed days for 21 days.', pct:90, days:'19 / 21 days'},
];
const chalGrid = document.getElementById('chalGrid');
challenges.forEach(c=>{
  const el = document.createElement('div');
  el.className = `chal-card ${c.cls}`;
  el.innerHTML = `
    <div class="badge-icon">${c.icon}</div>
    <div>
      <h4>${c.title}</h4>
      <p>${c.desc}</p>
      <div class="chal-progress"><i style="width:${c.pct}%"></i></div>
      <div class="chal-foot"><span>${c.days}</span><span>${c.pct}%</span></div>
    </div>`;
  chalGrid.appendChild(el);
});

/* ---------- nutrition calculators ---------- */
function calcBMI(){
  const h = parseFloat(document.getElementById('bmiH').value)/100;
  const w = parseFloat(document.getElementById('bmiW').value);
  const out = document.getElementById('bmiOut');
  if(!h||!w){ out.textContent='Enter your height and weight.'; out.classList.add('show'); return; }
  const bmi = (w/(h*h)).toFixed(1);
  let cat = bmi<18.5?'Underweight':bmi<25?'Healthy Range':bmi<30?'Overweight':'Obese';
  out.textContent = `BMI: ${bmi} — ${cat}`;
  out.classList.add('show');
}
function calcCalories(){
  const w = parseFloat(document.getElementById('calW').value);
  const act = parseFloat(document.getElementById('calAct').value);
  const out = document.getElementById('calOut');
  if(!w){ out.textContent='Enter your weight.'; out.classList.add('show'); return; }
  const cals = Math.round(w*24*act);
  out.textContent = `Estimated daily need: ${cals} kcal`;
  out.classList.add('show');
}
function calcProtein(){
  const w = parseFloat(document.getElementById('protW').value);
  const g = parseFloat(document.getElementById('protGoal').value);
  const out = document.getElementById('protOut');
  if(!w){ out.textContent='Enter your weight.'; out.classList.add('show'); return; }
  out.textContent = `Target: ${Math.round(w*g)}g protein / day`;
  out.classList.add('show');
}
function calcWater(){
  const w = parseFloat(document.getElementById('waterW').value);
  const out = document.getElementById('waterOut');
  if(!w){ out.textContent='Enter your weight.'; out.classList.add('show'); return; }
  out.textContent = `Target: ${(w*0.035).toFixed(1)} L / day`;
  out.classList.add('show');
}
function calcMacros(){
  const c = parseFloat(document.getElementById('macCal').value);
  const out = document.getElementById('macOut');
  if(!c){ out.textContent='Enter daily calories.'; out.classList.add('show'); return; }
  const protein = Math.round(c*0.3/4), carbs = Math.round(c*0.4/4), fat = Math.round(c*0.3/9);
  out.textContent = `P: ${protein}g · C: ${carbs}g · F: ${fat}g`;
  out.classList.add('show');
}
const meals = [
  'Grilled chicken, quinoa & greens',
  'Salmon, sweet potato & asparagus',
  'Turkey chili with black beans',
  'Egg white omelet with spinach & feta',
  'Tofu stir-fry with brown rice',
  'Greek yogurt bowl with berries & oats'
];
function newMeal(){
  const el = document.getElementById('mealOut');
  el.textContent = meals[Math.floor(Math.random()*meals.length)];
}

/* ---------- quote of the day ---------- */
const quotes = [
  {q:'Discipline is choosing between what you want now and what you want most.', a:'Quote of the Day'},
  {q:'The body achieves what the mind believes.', a:'Quote of the Day'},
  {q:'Small daily improvements compound into staggering results.', a:'Quote of the Day'},
  {q:"You don't have to be extreme, just consistent.", a:'Quote of the Day'},
];
const qd = quotes[new Date().getDate() % quotes.length];
document.getElementById('quoteText').textContent = qd.q;

/* ---------- AI Coach (mock) ---------- */
const coachAnswers = {
  'squat': "Keep your chest tall, drive your knees out over your toes, and push through your heels. Go only as deep as you can while keeping your lower back neutral — depth will improve with mobility over time.",
  'eat': "About 60–90 minutes before training, aim for a mix of easily-digested carbs and a bit of protein — like oats with a banana, or toast with eggs. This fuels you without sitting heavy in your stomach.",
  'knee': "Focus on strengthening your quads, glutes, and hips, warm up with dynamic stretches, and make sure your running shoes have enough support. Gradually increase mileage rather than jumping up too fast.",
  'rest': "Most people do well with 1–2 full rest days per week, plus lighter active-recovery days. Listen to your body — persistent soreness or fatigue is a sign to back off, not push through.",
  'default': "Great question. Focus on consistent form, progressive overload, and enough recovery — those three fundamentals solve most training problems. Want me to go deeper on any of them?"
};
function coachReply(text){
  const t = text.toLowerCase();
  if(t.includes('squat')) return coachAnswers.squat;
  if(t.includes('eat') || t.includes('nutrition') || t.includes('food')) return coachAnswers.eat;
  if(t.includes('knee') || t.includes('pain') || t.includes('injury')) return coachAnswers.knee;
  if(t.includes('rest') || t.includes('recovery')) return coachAnswers.rest;
  return coachAnswers.default;
}
function appendMsg(text, who){
  const wrap = document.getElementById('coachMsgs');
  const m = document.createElement('div');
  m.className = `msg ${who}`;
  m.textContent = text;
  wrap.appendChild(m);
  wrap.scrollTop = wrap.scrollHeight;
}
function askCoach(q){
  appendMsg(q, 'user');
  setTimeout(()=>appendMsg(coachReply(q), 'bot'), 500);
}
function sendCoach(){
  const input = document.getElementById('coachInput');
  const val = input.value.trim();
  if(!val) return;
  appendMsg(val, 'user');
  input.value='';
  setTimeout(()=>appendMsg(coachReply(val), 'bot'), 500);
}

/* ---------- bottom nav active state ---------- */
const bottomLinks = document.querySelectorAll('.bottom-nav a');
window.addEventListener('scroll', ()=>{
  let current = 'home';
  document.querySelectorAll('section[id], .hero[id]').forEach(sec=>{
    if(window.scrollY >= sec.offsetTop - 200) current = sec.id;
  });
  bottomLinks.forEach(l=>{
    l.classList.toggle('active', l.getAttribute('href') === '#'+current);
  });
});

/* ---------- auth init ---------- */
renderAuthNav();
attachAuthEvents();
if(getCurrentUser()){
  showToast('Welcome back to ASCEND.');
}