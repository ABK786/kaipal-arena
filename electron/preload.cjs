const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('localAI', {
  listModels: (config) => ipcRenderer.invoke('local-ai:list-models', config),
  compare: (request) => ipcRenderer.invoke('local-ai:compare', request),
  cancel: () => ipcRenderer.invoke('local-ai:cancel'),
  platform: process.platform,
});
