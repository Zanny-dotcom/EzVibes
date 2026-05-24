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
    viewMode: 'all',
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
    els.activeSessionsBtn = document.getElementById('active-sessions-btn');
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
    els.activeSessionsBtn.addEventListener('click', () => {
      state.viewMode = 'active-sessions';
      state.previewPath = '';
      els.searchInput.value = '';
      state.query = '';
      renderSidebarState();
      renderGrid();
      renderNarrationSidebar();
    });
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
    window.addEventListener('keydown', (event) => {
      const target = event.target;
      if (!target || !target.closest || !target.closest('.terminal-host')) return;
      const wantsTabFocus = event.key === 'F6'
        || (event.key === 'Tab' && event.shiftKey && !event.ctrlKey && !event.altKey && !event.metaKey);
      if (!wantsTabFocus) return;
      const tab = findTabForElement(target);
      if (!tab) return;
      event.preventDefault();
      event.stopPropagation();
      focusTabButton(tab);
    }, true);
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
          const tab = findTabForElement(target);
          if (!tab) return;
          const sel = tab.term.getSelection();
          if (sel) {
            event.preventDefault();
            event.stopPropagation();
            await api.writeClipboard(sel);
            tab.term.clearSelection();
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
            const tab = findTabForElement(target);
            if (tab) api.writeTerminal(tab.id, text);
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
          const tab = findTabForElement(target);
          if (tab) {
            const text = paths.map(quotePath).join(' ') + ' ';
            api.writeTerminal(tab.id, text);
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
      if (!isTabVisible(tab)) {
        tab.needsViewportRefresh = true;
        tab.scrollToBottomOnReveal = true;
      }
      handleTerminalOutput(tab, data);
    });

    api.onTerminalExit(({ sessionId, exitCode }) => {
      const tab = state.tabsById.get(sessionId);
      if (!tab) return;
      tab.ptyAlive = false;
      tab.exited = true;
      const agentLabel = getAgentLabel(tab);
      tab.term.writeln(`\r\n\x1b[90m[${agentLabel} session exited with code ${exitCode}]\x1b[0m`);
      if (tab.tabChipEl) tab.tabChipEl.classList.add('is-exited');
      // When the user initiated the close, the close path already logs
      // "Closed tab X" — skip the exit narration to avoid duplicate events.
      if (tab._suppressExitEvent) return;
      const isError = exitCode !== 0;
      const folderPath = tab.sessionWindow.folderPath;
      const label = getTabLabel(tab);
      addNarrationEvent(folderPath, isError ? 'error' : 'completed', `Tab ${label}: ${agentLabel} session exited with code ${exitCode}.`);
      // Only set the folder-level summary when every tab in the window has
      // exited, so a single dead tab doesn't make the whole folder look done.
      updateNarrationForNoLiveTabs(tab.sessionWindow, {
        status: isError ? 'error' : 'completed',
        summary: isError ? `Exited with error code ${exitCode}.` : 'Session completed.',
      });
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
    state.viewMode = 'all';
    renderSidebarState();
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

  function renderSidebarState() {
    if (!els.activeSessionsBtn) return;
    els.activeSessionsBtn.classList.toggle('is-active', state.viewMode === 'active-sessions');
  }

  function renderPath() {
    els.pathBar.textContent = state.currentPath;
    els.backBtn.disabled = state.history.length === 0;
    els.upBtn.disabled = !state.parentPath || state.parentPath === state.currentPath;
  }

  function getVisibleEntries() {
    let entries;
    if (state.viewMode === 'active-sessions') {
      entries = Array.from(state.windowsByPath.keys()).map((path) => ({
        path,
        name: basename(path),
        kind: 'directory',
      }));
    } else {
      entries = state.entries;
    }
    if (state.query) {
      entries = entries.filter((entry) => entry.name.toLowerCase().includes(state.query));
    }
    return entries;
  }

  function formatFolderCount(count) {
    if (state.viewMode === 'active-sessions') {
      if (count === 0) return 'No active sessions';
      return `${count} active session${count === 1 ? '' : 's'}`;
    }
    return `${count} item${count === 1 ? '' : 's'}`;
  }

  function renderGrid() {
    const entries = getVisibleEntries();
    els.grid.innerHTML = '';
    els.folderCount.textContent = formatFolderCount(entries.length);

    if (entries.length === 0 && state.viewMode === 'active-sessions') {
      const empty = document.createElement('div');
      empty.className = 'grid-empty-state';
      empty.textContent = state.query
        ? 'No active sessions match your search.'
        : 'No active sessions. Launch Claude in a folder to see it here.';
      els.grid.appendChild(empty);
      return;
    }

    for (const entry of entries) {
      const card = document.createElement('button');
      card.className = `folder-card ${entry.kind === 'directory' ? 'is-folder' : 'is-file'}`;
      card.dataset.path = entry.path;
      card.title = entry.path;

      const sessionWindow = state.windowsByPath.get(entry.path);
      if (sessionWindow) {
        if (sessionWindow.minimized) card.classList.add('session-minimized');
        else card.classList.add('session-open');
        if (sessionWindow.attentionState && sessionWindow.minimized) {
          card.classList.add('needs-attention');
        }
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
        addMenuItem('Close Session', () => requestCloseSessionWindow(sessionWindow, { animate: true }));
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
    addNarrationEvent(folderPath, 'session-started', `Opening Claude in ${basename(folderPath)}…`);
    renderGrid();

    const tab = getActiveTab(sessionWindow);
    animateOpen(sessionWindow, sourceCard || findCard(folderPath));
    tab.term.open(tab.terminalEl);
    tab.term.onData((data) => handleTerminalInput(tab, data));
    await fitAfterStableLayout(tab, { focus: true, waitForAnimation: true });
    observeSessionSize(sessionWindow);

    let result;
    try {
      result = await api.createTerminal({
        sessionId: tab.id,
        cwd: folderPath,
        cols: tab.term.cols,
        rows: tab.term.rows,
        agent: 'claude',
      });
    } catch (error) {
      result = { success: false, error: (error && error.message) || String(error) };
    }

    if (!result || !result.success) {
      const message = (result && result.error) || 'Failed to launch Claude.';
      tab.ptyAlive = false;
      tab.exited = true;
      tab.failed = true;
      tab.term.writeln(`\r\n\x1b[31m${message}\x1b[0m`);
      if (tab.tabChipEl) tab.tabChipEl.classList.add('is-exited');
      addNarrationEvent(folderPath, 'error', `Failed to launch Claude in ${basename(folderPath)}: ${message}`);
      updateNarrationForNoLiveTabs(sessionWindow, {
        status: 'error',
        summary: message,
      });
    } else {
      setNarrationSummary(folderPath, 'active', 'Claude session started.');
      addNarrationEvent(folderPath, 'tab-started', `Started Claude tab ${getTabLabel(tab)} in ${basename(folderPath)}.`);
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

  function getAgentLabel(tab) {
    return (tab && tab.agent === 'codex') ? 'Codex' : 'Claude';
  }

  function getAgentShortLabel(tab) {
    return (tab && tab.agent === 'codex') ? 'CX' : 'CL';
  }

  function isTabLive(tab) {
    return !!tab && tab.ptyAlive === true && tab.exited !== true && tab.failed !== true;
  }

  function hasLiveTabs(sessionWindow) {
    if (!sessionWindow || !sessionWindow.tabs) return false;
    return sessionWindow.tabs.some(isTabLive);
  }

  function getTabButton(tab) {
    return tab && tab.tabChipEl ? tab.tabChipEl.querySelector('.tab-activate') : null;
  }

  function focusTabButton(tab) {
    const btn = getTabButton(tab);
    if (!btn) return false;
    btn.focus();
    return true;
  }

  function syncTabA11y(sessionWindow) {
    if (!sessionWindow) return;
    const activeId = sessionWindow.activeTabId;
    for (const tab of sessionWindow.tabs) {
      if (!tab.tabChipEl) continue;
      const btn = getTabButton(tab);
      if (!btn) continue;
      const isActive = tab.id === activeId;
      btn.setAttribute('aria-selected', isActive ? 'true' : 'false');
      btn.tabIndex = isActive ? 0 : -1;
      const label = `${getAgentLabel(tab)} tab: ${getTabLabel(tab)}`;
      btn.setAttribute('aria-label', label);
      btn.title = `Tab ${getTabLabel(tab)}`;
      if (tab.terminalEl) {
        tab.terminalEl.hidden = !isActive;
      }
    }
  }

  function handleTabKeydown(sessionWindow, tab, event) {
    if (!sessionWindow || !tab) return;
    const chip = tab.tabChipEl;
    if (chip && chip.querySelector('.tab-rename-input')) return;
    const key = event.key;
    const tabs = sessionWindow.tabs;
    const idx = tabs.indexOf(tab);
    if (idx < 0) return;
    let nextIdx = -1;
    if (key === 'ArrowLeft') nextIdx = (idx - 1 + tabs.length) % tabs.length;
    else if (key === 'ArrowRight') nextIdx = (idx + 1) % tabs.length;
    else if (key === 'Home') nextIdx = 0;
    else if (key === 'End') nextIdx = tabs.length - 1;
    else if (key === 'Delete') {
      event.preventDefault();
      event.stopPropagation();
      requestCloseTab(tab, { trigger: chip && chip.querySelector('.tab-activate') });
      return;
    } else return;
    event.preventDefault();
    event.stopPropagation();
    const target = tabs[nextIdx];
    if (!target) return;
    activateTab(sessionWindow, target.id, { focus: false });
    const targetBtn = target.tabChipEl && target.tabChipEl.querySelector('.tab-activate');
    if (targetBtn) targetBtn.focus();
  }

  function openNewTabMenu(sessionWindow) {
    if (!sessionWindow || sessionWindow.newTabMenuOpen) return;
    sessionWindow.newTabMenuPrevFocus = document.activeElement;
    const menu = document.createElement('div');
    menu.className = 'new-tab-menu';
    menu.setAttribute('role', 'menu');
    menu.setAttribute('aria-label', 'New tab options');

    const items = [
      { label: 'New Claude tab', agent: 'claude' },
      { label: 'New Codex tab', agent: 'codex' },
    ];
    const buttons = items.map((it) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'new-tab-menu-item';
      b.setAttribute('role', 'menuitem');
      b.tabIndex = -1;
      b.textContent = it.label;
      b.addEventListener('click', (ev) => {
        ev.stopPropagation();
        closeNewTabMenu(sessionWindow, { restoreFocus: false });
        createTab(sessionWindow, { agent: it.agent });
      });
      menu.appendChild(b);
      return b;
    });

    menu.addEventListener('keydown', (ev) => {
      const active = document.activeElement;
      const i = buttons.indexOf(active);
      if (ev.key === 'ArrowDown') {
        ev.preventDefault();
        buttons[(i + 1 + buttons.length) % buttons.length].focus();
      } else if (ev.key === 'ArrowUp') {
        ev.preventDefault();
        buttons[(i - 1 + buttons.length) % buttons.length].focus();
      } else if (ev.key === 'Escape') {
        ev.preventDefault();
        closeNewTabMenu(sessionWindow);
      } else if (ev.key === 'Tab') {
        closeNewTabMenu(sessionWindow);
      }
    });

    const addBtn = sessionWindow.addTabBtnEl;
    const btnRect = addBtn.getBoundingClientRect();
    menu.style.position = 'fixed';
    menu.style.top = `${btnRect.bottom + 4}px`;
    menu.style.left = `${btnRect.left}px`;
    document.body.appendChild(menu);

    sessionWindow.newTabMenuEl = menu;
    sessionWindow.newTabMenuOpen = true;
    addBtn.setAttribute('aria-expanded', 'true');
    buttons[0].focus();

    const outsideHandler = (ev) => {
      if (menu.contains(ev.target) || ev.target === addBtn) return;
      closeNewTabMenu(sessionWindow);
    };
    sessionWindow._newTabMenuOutsideHandler = outsideHandler;
    setTimeout(() => document.addEventListener('mousedown', outsideHandler, true), 0);
  }

  function closeNewTabMenu(sessionWindow, options) {
    if (!sessionWindow || !sessionWindow.newTabMenuOpen) return;
    const opts = options || {};
    const menu = sessionWindow.newTabMenuEl;
    if (menu && menu.parentNode) menu.parentNode.removeChild(menu);
    sessionWindow.newTabMenuEl = null;
    sessionWindow.newTabMenuOpen = false;
    if (sessionWindow.addTabBtnEl) sessionWindow.addTabBtnEl.setAttribute('aria-expanded', 'false');
    if (sessionWindow._newTabMenuOutsideHandler) {
      document.removeEventListener('mousedown', sessionWindow._newTabMenuOutsideHandler, true);
      sessionWindow._newTabMenuOutsideHandler = null;
    }
    if (opts.restoreFocus !== false) {
      const target = sessionWindow.newTabMenuPrevFocus || sessionWindow.addTabBtnEl;
      try { target.focus(); } catch { try { sessionWindow.addTabBtnEl.focus(); } catch {} }
    }
    sessionWindow.newTabMenuPrevFocus = null;
  }

  let _modalInFlight = false;
  function confirmDestructiveClose(opts) {
    if (_modalInFlight) return Promise.resolve(false);
    _modalInFlight = true;
    const {
      title = 'Close terminal?',
      body = '',
      confirmLabel = 'Close',
      cancelLabel = 'Cancel',
      returnFocusTo = null,
      danger = true,
    } = opts || {};

    return new Promise((resolve) => {
      const backdrop = document.createElement('div');
      backdrop.className = 'modal-backdrop';
      const dialog = document.createElement('div');
      dialog.className = 'modal-dialog';
      dialog.setAttribute('role', 'alertdialog');
      dialog.setAttribute('aria-modal', 'true');
      dialog.setAttribute('aria-labelledby', 'modal-title');
      dialog.setAttribute('aria-describedby', 'modal-body');

      const h = document.createElement('h2');
      h.id = 'modal-title';
      h.className = 'modal-title';
      h.textContent = title;

      const p = document.createElement('p');
      p.id = 'modal-body';
      p.className = 'modal-body';
      p.textContent = body;

      const actions = document.createElement('div');
      actions.className = 'modal-actions';
      const cancelBtn = document.createElement('button');
      cancelBtn.type = 'button';
      cancelBtn.className = 'modal-btn modal-btn-cancel';
      cancelBtn.textContent = cancelLabel;
      const confirmBtn = document.createElement('button');
      confirmBtn.type = 'button';
      confirmBtn.className = 'modal-btn modal-btn-confirm' + (danger ? ' is-danger' : '');
      confirmBtn.textContent = confirmLabel;
      actions.append(cancelBtn, confirmBtn);

      dialog.append(h, p, actions);
      backdrop.appendChild(dialog);
      document.body.appendChild(backdrop);

      const cleanup = (result) => {
        window.removeEventListener('keydown', onKey, true);
        if (backdrop.parentNode) backdrop.parentNode.removeChild(backdrop);
        _modalInFlight = false;
        try { if (returnFocusTo && typeof returnFocusTo.focus === 'function') returnFocusTo.focus(); } catch {}
        resolve(result);
      };

      const onKey = (event) => {
        if (event.key === 'Escape') {
          event.preventDefault();
          event.stopPropagation();
          cleanup(false);
        } else if (event.key === 'Tab') {
          event.preventDefault();
          const next = document.activeElement === confirmBtn ? cancelBtn : confirmBtn;
          next.focus();
        } else if (event.key === 'Enter') {
          if (document.activeElement === cancelBtn) {
            event.preventDefault();
            cleanup(false);
          } else {
            event.preventDefault();
            cleanup(true);
          }
        }
      };

      backdrop.addEventListener('mousedown', (event) => {
        if (event.target === backdrop) cleanup(false);
      });
      cancelBtn.addEventListener('click', () => cleanup(false));
      confirmBtn.addEventListener('click', () => cleanup(true));
      window.addEventListener('keydown', onKey, true);

      requestAnimationFrame(() => confirmBtn.focus());
    });
  }

  function syncSessionAttention(sessionWindow) {
    if (!sessionWindow) return;
    sessionWindow.attentionState = sessionWindow.tabs.some((tab) => tab.attentionState);
    const card = findCard(sessionWindow.folderPath);
    if (card) card.classList.toggle('needs-attention', !!sessionWindow.attentionState && !!sessionWindow.minimized);
  }

  function markTabAttention(tab) {
    if (!tab || !tab.sessionWindow) return;
    tab.attentionState = true;
    syncSessionAttention(tab.sessionWindow);
  }

  function clearSessionAttention(sessionWindow) {
    if (!sessionWindow) return;
    for (const tab of sessionWindow.tabs) {
      tab.attentionState = false;
    }
    syncSessionAttention(sessionWindow);
  }

  function clearTabAttention(tab) {
    if (!tab || !tab.sessionWindow) return;
    tab.attentionState = false;
    syncSessionAttention(tab.sessionWindow);
  }

  const OSC_BUFFER_MAX = 8192;
  const OSC_INTRO = '\x1b]';

  function extractOscEvents(buffer, newData) {
    let buf = (buffer || '') + (newData || '');
    const events = [];

    while (true) {
      const start = buf.indexOf(OSC_INTRO);
      if (start < 0) {
        buf = buf.slice(-1) === '\x1b' ? '\x1b' : '';
        break;
      }
      if (start > 0) buf = buf.slice(start);

      const bel = buf.indexOf('\x07', 2);
      const st = buf.indexOf('\x1b\\', 2);
      let termIdx = -1;
      let termLen = 0;
      if (bel >= 0 && (st < 0 || bel < st)) { termIdx = bel; termLen = 1; }
      else if (st >= 0) { termIdx = st; termLen = 2; }

      if (termIdx < 0) {
        if (buf.length > OSC_BUFFER_MAX) buf = buf.slice(-OSC_BUFFER_MAX);
        break;
      }

      const payload = buf.slice(2, termIdx);
      buf = buf.slice(termIdx + termLen);

      const semi = payload.indexOf(';');
      if (semi < 0) continue;
      const code = payload.slice(0, semi);
      const rest = payload.slice(semi + 1);

      if (code === '9') {
        const parts = rest.split(';');
        // ConEmu OSC 9 subcommands (cwd, tab title, progress, etc.) put a small
        // integer in the first field — those are not notifications. Free-text
        // notifications are `9;<message>` or `9;<title>;<body>`.
        if (parts.length > 0 && /^\d{1,2}$/.test(parts[0])) {
          // ignore ConEmu subcommand
        } else {
          const title = parts.length >= 2 ? parts[0] : '';
          const body = parts.length >= 2 ? parts.slice(1).join(';') : parts[0];
          events.push({ kind: 'osc9', title, body, raw: payload });
        }
      } else if (code === '777') {
        const parts = rest.split(';');
        if (parts[0] && parts[0].toLowerCase() === 'notify') {
          const title = parts[1] || '';
          const body = parts.slice(2).join(';');
          events.push({ kind: 'osc777', title, body, raw: payload });
        }
      }
    }

    return { buffer: buf, events };
  }

  function classifyNotification(text) {
    const s = String(text || '');
    if (/\b(waiting|input|permission|approval|approve|approved|confirm|confirmed)\b/i.test(s)) return 'needs-attention';
    if (/\b(complete|completed|done|finished|stopped|stop)\b/i.test(s)) return 'completed';
    return 'notification';
  }

  function processOscNotifications(tab, data) {
    if (!tab) return false;
    const result = extractOscEvents(tab.oscBuffer || '', data);
    tab.oscBuffer = result.buffer;
    if (result.events.length === 0) return false;

    const folderPath = tab.sessionWindow.folderPath;
    const agentLabel = getAgentLabel(tab);
    const tabLabel = getTabLabel(tab);
    let any = false;

    for (const ev of result.events) {
      const text = (ev.body || ev.title || '').trim();
      if (!text) continue;
      const classification = classifyNotification(`${ev.title} ${ev.body}`);
      const dedupKey = `${classification}|${text.slice(0, 80)}`;
      const now = Date.now();
      if (tab.lastNotificationKey === dedupKey && (now - (tab.lastNotificationAt || 0)) < 2000) continue;
      tab.lastNotificationKey = dedupKey;
      tab.lastNotificationAt = now;
      any = true;

      if (classification === 'needs-attention') {
        addNarrationEvent(folderPath, 'attention', `${agentLabel} (${tabLabel}) needs attention: ${shorten(text, 200)}`);
        setNarrationSummary(folderPath, 'waiting', `${agentLabel} needs attention: ${shorten(text, 120)}`);
        markTabAttention(tab);
      } else if (classification === 'completed') {
        clearTabAttention(tab);
        addNarrationEvent(folderPath, 'completed', `${agentLabel} (${tabLabel}): ${shorten(text, 200)}`);
        const others = tab.sessionWindow.tabs.filter((t) => t !== tab && isTabLive(t));
        if (others.length === 0) {
          setNarrationSummary(folderPath, 'completed', shorten(text, 120));
        }
      } else {
        addNarrationEvent(folderPath, 'notification', `${agentLabel} (${tabLabel}): ${shorten(text, 200)}`);
      }
    }
    return any;
  }

  function getActiveTab(sessionWindow) {
    if (!sessionWindow) return null;
    const id = sessionWindow.activeTabId;
    if (!id) return sessionWindow.tabs[0] || null;
    return sessionWindow.tabs.find((t) => t.id === id) || sessionWindow.tabs[0] || null;
  }

  function defaultTabLabel(tab) {
    const agentName = (tab && tab.agent === 'codex') ? 'CODEX' : 'CLAUDE';
    return tab && tab.numericLabel > 1 ? `${agentName} ${tab.numericLabel}` : agentName;
  }

  function getTabLabel(tab) {
    if (!tab) return '';
    return tab.customName || defaultTabLabel(tab);
  }

  function createSessionWindow(folderPath) {
    const name = basename(folderPath);
    const windowId = makeId();
    const windowEl = document.createElement('section');
    windowEl.className = 'folder-terminal';
    windowEl.dataset.windowId = windowId;
    windowEl.innerHTML = `
      <div class="folder-terminal-tab-strip" role="tablist" aria-label="Agent sessions"></div>
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
    addTabBtnEl.title = 'New tab — click to open menu, right-click for Codex';
    addTabBtnEl.setAttribute('aria-label', 'New terminal tab');
    addTabBtnEl.setAttribute('aria-haspopup', 'menu');
    addTabBtnEl.setAttribute('aria-expanded', 'false');
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
      newTabMenuEl: null,
      newTabMenuOpen: false,
      newTabMenuPrevFocus: null,
      attentionState: false,
    };

    // Build the first tab and attach its chip.
    const firstTab = buildTab(sessionWindow, terminalEl, 'claude');
    sessionWindow.tabs.push(firstTab);
    sessionWindow.activeTabId = firstTab.id;
    state.tabsById.set(firstTab.id, firstTab);
    attachTabChip(sessionWindow, firstTab, { active: true });

    windowEl.querySelector('.minimize').addEventListener('click', () => minimizeSessionWindow(sessionWindow, findCard(folderPath)));
    const sessionCloseBtn = windowEl.querySelector('.close');
    sessionCloseBtn.addEventListener('click', () => requestCloseSessionWindow(sessionWindow, { animate: true, returnFocusTo: sessionCloseBtn }));

    addTabBtnEl.addEventListener('click', (event) => {
      event.stopPropagation();
      if (sessionWindow.newTabMenuOpen) closeNewTabMenu(sessionWindow);
      else openNewTabMenu(sessionWindow);
    });

    addTabBtnEl.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ' || event.key === 'ArrowDown') {
        event.preventDefault();
        openNewTabMenu(sessionWindow);
      } else if (event.key === 'Escape' && sessionWindow.newTabMenuOpen) {
        event.preventDefault();
        closeNewTabMenu(sessionWindow);
      }
    });

    addTabBtnEl.addEventListener('contextmenu', (event) => {
      event.preventDefault();
      event.stopPropagation();
      createTab(sessionWindow, { agent: 'codex' });
    });

    terminalEl.addEventListener('contextmenu', (event) => {
      event.preventDefault();
      event.stopPropagation();
      const tab = findTabForElement(terminalEl) || firstTab;
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
    chip.dataset.agent = tab.agent === 'codex' ? 'codex' : 'claude';

    const activateBtn = document.createElement('button');
    activateBtn.type = 'button';
    activateBtn.className = 'tab-activate';
    activateBtn.id = tab.tabButtonId;
    activateBtn.setAttribute('role', 'tab');
    activateBtn.setAttribute('aria-controls', tab.panelId);
    activateBtn.setAttribute('aria-selected', opts.active ? 'true' : 'false');
    activateBtn.tabIndex = opts.active ? 0 : -1;
    const labelText = getTabLabel(tab);
    activateBtn.setAttribute('aria-label', `${getAgentLabel(tab)} tab: ${labelText}`);
    activateBtn.title = `Tab ${labelText}`;

    const badgeSpan = document.createElement('span');
    badgeSpan.className = 'tab-agent-badge';
    badgeSpan.setAttribute('aria-hidden', 'true');
    badgeSpan.dataset.agent = tab.agent;
    badgeSpan.textContent = getAgentShortLabel(tab);

    const labelSpan = document.createElement('span');
    labelSpan.className = 'tab-label';
    labelSpan.textContent = labelText;

    activateBtn.append(badgeSpan, labelSpan);

    const closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.className = 'tab-close';
    closeBtn.title = 'Close tab';
    closeBtn.setAttribute('aria-label', `Close ${getAgentLabel(tab)} tab: ${labelText}`);
    closeBtn.textContent = '×';

    chip.appendChild(activateBtn);
    chip.appendChild(closeBtn);

    // Insert the chip before the add button so the + always stays on the right.
    sessionWindow.tabStripEl.insertBefore(chip, sessionWindow.addTabBtnEl);

    tab.tabChipEl = chip;
    tab.tabLabelEl = labelSpan;
    tab.tabBadgeEl = badgeSpan;
    tab.closeBtnEl = closeBtn;

    activateBtn.addEventListener('click', (event) => {
      event.stopPropagation();
      activateTab(sessionWindow, tab.id, { focus: true });
    });

    activateBtn.addEventListener('keydown', (event) => {
      handleTabKeydown(sessionWindow, tab, event);
    });

    closeBtn.addEventListener('click', (event) => {
      event.stopPropagation();
      requestCloseTab(tab, { trigger: closeBtn });
    });

    chip.addEventListener('contextmenu', (event) => {
      event.preventDefault();
      event.stopPropagation();
      showTabContextMenu(tab, event.clientX, event.clientY);
    });

    return chip;
  }

  function buildTab(sessionWindow, terminalEl, agent) {
    const id = makeId();
    const tabButtonId = `tab-btn-${id}`;
    const panelId = `tab-panel-${id}`;
    terminalEl.dataset.tabId = id;
    terminalEl.id = panelId;
    terminalEl.setAttribute('role', 'tabpanel');
    terminalEl.setAttribute('aria-labelledby', tabButtonId);
    terminalEl.setAttribute('tabindex', '0');
    terminalEl.setAttribute('aria-keyshortcuts', 'F6 Shift+Tab');

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
      tabButtonId,
      panelId,
      sessionWindow,
      agent: agent === 'codex' ? 'codex' : 'claude',
      numericLabel: sessionWindow.nextTabNumber++,
      customName: null,
      ptyAlive: true,
      exited: false,
      failed: false,
      inputBuffer: '',
      oscBuffer: '',
      lastNotificationKey: '',
      lastNotificationAt: 0,
      attentionState: false,
      needsViewportRefresh: false,
      scrollToBottomOnReveal: false,
      term,
      fitAddon,
      terminalEl,
      tabChipEl: null,
      tabLabelEl: null,
      tabBadgeEl: null,
      closeBtnEl: null,
    };

    return tab;
  }

  function activateTab(sessionWindow, tabId, options) {
    if (!sessionWindow) return null;
    const target = sessionWindow.tabs.find((t) => t.id === tabId);
    if (!target) return null;
    const opts = options || {};

    if (sessionWindow.activeTabId === tabId) {
      if (target.needsViewportRefresh || target.scrollToBottomOnReveal) {
        scheduleStableFit(target, { scrollToBottom: target.scrollToBottomOnReveal });
      }
      if (opts.focus) {
        try { target.term.focus(); } catch {}
      }
      return target;
    }

    for (const other of sessionWindow.tabs) {
      if (other.id === tabId) continue;
      if (other.tabChipEl) other.tabChipEl.classList.remove('is-active');
    }
    if (target.tabChipEl) target.tabChipEl.classList.add('is-active');
    sessionWindow.activeTabId = tabId;
    syncTabA11y(sessionWindow);
    if (!sessionWindow.minimized && !sessionWindow.windowEl.hidden) {
      clearSessionAttention(sessionWindow);
    }

    // Wait one or two animation frames so the now-visible host has a layout
    // box, then fit and resize the PTY. Never fit hidden hosts.
    (async () => {
      await nextFrame();
      await nextFrame();
      fitTab(target);
      repairTerminalViewport(target, { scrollToBottom: target.scrollToBottomOnReveal });
      if (opts.focus) {
        try { target.term.focus(); } catch {}
      }
    })();

    return target;
  }

  async function requestCloseTab(tab, options) {
    if (!tab) return;
    const sessionWindow = tab.sessionWindow;
    if (!sessionWindow) return;
    if (tab._closing) return;
    const trigger = (options && options.trigger) || null;

    // Failed/exited tabs close without confirmation.
    if (!isTabLive(tab)) {
      tab._closing = true;
      try {
        if (sessionWindow.tabs.length <= 1) {
          await performCloseSessionWindow(sessionWindow, { animate: true, skipConfirm: true });
        } else {
          await performCloseTab(tab);
        }
      } finally { tab._closing = false; }
      return;
    }

    // Live tab: confirm only when this is the LAST tab (closing destroys the window + scrollback).
    if (sessionWindow.tabs.length <= 1) {
      const agentLabel = getAgentLabel(tab);
      const folderName = basename(sessionWindow.folderPath);
      const ok = await confirmDestructiveClose({
        title: 'Close terminal?',
        body: `This terminal is still running. Closing it will end the ${agentLabel} session in "${folderName}" and lose its scrollback.`,
        confirmLabel: 'Close terminal',
        returnFocusTo: trigger,
      });
      if (!ok) return;
      tab._closing = true;
      try { await performCloseSessionWindow(sessionWindow, { animate: true, skipConfirm: true }); }
      finally { tab._closing = false; }
      return;
    }

    // Mid-window live tab: window stays open after close, no confirmation.
    tab._closing = true;
    try { await performCloseTab(tab); }
    finally { tab._closing = false; }
  }

  async function performCloseTab(tab) {
    if (!tab) return;
    const sessionWindow = tab.sessionWindow;
    if (!sessionWindow) return;

    const label = getTabLabel(tab);
    const index = sessionWindow.tabs.indexOf(tab);
    const wasActive = sessionWindow.activeTabId === tab.id;

    // Pick the neighbor to activate if we are closing the active tab:
    // prefer the right neighbor, else the left.
    let neighbor = null;
    if (wasActive) {
      neighbor = sessionWindow.tabs[index + 1] || sessionWindow.tabs[index - 1] || null;
    }

    tab._suppressExitEvent = true;
    try { await api.closeTerminal(tab.id); } catch {}
    try { tab.term.dispose(); } catch {}

    if (tab.tabChipEl && tab.tabChipEl.parentNode) tab.tabChipEl.parentNode.removeChild(tab.tabChipEl);
    if (tab.terminalEl && tab.terminalEl.parentNode) tab.terminalEl.parentNode.removeChild(tab.terminalEl);

    if (index >= 0) sessionWindow.tabs.splice(index, 1);
    state.tabsById.delete(tab.id);
    syncSessionAttention(sessionWindow);

    if (wasActive) {
      sessionWindow.activeTabId = null;
      if (neighbor) activateTab(sessionWindow, neighbor.id, { focus: true });
      else if (sessionWindow.addTabBtnEl) {
        try { sessionWindow.addTabBtnEl.focus(); } catch {}
      }
    }
    syncTabA11y(sessionWindow);

    addNarrationEvent(sessionWindow.folderPath, 'tab-closed', `Closed tab ${label} in ${basename(sessionWindow.folderPath)}.`);
    updateNarrationForNoLiveTabs(sessionWindow, {
      status: 'closed',
      summary: 'All terminal instances are closed.',
    });
  }

  async function createTab(sessionWindow, options) {
    if (!sessionWindow) return null;
    const opts = options || {};
    const agent = opts.agent === 'codex' ? 'codex' : 'claude';
    const agentLabel = agent === 'codex' ? 'Codex' : 'Claude';

    // Build the new terminal-host inside the pocket.
    const terminalEl = document.createElement('div');
    terminalEl.className = 'terminal-host';
    sessionWindow.terminalPocketEl.appendChild(terminalEl);

    const tab = buildTab(sessionWindow, terminalEl, agent);
    sessionWindow.tabs.push(tab);
    state.tabsById.set(tab.id, tab);
    attachTabChip(sessionWindow, tab, { active: false });

    tab.term.open(tab.terminalEl);
    tab.term.onData((data) => handleTerminalInput(tab, data));

    terminalEl.addEventListener('contextmenu', (event) => {
      event.preventDefault();
      event.stopPropagation();
      showTerminalContextMenu(tab, event.clientX, event.clientY);
    });

    // Activate it so this tab becomes visible and fits properly.
    activateTab(sessionWindow, tab.id, { focus: true });

    addNarrationEvent(sessionWindow.folderPath, 'tab-created', `Created ${agentLabel} tab ${getTabLabel(tab)} in ${basename(sessionWindow.folderPath)}.`);

    let result;
    try {
      result = await api.createTerminal({
        sessionId: tab.id,
        cwd: sessionWindow.folderPath,
        cols: tab.term.cols,
        rows: tab.term.rows,
        agent,
      });
    } catch (error) {
      result = { success: false, error: (error && error.message) || String(error) };
    }

    if (!result || !result.success) {
      const message = (result && result.error) || `Failed to launch ${agentLabel}.`;
      tab.ptyAlive = false;
      tab.exited = true;
      tab.failed = true;
      tab.term.writeln(`\r\n\x1b[31m${message}\x1b[0m`);
      if (tab.tabChipEl) tab.tabChipEl.classList.add('is-exited');
      addNarrationEvent(sessionWindow.folderPath, 'error', `Failed to launch ${agentLabel} in tab ${getTabLabel(tab)}: ${message}`);
      updateNarrationForNoLiveTabs(sessionWindow, {
        status: 'error',
        summary: message,
      });
    } else {
      addNarrationEvent(sessionWindow.folderPath, 'tab-started', `Started ${agentLabel} tab ${getTabLabel(tab)} in ${basename(sessionWindow.folderPath)}.`);
    }

    return tab;
  }

  function minimizeSessionWindow(sessionWindow, sourceCard) {
    if (sessionWindow.minimized) return;
    closeNewTabMenu(sessionWindow, { restoreFocus: false });
    const activeTab = getActiveTab(sessionWindow);
    if (activeTab) activeTab.needsViewportRefresh = true;
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
    clearSessionAttention(sessionWindow);
    animateOpen(sessionWindow, sourceCard || findCard(sessionWindow.folderPath));
    renderGrid();
    const tab = getActiveTab(sessionWindow);
    if (tab) fitAfterStableLayout(tab, { focus: true, waitForAnimation: true });
  }

  async function requestCloseSessionWindow(sessionWindow, options) {
    if (!sessionWindow) return;
    if (sessionWindow._closing) return;
    const opts = options || {};
    if (!opts.skipConfirm && hasLiveTabs(sessionWindow)) {
      const liveCount = sessionWindow.tabs.filter(isTabLive).length;
      const folderName = basename(sessionWindow.folderPath);
      const noun = liveCount === 1 ? 'live terminal' : 'live terminals';
      const ok = await confirmDestructiveClose({
        title: 'Close session window?',
        body: `This session has ${liveCount} ${noun} in "${folderName}". Closing the window will end every running session and lose all scrollback.`,
        confirmLabel: 'Close session',
        returnFocusTo: opts.returnFocusTo || null,
      });
      if (!ok) return;
    }
    sessionWindow._closing = true;
    try { await performCloseSessionWindow(sessionWindow, Object.assign({}, opts, { skipConfirm: true })); }
    finally { sessionWindow._closing = false; }
  }

  async function performCloseSessionWindow(sessionWindow, options) {
    const opts = options || {};
    const hadTabs = sessionWindow.tabs.length > 0;

    closeNewTabMenu(sessionWindow, { restoreFocus: false });

    if (sessionWindow.resizeObserver) {
      sessionWindow.resizeObserver.disconnect();
      sessionWindow.resizeObserver = null;
    }
    if (sessionWindow.resizeTimer) {
      clearTimeout(sessionWindow.resizeTimer);
      sessionWindow.resizeTimer = null;
    }

    // Kill or close every tab PTY and dispose every xterm.
    const tabs = sessionWindow.tabs.slice();
    for (const tab of tabs) {
      tab._suppressExitEvent = true;
      try { await api.closeTerminal(tab.id); } catch {}
      try { tab.term.dispose(); } catch {}
      state.tabsById.delete(tab.id);
    }
    sessionWindow.tabs.length = 0;
    sessionWindow.activeTabId = null;

    if (hadTabs) {
      addNarrationEvent(sessionWindow.folderPath, 'session-closed', `Closed all terminal instances in ${basename(sessionWindow.folderPath)}.`);
      updateNarrationForNoLiveTabs(sessionWindow, {
        status: 'closed',
        summary: 'All terminal instances are closed.',
      });
    }

    // Drop the window from the path map immediately so the folder card stops
    // rendering as session-open/minimized while the animation plays.
    state.windowsByPath.delete(sessionWindow.folderPath);
    renderGrid();

    const removeWindow = () => {
      if (sessionWindow.windowEl && sessionWindow.windowEl.parentNode) {
        sessionWindow.windowEl.remove();
      }
    };

    if (opts.animate && !sessionWindow.windowEl.hidden) {
      const card = findCard(sessionWindow.folderPath);
      setAnimationTarget(sessionWindow.windowEl, card, '--to-x', '--to-y');
      sessionWindow.windowEl.classList.remove('opening');
      sessionWindow.windowEl.classList.add('minimizing');
      await new Promise((resolve) => {
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

    removeWindow();
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
    repairTerminalViewport(tab, {
      scrollToBottom: opts.scrollToBottom || tab.scrollToBottomOnReveal,
    });
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

  function isTabVisible(tab) {
    if (!tab || !tab.sessionWindow || !tab.terminalEl) return false;
    const sessionWindow = tab.sessionWindow;
    return !sessionWindow.minimized
      && !sessionWindow.windowEl.hidden
      && !tab.terminalEl.hidden;
  }

  function repairTerminalViewport(tab, options) {
    if (!isTabVisible(tab)) return;
    const opts = options || {};
    const shouldScroll = !!opts.scrollToBottom;
    refreshTerminalViewport(tab, shouldScroll);
    requestAnimationFrame(() => refreshTerminalViewport(tab, shouldScroll));
    tab.needsViewportRefresh = false;
    tab.scrollToBottomOnReveal = false;
  }

  function refreshTerminalViewport(tab, scrollToBottom) {
    if (!isTabVisible(tab)) return;
    try {
      if (scrollToBottom) tab.term.scrollToBottom();
      tab.term.refresh(0, Math.max(0, tab.term.rows - 1));
      const viewport = tab.terminalEl.querySelector('.xterm-viewport');
      if (scrollToBottom && viewport) viewport.scrollTop = viewport.scrollHeight;
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

  function findTabForElement(element) {
    if (!element || !element.closest) return null;
    const host = element.closest('.terminal-host');
    if (!host) return null;
    const tabId = host.dataset.tabId;
    return state.tabsById.get(tabId) || null;
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
    const restoreDefault = defaultTabLabel(tab);

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
        if (!trimmed || trimmed === restoreDefault) {
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
      if (activateBtn) {
        activateBtn.title = `Tab ${newLabel}`;
        activateBtn.setAttribute('aria-label', `${getAgentLabel(tab)} tab: ${newLabel}`);
      }
      const closeBtn = chip ? chip.querySelector('.tab-close') : null;
      if (closeBtn) closeBtn.setAttribute('aria-label', `Close ${getAgentLabel(tab)} tab: ${newLabel}`);
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

  function updateNarrationForNoLiveTabs(sessionWindow, options) {
    if (!sessionWindow) return;
    const hasLiveTab = sessionWindow.tabs.some((tab) => tab.ptyAlive);
    if (hasLiveTab) return;
    const opts = options || {};
    setNarrationSummary(
      sessionWindow.folderPath,
      opts.status || 'closed',
      opts.summary || 'All terminal instances are closed.'
    );
  }

  function scrollNarrationToBottom() {
    if (!els.narrationBody) return;
    requestAnimationFrame(() => {
      els.narrationBody.scrollTop = els.narrationBody.scrollHeight;
    });
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
    scrollNarrationToBottom();
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
    processOscNotifications(tab, data);
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
