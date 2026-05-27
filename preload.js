const { contextBridge, ipcRenderer, webUtils } = require('electron');

const DROPPED_IMAGE_MAX_BYTES = 50 * 1024 * 1024;
const DROPPED_IMAGE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp', '.tif', '.tiff']);
const DROPPED_IMAGE_MIME_TYPES = new Set(['image/png', 'image/jpeg', 'image/gif', 'image/webp', 'image/bmp', 'image/tiff']);

function getExtension(name) {
  const text = String(name || '');
  const dot = text.lastIndexOf('.');
  return dot >= 0 ? text.slice(dot).toLowerCase() : '';
}

function isDroppedImageFile(file) {
  const type = String((file && file.type) || '').toLowerCase();
  const ext = getExtension(file && file.name);
  return DROPPED_IMAGE_MIME_TYPES.has(type) || DROPPED_IMAGE_EXTENSIONS.has(ext);
}

async function resolveTerminalDroppedFiles(sessionId, files) {
  const result = {
    paths: [],
    diskPathCount: 0,
    savedImageCount: 0,
    rejected: [],
  };
  const virtualImages = [];
  const fileList = Array.from(files || []);

  for (let index = 0; index < fileList.length; index += 1) {
    const file = fileList[index];
    if (!file) continue;

    let filePath = '';
    try {
      filePath = webUtils.getPathForFile(file);
    } catch {}

    if (filePath) {
      result.paths.push(filePath);
      result.diskPathCount += 1;
      continue;
    }

    const size = Number(file.size) || 0;
    if (!isDroppedImageFile(file)) {
      result.rejected.push({ index, name: String(file.name || ''), reason: 'no-native-path' });
      continue;
    }
    if (size > DROPPED_IMAGE_MAX_BYTES) {
      result.rejected.push({ index, name: String(file.name || ''), reason: 'image-too-large' });
      continue;
    }
    if (typeof file.arrayBuffer !== 'function') {
      result.rejected.push({ index, name: String(file.name || ''), reason: 'missing-image-data' });
      continue;
    }

    try {
      virtualImages.push({
        name: String(file.name || ''),
        type: String(file.type || ''),
        size,
        data: await file.arrayBuffer(),
      });
    } catch {
      result.rejected.push({ index, name: String(file.name || ''), reason: 'read-failed' });
    }
  }

  if (virtualImages.length > 0) {
    try {
      const saveResult = await ipcRenderer.invoke('terminal:save-dropped-images', {
        sessionId,
        images: virtualImages,
      });
      if (saveResult && saveResult.success) {
        const savedPaths = Array.isArray(saveResult.paths) ? saveResult.paths : [];
        result.paths.push(...savedPaths);
        result.savedImageCount = savedPaths.length;
        if (Array.isArray(saveResult.rejected)) result.rejected.push(...saveResult.rejected);
      } else {
        result.rejected.push({
          index: -1,
          reason: 'save-failed',
          message: String((saveResult && saveResult.error) || 'Could not save dropped image.'),
        });
      }
    } catch (error) {
      result.rejected.push({
        index: -1,
        reason: 'save-failed',
        message: String((error && error.message) || error || 'Could not save dropped image.'),
      });
    }
  }

  return result;
}

contextBridge.exposeInMainWorld('ezvibes', {
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
  onWindowLifecycle: (callback) => {
    const listener = (_, payload) => callback(payload);
    ipcRenderer.on('app:window-lifecycle', listener);
    return () => ipcRenderer.removeListener('app:window-lifecycle', listener);
  },
  getLiveLog: () => ipcRenderer.invoke('app:live-log'),
  logEvent: (event, details, level = 'info') => ipcRenderer.send('app:log', { event, details, level }),
  confirmAppClose: (requestId, confirmed) => ipcRenderer.invoke('app:confirm-close', { requestId, confirmed }),
  getActivateFilePath: () => ipcRenderer.invoke('activate:file-path'),
  openActivateFile: () => ipcRenderer.invoke('activate:open-file'),
  listInboxMarkdownFiles: () => ipcRenderer.invoke('inbox:list-markdown'),
  onAppCloseRequested: (callback) => {
    const listener = (_, payload) => callback(payload);
    ipcRenderer.on('app:close-requested', listener);
    return () => ipcRenderer.removeListener('app:close-requested', listener);
  },
  onLiveLogEntry: (callback) => {
    const listener = (_, payload) => callback(payload);
    ipcRenderer.on('app:live-log-entry', listener);
    return () => ipcRenderer.removeListener('app:live-log-entry', listener);
  },
  readClipboard: () => ipcRenderer.invoke('clipboard:read'),
  writeClipboard: (text) => ipcRenderer.invoke('clipboard:write', text),
  getPathForFile: (file) => webUtils.getPathForFile(file),
  resolveTerminalDroppedFiles,
});
