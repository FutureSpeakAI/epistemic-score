import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { EpistemicTracker } from './index.js';

describe('EpistemicTracker', () => {

  it('starts at score 50 across all dimensions', () => {
    const tracker = new EpistemicTracker();
    const s = tracker.score;
    assert.equal(s.verification, 50);
    assert.equal(s.complexity, 50);
    assert.equal(s.correction, 50);
    assert.equal(s.overall, 50);
  });

  it('works with zero config (defaults)', () => {
    const tracker = new EpistemicTracker();
    assert.ok(tracker);
    assert.equal(tracker.score.overall, 50);
    assert.equal(tracker.trend, 'insufficient_data');
    assert.equal(tracker.recommendation, null);
  });

  it('verification score increases when user verifies', () => {
    const tracker = new EpistemicTracker();
    for (let i = 0; i < 5; i++) {
      tracker.recordInteraction({ hadVerification: true, queryComplexity: 1 });
    }
    assert.ok(tracker.score.verification > 50, `expected verification > 50, got ${tracker.score.verification}`);
    assert.equal(tracker.score.verification, 100);
  });

  it('verification score decreases when user never verifies', () => {
    const tracker = new EpistemicTracker();
    for (let i = 0; i < 5; i++) {
      tracker.recordInteraction({ hadVerification: false, queryComplexity: 1 });
    }
    assert.equal(tracker.score.verification, 0);
  });

  it('correction score increases when user corrects', () => {
    const tracker = new EpistemicTracker();
    for (let i = 0; i < 5; i++) {
      tracker.recordInteraction({ hadCorrection: true, queryComplexity: 1 });
    }
    assert.equal(tracker.score.correction, 100);
  });

  it('correction score counts rejections too', () => {
    const tracker = new EpistemicTracker();
    for (let i = 0; i < 5; i++) {
      tracker.recordInteraction({ hadRejection: true, queryComplexity: 1 });
    }
    assert.equal(tracker.score.correction, 100);
  });

  it('complexity tracks query sophistication', () => {
    const tracker = new EpistemicTracker();
    // Record high-complexity queries (scale 1-5)
    for (let i = 0; i < 5; i++) {
      tracker.recordInteraction({ queryComplexity: 5 });
    }
    // complexity = ((5 - 1) * 25) = 100
    assert.equal(tracker.score.complexity, 100);
  });

  it('complexity stays at 0 for lowest-complexity queries', () => {
    const tracker = new EpistemicTracker();
    for (let i = 0; i < 5; i++) {
      tracker.recordInteraction({ queryComplexity: 1 });
    }
    // complexity = ((1 - 1) * 25) = 0
    assert.equal(tracker.score.complexity, 0);
  });

  it('overall score is weighted average of three dimensions', () => {
    const tracker = new EpistemicTracker();
    // All signals maxed out
    for (let i = 0; i < 5; i++) {
      tracker.recordInteraction({
        hadVerification: true,
        hadCorrection: true,
        queryComplexity: 5,
      });
    }
    // verification=100, complexity=100, correction=100 => overall=100
    assert.equal(tracker.score.overall, 100);
  });

  it('trend returns insufficient_data with fewer than 4 interactions', () => {
    const tracker = new EpistemicTracker();
    tracker.recordInteraction({ queryComplexity: 1 });
    tracker.recordInteraction({ queryComplexity: 1 });
    tracker.recordInteraction({ queryComplexity: 1 });
    assert.equal(tracker.trend, 'insufficient_data');
  });

  it('trend detects improving pattern', () => {
    const tracker = new EpistemicTracker();
    // First half: low engagement
    for (let i = 0; i < 4; i++) {
      tracker.recordInteraction({ hadVerification: false, queryComplexity: 1 });
    }
    // Second half: high engagement
    for (let i = 0; i < 4; i++) {
      tracker.recordInteraction({ hadVerification: true, queryComplexity: 5, hadCorrection: true });
    }
    assert.equal(tracker.trend, 'improving');
  });

  it('trend detects declining pattern', () => {
    const tracker = new EpistemicTracker();
    // First half: high engagement
    for (let i = 0; i < 4; i++) {
      tracker.recordInteraction({ hadVerification: true, queryComplexity: 5, hadCorrection: true });
    }
    // Second half: low engagement
    for (let i = 0; i < 4; i++) {
      tracker.recordInteraction({ hadVerification: false, queryComplexity: 1 });
    }
    assert.equal(tracker.trend, 'declining');
  });

  it('trend detects stable pattern', () => {
    const tracker = new EpistemicTracker();
    for (let i = 0; i < 8; i++) {
      tracker.recordInteraction({ hadVerification: true, queryComplexity: 3 });
    }
    assert.equal(tracker.trend, 'stable');
  });

  it('recommendation triggers on declining score', () => {
    const tracker = new EpistemicTracker();
    // Create declining pattern
    for (let i = 0; i < 4; i++) {
      tracker.recordInteraction({ hadVerification: true, queryComplexity: 5, hadCorrection: true });
    }
    for (let i = 0; i < 4; i++) {
      tracker.recordInteraction({ hadVerification: false, queryComplexity: 1 });
    }
    assert.equal(tracker.recommendation, 'increase_challenge_level');
  });

  it('recommendation returns maintain on improving trend', () => {
    const tracker = new EpistemicTracker();
    for (let i = 0; i < 4; i++) {
      tracker.recordInteraction({ hadVerification: false, queryComplexity: 1 });
    }
    for (let i = 0; i < 4; i++) {
      tracker.recordInteraction({ hadVerification: true, queryComplexity: 5, hadCorrection: true });
    }
    assert.equal(tracker.recommendation, 'maintain_current_approach');
  });

  it('recommendation triggers when overall score is very low', () => {
    const tracker = new EpistemicTracker();
    // Stable but very low -- all zero signals, 8 interactions for stable trend
    for (let i = 0; i < 8; i++) {
      tracker.recordInteraction({ queryComplexity: 1 });
    }
    // Score should be near 0, trend stable
    assert.ok(tracker.score.overall < 30, `expected overall < 30, got ${tracker.score.overall}`);
    assert.equal(tracker.recommendation, 'increase_challenge_level');
  });

  it('window caps at configured size', () => {
    const tracker = new EpistemicTracker({ windowSize: 5 });
    for (let i = 0; i < 10; i++) {
      tracker.recordInteraction({ queryComplexity: 3 });
    }
    assert.equal(tracker.windowLength, 5);
  });

  it('default window caps at 20', () => {
    const tracker = new EpistemicTracker();
    for (let i = 0; i < 30; i++) {
      tracker.recordInteraction({ queryComplexity: 2 });
    }
    assert.equal(tracker.windowLength, 20);
  });

  it('reset clears state back to defaults', () => {
    const tracker = new EpistemicTracker();
    for (let i = 0; i < 10; i++) {
      tracker.recordInteraction({ hadVerification: true, queryComplexity: 5, hadCorrection: true });
    }
    assert.notEqual(tracker.score.overall, 50);
    tracker.reset();
    assert.equal(tracker.score.overall, 50);
    assert.equal(tracker.score.verification, 50);
    assert.equal(tracker.windowLength, 0);
    assert.equal(tracker.trend, 'insufficient_data');
  });

  it('optional event bus receives updates on significant changes', () => {
    const events = [];
    const bus = { publish: (name, data) => events.push({ name, data }) };
    const tracker = new EpistemicTracker({ eventBus: bus });

    // Record interactions that create a big enough score shift from 50
    for (let i = 0; i < 5; i++) {
      tracker.recordInteraction({ hadVerification: true, queryComplexity: 5, hadCorrection: true });
    }
    assert.ok(events.length > 0, 'event bus should have received at least one update');
    assert.equal(events[0].name, 'eis:updated');
    assert.ok(events[0].data.score);
    assert.ok(events[0].data.trend);
  });

  it('works without event bus (no errors)', () => {
    const tracker = new EpistemicTracker();
    // This should not throw
    for (let i = 0; i < 10; i++) {
      tracker.recordInteraction({ hadVerification: true, queryComplexity: 5, hadCorrection: true });
    }
    assert.ok(tracker.score.overall > 0);
  });

  it('accepts custom weights', () => {
    const tracker = new EpistemicTracker({
      weights: { verification: 1.0, complexity: 0.0, correction: 0.0 }
    });
    for (let i = 0; i < 5; i++) {
      tracker.recordInteraction({ hadVerification: true, queryComplexity: 1 });
    }
    // With 100% weight on verification, overall should equal verification
    assert.equal(tracker.score.overall, tracker.score.verification);
    assert.equal(tracker.score.overall, 100);
  });

  it('handles empty signal objects gracefully', () => {
    const tracker = new EpistemicTracker();
    tracker.recordInteraction({});
    tracker.recordInteraction();
    assert.equal(tracker.windowLength, 2);
    assert.equal(tracker.score.verification, 0);
    assert.equal(tracker.score.correction, 0);
    assert.equal(tracker.score.complexity, 0);
  });

});
