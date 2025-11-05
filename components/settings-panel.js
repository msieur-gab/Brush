/**
 * Settings Panel Web Component
 * Manages game settings and configuration
 */

class SettingsPanel extends HTMLElement {
  constructor() {
    super();
    this.requiredDuration = 120; // Default 2 minutes
  }

  async connectedCallback() {
    await this.loadSettings();
    this.render();
    this.attachEventListeners();
  }

  async loadSettings() {
    this.requiredDuration = await database.getSetting('requiredDuration') || 120;
  }

  render() {
    this.innerHTML = `
      <style>
        .settings-container {
          padding: var(--spacing-lg);
          color: var(--text-light);
          max-width: 500px;
        }

        .settings-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: var(--spacing-lg);
        }

        .settings-title {
          font-size: 1.8rem;
          font-weight: bold;
        }

        .close-btn {
          background: rgba(255, 255, 255, 0.2);
          border: none;
          color: var(--text-light);
          font-size: 1.5rem;
          width: 40px;
          height: 40px;
          border-radius: 50%;
          cursor: pointer;
          transition: all var(--transition-fast);
        }

        .close-btn:hover {
          background: rgba(255, 255, 255, 0.3);
        }

        .setting-item {
          background: rgba(255, 255, 255, 0.1);
          padding: var(--spacing-md);
          border-radius: var(--radius-md);
          margin-bottom: var(--spacing-md);
        }

        .setting-label {
          font-weight: 600;
          margin-bottom: var(--spacing-xs);
          display: block;
        }

        .setting-description {
          font-size: 0.9rem;
          opacity: 0.8;
          margin-bottom: var(--spacing-sm);
        }

        .setting-control {
          display: flex;
          align-items: center;
          gap: var(--spacing-sm);
        }

        .slider {
          flex: 1;
          height: 8px;
          border-radius: var(--radius-full);
          background: rgba(255, 255, 255, 0.3);
          outline: none;
          -webkit-appearance: none;
        }

        .slider::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 24px;
          height: 24px;
          border-radius: 50%;
          background: var(--text-light);
          cursor: pointer;
        }

        .slider::-moz-range-thumb {
          width: 24px;
          height: 24px;
          border-radius: 50%;
          background: var(--text-light);
          cursor: pointer;
          border: none;
        }

        .slider-value {
          min-width: 80px;
          text-align: right;
          font-weight: bold;
        }

        .danger-zone {
          margin-top: var(--spacing-xl);
          padding-top: var(--spacing-lg);
          border-top: 2px solid rgba(255, 255, 255, 0.2);
        }

        .danger-title {
          color: var(--danger-color);
          font-weight: bold;
          margin-bottom: var(--spacing-sm);
        }

        .info-section {
          margin-top: var(--spacing-lg);
          padding: var(--spacing-md);
          background: rgba(255, 255, 255, 0.1);
          border-radius: var(--radius-md);
          font-size: 0.9rem;
        }

        .info-title {
          font-weight: bold;
          margin-bottom: var(--spacing-xs);
        }
      </style>

      <div class="settings-container">
        <div class="settings-header">
          <h2 class="settings-title">⚙️ Settings</h2>
          <button class="close-btn" id="close-settings" aria-label="Close settings">✕</button>
        </div>

        <div class="setting-item">
          <label class="setting-label" for="duration-slider">Brushing Duration</label>
          <div class="setting-description">
            Set the required brushing time (recommended: 2 minutes)
          </div>
          <div class="setting-control">
            <input
              type="range"
              id="duration-slider"
              class="slider"
              min="60"
              max="300"
              step="30"
              value="${this.requiredDuration}"
            >
            <span class="slider-value" id="duration-value">${this.formatDuration(this.requiredDuration)}</span>
          </div>
        </div>

        <div class="info-section">
          <div class="info-title">📱 How to Play</div>
          <ul style="margin-left: var(--spacing-md); margin-top: var(--spacing-xs);">
            <li>Hold your toothbrush in view of the camera</li>
            <li>Brush towards creatures to destroy them</li>
            <li>Each creature gives you points</li>
            <li>Complete the full timer for best results!</li>
          </ul>
        </div>

        <div class="info-section">
          <div class="info-title">💡 Tips</div>
          <ul style="margin-left: var(--spacing-md); margin-top: var(--spacing-xs);">
            <li>Mount your phone on the mirror</li>
            <li>Make sure the room is well-lit</li>
            <li>Use steady brushing motions</li>
            <li>Have fun and keep brushing!</li>
          </ul>
        </div>

        <div class="danger-zone">
          <div class="danger-title">⚠️ Danger Zone</div>
          <button class="btn btn-danger" id="clear-data-btn" style="width: 100%;">
            Clear All Data
          </button>
        </div>
      </div>
    `;
  }

  attachEventListeners() {
    // Close button
    this.querySelector('#close-settings')?.addEventListener('click', () => {
      this.closeSettings();
    });

    // Duration slider
    const slider = this.querySelector('#duration-slider');
    const valueDisplay = this.querySelector('#duration-value');

    slider?.addEventListener('input', (e) => {
      const value = parseInt(e.target.value);
      valueDisplay.textContent = this.formatDuration(value);
    });

    slider?.addEventListener('change', async (e) => {
      const value = parseInt(e.target.value);
      this.requiredDuration = value;
      await database.setSetting('requiredDuration', value);
    });

    // Clear data button
    this.querySelector('#clear-data-btn')?.addEventListener('click', async () => {
      if (confirm('Are you sure you want to delete ALL profiles and data? This cannot be undone!')) {
        if (confirm('This will permanently delete everything. Are you absolutely sure?')) {
          await database.clearAllData();
          alert('All data has been cleared.');
          this.closeSettings();
          location.reload();
        }
      }
    });
  }

  formatDuration(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }

  closeSettings() {
    const modal = this.closest('dialog');
    if (modal) {
      modal.close();
    }
  }
}

customElements.define('settings-panel', SettingsPanel);
