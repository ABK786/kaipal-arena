/// <reference types="vite/client" />

type ChatMessage = { role: 'user' | 'assistant' | 'system'; content: string };
type LocalModel = {
  id: string;
  name: string;
  size: number;
  modifiedAt: string | null;
  family: string | null;
  parameterSize: string | null;
};
type ModelResult = {
  modelId: string;
  content: string;
  latencyMs: number;
  status: 'success' | 'error';
  error?: string;
};
type Ranking = {
  modelId: string;
  score: number;
  strengths: string;
  weaknesses: string;
};
type Evaluation = {
  winner: string | null;
  ranking: Ranking[];
  explanation: string;
  criteria: string[];
  method: 'local-model-judge' | 'on-device-fallback' | 'single-response';
};
type Comparison = { results: ModelResult[]; evaluation: Evaluation; totalLatencyMs: number };
type RuntimeOptions = {
  temperature: number;
  topP: number;
  topK: number;
  repeatPenalty: number;
  maxTokens: number;
  seed: string;
  thinking: boolean;
  timeoutSec: number;
  sequential: boolean;
};

interface Window {
  localAI: {
    platform: string;
    listModels(config: { runnerId: string; endpoint: string }): Promise<LocalModel[]>;
    compare(request: {
      runnerId: string;
      endpoint: string;
      modelIds: string[];
      judgeModel: string;
      messages: ChatMessage[];
      runtimeOptions: RuntimeOptions;
    }): Promise<Comparison>;
    cancel(): Promise<boolean>;
  };
}
