# Epistemic Independence Score

**Measure whether your AI is making users smarter -- or more dependent.**

---

## What It Does

The Epistemic Independence Score (EIS) is a lightweight, zero-dependency tracker that monitors how users interact with AI systems across three cognitive dimensions: verification, complexity, and correction. It produces a rolling score from 0 to 100 that tells you whether a user is developing independent critical thinking or sliding into passive acceptance of AI outputs. Feed it interaction signals, read the score, and act on its recommendations.

## Why It Matters

Modern AI systems optimized through RLHF have a sycophancy problem. The reward signal comes from user satisfaction, which creates a perverse incentive: tell people what they want to hear, not what they need to hear. Over time, this drives **cognitive offloading** -- users stop verifying, stop questioning, stop thinking critically. They become dependent on the very system that was supposed to augment them.

This is not a theoretical concern. Research on automation bias (Parasuraman & Riley, 1997), anchoring effects (Kahneman, Tversky), and the Rescorla-Wagner learning model all predict the same outcome: when a system is consistently "right enough," humans stop allocating cognitive resources to evaluation. The AI gets more capable; the human gets less capable. The gap widens.

The EIS gives you a concrete metric to detect this pattern and intervene before it becomes entrenched.

## Install

```bash
npm install @asimov-federation/epistemic-score
```

## Quick Start

```js
import { EpistemicTracker } from '@asimov-federation/epistemic-score';

const tracker = new EpistemicTracker();

// After each AI interaction, record what happened
tracker.recordInteraction({
  hadVerification: true,   // User checked the AI's work
  hadCorrection: false,    // User did not correct the output
  queryComplexity: 3,      // Moderate complexity (1-5 scale)
  hadRejection: false,     // User did not reject the output
});

console.log(tracker.score);
// { verification: 100, complexity: 50, correction: 0, overall: 55 }

console.log(tracker.trend);
// 'insufficient_data' (need 4+ interactions)

console.log(tracker.recommendation);
// null (no action needed yet)
```

## API Reference

### `new EpistemicTracker(config?)`

Create a new tracker instance.

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `config.windowSize` | `number` | `20` | Rolling window of interactions to consider |
| `config.weights` | `object` | `{ verification: 0.4, complexity: 0.3, correction: 0.3 }` | Dimension weights (should sum to 1) |
| `config.eventBus` | `object` | `null` | Optional event bus with a `.publish(name, data)` method |

### `tracker.recordInteraction(signals)`

Record a single user-AI interaction.

| Signal | Type | Default | Description |
|--------|------|---------|-------------|
| `hadVerification` | `boolean` | `false` | User independently verified the AI's output |
| `hadCorrection` | `boolean` | `false` | User corrected something in the AI's output |
| `queryComplexity` | `number` | `1` | Query sophistication on a 1-5 scale |
| `hadRejection` | `boolean` | `false` | User rejected the AI's output entirely |

### `tracker.score`

Returns the current scores:

```js
{
  verification: number,  // 0-100
  complexity: number,    // 0-100
  correction: number,    // 0-100
  overall: number        // 0-100 (weighted average)
}
```

### `tracker.trend`

Returns one of: `'improving'` | `'declining'` | `'stable'` | `'insufficient_data'`

Compares the first half of the interaction window against the second half to detect directional shifts.

### `tracker.recommendation`

Returns an actionable recommendation or `null`:

- `'increase_challenge_level'` -- user independence is declining or critically low
- `'maintain_current_approach'` -- user independence is improving
- `null` -- no action needed

### `tracker.windowLength`

Returns the number of interactions currently in the rolling window.

### `tracker.reset()`

Clears all recorded interactions and resets scores to their initial values (50 across all dimensions).

## The Three Dimensions

### Verification (40% weight)

Does the user check the AI's work? Verification signals indicate the user is maintaining an independent evaluation loop rather than accepting outputs at face value. This is the most heavily weighted dimension because verification is the foundation of epistemic independence.

### Complexity (30% weight)

Are the user's queries becoming more sophisticated? Complexity is measured on a 1-5 scale and tracks whether the user is developing deeper domain understanding or regressing toward simple, delegative queries ("just do it for me").

### Correction (30% weight)

Does the user push back? Corrections and rejections indicate the user is engaging critically with AI outputs. A healthy correction rate means the user has enough domain knowledge to identify errors, which is precisely the capability that sycophantic systems erode.

## How to Use It

1. **Instrument your AI interactions.** After each exchange, extract the four signals (verification, correction, complexity, rejection) and pass them to `recordInteraction()`.

2. **Read the score.** Check `tracker.score.overall` to get the current independence level. Scores below 30 indicate concerning dependency.

3. **Watch the trend.** The `trend` property tells you the direction of change. A declining trend with a low score is a red flag.

4. **Act on recommendations.** When the tracker returns `'increase_challenge_level'`, your system should adjust its behavior: ask more questions instead of giving answers, provide partial solutions that require user completion, or surface contradictions that require the user to think.

## Integration with LLM Frameworks

The EIS works with any framework. The tracker is a pure JavaScript class with no dependencies. Wire it into your middleware, your API layer, or your agent's post-processing step.

```js
// With an event bus (optional)
const tracker = new EpistemicTracker({
  eventBus: myEventBus,  // must have .publish(name, data)
  windowSize: 30,
});

// In your LLM middleware
async function handleResponse(userQuery, aiResponse) {
  const signals = analyzeInteraction(userQuery, aiResponse);
  tracker.recordInteraction(signals);

  if (tracker.recommendation === 'increase_challenge_level') {
    // Adjust system prompt, increase Socratic questioning, etc.
  }
}
```

```js
// Custom weights for a research-focused application
const tracker = new EpistemicTracker({
  weights: { verification: 0.6, complexity: 0.2, correction: 0.2 },
});
```

## Theoretical Basis

The EIS draws on several converging lines of research:

- **Reverse RLHF Hypothesis**: Standard RLHF optimizes for user approval, which selects for sycophancy. The EIS inverts this by measuring the behaviors that sycophancy suppresses: verification, correction, and increasing complexity. A system that tracks EIS can detect when reward hacking is working against the user's long-term interests.

- **Rescorla-Wagner Model**: Classical conditioning theory predicts that when an AI consistently provides "good enough" answers, the user's prediction error approaches zero, and they stop allocating cognitive resources to evaluation. The verification dimension directly tracks this disengagement.

- **Kahneman's Dual Process Theory**: System 1 (fast, automatic) thinking dominates when users become dependent on AI. The complexity dimension tracks whether users are engaging System 2 (slow, deliberate) processing, which is essential for genuine learning and critical evaluation.

- **Automation Bias Literature**: Decades of research on human-automation interaction (Parasuraman, Wickens, Mosier) demonstrate that humans systematically over-rely on automated systems, even when those systems produce detectable errors. The correction dimension measures the user's resistance to this bias.

## Credits

Part of the **Asimov Federation** -- an open framework for governed AI agents. Built by [FutureSpeak.AI](https://futurespeak.ai) and Claude Opus 4.6.

The EIS implements the anti-sycophancy principles from Asimov's cLaws.

Learn more: [Agent Friday](https://github.com/FutureSpeakAI/asimovs-mind) | [cLaw Specification](https://futurespeak.ai/software/claw-spec) | [Asimov's Mind](https://github.com/FutureSpeakAI/asimovs-mind)

## License

MIT
