/**
 * MediaPipe Controller
 * Handles hand tracking (toothbrush) and face mesh tracking (mouth position)
 */

class MediaPipeController {
  constructor() {
    this.hands = null;
    this.faceMesh = null;
    this.camera = null;
    this.videoElement = null;

    // Hand tracking data
    this.currentHandPosition = null;
    this.previousHandPosition = null;
    this.velocity = { x: 0, y: 0 };

    // Face/mouth tracking data
    this.currentMouthPosition = null;
    this.mouthWidth = 0;
    this.mouthHeight = 0;

    this.isTracking = false;
    this.onResultsCallback = null;

    // Frame counter for alternating detection
    this.frameCount = 0;

    // Circular motion detection
    this.circleDetector = new CircleDetector();
    this.currentCircularMotion = null;
  }

  async initialize(videoElement) {
    this.videoElement = videoElement;

    // Initialize MediaPipe Hands
    this.hands = new Hands({
      locateFile: (file) => {
        return `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`;
      }
    });

    // Configure hand detection - optimized for mobile performance
    this.hands.setOptions({
      maxNumHands: 1, // Track only one hand (the one holding the toothbrush)
      modelComplexity: 0, // 0 = lite model for best mobile performance
      minDetectionConfidence: 0.3, // Lower = faster detection but less strict
      minTrackingConfidence: 0.3 // Lower = smoother tracking, less jitter
    });

    // Initialize MediaPipe Face Mesh
    this.faceMesh = new FaceMesh({
      locateFile: (file) => {
        return `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`;
      }
    });

    // Configure face mesh - optimized for performance (mouth area only)
    this.faceMesh.setOptions({
      maxNumFaces: 1,
      refineLandmarks: true, // Better mouth tracking
      minDetectionConfidence: 0.5,
      minTrackingConfidence: 0.5,
      selfieMode: true // Optimize for selfie camera view
    });

    // Set up callbacks
    this.hands.onResults((results) => this.onHandResults(results));
    this.faceMesh.onResults((results) => this.onFaceResults(results));

    // Determine camera resolution based on screen orientation
    const isPortrait = window.innerHeight > window.innerWidth;
    const cameraWidth = isPortrait ? 720 : 1280;
    const cameraHeight = isPortrait ? 1280 : 720;

    // Initialize camera with appropriate resolution for mobile
    this.camera = new Camera(this.videoElement, {
      onFrame: async () => {
        if (this.isTracking) {
          this.frameCount++;

          // PRIORITY 1: Hand detection every frame (critical for smooth brush cursor)
          await this.hands.send({ image: this.videoElement });

          // PRIORITY 2: Face mesh every 3rd frame (mouth position changes slowly)
          // Mouth doesn't move as fast as hands, so less frequent updates are fine
          if (this.frameCount % 3 === 0) {
            await this.faceMesh.send({ image: this.videoElement });
          }
        }
      },
      width: cameraWidth,
      height: cameraHeight,
      facingMode: 'user' // Front camera
    });

    // Start camera
    await this.camera.start();
    this.isTracking = true;
  }

  onHandResults(results) {
    if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
      // Get the first hand
      const handLandmarks = results.multiHandLandmarks[0];

      // Use index finger tip (landmark 8) as the tracking point
      // This represents the toothbrush tip movement
      const indexFingerTip = handLandmarks[8];

      // Store previous position
      this.previousHandPosition = this.currentHandPosition;

      // Update current position
      this.currentHandPosition = {
        x: indexFingerTip.x,
        y: indexFingerTip.y,
        z: indexFingerTip.z
      };

      // Calculate velocity (direction and speed of movement)
      if (this.previousHandPosition) {
        this.velocity = {
          x: this.currentHandPosition.x - this.previousHandPosition.x,
          y: this.currentHandPosition.y - this.previousHandPosition.y
        };
      }

      // Detect circular motion patterns
      this.currentCircularMotion = this.circleDetector.detectCircularMotion(this.currentHandPosition);
    } else {
      // No hand detected - keep last known position briefly
      // Don't clear immediately to avoid flickering
    }
  }

  onFaceResults(results) {
    if (results.multiFaceLandmarks && results.multiFaceLandmarks.length > 0) {
      const faceLandmarks = results.multiFaceLandmarks[0];

      // Get mouth landmarks for position and size
      // Mouth outline landmarks: https://github.com/google/mediapipe/blob/master/mediapipe/modules/face_geometry/data/canonical_face_model_uv_visualization.png
      // Upper lip top: 13
      // Lower lip bottom: 14
      // Left mouth corner: 61
      // Right mouth corner: 291

      const upperLip = faceLandmarks[13];
      const lowerLip = faceLandmarks[14];
      const leftCorner = faceLandmarks[61];
      const rightCorner = faceLandmarks[291];

      // Calculate mouth center
      const mouthCenterX = (leftCorner.x + rightCorner.x) / 2;
      const mouthCenterY = (upperLip.y + lowerLip.y) / 2;

      // Calculate mouth dimensions (for spawning area)
      const mouthWidth = Math.abs(rightCorner.x - leftCorner.x);
      const mouthHeight = Math.abs(lowerLip.y - upperLip.y);

      // Update mouth position
      this.currentMouthPosition = {
        x: mouthCenterX,
        y: mouthCenterY,
        z: (upperLip.z + lowerLip.z) / 2
      };

      // Store mouth dimensions (we'll use a multiplier for game area)
      this.mouthWidth = mouthWidth;
      this.mouthHeight = mouthHeight;

    } else {
      // No face detected - keep last known position
      // This prevents the game from breaking if face temporarily lost
    }
  }

  calculateMovementAngle() {
    if (!this.velocity) {
      return null;
    }

    // Calculate angle in degrees (0 = right, 90 = down, 180 = left, 270 = up)
    const angle = Math.atan2(this.velocity.y, this.velocity.x) * (180 / Math.PI);

    return angle;
  }

  getMovementDirection() {
    const angle = this.calculateMovementAngle();

    if (angle === null) {
      return null;
    }

    // Normalize angle to 0-360
    const normalizedAngle = (angle + 360) % 360;

    // Determine cardinal direction
    if (normalizedAngle >= 315 || normalizedAngle < 45) {
      return 'right';
    } else if (normalizedAngle >= 45 && normalizedAngle < 135) {
      return 'down';
    } else if (normalizedAngle >= 135 && normalizedAngle < 225) {
      return 'left';
    } else {
      return 'up';
    }
  }

  getMovementSpeed() {
    if (!this.velocity) {
      return 0;
    }

    // Calculate speed as magnitude of velocity vector
    return Math.sqrt(this.velocity.x ** 2 + this.velocity.y ** 2);
  }

  isMoving(threshold = 0.01) {
    return this.getMovementSpeed() > threshold;
  }

  getHandPosition() {
    return this.currentHandPosition;
  }

  getMouthPosition() {
    return this.currentMouthPosition;
  }

  getMouthDimensions() {
    return {
      width: this.mouthWidth,
      height: this.mouthHeight
    };
  }

  getVelocity() {
    return this.velocity;
  }

  getCircularMotion() {
    return this.currentCircularMotion;
  }

  setOnResultsCallback(callback) {
    this.onResultsCallback = callback;
  }

  stop() {
    this.isTracking = false;

    if (this.camera) {
      this.camera.stop();
    }

    if (this.videoElement && this.videoElement.srcObject) {
      const tracks = this.videoElement.srcObject.getTracks();
      tracks.forEach(track => track.stop());
      this.videoElement.srcObject = null;
    }
  }

  pause() {
    this.isTracking = false;
  }

  resume() {
    this.isTracking = true;
  }
}

/**
 * CircleDetector
 * Detects circular brushing motions from hand tracking data
 * Based on dental guidelines for proper brushing technique
 */
class CircleDetector {
  constructor(maxHistoryLength = 15, targetRadius = 40) {
    this.positionHistory = []; // Last N positions
    this.maxHistoryLength = maxHistoryLength;
    this.targetRadius = targetRadius; // Target radius in normalized coordinates
    this.lastCircleComplete = false;
  }

  /**
   * Main detection method - call this every frame with current position
   * @param {Object} currentPosition - {x, y} in normalized coordinates (0-1)
   * @returns {Object} Detection result with isCircular, completeness, quality, etc.
   */
  detectCircularMotion(currentPosition) {
    if (!currentPosition) {
      return {
        isCircular: false,
        completeness: 0,
        radius: 0,
        quality: 0,
        center: null
      };
    }

    // Add current position to history
    this.positionHistory.push({
      x: currentPosition.x,
      y: currentPosition.y,
      timestamp: Date.now()
    });

    // Keep only last N positions
    if (this.positionHistory.length > this.maxHistoryLength) {
      this.positionHistory.shift();
    }

    // Need at least 8 points to detect a circle
    if (this.positionHistory.length < 8) {
      return {
        isCircular: false,
        completeness: 0,
        radius: 0,
        quality: 0,
        center: null
      };
    }

    // Calculate center point (centroid) of all positions
    const center = this.calculateCentroid(this.positionHistory);

    // Calculate average radius from center
    const avgRadius = this.calculateAverageRadius(this.positionHistory, center);

    // Check if positions form consistent arc (low variance in radius)
    const consistency = this.calculateRadiusConsistency(this.positionHistory, center, avgRadius);

    // Check angular coverage (did they go around in a circle?)
    const angularCoverage = this.calculateAngularCoverage(this.positionHistory, center);

    // Determine if this is a circular motion
    // RELAXED THRESHOLDS for real-world brushing
    // Consistency > 0.5 means reasonably circular (was 0.7 - too strict!)
    // Angular coverage > 180 means at least half a circle (was 270 - too strict!)
    const isCircular = consistency > 0.5 && angularCoverage > 180;

    // Calculate completeness percentage (0-100%)
    const completeness = Math.min(100, (angularCoverage / 360) * 100);

    return {
      isCircular: isCircular,
      completeness: completeness,
      radius: avgRadius,
      quality: consistency,
      center: center,
      angularCoverage: angularCoverage,
      positionCount: this.positionHistory.length
    };
  }

  /**
   * Calculate the centroid (center point) of all positions
   */
  calculateCentroid(positions) {
    const sum = positions.reduce((acc, pos) => ({
      x: acc.x + pos.x,
      y: acc.y + pos.y
    }), { x: 0, y: 0 });

    return {
      x: sum.x / positions.length,
      y: sum.y / positions.length
    };
  }

  /**
   * Calculate average radius from center to all positions
   */
  calculateAverageRadius(positions, center) {
    const radii = positions.map(pos =>
      Math.sqrt(Math.pow(pos.x - center.x, 2) + Math.pow(pos.y - center.y, 2))
    );
    return radii.reduce((a, b) => a + b, 0) / radii.length;
  }

  /**
   * Calculate how consistent the radius is (0-1, higher = more circular)
   * Uses standard deviation to measure variance
   */
  calculateRadiusConsistency(positions, center, avgRadius) {
    const radii = positions.map(pos =>
      Math.sqrt(Math.pow(pos.x - center.x, 2) + Math.pow(pos.y - center.y, 2))
    );

    // Calculate standard deviation
    const variance = radii.reduce((sum, r) => sum + Math.pow(r - avgRadius, 2), 0) / radii.length;
    const stdDev = Math.sqrt(variance);

    // Consistency = 1 - (stdDev / avgRadius)
    // High consistency = low variance in radius = more circular
    const consistency = Math.max(0, 1 - (stdDev / avgRadius));

    return consistency;
  }

  /**
   * Calculate how much of a circle has been covered (in degrees)
   * Returns 0-360 representing degrees of arc covered
   */
  calculateAngularCoverage(positions, center) {
    if (positions.length < 2) {
      return 0;
    }

    // Calculate angles of all positions relative to center
    const angles = positions.map(pos =>
      Math.atan2(pos.y - center.y, pos.x - center.x) * 180 / Math.PI
    );

    // Normalize to 0-360
    const normalizedAngles = angles.map(a => a < 0 ? a + 360 : a);

    // Sort angles to find coverage
    const sortedAngles = [...normalizedAngles].sort((a, b) => a - b);

    // Find largest gap between consecutive angles
    let maxGap = 0;
    for (let i = 0; i < sortedAngles.length; i++) {
      const nextIdx = (i + 1) % sortedAngles.length;
      let gap = sortedAngles[nextIdx] - sortedAngles[i];

      // Handle wraparound at 360/0
      if (gap < 0) {
        gap += 360;
      }

      maxGap = Math.max(maxGap, gap);
    }

    // Coverage = 360 - largest gap
    const coverage = 360 - maxGap;

    return Math.max(0, Math.min(360, coverage));
  }

  /**
   * Reset the detector (clear history)
   */
  reset() {
    this.positionHistory = [];
    this.lastCircleComplete = false;
  }

  /**
   * Get the current position history (for debugging/visualization)
   */
  getPositionHistory() {
    return this.positionHistory;
  }
}
