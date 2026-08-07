'use strict';

/**
 * =========================================
 * ASCEND LEVEL-UP CELEBRATION UI ENGINE
 * =========================================
 * Cinematic, Apple × Nike inspired celebration modal for player rank progression.
 * Subscribes cleanly to `ascend:levelUp` CustomEvents / ASCEND_XP.onLevelUp architecture.
 */

(function () {
  // Prevent duplicate initialization across reloads or script reruns
  if (window.ASCEND_LEVEL_UP_INITIALIZED) {
    return;
  }
  window.ASCEND_LEVEL_UP_INITIALIZED = true;

  let overlayEl = null;
  let levelNumEl = null;
  let rankSubtitleEl = null;
  let descEl = null;
  let multiTagEl = null;
  let continueBtnEl = null;
  let previousActiveElement = null;

  /**
   * Generates rank title based on player level
   * @param {number} level 
   * @returns {string} Rank Title
   */
  function getRankTitle(level) {
    if (level <= 1) return 'ASCENDING ATHLETE';
    if (level === 2) return 'RISING ATHLETE';
    if (level === 3) return 'DISCIPLINED ATHLETE';
    if (level === 4) return 'PINNACLE ATHLETE';
    if (level === 5) return 'TITAN ATHLETE';
    return `LEVEL ${level} ELITE ATHLETE`;
  }

  /**
   * Injects modal HTML into DOM if not already present
   */
  function ensureModalDOM() {
    if (overlayEl) return;

    const existing = document.getElementById('ascendLevelUpOverlay');
    if (existing) {
      overlayEl = existing;
    } else {
      overlayEl = document.createElement('div');
      overlayEl.id = 'ascendLevelUpOverlay';
      overlayEl.className = 'ascend-levelup-overlay';
      overlayEl.setAttribute('role', 'dialog');
      overlayEl.setAttribute('aria-modal', 'true');
      overlayEl.setAttribute('aria-hidden', 'true');
      overlayEl.setAttribute('aria-labelledby', 'ascendLevelUpTitle');
      overlayEl.setAttribute('aria-describedby', 'ascendLevelUpDesc');

      overlayEl.innerHTML = `
        <div class="ascend-levelup-card">
          <div class="ascend-levelup-ambient-glow"></div>
          <div class="ascend-levelup-header">
            <span class="ascend-levelup-eyebrow">LEVEL UP</span>
            <div class="ascend-levelup-crown">👑</div>
            <h2 class="ascend-levelup-level-num" id="ascendLevelUpTitle">Level 2</h2>
            <div class="ascend-levelup-rank" id="ascendLevelUpRank">ASCENDING ATHLETE</div>
          </div>
          
          <div class="ascend-levelup-body">
            <p class="ascend-levelup-desc" id="ascendLevelUpDesc">You've reached a new level.</p>
            <div class="ascend-levelup-multitag hidden" id="ascendLevelUpMultiTag"></div>
          </div>

          <div class="ascend-levelup-footer">
            <button type="button" class="ascend-levelup-btn" id="ascendLevelUpContinueBtn" aria-label="Continue and close celebration modal">
              <span>Continue</span>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <line x1="5" y1="12" x2="19" y2="12"></line>
                <polyline points="12 5 19 12 12 19"></polyline>
              </svg>
            </button>
          </div>
        </div>
      `;

      document.body.appendChild(overlayEl);
    }

    levelNumEl = document.getElementById('ascendLevelUpTitle');
    rankSubtitleEl = document.getElementById('ascendLevelUpRank');
    descEl = document.getElementById('ascendLevelUpDesc');
    multiTagEl = document.getElementById('ascendLevelUpMultiTag');
    continueBtnEl = document.getElementById('ascendLevelUpContinueBtn');

    if (continueBtnEl) {
      continueBtnEl.addEventListener('click', hideModal);
    }

    overlayEl.addEventListener('click', (evt) => {
      if (evt.target === overlayEl) {
        hideModal();
      }
    });

    document.addEventListener('keydown', (evt) => {
      if (!overlayEl || !overlayEl.classList.contains('show')) return;
      if (evt.key === 'Escape') {
        evt.preventDefault();
        hideModal();
      } else if (evt.key === 'Tab') {
        // Focus trap inside modal
        if (continueBtnEl) {
          evt.preventDefault();
          continueBtnEl.focus();
        }
      }
    });
  }

  /**
   * Shows the level-up celebration modal
   * @param {Object} payload Level up payload { newLevel, previousLevel, levelsGained, source }
   */
  function showModal(payload = {}) {
    ensureModalDOM();
    if (!overlayEl) return;

    const newLevel = Math.max(1, Number(payload.newLevel || payload.level) || 1);
    const levelsGained = Math.max(1, Number(payload.levelsGained) || 1);

    if (levelNumEl) {
      levelNumEl.textContent = `Level ${newLevel}`;
    }

    if (rankSubtitleEl) {
      rankSubtitleEl.textContent = getRankTitle(newLevel);
    }

    if (descEl) {
      descEl.textContent = "You've reached a new level.";
    }

    if (multiTagEl) {
      if (levelsGained > 1) {
        multiTagEl.textContent = `⚡ ${levelsGained} Levels Gained!`;
        multiTagEl.classList.remove('hidden');
      } else {
        multiTagEl.classList.add('hidden');
      }
    }

    // Save active element for accessibility focus restoration
    previousActiveElement = document.activeElement;

    // Lock background scrolling
    document.body.classList.add('ascend-modal-open');

    // Show modal
    overlayEl.setAttribute('aria-hidden', 'false');
    // Force reflow for smooth opacity/transform transition
    void overlayEl.offsetWidth;
    overlayEl.classList.add('show');

    // Focus primary action button
    if (continueBtnEl) {
      setTimeout(() => continueBtnEl.focus(), 80);
    }
  }

  /**
   * Hides the level-up celebration modal with exit animation
   */
  function hideModal() {
    if (!overlayEl || !overlayEl.classList.contains('show')) return;

    overlayEl.classList.remove('show');
    overlayEl.setAttribute('aria-hidden', 'true');

    setTimeout(() => {
      document.body.classList.remove('ascend-modal-open');
      if (previousActiveElement && typeof previousActiveElement.focus === 'function') {
        try {
          previousActiveElement.focus();
        } catch (e) {
          // Ignore focus errors if element was removed
        }
      }
    }, 350);
  }

  // Subscribe to 'ascend:levelUp' CustomEvent
  window.addEventListener('ascend:levelUp', (evt) => {
    if (evt && evt.detail && evt.detail.levelUp) {
      if (window.ASCEND_LEVEL_UP && typeof window.ASCEND_LEVEL_UP.show === 'function') {
        window.ASCEND_LEVEL_UP.show(evt.detail);
      } else {
        showModal(evt.detail);
      }
    }
  });

  // Export public API
  window.ASCEND_LEVEL_UP = {
    show: showModal,
    hide: hideModal
  };

})();
