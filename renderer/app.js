(function () {
  const api = window.controlPanel;
  const state = {
    currentPath: '',
    parentPath: '',
    entries: [],
    history: [],
    query: '',
    sessionsByPath: new Map(),
    sessionsById: new Map(),
    narrationByPath: new Map(),
    narrationOpen: false,
    previewPath: '',
  };

  const els = {};

  function init() {
    els.backBtn = document.getElementById('back-btn');
    els.upBtn = document.getElementById('up-btn');
    els.refreshBtn = document.getElementById('refresh-btn');
    els.pathBar = document.getElementById('path-bar');
    els.searchInput = document.getElementById('search-input');
    els.grid = document.getElementById('grid');
    els.quickPaths = document.getElementById('quick-paths');
    els.folderCount = document.getElementById('folder-count');
    els.contextMenu = document.getElementById('context-menu');
    els.sessionLayer = document.getElementById('session-layer');
    els.newSessionBtn = document.getElementById('new-session-btn');
    els.shell = document.querySelector('main.shell');
    els.narrationToggle = document.getElementById('narration-toggle');
    els.narrationSidebar = document.getElementById('narration-sidebar');
    els.narrationClose = document.getElementById('narration-close');
    els.narrationFolder = document.getElementById('narration-folder');
    els.narrationBody = document.getElementById('narration-body');

    bindEvents();
    bindTerminalEvents();

    Promise.all([api.getInitialPath(), api.getQuickPaths()])
      .then(([initialPath, quickPaths]) => {
        renderQuickPaths(quickPaths);
        return navigateTo(initialPath, { pushHistory: false });
      })
      .catch((error) => showError(error));
  }

  function bindEvents() {
    els.backBtn.addEventListener('click', goBack);
    els.upBtn.addEventListener('click', () => {
      if (state.parentPath && state.parentPath !== state.currentPath) {
        navigateTo(state.parentPath);
      }
    });
    els.refreshBtn.addEventListener('click', () => navigateTo(state.currentPath, { pushHistory: false }));
    els.searchInput.addEventListener('input', () => {
      state.query = els.searchInput.value.trim().toLowerCase();
      renderGrid();
    });
    els.newSessionBtn.addEventListener('click', () => launchClaudeForPath(state.currentPath, null));
    els.narrationToggle.addEventListener('click', () => {
      state.narrationOpen = !state.narrationOpen;
      els.narrationToggle.setAttribute('aria-pressed', state.narrationOpen ? 'true' : 'false');
      renderNarrationSidebar();
    });
    els.narrationClose.addEventListener('click', () => {
      state.narrationOpen = false;
      els.narrationToggle.setAttribute('aria-pressed', 'false');
      renderNarrationSidebar();
    });
    els.grid.addEventListener('click', (event) => {
      if (event.target !== els.grid) return;
      if (!state.previewPath) return;
      state.previewPath = '';
      for (const card of els.grid.querySelectorAll('.folder-card.preview-selected')) {
        card.classList.remove('preview-selected');
      }
      renderNarrationSidebar();
    });
    window.addEventListener('click', () => hideContextMenu());
    window.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') hideContextMenu();
    });
    window.addEventListener('resize', () => {
      for (const session of state.sessionsById.values()) scheduleStableFit(session);
    });

    window.addEventListener('keydown', async (event) => {
      if (!event.ctrlKey || event.altKey || event.metaKey) return;
      const key = (event.key || '').toLowerCase();
      if (!['c', 'v', 'x', 'a'].includes(key)) return;
      const target = event.target;
      if (!target) return;
      const inTerminal = !!(target.closest && target.closest('.terminal-host'));
      const inEditable = !inTerminal && target.matches && target.matches('input:not([readonly]), textarea:not([readonly]), [contenteditable="true"]');

      if (key === 'c') {
        if (inTerminal) {
          const session = findSessionForElement(target);
          if (!session) return;
          const sel = session.term.getSelection();
          if (sel) {
            event.preventDefault();
            event.stopPropagation();
            await api.writeClipboard(sel);
            session.term.clearSelection();
          }
          return;
        }
        if (inEditable) {
          const sel = getInputSelection(target);
          if (sel) {
            event.preventDefault();
            event.stopPropagation();
            await api.writeClipboard(sel);
          }
          return;
        }
        return;
      }

      if (key === 'v') {
        if (inTerminal) {
          event.preventDefault();
          event.stopPropagation();
          const text = await api.readClipboard();
          if (text) {
            const session = findSessionForElement(target);
            if (session) api.writeTerminal(session.id, text);
          }
          return;
        }
        if (inEditable) {
          event.preventDefault();
          event.stopPropagation();
          const text = await api.readClipboard();
          if (text) insertTextIntoInput(target, text);
          return;
        }
        return;
      }

      if (key === 'x') {
        if (inTerminal) return;
        if (inEditable) {
          const sel = getInputSelection(target);
          if (sel) {
            event.preventDefault();
            event.stopPropagation();
            await api.writeClipboard(sel);
            removeInputSelection(target);
          }
          return;
        }
        return;
      }

      if (key === 'a') {
        if (inTerminal) return;
        if (inEditable) {
          event.preventDefault();
          target.select();
        }
        return;
      }
    }, true);

    window.addEventListener('dragover', (event) => {
      event.preventDefault();
      if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy';
    });

    window.addEventListener('drop', async (event) => {
      event.preventDefault();
      if (!event.dataTransfer || !event.dataTransfer.files) return;
      const paths = [];
      for (let i = 0; i < event.dataTransfer.files.length; i++) {
        const file = event.dataTransfer.files[i];
        if (!file) continue;
        let filePath = '';
        try { filePath = api.getPathForFile(file); } catch {}
        if (filePath) paths.push(filePath);
      }
      if (paths.length === 0) return;
      const target = event.target;
      if (target && target.closest) {
        if (target.closest('.terminal-host')) {
          const session = findSessionForElement(target);
          if (session) {
            const text = paths.map(quotePath).join(' ') + ' ';
            api.writeTerminal(session.id, text);
            return;
          }
        }
        const input = target.closest('input:not([readonly]), textarea:not([readonly])');
        if (input) {
          insertTextIntoInput(input, paths.join(' '));
          return;
        }
      }
      try {
        await navigateTo(paths[0]);
      } catch {}
    });
  }

  function bindTerminalEvents() {
    api.onTerminalData(({ sessionId, data }) => {
      const session = state.sessionsById.get(sessionId);
      if (!session) return;
      session.term.write(data);
      handleTerminalOutput(session, data);
    });

    api.onTerminalExit(({ sessionId, exitCode }) => {
      const session = state.sessionsById.get(sessionId);
      if (!session) return;
      session.exited = true;
      session.term.writeln(`\r\n\x1b[90m[Claude session exited with code ${exitCode}]\x1b[0m`);
      session.windowEl.classList.add('session-exited');
      const subtitle = session.windowEl.querySelector('.session-subtitle');
      if (subtitle) subtitle.textContent = `Exited with code ${exitCode}`;
      const isError = exitCode !== 0;
      addNarrationEvent(session.path, isError ? 'error' : 'completed', `Claude session exited with code ${exitCode}.`);
      setNarrationSummary(session.path, isError ? 'error' : 'completed', isError ? `Exited with error code ${exitCode}.` : 'Session completed.');
    });
  }

  async function navigateTo(folderPath, options) {
    const opts = options || {};
    const listing = await api.listDirectory(folderPath);
    if (opts.pushHistory !== false && state.currentPath && state.currentPath !== listing.path) {
      state.history.push(state.currentPath);
    }
    state.currentPath = listing.path;
    state.parentPath = listing.parent;
    state.entries = listing.entries;
    state.previewPath = '';
    els.searchInput.value = '';
    state.query = '';
    renderPath();
    renderGrid();
    renderNarrationSidebar();
  }

  function goBack() {
    const previous = state.history.pop();
    if (previous) navigateTo(previous, { pushHistory: false });
  }

  function renderQuickPaths(paths) {
    els.quickPaths.innerHTML = '';
    for (const item of paths) {
      const button = document.createElement('button');
      button.className = 'quick-path';
      button.textContent = item.name;
      button.title = item.path;
      button.addEventListener('click', () => navigateTo(item.path));
      els.quickPaths.appendChild(button);
    }
  }

  function renderPath() {
    els.pathBar.textContent = state.currentPath;
    els.backBtn.disabled = state.history.length === 0;
    els.upBtn.disabled = !state.parentPath || state.parentPath === state.currentPath;
  }

  function renderGrid() {
    const query = state.query;
    const entries = state.entries.filter((entry) => !query || entry.name.toLowerCase().includes(query));
    els.grid.innerHTML = '';
    els.folderCount.textContent = `${entries.length} item${entries.length === 1 ? '' : 's'}`;

    for (const entry of entries) {
      const card = document.createElement('button');
      card.className = `folder-card ${entry.kind === 'directory' ? 'is-folder' : 'is-file'}`;
      card.dataset.path = entry.path;
      card.title = entry.path;

      const session = state.sessionsByPath.get(entry.path);
      if (session) {
        if (session.minimized) card.classList.add('session-minimized');
        else card.classList.add('session-open');
      }
      if (state.previewPath && entry.path === state.previewPath) {
        card.classList.add('preview-selected');
      }

      const icon = document.createElement('span');
      icon.className = 'folder-icon';
      if (entry.kind === 'file') icon.classList.add('file-icon');

      const name = document.createElement('span');
      name.className = 'folder-name';
      name.textContent = entry.name;

      card.append(icon, name);

      card.addEventListener('click', () => {
        if (entry.kind !== 'directory') return;
        state.previewPath = entry.path;
        for (const otherCard of els.grid.querySelectorAll('.folder-card.preview-selected')) {
          otherCard.classList.remove('preview-selected');
        }
        card.classList.add('preview-selected');
        renderNarrationSidebar();
      });

      card.addEventListener('dblclick', () => {
        if (entry.kind !== 'directory') return;
        launchClaudeForPath(entry.path, card);
      });

      card.addEventListener('contextmenu', (event) => {
        event.preventDefault();
        event.stopPropagation();
        showContextMenu(entry, event.clientX, event.clientY, card);
      });

      els.grid.appendChild(card);
    }
  }

  function showContextMenu(entry, x, y, sourceCard) {
    hideContextMenu();
    els.contextMenu.innerHTML = '';

    if (entry.kind === 'directory') {
      addMenuItem('Open Folder', () => navigateTo(entry.path));
      addMenuItem('Launch Claude', () => launchClaudeForPath(entry.path, sourceCard));
      const session = state.sessionsByPath.get(entry.path);
      if (session) {
        addMenuItem(session.minimized ? 'Restore Session' : 'Minimize Session', () => {
          if (session.minimized) restoreSession(session, sourceCard);
          else minimizeSession(session, sourceCard);
        });
        addMenuItem('Close Session', () => closeSession(session));
      }
    } else {
      addMenuItem('No folder actions', null, true);
    }

    els.contextMenu.hidden = false;
    const rect = els.contextMenu.getBoundingClientRect();
    const left = Math.min(x, window.innerWidth - rect.width - 12);
    const top = Math.min(y, window.innerHeight - rect.height - 12);
    els.contextMenu.style.left = `${Math.max(12, left)}px`;
    els.contextMenu.style.top = `${Math.max(12, top)}px`;
  }

  function addMenuItem(label, action, disabled) {
    const button = document.createElement('button');
    button.className = 'context-menu-item';
    button.textContent = label;
    button.disabled = !!disabled;
    if (action) {
      button.addEventListener('click', (event) => {
        event.stopPropagation();
        hideContextMenu();
        action();
      });
    }
    els.contextMenu.appendChild(button);
  }

  function hideContextMenu() {
    els.contextMenu.hidden = true;
  }

  async function launchClaudeForPath(folderPath, sourceCard) {
    const existing = state.sessionsByPath.get(folderPath);
    if (existing) {
      restoreSession(existing, sourceCard || findCard(folderPath));
      return;
    }

    const session = createSession(folderPath);
    state.sessionsByPath.set(folderPath, session);
    state.sessionsById.set(session.id, session);
    addNarrationEvent(folderPath, 'session-started', `Claude launched in ${basename(folderPath)}.`);
    setNarrationSummary(folderPath, 'active', 'Claude session started.');
    renderGrid();

    animateOpen(session, sourceCard || findCard(folderPath));
    session.term.open(session.terminalEl);
    session.term.onData((data) => handleTerminalInput(session, data));
    await fitAfterStableLayout(session, { focus: true, waitForAnimation: true });
    observeSessionSize(session);

    const result = await api.createTerminal({
      sessionId: session.id,
      cwd: folderPath,
      cols: session.term.cols,
      rows: session.term.rows,
    });

    if (!result || !result.success) {
      session.term.writeln(`\r\n\x1b[31m${result ? result.error : 'Failed to launch Claude.'}\x1b[0m`);
    }
  }

  function createSession(folderPath) {
    const name = basename(folderPath);
    const id = crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
    const windowEl = document.createElement('section');
    windowEl.className = 'folder-terminal';
    windowEl.dataset.sessionId = id;
    windowEl.innerHTML = `
      <div class="folder-terminal-nubbin" title="Right-click to rename">
        <span class="nubbin-text"></span>
      </div>
      <div class="folder-terminal-tab">
        <div class="session-controls">
          <button class="session-control minimize" title="Minimize">_</button>
          <button class="session-control close" title="Close">×</button>
        </div>
      </div>
      <div class="terminal-pocket">
        <div class="terminal-host"></div>
      </div>
    `;

    const nubbinEl = windowEl.querySelector('.folder-terminal-nubbin');
    nubbinEl.querySelector('.nubbin-text').textContent = name;
    const terminalEl = windowEl.querySelector('.terminal-host');
    els.sessionLayer.appendChild(windowEl);

    const term = new Terminal({
      cursorBlink: true,
      fontFamily: 'Cascadia Mono, Consolas, "Courier New", monospace',
      fontSize: 13,
      lineHeight: 1.15,
      theme: {
        background: '#060606',
        foreground: '#f6f1d5',
        cursor: '#ffb300',
        selectionBackground: '#50431f',
        black: '#0c0c0c',
        red: '#ff5f57',
        green: '#5af78e',
        yellow: '#f3f99d',
        blue: '#57c7ff',
        magenta: '#ff6ac1',
        cyan: '#9aedfe',
        white: '#f1f1f0',
        brightBlack: '#686868',
        brightRed: '#ff5f57',
        brightGreen: '#5af78e',
        brightYellow: '#f3f99d',
        brightBlue: '#57c7ff',
        brightMagenta: '#ff6ac1',
        brightCyan: '#9aedfe',
        brightWhite: '#ffffff',
      },
    });

    const fitAddon = new FitAddon.FitAddon();
    term.loadAddon(fitAddon);

    const session = {
      id,
      path: folderPath,
      name,
      windowEl,
      terminalEl,
      nubbinEl,
      term,
      fitAddon,
      resizeObserver: null,
      resizeTimer: null,
      minimized: false,
      exited: false,
    };

    windowEl.querySelector('.minimize').addEventListener('click', () => minimizeSession(session, findCard(folderPath)));
    windowEl.querySelector('.close').addEventListener('click', () => closeSession(session));

    terminalEl.addEventListener('contextmenu', (event) => {
      event.preventDefault();
      event.stopPropagation();
      showTerminalContextMenu(session, event.clientX, event.clientY);
    });

    nubbinEl.addEventListener('contextmenu', (event) => {
      event.preventDefault();
      event.stopPropagation();
      showNubbinContextMenu(session, event.clientX, event.clientY);
    });

    return session;
  }

  function minimizeSession(session, sourceCard) {
    if (session.minimized) return;
    const card = sourceCard || findCard(session.path);
    setAnimationTarget(session.windowEl, card, '--to-x', '--to-y');
    session.windowEl.classList.remove('opening');
    session.windowEl.classList.add('minimizing');
    session.windowEl.addEventListener('animationend', function handleEnd() {
      session.windowEl.removeEventListener('animationend', handleEnd);
      session.windowEl.classList.remove('minimizing');
      session.windowEl.hidden = true;
      session.minimized = true;
      renderGrid();
    });
  }

  function restoreSession(session, sourceCard) {
    session.windowEl.hidden = false;
    session.minimized = false;
    animateOpen(session, sourceCard || findCard(session.path));
    renderGrid();
    fitAfterStableLayout(session, { focus: true, waitForAnimation: true });
  }

  async function closeSession(session) {
    await api.closeTerminal(session.id);
    if (session.resizeObserver) session.resizeObserver.disconnect();
    if (session.resizeTimer) clearTimeout(session.resizeTimer);
    session.term.dispose();
    session.windowEl.remove();
    state.sessionsById.delete(session.id);
    state.sessionsByPath.delete(session.path);
    renderGrid();
  }

  function animateOpen(session, sourceCard) {
    setAnimationTarget(session.windowEl, sourceCard, '--from-x', '--from-y');
    session.windowEl.classList.remove('minimizing');
    session.windowEl.classList.add('opening');
    session.windowEl.addEventListener('animationend', function handleEnd() {
      session.windowEl.removeEventListener('animationend', handleEnd);
      session.windowEl.classList.remove('opening');
    });
  }

  function setAnimationTarget(element, sourceCard, xVar, yVar) {
    const cardRect = sourceCard ? sourceCard.getBoundingClientRect() : null;
    const ownRect = element.getBoundingClientRect();
    const targetX = cardRect ? cardRect.left + cardRect.width / 2 : window.innerWidth / 2;
    const targetY = cardRect ? cardRect.top + cardRect.height / 2 : window.innerHeight / 2;
    const ownX = ownRect.left + ownRect.width / 2;
    const ownY = ownRect.top + ownRect.height / 2;
    element.style.setProperty(xVar, `${targetX - ownX}px`);
    element.style.setProperty(yVar, `${targetY - ownY}px`);
  }

  function observeSessionSize(session) {
    if (session.resizeObserver || typeof ResizeObserver !== 'function') return;
    session.resizeObserver = new ResizeObserver(() => scheduleStableFit(session));
    session.resizeObserver.observe(session.terminalEl);
  }

  function scheduleStableFit(session, options) {
    if (session.resizeTimer) clearTimeout(session.resizeTimer);
    session.resizeTimer = setTimeout(() => {
      session.resizeTimer = null;
      const opts = options || {};
      fitAfterStableLayout(session, {
        ...opts,
        waitForAnimation: opts.waitForAnimation || session.windowEl.classList.contains('opening'),
      });
    }, 80);
  }

  async function fitAfterStableLayout(session, options) {
    const opts = options || {};
    if (opts.waitForAnimation) await waitForOpeningAnimation(session);
    await waitForFonts();
    await nextFrame();
    await nextFrame();
    fitSession(session);
    if (opts.focus) session.term.focus();
  }

  function fitSession(session) {
    if (session.minimized || session.windowEl.hidden) return;
    try {
      session.fitAddon.fit();
      api.resizeTerminal(session.id, session.term.cols, session.term.rows);
    } catch {}
  }

  function waitForOpeningAnimation(session) {
    if (!session.windowEl.classList.contains('opening')) return Promise.resolve();
    return new Promise((resolve) => {
      let done = false;
      const finish = () => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        session.windowEl.removeEventListener('animationend', finish);
        resolve();
      };
      const timer = setTimeout(finish, 500);
      session.windowEl.addEventListener('animationend', finish);
    });
  }

  function waitForFonts() {
    if (!document.fonts || !document.fonts.ready) return Promise.resolve();
    return document.fonts.ready.catch(() => {});
  }

  function nextFrame() {
    return new Promise((resolve) => requestAnimationFrame(resolve));
  }

  function findCard(folderPath) {
    return els.grid.querySelector(`[data-path="${cssEscape(folderPath)}"]`);
  }

  function cssEscape(value) {
    if (window.CSS && typeof window.CSS.escape === 'function') return window.CSS.escape(value);
    return String(value).replace(/"/g, '\\"');
  }

  function basename(folderPath) {
    const normalized = folderPath.replace(/[\\/]+$/, '');
    const slash = Math.max(normalized.lastIndexOf('\\'), normalized.lastIndexOf('/'));
    return slash >= 0 ? normalized.slice(slash + 1) : normalized;
  }

  function showError(error) {
    els.grid.innerHTML = `<div class="error-panel">${escapeHtml(error.message || String(error))}</div>`;
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function findSessionForElement(element) {
    if (!element || !element.closest) return null;
    const sessionContainer = element.closest('.folder-terminal');
    if (!sessionContainer) return null;
    const sessionId = sessionContainer.dataset.sessionId;
    return state.sessionsById.get(sessionId) || null;
  }

  function insertTextIntoInput(input, text) {
    if (!input || typeof text !== 'string' || !text) return;
    const start = typeof input.selectionStart === 'number' ? input.selectionStart : input.value.length;
    const end = typeof input.selectionEnd === 'number' ? input.selectionEnd : input.value.length;
    const value = input.value;
    input.value = value.slice(0, start) + text + value.slice(end);
    const cursor = start + text.length;
    try { input.selectionStart = input.selectionEnd = cursor; } catch {}
    input.dispatchEvent(new Event('input', { bubbles: true }));
  }

  function getInputSelection(input) {
    if (!input || typeof input.selectionStart !== 'number') return '';
    const s = input.selectionStart, e = input.selectionEnd;
    if (s === e) return '';
    return input.value.slice(s, e);
  }

  function removeInputSelection(input) {
    if (!input || typeof input.selectionStart !== 'number') return;
    const start = input.selectionStart, end = input.selectionEnd;
    if (start === end) return;
    const value = input.value;
    input.value = value.slice(0, start) + value.slice(end);
    try { input.selectionStart = input.selectionEnd = start; } catch {}
    input.dispatchEvent(new Event('input', { bubbles: true }));
  }

  function quotePath(p) {
    if (!p) return '';
    return `"${p}"`;
  }

  function showNubbinContextMenu(session, x, y) {
    hideContextMenu();
    els.contextMenu.innerHTML = '';
    addMenuItem('Rename', () => startRename(session));
    els.contextMenu.hidden = false;
    const rect = els.contextMenu.getBoundingClientRect();
    const left = Math.min(x, window.innerWidth - rect.width - 12);
    const top = Math.min(y, window.innerHeight - rect.height - 12);
    els.contextMenu.style.left = `${Math.max(12, left)}px`;
    els.contextMenu.style.top = `${Math.max(12, top)}px`;
  }

  function startRename(session) {
    const nubbin = session.nubbinEl;
    if (!nubbin || nubbin.querySelector('.nubbin-input')) return;
    const original = session.name;
    nubbin.innerHTML = '';
    const input = document.createElement('input');
    input.className = 'nubbin-input';
    input.type = 'text';
    input.value = original;
    input.maxLength = 120;
    input.spellcheck = false;
    nubbin.appendChild(input);
    input.focus();
    input.select();

    let settled = false;
    const finish = (rawValue) => {
      if (settled) return;
      settled = true;
      const trimmed = (rawValue || '').trim();
      const finalName = trimmed || original;
      session.name = finalName;
      nubbin.innerHTML = '';
      const span = document.createElement('span');
      span.className = 'nubbin-text';
      span.textContent = finalName;
      nubbin.appendChild(span);
    };

    input.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        event.stopPropagation();
        finish(input.value);
      } else if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        finish(original);
      } else {
        event.stopPropagation();
      }
    });
    input.addEventListener('blur', () => finish(input.value));
    input.addEventListener('click', (event) => event.stopPropagation());
    input.addEventListener('mousedown', (event) => event.stopPropagation());
  }

  function showTerminalContextMenu(session, x, y) {
    hideContextMenu();
    els.contextMenu.innerHTML = '';

    const selection = session.term.getSelection();
    addMenuItem('Copy', () => {
      const sel = session.term.getSelection();
      if (sel) api.writeClipboard(sel);
    }, !selection);
    addMenuItem('Paste', async () => {
      const text = await api.readClipboard();
      if (text) api.writeTerminal(session.id, text);
    });
    addMenuItem('Select All', () => {
      session.term.selectAll();
    });

    els.contextMenu.hidden = false;
    const rect = els.contextMenu.getBoundingClientRect();
    const left = Math.min(x, window.innerWidth - rect.width - 12);
    const top = Math.min(y, window.innerHeight - rect.height - 12);
    els.contextMenu.style.left = `${Math.max(12, left)}px`;
    els.contextMenu.style.top = `${Math.max(12, top)}px`;
  }

  function getNarration(folderPath) {
    return state.narrationByPath.get(folderPath) || null;
  }

  function ensureNarration(folderPath) {
    let n = state.narrationByPath.get(folderPath);
    if (!n) {
      n = {
        folderPath,
        folderName: basename(folderPath),
        status: 'idle',
        summary: '',
        events: [],
        transcriptBuffer: '',
        seenHints: {},
      };
      state.narrationByPath.set(folderPath, n);
    }
    return n;
  }

  function addNarrationEvent(folderPath, kind, text) {
    const n = ensureNarration(folderPath);
    const id = crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
    n.events.push({ id, time: Date.now(), kind, text });
    if ((state.previewPath || state.currentPath) === folderPath) renderNarrationSidebar();
  }

  function setNarrationSummary(folderPath, status, summary) {
    const n = ensureNarration(folderPath);
    n.status = status;
    n.summary = summary;
    if ((state.previewPath || state.currentPath) === folderPath) renderNarrationSidebar();
  }

  function renderNarrationSidebar() {
    if (!els.narrationSidebar) return;
    els.narrationSidebar.hidden = !state.narrationOpen;
    if (els.shell) els.shell.classList.toggle('narration-open', state.narrationOpen);
    if (!state.narrationOpen) return;

    const folderPath = state.previewPath || state.currentPath;
    els.narrationFolder.textContent = folderPath || '';
    els.narrationBody.innerHTML = '';

    const n = getNarration(folderPath);
    if (!n || n.events.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'narration-empty';
      empty.textContent = 'No Claude activity for this folder yet.\nRight-click a folder and launch Claude to start a narrated session.';
      els.narrationBody.appendChild(empty);
      return;
    }

    const summary = document.createElement('section');
    summary.className = 'narration-summary';
    const status = document.createElement('span');
    status.className = `narration-status narration-status-${n.status || 'idle'}`;
    status.textContent = n.status || 'idle';
    const summaryText = document.createElement('p');
    summaryText.className = 'narration-summary-text';
    summaryText.textContent = n.summary || '';
    summary.append(status, summaryText);

    const timeline = document.createElement('div');
    timeline.className = 'narration-timeline';
    for (const event of n.events) {
      const item = document.createElement('div');
      item.className = `narration-event narration-event-${event.kind}`;
      const time = document.createElement('div');
      time.className = 'narration-event-time';
      time.textContent = new Date(event.time).toLocaleTimeString();
      const text = document.createElement('div');
      text.className = 'narration-event-text';
      text.textContent = event.text;
      item.append(time, text);
      timeline.appendChild(item);
    }

    els.narrationBody.append(summary, timeline);
    els.narrationBody.scrollTop = els.narrationBody.scrollHeight;
  }

  function shorten(value, max) {
    const s = String(value || '');
    if (s.length <= max) return s;
    return s.slice(0, max - 1) + '…';
  }

  function handleTerminalInput(session, data) {
    api.writeTerminal(session.id, data);
    if (typeof session.inputBuffer !== 'string') session.inputBuffer = '';
    const clean = data.replace(/\x1b\[[\x30-\x3f]*[\x20-\x2f]*[\x40-\x7e]|\x1bO[\x40-\x7e]/g, '');
    for (const ch of clean) {
      if (ch === '\r' || ch === '\n') {
        const buf = session.inputBuffer.trim();
        session.inputBuffer = '';
        if (buf) {
          addNarrationEvent(session.path, 'user-task', `User asked: "${shorten(buf, 180)}"`);
          setNarrationSummary(session.path, 'active', `Working on: ${shorten(buf, 100)}`);
        }
      } else if (ch === '\x7f' || ch === '\b') {
        session.inputBuffer = session.inputBuffer.slice(0, -1);
      } else if (ch >= ' ') {
        session.inputBuffer += ch;
      }
    }
  }

  const NARRATION_HINTS = [
    {
      key: 'agent-launched',
      test: (chunk) => /sub.?agents?/i.test(chunk) && /(launch|spawn|started|orchestr)/i.test(chunk),
      kind: 'agent-activity',
      text: 'Claude appears to have launched sub-agents.',
    },
    {
      key: 'agent-returned',
      test: (chunk) => /all .*sub.?agents?.*(returned|complete|finished)/i.test(chunk),
      kind: 'agent-activity',
      text: 'All sub-agents appear to have returned.',
    },
    {
      key: 'plan-created',
      test: (chunk) => /(plan|implementation plan|comprehensive plan)/i.test(chunk) && /(created|drafted|wrote|prepared)/i.test(chunk),
      kind: 'plan-created',
      text: 'Claude created a plan.',
    },
  ];

  function handleTerminalOutput(session, data) {
    const n = ensureNarration(session.path);
    n.transcriptBuffer = (n.transcriptBuffer + data).slice(-20000);
    const tail = n.transcriptBuffer.slice(-4000);
    for (const hint of NARRATION_HINTS) {
      if (n.seenHints[hint.key]) continue;
      if (!hint.test(tail)) continue;
      n.seenHints[hint.key] = true;
      if (hint.asSummary) {
        setNarrationSummary(session.path, 'completed', hint.text);
      } else {
        addNarrationEvent(session.path, hint.kind, hint.text);
      }
    }
  }

  window.addEventListener('DOMContentLoaded', init);
})();
