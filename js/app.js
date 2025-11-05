/**
 * Main Application Controller
 * Coordinates screens, navigation, and game flow
 */

class BrushBattleApp {
  constructor() {
    this.screens = {
      profile: document.getElementById('profile-screen'),
      game: document.getElementById('game-screen'),
      results: document.getElementById('results-screen')
    };

    this.currentProfile = null;
    this.settingsModal = document.getElementById('settings-modal');

    this.init();
  }

  init() {
    // Set up event listeners
    this.setupEventListeners();

    // Show profile selection by default
    this.showScreen('profile');
  }

  setupEventListeners() {
    // Profile selected
    document.addEventListener('profile-selected', (e) => {
      this.currentProfile = e.detail.profile;
      this.startGame();
    });

    // Game ended
    document.addEventListener('game-ended', (e) => {
      this.showResults(e.detail.profile, e.detail.stats);
    });

    // Game quit
    document.addEventListener('game-quit', () => {
      this.showScreen('profile');
    });

    // Play again
    document.addEventListener('play-again', (e) => {
      this.currentProfile = e.detail.profile;
      this.startGame();
    });

    // Change profile
    document.addEventListener('change-profile', () => {
      this.showScreen('profile');
      // Reload profiles to update stats
      const profileSelector = document.querySelector('profile-selector');
      if (profileSelector) {
        profileSelector.loadProfiles().then(() => {
          profileSelector.render();
          profileSelector.attachEventListeners();
        });
      }
    });

    // Settings button
    const settingsBtn = document.getElementById('settings-btn');
    if (settingsBtn) {
      settingsBtn.addEventListener('click', () => {
        this.openSettings();
      });
    }

    // Close modal on backdrop click
    if (this.settingsModal) {
      this.settingsModal.addEventListener('click', (e) => {
        if (e.target === this.settingsModal) {
          this.settingsModal.close();
        }
      });
    }
  }

  showScreen(screenName) {
    // Hide all screens
    Object.values(this.screens).forEach(screen => {
      screen.classList.remove('active');
    });

    // Show requested screen
    if (this.screens[screenName]) {
      this.screens[screenName].classList.add('active');
    }
  }

  async startGame() {
    // Switch to game screen
    this.showScreen('game');

    // Get game canvas component
    const gameCanvas = document.querySelector('game-canvas');

    if (gameCanvas) {
      // Small delay to ensure screen is visible
      await new Promise(resolve => setTimeout(resolve, 100));

      // Start the game
      gameCanvas.startGame(this.currentProfile);
    }
  }

  async showResults(profile, stats) {
    // Switch to results screen
    this.showScreen('results');

    // Get results component
    const gameResults = document.querySelector('game-results');

    if (gameResults) {
      // Show results
      await gameResults.showResults(profile, stats);
    }
  }

  openSettings() {
    if (this.settingsModal) {
      this.settingsModal.showModal();
    }
  }
}

// Initialize app when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    window.brushBattleApp = new BrushBattleApp();
  });
} else {
  window.brushBattleApp = new BrushBattleApp();
}
