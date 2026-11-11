const LOOPBACK_HOSTS = new Set(['127.0.0.1', 'localhost', '::1', '[::1]']);

function assertLoopbackEndpoint(endpoint) {
  let url;
  try {
    url = new URL(endpoint);
  } catch {
    throw new Error('Enter a valid local runner URL.');
  }

  if (!LOOPBACK_HOSTS.has(url.hostname)) {
    throw new Error('For privacy, this app only connects to localhost/loopback model runners.');
  }
  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new Error('The runner URL must use HTTP or HTTPS.');
  }
  return url.origin;
}

class CancelledError extends Error {
  constructor() {
    super('Cancelled.');
    this.name = 'CancelledError';
  }
}

// `signal` lets the caller cancel a request (the Stop button); the timer still ends a stuck one.
async function fetchWithTimeout(url, options, timeoutMs, signal) {
  if (signal?.aborted) throw new CancelledError();
  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => { timedOut = true; controller.abort(); }, timeoutMs);
  const onCancel = () => controller.abort();
  signal?.addEventListener('abort', onCancel, { once: true });
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } catch (error) {
    if (error?.name === 'AbortError') {
      if (timedOut) throw new Error(`Local model request timed out after ${Math.round(timeoutMs / 1000)}s.`);
      throw new CancelledError();
    }
    throw new Error(`Could not reach the local model runner: ${error.message}`);
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', onCancel);
  }
}

module.exports = { assertLoopbackEndpoint, fetchWithTimeout, CancelledError, LOOPBACK_HOSTS };
