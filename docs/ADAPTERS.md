# Local runner adapters

The desktop main process owns model-runner communication. The React renderer only receives the narrow methods exposed by `electron/preload.cjs`, so adding a runner does not expose Node.js or arbitrary network access to the UI.

## Adapter contract

An adapter has four members:

```js
class ExampleAdapter {
  id = 'example';
  label = 'Example local runner';

  validateEndpoint(endpoint) {}
  async listModels(endpoint, timeoutMs) {}
  async chat({ endpoint, model, messages, timeoutMs, options }) {}
}
```

`listModels` returns objects with `id`, `name`, `size`, `modifiedAt`, `family`, and `parameterSize`. `chat` returns a non-empty response string. Both should throw helpful `Error` objects for connection, HTTP, timeout, and invalid-response failures.

## Add a backend

1. Create `electron/adapters/<runner>.cjs` and reuse `assertLoopbackEndpoint` plus `fetchWithTimeout` from `base.cjs`.
2. Register an instance in `electron/adapters/registry.cjs`.
3. Add the runner to the Settings UI and pass its ID to `listModels` and `compare`.
4. Add mocked unit tests for discovery, chat success, HTTP errors, and timeouts.
5. Document any runner-specific setup without weakening the default loopback restriction.

The orchestrator consumes only the generic `chat` method, so it automatically works with any adapter that implements this contract.
