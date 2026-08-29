const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  selectOutputDir: () => ipcRenderer.invoke('select-output-dir'),
  openOutputDir: (dir) => ipcRenderer.invoke('open-output-dir', dir),
});
