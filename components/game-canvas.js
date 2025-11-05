/**
 * Game Canvas Web Component
 * Manages the game display, camera feed, and game rendering
 */

class GameCanvas extends HTMLElement {
  constructor() {
    super();
    this.gameEngine = null;
    this.mediapipeController = null;
    this.currentProfile = null;
  }

  connectedCallback() {
    this.render();
  }

  render() {
    this.innerHTML = `
      <style>
        .game-container {
          width: 100%;
          height: 100%;
          position: relative;
          overflow: hidden;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        }

        .camera-container {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          background: #000;
          z-index: 1;
        }

        #camera-feed {
          width: 100%;
          height: 100%;
          object-fit: cover;
          transform: scaleX(-1);
          opacity: 0.7;
          position: relative;
        }

        #game-canvas {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          pointer-events: none;
          z-index: 10;
        }

        .game-overlay {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          pointer-events: none;
        }

        .hud {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          padding: var(--spacing-md);
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          z-index: 50;
          pointer-events: none;
        }

        .hud-item {
          background: rgba(0, 0, 0, 0.5);
          backdrop-filter: blur(10px);
          padding: var(--spacing-sm) var(--spacing-md);
          border-radius: var(--radius-lg);
          color: var(--text-light);
          font-weight: bold;
          font-size: 1.5rem;
          text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.5);
          min-width: 100px;
          text-align: center;
        }

        .hud-label {
          font-size: 0.8rem;
          opacity: 0.8;
          margin-bottom: 2px;
        }

        .hud-value {
          font-size: 1.8rem;
        }

        .timer-warning {
          animation: pulse 1s infinite;
          background: rgba(231, 76, 60, 0.7);
        }

        .pause-overlay {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.7);
          backdrop-filter: blur(10px);
          display: none;
          align-items: center;
          justify-content: center;
          z-index: 200;
        }

        .pause-overlay.active {
          display: flex;
        }

        .pause-menu {
          background: rgba(255, 255, 255, 0.95);
          border-radius: var(--radius-lg);
          padding: var(--spacing-xl);
          text-align: center;
          max-width: 400px;
        }

        .pause-menu h2 {
          color: var(--text-dark);
          margin-bottom: var(--spacing-md);
        }

        .pause-actions {
          display: flex;
          flex-direction: column;
          gap: var(--spacing-sm);
        }

        .countdown {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          font-size: 8rem;
          color: var(--text-light);
          text-shadow: 4px 4px 8px rgba(0, 0, 0, 0.5);
          font-weight: bold;
          z-index: 500;
          animation: countdownPulse 1s ease;
          pointer-events: none;
        }

        @keyframes countdownPulse {
          0% {
            transform: translate(-50%, -50%) scale(0);
            opacity: 0;
          }
          50% {
            transform: translate(-50%, -50%) scale(1.2);
            opacity: 1;
          }
          100% {
            transform: translate(-50%, -50%) scale(1);
            opacity: 0;
          }
        }

        .loading {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          text-align: center;
          color: var(--text-light);
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          z-index: 1000;
        }

        .loading.hidden {
          display: none;
        }

        .loading-text {
          font-size: 1.5rem;
          margin-top: var(--spacing-md);
        }

        .pause-btn {
          position: absolute;
          top: var(--spacing-md);
          right: var(--spacing-md);
          background: rgba(0, 0, 0, 0.5);
          backdrop-filter: blur(10px);
          color: var(--text-light);
          border: none;
          border-radius: 50%;
          width: 50px;
          height: 50px;
          font-size: 1.5rem;
          cursor: pointer;
          z-index: 60;
          pointer-events: all;
          transition: all var(--transition-fast);
        }

        .pause-btn:active {
          transform: scale(0.9);
        }
      </style>

      <div class="game-container">
        <!-- Loading State -->
        <div id="loading-state" class="loading hidden">
          <div class="spinner"></div>
          <div class="loading-text">Initializing camera...</div>
        </div>

        <!-- Camera Feed -->
        <div class="camera-container">
          <video id="camera-feed" autoplay playsinline></video>
        </div>

        <!-- Game Canvas -->
        <canvas id="game-canvas"></canvas>

        <!-- HUD -->
        <div class="hud">
          <div class="hud-item">
            <div class="hud-label">Score</div>
            <div class="hud-value" id="score-value">0</div>
          </div>
          <div class="hud-item" id="timer-display">
            <div class="hud-label">Time</div>
            <div class="hud-value" id="timer-value">2:00</div>
          </div>
        </div>

        <!-- Pause Button -->
        <button class="pause-btn" id="pause-btn" aria-label="Pause game">⏸</button>

        <!-- Pause Overlay -->
        <div class="pause-overlay" id="pause-overlay">
          <div class="pause-menu">
            <h2>Game Paused</h2>
            <div class="pause-actions">
              <button class="btn btn-primary" id="resume-btn">Resume</button>
              <button class="btn btn-secondary" id="quit-btn">Quit</button>
            </div>
          </div>
        </div>

        <!-- Countdown -->
        <div id="countdown-display" class="hidden"></div>
      </div>
    `;

    this.setupEventListeners();
  }

  setupEventListeners() {
    const pauseBtn = this.querySelector('#pause-btn');
    const resumeBtn = this.querySelector('#resume-btn');
    const quitBtn = this.querySelector('#quit-btn');

    pauseBtn?.addEventListener('click', () => this.pauseGame());
    resumeBtn?.addEventListener('click', () => this.resumeGame());
    quitBtn?.addEventListener('click', () => this.quitGame());
  }

  async startGame(profile) {
    this.currentProfile = profile;

    // Show loading screen
    const loadingState = this.querySelector('#loading-state');
    loadingState.classList.remove('hidden');

    try {
      // Initialize MediaPipe controller
      if (!window.mediapipeController) {
        window.mediapipeController = new MediaPipeController();
      }

      const videoElement = this.querySelector('#camera-feed');
      await window.mediapipeController.initialize(videoElement);

      // Hide loading screen
      loadingState.classList.add('hidden');

      // Show countdown
      await this.showCountdown();

      // Initialize game engine
      const canvas = this.querySelector('#game-canvas');
      if (!window.gameEngine) {
        window.gameEngine = new GameEngine(canvas);
      }

      // Start game
      window.gameEngine.start(profile, window.mediapipeController);

      // Update HUD
      this.startHUDUpdate();

    } catch (error) {
      console.error('Error starting game:', error);
      // Keep loading state visible and show error
      loadingState.innerHTML = `
        <div style="color: var(--text-light); text-align: center;">
          <div style="font-size: 3rem;">⚠️</div>
          <div class="loading-text">Failed to start camera</div>
          <div style="font-size: 1rem; margin-top: var(--spacing-sm); opacity: 0.8;">
            Please allow camera access and ensure good lighting
          </div>
          <div style="margin-top: var(--spacing-md);">
            <button class="btn btn-primary" onclick="location.reload()">Try Again</button>
          </div>
        </div>
      `;
    }
  }

  async showCountdown() {
    const countdownDisplay = this.querySelector('#countdown-display');

    for (let i = 3; i > 0; i--) {
      countdownDisplay.textContent = i;
      countdownDisplay.classList.remove('hidden');
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    countdownDisplay.textContent = 'GO!';
    await new Promise(resolve => setTimeout(resolve, 500));
    countdownDisplay.classList.add('hidden');
  }

  startHUDUpdate() {
    this.hudInterval = setInterval(() => {
      if (!window.gameEngine) return;

      const state = window.gameEngine.getGameState();

      // Update score
      const scoreValue = this.querySelector('#score-value');
      if (scoreValue) {
        scoreValue.textContent = state.score;
      }

      // Update timer
      const timerValue = this.querySelector('#timer-value');
      const timerDisplay = this.querySelector('#timer-display');
      if (timerValue && timerDisplay) {
        const minutes = Math.floor(state.timeRemaining / 60);
        const seconds = state.timeRemaining % 60;
        timerValue.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;

        // Warning state
        if (state.timeRemaining <= 10 && state.timeRemaining > 0) {
          timerDisplay.classList.add('timer-warning');
        } else {
          timerDisplay.classList.remove('timer-warning');
        }
      }

      // Check if game ended
      if (state.gameEnded) {
        this.endGame(state);
      }
    }, 100);
  }

  pauseGame() {
    if (window.gameEngine) {
      window.gameEngine.pause();
    }
    const pauseOverlay = this.querySelector('#pause-overlay');
    pauseOverlay?.classList.add('active');

    const pauseBtn = this.querySelector('#pause-btn');
    if (pauseBtn) pauseBtn.style.display = 'none';
  }

  resumeGame() {
    if (window.gameEngine) {
      window.gameEngine.resume();
    }
    const pauseOverlay = this.querySelector('#pause-overlay');
    pauseOverlay?.classList.remove('active');

    const pauseBtn = this.querySelector('#pause-btn');
    if (pauseBtn) pauseBtn.style.display = 'block';
  }

  quitGame() {
    if (confirm('Are you sure you want to quit? Your progress will be lost!')) {
      this.cleanup();
      this.dispatchEvent(new CustomEvent('game-quit', { bubbles: true }));
    }
  }

  async endGame(state) {
    // Stop HUD updates
    if (this.hudInterval) {
      clearInterval(this.hudInterval);
    }

    // Save session to database
    try {
      await database.createSession(
        this.currentProfile.id,
        state.duration,
        state.score,
        state.creaturesDestroyed
      );
    } catch (error) {
      console.error('Error saving session:', error);
    }

    // Dispatch game-ended event
    this.dispatchEvent(new CustomEvent('game-ended', {
      bubbles: true,
      detail: {
        profile: this.currentProfile,
        stats: state
      }
    }));

    this.cleanup();
  }

  cleanup() {
    // Stop game engine
    if (window.gameEngine) {
      window.gameEngine.stop();
    }

    // Stop MediaPipe
    if (window.mediapipeController) {
      window.mediapipeController.stop();
    }

    // Clear HUD interval
    if (this.hudInterval) {
      clearInterval(this.hudInterval);
    }
  }

  disconnectedCallback() {
    this.cleanup();
  }
}

customElements.define('game-canvas', GameCanvas);
