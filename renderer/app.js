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
    window.addEventListener('click', () => hideContextMenu());
    window.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') hideContextMenu();
    });
    window.addEventListener('resize', () => {
      for (const session of state.sessionsById.values()) scheduleStableFit(session);
    });
  }

  function bindTerminalEvents() {
    api.onTerminalData(({ sessionId, data }) => {
      const session = state.sessionsById.get(sessionId);
      if (session) session.term.write(data);
    });

    api.onTerminalExit(({ sessionId, exitCode }) => {
      const session = state.sessionsById.get(sessionId);
      if (!session) return;
      session.exited = true;
      session.term.writeln(`\r\n\x1b[90m[Claude session exited with code ${exitCode}]\x1b[0m`);
      session.windowEl.classList.add('session-exited');
      const subtitle = session.windowEl.querySelector('.session-subtitle');
      if (subtitle) subtitle.textContent = `Exited with code ${exitCode}`;
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
    els.searchInput.value = '';
    state.query = '';
    renderPath();
    renderGrid();
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

      const icon = document.createElement('span');
      icon.className = 'folder-icon';
      if (entry.kind === 'file') icon.classList.add('file-icon');

      const name = document.createElement('span');
      name.className = 'folder-name';
      name.textContent = entry.name;

      card.append(icon, name);

      card.addEventListener('dblclick', () => {
        const existing = state.sessionsByPath.get(entry.path);
        if (existing && existing.minimized) {
          restoreSession(existing, card);
          return;
        }
        if (entry.kind === 'directory') navigateTo(entry.path);
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
    renderGrid();

    animateOpen(session, sourceCard || findCard(folderPath));
    session.term.open(session.terminalEl);
    session.term.onData((data) => api.writeTerminal(session.id, data));
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
      <div class="folder-terminal-tab">
        <div>
          <div class="session-title"></div>
          <div class="session-subtitle">claude --dangerously-skip-permissions</div>
        </div>
        <div class="session-controls">
          <button class="session-control minimize" title="Minimize">_</button>
          <button class="session-control close" title="Close">×</button>
        </div>
      </div>
      <div class="terminal-pocket">
        <div class="terminal-host"></div>
      </div>
    `;

    windowEl.querySelector('.session-title').textContent = name;
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
      term,
      fitAddon,
      resizeObserver: null,
      resizeTimer: null,
      minimized: false,
      exited: false,
    };

    windowEl.querySelector('.minimize').addEventListener('click', () => minimizeSession(session, findCard(folderPath)));
    windowEl.querySelector('.close').addEventListener('click', () => closeSession(session));

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

  window.addEventListener('DOMContentLoaded', init);
})();
