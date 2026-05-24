const { contextBridge, ipcRenderer, webUtils } = require('electron');

contextBridge.exposeInMainWorld('controlPanel', {
  getInitialPath: () => ipcRenderer.invoke('app:initial-path'),
  getQuickPaths: () => ipcRenderer.invoke('app:quick-paths'),
  listDirectory: (folderPath) => ipcRenderer.invoke('fs:list-directory', folderPath),
  createTerminal: (payload) => ipcRenderer.invoke('terminal:create', payload),
  writeTerminal: (sessionId, data) => ipcRenderer.send('terminal:input', { sessionId, data }),
  resizeTerminal: (sessionId, cols, rows) => ipcRenderer.send('terminal:resize', { sessionId, cols, rows }),
  closeTerminal: (sessionId) => ipcRenderer.invoke('terminal:close', sessionId),
  onTerminalData: (callback) => {
    const listener = (_, payload) => callback(payload);
    ipcRenderer.on('terminal:data', listener);
    return () => ipcRenderer.removeListener('terminal:data', listener);
  },
  onTerminalExit: (callback) => {
    const listener = (_, payload) => callback(payload);
    ipcRenderer.on('terminal:exit', listener);
    return () => ipcRenderer.removeListener('terminal:exit', listener);
  },
  readClipboard: () => ipcRenderer.invoke('clipboard:read'),
  writeClipboard: (text) => ipcRenderer.invoke('clipboard:write', text),
  getPathForFile: (file) => webUtils.getPathForFile(file),
});
