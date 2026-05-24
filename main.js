const { app, BrowserWindow, ipcMain, Menu, clipboard } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { execSync } = require('child_process');
const pty = require('node-pty');

const sessions = new Map();

const PWSH_PROMPT_WRAPPER = [
  '$__origPrompt = $function:prompt',
  'function global:prompt {',
  '  $cwd = (Get-Location).Path',
  '  $promptText = & $__origPrompt',
  '  $esc = [char]27',
  '  return "$promptText$esc]9;9;$cwd$esc\\"',
  '}',
].join('\n');

function detectShell() {
  try {
    execSync('pwsh --version', { stdio: 'ignore' });
    return 'pwsh';
  } catch {
    return 'powershell.exe';
  }
}

function isPowerShell(shell) {
  const base = path.basename(shell).toLowerCase();
  return base === 'powershell.exe' || base === 'pwsh' || base === 'pwsh.exe';
}

function quotePowerShellLiteral(value) {
  return `'${String(value).replace(/'/g, "''")}'`;
}

function buildShellArgs(shell, cwd) {
  if (!isPowerShell(shell)) return [];
  const script = [
    PWSH_PROMPT_WRAPPER,
    `Set-Location -LiteralPath ${quotePowerShellLiteral(cwd)}`,
    'claude --dangerously-skip-permissions',
  ].join('\n');
  const encoded = Buffer.from(script, 'utf16le').toString('base64');
  return ['-NoExit', '-EncodedCommand', encoded];
}

function documentsPath() {
  const home = os.homedir();
  const docs = path.join(home, 'Documents');
  return fs.existsSync(docs) ? docs : home;
}

function assertDirectory(inputPath) {
  if (typeof inputPath !== 'string' || !inputPath.trim()) {
    throw new Error('Path is required.');
  }
  const resolved = path.resolve(inputPath);
  const stat = fs.statSync(resolved);
  if (!stat.isDirectory()) {
    throw new Error('Path is not a directory.');
  }
  return resolved;
}

function listDirectory(inputPath) {
  const dir = assertDirectory(inputPath);
  const names = fs.readdirSync(dir, { withFileTypes: true });
  const entries = names.map((entry) => {
    const fullPath = path.join(dir, entry.name);
    let stat = null;
    try {
      stat = fs.statSync(fullPath);
    } catch {}
    return {
      name: entry.name,
      path: fullPath,
      kind: entry.isDirectory() ? 'directory' : 'file',
      size: stat ? stat.size : 0,
      mtimeMs: stat ? stat.mtimeMs : 0,
      hidden: entry.name.startsWith('.'),
    };
  });
  entries.sort((a, b) => {
    if (a.kind !== b.kind) return a.kind === 'directory' ? -1 : 1;
    return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
  });
  return { path: dir, parent: path.dirname(dir), entries };
}

function quickPaths() {
  const home = os.homedir();
  const candidates = [
    ['Home', home],
    ['Desktop', path.join(home, 'Desktop')],
    ['Documents', path.join(home, 'Documents')],
    ['Downloads', path.join(home, 'Downloads')],
    ['CP', path.join(home, 'Documents', 'CP')],
  ];
  return candidates
    .filter(([, folder]) => fs.existsSync(folder))
    .map(([name, folder]) => ({ name, path: folder }));
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1500,
    height: 930,
    minWidth: 980,
    minHeight: 640,
    backgroundColor: '#101312',
    show: false,
    title: 'Claude Control Panel',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
    },
  });

  win.setMenuBarVisibility(false);
  win.once('ready-to-show', () => win.show());
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  win.loadFile(path.join(__dirname, 'renderer', 'index.html'));
  return win;
}

function registerIpc(mainWindow) {
  ipcMain.handle('app:initial-path', () => documentsPath());
  ipcMain.handle('app:quick-paths', () => quickPaths());
  ipcMain.handle('fs:list-directory', (_, folderPath) => listDirectory(folderPath));

  ipcMain.handle('terminal:create', (_, payload) => {
    const sessionId = payload && String(payload.sessionId || '');
    if (!sessionId) return { success: false, error: 'Missing session id.' };
    if (sessions.has(sessionId)) return { success: true, sessionId };

    let cwd;
    try {
      cwd = assertDirectory(payload.cwd);
    } catch (error) {
      return { success: false, error: error.message };
    }

    const shell = detectShell();
    const cols = Math.max(20, Math.min(300, Number(payload.cols) || 100));
    const rows = Math.max(8, Math.min(120, Number(payload.rows) || 30));
    const args = buildShellArgs(shell, cwd);
    const env = { ...process.env };

    const terminalProcess = pty.spawn(shell, args, {
      name: 'xterm-color',
      cols,
      rows,
      cwd,
      env,
    });

    if (!isPowerShell(shell)) {
      setTimeout(() => {
        try {
          terminalProcess.write('claude --dangerously-skip-permissions\r\n');
        } catch {}
      }, 500);
    }

    terminalProcess.onData((data) => {
      if (!mainWindow.isDestroyed()) {
        mainWindow.webContents.send('terminal:data', { sessionId, data });
      }
    });

    terminalProcess.onExit(({ exitCode }) => {
      sessions.delete(sessionId);
      if (!mainWindow.isDestroyed()) {
        mainWindow.webContents.send('terminal:exit', { sessionId, exitCode });
      }
    });

    sessions.set(sessionId, terminalProcess);
    return { success: true, sessionId };
  });

  ipcMain.on('terminal:input', (_, payload) => {
    const session = sessions.get(payload && payload.sessionId);
    if (session && typeof payload.data === 'string') {
      session.write(payload.data);
    }
  });

  ipcMain.on('terminal:resize', (_, payload) => {
    const session = sessions.get(payload && payload.sessionId);
    if (!session) return;
    const cols = Math.max(20, Math.min(300, Number(payload.cols) || 100));
    const rows = Math.max(8, Math.min(120, Number(payload.rows) || 30));
    try {
      session.resize(cols, rows);
    } catch {}
  });

  ipcMain.handle('terminal:close', (_, sessionId) => {
    const session = sessions.get(sessionId);
    if (session) {
      try {
        session.kill();
      } catch {}
      sessions.delete(sessionId);
    }
    return { success: true };
  });

  mainWindow.webContents.on('context-menu', (event, params) => {
    if (!params.isEditable && !params.selectionText) return;
    const items = [];
    if (params.editFlags.canCut) items.push({ role: 'cut' });
    if (params.editFlags.canCopy) items.push({ role: 'copy' });
    if (params.editFlags.canPaste) items.push({ role: 'paste' });
    if (items.length && params.editFlags.canSelectAll) items.push({ type: 'separator' });
    if (params.editFlags.canSelectAll) items.push({ role: 'selectAll' });
    if (items.length) Menu.buildFromTemplate(items).popup({ window: mainWindow });
  });

  ipcMain.handle('clipboard:read', () => clipboard.readText());
  ipcMain.handle('clipboard:write', (_, text) => clipboard.writeText(String(text || '')));
}

app.whenReady().then(() => {
  Menu.setApplicationMenu(null);
  const win = createWindow();
  registerIpc(win);
});

app.on('before-quit', () => {
  for (const session of sessions.values()) {
    try {
      session.kill();
    } catch {}
  }
  sessions.clear();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    const win = createWindow();
    registerIpc(win);
  }
});
