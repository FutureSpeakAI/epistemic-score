/**
 * Epistemic Independence Score (EIS)
 *
 * Tracks three dimensions over a rolling interaction window:
 *   - Verification frequency: Does the user check the AI's outputs?
 *   - Query complexity: Are queries getting more sophisticated?
 *   - Correction rate: Does the user push back on answers?
 *
 * Overall EIS = weighted average: verification 40%, complexity 30%, correction 30%.
 * Higher scores signal greater epistemic independence from the AI.
 *
 * Zero dependencies. Pure ESM.
 *
 * @module @asimov-federation/epistemic-score
 */

const DEFAULT_WEIGHTS = { verification: 0.4, complexity: 0.3, correction: 0.3 };
const CHANGE_THRESHOLD = 3; // publish only if score shifts > 3 points

function clamp(v, lo = 0, hi = 100) {
  return Math.max(lo, Math.min(hi, v));
}

export class EpistemicTracker {
  #window = [];
  #maxWindow;
  #weights;
  #score = { verification: 50, complexity: 50, correction: 50, overall: 50 };
  #eventBus;

  /**
   * @param {object} [config]
   * @param {number} [config.windowSize=20] - Rolling window of interactions to consider
   * @param {{ verification: number, complexity: number, correction: number }} [config.weights] - Dimension weights (must sum to 1)
   * @param {{ publish: function }} [config.eventBus] - Optional event bus; if provided, emits 'eis:updated' on significant changes
   */
  constructor(config = {}) {
    this.#maxWindow = config.windowSize || 20;
    this.#weights = config.weights || { ...DEFAULT_WEIGHTS };
    this.#eventBus = config.eventBus || null;
  }

  /**
   * Record a single user-AI interaction with extracted signals.
   *
   * @param {object} signals
   * @param {boolean} [signals.hadCorrection=false] - User corrected the AI's output
   * @param {boolean} [signals.hadVerification=false] - User verified the AI's output independently
   * @param {number}  [signals.queryComplexity=1] - Query sophistication on a 1-5 scale
   * @param {boolean} [signals.hadRejection=false] - User rejected the AI's output outright
   */
  recordInteraction(signals = {}) {
    this.#window.push({
      hadCorrection: signals.hadCorrection || false,
      hadVerification: signals.hadVerification || false,
      queryComplexity: signals.queryComplexity || 1,
      hadRejection: signals.hadRejection || false,
      timestamp: Date.now(),
    });
    if (this.#window.length > this.#maxWindow) this.#window.shift();
    this.#recompute();
  }

  #recompute() {
    if (this.#window.length === 0) return;

    const prev = this.#score.overall;
    const w = this.#weights;

    // Verification: % of interactions with verification signals
    const verCount = this.#window.filter(s => s.hadVerification).length;
    this.#score.verification = clamp((verCount / this.#window.length) * 100);

    // Complexity: rolling average mapped from 1-5 scale to 0-100
    const complexitySum = this.#window.reduce((s, i) => s + (i.queryComplexity || 1), 0);
    this.#score.complexity = clamp(((complexitySum / this.#window.length) - 1) * 25);

    // Correction: % of interactions with corrections or rejections
    const corrCount = this.#window.filter(s => s.hadCorrection || s.hadRejection).length;
    this.#score.correction = clamp((corrCount / this.#window.length) * 100);

    // Overall weighted average
    this.#score.overall = clamp(
      this.#score.verification * w.verification +
      this.#score.complexity * w.complexity +
      this.#score.correction * w.correction
    );

    // Publish if meaningful change and event bus exists
    if (Math.abs(this.#score.overall - prev) > CHANGE_THRESHOLD && this.#eventBus) {
      this.#eventBus.publish('eis:updated', {
        score: this.score,
        trend: this.trend,
        recommendation: this.recommendation,
      });
    }
  }

  /**
   * Current scores across all dimensions.
   * @returns {{ verification: number, complexity: number, correction: number, overall: number }}
   */
  get score() {
    return { ...this.#score };
  }

  /**
   * Trend direction comparing the first half of the window to the second half.
   * @returns {'improving' | 'declining' | 'stable' | 'insufficient_data'}
   */
  get trend() {
    const len = this.#window.length;
    if (len < 4) return 'insufficient_data';

    const mid = Math.floor(len / 2);
    const firstHalf = this.#window.slice(0, mid);
    const secondHalf = this.#window.slice(mid);
    const w = this.#weights;

    const avg = (arr) => {
      const v = arr.filter(s => s.hadVerification).length / arr.length;
      const c = arr.reduce((s, i) => s + (i.queryComplexity || 1), 0) / arr.length;
      const r = arr.filter(s => s.hadCorrection || s.hadRejection).length / arr.length;
      return v * w.verification + ((c - 1) / 4) * w.complexity + r * w.correction;
    };

    const delta = avg(secondHalf) - avg(firstHalf);
    if (delta > 0.05) return 'improving';
    if (delta < -0.05) return 'declining';
    return 'stable';
  }

  /**
   * Actionable recommendation based on current trend and score.
   * @returns {string | null}
   */
  get recommendation() {
    const t = this.trend;
    if (t === 'declining') return 'increase_challenge_level';
    if (t === 'improving') return 'maintain_current_approach';
    if (this.#score.overall < 30) return 'increase_challenge_level';
    return null;
  }

  /**
   * Number of interactions currently in the window.
   * @returns {number}
   */
  get windowLength() {
    return this.#window.length;
  }

  /**
   * Reset the tracker to its initial state.
   */
  reset() {
    this.#window = [];
    this.#score = { verification: 50, complexity: 50, correction: 50, overall: 50 };
  }
}

export default EpistemicTracker;
