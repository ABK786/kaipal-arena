const { OllamaAdapter } = require('./ollama.cjs');

class RunnerRegistry {
  constructor(adapters) {
    this.adapters = new Map(adapters.map((adapter) => [adapter.id, adapter]));
  }

  get(id) {
    return this.adapters.get(id);
  }

  list() {
    return [...this.adapters.values()].map(({ id, label }) => ({ id, label }));
  }
}

const runnerRegistry = new RunnerRegistry([new OllamaAdapter()]);

module.exports = { RunnerRegistry, runnerRegistry };
