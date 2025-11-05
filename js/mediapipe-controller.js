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
  }

  async initialize(videoElement) {
    this.videoElement = videoElement;

    // Initialize MediaPipe Hands
    this.hands = new Hands({
      locateFile: (file) => {
        return `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`;
      }
    });

    // Configure hand detection - optimized for mobile
    this.hands.setOptions({
      maxNumHands: 1, // Track only one hand (the one holding the toothbrush)
      modelComplexity: 0, // 0 = lite model for better mobile performance
      minDetectionConfidence: 0.5,
      minTrackingConfidence: 0.5
    });

    // Initialize MediaPipe Face Mesh
    this.faceMesh = new FaceMesh({
      locateFile: (file) => {
        return `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`;
      }
    });

    // Configure face mesh - optimized for performance
    this.faceMesh.setOptions({
      maxNumFaces: 1,
      refineLandmarks: true, // Better mouth tracking
      minDetectionConfidence: 0.5,
      minTrackingConfidence: 0.5
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
          // Alternate between hand and face detection for performance
          // Run face detection more frequently (every frame) and hands less frequently
          this.frameCount++;

          // Run face mesh every frame (critical for mouth position)
          await this.faceMesh.send({ image: this.videoElement });

          // Run hand detection every 2nd frame (less critical, saves performance)
          if (this.frameCount % 2 === 0) {
            await this.hands.send({ image: this.videoElement });
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
