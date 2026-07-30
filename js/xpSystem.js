'use strict';

/*
=========================================
ASCEND XP SYSTEM
=========================================
*/

const ASCEND_PLAYER_KEY = 'ascendPlayer';

const defaultPlayer = {
    xp: 0,
    level: 1,
    totalWorkouts: 0,
    streak: 0,
    lastWorkoutDate: null
};

let player = loadPlayer();

/* ------------------------------
   STORAGE
------------------------------ */

function loadPlayer() {
    const saved = localStorage.getItem(ASCEND_PLAYER_KEY);

    if (!saved) {
        localStorage.setItem(
            ASCEND_PLAYER_KEY,
            JSON.stringify(defaultPlayer)
        );

        return { ...defaultPlayer };
    }

    return JSON.parse(saved);
}

function savePlayer() {
    localStorage.setItem(
        ASCEND_PLAYER_KEY,
        JSON.stringify(player)
    );
}

/* ------------------------------
   LEVEL SYSTEM
------------------------------ */

function getLevelFromXP(xp) {

    if (xp < 300) return 1;
    if (xp < 700) return 2;
    if (xp < 1200) return 3;
    if (xp < 1800) return 4;

    return 5 + Math.floor((xp - 1800) / 700);
}

/* ------------------------------
   XP
------------------------------ */

function addXP(amount) {

    player.xp += amount;

    player.level = getLevelFromXP(player.xp);

    savePlayer();
}

/* ------------------------------
   WORKOUTS
------------------------------ */

function completeWorkout() {

    player.totalWorkouts++;

    addXP(120);

    savePlayer();
}

/* ------------------------------
   PUBLIC
------------------------------ */

window.ASCEND_XP = {

    getPlayer() {
        return player;
    },

    completeWorkout,

    addXP

};