type Props = {
  models: LocalModel[];
  judgeOptions: LocalModel[];
  selected: string[];
  judgeModel: string;
  loading: boolean;
  onToggle: (modelId: string) => void;
  onJudgeChange: (modelId: string) => void;
};

function formatBytes(bytes: number) {
  if (!bytes) return 'size unknown';
  return `${(bytes / 1024 ** 3).toFixed(1)} GB`;
}

export default function ModelPicker({ models, judgeOptions, selected, judgeModel, loading, onToggle, onJudgeChange }: Props) {
  // Contestants first, then any other local model (a separate judge is more independent).
  const others = judgeOptions.filter((model) => !selected.includes(model.id));
  return (
    <section className="model-section" aria-labelledby="model-heading">
      <div className="section-title-row">
        <div>
          <p className="eyebrow">Contestants</p>
          <h2 id="model-heading">Choose up to three models</h2>
        </div>
        <span className="selection-count">{selected.length}/3 selected</span>
      </div>

      {loading ? (
        <div className="model-grid" aria-label="Loading models">
          {[1, 2, 3].map((item) => <div className="model-card skeleton" key={item} />)}
        </div>
      ) : (
        <div className="model-grid">
          {models.map((model) => {
            const checked = selected.includes(model.id);
            const disabled = !checked && selected.length >= 3;
            return (
              <label className={`model-card ${checked ? 'selected' : ''} ${disabled ? 'disabled' : ''}`} key={model.id}>
                <input
                  type="checkbox"
                  checked={checked}
                  disabled={disabled}
                  onChange={() => onToggle(model.id)}
                />
                <span className="model-check" aria-hidden="true">{checked ? '✓' : ''}</span>
                <span className="model-info">
                  <strong>{model.name}</strong>
                  <small>{[model.parameterSize, model.family, formatBytes(model.size)].filter(Boolean).join(' · ')}</small>
                </span>
              </label>
            );
          })}
        </div>
      )}

      {selected.length > 0 && (
        <label className="judge-select">
          <span>Orchestrator model</span>
          <select value={judgeModel} onChange={(event) => onJudgeChange(event.target.value)}>
            <optgroup label="Competing">
              {selected.map((modelId) => <option key={modelId} value={modelId}>{modelId}</option>)}
            </optgroup>
            {others.length > 0 && (
              <optgroup label="Not competing (more independent)">
                {others.map((model) => <option key={model.id} value={model.id}>{model.name}</option>)}
              </optgroup>
            )}
          </select>
          <small>This model privately judges the successful answers after they finish. It sees them as A, B and C, without model names. Pick a general-purpose model: a specialist (for example a stories-only model) may not judge, and the app then marks the round "Fallback used".</small>
        </label>
      )}
    </section>
  );
}
