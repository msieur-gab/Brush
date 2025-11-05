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
      x: this.canvas.width / 2,
      y: this.canvas.height / 2,
      size: 60,
      trail: []
    };

    // Bind resize handler
    window.addEventListener('resize', () => this.resizeCanvas());

    // Animation frame
    this.animationFrameId = null;
  }

  resizeCanvas() {
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
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
      // Convert normalized coordinates (0-1) to canvas coordinates
      // Flip X for mirror effect
      const x = (1 - handPosition.x) * this.canvas.width;
      const y = handPosition.y * this.canvas.height;

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

  spawnCreature() {
    // Random creature type
    const type = this.creatureTypes[Math.floor(Math.random() * this.creatureTypes.length)];

    // Random side (0=top, 1=right, 2=bottom, 3=left)
    const side = Math.floor(Math.random() * 4);

    let x, y, targetX, targetY;

    // Position based on side
    switch (side) {
      case 0: // Top
        x = Math.random() * this.canvas.width;
        y = -type.size;
        targetX = Math.random() * this.canvas.width;
        targetY = this.canvas.height + type.size;
        break;
      case 1: // Right
        x = this.canvas.width + type.size;
        y = Math.random() * this.canvas.height;
        targetX = -type.size;
        targetY = Math.random() * this.canvas.height;
        break;
      case 2: // Bottom
        x = Math.random() * this.canvas.width;
        y = this.canvas.height + type.size;
        targetX = Math.random() * this.canvas.width;
        targetY = -type.size;
        break;
      case 3: // Left
        x = -type.size;
        y = Math.random() * this.canvas.height;
        targetX = this.canvas.width + type.size;
        targetY = Math.random() * this.canvas.height;
        break;
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
      health: 1
    };

    this.creatures.push(creature);
  }

  updateCreatures() {
    this.creatures.forEach(creature => {
      // Move towards target
      const dx = creature.targetX - creature.x;
      const dy = creature.targetY - creature.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (distance > 1) {
        const speed = creature.type.speed;
        creature.x += (dx / distance) * speed;
        creature.y += (dy / distance) * speed;
      }

      // Update animation
      creature.rotation += 0.02;
      creature.wobble += 0.1;
    });

    // Remove creatures that are off screen
    this.creatures = this.creatures.filter(creature => {
      const margin = 100;
      return creature.x > -margin &&
             creature.x < this.canvas.width + margin &&
             creature.y > -margin &&
             creature.y < this.canvas.height + margin &&
             creature.health > 0;
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
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    // Draw brush trail
    this.drawBrushTrail();

    // Draw creatures
    this.drawCreatures();

    // Draw brush cursor
    this.drawBrushCursor();

    // Draw particles
    this.drawParticles();

    // Draw direction indicators
    this.drawDirectionIndicators();
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
      { x: this.canvas.width / 2, y: 30, text: '↓', alpha: 0.3 },
      { x: this.canvas.width - 30, y: this.canvas.height / 2, text: '←', alpha: 0.3 },
      { x: this.canvas.width / 2, y: this.canvas.height - 30, text: '↑', alpha: 0.3 },
      { x: 30, y: this.canvas.height / 2, text: '→', alpha: 0.3 }
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
    return {
      score: this.score,
      creaturesDestroyed: this.creaturesDestroyed,
      duration: this.elapsedTime,
      timeRemaining: Math.max(0, this.requiredDuration - this.elapsedTime),
      requiredDuration: this.requiredDuration,
      gameEnded: this.gameEnded
    };
  }
}
