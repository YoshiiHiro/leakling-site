import { OVERLAY_VISIBLE_MS } from '../../scripts/constants.js';

const app = document.getElementById('app');
const pill = document.getElementById('pill');
const causeLabel = document.getElementById('cause-label');
const timerPill = document.getElementById('timer-pill');
const progressFill = document.getElementById('progress-fill');
const dismissBtn = document.getElementById('dismiss-btn');

let activeDeath = null;
let hideTimer = null;
let countdownTimer = null;
let progressTimer = null;
let secondsLeft = 0;
let isExiting = false;

const IS_ELECTRON = typeof window !== 'undefined' && window.electronAPI?.isElectron;

function hideWindow() {
  if (IS_ELECTRON) {
    window.electronAPI.hideOverlay();
    return;
  }
  overwolf.windows.getCurrentWindow((result) => {
    if (result.success) {
      overwolf.windows.hide(result.window.id);
    }
  });
}

function clearTimers() {
  if (hideTimer) { clearTimeout(hideTimer); hideTimer = null; }
  if (countdownTimer) { clearInterval(countdownTimer); countdownTimer = null; }
  if (progressTimer) { clearInterval(progressTimer); progressTimer = null; }
}

function setUiVisible(visible) {
  if (visible) {
    app.hidden = false;
  } else {
    app.hidden = true;
    hideWindow();
  }
}

function startExit() {
  if (isExiting) return;
  isExiting = true;
  clearTimers();
  pill.style.animation = 'popOut 0.38s cubic-bezier(0.4,0,1,1) forwards';
  setTimeout(() => {
    setUiVisible(false);
    activeDeath = null;
    isExiting = false;
  }, 380);
}

function startSession(death) {
  if (activeDeath || isExiting) return;
  clearTimers();

  activeDeath = death;
  isExiting = false;

  // Determine cause label to display
  const causeId = death.cause || 'other';
  const labelMap = {
    crosshair_placement: 'Crosshair',
    overpeek: 'Overpeek',
    no_utility: 'No utility',
    bad_timing: 'Bad timing',
    poor_trade: 'Poor trade',
    other: 'Other'
  };
  causeLabel.textContent = labelMap[causeId] || 'Unknown';

  secondsLeft = Math.ceil(OVERLAY_VISIBLE_MS / 1000);
  timerPill.textContent = secondsLeft + 's';
  timerPill.classList.remove('warning');
  progressFill.style.width = '100%';
  progressFill.classList.remove('warning');
  pill.style.animation = 'popIn 0.32s cubic-bezier(0,0,0.2,1) forwards';

  setUiVisible(true);


  // Countdown timer
  countdownTimer = setInterval(() => {
    secondsLeft -= 1;
    timerPill.textContent = Math.max(0, secondsLeft) + 's';
    if (secondsLeft <= 2) {
      timerPill.classList.add('warning');
      progressFill.classList.add('warning');
    }
    if (secondsLeft <= 0 && countdownTimer) {
      clearInterval(countdownTimer);
      countdownTimer = null;
    }
  }, 1000);

  // Progress bar
  const totalMs = OVERLAY_VISIBLE_MS;
  const stepMs = 50;
  let elapsed = 0;
  progressTimer = setInterval(() => {
    elapsed += stepMs;
    const pct = Math.max(0, 100 - (elapsed / totalMs) * 100);
    progressFill.style.width = pct + '%';
    if (elapsed >= totalMs && progressTimer) {
      clearInterval(progressTimer);
      progressTimer = null;
    }
  }, stepMs);

  // Auto-dismiss
  hideTimer = setTimeout(() => {
    startExit();
  }, OVERLAY_VISIBLE_MS);
}

// ── Dismiss button ─────────────────────────────────────────────
dismissBtn.addEventListener('click', () => {
  if (activeDeath) startExit();
});

// ── Hotkey dismiss ─────────────────────────────────────────────
if (IS_ELECTRON) {
  window.electronAPI?.onHotkey?.((name) => {
    if (name === 'autopsy_showhide' && activeDeath) {
      startExit();
    }
  });
}

// ── IPC binding ────────────────────────────────────────────────
function bindBus() {
  if (IS_ELECTRON) {
    const cleanupDeath = window.electronAPI.onDeathEvent((payload) => {
      startSession(payload || {});
    });

    const cleanupDismiss = window.electronAPI.onDismissEvent((payload) => {

      if (activeDeath) startExit();
    });

    window.__cleanupIPC = () => {
      if (cleanupDeath) cleanupDeath();
      if (cleanupDismiss) cleanupDismiss();
    };


    return;
  }

  // Overwolf: poll for event bus
  const bus = getBus();
  if (!bus) {
    setTimeout(bindBus, 250);
    return;
  }

  bus.on(DEATH_AUTOPSY_EVENT, (payload) => {
    startSession(payload || {});
  });

  bus.on(OVERLAY_FORCE_DISMISS_EVENT, (payload) => {

    forceHide(payload?.reason || 'round_change');
  });


}

setUiVisible(false);
bindBus();
