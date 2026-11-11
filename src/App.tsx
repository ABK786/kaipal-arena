import { FormEvent, useEffect, useMemo, useState } from 'react';
import ComparisonRound from './components/ComparisonRound';
import ModelPicker from './components/ModelPicker';

const DEFAULT_ENDPOINT = 'http://127.0.0.1:11434';
const DEFAULT_RUNTIME: RuntimeOptions = {
  temperature: 0.7,
  topP: 0.9,
  topK: 40,
  repeatPenalty: 1.1,
  maxTokens: 1024,
  seed: '',
  thinking: false,
  timeoutSec: 300,
  sequential: false,
};
type Round = { id: string; prompt: string; comparison: Comparison };

function loadRuntimeOptions(): RuntimeOptions {
  try {
    return { ...DEFAULT_RUNTIME, ...JSON.parse(localStorage.getItem('ollama-runtime-options') ?? '{}') };
  } catch {
    return DEFAULT_RUNTIME;
  }
}

function getErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return message.replace(/^Error invoking remote method '[^']+': Error: /, '');
}

export default function App() {
  const [endpoint, setEndpoint] = useState(() => localStorage.getItem('ollama-endpoint') ?? DEFAULT_ENDPOINT);
  const [models, setModels] = useState<LocalModel[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [judgeModel, setJudgeModel] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [rounds, setRounds] = useState<Round[]>([]);
  const [prompt, setPrompt] = useState('');
  const [loadingModels, setLoadingModels] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [runtimeOptions, setRuntimeOptions] = useState<RuntimeOptions>(loadRuntimeOptions);

  const canSubmit = prompt.trim().length > 0 && selected.length > 0 && judgeModel && !submitting;
  const selectedNames = useMemo(() => selected.join(', '), [selected]);

  async function refreshModels(nextEndpoint = endpoint) {
    setLoadingModels(true);
    setError('');
    try {
      const discovered = await window.localAI.listModels({ runnerId: 'ollama', endpoint: nextEndpoint });
      setModels(discovered);
      setSelected((current) => current.filter((id) => discovered.some((model) => model.id === id)).slice(0, 3));
      if (discovered.length === 0) setError('Ollama is running, but no local models were found. Pull at least one model and refresh.');
    } catch (refreshError) {
      setModels([]);
      setError(`${getErrorMessage(refreshError)} Start Ollama, then try Refresh models.`);
    } finally {
      setLoadingModels(false);
    }
  }

  useEffect(() => { void refreshModels(); }, []);

  // The judge can be any local model; it defaults to the first contestant.
  useEffect(() => {
    if (!judgeModel || !models.some((model) => model.id === judgeModel)) setJudgeModel(selected[0] ?? '');
  }, [models, selected, judgeModel]);

  function toggleModel(modelId: string) {
    setSelected((current) => current.includes(modelId)
      ? current.filter((id) => id !== modelId)
      : [...current, modelId].slice(0, 3));
  }

  function saveSettings() {
    const clean = endpoint.trim().replace(/\/$/, '');
    setEndpoint(clean);
    localStorage.setItem('ollama-endpoint', clean);
    localStorage.setItem('ollama-runtime-options', JSON.stringify(runtimeOptions));
    void refreshModels(clean);
  }

  function updateRuntime<K extends keyof RuntimeOptions>(key: K, value: RuntimeOptions[K]) {
    setRuntimeOptions((current) => ({ ...current, [key]: value }));
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    const cleanPrompt = prompt.trim();
    if (!cleanPrompt || !canSubmit) return;

    const nextMessages: ChatMessage[] = [...messages, { role: 'user', content: cleanPrompt }];
    setSubmitting(true);
    setError('');
    setPrompt('');
    try {
      const comparison = await window.localAI.compare({
        runnerId: 'ollama',
        endpoint,
        modelIds: selected,
        judgeModel,
        messages: nextMessages,
        runtimeOptions,
      });
      const winningContent = comparison.results.find((result) => result.modelId === comparison.evaluation.winner)?.content;
      setRounds((current) => [...current, { id: crypto.randomUUID(), prompt: cleanPrompt, comparison }]);
      setMessages(winningContent ? [...nextMessages, { role: 'assistant', content: winningContent }] : nextMessages);
    } catch (submitError) {
      setPrompt(cleanPrompt);
      const message = getErrorMessage(submitError);
      setError(message === 'Stopped.' ? 'Stopped. Nothing was ranked; your question is back in the box.' : message);
    } finally {
      setSubmitting(false);
    }
  }

  function newChat() {
    setMessages([]);
    setRounds([]);
    setPrompt('');
    setError('');
  }

  return (
    <div className="app-shell">
      <header className="app-header">
        <a className="brand" href="#top" aria-label="KAIPAL Arena home">
          <img className="brand-logo" src="./kai-logo.png" alt="KAI" />
          <span><strong>KAIPAL Arena</strong><small>Private model comparison</small></span>
        </a>
        <div className="header-actions">
          <span className="privacy-pill"><span /> On-device only</span>
          <button className="ghost-button" type="button" onClick={() => setShowSettings((value) => !value)}>Settings</button>
          <button className="primary-small" type="button" onClick={newChat}>New chat</button>
        </div>
      </header>

      <main id="top">
        <section className="hero">
          <p className="eyebrow">One prompt. Multiple local minds.</p>
          <h1>Let your models compete.<br /><span>Keep every word private.</span></h1>
          <p>Compare up to three Ollama models side by side. A local orchestrator ranks the answers and serves the strongest one.</p>
        </section>

        {showSettings && (
          <section className="settings-panel">
            <div className="settings-heading">
              <div>
                <p className="eyebrow">Local runtime</p>
                <h2>Connection & generation settings</h2>
                <p>Contestant settings are sent directly to Ollama. The judge uses temperature 0 for repeatable rankings.</p>
              </div>
              <button type="button" className="settings-save" onClick={saveSettings}>Save settings & refresh</button>
            </div>

            <label className="endpoint-field" htmlFor="endpoint">
              <span>Ollama endpoint</span>
              <input id="endpoint" value={endpoint} onChange={(event) => setEndpoint(event.target.value)} spellCheck="false" />
              <small>Loopback addresses only. Default: http://127.0.0.1:11434</small>
            </label>

            <div className="runtime-grid">
              <label>
                <span>Temperature</span>
                <input type="number" min="0" max="2" step="0.1" value={runtimeOptions.temperature} onChange={(event) => updateRuntime('temperature', Number(event.target.value))} />
                <small>Creativity (0–2)</small>
              </label>
              <label>
                <span>Top P</span>
                <input type="number" min="0" max="1" step="0.05" value={runtimeOptions.topP} onChange={(event) => updateRuntime('topP', Number(event.target.value))} />
                <small>Nucleus sampling (0–1)</small>
              </label>
              <label>
                <span>Top K</span>
                <input type="number" min="0" max="200" step="1" value={runtimeOptions.topK} onChange={(event) => updateRuntime('topK', Number(event.target.value))} />
                <small>Candidate token pool</small>
              </label>
              <label>
                <span>Repeat penalty</span>
                <input type="number" min="0.1" max="2" step="0.05" value={runtimeOptions.repeatPenalty} onChange={(event) => updateRuntime('repeatPenalty', Number(event.target.value))} />
                <small>Discourage repetition</small>
              </label>
              <label>
                <span>Max output tokens</span>
                <input type="number" min="1" max="8192" step="1" value={runtimeOptions.maxTokens} onChange={(event) => updateRuntime('maxTokens', Number(event.target.value))} />
                <small>Ollama num_predict</small>
              </label>
              <label>
                <span>Seed</span>
                <input type="number" step="1" value={runtimeOptions.seed} placeholder="Random" onChange={(event) => updateRuntime('seed', event.target.value)} />
                <small>Blank uses a random seed</small>
              </label>
              <label>
                <span>Time limit (seconds)</span>
                <input type="number" min="30" max="1800" step="30" value={runtimeOptions.timeoutSec} onChange={(event) => updateRuntime('timeoutSec', Number(event.target.value))} />
                <small>Per model, 30 to 1800</small>
              </label>
            </div>

            <label className="thinking-setting">
              <span><strong>One model at a time</strong><small>Runs the models one after another. Slower, but kinder to computers that cannot hold several models in memory.</small></span>
              <input type="checkbox" checked={runtimeOptions.sequential} onChange={(event) => updateRuntime('sequential', event.target.checked)} />
              <span className="toggle" aria-hidden="true"><span /></span>
            </label>

            <label className="thinking-setting">
              <span><strong>Thinking mode</strong><small>Ask supported reasoning models to think before answering. Models without thinking support answer normally. Thinking counts toward Max output tokens, so raise it (2048 or more) when this is on.</small></span>
              <input type="checkbox" checked={runtimeOptions.thinking} onChange={(event) => updateRuntime('thinking', event.target.checked)} />
              <span className="toggle" aria-hidden="true"><span /></span>
            </label>
          </section>
        )}

        {error && <div className="error-banner" role="alert"><span>!</span><p>{error}</p><button type="button" onClick={() => void refreshModels()}>Refresh models</button></div>}

        <ModelPicker
          models={models}
          judgeOptions={models}
          selected={selected}
          judgeModel={judgeModel}
          loading={loadingModels}
          onToggle={toggleModel}
          onJudgeChange={setJudgeModel}
        />

        {rounds.length > 0 && <section className="conversation" aria-live="polite">
          {rounds.map((round) => <ComparisonRound key={round.id} prompt={round.prompt} comparison={round.comparison} />)}
        </section>}

        {submitting && (
          <section className="running-state" aria-live="polite">
            <span className="spinner" />
            <div><strong>{runtimeOptions.sequential ? 'Models are answering one at a time' : 'Models are thinking in parallel'}</strong><p>Waiting for {selectedNames}, then {judgeModel} will judge their answers.</p></div>
            <button type="button" className="ghost-button stop-button" onClick={() => void window.localAI.cancel()}>Stop</button>
          </section>
        )}

        <form className={`composer ${rounds.length > 0 ? 'sticky' : ''}`} onSubmit={submit}>
          <label htmlFor="prompt">Ask your selected models</label>
          <textarea
            id="prompt"
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault();
                event.currentTarget.form?.requestSubmit();
              }
            }}
            placeholder={selected.length ? 'Type a question…' : 'Select at least one local model first…'}
            disabled={submitting}
            rows={3}
          />
          <div className="composer-footer">
            <span>Enter to send · Shift+Enter for a new line</span>
            <button type="submit" disabled={!canSubmit}>{submitting ? 'Comparing…' : `Compare ${selected.length || ''} model${selected.length === 1 ? '' : 's'}`}</button>
          </div>
        </form>

        <footer>
          <div><span>Nothing leaves your computer.</span> KAIPAL Arena only accepts loopback runner addresses.</div>
          <div className="distributor">Kohenoor Technologies · www.kohenoor.net · info@kohenoor.tech</div>
        </footer>
      </main>
    </div>
  );
}
