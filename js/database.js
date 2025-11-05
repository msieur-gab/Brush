/**
 * Database schema and operations using Dexie.js
 * Manages kid profiles, brushing sessions, and scoring history
 */

class BrushDatabase {
  constructor() {
    this.db = new Dexie('BrushGameDB');

    // Define database schema
    this.db.version(1).stores({
      profiles: '++id, name, avatar, createdAt',
      sessions: '++id, profileId, date, duration, score, creaturesDestroyed, createdAt',
      settings: 'key, value'
    });

    this.initializeDefaultSettings();
  }

  async initializeDefaultSettings() {
    const requiredDuration = await this.db.settings.get('requiredDuration');
    if (!requiredDuration) {
      await this.db.settings.put({ key: 'requiredDuration', value: 120 }); // 2 minutes default
    }
  }

  // Profile management
  async createProfile(name, avatar = '🦷') {
    return await this.db.profiles.add({
      name,
      avatar,
      createdAt: new Date().toISOString()
    });
  }

  async getProfile(id) {
    return await this.db.profiles.get(id);
  }

  async getAllProfiles() {
    return await this.db.profiles.toArray();
  }

  async updateProfile(id, updates) {
    return await this.db.profiles.update(id, updates);
  }

  async deleteProfile(id) {
    // Delete associated sessions
    await this.db.sessions.where('profileId').equals(id).delete();
    return await this.db.profiles.delete(id);
  }

  // Session management
  async createSession(profileId, duration, score, creaturesDestroyed) {
    return await this.db.sessions.add({
      profileId,
      date: new Date().toISOString().split('T')[0], // YYYY-MM-DD
      duration,
      score,
      creaturesDestroyed,
      createdAt: new Date().toISOString()
    });
  }

  async getSessionsByProfile(profileId, limit = 10) {
    return await this.db.sessions
      .where('profileId')
      .equals(profileId)
      .reverse()
      .limit(limit)
      .toArray();
  }

  async getProfileStats(profileId) {
    const sessions = await this.db.sessions
      .where('profileId')
      .equals(profileId)
      .toArray();

    if (sessions.length === 0) {
      return {
        totalSessions: 0,
        totalScore: 0,
        averageScore: 0,
        totalDuration: 0,
        averageDuration: 0,
        totalCreatures: 0,
        bestScore: 0,
        streak: 0
      };
    }

    const totalScore = sessions.reduce((sum, s) => sum + s.score, 0);
    const totalDuration = sessions.reduce((sum, s) => sum + s.duration, 0);
    const totalCreatures = sessions.reduce((sum, s) => sum + s.creaturesDestroyed, 0);
    const bestScore = Math.max(...sessions.map(s => s.score));

    // Calculate streak (consecutive days with brushing)
    const streak = this.calculateStreak(sessions);

    return {
      totalSessions: sessions.length,
      totalScore,
      averageScore: Math.round(totalScore / sessions.length),
      totalDuration,
      averageDuration: Math.round(totalDuration / sessions.length),
      totalCreatures,
      bestScore,
      streak
    };
  }

  calculateStreak(sessions) {
    if (sessions.length === 0) return 0;

    // Sort by date descending
    const sortedSessions = sessions
      .map(s => s.date)
      .sort((a, b) => new Date(b) - new Date(a));

    // Remove duplicates (same day sessions)
    const uniqueDates = [...new Set(sortedSessions)];

    let streak = 0;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (let i = 0; i < uniqueDates.length; i++) {
      const sessionDate = new Date(uniqueDates[i]);
      sessionDate.setHours(0, 0, 0, 0);

      const expectedDate = new Date(today);
      expectedDate.setDate(today.getDate() - i);
      expectedDate.setHours(0, 0, 0, 0);

      if (sessionDate.getTime() === expectedDate.getTime()) {
        streak++;
      } else {
        break;
      }
    }

    return streak;
  }

  // Settings management
  async getSetting(key) {
    const setting = await this.db.settings.get(key);
    return setting ? setting.value : null;
  }

  async setSetting(key, value) {
    return await this.db.settings.put({ key, value });
  }

  // Utility methods
  async clearAllData() {
    await this.db.profiles.clear();
    await this.db.sessions.clear();
    await this.db.settings.clear();
    await this.initializeDefaultSettings();
  }
}

// Export singleton instance
const database = new BrushDatabase();
