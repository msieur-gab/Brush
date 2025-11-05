/**
 * Game Results Web Component
 * Displays game results and player statistics
 */

class GameResults extends HTMLElement {
  constructor() {
    super();
    this.currentProfile = null;
    this.currentStats = null;
  }

  connectedCallback() {
    this.render();
  }

  render() {
    this.innerHTML = `
      <style>
        :host {
          display: block;
          width: 100%;
          height: 100%;
        }

        .results-container {
          width: 100%;
          height: 100%;
          display: flex;
          flex-direction: column;
          background: linear-gradient(135deg, var(--bg-gradient-start) 0%, var(--bg-gradient-end) 100%);
          overflow: hidden;
        }

        .results-header {
          flex-shrink: 0;
          text-align: center;
          padding: var(--spacing-lg) var(--spacing-md) var(--spacing-md);
          background: rgba(255, 255, 255, 0.95);
          box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
          z-index: 10;
        }

        .results-title {
          font-size: 2.5rem;
          color: var(--text-dark);
          margin-bottom: var(--spacing-sm);
        }

        .results-subtitle {
          font-size: 1.2rem;
          color: #666;
        }

        .results-content {
          flex: 1;
          overflow-y: auto;
          overflow-x: hidden;
          -webkit-overflow-scrolling: touch;
          padding: var(--spacing-md);
          min-height: 0;
          position: relative;
        }

        .results-content > * {
          max-width: 100%;
        }

        .results-footer {
          flex-shrink: 0;
          padding: var(--spacing-md);
          background: rgba(255, 255, 255, 0.95);
          box-shadow: 0 -2px 10px rgba(0, 0, 0, 0.1);
          z-index: 10;
        }

        .profile-info {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: var(--spacing-md);
          padding: var(--spacing-md);
          background: rgba(74, 144, 226, 0.1);
          border-radius: var(--radius-md);
          margin-bottom: var(--spacing-lg);
        }

        .profile-avatar-large {
          font-size: 3rem;
        }

        .profile-name-large {
          font-size: 1.5rem;
          font-weight: bold;
          color: var(--text-dark);
        }

        .stats-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: var(--spacing-md);
          margin-bottom: var(--spacing-lg);
        }

        .stat-item {
          text-align: center;
          padding: var(--spacing-md);
          background: linear-gradient(135deg, var(--primary-color), var(--secondary-color));
          border-radius: var(--radius-md);
          color: var(--text-light);
        }

        .stat-icon {
          font-size: 2rem;
          margin-bottom: var(--spacing-xs);
        }

        .stat-value {
          font-size: 2rem;
          font-weight: bold;
          margin-bottom: 2px;
        }

        .stat-label {
          font-size: 0.9rem;
          opacity: 0.9;
        }

        .achievements {
          margin-bottom: var(--spacing-lg);
        }

        .achievements-title {
          font-size: 1.2rem;
          font-weight: bold;
          color: var(--text-dark);
          margin-bottom: var(--spacing-sm);
          text-align: center;
        }

        .achievement-list {
          display: flex;
          flex-wrap: wrap;
          gap: var(--spacing-sm);
          justify-content: center;
        }

        .achievement-badge {
          padding: var(--spacing-xs) var(--spacing-md);
          background: var(--accent-color);
          color: var(--text-light);
          border-radius: var(--radius-full);
          font-size: 0.9rem;
          font-weight: 600;
          animation: bounceIn 0.6s ease;
        }

        .recent-history {
          margin-bottom: var(--spacing-lg);
        }

        .history-title {
          font-size: 1.2rem;
          font-weight: bold;
          color: var(--text-dark);
          margin-bottom: var(--spacing-sm);
          text-align: center;
        }

        .history-list {
          background: rgba(255, 255, 255, 0.5);
          border-radius: var(--radius-md);
          padding: var(--spacing-xs);
        }

        .history-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: var(--spacing-sm);
          border-bottom: 1px solid rgba(0, 0, 0, 0.1);
          font-size: 0.9rem;
          color: var(--text-dark);
          background: rgba(255, 255, 255, 0.7);
          margin-bottom: var(--spacing-xs);
          border-radius: var(--radius-sm);
        }

        .history-item:last-child {
          margin-bottom: 0;
        }

        .actions {
          display: flex;
          flex-direction: column;
          gap: var(--spacing-sm);
        }

        .scroll-indicator {
          text-align: center;
          color: rgba(0, 0, 0, 0.5);
          font-size: 0.85rem;
          padding: var(--spacing-xs);
          animation: bounce 2s infinite;
        }

        @keyframes bounce {
          0%, 100% {
            transform: translateY(0);
          }
          50% {
            transform: translateY(-5px);
          }
        }

        .encouragement {
          text-align: center;
          font-size: 1.1rem;
          color: var(--text-dark);
          margin-bottom: var(--spacing-md);
          font-weight: 600;
        }
      </style>

      <div class="results-container">
        <!-- Fixed Header -->
        <div class="results-header">
          <div class="results-title" id="results-title">Great Job!</div>
          <div class="results-subtitle" id="results-subtitle">You completed your brushing session!</div>
        </div>

        <!-- Scrollable Content -->
        <div class="results-content" id="results-content">
          <!-- Content will be populated dynamically -->
        </div>

        <!-- Fixed Footer with Actions -->
        <div class="results-footer">
          <div class="actions" id="results-actions">
            <button class="btn btn-primary" id="play-again-btn">Play Again</button>
            <button class="btn btn-secondary" id="change-profile-btn">Change Profile</button>
          </div>
        </div>
      </div>
    `;
  }

  async showResults(profile, stats) {
    this.currentProfile = profile;
    this.currentStats = stats;

    // Get overall profile stats
    const profileStats = await database.getProfileStats(profile.id);

    // Get recent sessions - show more since we have scrolling now!
    const recentSessions = await database.getSessionsByProfile(profile.id, 20);

    // Generate achievements
    const achievements = this.generateAchievements(stats, profileStats);

    // Update content
    const content = this.querySelector('#results-content');
    content.innerHTML = `
      <div class="profile-info">
        <div class="profile-avatar-large">${profile.avatar}</div>
        <div class="profile-name-large">${this.escapeHtml(profile.name)}</div>
      </div>

      <div class="encouragement">${this.getEncouragement(stats)}</div>

      <div class="stats-grid">
        <div class="stat-item">
          <div class="stat-icon">⭐</div>
          <div class="stat-value">${stats.score}</div>
          <div class="stat-label">Points</div>
        </div>
        <div class="stat-item">
          <div class="stat-icon">👾</div>
          <div class="stat-value">${stats.creaturesDestroyed}</div>
          <div class="stat-label">Creatures</div>
        </div>
        <div class="stat-item">
          <div class="stat-icon">⏱️</div>
          <div class="stat-value">${Math.floor(stats.duration / 60)}:${(stats.duration % 60).toString().padStart(2, '0')}</div>
          <div class="stat-label">Time</div>
        </div>
        <div class="stat-item">
          <div class="stat-icon">🔥</div>
          <div class="stat-value">${profileStats.streak}</div>
          <div class="stat-label">Day Streak</div>
        </div>
      </div>

      ${achievements.length > 0 ? `
        <div class="achievements">
          <div class="achievements-title">🏆 Achievements</div>
          <div class="achievement-list">
            ${achievements.map(achievement => `
              <div class="achievement-badge">${achievement}</div>
            `).join('')}
          </div>
        </div>
      ` : ''}

      ${recentSessions.length > 0 ? `
        <div class="recent-history">
          <div class="history-title">📊 Brushing History (${recentSessions.length} sessions)</div>
          <div class="history-list">
            ${recentSessions.map((session, index) => `
              <div class="history-item">
                <span>${index === 0 ? '🆕 ' : ''}${new Date(session.createdAt).toLocaleDateString()} ${new Date(session.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                <span>⭐ ${session.score} | 👾 ${session.creaturesDestroyed}</span>
              </div>
            `).join('')}
          </div>
          ${recentSessions.length > 5 ? '<div class="scroll-indicator">👆 Scroll to see all sessions</div>' : ''}
        </div>
      ` : ''}

      <!-- Overall Stats Summary -->
      ${profileStats.totalSessions > 1 ? `
        <div class="recent-history">
          <div class="history-title">📈 Overall Stats</div>
          <div class="profile-info" style="flex-direction: column; gap: var(--spacing-xs);">
            <div>Total Brushing Sessions: <strong>${profileStats.totalSessions}</strong></div>
            <div>Total Points Earned: <strong>⭐ ${profileStats.totalScore}</strong></div>
            <div>Total Creatures Defeated: <strong>👾 ${profileStats.totalCreatures}</strong></div>
            <div>Average Score: <strong>${profileStats.averageScore}</strong></div>
            <div>Best Score: <strong>🏆 ${profileStats.bestScore}</strong></div>
          </div>
        </div>
      ` : ''}
    `;

    // Attach event listeners to footer buttons
    this.querySelector('#play-again-btn')?.addEventListener('click', () => {
      this.dispatchEvent(new CustomEvent('play-again', {
        bubbles: true,
        detail: { profile }
      }));
    });

    this.querySelector('#change-profile-btn')?.addEventListener('click', () => {
      this.dispatchEvent(new CustomEvent('change-profile', { bubbles: true }));
    });

    // Update title based on performance
    this.updateTitle(stats, profileStats);
  }

  updateTitle(stats, profileStats) {
    const titleElement = this.querySelector('#results-title');
    const subtitleElement = this.querySelector('#results-subtitle');

    if (stats.score >= 1000) {
      titleElement.textContent = '🌟 Amazing! 🌟';
      subtitleElement.textContent = 'You\'re a brushing superstar!';
    } else if (stats.score >= 500) {
      titleElement.textContent = '🎉 Excellent! 🎉';
      subtitleElement.textContent = 'Your teeth are sparkling clean!';
    } else if (stats.score >= 250) {
      titleElement.textContent = '👍 Great Job! 👍';
      subtitleElement.textContent = 'Keep up the good work!';
    } else {
      titleElement.textContent = '🦷 Well Done! 🦷';
      subtitleElement.textContent = 'Every brush counts!';
    }
  }

  getEncouragement(stats) {
    const messages = [
      'Your teeth are thanking you! 🦷',
      'Keep that smile shining bright! ✨',
      'Brushing champion in the making! 🏆',
      'You\'re building healthy habits! 💪',
      'Another day, another victory! 🎯'
    ];

    return messages[Math.floor(Math.random() * messages.length)];
  }

  generateAchievements(stats, profileStats) {
    const achievements = [];

    // First game
    if (profileStats.totalSessions === 1) {
      achievements.push('🎮 First Game');
    }

    // Score achievements
    if (stats.score >= 1000) {
      achievements.push('🌟 Score Master');
    } else if (stats.score >= 500) {
      achievements.push('⭐ High Scorer');
    }

    // Creature achievements
    if (stats.creaturesDestroyed >= 50) {
      achievements.push('👾 Creature Hunter');
    } else if (stats.creaturesDestroyed >= 25) {
      achievements.push('🎯 Sharp Shooter');
    }

    // Streak achievements
    if (profileStats.streak >= 7) {
      achievements.push('🔥 Week Warrior');
    } else if (profileStats.streak >= 3) {
      achievements.push('📅 3 Day Streak');
    }

    // Duration achievement
    if (stats.duration >= 120) {
      achievements.push('⏱️ Time Master');
    }

    // Total games
    if (profileStats.totalSessions >= 10) {
      achievements.push('🎖️ Veteran');
    } else if (profileStats.totalSessions >= 5) {
      achievements.push('🏅 Regular');
    }

    return achievements;
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}

customElements.define('game-results', GameResults);
