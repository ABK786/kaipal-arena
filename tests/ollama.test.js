import { afterEach, describe, expect, it, vi } from 'vitest';
import ollama from '../electron/adapters/ollama.cjs';

afterEach(() => vi.unstubAllGlobals());

describe('OllamaAdapter', () => {
  it('discovers locally installed models', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
      models: [{ name: 'qwen:3b', size: 123, modified_at: '2026-01-01', details: { family: 'qwen', parameter_size: '3B' } }],
    }), { status: 200 })));
    const models = await new ollama.OllamaAdapter().listModels('http://127.0.0.1:11434');
    expect(models[0]).toMatchObject({ id: 'qwen:3b', family: 'qwen', parameterSize: '3B' });
  });

  it('returns chat content', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ message: { content: 'Local answer' } }), { status: 200 })));
    const answer = await new ollama.OllamaAdapter().chat({
      endpoint: 'http://localhost:11434', model: 'test', messages: [{ role: 'user', content: 'Hi' }],
    });
    expect(answer).toBe('Local answer');
  });

  it('rejects non-loopback endpoints', async () => {
    await expect(new ollama.OllamaAdapter().listModels('https://example.com')).rejects.toThrow('only connects to localhost');
  });

  it('surfaces Ollama HTTP errors', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: 'model missing' }), { status: 404 })));
    await expect(new ollama.OllamaAdapter().chat({
      endpoint: 'http://127.0.0.1:11434', model: 'missing', messages: [{ role: 'user', content: 'Hi' }],
    })).rejects.toThrow('model missing');
  });
});

describe('OllamaAdapter audit fixes', () => {
  it('never offers Ollama cloud models or embedding models', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
      models: [
        { name: 'kimi-k3:cloud', size: 308, remote_host: 'https://ollama.com', remote_model: 'kimi-k3' },
        { name: 'gpt-oss:120b-cloud', size: 307 },
        { name: 'nomic-embed-text:latest', size: 274302450, details: { family: 'nomic-bert' } },
        { name: 'kohenoor/kai-lite2:latest', size: 1274402111, details: { family: 'qwen35', parameter_size: '2B' } },
      ],
    }), { status: 200 })));
    const models = await new ollama.OllamaAdapter().listModels('http://127.0.0.1:11434');
    expect(models.map((m) => m.id)).toEqual(['kohenoor/kai-lite2:latest']);
  });

  it('asks again without thinking when a model does not support it', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ error: '"x" does not support thinking' }), { status: 400 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ message: { content: 'Plain answer' } }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    const answer = await new ollama.OllamaAdapter().chat({
      endpoint: 'http://127.0.0.1:11434', model: 'x', messages: [{ role: 'user', content: 'Hi' }], think: true,
    });
    expect(answer).toBe('Plain answer');
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).think).toBe(true);
    expect(JSON.parse(fetchMock.mock.calls[1][1].body)).not.toHaveProperty('think');
  });

  it('Stop cancels a running request', async () => {
    vi.stubGlobal('fetch', vi.fn((_url, { signal }) => new Promise((_resolve, reject) => {
      signal.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' })));
    })));
    const controller = new AbortController();
    const pending = new ollama.OllamaAdapter().chat({
      endpoint: 'http://127.0.0.1:11434', model: 'x', messages: [{ role: 'user', content: 'Hi' }], signal: controller.signal,
    });
    controller.abort();
    await expect(pending).rejects.toMatchObject({ name: 'CancelledError' });
  });
});

it('explains an answer lost to thinking instead of a bare empty-response error', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ message: { content: '', thinking: 'Let me think...' } }), { status: 200 })));
  await expect(new ollama.OllamaAdapter().chat({
    endpoint: 'http://127.0.0.1:11434', model: 'x', messages: [{ role: 'user', content: 'Hi' }], think: true,
  })).rejects.toThrow('Raise Max output tokens');
});
