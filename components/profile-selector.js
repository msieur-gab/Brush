/**
 * Profile Selector Web Component
 * Allows selection and management of kid profiles
 */

class ProfileSelector extends HTMLElement {
  constructor() {
    super();
    this.profiles = [];
    this.avatars = ['🦷', '🦖', '🚀', '🌈', '⭐', '🎨', '🎮', '🐶', '🐱', '🦄'];
  }

  async connectedCallback() {
    await this.loadProfiles();
    this.render();
    this.attachEventListeners();
  }

  async loadProfiles() {
    this.profiles = await database.getAllProfiles();
  }

  render() {
    this.innerHTML = `
      <style>
        .profile-container {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: var(--spacing-md);
          gap: var(--spacing-lg);
        }

        .profiles-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
          gap: var(--spacing-md);
          width: 100%;
          max-width: 600px;
        }

        .profile-card {
          background: rgba(255, 255, 255, 0.9);
          border-radius: var(--radius-lg);
          padding: var(--spacing-md);
          text-align: center;
          cursor: pointer;
          transition: all var(--transition-fast);
          box-shadow: 0 4px 15px var(--shadow-color);
          position: relative;
        }

        .profile-card:hover {
          transform: translateY(-5px);
          box-shadow: 0 6px 20px var(--shadow-color);
        }

        .profile-card:active {
          transform: scale(0.95);
        }

        .profile-avatar {
          font-size: 3rem;
          margin-bottom: var(--spacing-xs);
          display: block;
        }

        .profile-name {
          font-size: 1rem;
          font-weight: 600;
          color: var(--text-dark);
          word-break: break-word;
        }

        .profile-stats {
          font-size: 0.75rem;
          color: #666;
          margin-top: var(--spacing-xs);
        }

        .add-profile-card {
          background: rgba(255, 255, 255, 0.3);
          border: 3px dashed rgba(255, 255, 255, 0.6);
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          min-height: 140px;
        }

        .add-profile-icon {
          font-size: 3rem;
          margin-bottom: var(--spacing-xs);
        }

        .add-profile-text {
          font-size: 0.9rem;
          color: var(--text-light);
          font-weight: 600;
        }

        .profile-form {
          background: rgba(255, 255, 255, 0.95);
          border-radius: var(--radius-lg);
          padding: var(--spacing-lg);
          width: 100%;
          max-width: 400px;
          box-shadow: 0 4px 15px var(--shadow-color);
        }

        .profile-form h3 {
          color: var(--text-dark);
          margin-bottom: var(--spacing-md);
          text-align: center;
        }

        .form-group {
          margin-bottom: var(--spacing-md);
        }

        .form-label {
          display: block;
          color: var(--text-dark);
          font-weight: 600;
          margin-bottom: var(--spacing-xs);
        }

        .form-input {
          width: 100%;
          padding: var(--spacing-sm);
          font-size: 1rem;
          border: 2px solid #ddd;
          border-radius: var(--radius-sm);
          outline: none;
          transition: border-color var(--transition-fast);
        }

        .form-input:focus {
          border-color: var(--primary-color);
        }

        .avatar-selector {
          display: grid;
          grid-template-columns: repeat(5, 1fr);
          gap: var(--spacing-xs);
        }

        .avatar-option {
          font-size: 2rem;
          padding: var(--spacing-xs);
          border: 3px solid transparent;
          border-radius: var(--radius-sm);
          cursor: pointer;
          transition: all var(--transition-fast);
          text-align: center;
        }

        .avatar-option:hover {
          background: rgba(74, 144, 226, 0.1);
        }

        .avatar-option.selected {
          border-color: var(--primary-color);
          background: rgba(74, 144, 226, 0.2);
        }

        .form-actions {
          display: flex;
          gap: var(--spacing-sm);
          margin-top: var(--spacing-md);
        }

        .form-actions button {
          flex: 1;
        }

        .delete-btn {
          position: absolute;
          top: 5px;
          right: 5px;
          background: var(--danger-color);
          color: white;
          border: none;
          border-radius: 50%;
          width: 25px;
          height: 25px;
          font-size: 0.8rem;
          cursor: pointer;
          display: none;
          align-items: center;
          justify-content: center;
          opacity: 0.8;
          transition: opacity var(--transition-fast);
        }

        .profile-card:hover .delete-btn {
          display: flex;
        }

        .delete-btn:hover {
          opacity: 1;
        }

        .empty-state {
          text-align: center;
          color: var(--text-light);
          padding: var(--spacing-xl);
        }

        .empty-state-icon {
          font-size: 4rem;
          margin-bottom: var(--spacing-md);
        }

        .empty-state-text {
          font-size: 1.2rem;
          margin-bottom: var(--spacing-lg);
        }
      </style>

      <div class="profile-container">
        <div id="profile-list" class="profiles-grid">
          ${this.renderProfiles()}
        </div>

        <div id="profile-form-container" class="hidden">
          ${this.renderProfileForm()}
        </div>
      </div>
    `;
  }

  renderProfiles() {
    if (this.profiles.length === 0) {
      return `
        <div class="empty-state" style="grid-column: 1/-1;">
          <div class="empty-state-icon">🦷</div>
          <div class="empty-state-text">No profiles yet! Create one to start brushing!</div>
        </div>
        <div class="profile-card add-profile-card" data-action="add">
          <div class="add-profile-icon">➕</div>
          <div class="add-profile-text">Add Profile</div>
        </div>
      `;
    }

    return `
      ${this.profiles.map(profile => `
        <div class="profile-card" data-profile-id="${profile.id}">
          <button class="delete-btn" data-action="delete" data-id="${profile.id}" aria-label="Delete profile">✕</button>
          <div class="profile-avatar">${profile.avatar}</div>
          <div class="profile-name">${this.escapeHtml(profile.name)}</div>
          <div class="profile-stats" data-profile-id="${profile.id}">Loading...</div>
        </div>
      `).join('')}
      <div class="profile-card add-profile-card" data-action="add">
        <div class="add-profile-icon">➕</div>
        <div class="add-profile-text">Add Profile</div>
      </div>
    `;
  }

  renderProfileForm() {
    return `
      <form class="profile-form" id="new-profile-form">
        <h3>Create New Profile</h3>

        <div class="form-group">
          <label class="form-label" for="profile-name">Name</label>
          <input
            type="text"
            id="profile-name"
            class="form-input"
            placeholder="Enter name..."
            maxlength="20"
            required
            autocomplete="off"
          >
        </div>

        <div class="form-group">
          <label class="form-label">Choose Avatar</label>
          <div class="avatar-selector">
            ${this.avatars.map((avatar, index) => `
              <div class="avatar-option ${index === 0 ? 'selected' : ''}" data-avatar="${avatar}">
                ${avatar}
              </div>
            `).join('')}
          </div>
        </div>

        <div class="form-actions">
          <button type="button" class="btn btn-secondary" id="cancel-form-btn">Cancel</button>
          <button type="submit" class="btn btn-primary">Create</button>
        </div>
      </form>
    `;
  }

  attachEventListeners() {
    // Profile selection
    this.addEventListener('click', async (e) => {
      const profileCard = e.target.closest('.profile-card:not(.add-profile-card)');
      if (profileCard && !e.target.closest('.delete-btn')) {
        const profileId = parseInt(profileCard.dataset.profileId);
        await this.selectProfile(profileId);
      }

      // Add profile
      if (e.target.closest('[data-action="add"]')) {
        this.showProfileForm();
      }

      // Delete profile
      if (e.target.closest('[data-action="delete"]')) {
        e.stopPropagation();
        const profileId = parseInt(e.target.closest('[data-action="delete"]').dataset.id);
        await this.deleteProfile(profileId);
      }

      // Avatar selection
      const avatarOption = e.target.closest('.avatar-option');
      if (avatarOption) {
        this.querySelectorAll('.avatar-option').forEach(opt => opt.classList.remove('selected'));
        avatarOption.classList.add('selected');
      }

      // Cancel form
      if (e.target.closest('#cancel-form-btn')) {
        this.hideProfileForm();
      }
    });

    // Form submission
    const form = this.querySelector('#new-profile-form');
    if (form) {
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        await this.createProfile();
      });
    }

    // Load stats for each profile
    this.loadProfileStats();
  }

  async loadProfileStats() {
    for (const profile of this.profiles) {
      const stats = await database.getProfileStats(profile.id);
      const statsElement = this.querySelector(`[data-profile-id="${profile.id}"].profile-stats`);
      if (statsElement) {
        if (stats.totalSessions > 0) {
          statsElement.textContent = `🏆 ${stats.totalScore} | 🔥 ${stats.streak} days`;
        } else {
          statsElement.textContent = 'New player!';
        }
      }
    }
  }

  showProfileForm() {
    this.querySelector('#profile-list').classList.add('hidden');
    this.querySelector('#profile-form-container').classList.remove('hidden');
  }

  hideProfileForm() {
    this.querySelector('#profile-list').classList.remove('hidden');
    this.querySelector('#profile-form-container').classList.add('hidden');
  }

  async createProfile() {
    const nameInput = this.querySelector('#profile-name');
    const selectedAvatar = this.querySelector('.avatar-option.selected');

    const name = nameInput.value.trim();
    const avatar = selectedAvatar ? selectedAvatar.dataset.avatar : this.avatars[0];

    if (!name) {
      alert('Please enter a name!');
      return;
    }

    try {
      await database.createProfile(name, avatar);
      await this.loadProfiles();
      this.render();
      this.attachEventListeners();
    } catch (error) {
      console.error('Error creating profile:', error);
      alert('Failed to create profile. Please try again.');
    }
  }

  async deleteProfile(profileId) {
    if (!confirm('Are you sure you want to delete this profile? All data will be lost!')) {
      return;
    }

    try {
      await database.deleteProfile(profileId);
      await this.loadProfiles();
      this.render();
      this.attachEventListeners();
    } catch (error) {
      console.error('Error deleting profile:', error);
      alert('Failed to delete profile. Please try again.');
    }
  }

  async selectProfile(profileId) {
    const profile = await database.getProfile(profileId);
    if (profile) {
      // Dispatch custom event to start game
      this.dispatchEvent(new CustomEvent('profile-selected', {
        bubbles: true,
        detail: { profile }
      }));
    }
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}

customElements.define('profile-selector', ProfileSelector);
