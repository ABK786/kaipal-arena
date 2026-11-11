import { describe, expect, it } from 'vitest';
import runtime from '../electron/runtime-options.cjs';

describe('runtime option validation', () => {
  it('maps UI names to Ollama option names', () => {
    expect(runtime.normalizeRuntimeOptions({
      temperature: 0.4,
      topP: 0.8,
      topK: 32,
      repeatPenalty: 1.2,
      maxTokens: 2048,
      seed: '7',
      thinking: true,
    })).toEqual({
      options: {
        temperature: 0.4,
        top_p: 0.8,
        top_k: 32,
        repeat_penalty: 1.2,
        num_predict: 2048,
        seed: 7,
      },
      think: true,
    });
  });

  it('clamps unsafe or out-of-range input', () => {
    const result = runtime.normalizeRuntimeOptions({ temperature: 9, topP: -1, topK: 999, maxTokens: 0 });
    expect(result.options).toMatchObject({ temperature: 2, top_p: 0, top_k: 200, num_predict: 1 });
  });

  it('uses stable defaults for invalid values', () => {
    const result = runtime.normalizeRuntimeOptions({ temperature: 'bad', seed: '' });
    expect(result.options.temperature).toBe(0.7);
    expect(result.options).not.toHaveProperty('seed');
    expect(result.think).toBe(false);
  });
});

describe('run controls (audit fixes)', () => {
  it('limits the time per model to 30 s to 30 min, default 5 min', () => {
    expect(runtime.normalizeRunControls({})).toEqual({ timeoutMs: 300_000, sequential: false });
    expect(runtime.normalizeRunControls({ timeoutSec: 5 }).timeoutMs).toBe(30_000);
    expect(runtime.normalizeRunControls({ timeoutSec: 99999, sequential: true })).toEqual({ timeoutMs: 1_800_000, sequential: true });
  });
});
