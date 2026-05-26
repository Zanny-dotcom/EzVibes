const { app, BrowserWindow, ipcMain, Menu, clipboard, session, webContents } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { pathToFileURL } = require('url');
const pty = require('node-pty');

const projectRoot = __dirname;
const APP_USER_MODEL_ID = 'com.ezvibes.app';
const APP_ICON_PATH = path.join(__dirname, 'renderer', 'ezvibes.ico');
const APP_INDEX_PATH = path.join(__dirname, 'renderer', 'index.html');
const APP_INDEX_URL = pathToFileURL(APP_INDEX_PATH).href;
const sessions = new Map();
const PTY_ENV_ALLOWLIST = new Set([
  'PATH',
  'Path',
  'PATHEXT',
  'SystemRoot',
  'SystemDrive',
  'WINDIR',
  'USERPROFILE',
  'HOMEDRIVE',
  'HOMEPATH',
  'APPDATA',
  'LOCALAPPDATA',
  'ProgramData',
  'ALLUSERSPROFILE',
  'TEMP',
  'TMP',
  'ComSpec',
  'PSModulePath',
].map((key) => key.toUpperCase()));
const PTY_SECRET_PREFIXES = ['AWS_', 'AZURE_', 'OPENAI_', 'ANTHROPIC_'];
const DEFAULT_WINDOWS_PATHEXT = '.COM;.EXE;.BAT;.CMD;.VBS;.VBE;.JS;.JSE;.WSF;.WSH;.MSC;.CPL';

let currentMainWindow = null;
let ipcRegistered = false;

app.setAppUserModelId(APP_USER_MODEL_ID);

function setCurrentMainWindow(win) {
  currentMainWindow = win;
  win.on('closed', () => {
    if (currentMainWindow === win) currentMainWindow = null;
  });
}

function sendToSessionOwner(sessionRecord, channel, payload) {
  const owner = webContents.fromId(sessionRecord.ownerWebContentsId);
  if (!owner || owner.isDestroyed()) return;
  owner.send(channel, payload);
}

function normalizeSessionId(value) {
  return value == null ? '' : String(value);
}

function getOwnedSession(event, sessionId) {
  const id = normalizeSessionId(sessionId);
  const sessionRecord = sessions.get(id);
  if (!sessionRecord || sessionRecord.ownerWebContentsId !== event.sender.id) return null;
  return sessionRecord;
}

function killSession(sessionId, sessionRecord) {
  try {
    sessionRecord.pty.kill();
  } catch {}
  sessions.delete(sessionId);
}

function killSessionsForWebContents(ownerWebContentsId) {
  for (const [sessionId, sessionRecord] of sessions) {
    if (sessionRecord.ownerWebContentsId === ownerWebContentsId) {
      killSession(sessionId, sessionRecord);
    }
  }
}

function registerPermissionHandlers() {
  session.defaultSession.setPermissionRequestHandler((_webContents, _permission, callback) => {
    callback(false);
  });
  session.defaultSession.setPermissionCheckHandler(() => false);
}

function isSensitiveEnvKey(key) {
  const upperKey = key.toUpperCase();
  return (
    upperKey.includes('KEY') ||
    upperKey.includes('TOKEN') ||
    upperKey.includes('SECRET') ||
    PTY_SECRET_PREFIXES.some((prefix) => upperKey.startsWith(prefix))
  );
}

function buildPtyEnv(sourceEnv = process.env) {
  const env = {};
  for (const [key, value] of Object.entries(sourceEnv)) {
    if (!PTY_ENV_ALLOWLIST.has(key.toUpperCase())) continue;
    if (isSensitiveEnvKey(key)) continue;
    env[key] = value;
  }
  if (process.platform === 'win32') {
    ensureWindowsPtyEnv(env);
  }
  return env;
}

function ensureWindowsPtyEnv(env) {
  if (!getEnvValue(env, 'PATHEXT')) {
    env.PATHEXT = getEnvValue(process.env, 'PATHEXT') || DEFAULT_WINDOWS_PATHEXT;
  }

  if (!getEnvValue(env, 'SystemRoot') && getEnvValue(process.env, 'SystemRoot')) {
    env.SystemRoot = getEnvValue(process.env, 'SystemRoot');
  }
  if (!getEnvValue(env, 'WINDIR') && getEnvValue(env, 'SystemRoot')) {
    env.WINDIR = getEnvValue(env, 'SystemRoot');
  }
  if (!getEnvValue(env, 'SystemDrive')) {
    const systemRoot = getEnvValue(env, 'SystemRoot') || getEnvValue(env, 'WINDIR') || os.homedir();
    env.SystemDrive = path.parse(systemRoot).root.replace(/[\\/]$/, '') || 'C:';
  }
  if (!getEnvValue(env, 'ProgramData')) {
    env.ProgramData = `${getEnvValue(env, 'SystemDrive') || 'C:'}\\ProgramData`;
  }
  if (!getEnvValue(env, 'ALLUSERSPROFILE')) {
    env.ALLUSERSPROFILE = getEnvValue(env, 'ProgramData') || 'C:\\ProgramData';
  }

  const userProfile = getEnvValue(env, 'USERPROFILE') || os.homedir();
  if (!getEnvValue(env, 'USERPROFILE')) env.USERPROFILE = userProfile;
  if (!getEnvValue(env, 'APPDATA')) env.APPDATA = path.join(userProfile, 'AppData', 'Roaming');
  if (!getEnvValue(env, 'LOCALAPPDATA')) env.LOCALAPPDATA = path.join(userProfile, 'AppData', 'Local');

  prependPathDirs(env, [
    path.join(userProfile, '.local', 'bin'),
    path.join(getEnvValue(env, 'APPDATA'), 'npm'),
  ]);
}

function getEnvKey(env, key) {
  const upperKey = key.toUpperCase();
  return Object.keys(env).find((candidate) => candidate.toUpperCase() === upperKey);
}

function getEnvValue(env, key) {
  const existingKey = getEnvKey(env, key);
  return existingKey ? env[existingKey] : '';
}

function setEnvValue(env, key, value) {
  const existingKey = getEnvKey(env, key);
  env[existingKey || key] = value;
}

function prependPathDirs(env, dirs) {
  const existingPath = getEnvValue(env, 'PATH');
  const separator = process.platform === 'win32' ? ';' : ':';
  const existingDirs = existingPath ? existingPath.split(separator).filter(Boolean) : [];
  const normalizedExisting = new Set(existingDirs.map((dir) => normalizePathForCompare(dir)));
  const newDirs = dirs.filter((dir) => {
    if (!dir || !fs.existsSync(dir)) return false;
    const normalized = normalizePathForCompare(dir);
    if (normalizedExisting.has(normalized)) return false;
    normalizedExisting.add(normalized);
    return true;
  });

  if (newDirs.length > 0 || existingPath) {
    setEnvValue(env, 'PATH', [...newDirs, ...existingDirs].join(separator));
  }
}

function normalizePathForCompare(value) {
  return path.resolve(value).replace(/[\\/]+$/, '').toLowerCase();
}

const AGENT_PROFILES = {
  claude: {
    label: 'Claude',
    commandNames: ['claude.exe', 'claude.cmd', 'claude.ps1', 'claude'],
    args: ['--dangerously-skip-permissions'],
  },
  codex: {
    label: 'Codex',
    commandNames: ['codex.exe', 'codex.cmd', 'codex.ps1', 'codex'],
    args: ['--yolo'],
  },
};

function resolveAgentLaunch(agent, env) {
  const profile = AGENT_PROFILES[agent] || AGENT_PROFILES.claude;
  if (agent === 'codex') {
    const codexNative = resolveCodexNativeLaunch(profile, env);
    if (codexNative) return codexNative;
  }

  const executablePath = findExecutableOnPath(profile.commandNames, env);
  if (!executablePath) {
    return {
      success: false,
      error: `${profile.label} executable not found. Checked PATH for: ${profile.commandNames.join(', ')}.`,
    };
  }

  return buildLaunchForExecutable(profile, executablePath, env);
}

function resolveCodexNativeLaunch(profile, env) {
  const targetTriple = getCodexTargetTriple();
  const binaryName = process.platform === 'win32' ? 'codex.exe' : 'codex';
  const codexRoots = getCodexPackageRoots(env);
  const packageName = getCodexPlatformPackageName();
  const candidates = [];

  for (const codexRoot of codexRoots) {
    if (!codexRoot) continue;
    const platformRoots = packageName
      ? [path.join(codexRoot, 'node_modules', '@openai', packageName)]
      : [];
    platformRoots.push(codexRoot);

    for (const platformRoot of platformRoots) {
      candidates.push({
        binaryPath: path.join(platformRoot, 'vendor', targetTriple, 'bin', binaryName),
        pathDir: path.join(platformRoot, 'vendor', targetTriple, 'codex-path'),
        packageRoot: codexRoot,
      });
      candidates.push({
        binaryPath: path.join(platformRoot, 'vendor', targetTriple, 'codex', binaryName),
        pathDir: path.join(platformRoot, 'vendor', targetTriple, 'path'),
        packageRoot: codexRoot,
      });
    }
  }

  for (const candidate of candidates) {
    if (!fs.existsSync(candidate.binaryPath)) continue;
    const launchEnv = { ...env };
    prependPathDirs(launchEnv, [candidate.pathDir]);
    setEnvValue(launchEnv, 'CODEX_MANAGED_BY_NPM', '1');
    setEnvValue(launchEnv, 'CODEX_MANAGED_PACKAGE_ROOT', realpathOrSelf(candidate.packageRoot));
    return {
      success: true,
      command: candidate.binaryPath,
      args: profile.args,
      env: launchEnv,
      displayCommand: `codex ${profile.args.join(' ')}`,
    };
  }

  return null;
}

function getCodexPackageRoots(env) {
  const roots = [];
  const shimPath = findExecutableOnPath(['codex.cmd', 'codex.ps1', 'codex'], env);
  if (shimPath) {
    roots.push(path.join(path.dirname(shimPath), 'node_modules', '@openai', 'codex'));
  }

  const appData = getEnvValue(env, 'APPDATA') || path.join(os.homedir(), 'AppData', 'Roaming');
  roots.push(path.join(appData, 'npm', 'node_modules', '@openai', 'codex'));
  roots.push(path.join(projectRoot, 'node_modules', '@openai', 'codex'));

  return uniqueExistingPaths(roots);
}

function getCodexTargetTriple() {
  if (process.platform === 'win32') {
    return process.arch === 'arm64' ? 'aarch64-pc-windows-msvc' : 'x86_64-pc-windows-msvc';
  }
  if (process.platform === 'darwin') {
    return process.arch === 'arm64' ? 'aarch64-apple-darwin' : 'x86_64-apple-darwin';
  }
  return process.arch === 'arm64' ? 'aarch64-unknown-linux-musl' : 'x86_64-unknown-linux-musl';
}

function getCodexPlatformPackageName() {
  if (process.platform === 'win32') {
    return process.arch === 'arm64' ? 'codex-win32-arm64' : 'codex-win32-x64';
  }
  if (process.platform === 'darwin') {
    return process.arch === 'arm64' ? 'codex-darwin-arm64' : 'codex-darwin-x64';
  }
  if (process.platform === 'linux') {
    return process.arch === 'arm64' ? 'codex-linux-arm64' : 'codex-linux-x64';
  }
  return '';
}

function buildLaunchForExecutable(profile, executablePath, env) {
  const extension = path.extname(executablePath).toLowerCase();
  if (process.platform === 'win32' && extension === '.cmd') {
    return {
      success: true,
      command: getEnvValue(env, 'ComSpec') || 'cmd.exe',
      args: ['/d', '/s', '/c', [quoteCmdArg(executablePath), ...profile.args.map(quoteCmdArg)].join(' ')],
      env,
      displayCommand: `${path.basename(executablePath)} ${profile.args.join(' ')}`,
    };
  }

  if (process.platform === 'win32' && extension === '.ps1') {
    return {
      success: true,
      command: 'powershell.exe',
      args: ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', executablePath, ...profile.args],
      env,
      displayCommand: `${path.basename(executablePath)} ${profile.args.join(' ')}`,
    };
  }

  return {
    success: true,
    command: executablePath,
    args: profile.args,
    env,
    displayCommand: `${path.basename(executablePath)} ${profile.args.join(' ')}`,
  };
}

function findExecutableOnPath(commandNames, env) {
  const names = Array.isArray(commandNames) ? commandNames : [commandNames];
  const pathDirs = (getEnvValue(env, 'PATH') || '').split(process.platform === 'win32' ? ';' : ':').filter(Boolean);
  const pathExts = (getEnvValue(env, 'PATHEXT') || DEFAULT_WINDOWS_PATHEXT)
    .split(';')
    .map((extension) => extension.trim())
    .filter(Boolean);

  for (const name of names) {
    const directPath = path.isAbsolute(name) ? name : '';
    if (directPath && fs.existsSync(directPath)) return directPath;

    const hasExtension = !!path.extname(name);
    const candidateNames = process.platform === 'win32' && !hasExtension
      ? [name, ...pathExts.map((extension) => `${name}${extension.toLowerCase()}`)]
      : [name];

    for (const dir of pathDirs) {
      for (const candidateName of candidateNames) {
        const candidatePath = path.join(dir, candidateName);
        if (fs.existsSync(candidatePath)) return candidatePath;
      }
    }
  }

  return '';
}

function uniqueExistingPaths(paths) {
  const seen = new Set();
  const output = [];
  for (const candidatePath of paths) {
    if (!candidatePath || !fs.existsSync(candidatePath)) continue;
    const normalized = normalizePathForCompare(candidatePath);
    if (seen.has(normalized)) continue;
    seen.add(normalized);
    output.push(candidatePath);
  }
  return output;
}

function realpathOrSelf(filePath) {
  try {
    return fs.realpathSync(filePath);
  } catch {
    return filePath;
  }
}

function quoteCmdArg(value) {
  return `"${String(value).replace(/"/g, '""')}"`;
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
    ['EZvibes', path.join(home, 'Documents', 'EZvibes')],
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
    title: 'EZvibes',
    icon: APP_ICON_PATH,
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
  const sendWindowLifecycle = (type) => {
    if (win.isDestroyed()) return;
    win.webContents.send('app:window-lifecycle', { type });
  };
  win.on('minimize', () => sendWindowLifecycle('hidden'));
  win.on('hide', () => sendWindowLifecycle('hidden'));
  win.on('restore', () => sendWindowLifecycle('visible'));
  win.on('show', () => sendWindowLifecycle('visible'));
  win.on('focus', () => sendWindowLifecycle('focus'));
  const webContentsId = win.webContents.id;
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  win.webContents.on('will-navigate', (event, navigationUrl) => {
    killSessionsForWebContents(webContentsId);
    if (navigationUrl !== APP_INDEX_URL) {
      event.preventDefault();
    }
  });
  win.webContents.on('render-process-gone', () => killSessionsForWebContents(webContentsId));
  win.webContents.on('destroyed', () => killSessionsForWebContents(webContentsId));
  win.on('closed', () => killSessionsForWebContents(webContentsId));
  win.loadFile(APP_INDEX_PATH);

  win.webContents.on('context-menu', (event, params) => {
    if (!params.isEditable && !params.selectionText) return;
    const items = [];
    if (params.editFlags.canCut) items.push({ role: 'cut' });
    if (params.editFlags.canCopy) items.push({ role: 'copy' });
    if (params.editFlags.canPaste) items.push({ role: 'paste' });
    if (items.length && params.editFlags.canSelectAll) items.push({ type: 'separator' });
    if (params.editFlags.canSelectAll) items.push({ role: 'selectAll' });
    if (items.length) Menu.buildFromTemplate(items).popup({ window: win });
  });

  setCurrentMainWindow(win);
  return win;
}

function registerIpcHandlers() {
  if (ipcRegistered) return;
  ipcRegistered = true;

  ipcMain.handle('app:initial-path', () => documentsPath());
  ipcMain.handle('app:quick-paths', () => quickPaths());
  ipcMain.handle('fs:list-directory', (_, folderPath) => listDirectory(folderPath));

  ipcMain.handle('terminal:create', (event, payload) => {
    const sessionId = payload && String(payload.sessionId || '');
    if (!sessionId) return { success: false, error: 'Missing session id.' };
    const ownerWebContentsId = event.sender.id;
    const existingSession = sessions.get(sessionId);
    if (existingSession) {
      if (existingSession.ownerWebContentsId !== ownerWebContentsId) {
        return { success: false, error: 'Session is owned by another renderer.' };
      }
      return { success: true, sessionId };
    }

    let cwd;
    try {
      cwd = assertDirectory(payload.cwd);
    } catch (error) {
      return { success: false, error: error.message };
    }

    const agent = (payload && payload.agent === 'codex') ? 'codex' : 'claude';
    const cols = Math.max(20, Math.min(300, Number(payload.cols) || 100));
    const rows = Math.max(8, Math.min(120, Number(payload.rows) || 30));
    const env = buildPtyEnv();
    const launch = resolveAgentLaunch(agent, env);
    if (!launch.success) {
      return { success: false, error: launch.error };
    }

    let terminalProcess;
    try {
      terminalProcess = pty.spawn(launch.command, launch.args, {
        name: 'xterm-color',
        cols,
        rows,
        cwd,
        env: launch.env,
      });
    } catch (error) {
      return {
        success: false,
        error: `Failed to launch ${AGENT_PROFILES[agent].label}: ${error.message}`,
      };
    }
    const sessionRecord = { pty: terminalProcess, ownerWebContentsId };
    sessions.set(sessionId, sessionRecord);

    terminalProcess.onData((data) => {
      sendToSessionOwner(sessionRecord, 'terminal:data', { sessionId, data });
    });

    terminalProcess.onExit(({ exitCode }) => {
      if (sessions.get(sessionId) === sessionRecord) {
        sessions.delete(sessionId);
      }
      sendToSessionOwner(sessionRecord, 'terminal:exit', { sessionId, exitCode });
    });

    return { success: true, sessionId };
  });

  ipcMain.on('terminal:input', (event, payload) => {
    const sessionRecord = getOwnedSession(event, payload && payload.sessionId);
    if (sessionRecord && typeof payload.data === 'string') {
      sessionRecord.pty.write(payload.data);
    }
  });

  ipcMain.on('terminal:resize', (event, payload) => {
    const sessionRecord = getOwnedSession(event, payload && payload.sessionId);
    if (!sessionRecord) return;
    const cols = Math.max(20, Math.min(300, Number(payload.cols) || 100));
    const rows = Math.max(8, Math.min(120, Number(payload.rows) || 30));
    try {
      sessionRecord.pty.resize(cols, rows);
    } catch {}
  });

  ipcMain.handle('terminal:close', (event, sessionId) => {
    const normalizedSessionId = normalizeSessionId(sessionId);
    const sessionRecord = sessions.get(normalizedSessionId);
    if (!sessionRecord) return { success: true };
    if (sessionRecord.ownerWebContentsId !== event.sender.id) {
      return { success: false, error: 'Session is owned by another renderer.' };
    }
    killSession(normalizedSessionId, sessionRecord);
    return { success: true };
  });

  ipcMain.handle('clipboard:read', () => clipboard.readText());
  ipcMain.handle('clipboard:write', (_, text) => clipboard.writeText(String(text || '')));
}

app.whenReady().then(() => {
  Menu.setApplicationMenu(null);
  registerPermissionHandlers();
  registerIpcHandlers();
  createWindow();
});

app.on('before-quit', () => {
  for (const sessionRecord of sessions.values()) {
    try {
      sessionRecord.pty.kill();
    } catch {}
  }
  sessions.clear();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
