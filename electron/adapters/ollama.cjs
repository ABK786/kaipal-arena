const { assertLoopbackEndpoint, fetchWithTimeout } = require('./base.cjs');

// Ollama can list "cloud" models (for example `kimi-k3:cloud`, `gpt-oss:120b-cloud`) that run on ollama.com.
// Sending a prompt to one would break the on-device promise, so they are never offered or accepted.
function isCloudModel(model) {
  return Boolean(model?.remote_host || model?.remote_model) || /[:-]cloud$/i.test(String(model?.name ?? ''));
}

// Embedding models cannot chat; selecting one would only fail.
function isEmbeddingModel(model) {
  const family = String(model?.details?.family ?? '').toLowerCase();
  const families = (model?.details?.families ?? []).map((f) => String(f).toLowerCase());
  return /embed/i.test(String(model?.name ?? '')) || [family, ...families].some((f) => f.includes('bert'));
}

class OllamaAdapter {
  id = 'ollama';
  label = 'Ollama';

  validateEndpoint(endpoint) {
    return assertLoopbackEndpoint(endpoint);
  }

  async listModels(endpoint, timeoutMs = 10_000) {
    const origin = this.validateEndpoint(endpoint);
    const response = await fetchWithTimeout(`${origin}/api/tags`, { method: 'GET' }, timeoutMs);
    if (!response.ok) throw new Error(`Ollama returned HTTP ${response.status} while discovering models.`);
    const payload = await response.json();
    return (payload.models ?? [])
      .filter((model) => model?.name && !isCloudModel(model) && !isEmbeddingModel(model))
      .map((model) => ({
        id: model.name,
        name: model.name,
        size: model.size ?? 0,
        modifiedAt: model.modified_at ?? null,
        family: model.details?.family ?? null,
        parameterSize: model.details?.parameter_size ?? null,
      }));
  }

  async chat({ endpoint, model, messages, timeoutMs = 300_000, options = {}, think, signal }) {
    const origin = this.validateEndpoint(endpoint);
    const send = (withThink) => fetchWithTimeout(
      `${origin}/api/chat`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model, messages, stream: false, options, ...(withThink && typeof think === 'boolean' ? { think } : {}) }),
      },
      timeoutMs,
      signal,
    );

    let response = await send(true);
    let detail = '';
    if (!response.ok) {
      detail = await readError(response);
      // A model without thinking support rejects the `think` field; ask again without it.
      if (typeof think === 'boolean' && /think/i.test(detail)) {
        response = await send(false);
        detail = response.ok ? '' : await readError(response);
      }
    }
    if (!response.ok) throw new Error(`Ollama returned HTTP ${response.status}${detail ? `: ${detail}` : '.'}`);
    const payload = await response.json();
    const content = payload.message?.content?.trim();
    if (!content && payload.message?.thinking?.trim()) {
      // Thinking counts toward the output limit; a small limit can be used up before the answer starts.
      throw new Error('The model used its whole output limit thinking and gave no answer. Raise Max output tokens in Settings, or turn thinking mode off.');
    }
    if (!content) throw new Error('The model returned an empty response.');
    return content;
  }
}

async function readError(response) {
  try {
    return String((await response.json()).error ?? '');
  } catch {
    return '';
  }
}

module.exports = { OllamaAdapter, isCloudModel, isEmbeddingModel };
