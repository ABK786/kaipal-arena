type Props = {
  prompt: string;
  comparison: Comparison;
};

export default function ComparisonRound({ prompt, comparison }: Props) {
  const { results, evaluation } = comparison;
  const winner = results.find((result) => result.modelId === evaluation.winner);
  const rankByModel = new Map(evaluation.ranking.map((rank, index) => [rank.modelId, { ...rank, place: index + 1 }]));

  return (
    <article className="round">
      <div className="user-message"><span>You</span><p>{prompt}</p></div>

      <div className="answer-grid" style={{ '--columns': Math.max(results.length, 1) } as React.CSSProperties}>
        {results.map((result) => {
          const ranking = rankByModel.get(result.modelId);
          const isWinner = result.modelId === evaluation.winner;
          return (
            <section className={`answer-card ${isWinner ? 'winner' : ''}`} key={result.modelId}>
              <header>
                <div>
                  <span className="model-name">{result.modelId}</span>
                  <span className="latency">{(result.latencyMs / 1000).toFixed(1)}s</span>
                </div>
                {ranking && <span className={`score ${isWinner ? 'winning-score' : ''}`}>#{ranking.place} · {ranking.score}</span>}
              </header>
              {result.status === 'success' ? <div className="answer-text">{result.content}</div> : (
                <div className="model-error"><strong>Model failed</strong><span>{result.error}</span></div>
              )}
              {ranking && result.status === 'success' && (
                <details className="model-notes">
                  <summary>Judge notes</summary>
                  {ranking.strengths && <p><strong>Strengths:</strong> {ranking.strengths}</p>}
                  {ranking.weaknesses && <p><strong>Weaknesses:</strong> {ranking.weaknesses}</p>}
                </details>
              )}
            </section>
          );
        })}
      </div>

      <section className="verdict">
        <div className="verdict-badge" aria-hidden="true">✦</div>
        <div className="verdict-content">
          <p className="eyebrow">Orchestrator verdict</p>
          <h3>{winner ? `${winner.modelId} wins this round` : 'No response could be selected'}</h3>
          <p>{evaluation.explanation}</p>
          <div className="criteria">
            {evaluation.criteria.map((criterion) => <span key={criterion}>{criterion}</span>)}
            {evaluation.method === 'on-device-fallback' && <span className="fallback-chip">Fallback used</span>}
          </div>
        </div>
      </section>

      {winner && <section className="served-answer"><p className="eyebrow">Selected answer</p><div className="answer-text">{winner.content}</div></section>}
    </article>
  );
}
