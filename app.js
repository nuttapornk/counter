/* ===================================================
   JUMP ROPE TRAINER — Application Logic
   =================================================== */

// ─── Audio Engine (Web Audio API) ─────────────────
const AudioEngine = (() => {
    let ctx = null;

    function getCtx() {
        if (!ctx) {
            ctx = new (window.AudioContext || window.webkitAudioContext)();
        }
        if (ctx.state === 'suspended') ctx.resume();
        return ctx;
    }

    function beep(freq = 880, duration = 0.12, vol = 0.35) {
        try {
            const c = getCtx();
            const osc = c.createOscillator();
            const gain = c.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(freq, c.currentTime);
            gain.gain.setValueAtTime(vol, c.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + duration);
            osc.connect(gain);
            gain.connect(c.destination);
            osc.start(c.currentTime);
            osc.stop(c.currentTime + duration);
        } catch (e) { /* silent fail */ }
    }

    function countdownBeep() {
        beep(1200, 0.08, 0.4);
    }

    function whistle() {
        try {
            const c = getCtx();
            const osc = c.createOscillator();
            const gain = c.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(2400, c.currentTime);
            osc.frequency.linearRampToValueAtTime(3200, c.currentTime + 0.15);
            osc.frequency.linearRampToValueAtTime(2800, c.currentTime + 0.5);
            gain.gain.setValueAtTime(0.3, c.currentTime);
            gain.gain.setValueAtTime(0.3, c.currentTime + 0.35);
            gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.6);
            osc.connect(gain);
            gain.connect(c.destination);
            osc.start(c.currentTime);
            osc.stop(c.currentTime + 0.6);
        } catch (e) { /* silent fail */ }
    }

    function completeFanfare() {
        try {
            const c = getCtx();
            const notes = [523.25, 659.25, 783.99, 1046.50]; // C5 E5 G5 C6
            notes.forEach((freq, i) => {
                const osc = c.createOscillator();
                const gain = c.createGain();
                osc.type = 'triangle';
                osc.frequency.setValueAtTime(freq, c.currentTime + i * 0.15);
                gain.gain.setValueAtTime(0.25, c.currentTime + i * 0.15);
                gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + i * 0.15 + 0.4);
                osc.connect(gain);
                gain.connect(c.destination);
                osc.start(c.currentTime + i * 0.15);
                osc.stop(c.currentTime + i * 0.15 + 0.4);
            });
        } catch (e) { /* silent fail */ }
    }

    function metronomeTick() {
        beep(900, 0.03, 0.15);
    }

    return { beep, countdownBeep, whistle, completeFanfare, metronomeTick };
})();

// ─── Vibration Helper ─────────────────────────────
function vibrate(pattern) {
    if ('vibrate' in navigator) {
        try { navigator.vibrate(pattern); } catch (e) { /* silent */ }
    }
}

// ─── Wake Lock ────────────────────────────────────
const WakeLockManager = (() => {
    let wakeLock = null;

    async function request() {
        if ('wakeLock' in navigator) {
            try {
                wakeLock = await navigator.wakeLock.request('screen');
                wakeLock.addEventListener('release', () => { wakeLock = null; });
            } catch (e) { /* silent */ }
        }
    }

    function release() {
        if (wakeLock) {
            wakeLock.release();
            wakeLock = null;
        }
    }

    return { request, release };
})();

// ─── Presets ──────────────────────────────────────
const PRESETS = {
    beginner:     { workTime: 30, restTime: 45, totalRounds: 10 },
    intermediate: { workTime: 45, restTime: 30, totalRounds: 15 },
    professional: { workTime: 60, restTime: 15, totalRounds: 20 },
};

// ─── Application State ───────────────────────────
const state = {
    mode: null,           // 'beginner' | 'intermediate' | 'professional' | 'custom'
    workTime: 30,
    restTime: 45,
    totalRounds: 10,
    currentRound: 1,
    timeRemaining: 0,
    totalTime: 0,         // total phase duration for progress calc
    status: 'READY',      // 'READY' | 'COUNTDOWN' | 'WORK' | 'REST' | 'DONE'
    isActive: false,
    isPaused: false,
    startedAt: null,
    totalElapsed: 0,      // ms
    totalWorkTime: 0,     // seconds actually worked

    // Ghost
    ghostEnabled: false,
    ghostData: null,

    // BPM
    bpmEnabled: false,
    bpm: 120,
};

let timerInterval = null;
let metronomeInterval = null;
let tickTimestamp = 0;

// ─── DOM References ──────────────────────────────
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

const dom = {
    screens: {
        select: $('#screen-select'),
        timer: $('#screen-timer'),
        summary: $('#screen-summary'),
    },
    modeButtons: $$('.mode-card'),
    customWork: $('#custom-work'),
    customRest: $('#custom-rest'),
    customRounds: $('#custom-rounds'),

    // Timer screen
    currentRound: $('#current-round'),
    totalRounds: $('#total-rounds'),
    statusBadge: $('#status-badge'),
    timerProgress: $('#timer-progress'),
    timerTime: $('#timer-time'),
    timerPhaseLabel: $('#timer-phase-label'),
    timerPhaseSub: $('#timer-phase-sub'),
    btnStart: $('#btn-start'),
    btnPause: $('#btn-pause'),
    btnReset: $('#btn-reset'),
    btnBack: $('#btn-back'),

    // Ghost
    ghostToggle: $('#ghost-mode-toggle'),
    ghostStats: $('#ghost-stats'),
    ghostSvg: $('#ghost-svg'),
    ghostProgress: $('#ghost-progress'),
    ghostComparison: $('#ghost-comparison'),
    ghostCompareContent: $('#ghost-compare-content'),

    // BPM
    bpmToggle: $('#bpm-toggle'),
    bpmSlider: $('#bpm-slider'),
    bpmValueLabel: $('#bpm-value'),
    bpmIndicator: $('#bpm-indicator'),
    bpmDot: $('#bpm-dot'),
    bpmDisplay: $('#bpm-display'),

    // Summary
    summaryTime: $('#summary-time'),
    summaryCalories: $('#summary-calories'),
    summaryRounds: $('#summary-rounds'),
    summaryWorkTime: $('#summary-work-time'),
    btnAgain: $('#btn-again'),
    btnHome: $('#btn-home'),
};

// ─── Ring Constants ──────────────────────────────
const RING_CIRCUMFERENCE = 2 * Math.PI * 115; // r=115

// ─── Screen Navigation ──────────────────────────
function showScreen(name) {
    Object.values(dom.screens).forEach(s => s.classList.remove('active'));
    dom.screens[name].classList.add('active');
}

// ─── Mode Selection ─────────────────────────────
function selectMode(mode) {
    state.mode = mode;

    if (mode === 'custom') {
        state.workTime = clamp(parseInt(dom.customWork.value) || 30, 5, 300);
        state.restTime = clamp(parseInt(dom.customRest.value) || 30, 5, 300);
        state.totalRounds = clamp(parseInt(dom.customRounds.value) || 10, 1, 50);
    } else {
        const preset = PRESETS[mode];
        state.workTime = preset.workTime;
        state.restTime = preset.restTime;
        state.totalRounds = preset.totalRounds;
    }

    // Ghost mode
    state.ghostEnabled = dom.ghostToggle.checked;
    if (state.ghostEnabled) {
        state.ghostData = loadGhostData(mode);
    }

    // BPM
    state.bpmEnabled = dom.bpmToggle.checked;
    state.bpm = parseInt(dom.bpmSlider.value) || 120;

    resetTimerState();
    showScreen('timer');
    renderTimer();
}

function resetTimerState() {
    clearInterval(timerInterval);
    stopMetronome();
    timerInterval = null;

    state.currentRound = 1;
    state.status = 'READY';
    state.isActive = false;
    state.isPaused = false;
    state.timeRemaining = state.workTime;
    state.totalTime = state.workTime;
    state.startedAt = null;
    state.totalElapsed = 0;
    state.totalWorkTime = 0;

    document.body.className = 'status-ready';
}

// ─── Timer Rendering ────────────────────────────
function renderTimer() {
    // Round display
    dom.currentRound.textContent = state.currentRound;
    dom.totalRounds.textContent = state.totalRounds;

    // Time display — during COUNTDOWN show big number only
    if (state.status === 'COUNTDOWN') {
        dom.timerTime.textContent = state.timeRemaining > 0
            ? String(state.timeRemaining).padStart(2, '0')
            : '🏁';
    } else {
        const mins = Math.floor(state.timeRemaining / 60);
        const secs = state.timeRemaining % 60;
        dom.timerTime.textContent = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    }

    // Status badge
    const statusClass = state.status.toLowerCase();
    dom.statusBadge.textContent = state.status === 'COUNTDOWN' ? 'READY' : state.status;
    dom.statusBadge.className = 'status-badge ' + (state.status === 'WORK' ? 'work' : state.status === 'REST' ? 'rest' : '');

    // Phase label (main) — the single source of truth for what's happening
    const mainLabels = {
        READY:     '🟢 กดเริ่ม',
        COUNTDOWN: '⚡ เตรียมตัว!',
        WORK:      '🏃 กระโดด!',
        REST:      '😮\u200d💨 พัก',
        DONE:      '🎉 จบแล้ว!',
    };
    dom.timerPhaseLabel.textContent = mainLabels[state.status] || '';
    dom.timerPhaseLabel.className = 'timer-phase-label ' + statusClass;

    // Phase sub-label
    const subLabels = {
        READY:     'เตรียมพร้อม',
        COUNTDOWN: 'นับถอยหลัง...',
        WORK:      `รอบ ${state.currentRound} / ${state.totalRounds}`,
        REST:      'พักฟื้น',
        DONE:      'สำเร็จครบทุกรอบ',
    };
    dom.timerPhaseSub.textContent = subLabels[state.status] || '';

    // Ring progress
    const fraction = state.totalTime > 0 ? state.timeRemaining / state.totalTime : 1;
    const offset = RING_CIRCUMFERENCE * (1 - fraction);
    dom.timerProgress.style.strokeDashoffset = offset;

    // Ring gradient
    dom.timerProgress.classList.remove('transition-work', 'transition-rest', 'transition-ready');
    if (state.status === 'WORK') {
        dom.timerProgress.setAttribute('stroke', 'url(#grad-work)');
        dom.timerProgress.classList.add('transition-work');
    } else if (state.status === 'REST') {
        dom.timerProgress.setAttribute('stroke', 'url(#grad-rest)');
        dom.timerProgress.classList.add('transition-rest');
    } else {
        dom.timerProgress.setAttribute('stroke', 'url(#grad-ready)');
        dom.timerProgress.classList.add('transition-ready');
    }

    // Body background
    document.body.className = `status-${statusClass}`;

    // Pulse effect: last 3 secs during WORK/REST, or last 3 secs of countdown
    const shouldPulse = state.timeRemaining <= 3 && state.timeRemaining > 0 && state.isActive
        && (state.status === 'WORK' || state.status === 'REST' || state.status === 'COUNTDOWN');
    if (shouldPulse) {
        dom.timerTime.classList.add('pulse');
    } else {
        dom.timerTime.classList.remove('pulse');
    }

    // Buttons — hide start/pause during countdown (can't pause countdown)
    if (state.status === 'COUNTDOWN') {
        dom.btnStart.classList.add('hidden');
        dom.btnPause.classList.add('hidden');
    } else if (state.isActive && !state.isPaused) {
        dom.btnStart.classList.add('hidden');
        dom.btnPause.classList.remove('hidden');
    } else {
        dom.btnStart.classList.remove('hidden');
        dom.btnPause.classList.add('hidden');
    }

    // Ghost ring
    if (state.ghostEnabled && state.ghostData) {
        dom.ghostSvg.style.display = 'block';
        renderGhostRing();
    } else {
        dom.ghostSvg.style.display = 'none';
    }

    // BPM indicator
    if (state.bpmEnabled && state.isActive && state.status === 'WORK') {
        dom.bpmIndicator.classList.remove('hidden');
        dom.bpmDisplay.textContent = `${state.bpm} BPM`;
    } else {
        dom.bpmIndicator.classList.add('hidden');
    }
}

// ─── Timer Logic ────────────────────────────────
function startTimer() {
    // Unlock audio context on first interaction
    AudioEngine.beep(0, 0.001, 0);

    if (state.status === 'DONE') return;

    if (state.status === 'READY') {
        // ── 10-second countdown before WORK starts ──
        state.status = 'COUNTDOWN';
        state.timeRemaining = 10;
        state.totalTime = 10;
        AudioEngine.countdownBeep();
        vibrate([80]);
    }

    state.isActive = true;
    state.isPaused = false;

    if (!state.startedAt && state.status !== 'COUNTDOWN') {
        state.startedAt = Date.now();
    }

    WakeLockManager.request();

    clearInterval(timerInterval);
    tickTimestamp = Date.now();

    timerInterval = setInterval(() => {
        const now = Date.now();
        const elapsed = now - tickTimestamp;

        if (elapsed >= 1000) {
            tickTimestamp = now;
            tick();
        }
    }, 100); // Check every 100ms for more accurate timing

    if (state.status !== 'COUNTDOWN') {
        startMetronome();
    }
    renderTimer();
}

function tick() {
    if (state.timeRemaining > 0) {
        state.timeRemaining--;

        // Track work time
        if (state.status === 'WORK') {
            state.totalWorkTime++;
        }

        if (state.status === 'COUNTDOWN') {
            // Countdown beep on every tick; pitch rises near zero
            if (state.timeRemaining <= 3 && state.timeRemaining > 0) {
                AudioEngine.beep(1400, 0.1, 0.5); // high urgent beep
                vibrate([80]);
            } else {
                AudioEngine.countdownBeep();
                vibrate([30]);
            }
        } else if (state.status === 'WORK' || state.status === 'REST') {
            // Phase transition alert: last 3 seconds
            if (state.timeRemaining <= 3 && state.timeRemaining > 0) {
                AudioEngine.countdownBeep();
                vibrate([50]);
            }
        }

        renderTimer();
    } else {
        switchStatus();
    }
}

function switchStatus() {
    if (state.status === 'COUNTDOWN') {
        // Countdown finished → begin WORK!
        state.status = 'WORK';
        state.timeRemaining = state.workTime;
        state.totalTime = state.workTime;
        state.startedAt = Date.now();
        AudioEngine.whistle();
        flashStatus('work-flash');
        vibrate([300, 50, 300]);
        startMetronome();
    } else if (state.status === 'WORK') {
        // Check if this was the last round
        if (state.currentRound >= state.totalRounds) {
            completeWorkout();
            return;
        }
        // Switch to REST
        state.status = 'REST';
        state.timeRemaining = state.restTime;
        state.totalTime = state.restTime;
        AudioEngine.whistle();
        flashStatus('rest-flash');
        vibrate([200, 100, 200]);
        stopMetronome();
    } else if (state.status === 'REST') {
        // Switch to WORK, next round
        state.currentRound++;
        state.status = 'WORK';
        state.timeRemaining = state.workTime;
        state.totalTime = state.workTime;
        AudioEngine.whistle();
        flashStatus('work-flash');
        vibrate([200]);
        startMetronome();
    }

    renderTimer();
}

function pauseTimer() {
    state.isPaused = true;
    state.isActive = false;
    clearInterval(timerInterval);
    timerInterval = null;
    stopMetronome();
    renderTimer();
}

function resetTimer() {
    clearInterval(timerInterval);
    timerInterval = null;
    stopMetronome();
    WakeLockManager.release();
    resetTimerState();
    renderTimer();
}

function completeWorkout() {
    clearInterval(timerInterval);
    timerInterval = null;
    stopMetronome();
    WakeLockManager.release();

    state.status = 'DONE';
    state.isActive = false;
    state.totalElapsed = state.startedAt ? Date.now() - state.startedAt : 0;

    AudioEngine.completeFanfare();
    flashStatus('complete-flash');
    vibrate([300, 100, 300, 100, 500]);

    renderTimer();

    // Save ghost data
    saveGhostData();

    // Show summary after a moment
    setTimeout(() => {
        showSummary();
    }, 1500);
}

// ─── Summary ────────────────────────────────────
function showSummary() {
    const totalMinutes = (state.totalElapsed / 60000).toFixed(1);
    const workMinutes = (state.totalWorkTime / 60).toFixed(1);

    // Calorie estimation: ~12 cal/min for jump rope (moderate intensity)
    const calories = Math.round((state.totalWorkTime / 60) * 12);

    dom.summaryTime.textContent = totalMinutes;
    dom.summaryCalories.textContent = calories;
    dom.summaryRounds.textContent = state.totalRounds;
    dom.summaryWorkTime.textContent = workMinutes;

    // Ghost comparison
    if (state.ghostEnabled && state.ghostData) {
        dom.ghostComparison.classList.remove('hidden');
        renderGhostComparison(totalMinutes, calories);
    } else {
        dom.ghostComparison.classList.add('hidden');
    }

    showScreen('summary');
}

// ─── Ghost Mode ─────────────────────────────────
function getGhostKey(mode) {
    if (mode === 'custom') {
        return `ghost_custom_${state.workTime}_${state.restTime}_${state.totalRounds}`;
    }
    return `ghost_${mode}`;
}

function loadGhostData(mode) {
    try {
        const key = getGhostKey(mode);
        const data = localStorage.getItem(key);
        return data ? JSON.parse(data) : null;
    } catch (e) {
        return null;
    }
}

function saveGhostData() {
    try {
        const key = getGhostKey(state.mode);
        const data = {
            totalElapsed: state.totalElapsed,
            totalWorkTime: state.totalWorkTime,
            totalRounds: state.totalRounds,
            calories: Math.round((state.totalWorkTime / 60) * 12),
            date: new Date().toISOString(),
        };
        localStorage.setItem(key, JSON.stringify(data));
    } catch (e) { /* silent */ }
}

function renderGhostRing() {
    if (!state.ghostData) return;
    // Simple: mirror the main ring progress with ghost data ratio
    const ghostFraction = state.totalTime > 0 ? state.timeRemaining / state.totalTime : 1;
    const offset = RING_CIRCUMFERENCE * (1 - ghostFraction * 0.95); // slightly behind
    dom.ghostProgress.style.strokeDashoffset = offset;
}

function renderGhostComparison(currentMinutes, currentCalories) {
    const ghost = state.ghostData;
    if (!ghost) return;

    const prevMinutes = (ghost.totalElapsed / 60000).toFixed(1);
    const prevCalories = ghost.calories;
    const prevDate = new Date(ghost.date).toLocaleDateString('th-TH', {
        year: 'numeric', month: 'short', day: 'numeric'
    });

    const timeDiff = (currentMinutes - prevMinutes).toFixed(1);
    const calDiff = currentCalories - prevCalories;

    dom.ghostCompareContent.innerHTML = `
        <div class="ghost-compare-row">
            <span class="ghost-compare-label">ครั้งก่อน (${prevDate})</span>
            <span class="ghost-compare-value">${prevMinutes} นาที / ${prevCalories} kcal</span>
        </div>
        <div class="ghost-compare-row">
            <span class="ghost-compare-label">ครั้งนี้</span>
            <span class="ghost-compare-value">${currentMinutes} นาที / ${currentCalories} kcal</span>
        </div>
        <div class="ghost-compare-row">
            <span class="ghost-compare-label">ผลต่าง เวลา</span>
            <span class="ghost-compare-value ${parseFloat(timeDiff) <= 0 ? 'better' : 'worse'}">${timeDiff > 0 ? '+' : ''}${timeDiff} นาที</span>
        </div>
        <div class="ghost-compare-row">
            <span class="ghost-compare-label">ผลต่าง แคลอรี่</span>
            <span class="ghost-compare-value ${calDiff >= 0 ? 'better' : 'worse'}">${calDiff > 0 ? '+' : ''}${calDiff} kcal</span>
        </div>
    `;
}

function updateGhostStatsDisplay() {
    if (!dom.ghostToggle.checked) {
        dom.ghostStats.classList.add('hidden');
        return;
    }

    // Try to load ghost for currently visible modes
    const modes = ['beginner', 'intermediate', 'professional'];
    let hasAny = false;
    let html = '<strong>📊 สถิติที่บันทึกไว้:</strong><br>';

    modes.forEach(mode => {
        const data = loadGhostData(mode);
        if (data) {
            hasAny = true;
            const date = new Date(data.date).toLocaleDateString('th-TH', { month: 'short', day: 'numeric' });
            html += `<span style="text-transform: capitalize">${mode}</span>: ${(data.totalElapsed / 60000).toFixed(1)} นาที, ${data.calories} kcal (${date})<br>`;
        }
    });

    if (hasAny) {
        dom.ghostStats.innerHTML = html;
        dom.ghostStats.classList.remove('hidden');
    } else {
        dom.ghostStats.innerHTML = '⚡ ยังไม่มีสถิติ — ฝึกครั้งแรกเพื่อเริ่มบันทึก!';
        dom.ghostStats.classList.remove('hidden');
    }
}

// ─── BPM Metronome ──────────────────────────────
function startMetronome() {
    if (!state.bpmEnabled || state.status !== 'WORK') return;
    stopMetronome();

    const intervalMs = 60000 / state.bpm;
    metronomeInterval = setInterval(() => {
        if (state.isActive && state.status === 'WORK') {
            AudioEngine.metronomeTick();
            // Visual tick
            dom.bpmDot.classList.add('tick');
            setTimeout(() => dom.bpmDot.classList.remove('tick'), 100);
        }
    }, intervalMs);
}

function stopMetronome() {
    clearInterval(metronomeInterval);
    metronomeInterval = null;
}

// ─── Visual Flash ───────────────────────────────
function flashStatus(cls) {
    const flash = document.createElement('div');
    flash.className = `status-flash ${cls}`;
    document.body.appendChild(flash);
    flash.addEventListener('animationend', () => flash.remove());
}

// ─── Utility ────────────────────────────────────
function clamp(val, min, max) {
    return Math.max(min, Math.min(max, val));
}

// ─── Event Listeners ────────────────────────────
function initEventListeners() {
    // Mode selection
    dom.modeButtons.forEach(btn => {
        btn.addEventListener('click', (e) => {
            // Don't trigger if clicking an input inside custom card
            if (e.target.tagName === 'INPUT') return;
            const mode = btn.dataset.mode;
            selectMode(mode);
        });
    });

    // Timer controls
    dom.btnStart.addEventListener('click', startTimer);
    dom.btnPause.addEventListener('click', pauseTimer);
    dom.btnReset.addEventListener('click', resetTimer);
    dom.btnBack.addEventListener('click', () => {
        resetTimer();
        showScreen('select');
    });

    // Summary buttons
    dom.btnAgain.addEventListener('click', () => {
        resetTimerState();
        renderTimer();
        showScreen('timer');
    });
    dom.btnHome.addEventListener('click', () => {
        resetTimer();
        showScreen('select');
    });

    // Ghost mode toggle
    dom.ghostToggle.addEventListener('change', updateGhostStatsDisplay);

    // BPM controls
    dom.bpmToggle.addEventListener('change', () => {
        const controls = $('#bpm-controls');
        if (dom.bpmToggle.checked) {
            controls.classList.remove('hidden');
        } else {
            controls.classList.add('hidden');
        }
    });

    dom.bpmSlider.addEventListener('input', () => {
        state.bpm = parseInt(dom.bpmSlider.value);
        dom.bpmValueLabel.textContent = `${state.bpm} BPM`;
    });

    // Prevent inputs from bubbling to card click
    $$('.custom-inputs input').forEach(input => {
        input.addEventListener('click', e => e.stopPropagation());
    });

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
        if (dom.screens.timer.classList.contains('active')) {
            if (e.code === 'Space') {
                e.preventDefault();
                if (state.isActive && !state.isPaused) {
                    pauseTimer();
                } else {
                    startTimer();
                }
            } else if (e.code === 'KeyR') {
                resetTimer();
            } else if (e.code === 'Escape') {
                resetTimer();
                showScreen('select');
            }
        }
    });

    // Handle visibility change for wake lock re-acquire
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible' && state.isActive) {
            WakeLockManager.request();
        }
    });
}

// ─── Service Worker Registration ────────────────
function registerSW() {
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('sw.js').catch(() => {});
    }
}

// ─── Initialize ─────────────────────────────────
function init() {
    initEventListeners();
    registerSW();
    updateGhostStatsDisplay();
    showScreen('select');
}

document.addEventListener('DOMContentLoaded', init);
