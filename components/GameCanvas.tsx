import React, { useRef, useEffect } from 'react';
import { GameState, TimelineSegment, SequenceClip, GameMode } from '../types';
import { 
  CANVAS_WIDTH, 
  CANVAS_HEIGHT, 
  COLORS, 
  AVAILABLE_COLORS, 
  COLOR_FREQUENCIES,
  SOURCE_TRACK_Y,
  AUDIO_TRACK_Y,
  SEQUENCE_TRACK_Y,
  TRACK_HEIGHT,
  TRACK_HEIGHT_COMPACT,
  MAX_SPEED,
  KEY_J,
  KEY_K,
  KEY_L,
  KEY_I,
  KEY_O,
  KEY_PERIOD,
  SEGMENT_MIN_WIDTH,
  SEGMENT_MAX_WIDTH,
  WIN_PIXELS,
  BAD_HABIT_THRESHOLD
} from '../constants';

interface GameCanvasProps {
  gameState: GameState;
  setGameState: (state: GameState) => void;
  targetColor: string;
  setTargetColor: (color: string) => void;
  score: number;
  setScore: (score: number) => void;
  setPenaltyCount: (count: number) => void;
  setFinalScore: (score: number) => void;
  gameRef: React.MutableRefObject<GameEngine | null>;
  gameMode: GameMode;
}

type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  color: string;
  type: 'star' | 'heart' | 'spark';
};

// Consistency constant: 1 "Frame" = 6 pixels
const FRAME_PIXELS = 6;

export class GameEngine {
  ctx: CanvasRenderingContext2D;
  width: number;
  height: number;
  
  // State
  sourceSegments: TimelineSegment[] = [];
  sequenceClips: SequenceClip[] = [];
  particles: Particle[] = [];
  gameMode: GameMode = 'STANDARD';
  
  // Viewport
  conveyorOffset: number = 0; 

  // Editing
  markIn: number | null = null; 
  markOut: number | null = null; 

  // Physics / Time / Inputs
  currentSpeed: number = 0;
  lastTime: number = 0;
  startTime: number = 0;

  // Input State (True NLE Simulation)
  isHoldingK: boolean = false;
  isHoldingJ: boolean = false;
  isHoldingL: boolean = false;
  
  // To detect taps vs holds
  inputTimestamps: Record<string, number> = {};
  inputStartOffsets: Record<string, number> = {};
  
  targetColor: string = COLORS.RED;
  
  // Game Stats
  penaltyCount: number = 0;
  
  // Audio
  audioCtx: AudioContext | null = null;
  oscillator: OscillatorNode | null = null;
  gainNode: GainNode | null = null;
  meowBuffer: AudioBuffer | null = null;
  isAudioInitialized: boolean = false;

  // Character State
  characterMood: 'idle' | 'happy' | 'worried' | 'dizzy' | 'focused' = 'idle';
  characterMoodTimer: number = 0;
  
  // Callbacks
  onScoreUpdate: (score: number) => void;
  onPenaltyUpdate: (penalty: number) => void;
  onFinalScoreUpdate: (score: number) => void;
  onGameOver: () => void;
  onWin: () => void;

  constructor(
    ctx: CanvasRenderingContext2D, 
    width: number, 
    height: number,
    onScoreUpdate: (s: number) => void,
    onPenaltyUpdate: (p: number) => void,
    onFinalScoreUpdate: (s: number) => void,
    onGameOver: () => void,
    onWin: () => void
  ) {
    this.ctx = ctx;
    this.width = width;
    this.height = height;
    this.onScoreUpdate = onScoreUpdate;
    this.onPenaltyUpdate = onPenaltyUpdate;
    this.onFinalScoreUpdate = onFinalScoreUpdate;
    this.onGameOver = onGameOver;
    this.onWin = onWin;
  }

  initAudio() {
    if (this.isAudioInitialized) return;
    
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      this.audioCtx = new AudioContextClass();
      this.gainNode = this.audioCtx.createGain();
      this.gainNode.gain.value = 0;
      this.gainNode.connect(this.audioCtx.destination);
      
      this.oscillator = this.audioCtx.createOscillator();
      this.oscillator.type = 'triangle';
      this.oscillator.connect(this.gainNode);
      this.oscillator.start();
      
      // Create procedural meow buffer
      this.meowBuffer = this.createMeowBuffer(this.audioCtx);
      
      this.isAudioInitialized = true;
    } catch (e) {
      console.error("Web Audio API not supported", e);
    }
  }

  createMeowBuffer(ctx: AudioContext): AudioBuffer {
      // Generate a 1-second meow sound
      const duration = 1.0;
      const sampleRate = ctx.sampleRate;
      const buffer = ctx.createBuffer(1, sampleRate * duration, sampleRate);
      const data = buffer.getChannelData(0);
      
      for (let i = 0; i < data.length; i++) {
          const t = i / sampleRate;
          // Pitch envelope: Start high (800Hz), drop to mid (400Hz)
          const freq = 800 - (400 * t);
          
          // Volume envelope: Attack -> Sustain -> Release
          let amp = 0;
          if (t < 0.1) amp = t / 0.1;
          else if (t < 0.8) amp = 1.0;
          else amp = 1.0 - ((t - 0.8) / 0.2);
          
          // Mix of Sine (pure) and Sawtooth (buzzy/vocal)
          const val = 0.7 * Math.sin(2 * Math.PI * freq * t) + 
                      0.3 * ((Math.random() * 2 - 1) * 0.1 + Math.sin(2 * Math.PI * (freq * 1.01) * t));
          
          data[i] = val * amp * 0.5;
      }
      return buffer;
  }

  stopAudio() {
      if (this.gainNode) {
          this.gainNode.gain.setTargetAtTime(0, this.audioCtx?.currentTime || 0, 0.05);
      }
  }

  start(targetColor: string, mode: GameMode) {
    this.targetColor = targetColor;
    this.gameMode = mode;
    this.conveyorOffset = 0;
    this.currentSpeed = 0;
    this.markIn = null;
    this.markOut = null;
    this.penaltyCount = 0;
    
    this.isHoldingK = false;
    this.isHoldingJ = false;
    this.isHoldingL = false;

    this.sequenceClips = [];
    this.particles = [];
    this.generateSourceTape();
    this.lastTime = performance.now();
    this.startTime = performance.now();
    
    this.onScoreUpdate(0);
    this.onPenaltyUpdate(0);
    this.setCharacterMood('idle');
    
    // Ensure starting position is aligned to grid
    this.snapToFrame();

    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }
    this.stopAudio();
  }

  generateSourceTape() {
    this.sourceSegments = [];
    let currentX = 0;
    for (let i = 0; i < 200; i++) {
        // Force width to be a multiple of FRAME_PIXELS for perfect alignment
        const rawWidth = Math.random() * (SEGMENT_MAX_WIDTH - SEGMENT_MIN_WIDTH) + SEGMENT_MIN_WIDTH;
        const width = Math.round(rawWidth / FRAME_PIXELS) * FRAME_PIXELS;

        let color;
        do {
             color = AVAILABLE_COLORS[Math.floor(Math.random() * AVAILABLE_COLORS.length)];
        } while (i > 0 && color === this.sourceSegments[i-1].color);

        this.sourceSegments.push({
            id: `seg_${i}`,
            x: currentX,
            width: width,
            color: color
        });
        currentX += width;
    }
  }

  // --- PHYSICS & GRID LOGIC ---

  getTapeXAtPlayhead() {
      return (this.width / 2) - this.conveyorOffset;
  }

  snapToFrame() {
      const currentTapeX = this.getTapeXAtPlayhead();
      const snappedTapeX = Math.round(currentTapeX / FRAME_PIXELS) * FRAME_PIXELS;
      this.conveyorOffset = (this.width / 2) - snappedTapeX;
  }

  // --- INPUT HANDLING (PREMIERE PRO LOGIC) ---

  handleKeyDown(key: string) {
    const now = performance.now();
    
    if (key === KEY_K) {
        if (!this.isHoldingK) {
            this.isHoldingK = true;
            this.currentSpeed = 0; 
            this.snapToFrame();
            this.stopAudio();
        }
    } 
    else if (key === KEY_L) {
        if (!this.isHoldingL) {
            this.isHoldingL = true;
            this.inputTimestamps[KEY_L] = now;
            this.inputStartOffsets[KEY_L] = this.conveyorOffset;

            if (this.isHoldingK) {
                this.currentSpeed = 0.2;
            } else {
                if (this.currentSpeed < 0) this.currentSpeed = 0; 
                else if (this.currentSpeed === 0) this.currentSpeed = 1;
                else this.currentSpeed = Math.min(this.currentSpeed * 2, MAX_SPEED);
            }
        }
    }
    else if (key === KEY_J) {
        if (!this.isHoldingJ) {
            this.isHoldingJ = true;
            this.inputTimestamps[KEY_J] = now;
            this.inputStartOffsets[KEY_J] = this.conveyorOffset;

            if (this.isHoldingK) {
                this.currentSpeed = -0.2;
            } else {
                if (this.currentSpeed > 0) this.currentSpeed = 0;
                else if (this.currentSpeed === 0) this.currentSpeed = -1;
                else this.currentSpeed = Math.max(this.currentSpeed * 2, -MAX_SPEED);
            }
        }
    }
    else if (key === KEY_I) {
        const tapeX = this.getTapeXAtPlayhead();
        this.markIn = Math.round(tapeX / FRAME_PIXELS) * FRAME_PIXELS;
        if (this.markOut !== null && this.markOut < this.markIn) this.markOut = null;
        this.createParticles(this.width/2, SOURCE_TRACK_Y + TRACK_HEIGHT/2, 5, '#fbbf24', 'spark');
    }
    else if (key === KEY_O) {
        const tapeX = this.getTapeXAtPlayhead();
        const snappedX = Math.round(tapeX / FRAME_PIXELS) * FRAME_PIXELS;
        if (this.markIn === null || snappedX > this.markIn) {
            this.markOut = snappedX;
            this.createParticles(this.width/2, SOURCE_TRACK_Y + TRACK_HEIGHT/2, 5, '#fbbf24', 'spark');
        }
    }
    else if (key === KEY_PERIOD) {
        this.performExtract();
    }
  }

  handleKeyUp(key: string) {
    const now = performance.now();

    if (key === KEY_K) {
        this.isHoldingK = false;
    }
    else if (key === KEY_L) {
        this.isHoldingL = false;
        
        if (this.isHoldingK) {
            this.currentSpeed = 0;
            this.stopAudio();
            if (now - this.inputTimestamps[KEY_L] < 200) {
                const startOffset = this.inputStartOffsets[KEY_L];
                const startTapeX = (this.width / 2) - startOffset;
                const gridTapeX = Math.round(startTapeX / FRAME_PIXELS) * FRAME_PIXELS;
                const targetTapeX = gridTapeX + FRAME_PIXELS;
                this.conveyorOffset = (this.width / 2) - targetTapeX;
                this.registerBadHabit();
            } else {
                this.snapToFrame();
            }
        }
    }
    else if (key === KEY_J) {
        this.isHoldingJ = false;
        
        if (this.isHoldingK) {
            this.currentSpeed = 0;
            this.stopAudio();
            if (now - this.inputTimestamps[KEY_J] < 200) {
                const startOffset = this.inputStartOffsets[KEY_J];
                const startTapeX = (this.width / 2) - startOffset;
                const gridTapeX = Math.round(startTapeX / FRAME_PIXELS) * FRAME_PIXELS;
                const targetTapeX = gridTapeX - FRAME_PIXELS;
                this.conveyorOffset = (this.width / 2) - targetTapeX;
                this.registerBadHabit();
            } else {
                this.snapToFrame();
            }
        }
    }
  }

  registerBadHabit() {
      this.penaltyCount++;
      this.onPenaltyUpdate(this.penaltyCount);
      this.setCharacterMood('worried', 200);
      this.createParticles(this.width/2, SOURCE_TRACK_Y, 3, '#ef4444', 'star');
  }

  calculateFinalScore(): number {
      const timeElapsed = (performance.now() - this.startTime) / 1000;
      const penalties = this.penaltyCount;
      
      let score = 10000 - (timeElapsed * 10) - (penalties * 50);
      return Math.max(0, Math.floor(score));
  }

  setCharacterMood(mood: 'idle' | 'happy' | 'worried' | 'dizzy' | 'focused', duration: number = 0) {
      this.characterMood = mood;
      if (duration > 0) {
          this.characterMoodTimer = duration;
      }
  }

  performExtract() {
      if (this.markIn === null || this.markOut === null) return;
      
      const start = this.markIn;
      const end = this.markOut;
      const duration = end - start;
      
      if (duration <= 0) return;

      const affectedSegments = this.sourceSegments.filter(s => 
          s.x < end && (s.x + s.width) > start
      );

      if (affectedSegments.length === 0) return;

      let success = false;

      if (this.gameMode === 'CAT_MODE') {
          const ALLOWED_SILENCE_FRAMES = 10;
          const ALLOWED_SILENCE_PX = ALLOWED_SILENCE_FRAMES * FRAME_PIXELS; // 60px
          
          // Logic:
          // 1. Must contain the Target Meow Segment COMPLETELY
          // 2. Can contain silence (other color) up to ALLOWED_SILENCE_PX on either side
          
          const targetMeow = affectedSegments.find(s => s.color === this.targetColor);
          
          if (!targetMeow) {
              success = false; // Didn't catch any meow
          } else {
              // Check strict containment of meow
              // Using small epsilon for float precision
              const caughtStart = start <= targetMeow.x + 0.1;
              const caughtEnd = end >= targetMeow.x + targetMeow.width - 0.1;
              
              if (caughtStart && caughtEnd) {
                  // Checked silence
                  const silenceBefore = Math.max(0, targetMeow.x - start);
                  const silenceAfter = Math.max(0, end - (targetMeow.x + targetMeow.width));
                  
                  if (silenceBefore > ALLOWED_SILENCE_PX || silenceAfter > ALLOWED_SILENCE_PX) {
                      success = false; // Too much silence
                  } else {
                      success = true;
                  }
              } else {
                  success = false; // Cut off part of the meow
              }
          }

      } else {
          let correctColorLength = 0;
          affectedSegments.forEach(seg => {
              const segStart = Math.max(start, seg.x);
              const segEnd = Math.min(end, seg.x + seg.width);
              const len = segEnd - segStart;
              if (seg.color === this.targetColor) {
                  correctColorLength += len;
              }
          });
          const accuracy = correctColorLength / duration;
          success = accuracy >= 0.95; 
      }

      if (!success) {
          this.setCharacterMood('worried', 120);
          this.onGameOver();
          return;
      }

      this.setCharacterMood('happy', 60);
      const particleColor = this.gameMode === 'CAT_MODE' ? '#f472b6' : this.targetColor;
      this.createParticles(this.width/2, SEQUENCE_TRACK_Y, 20, particleColor, 'heart');

      this.sequenceClips.push({
          id: `clip_${Date.now()}`,
          width: duration,
          color: this.targetColor
      });
      
      const totalPixels = this.sequenceClips.reduce((acc, clip) => acc + clip.width, 0);
      this.onScoreUpdate(totalPixels);

      if (totalPixels >= WIN_PIXELS) {
          this.onFinalScoreUpdate(this.calculateFinalScore());
          this.stopAudio();
          this.onWin();
          return;
      }

      // Ripple Delete
      const newSegments: TimelineSegment[] = [];
      this.sourceSegments.forEach(seg => {
          if (seg.x + seg.width <= start) newSegments.push(seg);
          else if (seg.x < start) newSegments.push({ ...seg, width: start - seg.x });
      });
      this.sourceSegments.forEach(seg => {
          if (seg.x >= end) newSegments.push({ ...seg, x: seg.x - duration });
          else if (seg.x + seg.width > end) {
              const newLen = (seg.x + seg.width) - end;
              newSegments.push({ ...seg, x: end - duration, width: newLen });
          }
      });

      this.sourceSegments = newSegments;
      this.conveyorOffset = (this.width / 2) - start;
      this.markIn = null;
      this.markOut = null;
      this.currentSpeed = 0; 
      this.snapToFrame();
      this.stopAudio();
  }

  createParticles(x: number, y: number, count: number, color: string, type: 'star' | 'heart' | 'spark') {
      for (let i = 0; i < count; i++) {
          const angle = Math.random() * Math.PI * 2;
          const speed = Math.random() * 5 + 2;
          this.particles.push({
              x, y,
              vx: Math.cos(angle) * speed,
              vy: Math.sin(angle) * speed,
              life: 1.0,
              color,
              type
          });
      }
  }

  updateAudio() {
    if (!this.isAudioInitialized || !this.audioCtx || !this.gainNode) return;

    const tapeX = this.getTapeXAtPlayhead();
    const segment = this.sourceSegments.find(s => tapeX >= s.x && tapeX < s.x + s.width);
    
    if (this.currentSpeed !== 0 && segment) {
        if (this.gameMode === 'CAT_MODE') {
            if (segment.color === this.targetColor && this.meowBuffer) {
                // Silence standard synth
                if (this.oscillator) {
                    this.gainNode.gain.setTargetAtTime(0, this.audioCtx.currentTime, 0.01);
                }

                // Realistic Scrubbing via BufferSource grain
                const progress = (tapeX - segment.x) / segment.width;
                const bufferOffset = Math.max(0, Math.min(progress * this.meowBuffer.duration, this.meowBuffer.duration));
                
                const src = this.audioCtx.createBufferSource();
                src.buffer = this.meowBuffer;
                src.connect(this.gainNode);
                
                // Rate affects pitch (chipmunking)
                const pitchShift = Math.abs(this.currentSpeed);
                // Clamp rate
                src.playbackRate.value = Math.max(0.1, Math.min(pitchShift, 3.0));
                
                // Play grain
                const grainDuration = 0.05;
                src.start(this.audioCtx.currentTime, bufferOffset, grainDuration);
                
                this.gainNode.gain.setTargetAtTime(0.3, this.audioCtx.currentTime, 0.01);
            } else {
                this.gainNode.gain.setTargetAtTime(0, this.audioCtx.currentTime, 0.05);
            }
        } else {
            // Standard Color Tone
            const baseFreq = COLOR_FREQUENCIES[segment.color] || 440;
            const pitchShift = Math.min(Math.max(this.currentSpeed * 0.05, -0.5), 0.5); 
            
            if (this.oscillator) {
                this.oscillator.frequency.setTargetAtTime(baseFreq * (1 + pitchShift), this.audioCtx.currentTime, 0.05);
                this.gainNode.gain.setTargetAtTime(0.1, this.audioCtx.currentTime, 0.05);
            }
        }
    } else {
        this.gainNode.gain.setTargetAtTime(0, this.audioCtx.currentTime, 0.05);
    }
  }

  update(timestamp: number) {
    const dt = (timestamp - this.lastTime) / 16.666;
    this.lastTime = timestamp;

    this.conveyorOffset -= this.currentSpeed * FRAME_PIXELS * dt;

    if (this.characterMoodTimer > 0) {
        this.characterMoodTimer -= dt;
        if (this.characterMoodTimer <= 0) {
            this.setCharacterMood('idle');
        }
    } else {
        if (Math.abs(this.currentSpeed) > 4) this.setCharacterMood('dizzy');
        else if (this.currentSpeed !== 0) this.setCharacterMood('focused');
        else this.setCharacterMood('idle');
    }

    this.updateAudio();

    for (let i = this.particles.length - 1; i >= 0; i--) {
        const p = this.particles[i];
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vy += 0.2 * dt;
        p.life -= 0.02 * dt;
        if (p.life <= 0) this.particles.splice(i, 1);
    }
  }

  draw() {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.width, this.height);

    // Background
    ctx.fillStyle = '#0f172a'; 
    ctx.fillRect(0, 0, this.width, this.height);

    // Grid
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 1;
    
    const startTapeX = this.getTapeXAtPlayhead() - (this.width/2); 
    const endTapeX = startTapeX + this.width;
    const startGridIndex = Math.floor(startTapeX / (FRAME_PIXELS * 10)); 

    for(let i = startGridIndex; i * FRAME_PIXELS * 10 < endTapeX; i++) {
        const tapeX = i * FRAME_PIXELS * 10;
        const screenX = tapeX + this.conveyorOffset;
        
        ctx.beginPath();
        ctx.moveTo(screenX, 0);
        ctx.lineTo(screenX, this.height);
        ctx.stroke();
    }

    this.drawSourceTrack();
    this.drawCharacterOnTimeline(); 
    this.drawPlayheadLine(); 
    this.drawSequenceTrack();
    this.drawParticles();
    this.drawHUD();
  }

  drawCatSegment(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, isOpen: boolean) {
      ctx.save();
      ctx.beginPath();
      ctx.rect(x, y, w, h);
      ctx.clip();

      // Background
      ctx.fillStyle = '#cbd5e1';
      ctx.fillRect(x, y, w, h);
      
      // Use 'isOpen' to determine if cats are singing
      // We remove any vertical stripes/grid lines that were here previously

      const catSpacing = 60;
      const numCats = Math.floor(w / catSpacing);
      const startX = x + (w - (numCats * catSpacing)) / 2 + catSpacing/2;

      for (let i = 0; i < numCats; i++) {
          const cx = startX + i * catSpacing;
          const cy = y + h/2;
          
          // Ears
          ctx.fillStyle = '#475569';
          ctx.beginPath(); ctx.moveTo(cx - 12, cy - 10); ctx.lineTo(cx - 15, cy - 20); ctx.lineTo(cx - 5, cy - 15); ctx.fill();
          ctx.beginPath(); ctx.moveTo(cx + 12, cy - 10); ctx.lineTo(cx + 15, cy - 20); ctx.lineTo(cx + 5, cy - 15); ctx.fill();

          // Head
          ctx.fillStyle = '#e2e8f0';
          ctx.beginPath(); ctx.arc(cx, cy, 15, 0, Math.PI*2); ctx.fill();

          // Eyes
          ctx.fillStyle = '#1e293b';
          if (isOpen) {
            // Happy/Singing Eyes
            ctx.beginPath(); ctx.arc(cx - 5, cy - 2, 2, 0, Math.PI*2); ctx.fill();
            ctx.beginPath(); ctx.arc(cx + 5, cy - 2, 2, 0, Math.PI*2); ctx.fill();
          } else {
             // Closed Eyes
             ctx.beginPath(); ctx.moveTo(cx - 8, cy - 2); ctx.lineTo(cx - 2, cy - 2); ctx.stroke();
             ctx.beginPath(); ctx.moveTo(cx + 2, cy - 2); ctx.lineTo(cx + 8, cy - 2); ctx.stroke();
          }

          // Mouth
          if (isOpen) {
              ctx.fillStyle = '#f472b6';
              ctx.beginPath(); ctx.ellipse(cx, cy + 5, 4, 6, 0, 0, Math.PI*2); ctx.fill();
          } else {
              ctx.strokeStyle = '#1e293b'; ctx.lineWidth = 1.5;
              ctx.beginPath(); ctx.moveTo(cx - 2, cy + 5); ctx.lineTo(cx + 2, cy + 5); ctx.stroke();
          }
      }
      ctx.restore();
      
      // No border stroke!
  }

  drawCharacterOnTimeline() {
      const ctx = this.ctx;
      const cx = this.width / 2;
      const cy = this.gameMode === 'CAT_MODE' ? SOURCE_TRACK_Y - 20 : SOURCE_TRACK_Y;
      
      ctx.save();
      ctx.translate(cx, cy);

      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.beginPath();
      ctx.ellipse(0, 5, 25, 8, 0, 0, Math.PI*2);
      ctx.fill();

      if (this.characterMood === 'idle') {
          const breath = Math.sin(performance.now() / 500) * 0.02;
          ctx.scale(1 + breath, 1 - breath);
      }
      if (this.characterMood === 'dizzy') {
          ctx.translate(Math.random()*4 - 2, Math.random()*4 - 2);
      }

      const furColor = '#cbd5e1';
      const secondaryColor = '#94a3b8';

      ctx.fillStyle = furColor;
      ctx.beginPath();
      ctx.ellipse(0, -20, 25, 30, 0, 0, Math.PI * 2); // Torso
      ctx.fill();

      ctx.beginPath(); ctx.arc(-15, 0, 8, 0, Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.arc(15, 0, 8, 0, Math.PI*2); ctx.fill();

      ctx.translate(0, -40);
      ctx.fillStyle = furColor;
      ctx.beginPath();
      ctx.arc(0, 0, 25, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = secondaryColor;
      ctx.beginPath(); ctx.moveTo(-15, -15); ctx.lineTo(-25, -40); ctx.lineTo(-5, -20); ctx.fill();
      ctx.beginPath(); ctx.moveTo(15, -15); ctx.lineTo(25, -40); ctx.lineTo(5, -20); ctx.fill();

      let isMeowing = false;
      if (this.gameMode === 'CAT_MODE') {
          const tapeX = this.getTapeXAtPlayhead();
          const seg = this.sourceSegments.find(s => tapeX >= s.x && tapeX < s.x + s.width);
          if (seg && seg.color === this.targetColor && this.currentSpeed !== 0) {
              isMeowing = true;
          }
      }

      ctx.fillStyle = '#334155';
      if (this.characterMood === 'dizzy') {
          ctx.font = '16px sans-serif'; ctx.textAlign = 'center';
          ctx.fillText('x  x', 0, 5);
      } else if (this.characterMood === 'happy') {
           ctx.beginPath(); ctx.arc(-8, 0, 4, Math.PI, 0); ctx.stroke();
           ctx.beginPath(); ctx.arc(8, 0, 4, Math.PI, 0); ctx.stroke();
      } else if (this.characterMood === 'worried') {
           ctx.beginPath(); ctx.arc(-8, 4, 2, 0, Math.PI * 2); ctx.fill();
           ctx.beginPath(); ctx.arc(8, 4, 2, 0, Math.PI * 2); ctx.fill();
           ctx.fillStyle = '#60a5fa'; ctx.beginPath(); ctx.arc(18, -8, 3, 0, Math.PI*2); ctx.fill();
      } else {
           if (isMeowing) {
               ctx.beginPath(); ctx.arc(-8, 0, 4, Math.PI, 0); ctx.stroke();
               ctx.beginPath(); ctx.arc(8, 0, 4, Math.PI, 0); ctx.stroke();
           } else {
               ctx.beginPath(); ctx.arc(-8, 0, 3, 0, Math.PI * 2); ctx.fill();
               ctx.beginPath(); ctx.arc(8, 0, 3, 0, Math.PI * 2); ctx.fill();
           }
      }

      ctx.fillStyle = '#f472b6';
      ctx.beginPath(); ctx.ellipse(0, 8, 3, 2, 0, 0, Math.PI*2); ctx.fill();

      if (isMeowing || this.characterMood === 'happy') {
           ctx.fillStyle = '#f472b6'; 
           ctx.beginPath();
           ctx.arc(0, 15, 6, 0, Math.PI * 2);
           ctx.fill();
           ctx.strokeStyle = '#334155';
           ctx.lineWidth = 1;
           ctx.stroke();
      } else if (this.characterMood === 'worried') {
           ctx.strokeStyle = '#334155'; ctx.lineWidth = 2;
           ctx.beginPath(); ctx.moveTo(-4, 15); ctx.quadraticCurveTo(0, 12, 4, 15); ctx.stroke();
      } else {
           ctx.strokeStyle = '#334155'; ctx.lineWidth = 2;
           ctx.beginPath(); ctx.moveTo(0, 10); ctx.lineTo(-3, 14);
           ctx.moveTo(0, 10); ctx.lineTo(3, 14); ctx.stroke();
      }

      ctx.restore();
  }

  drawWaveform(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, isMeow: boolean) {
      ctx.save();
      ctx.beginPath();
      ctx.rect(x, y, w, h);
      ctx.clip();
      
      ctx.fillStyle = '#1e293b'; 
      ctx.fillRect(x, y, w, h);
      
      ctx.strokeStyle = '#475569';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x, y + h/2);
      ctx.lineTo(x + w, y + h/2);
      ctx.stroke();

      if (isMeow) {
          ctx.strokeStyle = '#10b981';
          ctx.lineWidth = 2;
          ctx.beginPath();
          
          const midY = y + h/2;
          for (let i = 0; i < w; i+=2) {
              const progress = i/w;
              const envelope = Math.sin(progress * Math.PI); 
              const noise = Math.random() * envelope * (h/2 - 2);
              
              ctx.moveTo(x + i, midY - noise);
              ctx.lineTo(x + i, midY + noise);
          }
          ctx.stroke();
      } else {
          ctx.strokeStyle = '#334155';
          ctx.lineWidth = 1;
          ctx.beginPath();
          const midY = y + h/2;
          for (let i = 0; i < w; i+=4) {
               const noise = Math.random() * 2;
               ctx.moveTo(x + i, midY - noise);
               ctx.lineTo(x + i, midY + noise);
          }
          ctx.stroke();
      }

      ctx.restore();
      // Removed strokeRect to remove vertical lines
  }

  drawSourceTrack() {
      const ctx = this.ctx;
      const isCat = this.gameMode === 'CAT_MODE';
      
      const vidY = isCat ? SOURCE_TRACK_Y - 20 : SOURCE_TRACK_Y;
      const vidH = isCat ? TRACK_HEIGHT_COMPACT : TRACK_HEIGHT;
      const audY = AUDIO_TRACK_Y; 
      const audH = TRACK_HEIGHT_COMPACT;

      ctx.fillStyle = '#94a3b8';
      ctx.font = 'bold 12px sans-serif';
      ctx.fillText(isCat ? "VIDEO" : "SOURCE MONITOR", 10, vidY - 10);
      if (isCat) {
          ctx.fillText("AUDIO", 10, audY - 10);
      }

      ctx.fillStyle = '#1e293b';
      ctx.fillRect(0, vidY, this.width, vidH);
      if (isCat) ctx.fillRect(0, audY, this.width, audH);

      const visibleStart = -this.conveyorOffset - SEGMENT_MAX_WIDTH;
      const visibleEnd = this.width - this.conveyorOffset;

      this.sourceSegments.forEach(seg => {
          if (seg.x + seg.width < visibleStart || seg.x > visibleEnd) return;
          const screenX = seg.x + this.conveyorOffset;
          
          if (isCat) {
              // Restore Cat Faces for Video Track
              this.drawCatSegment(ctx, screenX, vidY + 4, seg.width, vidH - 8, seg.color === this.targetColor);
              
              // Waveform Track
              const isMeow = seg.color === this.targetColor;
              this.drawWaveform(ctx, screenX, audY + 4, seg.width, audH - 8, isMeow);

          } else {
              // Standard Mode
              ctx.fillStyle = seg.color;
              ctx.beginPath();
              ctx.roundRect(screenX + 1, vidY + 4, seg.width - 2, vidH - 8, 6);
              ctx.fill();
              ctx.fillStyle = 'rgba(255,255,255,0.1)'; ctx.fillRect(screenX + 1, vidY + 4, seg.width - 2, vidH/2);
              ctx.fillStyle = 'rgba(0,0,0,0.2)'; ctx.fillRect(screenX + 4, vidY + vidH - 24, seg.width - 8, 16);
          }
      });

      const markTopY = isCat ? vidY : SOURCE_TRACK_Y;
      const markTotalH = isCat ? (audY + audH - vidY) : TRACK_HEIGHT;

      if (this.markIn !== null) this.drawMark(this.markIn + this.conveyorOffset, markTopY, markTotalH, true);
      if (this.markOut !== null) this.drawMark(this.markOut + this.conveyorOffset, markTopY, markTotalH, false);
      
      if (this.markIn !== null && this.markOut !== null) {
          const sX = this.markIn + this.conveyorOffset;
          const eX = this.markOut + this.conveyorOffset;
          ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
          ctx.fillRect(sX, markTopY, eX - sX, markTotalH);
          ctx.fillStyle = '#fff'; ctx.font = '10px monospace';
          const dur = Math.round(this.markOut - this.markIn);
          ctx.fillText(`${dur}ms`, sX + (eX-sX)/2 - 15, markTopY + markTotalH/2);
      }
  }
  
  drawMark(x: number, y: number, h: number, isIn: boolean) {
      const ctx = this.ctx;
      ctx.shadowBlur = 4; ctx.shadowColor = '#fbbf24'; ctx.strokeStyle = '#fbbf24'; 
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(x, y - 5); ctx.lineTo(x, y + h + 5); ctx.stroke();
      
      ctx.fillStyle = '#fbbf24';
      ctx.beginPath();
      if (isIn) { ctx.moveTo(x, y-5); ctx.lineTo(x+10, y-5); ctx.lineTo(x, y+10); } 
      else { ctx.moveTo(x, y-5); ctx.lineTo(x-10, y-5); ctx.lineTo(x, y+10); }
      ctx.fill();
      ctx.shadowBlur = 0;
  }

  drawSequenceTrack() {
      const ctx = this.ctx;
      const y = SEQUENCE_TRACK_Y;
      const h = TRACK_HEIGHT;
      
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(0, y, this.width, h);
      
      ctx.fillStyle = '#94a3b8';
      ctx.font = 'bold 12px sans-serif';
      ctx.fillText("TIMELINE", 10, y - 10);

      let currentX = 50; 
      this.sequenceClips.forEach((clip, idx) => {
          if (this.gameMode === 'CAT_MODE') {
               ctx.fillStyle = '#475569';
               ctx.fillRect(currentX + 1, y + 4, clip.width - 2, h - 8);
               ctx.strokeStyle = '#10b981';
               ctx.beginPath();
               for(let i=0; i<clip.width-2; i+=4) {
                   ctx.moveTo(currentX + 1 + i, y + h/2 - 5);
                   ctx.lineTo(currentX + 1 + i, y + h/2 + 5);
               }
               ctx.stroke();
               ctx.fillStyle = '#fff';
               ctx.fillText(`MEOW_${idx + 1}`, currentX + 8, y + 20);

          } else {
              ctx.fillStyle = clip.color;
              ctx.beginPath(); ctx.roundRect(currentX + 1, y + 4, clip.width - 2, h - 8, 6); ctx.fill();
              ctx.fillStyle = 'rgba(255,255,255,0.1)'; ctx.fillRect(currentX + 1, y + 4, clip.width - 2, h/2);
              ctx.fillStyle = 'rgba(255,255,255,0.8)'; ctx.font = '10px sans-serif';
              ctx.fillText(`CLIP_${idx + 1}`, currentX + 8, y + 20);
          }
          currentX += clip.width;
      });
  }

  drawPlayheadLine() {
      const ctx = this.ctx;
      const cx = this.width / 2;
      
      ctx.shadowBlur = 4;
      ctx.shadowColor = 'rgba(239, 68, 68, 0.5)';
      ctx.strokeStyle = '#ef4444';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(cx, SOURCE_TRACK_Y - 20); 
      ctx.lineTo(cx, SEQUENCE_TRACK_Y + TRACK_HEIGHT);
      ctx.stroke();
      ctx.shadowBlur = 0;
  }

  drawParticles() {
      const ctx = this.ctx;
      this.particles.forEach(p => {
          ctx.save();
          ctx.globalAlpha = Math.max(0, p.life);
          ctx.translate(p.x, p.y);
          ctx.fillStyle = p.color;

          if (p.type === 'star') {
              ctx.beginPath();
              for(let i=0; i<5; i++) {
                  const angle = (18 + i * 72) * Math.PI / 180;
                  const angle2 = (54 + i * 72) * Math.PI / 180;
                  ctx.lineTo(Math.cos(angle) * 8, -Math.sin(angle) * 8);
                  ctx.lineTo(Math.cos(angle2) * 3, -Math.sin(angle2) * 3);
              }
              ctx.closePath();
              ctx.fill();
          } else if (p.type === 'heart') {
              ctx.beginPath();
              const s = 0.5;
              ctx.moveTo(0, -5*s);
              ctx.bezierCurveTo(-5*s, -15*s, -15*s, -5*s, 0, 10*s);
              ctx.bezierCurveTo(15*s, -5*s, 5*s, -15*s, 0, -5*s);
              ctx.fill();
          } else {
              ctx.beginPath();
              ctx.arc(0, 0, 2, 0, Math.PI * 2);
              ctx.fill();
          }
          ctx.restore();
      });
  }
  
  drawHUD() {
      const ctx = this.ctx;
      
      if (this.currentSpeed !== 0) {
          ctx.save();
          const hudY = this.gameMode === 'CAT_MODE' ? SOURCE_TRACK_Y - 50 : SOURCE_TRACK_Y - 30;
          ctx.translate(this.width / 2, hudY);
          
          ctx.fillStyle = 'rgba(30, 41, 59, 0.8)';
          ctx.strokeStyle = '#475569';
          ctx.beginPath();
          ctx.roundRect(-40, -15, 80, 30, 8);
          ctx.fill();
          ctx.stroke();
          
          ctx.fillStyle = '#fff';
          ctx.font = 'bold 16px monospace';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          
          let valStr = "";
          if (Math.abs(this.currentSpeed) < 1) valStr = Math.abs(this.currentSpeed).toFixed(1) + "x";
          else valStr = Math.abs(this.currentSpeed) + "x";

          const dir = this.currentSpeed > 0 ? '▶' : '◀';
          ctx.fillText(`${dir} ${valStr}`, 0, 1);
          ctx.restore();
      }
  }
}

const GameCanvas: React.FC<GameCanvasProps> = ({ 
  gameState, 
  setGameState,
  targetColor,
  setScore,
  setPenaltyCount,
  setFinalScore,
  gameRef,
  gameMode
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    gameRef.current = new GameEngine(
        ctx, 
        CANVAS_WIDTH, 
        CANVAS_HEIGHT,
        (s) => setScore(s),
        (p) => setPenaltyCount(p),
        (s) => setFinalScore(s),
        () => setGameState(GameState.GAME_OVER),
        () => setGameState(GameState.WON)
    );
    
    gameRef.current.draw();
  }, []);

  useEffect(() => {
    if (gameState === GameState.PLAYING && gameRef.current) {
        gameRef.current.initAudio();
    }
  }, [gameState]);

  useEffect(() => {
    let animationFrameId: number;
    const render = (time: number) => {
      if (gameRef.current) {
          if (gameState === GameState.PLAYING) {
             gameRef.current.update(time);
          }
          gameRef.current.draw();
      }
      animationFrameId = requestAnimationFrame(render);
    };
    
    animationFrameId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animationFrameId);
  }, [gameState]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (gameState !== GameState.PLAYING) return;
      if (!gameRef.current) return;
      gameRef.current.handleKeyDown(e.key.toLowerCase());
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (!gameRef.current) return;
      gameRef.current.handleKeyUp(e.key.toLowerCase());
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [gameState]);

  return (
    <div className="flex justify-center items-center h-screen bg-zinc-950 shadow-2xl">
      <canvas
        ref={canvasRef}
        width={CANVAS_WIDTH}
        height={CANVAS_HEIGHT}
        className="rounded-xl shadow-black shadow-2xl bg-slate-900 border border-slate-800"
      />
    </div>
  );
};

export default GameCanvas;