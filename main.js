const { app, BrowserWindow, ipcMain, Menu, clipboard, session, webContents, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { pathToFileURL } = require('url');
const { spawn } = require('child_process');
const pty = require('node-pty');

const projectRoot = __dirname;
const ACTIVATE_DIR_PATH = path.join(projectRoot, 'activate');
const ACTIVATE_FILE_PATH = path.join(ACTIVATE_DIR_PATH, 'Ezvibes.md');
const INBOX_DIR_PATH = path.join(projectRoot, 'inbox');
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
const PTY_ENV_PREFIX_ALLOWLIST = ['CLAUDE_', 'CLAUDECODE'];
const PTY_SECRET_PREFIXES = ['AWS_', 'AZURE_', 'OPENAI_', 'ANTHROPIC_'];
const DEFAULT_WINDOWS_PATHEXT = '.COM;.EXE;.BAT;.CMD;.VBS;.VBE;.JS;.JSE;.WSF;.WSH;.MSC;.CPL';
const LIVE_LOG_LIMIT = 500;
const LOG_TEXT_MAX = 800;
const DROPPED_IMAGE_DIR_NAME = '.ezvibes-drops';
const DROPPED_IMAGE_MAX_COUNT = 20;
const DROPPED_IMAGE_MAX_BYTES = 50 * 1024 * 1024;
const DROPPED_IMAGE_TOTAL_MAX_BYTES = 150 * 1024 * 1024;
const DROPPED_IMAGE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp', '.tif', '.tiff']);
const DROPPED_IMAGE_MIME_EXTENSIONS = new Map([
  ['image/png', '.png'],
  ['image/jpeg', '.jpg'],
  ['image/gif', '.gif'],
  ['image/webp', '.webp'],
  ['image/bmp', '.bmp'],
  ['image/tiff', '.tif'],
]);
const WINDOWS_RESERVED_FILE_BASENAMES = new Set([
  'CON', 'PRN', 'AUX', 'NUL',
  'COM1', 'COM2', 'COM3', 'COM4', 'COM5', 'COM6', 'COM7', 'COM8', 'COM9',
  'LPT1', 'LPT2', 'LPT3', 'LPT4', 'LPT5', 'LPT6', 'LPT7', 'LPT8', 'LPT9',
]);

let currentMainWindow = null;
let ipcRegistered = false;
let closeRequestCounter = 0;
let confirmedAppQuit = false;
const liveLogEntries = [];
const pendingCloseRequests = new Map();

app.setAppUserModelId(APP_USER_MODEL_ID);

function todayStamp() {
  const now = new Date();
  const pad = (value) => String(value).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

function getLogDirectory() {
  try {
    return path.join(app.getPath('userData'), 'logs');
  } catch {
    return path.join(os.homedir(), 'AppData', 'Roaming', 'EZvibes', 'logs');
  }
}

function getLogFilePath() {
  return path.join(getLogDirectory(), `ezvibes-${todayStamp()}.jsonl`);
}

function truncateLogText(value) {
  const text = String(value || '');
  return text.length > LOG_TEXT_MAX ? `${text.slice(0, LOG_TEXT_MAX - 1)}...` : text;
}

function sanitizeLogValue(value, depth = 0) {
  if (value == null) return value;
  if (value instanceof Error) {
    return {
      name: truncateLogText(value.name),
      message: truncateLogText(value.message),
      stack: truncateLogText(value.stack),
    };
  }
  if (typeof value === 'string') return truncateLogText(value);
  if (typeof value === 'number' || typeof value === 'boolean') return value;
  if (Array.isArray(value)) {
    if (depth >= 3) return `[Array(${value.length})]`;
    return value.slice(0, 20).map((item) => sanitizeLogValue(item, depth + 1));
  }
  if (typeof value === 'object') {
    if (depth >= 3) return '[Object]';
    const result = {};
    for (const [key, childValue] of Object.entries(value).slice(0, 30)) {
      result[key] = sanitizeLogValue(childValue, depth + 1);
    }
    return result;
  }
  return truncateLogText(value);
}

function writeLog(level, event, details = {}) {
  const entry = {
    time: new Date().toISOString(),
    level,
    event,
    pid: process.pid,
    details: sanitizeLogValue(details),
  };

  liveLogEntries.push(entry);
  if (liveLogEntries.length > LIVE_LOG_LIMIT) {
    liveLogEntries.splice(0, liveLogEntries.length - LIVE_LOG_LIMIT);
  }

  try {
    fs.mkdirSync(getLogDirectory(), { recursive: true });
    fs.appendFileSync(getLogFilePath(), `${JSON.stringify(entry)}\n`, 'utf8');
  } catch {}

  try {
    for (const contents of webContents.getAllWebContents()) {
      if (!contents.isDestroyed()) contents.send('app:live-log-entry', entry);
    }
  } catch {}

  return entry;
}

function ensureActivateFile() {
  fs.mkdirSync(ACTIVATE_DIR_PATH, { recursive: true });
  if (!fs.existsSync(ACTIVATE_FILE_PATH)) {
    fs.writeFileSync(ACTIVATE_FILE_PATH, '', 'utf8');
  }
  return ACTIVATE_FILE_PATH;
}

function openActivateFileInNotepad() {
  const filePath = ensureActivateFile();
  const child = spawn('notepad.exe', [filePath], {
    detached: true,
    stdio: 'ignore',
  });
  child.once('error', (error) => {
    writeLog('error', 'activate.notepad_spawn_error', { error, filePath });
  });
  child.unref();
  return filePath;
}

function countSessionsForWebContents(ownerWebContentsId) {
  let count = 0;
  for (const sessionRecord of sessions.values()) {
    if (sessionRecord.ownerWebContentsId === ownerWebContentsId) count += 1;
  }
  return count;
}

function requestCloseConfirmation(win, ownerWebContentsId, source) {
  if (!win || win.isDestroyed() || win.webContents.isDestroyed()) return false;
  const liveSessionCount = countSessionsForWebContents(ownerWebContentsId);
  if (liveSessionCount === 0) return false;

  if (win.__ezvibesCloseRequestId && pendingCloseRequests.has(win.__ezvibesCloseRequestId)) {
    writeLog('warn', 'app.close.confirmation_already_pending', {
      requestId: win.__ezvibesCloseRequestId,
      source,
      liveSessionCount,
    });
    return true;
  }

  closeRequestCounter += 1;
  const requestId = `${Date.now()}-${closeRequestCounter}`;
  win.__ezvibesCloseRequestId = requestId;
  pendingCloseRequests.set(requestId, {
    requestId,
    ownerWebContentsId,
    windowId: win.id,
    createdAt: Date.now(),
  });

  writeLog('warn', 'app.close.confirmation_requested', {
    requestId,
    source,
    liveSessionCount,
    totalLiveSessions: sessions.size,
  });
  win.webContents.send('app:close-requested', {
    requestId,
    source,
    liveSessionCount,
    totalLiveSessions: sessions.size,
  });
  return true;
}

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

function killSession(sessionId, sessionRecord, reason = 'unknown') {
  writeLog('warn', 'terminal.kill', {
    sessionId,
    ownerWebContentsId: sessionRecord.ownerWebContentsId,
    reason,
  });
  try {
    sessionRecord.pty.kill();
  } catch {}
  sessions.delete(sessionId);
}

function killSessionsForWebContents(ownerWebContentsId, reason = 'webcontents-cleanup') {
  for (const [sessionId, sessionRecord] of sessions) {
    if (sessionRecord.ownerWebContentsId === ownerWebContentsId) {
      killSession(sessionId, sessionRecord, reason);
    }
  }
}

function isPathInside(parentPath, childPath) {
  const relative = path.relative(path.resolve(parentPath), path.resolve(childPath));
  return relative === '' || (!!relative && !relative.startsWith('..') && !path.isAbsolute(relative));
}

function normalizeDroppedImageBuffer(data) {
  if (!data) return null;
  if (Buffer.isBuffer(data)) return data;
  if (data instanceof ArrayBuffer) return Buffer.from(data);
  if (ArrayBuffer.isView(data)) {
    return Buffer.from(data.buffer, data.byteOffset, data.byteLength);
  }
  return null;
}

function getDroppedImageExtension(name, type) {
  const ext = path.extname(String(name || '')).toLowerCase();
  if (DROPPED_IMAGE_EXTENSIONS.has(ext)) return ext;
  return DROPPED_IMAGE_MIME_EXTENSIONS.get(String(type || '').toLowerCase()) || '.png';
}

function isAllowedDroppedImage(name, type) {
  const ext = path.extname(String(name || '')).toLowerCase();
  const mime = String(type || '').toLowerCase();
  return DROPPED_IMAGE_EXTENSIONS.has(ext) || DROPPED_IMAGE_MIME_EXTENSIONS.has(mime);
}

function sanitizeDroppedImageBase(name, index) {
  const rawName = String(name || '').trim() || `screenshot-${index + 1}`;
  const ext = path.extname(rawName);
  let base = path.basename(rawName, ext)
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, '-')
    .replace(/\s+/g, ' ')
    .replace(/[. ]+$/g, '')
    .trim();
  if (!base) base = `screenshot-${index + 1}`;
  if (WINDOWS_RESERVED_FILE_BASENAMES.has(base.toUpperCase())) base = `${base}-image`;
  return base.slice(0, 80);
}

function droppedImageTimestamp() {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

function getDroppedImageDirectory(cwd) {
  const root = path.resolve(cwd);
  const dir = path.resolve(root, DROPPED_IMAGE_DIR_NAME, todayStamp());
  if (!isPathInside(root, dir)) {
    throw new Error('Resolved drop directory escaped the terminal folder.');
  }
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function getUniqueDroppedImagePath(dir, base, ext) {
  const stamp = droppedImageTimestamp();
  for (let attempt = 0; attempt < 1000; attempt += 1) {
    const suffix = attempt === 0 ? '' : `-${attempt + 1}`;
    const filePath = path.join(dir, `${stamp}-${base}${suffix}${ext}`);
    if (!fs.existsSync(filePath)) return filePath;
  }
  throw new Error('Could not allocate a unique dropped image path.');
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
    const upperKey = key.toUpperCase();
    const isAllowedKey = PTY_ENV_ALLOWLIST.has(upperKey) ||
      PTY_ENV_PREFIX_ALLOWLIST.some((prefix) => upperKey.startsWith(prefix));
    if (!isAllowedKey) continue;
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

function isReservedWindowsBasename(name) {
  const stem = String(name).split('.')[0];
  return WINDOWS_RESERVED_FILE_BASENAMES.has(stem.toUpperCase());
}

function assertSafeEntryName(value) {
  const name = String(value || '').trim();
  if (!name) throw new Error('Folder name cannot be empty.');
  if (/[<>:"/\\|?*\x00-\x1f]/.test(name)) {
    throw new Error('Folder name contains unsupported characters.');
  }
  if (name.includes('/') || name.includes('\\')) {
    throw new Error('Folder name cannot contain path separators.');
  }
  if (name === '.' || name === '..' || name.endsWith('.')) {
    throw new Error('Folder name is reserved.');
  }
  if (name.length > 120) {
    throw new Error('Folder name is too long.');
  }
  if (isReservedWindowsBasename(name)) {
    throw new Error('Folder name is reserved.');
  }
  return name;
}

function createFolder(payload) {
  const parentDir = assertDirectory(payload && payload.parentPath);
  const newName = assertSafeEntryName(payload && payload.name);
  const targetPath = path.resolve(parentDir, newName);
  if (!isPathInside(parentDir, targetPath) || path.dirname(targetPath) !== parentDir) {
    throw new Error('Folder name resolves outside the parent folder.');
  }

  try {
    fs.mkdirSync(targetPath);
  } catch (error) {
    if (error && error.code === 'EEXIST') {
      throw new Error(`An item named "${newName}" already exists.`);
    }
    throw error;
  }
  writeLog('info', 'fs.folder_created', { parentDir, folderPath: targetPath, name: newName });
  return { success: true, path: targetPath, name: newName, parent: parentDir };
}

function renameFolder(payload) {
  if (!payload || typeof payload.path !== 'string' || !payload.path.trim()) {
    throw new Error('Folder path is required.');
  }
  const entryPath = path.resolve(payload.path);
  const parentDir = assertDirectory(path.dirname(entryPath));
  const stat = fs.statSync(entryPath);
  if (!stat.isDirectory()) {
    throw new Error('Only folders can be renamed from EZvibes.');
  }
  const newName = assertSafeEntryName(payload && payload.newName);
  const targetPath = path.resolve(parentDir, newName);
  if (!isPathInside(parentDir, targetPath) || path.dirname(targetPath) !== parentDir) {
    throw new Error('Folder name resolves outside the parent folder.');
  }

  const sameNormalized = normalizePathForCompare(entryPath) === normalizePathForCompare(targetPath);
  const isCaseOnlyChange = sameNormalized && path.basename(entryPath) !== newName;

  if (!sameNormalized && fs.existsSync(targetPath)) {
    throw new Error(`An item named "${newName}" already exists.`);
  }

  if (isCaseOnlyChange) {
    const tempPath = path.join(parentDir, `.ezvibes-rename-temp-${Date.now()}-${process.pid}`);
    fs.renameSync(entryPath, tempPath);
    try {
      fs.renameSync(tempPath, targetPath);
    } catch (error) {
      try { fs.renameSync(tempPath, entryPath); } catch {}
      throw error;
    }
  } else if (!sameNormalized) {
    fs.renameSync(entryPath, targetPath);
  }

  writeLog('info', 'fs.folder_renamed', { from: entryPath, to: targetPath, name: newName });
  return {
    success: true,
    path: targetPath,
    name: newName,
    parent: parentDir,
  };
}

async function deleteFolder(payload) {
  if (!payload || typeof payload.path !== 'string' || !payload.path.trim()) {
    throw new Error('Folder path is required.');
  }
  const target = path.resolve(payload.path);
  const stat = fs.statSync(target);
  if (!stat.isDirectory()) {
    throw new Error('Only folders can be deleted from EZvibes.');
  }
  await shell.trashItem(target);
  const result = {
    success: true,
    path: target,
    parent: path.dirname(target),
    name: path.basename(target),
  };
  writeLog('info', 'fs.folder_trashed', {
    path: result.path,
    parent: result.parent,
    name: result.name,
  });
  return result;
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

function listInboxMarkdownFiles() {
  fs.mkdirSync(INBOX_DIR_PATH, { recursive: true });
  const names = fs.readdirSync(INBOX_DIR_PATH, { withFileTypes: true });
  const entries = names
    .filter((entry) => entry.isFile() && path.extname(entry.name).toLowerCase() === '.md')
    .map((entry) => {
      const fullPath = path.join(INBOX_DIR_PATH, entry.name);
      let stat = null;
      try {
        stat = fs.statSync(fullPath);
      } catch {}
      const ext = path.extname(entry.name);
      const displayName = path.basename(entry.name, ext) || entry.name;
      return {
        name: entry.name,
        displayName,
        path: fullPath,
        size: stat ? stat.size : 0,
        mtimeMs: stat ? stat.mtimeMs : 0,
      };
    });
  entries.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
  return { path: INBOX_DIR_PATH, entries };
}

function readInboxMarkdownFile(filePath) {
  fs.mkdirSync(INBOX_DIR_PATH, { recursive: true });
  const requested = path.resolve(String(filePath || ''));
  const inboxResolved = path.resolve(INBOX_DIR_PATH);
  const isInside = requested === inboxResolved
    || requested.startsWith(inboxResolved + path.sep);
  if (!isInside) {
    throw new Error('Path is outside the inbox directory.');
  }
  if (path.extname(requested).toLowerCase() !== '.md') {
    throw new Error('Not a markdown file.');
  }
  const content = fs.readFileSync(requested, 'utf8');
  return { content };
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

  writeLog('info', 'window.created', { windowId: win.id });
  win.setMenuBarVisibility(false);
  win.once('ready-to-show', () => {
    writeLog('info', 'window.ready_to_show', { windowId: win.id });
    win.show();
  });
  const sendWindowLifecycle = (type) => {
    if (win.isDestroyed()) return;
    win.webContents.send('app:window-lifecycle', { type });
    writeLog('info', 'window.lifecycle', { windowId: win.id, type });
  };
  win.on('minimize', () => sendWindowLifecycle('hidden'));
  win.on('hide', () => sendWindowLifecycle('hidden'));
  win.on('restore', () => sendWindowLifecycle('visible'));
  win.on('show', () => sendWindowLifecycle('visible'));
  win.on('focus', () => sendWindowLifecycle('focus'));
  const webContentsId = win.webContents.id;
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  win.webContents.on('will-navigate', (event, navigationUrl) => {
    writeLog('warn', 'window.will_navigate', { windowId: win.id, webContentsId, navigationUrl });
    killSessionsForWebContents(webContentsId, 'webcontents-will-navigate');
    if (navigationUrl !== APP_INDEX_URL) {
      event.preventDefault();
    }
  });
  win.webContents.on('did-fail-load', (_event, errorCode, errorDescription, validatedURL) => {
    writeLog('error', 'window.did_fail_load', {
      windowId: win.id,
      webContentsId,
      errorCode,
      errorDescription,
      validatedURL,
    });
  });
  win.webContents.on('render-process-gone', (_event, details) => {
    writeLog('error', 'window.render_process_gone', { windowId: win.id, webContentsId, details });
    killSessionsForWebContents(webContentsId, 'render-process-gone');
  });
  win.webContents.on('destroyed', () => {
    writeLog('warn', 'window.webcontents_destroyed', { windowId: win.id, webContentsId });
    killSessionsForWebContents(webContentsId, 'webcontents-destroyed');
  });
  win.on('close', (event) => {
    const liveSessionCount = countSessionsForWebContents(webContentsId);
    if (!confirmedAppQuit && liveSessionCount > 0) {
      event.preventDefault();
      requestCloseConfirmation(win, webContentsId, 'window-close');
      return;
    }
    writeLog('info', 'window.close_allowed', {
      windowId: win.id,
      webContentsId,
      liveSessionCount,
      confirmedAppQuit,
    });
  });
  win.on('closed', () => {
    writeLog('warn', 'window.closed', { windowId: win.id, webContentsId });
    killSessionsForWebContents(webContentsId, 'window-closed');
  });
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
  ipcMain.handle('app:live-log', () => ({
    entries: liveLogEntries.slice(),
    logFile: getLogFilePath(),
  }));
  ipcMain.handle('app:confirm-close', (event, payload) => {
    const requestId = normalizeSessionId(payload && payload.requestId);
    const confirmed = !!(payload && payload.confirmed);
    const request = pendingCloseRequests.get(requestId);
    const win = BrowserWindow.fromWebContents(event.sender);

    if (!request || request.ownerWebContentsId !== event.sender.id) {
      writeLog('warn', 'app.close.confirmation_rejected', {
        requestId,
        confirmed,
        senderWebContentsId: event.sender.id,
      });
      return { success: false, error: 'Close request is no longer active.' };
    }

    pendingCloseRequests.delete(requestId);
    if (win) win.__ezvibesCloseRequestId = null;

    if (!confirmed) {
      writeLog('info', 'app.close.cancelled', {
        requestId,
        senderWebContentsId: event.sender.id,
        liveSessionCount: countSessionsForWebContents(event.sender.id),
      });
      return { success: true };
    }

    confirmedAppQuit = true;
    writeLog('warn', 'app.close.confirmed', {
      requestId,
      senderWebContentsId: event.sender.id,
      liveSessionCount: countSessionsForWebContents(event.sender.id),
    });
    if (win && !win.isDestroyed()) setImmediate(() => win.close());
    return { success: true };
  });
  ipcMain.on('app:log', (event, payload) => {
    writeLog(
      (payload && payload.level) || 'info',
      (payload && payload.event) || 'renderer.event',
      Object.assign({}, (payload && payload.details) || {}, { senderWebContentsId: event.sender.id })
    );
  });
  ipcMain.handle('activate:file-path', () => ensureActivateFile());
  ipcMain.handle('activate:open-file', () => {
    try {
      const filePath = openActivateFileInNotepad();
      writeLog('info', 'activate.opened', { filePath });
      return { success: true, path: filePath };
    } catch (error) {
      writeLog('error', 'activate.open_failed', { error });
      return { success: false, error: (error && error.message) || String(error) };
    }
  });
  ipcMain.handle('inbox:list-markdown', () => listInboxMarkdownFiles());
  ipcMain.handle('inbox:read-markdown', (_event, filePath) => readInboxMarkdownFile(filePath));
  ipcMain.handle('fs:list-directory', (_, folderPath) => listDirectory(folderPath));
  ipcMain.handle('fs:create-folder', (_event, payload) => {
    try {
      return createFolder(payload);
    } catch (error) {
      writeLog('error', 'fs.folder_create_failed', { error });
      return { success: false, error: (error && error.message) || String(error) };
    }
  });
  ipcMain.handle('fs:rename-folder', (_event, payload) => {
    try {
      return renameFolder(payload);
    } catch (error) {
      writeLog('error', 'fs.folder_rename_failed', { error, path: payload && payload.path });
      return { success: false, error: (error && error.message) || String(error) };
    }
  });
  ipcMain.handle('fs:delete-folder', async (_event, payload) => {
    try {
      return await deleteFolder(payload);
    } catch (error) {
      writeLog('error', 'fs.folder_trash_failed', { error, path: payload && payload.path });
      return { success: false, error: (error && error.message) || String(error) };
    }
  });

  ipcMain.handle('terminal:create', (event, payload) => {
    const sessionId = payload && String(payload.sessionId || '');
    if (!sessionId) {
      writeLog('warn', 'terminal.create_rejected', { reason: 'missing-session-id', senderWebContentsId: event.sender.id });
      return { success: false, error: 'Missing session id.' };
    }
    const ownerWebContentsId = event.sender.id;
    const existingSession = sessions.get(sessionId);
    if (existingSession) {
      if (existingSession.ownerWebContentsId !== ownerWebContentsId) {
        writeLog('warn', 'terminal.create_rejected', {
          reason: 'owned-by-another-renderer',
          sessionId,
          ownerWebContentsId: existingSession.ownerWebContentsId,
          senderWebContentsId: ownerWebContentsId,
        });
        return { success: false, error: 'Session is owned by another renderer.' };
      }
      return { success: true, sessionId };
    }

    let cwd;
    try {
      cwd = assertDirectory(payload.cwd);
    } catch (error) {
      writeLog('warn', 'terminal.create_rejected', {
        reason: 'invalid-cwd',
        sessionId,
        senderWebContentsId: ownerWebContentsId,
        error,
      });
      return { success: false, error: error.message };
    }

    const agent = (payload && payload.agent === 'codex') ? 'codex' : 'claude';
    const cols = Math.max(20, Math.min(300, Number(payload.cols) || 100));
    const rows = Math.max(8, Math.min(120, Number(payload.rows) || 30));
    const env = buildPtyEnv();
    const launch = resolveAgentLaunch(agent, env);
    if (!launch.success) {
      writeLog('error', 'terminal.create_rejected', {
        reason: 'agent-launch-resolution-failed',
        sessionId,
        agent,
        cwd,
        senderWebContentsId: ownerWebContentsId,
        error: launch.error,
      });
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
      writeLog('error', 'terminal.spawn_failed', {
        sessionId,
        agent,
        cwd,
        displayCommand: launch.displayCommand,
        senderWebContentsId: ownerWebContentsId,
        error,
      });
      return {
        success: false,
        error: `Failed to launch ${AGENT_PROFILES[agent].label}: ${error.message}`,
      };
    }
    const sessionRecord = { pty: terminalProcess, ownerWebContentsId, cwd, agent };
    sessions.set(sessionId, sessionRecord);
    writeLog('info', 'terminal.created', {
      sessionId,
      agent,
      cwd,
      displayCommand: launch.displayCommand,
      ownerWebContentsId,
    });

    terminalProcess.onData((data) => {
      sendToSessionOwner(sessionRecord, 'terminal:data', { sessionId, data });
    });

    terminalProcess.onExit(({ exitCode }) => {
      if (sessions.get(sessionId) === sessionRecord) {
        sessions.delete(sessionId);
      }
      writeLog(exitCode === 0 ? 'info' : 'warn', 'terminal.exited', {
        sessionId,
        agent,
        cwd,
        exitCode,
        ownerWebContentsId,
      });
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

  ipcMain.handle('terminal:save-dropped-images', (event, payload) => {
    const sessionId = normalizeSessionId(payload && payload.sessionId);
    const sessionRecord = getOwnedSession(event, sessionId);
    if (!sessionRecord) {
      writeLog('warn', 'terminal.drop_images_rejected', {
        reason: 'missing-or-unowned-session',
        sessionId,
        senderWebContentsId: event.sender.id,
      });
      return { success: false, error: 'Session is not available.' };
    }

    const images = Array.isArray(payload && payload.images) ? payload.images : [];
    const savedPaths = [];
    const rejected = [];
    let totalBytes = 0;
    let dropDir = '';

    try {
      dropDir = getDroppedImageDirectory(sessionRecord.cwd);
    } catch (error) {
      writeLog('error', 'terminal.drop_images_directory_failed', { sessionId, cwd: sessionRecord.cwd, error });
      return { success: false, error: 'Could not prepare the dropped-image folder.' };
    }

    for (let index = 0; index < images.length; index += 1) {
      if (index >= DROPPED_IMAGE_MAX_COUNT) {
        rejected.push({ index, reason: 'too-many-files' });
        continue;
      }

      const image = images[index] || {};
      const name = String(image.name || '');
      const type = String(image.type || '');
      const buffer = normalizeDroppedImageBuffer(image.data);
      if (!buffer || buffer.length === 0) {
        rejected.push({ index, name, reason: 'empty-image-data' });
        continue;
      }
      if (!isAllowedDroppedImage(name, type)) {
        rejected.push({ index, name, reason: 'unsupported-image-type' });
        continue;
      }
      if (buffer.length > DROPPED_IMAGE_MAX_BYTES) {
        rejected.push({ index, name, reason: 'image-too-large' });
        continue;
      }
      totalBytes += buffer.length;
      if (totalBytes > DROPPED_IMAGE_TOTAL_MAX_BYTES) {
        rejected.push({ index, name, reason: 'drop-too-large' });
        continue;
      }

      try {
        const ext = getDroppedImageExtension(name, type);
        const base = sanitizeDroppedImageBase(name, index);
        const filePath = getUniqueDroppedImagePath(dropDir, base, ext);
        fs.writeFileSync(filePath, buffer, { flag: 'wx' });
        savedPaths.push(filePath);
      } catch (error) {
        rejected.push({ index, name, reason: 'write-failed' });
        writeLog('error', 'terminal.drop_image_write_failed', { sessionId, cwd: sessionRecord.cwd, error });
      }
    }

    writeLog('info', 'terminal.drop_images_saved', {
      sessionId,
      savedCount: savedPaths.length,
      rejectedCount: rejected.length,
      cwd: sessionRecord.cwd,
    });

    return {
      success: true,
      paths: savedPaths,
      savedCount: savedPaths.length,
      rejected,
    };
  });

  ipcMain.handle('terminal:close', (event, sessionId) => {
    const normalizedSessionId = normalizeSessionId(sessionId);
    const sessionRecord = sessions.get(normalizedSessionId);
    if (!sessionRecord) return { success: true };
    if (sessionRecord.ownerWebContentsId !== event.sender.id) {
      return { success: false, error: 'Session is owned by another renderer.' };
    }
    killSession(normalizedSessionId, sessionRecord, 'renderer-terminal-close');
    return { success: true };
  });

  ipcMain.handle('clipboard:read', () => clipboard.readText());
  ipcMain.handle('clipboard:write', (_, text) => clipboard.writeText(String(text || '')));
}

app.whenReady().then(() => {
  writeLog('info', 'app.ready', {
    userData: app.getPath('userData'),
    appVersion: app.getVersion(),
    electronVersion: process.versions.electron,
    chromeVersion: process.versions.chrome,
    nodeVersion: process.versions.node,
  });
  try {
    ensureActivateFile();
  } catch (error) {
    writeLog('error', 'activate.ensure_failed', { error });
  }
  Menu.setApplicationMenu(null);
  registerPermissionHandlers();
  registerIpcHandlers();
  createWindow();
});

app.on('before-quit', (event) => {
  if (!confirmedAppQuit && sessions.size > 0 && currentMainWindow && !currentMainWindow.isDestroyed()) {
    event.preventDefault();
    requestCloseConfirmation(currentMainWindow, currentMainWindow.webContents.id, 'before-quit');
    return;
  }

  writeLog('warn', 'app.before_quit', {
    confirmedAppQuit,
    liveSessionCount: sessions.size,
  });
  for (const [sessionId, sessionRecord] of sessions) {
    killSession(sessionId, sessionRecord, 'app-before-quit');
  }
});

app.on('window-all-closed', () => {
  writeLog('warn', 'app.window_all_closed', { confirmedAppQuit, liveSessionCount: sessions.size });
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    writeLog('info', 'app.activate_create_window');
    createWindow();
  }
});

process.on('uncaughtExceptionMonitor', (error, origin) => {
  writeLog('error', 'process.uncaught_exception', { origin, error });
});

process.on('unhandledRejection', (reason) => {
  writeLog('error', 'process.unhandled_rejection', { reason });
});
