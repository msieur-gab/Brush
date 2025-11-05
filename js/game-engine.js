/**
 * Game Engine
 * Manages game state, creatures, collision detection, and scoring
 */

class GameEngine {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.resizeCanvas();

    // Game state
    this.isRunning = false;
    this.isPaused = false;
    this.score = 0;
    this.creaturesDestroyed = 0;
    this.startTime = null;
    this.requiredDuration = 120; // 2 minutes default
    this.elapsedTime = 0;
    this.gameEnded = false;

    // Creatures
    this.creatures = [];
    this.maxCreatures = 8;
    this.spawnInterval = 2000; // 2 seconds
    this.lastSpawnTime = 0;

    // MediaPipe controller
    this.mediapipeController = null;

    // Zone manager for systematic brushing
    this.zoneManager = new ToothZoneManager();
    this.zoneMode = true; // Enable zone-based gameplay

    // Particle effects
    this.particles = [];

    // Creature types with different properties
    this.creatureTypes = [
      { emoji: '🦠', points: 10, speed: 1.5, size: 40, color: '#FF6B6B' },
      { emoji: '🐛', points: 15, speed: 1, size: 45, color: '#4ECDC4' },
      { emoji: '🕷️', points: 20, speed: 2, size: 35, color: '#95E1D3' },
      { emoji: '🐌', points: 12, speed: 0.8, size: 50, color: '#F38181' },
      { emoji: '🦟', points: 25, speed: 2.5, size: 30, color: '#AA96DA' }
    ];

    // Brush cursor
    this.brushCursor = {
      x: window.innerWidth / 2,
      y: window.innerHeight / 2,
      size: 60,
      trail: []
    };

    // Logical dimensions for game calculations (initialized in resizeCanvas)
    this.logicalWidth = window.innerWidth;
    this.logicalHeight = window.innerHeight;

    // Bind resize handler
    window.addEventListener('resize', () => this.resizeCanvas());

    // Debug mode toggle (press D key)
    window.addEventListener('keydown', (e) => {
      if (e.key === 'd' || e.key === 'D') {
        window.DEBUG_MODE = !window.DEBUG_MODE;
        console.log('Debug mode:', window.DEBUG_MODE ? 'ON' : 'OFF');
      }
    });

    // Animation frame
    this.animationFrameId = null;
  }

  resizeCanvas() {
    // Get actual screen dimensions
    const width = window.innerWidth;
    const height = window.innerHeight;

    // Set canvas display size
    this.canvas.style.width = width + 'px';
    this.canvas.style.height = height + 'px';

    // Set canvas buffer size (for high-DPI screens)
    const dpr = window.devicePixelRatio || 1;
    this.canvas.width = width * dpr;
    this.canvas.height = height * dpr;

    // Scale context to match DPR
    this.ctx.scale(dpr, dpr);

    // Store logical dimensions for game calculations
    this.logicalWidth = width;
    this.logicalHeight = height;
  }

  async start(profile, mediapipeController) {
    this.profile = profile;
    this.mediapipeController = mediapipeController;

    // Load required duration from database
    this.requiredDuration = await database.getSetting('requiredDuration') || 120;

    // Reset game state
    this.reset();

    // Start game loop
    this.isRunning = true;
    this.startTime = Date.now();
    this.gameLoop();
  }

  reset() {
    this.score = 0;
    this.creaturesDestroyed = 0;
    this.elapsedTime = 0;
    this.creatures = [];
    this.particles = [];
    this.gameEnded = false;
    this.isPaused = false;

    // Reset zone manager
    if (this.zoneManager) {
      this.zoneManager.reset();
    }
  }

  gameLoop(timestamp = 0) {
    if (!this.isRunning) return;

    if (!this.isPaused) {
      // Update game state
      this.update(timestamp);

      // Render
      this.render();
    }

    // Continue loop
    this.animationFrameId = requestAnimationFrame((ts) => this.gameLoop(ts));
  }

  update(timestamp) {
    // Update elapsed time
    this.elapsedTime = Math.floor((Date.now() - this.startTime) / 1000);

    // Check if game should end
    if (this.elapsedTime >= this.requiredDuration) {
      this.endGame();
      return;
    }

    // Spawn creatures
    if (timestamp - this.lastSpawnTime > this.spawnInterval && this.creatures.length < this.maxCreatures) {
      this.spawnCreature();
      this.lastSpawnTime = timestamp;
    }

    // Update brush cursor position from MediaPipe
    this.updateBrushCursor();

    // Update zones (define/update based on mouth position)
    this.updateZones();

    // Update creatures
    this.updateCreatures();

    // Check collisions
    this.checkCollisions();

    // Update particles
    this.updateParticles();
  }

  updateBrushCursor() {
    if (!this.mediapipeController) return;

    const handPosition = this.mediapipeController.getHandPosition();

    if (handPosition) {
      // Convert normalized coordinates (0-1) to screen coordinates
      // Flip X for mirror effect
      const x = (1 - handPosition.x) * this.logicalWidth;
      const y = handPosition.y * this.logicalHeight;

      this.brushCursor.x = x;
      this.brushCursor.y = y;

      // Add to trail
      this.brushCursor.trail.push({ x, y, alpha: 1 });

      // Limit trail length
      if (this.brushCursor.trail.length > 10) {
        this.brushCursor.trail.shift();
      }
    }

    // Update trail alpha
    this.brushCursor.trail.forEach((point, index) => {
      point.alpha = (index + 1) / this.brushCursor.trail.length;
    });
  }

  updateZones() {
    if (!this.zoneMode || !this.mediapipeController) return;

    // Get mouth position and dimensions
    const mouthPos = this.mediapipeController.getMouthPosition();
    const mouthDimensions = this.mediapipeController.getMouthDimensions();

    if (!mouthPos || !mouthDimensions) return;

    // Define/update zones based on current mouth position
    this.zoneManager.defineZones(
      mouthPos,
      mouthDimensions,
      this.logicalWidth,
      this.logicalHeight
    );

    // Check if brush is in any zone
    const brushPosition = {
      x: this.brushCursor.x,
      y: this.brushCursor.y
    };

    const zoneCheck = this.zoneManager.checkBrushInZone(brushPosition);

    // If brush is in the active zone, update its health based on brushing quality
    if (zoneCheck.inZone && zoneCheck.isActiveZone) {
      const circularMotion = this.mediapipeController.getCircularMotion();
      const isMoving = this.mediapipeController.isMoving(0.005); // Lower threshold for movement detection

      // CRITICAL FIX: Give credit for ANY movement in the zone!
      // This accounts for different hand orientations when brushing left vs right side
      // Right-handed people show different finger positions on each side
      if (circularMotion || isMoving) {
        const updateResult = this.zoneManager.updateZoneHealth(
          zoneCheck.zone,
          circularMotion,
          isMoving
        );

        // Check if zone just completed
        if (updateResult.complete) {
          // Add bonus points for completing a zone
          this.score += 100;

          // Create celebration particles
          this.createZoneCompletionParticles(zoneCheck.zoneData.center);

          // Move to next zone
          const nextZone = this.zoneManager.moveToNextZone();

          if (nextZone.allComplete) {
            // All zones complete! End game early with bonus
            this.score += 500; // Completion bonus
            this.endGame();
          }
        }
      }
    }
  }

  createZoneCompletionParticles(position) {
    // Create burst of particles at zone center
    for (let i = 0; i < 20; i++) {
      const angle = (Math.PI * 2 * i) / 20;
      const speed = 2 + Math.random() * 3;

      this.particles.push({
        x: position.x,
        y: position.y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        size: 4 + Math.random() * 4,
        color: `hsl(${Math.random() * 360}, 70%, 60%)`,
        alpha: 1,
        decay: 0.02,
        isPulse: false
      });
    }
  }

  spawnCreature() {
    if (!this.mediapipeController) return;

    // Get mouth position
    const mouthPos = this.mediapipeController.getMouthPosition();
    if (!mouthPos) return; // Don't spawn if we can't detect mouth

    // Random creature type
    const type = this.creatureTypes[Math.floor(Math.random() * this.creatureTypes.length)];

    // Convert mouth position to screen coordinates
    const mouthDimensions = this.mediapipeController.getMouthDimensions();
    const mouthX = (1 - mouthPos.x) * this.logicalWidth; // Flip X for mirror
    const mouthY = mouthPos.y * this.logicalHeight;

    // Define brushing zone around mouth (3x the mouth size for gameplay area)
    const zoneMultiplier = 3;
    const zoneWidth = mouthDimensions.width * this.logicalWidth * zoneMultiplier;
    const zoneHeight = mouthDimensions.height * this.logicalHeight * zoneMultiplier;

    // Random position around the mouth (within the brushing zone)
    // Using polar coordinates for circular distribution around mouth
    const angle = Math.random() * Math.PI * 2;
    const distance = (Math.random() * 0.5 + 0.5) * Math.max(zoneWidth, zoneHeight) / 2;

    const offsetX = Math.cos(angle) * distance;
    const offsetY = Math.sin(angle) * distance;

    const x = mouthX + offsetX;
    const y = mouthY + offsetY;

    // Creatures move slowly around the mouth area (like germs on teeth)
    // They don't have a fixed target, they orbit/float around
    const orbitAngle = angle + Math.PI + (Math.random() - 0.5) * Math.PI / 2;
    const orbitDistance = distance * 0.3; // Move to a position closer to mouth

    const targetX = mouthX + Math.cos(orbitAngle) * orbitDistance;
    const targetY = mouthY + Math.sin(orbitAngle) * orbitDistance;

    // Determine which side of mouth (for direction arrows)
    // 0=top, 1=right, 2=bottom, 3=left relative to mouth
    let side;
    if (Math.abs(offsetX) > Math.abs(offsetY)) {
      side = offsetX > 0 ? 1 : 3; // right or left
    } else {
      side = offsetY > 0 ? 2 : 0; // bottom or top
    }

    const creature = {
      id: Date.now() + Math.random(),
      type,
      x,
      y,
      targetX,
      targetY,
      size: type.size,
      side,
      rotation: 0,
      wobble: Math.random() * Math.PI * 2,
      health: 1,
      orbitAngle: angle, // Track orbit for continuous movement
      orbitSpeed: (Math.random() - 0.5) * 0.02 // Slow orbital motion
    };

    this.creatures.push(creature);
  }

  updateCreatures() {
    // Get current mouth position for orbital movement
    const mouthPos = this.mediapipeController ? this.mediapipeController.getMouthPosition() : null;
    const mouthDimensions = this.mediapipeController ? this.mediapipeController.getMouthDimensions() : { width: 0, height: 0 };

    this.creatures.forEach(creature => {
      if (mouthPos) {
        // Convert mouth position to screen coordinates
        const mouthX = (1 - mouthPos.x) * this.logicalWidth;
        const mouthY = mouthPos.y * this.logicalHeight;

        // Update orbit angle for continuous circular motion
        creature.orbitAngle += creature.orbitSpeed;

        // Calculate orbital position around mouth
        const zoneMultiplier = 3;
        const zoneRadius = Math.max(
          mouthDimensions.width * this.logicalWidth,
          mouthDimensions.height * this.logicalHeight
        ) * zoneMultiplier / 2;

        const orbitRadius = zoneRadius * 0.7; // Stay within zone
        const targetX = mouthX + Math.cos(creature.orbitAngle) * orbitRadius;
        const targetY = mouthY + Math.sin(creature.orbitAngle) * orbitRadius;

        // Move towards orbital position slowly
        const dx = targetX - creature.x;
        const dy = targetY - creature.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance > 1) {
          const speed = creature.type.speed * 0.5; // Slower movement for realism
          creature.x += (dx / distance) * speed;
          creature.y += (dy / distance) * speed;
        }
      } else {
        // Fallback: move in original direction if mouth not detected
        const dx = creature.targetX - creature.x;
        const dy = creature.targetY - creature.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance > 1) {
          const speed = creature.type.speed;
          creature.x += (dx / distance) * speed;
          creature.y += (dy / distance) * speed;
        }
      }

      // Update animation
      creature.rotation += 0.02;
      creature.wobble += 0.1;
    });

    // Remove creatures that are destroyed or too far from mouth
    this.creatures = this.creatures.filter(creature => {
      if (creature.health <= 0) return false;

      // If we have mouth position, only keep creatures near mouth
      if (mouthPos) {
        const mouthX = (1 - mouthPos.x) * this.logicalWidth;
        const mouthY = mouthPos.y * this.logicalHeight;

        const dx = creature.x - mouthX;
        const dy = creature.y - mouthY;
        const distanceFromMouth = Math.sqrt(dx * dx + dy * dy);

        const zoneMultiplier = 4; // Slightly larger than spawn zone
        const maxDistance = Math.max(
          mouthDimensions.width * this.logicalWidth,
          mouthDimensions.height * this.logicalHeight
        ) * zoneMultiplier;

        return distanceFromMouth < maxDistance;
      }

      // Fallback: keep creatures on screen
      const margin = 100;
      return creature.x > -margin &&
             creature.x < this.logicalWidth + margin &&
             creature.y > -margin &&
             creature.y < this.logicalHeight + margin;
    });
  }

  checkCollisions() {
    if (!this.mediapipeController || !this.mediapipeController.getHandPosition()) {
      return;
    }

    const brushX = this.brushCursor.x;
    const brushY = this.brushCursor.y;
    const brushRadius = this.brushCursor.size / 2;

    // Get movement direction and speed
    const direction = this.mediapipeController.getMovementDirection();
    const speed = this.mediapipeController.getMovementSpeed();
    const isMoving = speed > 0.01; // Movement threshold

    this.creatures.forEach(creature => {
      // Calculate distance between brush and creature
      const dx = creature.x - brushX;
      const dy = creature.y - brushY;
      const distance = Math.sqrt(dx * dx + dy * dy);

      // Check collision
      if (distance < brushRadius + creature.size / 2) {
        // Only destroy if brush is moving
        if (isMoving) {
          // Calculate required direction based on creature's side
          const requiredDirection = this.getRequiredDirection(creature.side);

          // Check if brushing in correct direction
          if (direction === requiredDirection) {
            this.destroyCreature(creature);
          } else {
            // Wrong direction - show feedback
            this.showWrongDirectionFeedback(creature);
          }
        }
      }
    });
  }

  getRequiredDirection(side) {
    // Returns the direction player should brush to destroy creature from that side
    const directions = ['down', 'left', 'up', 'right'];
    return directions[side];
  }

  destroyCreature(creature) {
    // Award points
    this.score += creature.type.points;
    this.creaturesDestroyed++;

    // Create particles
    this.createParticles(creature.x, creature.y, creature.type.color);

    // Remove creature
    creature.health = 0;

    // Play success feedback (visual pulse)
    this.createSuccessPulse(creature.x, creature.y);
  }

  showWrongDirectionFeedback(creature) {
    // Create red particles to show wrong direction
    this.createParticles(creature.x, creature.y, '#FF0000', 5);
  }

  createParticles(x, y, color, count = 15) {
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count;
      const speed = 2 + Math.random() * 3;

      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        size: 3 + Math.random() * 5,
        color,
        alpha: 1,
        decay: 0.02 + Math.random() * 0.02
      });
    }
  }

  createSuccessPulse(x, y) {
    this.particles.push({
      x,
      y,
      vx: 0,
      vy: 0,
      size: 10,
      color: '#FFD700',
      alpha: 1,
      decay: 0.05,
      isPulse: true
    });
  }

  updateParticles() {
    this.particles.forEach(particle => {
      particle.x += particle.vx;
      particle.y += particle.vy;
      particle.alpha -= particle.decay;

      if (particle.isPulse) {
        particle.size += 2;
      } else {
        particle.vy += 0.1; // Gravity
      }
    });

    // Remove dead particles
    this.particles = this.particles.filter(p => p.alpha > 0);
  }

  render() {
    // Clear canvas
    this.ctx.clearRect(0, 0, this.logicalWidth, this.logicalHeight);

    // Draw brushing zone indicator
    this.drawBrushingZone();

    // Draw tooth zones (if zone mode enabled)
    if (this.zoneMode) {
      this.drawZones();
    }

    // Draw brush trail
    this.drawBrushTrail();

    // Draw circular motion visualization
    this.drawCircularMotion();

    // Draw creatures
    this.drawCreatures();

    // Draw brush cursor
    this.drawBrushCursor();

    // Draw particles
    this.drawParticles();
  }

  drawBrushingZone() {
    if (!this.mediapipeController) return;

    const mouthPos = this.mediapipeController.getMouthPosition();
    if (!mouthPos) return;

    const mouthDimensions = this.mediapipeController.getMouthDimensions();

    // Convert mouth position to screen coordinates
    const mouthX = (1 - mouthPos.x) * this.logicalWidth;
    const mouthY = mouthPos.y * this.logicalHeight;

    // Calculate zone size
    const zoneMultiplier = 3;
    const zoneRadius = Math.max(
      mouthDimensions.width * this.logicalWidth,
      mouthDimensions.height * this.logicalHeight
    ) * zoneMultiplier / 2;

    // Draw outer circle (brushing zone indicator)
    this.ctx.save();
    this.ctx.beginPath();
    this.ctx.arc(mouthX, mouthY, zoneRadius, 0, Math.PI * 2);
    this.ctx.strokeStyle = 'rgba(80, 227, 194, 0.3)'; // Teal color with transparency
    this.ctx.lineWidth = 3;
    this.ctx.stroke();

    // Draw inner circle (mouth indicator)
    this.ctx.beginPath();
    this.ctx.arc(mouthX, mouthY, zoneRadius * 0.3, 0, Math.PI * 2);
    this.ctx.strokeStyle = 'rgba(80, 227, 194, 0.5)';
    this.ctx.lineWidth = 2;
    this.ctx.stroke();

    // Draw crosshair at mouth center for debugging
    this.ctx.strokeStyle = 'rgba(80, 227, 194, 0.4)';
    this.ctx.lineWidth = 1;
    this.ctx.beginPath();
    this.ctx.moveTo(mouthX - 10, mouthY);
    this.ctx.lineTo(mouthX + 10, mouthY);
    this.ctx.moveTo(mouthX, mouthY - 10);
    this.ctx.lineTo(mouthX, mouthY + 10);
    this.ctx.stroke();

    this.ctx.restore();
  }

  drawBrushTrail() {
    this.brushCursor.trail.forEach((point, index) => {
      const size = (index + 1) * 3;
      this.ctx.beginPath();
      this.ctx.arc(point.x, point.y, size, 0, Math.PI * 2);
      this.ctx.fillStyle = `rgba(255, 255, 255, ${point.alpha * 0.3})`;
      this.ctx.fill();
    });
  }

  drawCircularMotion() {
    if (!this.mediapipeController) return;

    const circularMotion = this.mediapipeController.getCircularMotion();
    if (!circularMotion || !circularMotion.center) return;

    // Convert normalized coordinates to screen coordinates
    const centerX = (1 - circularMotion.center.x) * this.logicalWidth;
    const centerY = circularMotion.center.y * this.logicalHeight;
    const radius = circularMotion.radius * this.logicalWidth;

    // Only draw if we have enough data
    if (circularMotion.positionCount < 8) return;

    this.ctx.save();

    // Draw circle outline based on quality
    // Green for good circular motion, yellow for okay, red for poor
    let color;
    let feedback = '';
    if (circularMotion.isCircular) {
      color = 'rgba(80, 227, 194, 0.8)'; // Teal/green - good!
      feedback = 'Great circles!';
    } else if (circularMotion.quality > 0.5) {
      color = 'rgba(255, 235, 59, 0.7)'; // Yellow - okay
      feedback = 'Keep going...';
    } else {
      color = 'rgba(255, 152, 0, 0.5)'; // Orange - needs work
      feedback = 'Make circles!';
    }

    // Draw detected circle outline
    this.ctx.beginPath();
    this.ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
    this.ctx.strokeStyle = color;
    this.ctx.lineWidth = 3;
    this.ctx.stroke();

    // Draw center point
    this.ctx.beginPath();
    this.ctx.arc(centerX, centerY, 5, 0, Math.PI * 2);
    this.ctx.fillStyle = color;
    this.ctx.fill();

    // Draw completeness arc (shows how much of circle completed)
    if (circularMotion.angularCoverage > 0) {
      this.ctx.beginPath();
      this.ctx.arc(
        centerX,
        centerY,
        radius + 10,
        -Math.PI / 2, // Start at top
        -Math.PI / 2 + (circularMotion.angularCoverage * Math.PI / 180), // Sweep by coverage
        false
      );
      this.ctx.strokeStyle = circularMotion.isCircular ?
        'rgba(80, 227, 194, 1)' : 'rgba(255, 235, 59, 0.8)';
      this.ctx.lineWidth = 5;
      this.ctx.stroke();
    }

    // Draw feedback text
    if (circularMotion.isCircular || circularMotion.quality > 0.5) {
      this.ctx.font = 'bold 24px sans-serif';
      this.ctx.textAlign = 'center';
      this.ctx.textBaseline = 'middle';
      this.ctx.fillStyle = color;
      this.ctx.strokeStyle = 'rgba(0, 0, 0, 0.8)';
      this.ctx.lineWidth = 3;
      this.ctx.strokeText(feedback, centerX, centerY - radius - 30);
      this.ctx.fillText(feedback, centerX, centerY - radius - 30);
    }

    // Draw completeness percentage
    if (circularMotion.completeness > 10) {
      const percentText = `${Math.round(circularMotion.completeness)}%`;
      this.ctx.font = 'bold 18px sans-serif';
      this.ctx.fillStyle = color;
      this.ctx.strokeStyle = 'rgba(0, 0, 0, 0.8)';
      this.ctx.lineWidth = 2;
      this.ctx.strokeText(percentText, centerX, centerY);
      this.ctx.fillText(percentText, centerX, centerY);
    }

    // Draw quality indicator (debug)
    if (window.DEBUG_MODE) {
      this.ctx.font = '14px monospace';
      this.ctx.fillStyle = 'white';
      this.ctx.strokeStyle = 'black';
      this.ctx.lineWidth = 2;
      const debugText = `Q: ${(circularMotion.quality * 100).toFixed(0)}% | C: ${Math.round(circularMotion.angularCoverage)}°`;
      this.ctx.strokeText(debugText, centerX, centerY + radius + 30);
      this.ctx.fillText(debugText, centerX, centerY + radius + 30);
    }

    this.ctx.restore();
  }

  drawZones() {
    if (!this.zoneManager) return;

    const zones = this.zoneManager.getAllZones();
    if (!zones || Object.keys(zones).length === 0) return;

    const activeZone = this.zoneManager.getActiveZone();
    const zoneHealth = this.zoneManager.getZoneHealthMap();
    const brushPosition = { x: this.brushCursor.x, y: this.brushCursor.y };
    const currentZoneCheck = this.zoneManager.checkBrushInZone(brushPosition);

    this.ctx.save();

    // Draw all zones
    for (const [zoneName, zoneData] of Object.entries(zones)) {
      const isActive = activeZone && zoneName === activeZone.zoneName;
      const health = zoneHealth[zoneName]?.health || 0;
      const isComplete = zoneHealth[zoneName]?.complete || false;
      const isBrushInZone = currentZoneCheck.inZone && currentZoneCheck.zone === zoneName;

      // Determine zone appearance based on state
      let opacity = 0.2;
      let lineWidth = 2;

      if (isActive) {
        opacity = 0.5; // Active zone is more visible
        lineWidth = 4;

        if (isBrushInZone) {
          opacity = 0.7; // Even more visible when brushing in active zone
        }
      } else if (isComplete) {
        opacity = 0.15; // Completed zones fade out
      }

      // Draw zone circle
      this.ctx.beginPath();
      this.ctx.arc(zoneData.center.x, zoneData.center.y, zoneData.radius, 0, Math.PI * 2);

      // Fill with zone color
      const fillColor = zoneData.color.replace(/[\d.]+\)$/, `${opacity})`);
      this.ctx.fillStyle = fillColor;
      this.ctx.fill();

      // Stroke with zone color (brighter for active)
      const strokeOpacity = isActive ? 0.9 : 0.4;
      const strokeColor = zoneData.color.replace(/[\d.]+\)$/, `${strokeOpacity})`);
      this.ctx.strokeStyle = strokeColor;
      this.ctx.lineWidth = lineWidth;
      this.ctx.stroke();

      // Draw health progress bar inside zone
      if (health > 0 && !isComplete) {
        const barWidth = zoneData.radius * 1.2;
        const barHeight = 8;
        const barX = zoneData.center.x - barWidth / 2;
        const barY = zoneData.center.y + zoneData.radius - 30;

        // Background bar
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
        this.ctx.fillRect(barX, barY, barWidth, barHeight);

        // Progress bar
        const progressWidth = (health / 100) * barWidth;
        const gradient = this.ctx.createLinearGradient(barX, barY, barX + progressWidth, barY);
        gradient.addColorStop(0, 'rgba(80, 227, 194, 0.8)');
        gradient.addColorStop(1, 'rgba(72, 219, 251, 0.8)');
        this.ctx.fillStyle = gradient;
        this.ctx.fillRect(barX, barY, progressWidth, barHeight);

        // Progress text
        this.ctx.font = 'bold 14px sans-serif';
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'bottom';
        this.ctx.fillStyle = 'white';
        this.ctx.strokeStyle = 'rgba(0, 0, 0, 0.8)';
        this.ctx.lineWidth = 3;
        const healthText = `${Math.round(health)}%`;
        this.ctx.strokeText(healthText, zoneData.center.x, barY - 2);
        this.ctx.fillText(healthText, zoneData.center.x, barY - 2);
      }

      // Draw completion checkmark
      if (isComplete) {
        this.ctx.font = 'bold 40px sans-serif';
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        this.ctx.fillStyle = 'rgba(80, 227, 194, 0.9)';
        this.ctx.strokeStyle = 'rgba(0, 0, 0, 0.5)';
        this.ctx.lineWidth = 3;
        this.ctx.strokeText('✓', zoneData.center.x, zoneData.center.y);
        this.ctx.fillText('✓', zoneData.center.x, zoneData.center.y);
      }

      // Draw zone label (only for active zone or when hovering)
      if (isActive || isBrushInZone) {
        this.ctx.font = 'bold 16px sans-serif';
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        this.ctx.fillStyle = 'white';
        this.ctx.strokeStyle = 'rgba(0, 0, 0, 0.8)';
        this.ctx.lineWidth = 3;
        this.ctx.strokeText(zoneData.label, zoneData.center.x, zoneData.center.y - zoneData.radius + 20);
        this.ctx.fillText(zoneData.label, zoneData.center.x, zoneData.center.y - zoneData.radius + 20);
      }
    }

    // Draw active zone instruction at top of screen
    if (activeZone && activeZone.zoneData) {
      const instructionY = 100;

      // Background
      this.ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
      this.ctx.fillRect(
        this.logicalWidth / 2 - 200,
        instructionY - 35,
        400,
        70
      );

      // Zone emoji
      this.ctx.font = '40px serif';
      this.ctx.textAlign = 'center';
      this.ctx.textBaseline = 'middle';
      this.ctx.fillText(activeZone.zoneData.emoji, this.logicalWidth / 2, instructionY - 10);

      // Instruction text
      this.ctx.font = 'bold 18px sans-serif';
      this.ctx.fillStyle = 'white';
      this.ctx.strokeStyle = 'rgba(0, 0, 0, 0.8)';
      this.ctx.lineWidth = 3;
      const instruction = activeZone.zoneData.instruction;
      this.ctx.strokeText(instruction, this.logicalWidth / 2, instructionY + 20);
      this.ctx.fillText(instruction, this.logicalWidth / 2, instructionY + 20);

      // Progress indicator
      const stats = this.zoneManager.getZoneStats();
      const progressText = `Zone ${activeZone.index + 1}/${stats.totalZones} | ${stats.completedZones} Complete`;
      this.ctx.font = 'bold 14px sans-serif';
      this.ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
      this.ctx.strokeText(progressText, this.logicalWidth / 2, instructionY - 25);
      this.ctx.fillText(progressText, this.logicalWidth / 2, instructionY - 25);
    }

    // DEBUG MODE: Show detection information
    if (window.DEBUG_MODE || window.ALWAYS_SHOW_DEBUG) {
      this.drawZoneDebugInfo(currentZoneCheck);
    }

    this.ctx.restore();
  }

  drawZoneDebugInfo(zoneCheck) {
    const debugY = this.logicalHeight - 150;
    const debugX = 20;

    // Background panel
    this.ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
    this.ctx.fillRect(debugX - 10, debugY - 10, 350, 140);

    this.ctx.font = '12px monospace';
    this.ctx.textAlign = 'left';
    this.ctx.fillStyle = 'white';

    let lineY = debugY;
    const lineHeight = 18;

    // Title
    this.ctx.font = 'bold 14px monospace';
    this.ctx.fillText('DEBUG INFO (press D to toggle)', debugX, lineY);
    lineY += lineHeight + 5;

    this.ctx.font = '12px monospace';

    // Zone status
    this.ctx.fillStyle = zoneCheck.inZone ? '#4CAF50' : '#FF5252';
    this.ctx.fillText(`IN ZONE: ${zoneCheck.inZone ? 'YES' : 'NO'}`, debugX, lineY);
    lineY += lineHeight;

    if (zoneCheck.inZone) {
      this.ctx.fillStyle = zoneCheck.isActiveZone ? '#4CAF50' : '#FFA726';
      this.ctx.fillText(`ACTIVE ZONE: ${zoneCheck.isActiveZone ? 'YES' : 'NO'}`, debugX, lineY);
      lineY += lineHeight;
    }

    // Movement status
    const isMoving = this.mediapipeController ? this.mediapipeController.isMoving(0.005) : false;
    const speed = this.mediapipeController ? this.mediapipeController.getMovementSpeed() : 0;
    this.ctx.fillStyle = isMoving ? '#4CAF50' : '#FF5252';
    this.ctx.fillText(`MOVING: ${isMoving ? 'YES' : 'NO'} (${(speed * 1000).toFixed(1)})`, debugX, lineY);
    lineY += lineHeight;

    // Circular motion status
    const circularMotion = this.mediapipeController ? this.mediapipeController.getCircularMotion() : null;
    if (circularMotion) {
      this.ctx.fillStyle = circularMotion.isCircular ? '#4CAF50' : '#FFA726';
      this.ctx.fillText(`CIRCULAR: ${circularMotion.isCircular ? 'YES' : 'NO'}`, debugX, lineY);
      lineY += lineHeight;

      this.ctx.fillStyle = 'white';
      this.ctx.fillText(`Quality: ${(circularMotion.quality * 100).toFixed(0)}% | Coverage: ${Math.round(circularMotion.angularCoverage)}°`, debugX, lineY);
      lineY += lineHeight;
    }

    // Health increase rate
    if (zoneCheck.inZone && zoneCheck.isActiveZone) {
      let healthRate = 0;
      if (circularMotion && circularMotion.isCircular) {
        healthRate = 1.5 * circularMotion.quality;
      } else if (circularMotion && circularMotion.quality > 0.3) {
        healthRate = 1.5 * 0.6 * circularMotion.quality;
      } else if (isMoving) {
        healthRate = 0.8;
      }

      this.ctx.fillStyle = healthRate > 0.5 ? '#4CAF50' : '#FFA726';
      this.ctx.fillText(`HEALTH RATE: ${healthRate.toFixed(2)} pts/frame`, debugX, lineY);
    }
  }

  drawCreatures() {
    this.creatures.forEach(creature => {
      this.ctx.save();
      this.ctx.translate(creature.x, creature.y);
      this.ctx.rotate(creature.rotation);

      // Wobble effect
      const wobbleY = Math.sin(creature.wobble) * 5;
      this.ctx.translate(0, wobbleY);

      // Draw creature shadow
      this.ctx.globalAlpha = 0.3;
      this.ctx.font = `${creature.size}px serif`;
      this.ctx.textAlign = 'center';
      this.ctx.textBaseline = 'middle';
      this.ctx.fillText(creature.type.emoji, 2, 2);

      // Draw creature
      this.ctx.globalAlpha = 1;
      this.ctx.fillText(creature.type.emoji, 0, 0);

      this.ctx.restore();

      // Draw direction hint
      this.drawDirectionHint(creature);
    });
  }

  drawDirectionHint(creature) {
    const direction = this.getRequiredDirection(creature.side);
    const arrows = {
      'up': '↑',
      'down': '↓',
      'left': '←',
      'right': '→'
    };

    this.ctx.font = 'bold 20px sans-serif';
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'middle';
    this.ctx.fillStyle = '#FFD700';
    this.ctx.strokeStyle = '#000';
    this.ctx.lineWidth = 3;
    this.ctx.strokeText(arrows[direction], creature.x, creature.y - creature.size / 2 - 15);
    this.ctx.fillText(arrows[direction], creature.x, creature.y - creature.size / 2 - 15);
  }

  drawBrushCursor() {
    if (!this.mediapipeController || !this.mediapipeController.getHandPosition()) {
      return;
    }

    const x = this.brushCursor.x;
    const y = this.brushCursor.y;
    const size = this.brushCursor.size;

    // Draw toothbrush emoji
    this.ctx.save();
    this.ctx.font = `${size}px serif`;
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'middle';

    // Shadow
    this.ctx.globalAlpha = 0.5;
    this.ctx.fillText('🪥', x + 2, y + 2);

    // Main brush
    this.ctx.globalAlpha = 1;
    this.ctx.fillText('🪥', x, y);

    this.ctx.restore();
  }

  drawParticles() {
    this.particles.forEach(particle => {
      this.ctx.save();
      this.ctx.globalAlpha = particle.alpha;

      if (particle.isPulse) {
        this.ctx.beginPath();
        this.ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
        this.ctx.strokeStyle = particle.color;
        this.ctx.lineWidth = 3;
        this.ctx.stroke();
      } else {
        this.ctx.beginPath();
        this.ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
        this.ctx.fillStyle = particle.color;
        this.ctx.fill();
      }

      this.ctx.restore();
    });
  }

  drawDirectionIndicators() {
    // Draw subtle arrows at screen edges to show valid directions
    const arrows = [
      { x: this.logicalWidth / 2, y: 30, text: '↓', alpha: 0.3 },
      { x: this.logicalWidth - 30, y: this.logicalHeight / 2, text: '←', alpha: 0.3 },
      { x: this.logicalWidth / 2, y: this.logicalHeight - 30, text: '↑', alpha: 0.3 },
      { x: 30, y: this.logicalHeight / 2, text: '→', alpha: 0.3 }
    ];

    this.ctx.font = 'bold 24px sans-serif';
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'middle';

    arrows.forEach(arrow => {
      this.ctx.globalAlpha = arrow.alpha;
      this.ctx.fillStyle = '#FFFFFF';
      this.ctx.strokeStyle = '#000000';
      this.ctx.lineWidth = 2;
      this.ctx.strokeText(arrow.text, arrow.x, arrow.y);
      this.ctx.fillText(arrow.text, arrow.x, arrow.y);
    });

    this.ctx.globalAlpha = 1;
  }

  pause() {
    this.isPaused = true;
    if (this.mediapipeController) {
      this.mediapipeController.pause();
    }
  }

  resume() {
    this.isPaused = false;
    // Adjust start time to account for pause
    const pausedDuration = Math.floor((Date.now() - this.startTime) / 1000) - this.elapsedTime;
    this.startTime = Date.now() - (this.elapsedTime * 1000);
    if (this.mediapipeController) {
      this.mediapipeController.resume();
    }
  }

  stop() {
    this.isRunning = false;
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
    }
  }

  endGame() {
    if (this.gameEnded) return;
    this.gameEnded = true;
    this.stop();
  }

  getGameState() {
    const state = {
      score: this.score,
      creaturesDestroyed: this.creaturesDestroyed,
      duration: this.elapsedTime,
      timeRemaining: Math.max(0, this.requiredDuration - this.elapsedTime),
      requiredDuration: this.requiredDuration,
      gameEnded: this.gameEnded
    };

    // Add zone statistics if zone mode is enabled
    if (this.zoneMode && this.zoneManager) {
      state.zoneStats = this.zoneManager.getZoneStats();
      state.activeZone = this.zoneManager.getActiveZone();
    }

    return state;
  }
}
