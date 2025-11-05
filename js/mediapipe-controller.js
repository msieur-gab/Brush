/**
 * MediaPipe Controller
 * Handles hand tracking and motion detection using MediaPipe Hands
 */

class MediaPipeController {
  constructor() {
    this.hands = null;
    this.camera = null;
    this.videoElement = null;
    this.currentHandPosition = null;
    this.previousHandPosition = null;
    this.velocity = { x: 0, y: 0 };
    this.isTracking = false;
    this.onResultsCallback = null;
  }

  async initialize(videoElement) {
    this.videoElement = videoElement;

    // Initialize MediaPipe Hands
    this.hands = new Hands({
      locateFile: (file) => {
        return `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`;
      }
    });

    // Configure hand detection
    this.hands.setOptions({
      maxNumHands: 1, // Track only one hand (the one holding the toothbrush)
      modelComplexity: 0, // 0 = lite model for better mobile performance
      minDetectionConfidence: 0.5,
      minTrackingConfidence: 0.5
    });

    // Set up results callback
    this.hands.onResults((results) => this.onResults(results));

    // Initialize camera
    this.camera = new Camera(this.videoElement, {
      onFrame: async () => {
        if (this.isTracking) {
          await this.hands.send({ image: this.videoElement });
        }
      },
      width: 1280,
      height: 720,
      facingMode: 'user' // Front camera
    });

    // Start camera
    await this.camera.start();
    this.isTracking = true;
  }

  onResults(results) {
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

      // Calculate angle of movement (for direction detection)
      const angle = this.calculateMovementAngle();

      // Call custom callback if set
      if (this.onResultsCallback) {
        this.onResultsCallback({
          position: this.currentHandPosition,
          velocity: this.velocity,
          angle: angle,
          landmarks: handLandmarks
        });
      }
    } else {
      // No hand detected
      this.currentHandPosition = null;
      this.previousHandPosition = null;
      this.velocity = { x: 0, y: 0 };
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

  getVelocity() {
    return this.velocity;
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
