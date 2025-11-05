/**
 * ToothZoneManager
 * Manages tooth zones for systematic brushing coverage
 * Based on dental quadrant system - 30 seconds per zone for 2-minute brushing
 */

class ToothZoneManager {
  constructor() {
    this.zones = {};
    this.zoneHealth = new Map(); // zone name -> health percentage (0-100)
    this.currentZone = null;
    this.activeZoneName = null;
    this.zoneSequence = []; // Order in which to brush zones
    this.currentZoneIndex = 0;
    this.requiredHealthPerZone = 100; // Health needed to complete a zone
    this.healthIncreaseRate = 1.5; // Base points per frame (INCREASED for easier gameplay)
    this.movementIncreaseRate = 0.8; // Points for ANY movement in zone (partial credit)
  }

  /**
   * Define zones based on mouth position and dimensions
   * Creates 4 main zones (quadrants) + 2 inner zones = 6 total
   */
  defineZones(mouthPosition, mouthDimensions, canvasWidth, canvasHeight) {
    if (!mouthPosition || !mouthDimensions) {
      return;
    }

    // Convert mouth position to screen coordinates (account for mirrored camera)
    const mouthX = (1 - mouthPosition.x) * canvasWidth;
    const mouthY = mouthPosition.y * canvasHeight;

    // Calculate zone sizes based on mouth dimensions
    const mouthWidth = mouthDimensions.width * canvasWidth;
    const mouthHeight = mouthDimensions.height * canvasHeight;

    // Zone radius (how large each zone is) - INCREASED for easier hitting
    // Was 1.5x, now 2.5x for much larger hit areas
    const zoneRadius = Math.max(mouthWidth, mouthHeight) * 2.5;

    // Distance from mouth center to outer zones
    const outerDistance = zoneRadius * 0.8;
    const innerDistance = zoneRadius * 0.3;

    // Define 6 zones: 4 outer quadrants + 2 inner zones
    this.zones = {
      // OUTER ZONES (main quadrants)
      upperRight: {
        center: {
          x: mouthX + outerDistance,
          y: mouthY - outerDistance * 0.7
        },
        radius: zoneRadius * 0.6,
        label: 'Upper Right',
        instruction: 'Brush upper right teeth in circles',
        emoji: '🦷',
        color: 'rgba(255, 107, 107, 0.6)', // Red
        priority: 1
      },
      upperLeft: {
        center: {
          x: mouthX - outerDistance,
          y: mouthY - outerDistance * 0.7
        },
        radius: zoneRadius * 0.6,
        label: 'Upper Left',
        instruction: 'Brush upper left teeth in circles',
        emoji: '🦷',
        color: 'rgba(255, 234, 167, 0.6)', // Yellow
        priority: 2
      },
      lowerRight: {
        center: {
          x: mouthX + outerDistance,
          y: mouthY + outerDistance * 0.7
        },
        radius: zoneRadius * 0.6,
        label: 'Lower Right',
        instruction: 'Brush lower right teeth in circles',
        emoji: '🦷',
        color: 'rgba(162, 155, 254, 0.6)', // Purple
        priority: 3
      },
      lowerLeft: {
        center: {
          x: mouthX - outerDistance,
          y: mouthY + outerDistance * 0.7
        },
        radius: zoneRadius * 0.6,
        label: 'Lower Left',
        instruction: 'Brush lower left teeth in circles',
        emoji: '🦷',
        color: 'rgba(108, 92, 231, 0.6)', // Blue
        priority: 4
      },

      // INNER ZONES (front teeth)
      upperInner: {
        center: {
          x: mouthX,
          y: mouthY - innerDistance
        },
        radius: zoneRadius * 0.5,
        label: 'Upper Front',
        instruction: 'Brush upper front teeth in circles',
        emoji: '😁',
        color: 'rgba(85, 239, 196, 0.6)', // Teal
        priority: 5
      },
      lowerInner: {
        center: {
          x: mouthX,
          y: mouthY + innerDistance
        },
        radius: zoneRadius * 0.5,
        label: 'Lower Front',
        instruction: 'Brush lower front teeth in circles',
        emoji: '😁',
        color: 'rgba(129, 236, 236, 0.6)', // Cyan
        priority: 6
      }
    };

    // Initialize health for each zone
    for (const zoneName of Object.keys(this.zones)) {
      if (!this.zoneHealth.has(zoneName)) {
        this.zoneHealth.set(zoneName, 0);
      }
    }

    // Set zone sequence (order to brush)
    this.zoneSequence = [
      'upperRight',
      'upperLeft',
      'lowerRight',
      'lowerLeft',
      'upperInner',
      'lowerInner'
    ];

    // Set initial active zone
    if (!this.activeZoneName) {
      this.setActiveZone(this.zoneSequence[0]);
    }
  }

  /**
   * Set which zone is currently active (target for brushing)
   */
  setActiveZone(zoneName) {
    if (this.zones[zoneName]) {
      this.activeZoneName = zoneName;
      this.currentZoneIndex = this.zoneSequence.indexOf(zoneName);
    }
  }

  /**
   * Check if brush position is inside a specific zone
   */
  isInZone(brushPosition, zoneName) {
    if (!brushPosition || !this.zones[zoneName]) {
      return false;
    }

    const zone = this.zones[zoneName];
    const distance = Math.sqrt(
      Math.pow(brushPosition.x - zone.center.x, 2) +
      Math.pow(brushPosition.y - zone.center.y, 2)
    );

    return distance <= zone.radius;
  }

  /**
   * Check which zone (if any) the brush is currently in
   */
  checkBrushInZone(brushPosition) {
    if (!brushPosition) {
      this.currentZone = null;
      return { inZone: false, zone: null, zoneData: null };
    }

    // Check all zones
    for (const [zoneName, zoneData] of Object.entries(this.zones)) {
      if (this.isInZone(brushPosition, zoneName)) {
        this.currentZone = zoneName;
        return {
          inZone: true,
          zone: zoneName,
          zoneData: zoneData,
          isActiveZone: zoneName === this.activeZoneName
        };
      }
    }

    this.currentZone = null;
    return { inZone: false, zone: null, zoneData: null, isActiveZone: false };
  }

  /**
   * Update zone health based on brushing quality
   * @param {string} zoneName - Name of the zone being brushed
   * @param {Object} circularMotionData - Data from CircleDetector
   * @param {boolean} isMoving - Is there any hand movement detected
   * @returns {Object} Update result with health, complete status, feedback
   */
  updateZoneHealth(zoneName, circularMotionData, isMoving = false) {
    if (!this.zones[zoneName]) {
      return { health: 0, complete: false, feedback: 'Invalid zone' };
    }

    const currentHealth = this.zoneHealth.get(zoneName) || 0;

    // MUCH MORE FORGIVING health increase system
    let healthIncrease = 0;

    if (circularMotionData && circularMotionData.isCircular) {
      // Excellent circular motion = maximum increase
      healthIncrease = this.healthIncreaseRate * circularMotionData.quality;
    } else if (circularMotionData && circularMotionData.quality > 0.3) {
      // ANY decent motion gets partial credit (was 0.5, now 0.3 - more forgiving!)
      healthIncrease = this.healthIncreaseRate * 0.6 * circularMotionData.quality;
    } else if (isMoving) {
      // Even if not circular, give credit for ANY movement in the zone!
      // This is critical for real-world brushing where hand orientation varies
      healthIncrease = this.movementIncreaseRate;
    }

    const newHealth = Math.min(100, currentHealth + healthIncrease);
    this.zoneHealth.set(zoneName, newHealth);

    // Check if zone is complete
    const isComplete = newHealth >= this.requiredHealthPerZone;

    // Generate feedback based on health
    const feedback = this.getHealthFeedback(newHealth, circularMotionData);

    return {
      health: newHealth,
      complete: isComplete,
      feedback: feedback,
      isActiveZone: zoneName === this.activeZoneName
    };
  }

  /**
   * Get feedback message based on zone health
   */
  getHealthFeedback(health, circularMotionData) {
    // More encouraging feedback - focus on progress!

    // Based on health progress (removed circular motion requirement from feedback)
    if (health < 15) {
      return 'Good! Keep brushing!';
    } else if (health < 35) {
      return 'Great job! Keep going!';
    } else if (health < 60) {
      return 'Awesome! Halfway there!';
    } else if (health < 85) {
      return 'Excellent! Almost done!';
    } else if (health < 100) {
      return 'Perfect! Finish this zone!';
    } else {
      return 'Zone Complete! ✨';
    }
  }

  /**
   * Move to the next zone in sequence
   * @returns {Object} Next zone info or null if all complete
   */
  moveToNextZone() {
    // Find next incomplete zone
    for (let i = 0; i < this.zoneSequence.length; i++) {
      const nextIndex = (this.currentZoneIndex + 1 + i) % this.zoneSequence.length;
      const zoneName = this.zoneSequence[nextIndex];
      const health = this.zoneHealth.get(zoneName) || 0;

      if (health < this.requiredHealthPerZone) {
        this.setActiveZone(zoneName);
        return {
          zoneName: zoneName,
          zoneData: this.zones[zoneName],
          isLastZone: false
        };
      }
    }

    // All zones complete!
    return {
      zoneName: null,
      zoneData: null,
      isLastZone: true,
      allComplete: true
    };
  }

  /**
   * Get the currently active zone (target)
   */
  getActiveZone() {
    if (!this.activeZoneName || !this.zones[this.activeZoneName]) {
      return null;
    }

    return {
      zoneName: this.activeZoneName,
      zoneData: this.zones[this.activeZoneName],
      health: this.zoneHealth.get(this.activeZoneName) || 0,
      index: this.currentZoneIndex,
      totalZones: this.zoneSequence.length
    };
  }

  /**
   * Check if all zones are complete
   */
  areAllZonesComplete() {
    for (const zoneName of this.zoneSequence) {
      const health = this.zoneHealth.get(zoneName) || 0;
      if (health < this.requiredHealthPerZone) {
        return false;
      }
    }
    return true;
  }

  /**
   * Get statistics for all zones
   */
  getZoneStats() {
    const stats = {
      totalZones: this.zoneSequence.length,
      completedZones: 0,
      averageHealth: 0,
      zones: {}
    };

    let totalHealth = 0;

    for (const zoneName of this.zoneSequence) {
      const health = this.zoneHealth.get(zoneName) || 0;
      const isComplete = health >= this.requiredHealthPerZone;

      stats.zones[zoneName] = {
        health: health,
        complete: isComplete,
        label: this.zones[zoneName]?.label || zoneName
      };

      if (isComplete) {
        stats.completedZones++;
      }

      totalHealth += health;
    }

    stats.averageHealth = totalHealth / this.zoneSequence.length;
    stats.percentComplete = (stats.completedZones / stats.totalZones) * 100;

    return stats;
  }

  /**
   * Reset all zones (start over)
   */
  reset() {
    for (const zoneName of Object.keys(this.zones)) {
      this.zoneHealth.set(zoneName, 0);
    }
    this.currentZoneIndex = 0;
    this.activeZoneName = this.zoneSequence[0];
    this.currentZone = null;
  }

  /**
   * Get all zone data (for rendering)
   */
  getAllZones() {
    return this.zones;
  }

  /**
   * Get zone health map (for debugging/display)
   */
  getZoneHealthMap() {
    const healthMap = {};
    for (const [zoneName, health] of this.zoneHealth.entries()) {
      healthMap[zoneName] = {
        health: health,
        complete: health >= this.requiredHealthPerZone,
        label: this.zones[zoneName]?.label || zoneName
      };
    }
    return healthMap;
  }
}
