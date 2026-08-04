'use strict';
/*
 * ASCEND Personalized Workout Generator
 * Modular, config-driven generator. No DOM access and no localStorage —
 * pure logic so it is easy to test and extend.
 *
 * Public API (window.ASCEND_WORKOUT_GENERATOR):
 *   - generatePlan({ level, goal, equip, days, time })  -> weekly plan object
 *   - buildDaySessionOptions(plan, dayIndex)            -> workoutEngine session options
 *   - getExercises(filter)                              -> exercise database (optionally filtered)
 *   - getExercise(id)                                   -> single exercise
 */
const ASCEND_WORKOUT_GENERATOR = (() => {
  /* ------------------------------------------------------------ database */
  function E(id, name, muscle, difficulty, equipment, goals, sets, reps, seconds, rest, calories, instructions) {
    return {
      id,
      name,
      muscle,
      difficulty,
      equipment,
      goals,
      sets,
      reps,
      seconds,
      restDuration: rest,
      calories,
      instructions
    };
  }

  // difficulty: 1 = Beginner, 2 = Intermediate, 3 = Advanced
  // equipment:  Bodyweight | Dumbbells | Full Gym
  // goals:      Lose Fat | Build Muscle | Endurance | Mobility
  const EXERCISES = [
    /* ---- Lose Fat ---- */
    E('jumping-jacks', 'Jumping Jacks', 'Full Body', 1, 'Bodyweight', ['Lose Fat', 'Endurance'], 3, 0, 40, 45, 55, 'Keep knees soft, land lightly, stay on the balls of your feet.'),
    E('high-knees', 'High Knees', 'Full Body', 1, 'Bodyweight', ['Lose Fat', 'Endurance'], 3, 0, 30, 30, 60, 'Drive knees to hip height at a fast, controlled tempo.'),
    E('bodyweight-squats', 'Bodyweight Squats', 'Legs', 1, 'Bodyweight', ['Lose Fat', 'Build Muscle'], 3, 15, 40, 45, 45, 'Sit back into the squat, chest proud, heels planted.'),
    E('mountain-climbers', 'Mountain Climbers', 'Core', 2, 'Bodyweight', ['Lose Fat', 'Endurance'], 3, 0, 40, 30, 65, 'Keep hips low, alternate knees to chest at speed.'),
    E('burpees', 'Burpees', 'Full Body', 2, 'Bodyweight', ['Lose Fat', 'Endurance'], 3, 0, 45, 60, 90, 'Drop, kick back, push up, jump — one fluid motion.'),
    E('jump-squats', 'Jump Squats', 'Legs', 2, 'Bodyweight', ['Lose Fat'], 3, 12, 40, 45, 80, 'Explode up, land soft into the next squat.'),
    E('plank-jacks', 'Plank Jacks', 'Core', 1, 'Bodyweight', ['Lose Fat', 'Endurance'], 3, 0, 35, 30, 55, 'In plank, jump feet wide and together, hips steady.'),
    E('squat-thrusts', 'Squat Thrusts', 'Full Body', 2, 'Bodyweight', ['Lose Fat', 'Endurance'], 3, 0, 40, 30, 70, 'Plank to squat to jump — fast transitions, controlled hips.'),
    E('speed-skater-jumps', 'Speed Skater Jumps', 'Legs', 2, 'Bodyweight', ['Lose Fat', 'Endurance'], 3, 0, 40, 30, 75, 'Bound side to side, land soft, swing arms across.'),
    E('tuck-jumps', 'Tuck Jumps', 'Legs', 3, 'Bodyweight', ['Lose Fat'], 3, 12, 35, 45, 85, 'Jump high, drive knees to chest, land quietly.'),
    E('bear-crawls', 'Bear Crawls', 'Shoulders', 3, 'Bodyweight', ['Lose Fat', 'Endurance'], 3, 0, 30, 30, 70, 'Crawl on hands and toes, hips low, back flat.'),
    E('dumbbell-thrusters', 'Dumbbell Thrusters', 'Full Body', 2, 'Dumbbells', ['Lose Fat', 'Build Muscle', 'Endurance'], 3, 10, 40, 45, 85, 'Front-rack the dumbbells, squat, then press overhead.'),
    E('dumbbell-swings', 'Dumbbell Swings', 'Hips', 2, 'Dumbbells', ['Lose Fat', 'Endurance'], 3, 12, 45, 45, 90, 'Hinge at the hips and snap them forward to float the dumbbell.'),
    E('db-farmers-carry', 'Dumbbell Farmer\u2019s Carry', 'Full Body', 1, 'Dumbbells', ['Lose Fat', 'Endurance', 'Build Muscle', 'Mobility'], 3, 0, 40, 30, 60, 'Walk tall with heavy dumbbells, shoulders packed, core braced.'),
    E('db-squat-jumps', 'Dumbbell Squat Jumps', 'Legs', 2, 'Dumbbells', ['Lose Fat'], 3, 10, 40, 45, 85, 'Hold a dumbbell at the chest, jump and land soft.'),
    E('db-clean-and-press', 'Dumbbell Clean and Press', 'Full Body', 3, 'Dumbbells', ['Lose Fat', 'Build Muscle'], 3, 8, 50, 60, 100, 'Clean to the shoulders, then press; one smooth explosive pull.'),
    E('db-snatch', 'Dumbbell Snatch', 'Full Body', 3, 'Dumbbells', ['Lose Fat', 'Endurance', 'Build Muscle'], 3, 8, 45, 60, 100, 'Explosive pull to an overhead lockout, keep it close.'),
    E('renegade-rows', 'Renegade Rows', 'Back', 3, 'Dumbbells', ['Lose Fat', 'Build Muscle'], 3, 8, 50, 60, 95, 'Plank over dumbbells, row one arm at a time, hips level.'),
    E('treadmill-sprints', 'Treadmill Sprints', 'Legs', 2, 'Full Gym', ['Lose Fat', 'Endurance'], 4, 0, 30, 60, 110, 'Max-effort 30s sprints with full recovery between.'),
    E('rowing-intervals', 'Rowing Intervals', 'Full Body', 2, 'Full Gym', ['Lose Fat', 'Endurance'], 4, 0, 45, 45, 100, 'Power 10s off the catch, light hands, smooth drive.'),
    E('battle-ropes', 'Battle Ropes', 'Arms', 2, 'Full Gym', ['Lose Fat', 'Endurance'], 3, 0, 40, 45, 90, 'Wave from the shoulders, not the arms; stay tall.'),
    E('assault-bike', 'Assault Bike Sprints', 'Full Body', 2, 'Full Gym', ['Lose Fat', 'Endurance'], 4, 0, 30, 45, 100, 'Sprint 30s on the fan bike, then spin easy to recover.'),
    E('box-jumps', 'Box Jumps', 'Legs', 3, 'Full Gym', ['Lose Fat', 'Build Muscle'], 4, 8, 35, 60, 110, 'Jump to a soft landing, step down — never jump down.'),
    E('sled-pushes', 'Sled Pushes', 'Legs', 3, 'Full Gym', ['Lose Fat', 'Endurance'], 4, 0, 40, 60, 120, 'Drive the sled with your whole body, low stance.'),
    E('sled-pulls', 'Sled Pulls', 'Full Body', 3, 'Full Gym', ['Lose Fat', 'Build Muscle'], 4, 0, 40, 60, 110, 'Walk backward pulling the sled, arms locked, strong hips.'),
    E('tire-flips', 'Tire Flips', 'Full Body', 3, 'Full Gym', ['Lose Fat'], 4, 8, 45, 60, 120, 'Explosive hip extension to flip the tire over.'),
    E('stair-mill', 'Stair Mill', 'Legs', 3, 'Full Gym', ['Lose Fat', 'Endurance'], 4, 0, 45, 45, 115, 'Steady climb, drive with the glutes, hands light.'),

    /* ---- Build Muscle ---- */
    E('push-ups', 'Push Ups', 'Chest', 1, 'Bodyweight', ['Build Muscle'], 3, 12, 40, 45, 50, 'Body in a straight line, chest to the floor.'),
    E('plank', 'Plank', 'Core', 1, 'Bodyweight', ['Build Muscle', 'Endurance'], 3, 0, 45, 30, 40, 'Brace glutes and abs, do not let hips sag.'),
    E('incline-push-ups', 'Incline Push Ups', 'Chest', 1, 'Bodyweight', ['Build Muscle'], 3, 15, 40, 45, 40, 'Hands elevated to reduce load while keeping form.'),
    E('dips', 'Dips', 'Triceps', 2, 'Bodyweight', ['Build Muscle'], 3, 12, 45, 60, 75, 'Slight forward lean, shoulders down, elbows back.'),
    E('pull-ups', 'Pull Ups', 'Back', 2, 'Bodyweight', ['Build Muscle'], 3, 8, 45, 60, 85, 'Drive elbows down, pull chest to bar.'),
    E('chin-ups', 'Chin Ups', 'Back', 2, 'Bodyweight', ['Build Muscle'], 3, 8, 45, 60, 85, 'Supinated grip, pull chest to bar, control the lower.'),
    E('diamond-push-ups', 'Diamond Push Ups', 'Triceps', 2, 'Bodyweight', ['Build Muscle'], 3, 10, 40, 45, 70, 'Hands form a diamond, elbows tucked, full range.'),
    E('split-squats', 'Split Squats', 'Legs', 2, 'Bodyweight', ['Build Muscle', 'Endurance'], 3, 10, 45, 45, 70, 'Split stance, lower straight down, front heel planted.'),
    E('pike-push-ups', 'Pike Push Ups', 'Shoulders', 3, 'Bodyweight', ['Build Muscle'], 3, 10, 40, 45, 80, 'Hips high, head reaches the floor between hands.'),
    E('one-arm-push-ups', 'One Arm Push Ups', 'Chest', 3, 'Bodyweight', ['Build Muscle'], 3, 6, 45, 60, 95, 'Tight core, stacked shoulders, controlled descent.'),
    E('db-bicep-curls', 'Dumbbell Bicep Curls', 'Arms', 1, 'Dumbbells', ['Build Muscle'], 3, 12, 40, 45, 50, 'Elbows pinned, curl slow, squeeze the top.'),
    E('goblet-squats', 'Goblet Squats', 'Legs', 1, 'Dumbbells', ['Build Muscle', 'Lose Fat'], 3, 12, 45, 45, 60, 'Hold one dumbbell at the chest, squat to depth.'),
    E('db-overhead-press', 'Dumbbell Overhead Press', 'Shoulders', 2, 'Dumbbells', ['Build Muscle'], 3, 10, 40, 60, 70, 'Core tight, press in a straight line overhead.'),
    E('db-rows', 'Dumbbell Rows', 'Back', 2, 'Dumbbells', ['Build Muscle'], 3, 10, 45, 60, 75, 'Hinge flat-backed, row the dumbbell to the hip.'),
    E('db-lunges', 'Dumbbell Lunges', 'Legs', 2, 'Dumbbells', ['Build Muscle', 'Lose Fat'], 3, 10, 50, 45, 70, 'Long stride, back knee kisses the floor.'),
    E('db-romanian-deadlifts', 'Dumbbell Romanian Deadlifts', 'Hamstrings', 3, 'Dumbbells', ['Build Muscle'], 3, 10, 50, 60, 85, 'Soft knees, hinge back, dumbbells slide the thighs.'),
    E('db-shrugs', 'Dumbbell Shrugs', 'Traps', 1, 'Dumbbells', ['Build Muscle'], 3, 15, 40, 45, 45, 'Shrug straight up, pause at the top, lower slow.'),
    E('single-arm-db-floor-press', 'Single Arm Floor Press', 'Chest', 2, 'Dumbbells', ['Build Muscle'], 3, 10, 40, 45, 60, 'Lie back, press one dumbbell, brace the core.'),
    E('barbell-squats', 'Barbell Squats', 'Legs', 2, 'Full Gym', ['Build Muscle'], 3, 10, 50, 75, 90, 'Brace, sit down and drive up with the bar on traps.'),
    E('bench-press', 'Bench Press', 'Chest', 2, 'Full Gym', ['Build Muscle'], 3, 10, 50, 75, 95, 'Shoulder blades pinched, press with control.'),
    E('barbell-rows', 'Barbell Rows', 'Back', 3, 'Full Gym', ['Build Muscle'], 3, 8, 50, 75, 90, 'Hinged torso, row to the navel, elbows in.'),
    E('overhead-press', 'Overhead Press', 'Shoulders', 3, 'Full Gym', ['Build Muscle'], 3, 8, 45, 75, 85, 'Press from the collarbone, glutes braced.'),
    E('deadlifts', 'Deadlifts', 'Back', 3, 'Full Gym', ['Build Muscle'], 3, 8, 55, 90, 120, 'Brace hard, drive the floor away, bar stays close.'),

    /* ---- Endurance ---- */
    E('shadow-boxing', 'Shadow Boxing', 'Full Body', 1, 'Bodyweight', ['Endurance', 'Lose Fat'], 3, 0, 45, 30, 65, 'Light on the feet, snap punches, keep breathing.'),
    E('step-ups', 'Step Ups', 'Legs', 1, 'Bodyweight', ['Endurance', 'Build Muscle'], 3, 12, 45, 30, 55, 'Drive through the heel, control the step down.'),
    E('jumping-lunges', 'Jumping Lunges', 'Legs', 2, 'Bodyweight', ['Endurance', 'Lose Fat'], 3, 10, 40, 30, 85, 'Switch legs in the air, land soft and stable.'),
    E('frog-jumps', 'Frog Jumps', 'Legs', 3, 'Bodyweight', ['Endurance'], 3, 12, 40, 30, 90, 'Deep squat to explosive jump, land quietly.'),
    E('db-complex', 'Dumbbell Complex', 'Full Body', 2, 'Dumbbells', ['Endurance', 'Lose Fat', 'Build Muscle'], 3, 8, 50, 45, 95, 'One flowing sequence: deadlift, row, clean, press, squat.'),
    E('db-step-ups', 'Dumbbell Step Ups', 'Legs', 2, 'Dumbbells', ['Endurance', 'Build Muscle'], 3, 12, 45, 30, 65, 'Hold dumbbells, drive through the heel onto the box.'),
    E('cycling-sprints', 'Cycling Sprints', 'Legs', 2, 'Full Gym', ['Endurance', 'Lose Fat'], 4, 0, 30, 45, 100, 'Stand and sprint 30s, then spin easy to recover.'),

    /* ---- Mobility ---- */
    E('cat-cow', 'Cat-Cow Flow', 'Spine', 1, 'Bodyweight', ['Mobility'], 3, 0, 30, 20, 25, 'Alternate rounding and arching slowly with your breath.'),
    E('childs-pose', 'Child\u2019s Pose', 'Back', 1, 'Bodyweight', ['Mobility'], 3, 0, 40, 20, 20, 'Kneel, reach arms forward, sink hips to heels.'),
    E('downward-dog-walks', 'Downward Dog Walks', 'Hamstrings', 1, 'Bodyweight', ['Mobility'], 3, 0, 40, 20, 25, 'From down dog, walk hands forward and back slowly.'),
    E('worlds-greatest-stretch', 'World\u2019s Greatest Stretch', 'Full Body', 1, 'Bodyweight', ['Mobility'], 3, 0, 45, 20, 30, 'Lunge, open the chest to the ceiling, feel the release.'),
    E('90-90-stretch', '90/90 Stretch', 'Hips', 1, 'Bodyweight', ['Mobility'], 3, 0, 40, 20, 25, 'Sit at 90/90, fold forward, keep the hips square.'),
    E('hip-flexor-stretch', 'Hip Flexor Stretch', 'Hips', 1, 'Bodyweight', ['Mobility'], 3, 0, 45, 20, 25, 'Half-kneeling lunge, squeeze the glute, feel the front hip.'),
    E('thoracic-rotations', 'Thoracic Rotations', 'Spine', 2, 'Bodyweight', ['Mobility'], 3, 0, 40, 20, 25, 'Quadruped, rotate the arm to the ceiling without twisting the hips.'),
    E('cossack-squats', 'Cossack Squats', 'Legs', 2, 'Bodyweight', ['Mobility', 'Build Muscle'], 3, 8, 45, 30, 40, 'Sit one side, keep the other leg long, swap sides.'),
    E('deep-squat-hold', 'Deep Squat Hold', 'Hips', 2, 'Bodyweight', ['Mobility', 'Build Muscle'], 3, 0, 60, 30, 30, 'Feet shoulder-width, hold the bottom position tall.'),
    E('pigeon-pose', 'Pigeon Pose', 'Hips', 2, 'Bodyweight', ['Mobility'], 3, 0, 45, 20, 25, 'Shin forward, square the hips, fold over the leg.'),
    E('half-kneeling-db-reach', 'Half-Kneeling Dumbbell Reach', 'Shoulders', 1, 'Dumbbells', ['Mobility'], 3, 0, 40, 20, 30, 'Half-kneel, reach the dumbbell overhead and across.'),
    E('overhead-db-carries', 'Overhead Dumbbell Carries', 'Shoulders', 2, 'Dumbbells', ['Mobility', 'Build Muscle'], 3, 0, 35, 30, 35, 'Walk tall with dumbbells pressed overhead, core braced.'),
    E('db-windmill', 'Dumbbell Windmill', 'Hips', 3, 'Dumbbells', ['Mobility'], 3, 8, 40, 30, 45, 'One arm overhead, hinge sideways, eyes on the bell.'),
    E('dead-hang', 'Dead Hang', 'Back', 1, 'Full Gym', ['Mobility'], 3, 0, 30, 20, 25, 'Hang from the bar, shoulders relaxed, breathe deep.'),
    E('lat-pulldown-stretch', 'Lat Pulldown Stretch', 'Back', 2, 'Full Gym', ['Mobility'], 3, 0, 30, 20, 25, 'Hold the bar wide overhead, let the lats stretch deep.'),
    E('shoulder-dislocates', 'Shoulder Dislocates', 'Shoulders', 2, 'Full Gym', ['Mobility'], 3, 0, 30, 20, 25, 'Wide grip, pass the bar overhead and back with control.'),
    E('cable-torso-rotations', 'Cable Torso Rotations', 'Core', 2, 'Full Gym', ['Mobility'], 3, 10, 40, 30, 35, 'Punch the cable across, rotate from the ribs not the arms.')
  ];

  /* ---------------------------------------------------------- config */
  const LEVEL_META = {
    Beginner: { lv: 1, sets: 0.75, rest: 1.25, cal: 0.7 },
    Intermediate: { lv: 2, sets: 1, rest: 1, cal: 1 },
    Advanced: { lv: 3, sets: 1.25, rest: 0.75, cal: 1.3 }
  };
  const COUNT_BY_MINUTES = { 15: 4, 30: 6, 45: 8, 60: 10 };
  const DEFAULT_COUNT = 6;
  const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  const EQUIP_PRIORITY = { Bodyweight: 1, Dumbbells: 2, 'Full Gym': 3 };

  /* --------------------------------------------------------- helpers */
  function shuffle(list) {
    const copy = [...list];
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const tmp = copy[i];
      copy[i] = copy[j];
      copy[j] = tmp;
    }
    return copy;
  }

  function parseMinutes(time) {
    const n = parseInt(String(time).replace(/\D/g, ''), 10);
    return Number.isFinite(n) && n > 0 ? n : 30;
  }

  function equipmentCompatible(exEquipment, selected) {
    const exLevel = EQUIP_PRIORITY[exEquipment] || 1;
    const selLevel = EQUIP_PRIORITY[selected] || 1;
    return exLevel <= selLevel;
  }

  function buildExercise(ex, meta) {
    const finalSets = Math.max(1, Math.round(ex.sets * meta.sets));
    const repsOrDuration = ex.reps
      ? `${finalSets} × ${ex.reps} reps`
      : `${finalSets} × ${ex.seconds} sec`;
    const restDuration = Math.round(ex.restDuration * meta.rest);
    const calories = Math.round(ex.calories * meta.cal);
    const durationSeconds = finalSets * ex.seconds;
    return {
      id: ex.id,
      name: ex.name,
      muscle: ex.muscle,
      difficulty: ex.difficulty,
      equipment: ex.equipment,
      goals: ex.goals,
      sets: finalSets,
      repsOrDuration,
      restDuration,
      calories,
      durationSeconds,
      instructions: ex.instructions
    };
  }

  function buildDay(goal, levelKey, equip, minutes, meta, pool) {
    const count = COUNT_BY_MINUTES[minutes] || DEFAULT_COUNT;
    // rank by difficulty fit, with a touch of jitter so plans vary run to run
    const byScore = (list) => list
      .map((ex) => ({ ex, score: Math.abs(ex.difficulty - meta.lv) + Math.random() * 0.4 }))
      .sort((a, b) => a.score - b.score)
      .map((item) => item.ex);

    // guarantee the selected equipment tier is represented (~60% of slots)
    const exact = pool.filter((ex) => ex.equipment === equip);
    const exactCount = Math.min(count, Math.max(2, Math.ceil(count * 0.6)), exact.length);
    const exactPick = shuffle(byScore(exact).slice(0, exactCount));

    const used = new Set(exactPick.map((ex) => ex.id));
    const rest = byScore(pool.filter((ex) => !used.has(ex.id))).slice(0, count - exactCount);

    const exercises = shuffle([...exactPick, ...rest]).map((ex) => buildExercise(ex, meta));
    const totalSeconds = exercises.reduce((sum, ex) => sum + ex.durationSeconds + ex.restDuration, 0);
    const calories = exercises.reduce((sum, ex) => sum + ex.calories, 0);
    return {
      name: '',
      focus: `${goal} · ${equip}`,
      minutes: Math.max(1, Math.round(totalSeconds / 60)),
      calories,
      exercises
    };
  }

  /* ------------------------------------------------------ public API */
  function generatePlan({ level, goal, equip, days, time } = {}) {
    const levelKey = LEVEL_META[level] ? level : 'Beginner';
    const goalKey = goal || 'Lose Fat';
    const equipKey = EQUIP_PRIORITY[equip] ? equip : 'Bodyweight';
    const minutes = parseMinutes(time);
    const dayCount = Math.min(7, Math.max(1, parseInt(days, 10) || 4));
    const meta = LEVEL_META[levelKey];

    const pool = EXERCISES.filter((ex) =>
      ex.goals.includes(goalKey) && equipmentCompatible(ex.equipment, equipKey)
    );
    const safePool = pool.length ? pool : EXERCISES.filter((ex) =>
      ex.goals.includes(goalKey)
    );

    const planDays = [];
    for (let i = 0; i < dayCount; i++) {
      const day = buildDay(goalKey, levelKey, equipKey, minutes, meta, shuffle(safePool));
      day.name = DAY_NAMES[i % DAY_NAMES.length];
      planDays.push(day);
    }

    const totalCalories = planDays.reduce((sum, day) => sum + day.calories, 0);
    return {
      level: levelKey,
      goal: goalKey,
      equip: equipKey,
      time: `${minutes} min`,
      days: dayCount,
      totalCalories,
      days: planDays
    };
  }

  function buildDaySessionOptions(plan, dayIndex) {
    const day = plan && plan.days && plan.days[dayIndex];
    if (!day) return null;
    const exercises = day.exercises.map((ex) => ({
      id: `gen-${ex.id}-${Math.random().toString(36).slice(2, 8)}`,
      name: ex.name,
      detail: ex.instructions || '',
      repsOrDuration: ex.repsOrDuration,
      restDuration: ex.restDuration,
      calories: ex.calories,
      durationSeconds: ex.durationSeconds
    }));
    const estimatedCalories = exercises.reduce((sum, ex) => sum + ex.calories, 0);
    const totalSeconds = exercises.reduce((sum, ex) => sum + ex.durationSeconds + ex.restDuration, 0);
    return {
      title: `${plan.goal} · ${plan.time}`,
      exercises,
      estimatedCalories,
      totalWorkoutTime: Math.max(1, Math.round(totalSeconds / 60))
    };
  }

  function getExercises(filter = {}) {
    const goal = filter.goal;
    const equip = filter.equipment;
    return EXERCISES.filter((ex) => {
      if (goal && !ex.goals.includes(goal)) return false;
      if (equip && !equipmentCompatible(ex.equipment, equip)) return false;
      return true;
    });
  }

  function getExercise(id) {
    return EXERCISES.find((ex) => ex.id === id) || null;
  }

  return {
    generatePlan,
    buildDaySessionOptions,
    getExercises,
    getExercise
  };
})();

if (typeof window !== 'undefined') {
  window.ASCEND_WORKOUT_GENERATOR = ASCEND_WORKOUT_GENERATOR;
}
