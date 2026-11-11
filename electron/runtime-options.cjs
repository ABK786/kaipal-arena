function clamp(value, min, max, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(min, Math.min(max, parsed)) : fallback;
}

function normalizeRuntimeOptions(input = {}) {
  const seedValue = input.seed === '' || input.seed == null ? undefined : Math.trunc(Number(input.seed));
  return {
    options: {
      temperature: clamp(input.temperature, 0, 2, 0.7),
      top_p: clamp(input.topP, 0, 1, 0.9),
      top_k: Math.round(clamp(input.topK, 0, 200, 40)),
      repeat_penalty: clamp(input.repeatPenalty, 0.1, 2, 1.1),
      num_predict: Math.round(clamp(input.maxTokens, 1, 8192, 1024)),
      ...(Number.isFinite(seedValue) ? { seed: seedValue } : {}),
    },
    think: Boolean(input.thinking),
  };
}

// How a comparison runs: the time each model may take, and whether models run one after another
// (kinder to computers that cannot hold several models in memory at once).
function normalizeRunControls(input = {}) {
  return {
    timeoutMs: Math.round(clamp(input.timeoutSec, 30, 1800, 300)) * 1000,
    sequential: Boolean(input.sequential),
  };
}

module.exports = { clamp, normalizeRuntimeOptions, normalizeRunControls };
