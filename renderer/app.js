(function () {
  const api = window.controlPanel;
  const state = {
    currentPath: '',
    parentPath: '',
    entries: [],
    history: [],
    query: '',
    windowsByPath: new Map(),
    tabsById: new Map(),
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
      for (const sessionWindow of state.windowsByPath.values()) {
        const tab = getActiveTab(sessionWindow);
        if (tab) scheduleStableFit(tab);
      }
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
      const tab = state.tabsById.get(sessionId);
      if (!tab) return;
      tab.term.write(data);
      handleTerminalOutput(tab, data);
    });

    api.onTerminalExit(({ sessionId, exitCode }) => {
      const tab = state.tabsById.get(sessionId);
      if (!tab) return;
      tab.ptyAlive = false;
      tab.exited = true;
      tab.term.writeln(`\r\n\x1b[90m[Claude session exited with code ${exitCode}]\x1b[0m`);
      tab.sessionWindow.windowEl.classList.add('session-exited');
      const isError = exitCode !== 0;
      const folderPath = tab.sessionWindow.folderPath;
      addNarrationEvent(folderPath, isError ? 'error' : 'completed', `Claude session exited with code ${exitCode}.`);
      setNarrationSummary(folderPath, isError ? 'error' : 'completed', isError ? `Exited with error code ${exitCode}.` : 'Session completed.');
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

      const sessionWindow = state.windowsByPath.get(entry.path);
      if (sessionWindow) {
        if (sessionWindow.minimized) card.classList.add('session-minimized');
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
      const sessionWindow = state.windowsByPath.get(entry.path);
      if (sessionWindow) {
        addMenuItem(sessionWindow.minimized ? 'Restore Session' : 'Minimize Session', () => {
          if (sessionWindow.minimized) restoreSessionWindow(sessionWindow, sourceCard);
          else minimizeSessionWindow(sessionWindow, sourceCard);
        });
        addMenuItem('Close Session', () => closeSessionWindow(sessionWindow));
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
    const existing = state.windowsByPath.get(folderPath);
    if (existing) {
      restoreSessionWindow(existing, sourceCard || findCard(folderPath));
      return;
    }

    const sessionWindow = createSessionWindow(folderPath);
    state.windowsByPath.set(folderPath, sessionWindow);
    addNarrationEvent(folderPath, 'session-started', `Claude launched in ${basename(folderPath)}.`);
    setNarrationSummary(folderPath, 'active', 'Claude session started.');
    renderGrid();

    const tab = getActiveTab(sessionWindow);
    animateOpen(sessionWindow, sourceCard || findCard(folderPath));
    tab.term.open(tab.terminalEl);
    tab.term.onData((data) => handleTerminalInput(tab, data));
    await fitAfterStableLayout(tab, { focus: true, waitForAnimation: true });
    observeSessionSize(sessionWindow);

    const result = await api.createTerminal({
      sessionId: tab.id,
      cwd: folderPath,
      cols: tab.term.cols,
      rows: tab.term.rows,
    });

    if (!result || !result.success) {
      tab.ptyAlive = false;
      tab.term.writeln(`\r\n\x1b[31m${result ? result.error : 'Failed to launch Claude.'}\x1b[0m`);
    }
  }

  const XTERM_THEME = {
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
  };

  function makeId() {
    return crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
  }

  function getActiveTab(sessionWindow) {
    if (!sessionWindow) return null;
    const id = sessionWindow.activeTabId;
    if (!id) return sessionWindow.tabs[0] || null;
    return sessionWindow.tabs.find((t) => t.id === id) || sessionWindow.tabs[0] || null;
  }

  function getTabLabel(tab) {
    if (!tab) return '';
    return tab.customName || String(tab.numericLabel);
  }

  function createSessionWindow(folderPath) {
    const name = basename(folderPath);
    const windowId = makeId();
    const windowEl = document.createElement('section');
    windowEl.className = 'folder-terminal';
    windowEl.dataset.windowId = windowId;
    windowEl.innerHTML = `
      <div class="folder-terminal-tab-strip" role="tablist" aria-label="Claude sessions"></div>
      <div class="folder-terminal-tab">
        <div class="session-controls">
          <button class="session-control minimize" title="Minimize">_</button>
          <button class="session-control close" title="Close">×</button>
        </div>
      </div>
      <div class="terminal-pocket">
        <div class="terminal-host is-active"></div>
      </div>
    `;

    const tabStripEl = windowEl.querySelector('.folder-terminal-tab-strip');
    const addTabBtnEl = document.createElement('button');
    addTabBtnEl.type = 'button';
    addTabBtnEl.className = 'folder-terminal-tab-add';
    addTabBtnEl.title = 'New tab';
    addTabBtnEl.textContent = '+';
    tabStripEl.appendChild(addTabBtnEl);

    const terminalPocketEl = windowEl.querySelector('.terminal-pocket');
    const terminalEl = windowEl.querySelector('.terminal-host');
    els.sessionLayer.appendChild(windowEl);

    const sessionWindow = {
      id: windowId,
      folderPath,
      folderName: name,
      windowEl,
      tabStripEl,
      addTabBtnEl,
      terminalPocketEl,
      tabs: [],
      activeTabId: null,
      minimized: false,
      nextTabNumber: 1,
      resizeObserver: null,
      resizeTimer: null,
    };

    // Build the first tab and attach its chip.
    const firstTab = buildTab(sessionWindow, terminalEl);
    sessionWindow.tabs.push(firstTab);
    sessionWindow.activeTabId = firstTab.id;
    state.tabsById.set(firstTab.id, firstTab);
    attachTabChip(sessionWindow, firstTab, { active: true });

    windowEl.querySelector('.minimize').addEventListener('click', () => minimizeSessionWindow(sessionWindow, findCard(folderPath)));
    windowEl.querySelector('.close').addEventListener('click', () => closeSessionWindow(sessionWindow));

    terminalEl.addEventListener('contextmenu', (event) => {
      event.preventDefault();
      event.stopPropagation();
      const tab = findTabForTerminalHost(terminalEl) || firstTab;
      showTerminalContextMenu(tab, event.clientX, event.clientY);
    });

    return sessionWindow;
  }

  function attachTabChip(sessionWindow, tab, options) {
    const opts = options || {};
    const chip = document.createElement('div');
    chip.className = 'folder-terminal-tab-chip';
    if (opts.active) chip.classList.add('is-active');
    chip.setAttribute('role', 'presentation');
    chip.dataset.tabId = tab.id;

    const activateBtn = document.createElement('button');
    activateBtn.type = 'button';
    activateBtn.className = 'tab-activate';
    activateBtn.setAttribute('role', 'tab');
    activateBtn.setAttribute('aria-selected', opts.active ? 'true' : 'false');
    const labelText = getTabLabel(tab);
    activateBtn.title = `Tab ${labelText}`;

    const labelSpan = document.createElement('span');
    labelSpan.className = 'tab-label';
    labelSpan.textContent = labelText;
    activateBtn.appendChild(labelSpan);

    const closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.className = 'tab-close';
    closeBtn.title = 'Close tab';
    closeBtn.textContent = '×';

    chip.appendChild(activateBtn);
    chip.appendChild(closeBtn);

    // Insert the chip before the add button so the + always stays on the right.
    sessionWindow.tabStripEl.insertBefore(chip, sessionWindow.addTabBtnEl);

    tab.tabChipEl = chip;
    tab.tabLabelEl = labelSpan;
    tab.closeBtnEl = closeBtn;

    chip.addEventListener('contextmenu', (event) => {
      event.preventDefault();
      event.stopPropagation();
      showTabContextMenu(tab, event.clientX, event.clientY);
    });

    return chip;
  }

  function buildTab(sessionWindow, terminalEl) {
    const id = makeId();
    terminalEl.dataset.tabId = id;

    const term = new Terminal({
      cursorBlink: true,
      fontFamily: 'Cascadia Mono, Consolas, "Courier New", monospace',
      fontSize: 13,
      lineHeight: 1.15,
      theme: XTERM_THEME,
    });
    const fitAddon = new FitAddon.FitAddon();
    term.loadAddon(fitAddon);

    const tab = {
      id,
      sessionWindow,
      numericLabel: sessionWindow.nextTabNumber++,
      customName: null,
      ptyAlive: true,
      exited: false,
      inputBuffer: '',
      term,
      fitAddon,
      terminalEl,
      tabChipEl: null,
      tabLabelEl: null,
      closeBtnEl: null,
    };

    return tab;
  }

  function findTabForTerminalHost(hostEl) {
    if (!hostEl) return null;
    const id = hostEl.dataset && hostEl.dataset.tabId;
    if (!id) return null;
    return state.tabsById.get(id) || null;
  }

  function minimizeSessionWindow(sessionWindow, sourceCard) {
    if (sessionWindow.minimized) return;
    const card = sourceCard || findCard(sessionWindow.folderPath);
    setAnimationTarget(sessionWindow.windowEl, card, '--to-x', '--to-y');
    sessionWindow.windowEl.classList.remove('opening');
    sessionWindow.windowEl.classList.add('minimizing');
    sessionWindow.windowEl.addEventListener('animationend', function handleEnd() {
      sessionWindow.windowEl.removeEventListener('animationend', handleEnd);
      sessionWindow.windowEl.classList.remove('minimizing');
      sessionWindow.windowEl.hidden = true;
      sessionWindow.minimized = true;
      renderGrid();
    });
  }

  function restoreSessionWindow(sessionWindow, sourceCard) {
    sessionWindow.windowEl.hidden = false;
    sessionWindow.minimized = false;
    animateOpen(sessionWindow, sourceCard || findCard(sessionWindow.folderPath));
    renderGrid();
    const tab = getActiveTab(sessionWindow);
    if (tab) fitAfterStableLayout(tab, { focus: true, waitForAnimation: true });
  }

  async function closeSessionWindow(sessionWindow) {
    if (sessionWindow.resizeObserver) sessionWindow.resizeObserver.disconnect();
    if (sessionWindow.resizeTimer) clearTimeout(sessionWindow.resizeTimer);
    for (const tab of sessionWindow.tabs.slice()) {
      try { await api.closeTerminal(tab.id); } catch {}
      try { tab.term.dispose(); } catch {}
      state.tabsById.delete(tab.id);
    }
    sessionWindow.tabs.length = 0;
    sessionWindow.windowEl.remove();
    state.windowsByPath.delete(sessionWindow.folderPath);
    renderGrid();
  }

  function animateOpen(sessionWindow, sourceCard) {
    setAnimationTarget(sessionWindow.windowEl, sourceCard, '--from-x', '--from-y');
    sessionWindow.windowEl.classList.remove('minimizing');
    sessionWindow.windowEl.classList.add('opening');
    sessionWindow.windowEl.addEventListener('animationend', function handleEnd() {
      sessionWindow.windowEl.removeEventListener('animationend', handleEnd);
      sessionWindow.windowEl.classList.remove('opening');
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

  function observeSessionSize(sessionWindow) {
    if (sessionWindow.resizeObserver || typeof ResizeObserver !== 'function') return;
    sessionWindow.resizeObserver = new ResizeObserver(() => {
      const tab = getActiveTab(sessionWindow);
      if (tab) scheduleStableFit(tab);
    });
    sessionWindow.resizeObserver.observe(sessionWindow.terminalPocketEl);
  }

  function scheduleStableFit(tab, options) {
    const sessionWindow = tab.sessionWindow;
    if (sessionWindow.resizeTimer) clearTimeout(sessionWindow.resizeTimer);
    sessionWindow.resizeTimer = setTimeout(() => {
      sessionWindow.resizeTimer = null;
      const opts = options || {};
      fitAfterStableLayout(tab, {
        ...opts,
        waitForAnimation: opts.waitForAnimation || sessionWindow.windowEl.classList.contains('opening'),
      });
    }, 80);
  }

  async function fitAfterStableLayout(tab, options) {
    const opts = options || {};
    if (opts.waitForAnimation) await waitForOpeningAnimation(tab.sessionWindow);
    await waitForFonts();
    await nextFrame();
    await nextFrame();
    fitTab(tab);
    if (opts.focus) tab.term.focus();
  }

  function fitTab(tab) {
    const sessionWindow = tab.sessionWindow;
    if (sessionWindow.minimized || sessionWindow.windowEl.hidden) return;
    if (tab.terminalEl && tab.terminalEl.hidden) return;
    try {
      tab.fitAddon.fit();
      api.resizeTerminal(tab.id, tab.term.cols, tab.term.rows);
    } catch {}
  }

  function waitForOpeningAnimation(sessionWindow) {
    if (!sessionWindow.windowEl.classList.contains('opening')) return Promise.resolve();
    return new Promise((resolve) => {
      let done = false;
      const finish = () => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        sessionWindow.windowEl.removeEventListener('animationend', finish);
        resolve();
      };
      const timer = setTimeout(finish, 500);
      sessionWindow.windowEl.addEventListener('animationend', finish);
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
    return state.tabsById.get(sessionId) || null;
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

  function showTabContextMenu(tab, x, y) {
    hideContextMenu();
    els.contextMenu.innerHTML = '';
    addMenuItem('Rename', () => startTabRename(tab));
    els.contextMenu.hidden = false;
    const rect = els.contextMenu.getBoundingClientRect();
    const left = Math.min(x, window.innerWidth - rect.width - 12);
    const top = Math.min(y, window.innerHeight - rect.height - 12);
    els.contextMenu.style.left = `${Math.max(12, left)}px`;
    els.contextMenu.style.top = `${Math.max(12, top)}px`;
  }

  function startTabRename(tab) {
    const labelEl = tab.tabLabelEl;
    if (!labelEl) return;
    const chip = tab.tabChipEl;
    if (chip && chip.querySelector('.tab-rename-input')) return;
    const original = getTabLabel(tab);
    const numericFallback = String(tab.numericLabel);

    const input = document.createElement('input');
    input.className = 'tab-rename-input';
    input.type = 'text';
    input.value = original;
    input.maxLength = 120;
    input.spellcheck = false;

    labelEl.replaceWith(input);
    input.focus();
    input.select();

    let settled = false;
    const finish = (rawValue, { cancel } = {}) => {
      if (settled) return;
      settled = true;
      const trimmed = (rawValue || '').trim();
      if (!cancel) {
        if (!trimmed || trimmed === numericFallback) {
          tab.customName = null;
        } else {
          tab.customName = trimmed;
        }
      }
      const newLabel = getTabLabel(tab);
      const span = document.createElement('span');
      span.className = 'tab-label';
      span.textContent = newLabel;
      input.replaceWith(span);
      tab.tabLabelEl = span;
      const activateBtn = chip ? chip.querySelector('.tab-activate') : null;
      if (activateBtn) activateBtn.title = `Tab ${newLabel}`;
    };

    input.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        event.stopPropagation();
        finish(input.value);
      } else if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        finish(original, { cancel: true });
      } else {
        event.stopPropagation();
      }
    });
    input.addEventListener('blur', () => finish(input.value));
    input.addEventListener('click', (event) => event.stopPropagation());
    input.addEventListener('mousedown', (event) => event.stopPropagation());
  }

  function showTerminalContextMenu(tab, x, y) {
    hideContextMenu();
    els.contextMenu.innerHTML = '';

    const selection = tab.term.getSelection();
    addMenuItem('Copy', () => {
      const sel = tab.term.getSelection();
      if (sel) api.writeClipboard(sel);
    }, !selection);
    addMenuItem('Paste', async () => {
      const text = await api.readClipboard();
      if (text) api.writeTerminal(tab.id, text);
    });
    addMenuItem('Select All', () => {
      tab.term.selectAll();
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

  function handleTerminalInput(tab, data) {
    api.writeTerminal(tab.id, data);
    if (typeof tab.inputBuffer !== 'string') tab.inputBuffer = '';
    const folderPath = tab.sessionWindow.folderPath;
    const clean = data.replace(/\x1b\[[\x30-\x3f]*[\x20-\x2f]*[\x40-\x7e]|\x1bO[\x40-\x7e]/g, '');
    for (const ch of clean) {
      if (ch === '\r' || ch === '\n') {
        const buf = tab.inputBuffer.trim();
        tab.inputBuffer = '';
        if (buf) {
          addNarrationEvent(folderPath, 'user-task', `User asked: "${shorten(buf, 180)}"`);
          setNarrationSummary(folderPath, 'active', `Working on: ${shorten(buf, 100)}`);
        }
      } else if (ch === '\x7f' || ch === '\b') {
        tab.inputBuffer = tab.inputBuffer.slice(0, -1);
      } else if (ch >= ' ') {
        tab.inputBuffer += ch;
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

  function handleTerminalOutput(tab, data) {
    const folderPath = tab.sessionWindow.folderPath;
    const n = ensureNarration(folderPath);
    n.transcriptBuffer = (n.transcriptBuffer + data).slice(-20000);
    const tail = n.transcriptBuffer.slice(-4000);
    for (const hint of NARRATION_HINTS) {
      if (n.seenHints[hint.key]) continue;
      if (!hint.test(tail)) continue;
      n.seenHints[hint.key] = true;
      if (hint.asSummary) {
        setNarrationSummary(folderPath, 'completed', hint.text);
      } else {
        addNarrationEvent(folderPath, hint.kind, hint.text);
      }
    }
  }

  window.addEventListener('DOMContentLoaded', init);
})();
