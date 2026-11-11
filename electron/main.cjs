const { app, BrowserWindow, ipcMain, shell } = require('electron');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { runnerRegistry } = require('./adapters/registry.cjs');
const { CancelledError } = require('./adapters/base.cjs');
const { orchestrate } = require('./orchestration.cjs');
const { normalizeRuntimeOptions, normalizeRunControls } = require('./runtime-options.cjs');

const MAX_MODELS = 3;
const MAX_MESSAGES = 200;
const MAX_MESSAGE_CHARS = 100_000;
const devUrl = process.env.VITE_DEV_SERVER_URL;
const appPage = pathToFileURL(path.join(__dirname, '..', 'dist', 'index.html')).href;
const active = new Map();   // webContents id -> AbortController of the running comparison

// Only the app's own page may call the main process.
function fromAppPage(event) {
  const url = event.senderFrame?.url ?? '';
  if (devUrl && url.startsWith(devUrl)) return true;
  return url.split('#')[0] === appPage;
}

function createWindow() {
  const window = new BrowserWindow({
    width: 1440,
    height: 960,
    minWidth: 960,
    minHeight: 680,
    backgroundColor: '#0b1020',
    title: 'KAIPAL Arena',
    icon: path.join(__dirname, '..', 'public', 'app-icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
    },
  });

  window.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://')) shell.openExternal(url);
    return { action: 'deny' };
  });
  // The window never leaves the app page (a dropped file or link would otherwise replace it).
  window.webContents.on('will-navigate', (event, url) => {
    if (!(devUrl && url.startsWith(devUrl)) && url.split('#')[0] !== appPage) event.preventDefault();
  });
  window.webContents.on('destroyed', () => active.get(window.webContents.id)?.abort());

  if (devUrl) window.loadURL(devUrl);
  else window.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
}

function safeAdapter(runnerId, endpoint) {
  const adapter = runnerRegistry.get(runnerId);
  if (!adapter) throw new Error(`Unsupported local runner: ${runnerId}`);
  adapter.validateEndpoint(endpoint);
  return adapter;
}

function cleanMessages(messages) {
  if (!Array.isArray(messages) || messages.length === 0) throw new Error('A message is required.');
  return messages.slice(-MAX_MESSAGES).map((m) => {
    if (!m || !['user', 'assistant'].includes(m.role) || typeof m.content !== 'string') throw new Error('The chat history is not valid.');
    return { role: m.role, content: m.content.slice(0, MAX_MESSAGE_CHARS) };
  });
}

ipcMain.handle('local-ai:list-models', async (event, config = {}) => {
  if (!fromAppPage(event)) throw new Error('Not allowed.');
  const adapter = safeAdapter(config.runnerId, config.endpoint);
  return adapter.listModels(config.endpoint, 10_000);
});

ipcMain.handle('local-ai:cancel', (event) => {
  if (!fromAppPage(event)) return false;
  active.get(event.sender.id)?.abort();
  return true;
});

ipcMain.handle('local-ai:compare', async (event, request = {}) => {
  if (!fromAppPage(event)) throw new Error('Not allowed.');
  const { runnerId, endpoint, judgeModel } = request;
  const adapter = safeAdapter(runnerId, endpoint);
  const modelIds = Array.isArray(request.modelIds) ? request.modelIds.filter((id) => typeof id === 'string') : [];
  const uniqueModels = [...new Set(modelIds)].slice(0, MAX_MODELS);
  if (uniqueModels.length === 0) throw new Error('Select at least one model.');
  if (typeof judgeModel !== 'string' || !judgeModel) throw new Error('Select an orchestrator model.');
  const messages = cleanMessages(request.messages);

  // Every model must be one installed on this computer (never an Ollama cloud model).
  const local = new Set((await adapter.listModels(endpoint, 10_000)).map((m) => m.id));
  const notLocal = [...uniqueModels, judgeModel].filter((id) => !local.has(id));
  if (notLocal.length) throw new Error(`Not a model on this computer: ${[...new Set(notLocal)].join(', ')}. Refresh models and choose again.`);

  const runtime = normalizeRuntimeOptions(request.runtimeOptions);
  const { timeoutMs, sequential } = normalizeRunControls(request.runtimeOptions);
  active.get(event.sender.id)?.abort();
  const controller = new AbortController();
  active.set(event.sender.id, controller);
  const { signal } = controller;
  const startedAt = Date.now();

  try {
    const runOne = async (modelId) => {
      const modelStartedAt = Date.now();
      try {
        const content = await adapter.chat({ endpoint, model: modelId, messages, timeoutMs, ...runtime, signal });
        return { modelId, content, latencyMs: Date.now() - modelStartedAt, status: 'success' };
      } catch (error) {
        if (error instanceof CancelledError) throw error;
        return { modelId, content: '', latencyMs: Date.now() - modelStartedAt, status: 'error', error: error instanceof Error ? error.message : String(error) };
      }
    };

    const results = [];
    if (sequential) {
      for (const modelId of uniqueModels) results.push(await runOne(modelId));
    } else {
      results.push(...await Promise.all(uniqueModels.map(runOne)));
    }

    const successful = results.filter((result) => result.status === 'success');
    const evaluation = await orchestrate({ adapter, endpoint, judgeModel, messages, candidates: successful, timeoutMs, runtime, signal });
    return { results, evaluation, totalLatencyMs: Date.now() - startedAt };
  } catch (error) {
    if (error instanceof CancelledError || signal.aborted) throw new Error('Stopped.');
    throw error;
  } finally {
    if (active.get(event.sender.id) === controller) active.delete(event.sender.id);
  }
});

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
