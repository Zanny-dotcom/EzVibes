(function () {
  const api = window.ezvibes;
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
    liveLogOpen: false,
    liveLogEntries: [],
    liveLogFile: '',
    previewPath: '',
    viewMode: 'all',
    windowRenderable: true,
    lastActiveTabId: '',
    activateFilePath: '',
    activateClickTimer: null,
    inboxOpen: false,
    inboxLoading: false,
    inboxPath: '',
    inboxEntries: [],
    inboxError: '',
    inboxLoadSeq: 0,
    inboxToastTimer: null,
    inboxHoldTimer: null,
    inboxHoldPointerId: null,
    inboxHoldLastX: 0,
    inboxHoldLastY: 0,
    inboxDraggingPath: false,
    inboxDragGhost: null,
    inboxDragPayload: null,
    inboxHoldSourceEl: null,
    suppressNextInboxClick: false,
    suppressNextInboxClickTimer: null,
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
    els.inboxBtn = document.getElementById('inbox-btn');
    els.inboxPopover = document.getElementById('inbox-popover');
    els.inboxClose = document.getElementById('inbox-close');
    els.inboxSubtitle = document.getElementById('inbox-subtitle');
    els.inboxCount = document.getElementById('inbox-count');
    els.inboxBody = document.getElementById('inbox-body');
    els.activateBtn = document.getElementById('activate-btn');
    els.shell = document.querySelector('main.shell');
    els.narrationToggle = document.getElementById('narration-toggle');
    els.panelModeToggle = document.getElementById('panel-mode-toggle');
    els.narrationSidebar = document.getElementById('narration-sidebar');
    els.narrationClose = document.getElementById('narration-close');
    els.narrationFolder = document.getElementById('narration-folder');
    els.narrationBody = document.getElementById('narration-body');
    els.liveLogToggle = document.getElementById('live-log-toggle');
    els.liveLogPanel = document.getElementById('live-log-panel');
    els.liveLogClose = document.getElementById('live-log-close');
    els.liveLogFile = document.getElementById('live-log-file');
    els.liveLogBody = document.getElementById('live-log-body');

    bindEvents();
    bindTerminalEvents();
    bindAppDiagnostics();

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
    if (els.inboxBtn) {
      els.inboxBtn.addEventListener('click', onInboxButtonClick);
      els.inboxBtn.addEventListener('pointerdown', onInboxButtonPointerDown);
      els.inboxBtn.addEventListener('dragstart', (event) => event.preventDefault());
    }
    if (els.inboxClose) {
      els.inboxClose.addEventListener('click', () => closeInboxPopup({ restoreFocus: true }));
    }
    document.addEventListener('mousedown', onInboxDocumentMouseDown, true);
    if (els.activateBtn) {
      els.activateBtn.addEventListener('click', onActivateButtonClick);
      els.activateBtn.addEventListener('dblclick', onActivateButtonDoubleClick);
    }
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
    els.liveLogToggle.addEventListener('click', () => setLiveLogOpen(!state.liveLogOpen));
    els.panelModeToggle.addEventListener('click', () => {
      const panel = window.ezvibesPanelMode;
      if (!panel) return;
      const next = !panel.isActive();
      panel.setActive(next);
      els.panelModeToggle.setAttribute('aria-pressed', next ? 'true' : 'false');
    });
    els.liveLogClose.addEventListener('click', () => setLiveLogOpen(false));
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
      if (event.key === 'Escape') {
        hideContextMenu();
        cancelInboxButtonHold();
        closeInboxPopup({ restoreFocus: false });
      }
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
      refreshVisibleTerminalViewports({ reason: 'resize' });
      positionInboxPopup();
    });
    window.addEventListener('focus', () => {
      state.windowRenderable = true;
      refreshVisibleTerminalViewports({ reason: 'focus' });
    });
    window.addEventListener('pageshow', () => {
      state.windowRenderable = true;
      refreshVisibleTerminalViewports({ reason: 'pageshow' });
    });
    window.addEventListener('blur', () => {
      cancelInboxButtonHold();
      markVisibleTerminalViewportsForReveal();
    });
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') {
        state.windowRenderable = false;
        markVisibleTerminalViewportsForReveal();
      } else {
        state.windowRenderable = true;
        refreshVisibleTerminalViewports({ reason: 'visibility' });
      }
    });
    if (api.onWindowLifecycle) {
      api.onWindowLifecycle(handleWindowLifecycle);
    }

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

    window.addEventListener('dragenter', handleWindowDragEnter);
    window.addEventListener('dragover', handleWindowDragOver);
    window.addEventListener('dragleave', handleWindowDragLeave);
    window.addEventListener('dragend', clearTerminalDropTarget);
    window.addEventListener('drop', handleWindowDrop);
  }

  function isFileDragEvent(event) {
    const dataTransfer = event && event.dataTransfer;
    if (!dataTransfer) return false;
    const types = Array.from(dataTransfer.types || []);
    return types.includes('Files') || !!(dataTransfer.files && dataTransfer.files.length > 0);
  }

  function setDropEffect(event) {
    try {
      if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy';
    } catch {}
  }

  function handleWindowDragEnter(event) {
    if (!isFileDragEvent(event)) return;
    event.preventDefault();
    setDropEffect(event);
    updateTerminalDropTarget(findDropTargetTab(event.target));
  }

  function handleWindowDragOver(event) {
    if (!isFileDragEvent(event)) return;
    event.preventDefault();
    setDropEffect(event);
    updateTerminalDropTarget(findDropTargetTab(event.target));
  }

  function handleWindowDragLeave(event) {
    if (!isFileDragEvent(event)) return;
    if (event.clientX <= 0 || event.clientY <= 0 || event.clientX >= window.innerWidth || event.clientY >= window.innerHeight) {
      clearTerminalDropTarget();
    }
  }

  async function handleWindowDrop(event) {
    if (!isFileDragEvent(event)) return;
    event.preventDefault();
    clearTerminalDropTarget();

    const files = collectDroppedFiles(event.dataTransfer);
    if (files.length === 0) {
      logRendererEvent('renderer.drop.empty', { target: describeDropTarget(event.target) }, 'warn');
      return;
    }

    const target = event.target;
    const tab = findDropTargetTab(target);
    if (tab) {
      await dropFilesIntoTerminal(tab, files, target);
      return;
    }

    const paths = getDiskBackedDropPaths(files);
    if (paths.length === 0) {
      logRendererEvent('renderer.drop.no_paths', {
        fileCount: files.length,
        target: describeDropTarget(target),
        files: summarizeDroppedFiles(files),
      }, 'warn');
      return;
    }

    if (target && target.closest) {
      const input = target.closest('input:not([readonly]), textarea:not([readonly])');
      if (input) {
        insertTextIntoInput(input, paths.join(' '));
        return;
      }
    }

    try {
      await navigateTo(paths[0]);
    } catch {}
  }

  function collectDroppedFiles(dataTransfer) {
    if (!dataTransfer) return [];
    const files = [];
    const seen = new Set();
    const addFile = (file) => {
      if (!file) return;
      const key = `${file.name || ''}|${file.size || 0}|${file.type || ''}|${file.lastModified || 0}`;
      if (seen.has(key)) return;
      seen.add(key);
      files.push(file);
    };

    for (const item of Array.from(dataTransfer.items || [])) {
      try {
        if (item && item.kind === 'file' && typeof item.getAsFile === 'function') {
          addFile(item.getAsFile());
        }
      } catch {}
    }

    for (const file of Array.from(dataTransfer.files || [])) {
      addFile(file);
    }

    return files;
  }

  function getDiskBackedDropPaths(files) {
    const paths = [];
    for (const file of files || []) {
      let filePath = '';
      try { filePath = api.getPathForFile(file); } catch {}
      if (filePath) paths.push(filePath);
    }
    return paths;
  }

  async function dropFilesIntoTerminal(tab, files, target) {
    if (!isTabLive(tab)) {
      logRendererEvent('renderer.terminal_drop.rejected', {
        reason: 'tab-not-live',
        sessionId: tab && tab.id,
        fileCount: files.length,
      }, 'warn');
      return;
    }

    let result;
    try {
      if (api.resolveTerminalDroppedFiles) {
        result = await api.resolveTerminalDroppedFiles(tab.id, files);
      } else {
        const paths = getDiskBackedDropPaths(files);
        result = { paths, diskPathCount: paths.length, savedImageCount: 0, rejected: [] };
      }
    } catch (error) {
      logRendererEvent('renderer.terminal_drop.resolve_failed', {
        sessionId: tab.id,
        fileCount: files.length,
        message: (error && error.message) || String(error),
      }, 'error');
      return;
    }

    const paths = Array.isArray(result && result.paths)
      ? result.paths.filter((value) => typeof value === 'string' && value)
      : [];
    const rejected = Array.isArray(result && result.rejected) ? result.rejected : [];
    logRendererEvent(paths.length > 0 ? 'renderer.terminal_drop.resolved' : 'renderer.terminal_drop.no_paths', {
      sessionId: tab.id,
      fileCount: files.length,
      pathCount: paths.length,
      diskPathCount: Number(result && result.diskPathCount) || 0,
      savedImageCount: Number(result && result.savedImageCount) || 0,
      rejectedCount: rejected.length,
      target: describeDropTarget(target),
      files: summarizeDroppedFiles(files),
    }, paths.length > 0 ? 'info' : 'warn');

    if (paths.length === 0) return;

    api.writeTerminal(tab.id, `${paths.map(quotePath).join(' ')} `);
    try { tab.term.focus(); } catch {}
  }

  function findDropTargetTab(target) {
    if (!target || !target.closest) return null;

    const host = target.closest('.terminal-host');
    if (host) return findTabForElement(host);

    const chip = target.closest('.folder-terminal-tab-chip');
    if (chip && chip.dataset && chip.dataset.tabId) {
      return state.tabsById.get(chip.dataset.tabId) || null;
    }

    const sessionWindow = findSessionWindowForElement(target);
    if (!sessionWindow || sessionWindow.minimized || sessionWindow.windowEl.hidden) return null;
    if (target.closest('.terminal-pocket') || target.closest('.folder-terminal')) {
      return getActiveTab(sessionWindow);
    }

    return null;
  }

  function findSessionWindowForElement(element) {
    if (!element || !element.closest) return null;
    const windowEl = element.closest('.folder-terminal');
    if (!windowEl) return null;
    const windowId = windowEl.dataset && windowEl.dataset.windowId;
    if (!windowId) return null;
    for (const sessionWindow of state.windowsByPath.values()) {
      if (sessionWindow.id === windowId) return sessionWindow;
    }
    return null;
  }

  function updateTerminalDropTarget(tab) {
    clearTerminalDropTarget();
    if (!tab || !tab.sessionWindow) return;
    if (tab.sessionWindow.terminalPocketEl) tab.sessionWindow.terminalPocketEl.classList.add('is-file-drag-over');
    if (tab.terminalEl) tab.terminalEl.classList.add('is-file-drag-over');
  }

  function clearTerminalDropTarget() {
    document.querySelectorAll('.terminal-pocket.is-file-drag-over, .terminal-host.is-file-drag-over').forEach((el) => {
      el.classList.remove('is-file-drag-over');
    });
  }

  function describeDropTarget(target) {
    if (!target || !target.closest) return { tag: '' };
    return {
      tag: String(target.tagName || '').toLowerCase(),
      terminal: !!target.closest('.terminal-host'),
      terminalPocket: !!target.closest('.terminal-pocket'),
      tabChip: !!target.closest('.folder-terminal-tab-chip'),
      input: !!target.closest('input:not([readonly]), textarea:not([readonly])'),
    };
  }

  function summarizeDroppedFiles(files) {
    return Array.from(files || []).slice(0, 10).map((file) => ({
      name: String((file && file.name) || '').slice(0, 120),
      type: String((file && file.type) || '').slice(0, 80),
      size: Number(file && file.size) || 0,
    }));
  }

  function bindTerminalEvents() {
    api.onTerminalData(({ sessionId, data }) => {
      const tab = state.tabsById.get(sessionId);
      if (!tab) return;
      tab.term.write(data);
      if (!isTabVisible(tab)) {
        markTabForRevealRepair(tab, {
          scrollToBottom: tab.scrollToBottomOnReveal || tab.lastKnownAtBottom === true,
        });
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

  function bindAppDiagnostics() {
    if (api.onLiveLogEntry) {
      api.onLiveLogEntry((entry) => {
        ingestLiveLogEntry(entry);
      });
    }
    if (api.onAppCloseRequested) {
      api.onAppCloseRequested(handleAppCloseRequested);
    }
    loadLiveLog();
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
      card.setAttribute('data-panel-id', 'folder-card');
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

  function onInboxButtonPointerDown(event) {
    beginInboxPathHold(event, {
      kind: 'folder',
      label: 'inbox',
      hint: state.inboxPath || 'drop into chat',
      sourceEl: els.inboxBtn,
      suppressInboxClick: true,
      missingTargetToast: 'Drop on an open Claude/Codex chat.',
      successLabel: 'Inbox path',
    }, 200);
  }

  function onInboxFilePointerDown(event, entry, sourceEl) {
    const filePath = String((entry && entry.path) || '');
    if (!filePath) return;
    const label = getInboxFileDisplayName(entry);
    beginInboxPathHold(event, {
      kind: 'file',
      label,
      hint: filePath,
      path: filePath,
      sourceEl,
      missingTargetToast: 'Drop this file on an open Claude/Codex chat.',
      successLabel: label,
    }, 200);
  }

  function beginInboxPathHold(event, payload, delayMs) {
    if (event.button !== undefined && event.button !== 0) return;
    cancelInboxButtonHold();
    state.inboxHoldPointerId = event.pointerId;
    state.inboxHoldLastX = event.clientX;
    state.inboxHoldLastY = event.clientY;
    state.inboxDragPayload = payload || null;
    state.inboxHoldSourceEl = payload && payload.sourceEl ? payload.sourceEl : null;
    const pointerId = event.pointerId;
    state.inboxHoldTimer = setTimeout(() => {
      state.inboxHoldTimer = null;
      startInboxPathDrag(pointerId);
    }, delayMs);
    document.addEventListener('pointermove', onInboxButtonPointerMove, true);
    document.addEventListener('pointerup', onInboxButtonPointerUp, true);
    document.addEventListener('pointercancel', onInboxButtonPointerCancel, true);
  }

  function onInboxButtonPointerMove(event) {
    if (state.inboxHoldPointerId !== null && event.pointerId !== state.inboxHoldPointerId) return;
    state.inboxHoldLastX = event.clientX;
    state.inboxHoldLastY = event.clientY;
    if (!state.inboxDraggingPath) return;
    event.preventDefault();
    event.stopPropagation();
    updateInboxPathDrag(event.clientX, event.clientY);
  }

  function onInboxButtonPointerUp(event) {
    if (state.inboxHoldPointerId !== null && event.pointerId !== state.inboxHoldPointerId) return;
    const wasDragging = state.inboxDraggingPath;
    const x = event.clientX;
    const y = event.clientY;
    clearInboxHoldTimer();
    removeInboxHoldListeners();
    state.inboxHoldPointerId = null;

    if (!wasDragging) {
      state.inboxDragPayload = null;
      state.inboxHoldSourceEl = null;
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    const target = getInboxPathDragTarget(x, y);
    const tab = findDropTargetTab(target);
    const payload = state.inboxDragPayload;
    cleanupInboxPathDrag();
    dropInboxPathOnTab(tab, target, payload).catch((error) => {
      logRendererEvent('renderer.inbox.path_drag_failed', {
        message: (error && error.message) || String(error),
      }, 'error');
      showInboxToast('Could not send inbox path.', 'error');
    });
  }

  function onInboxButtonPointerCancel(event) {
    if (state.inboxHoldPointerId !== null && event.pointerId !== state.inboxHoldPointerId) return;
    cancelInboxButtonHold();
  }

  function startInboxPathDrag(pointerId) {
    if (state.inboxHoldPointerId !== pointerId) return;
    const payload = state.inboxDragPayload || {};
    state.inboxDraggingPath = true;
    if (payload.suppressInboxClick) suppressNextInboxClickBriefly();
    closeInboxPopup({ restoreFocus: false });
    if (state.inboxHoldSourceEl) state.inboxHoldSourceEl.classList.add('is-detached');
    document.body.classList.add('inbox-path-dragging');
    state.inboxDragGhost = createInboxPathDragGhost();
    document.body.appendChild(state.inboxDragGhost);
    updateInboxPathDrag(state.inboxHoldLastX, state.inboxHoldLastY);
    logRendererEvent('renderer.inbox.path_drag_started', { kind: payload.kind || 'path' });
  }

  function createInboxPathDragGhost() {
    const payload = state.inboxDragPayload || {};
    const ghost = document.createElement('div');
    ghost.className = 'inbox-drag-ghost';
    const label = document.createElement('span');
    label.className = 'inbox-drag-ghost-label';
    label.textContent = payload.label || 'path';
    const hint = document.createElement('span');
    hint.className = 'inbox-drag-ghost-path';
    hint.textContent = payload.hint || 'drop into chat';
    ghost.append(label, hint);
    return ghost;
  }

  function updateInboxPathDrag(x, y) {
    if (state.inboxDragGhost) {
      state.inboxDragGhost.style.left = `${x}px`;
      state.inboxDragGhost.style.top = `${y}px`;
    }
    const target = getInboxPathDragTarget(x, y);
    updateTerminalDropTarget(findDropTargetTab(target));
  }

  function getInboxPathDragTarget(x, y) {
    const px = Math.min(Math.max(0, x), Math.max(0, window.innerWidth - 1));
    const py = Math.min(Math.max(0, y), Math.max(0, window.innerHeight - 1));
    return document.elementFromPoint(px, py);
  }

  function clearInboxHoldTimer() {
    if (!state.inboxHoldTimer) return;
    clearTimeout(state.inboxHoldTimer);
    state.inboxHoldTimer = null;
  }

  function removeInboxHoldListeners() {
    document.removeEventListener('pointermove', onInboxButtonPointerMove, true);
    document.removeEventListener('pointerup', onInboxButtonPointerUp, true);
    document.removeEventListener('pointercancel', onInboxButtonPointerCancel, true);
  }

  function cleanupInboxPathDrag() {
    state.inboxDraggingPath = false;
    if (state.inboxDragGhost && state.inboxDragGhost.parentNode) {
      state.inboxDragGhost.parentNode.removeChild(state.inboxDragGhost);
    }
    state.inboxDragGhost = null;
    if (state.inboxHoldSourceEl) state.inboxHoldSourceEl.classList.remove('is-detached');
    state.inboxDragPayload = null;
    state.inboxHoldSourceEl = null;
    document.body.classList.remove('inbox-path-dragging');
    clearTerminalDropTarget();
  }

  function cancelInboxButtonHold() {
    clearInboxHoldTimer();
    removeInboxHoldListeners();
    state.inboxHoldPointerId = null;
    if (state.inboxDraggingPath) {
      const payload = state.inboxDragPayload || {};
      cleanupInboxPathDrag();
      if (payload.suppressInboxClick) suppressNextInboxClickBriefly();
    } else {
      state.inboxDragPayload = null;
      state.inboxHoldSourceEl = null;
    }
  }

  function suppressNextInboxClickBriefly() {
    state.suppressNextInboxClick = true;
    if (state.suppressNextInboxClickTimer) clearTimeout(state.suppressNextInboxClickTimer);
    state.suppressNextInboxClickTimer = setTimeout(() => {
      state.suppressNextInboxClick = false;
      state.suppressNextInboxClickTimer = null;
    }, 350);
  }

  async function getInboxFolderPath() {
    if (state.inboxPath) return state.inboxPath;
    if (!api.listInboxMarkdownFiles) throw new Error('Inbox path API is unavailable.');
    const listing = await api.listInboxMarkdownFiles();
    const inboxPath = String((listing && listing.path) || '');
    if (!inboxPath) throw new Error('Inbox path is unavailable.');
    state.inboxPath = inboxPath;
    return inboxPath;
  }

  async function resolveInboxDragPath(payload) {
    const explicit = String((payload && payload.path) || '');
    if (explicit) return explicit;
    return getInboxFolderPath();
  }

  async function dropInboxPathOnTab(tab, target, payload) {
    const dragPayload = payload || {};
    if (!tab) {
      logRendererEvent('renderer.inbox.path_drag_cancelled', {
        reason: 'no-drop-target',
        kind: dragPayload.kind || 'path',
        target: describeDropTarget(target),
      }, 'warn');
      showInboxToast(dragPayload.missingTargetToast || 'Drop on an open Claude/Codex chat.', 'info');
      return;
    }

    if (!isTabReadyForInput(tab) || !isTabVisible(tab)) {
      logRendererEvent('renderer.inbox.path_drag_rejected', {
        reason: 'tab-not-ready',
        kind: dragPayload.kind || 'path',
        sessionId: tab.id,
        agent: tab.agent,
      }, 'warn');
      showInboxToast('That chat is not ready for input.', 'error');
      return;
    }

    const pathToSend = await resolveInboxDragPath(dragPayload);
    markCurrentTab(tab);
    api.writeTerminal(tab.id, pathToSend);
    try { tab.term.focus(); } catch {}
    logRendererEvent('renderer.inbox.path_drag_sent_to_terminal', {
      path: pathToSend,
      kind: dragPayload.kind || 'path',
      sessionId: tab.id,
      agent: tab.agent,
      cwd: tab.sessionWindow && tab.sessionWindow.folderPath,
    });
    showInboxToast(`${dragPayload.successLabel || 'Path'} sent to ${getAgentLabel(tab)}.`, 'success');
  }

  function onInboxButtonClick(event) {
    if (state.suppressNextInboxClick) {
      event.preventDefault();
      event.stopPropagation();
      state.suppressNextInboxClick = false;
      if (state.suppressNextInboxClickTimer) {
        clearTimeout(state.suppressNextInboxClickTimer);
        state.suppressNextInboxClickTimer = null;
      }
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    if (state.inboxOpen) {
      closeInboxPopup({ restoreFocus: true });
      return;
    }
    openInboxPopup();
  }

  function openInboxPopup() {
    state.inboxOpen = true;
    state.inboxLoading = true;
    state.inboxError = '';
    state.inboxEntries = [];
    renderInboxPopup();
    positionInboxPopup();
    loadInboxMarkdownFiles();
  }

  function closeInboxPopup(options) {
    if (!state.inboxOpen && (!els.inboxPopover || els.inboxPopover.hidden)) return;
    const opts = options || {};
    state.inboxOpen = false;
    renderInboxPopup();
    if (opts.restoreFocus && els.inboxBtn) {
      try { els.inboxBtn.focus(); } catch {}
    }
  }

  function onInboxDocumentMouseDown(event) {
    if (!state.inboxOpen) return;
    const target = event.target;
    if (els.inboxPopover && els.inboxPopover.contains(target)) return;
    if (els.inboxBtn && els.inboxBtn.contains(target)) return;
    closeInboxPopup({ restoreFocus: false });
  }

  async function loadInboxMarkdownFiles() {
    const seq = state.inboxLoadSeq + 1;
    state.inboxLoadSeq = seq;
    try {
      if (!api.listInboxMarkdownFiles) {
        throw new Error('Inbox file API is unavailable.');
      }
      const listing = await api.listInboxMarkdownFiles();
      if (seq !== state.inboxLoadSeq) return;
      state.inboxPath = String((listing && listing.path) || '');
      state.inboxEntries = Array.isArray(listing && listing.entries)
        ? listing.entries.filter((entry) => entry && typeof entry.path === 'string')
        : [];
      state.inboxError = '';
    } catch (error) {
      if (seq !== state.inboxLoadSeq) return;
      state.inboxEntries = [];
      state.inboxError = (error && error.message) || String(error);
      logRendererEvent('renderer.inbox.list_failed', { message: state.inboxError }, 'error');
    } finally {
      if (seq !== state.inboxLoadSeq) return;
      state.inboxLoading = false;
      renderInboxPopup();
      positionInboxPopup();
      focusInboxDefault();
    }
  }

  function renderInboxPopup() {
    if (els.inboxBtn) {
      els.inboxBtn.setAttribute('aria-expanded', state.inboxOpen ? 'true' : 'false');
      els.inboxBtn.classList.toggle('is-open', state.inboxOpen);
    }
    if (!els.inboxPopover) return;
    els.inboxPopover.hidden = !state.inboxOpen;
    if (!state.inboxOpen) return;

    if (els.inboxSubtitle) {
      els.inboxSubtitle.textContent = state.inboxPath || 'Loading inbox...';
      els.inboxSubtitle.title = state.inboxPath || '';
    }
    if (els.inboxCount) {
      if (state.inboxLoading) {
        els.inboxCount.textContent = 'Loading';
      } else if (state.inboxError) {
        els.inboxCount.textContent = 'Unavailable';
      } else {
        const count = state.inboxEntries.length;
        els.inboxCount.textContent = `${count} md file${count === 1 ? '' : 's'}`;
      }
    }
    if (!els.inboxBody) return;
    els.inboxBody.innerHTML = '';

    if (state.inboxLoading) {
      const message = document.createElement('div');
      message.className = 'inbox-empty';
      message.textContent = 'Reading markdown files...';
      els.inboxBody.appendChild(message);
      return;
    }

    if (state.inboxError) {
      const message = document.createElement('div');
      message.className = 'inbox-empty inbox-error';
      message.textContent = state.inboxError;
      els.inboxBody.appendChild(message);
      return;
    }

    if (state.inboxEntries.length === 0) {
      const message = document.createElement('div');
      message.className = 'inbox-empty';
      message.textContent = 'No markdown files in inbox.';
      els.inboxBody.appendChild(message);
      return;
    }

    const list = document.createElement('div');
    list.className = 'inbox-list';
    for (const entry of state.inboxEntries) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'inbox-file-button';
      button.title = entry.path;
      const name = document.createElement('span');
      name.className = 'inbox-file-name';
      name.textContent = getInboxFileDisplayName(entry);
      button.appendChild(name);
      button.addEventListener('pointerdown', (event) => onInboxFilePointerDown(event, entry, button));
      button.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
      });
      button.addEventListener('dragstart', (event) => event.preventDefault());
      list.appendChild(button);
    }
    els.inboxBody.appendChild(list);
  }

  function positionInboxPopup() {
    if (!state.inboxOpen || !els.inboxPopover || !els.inboxBtn || els.inboxPopover.hidden) return;
    const rect = els.inboxBtn.getBoundingClientRect();
    const popoverWidth = els.inboxPopover.offsetWidth || Math.min(430, window.innerWidth - 24);
    const popoverHeight = els.inboxPopover.offsetHeight || 360;
    const left = Math.min(
      Math.max(12, rect.left + rect.width / 2 - popoverWidth / 2),
      Math.max(12, window.innerWidth - popoverWidth - 12)
    );
    const below = rect.bottom + 10;
    const top = Math.min(below, Math.max(12, window.innerHeight - popoverHeight - 12));
    els.inboxPopover.style.left = `${left}px`;
    els.inboxPopover.style.top = `${top}px`;
  }

  function focusInboxDefault() {
    if (!state.inboxOpen || !els.inboxPopover) return;
    setTimeout(() => {
      if (!state.inboxOpen || !els.inboxPopover) return;
      const target = els.inboxPopover.querySelector('.inbox-file-button') || els.inboxClose;
      if (target) {
        try { target.focus(); } catch {}
      }
    }, 0);
  }

  function getInboxFileDisplayName(entry) {
    const explicit = String((entry && entry.displayName) || '').trim();
    if (explicit) return explicit.replace(/\.md$/i, '');
    const name = String((entry && entry.name) || basename((entry && entry.path) || ''));
    return name.replace(/\.md$/i, '');
  }

  function showInboxToast(text, kind) {
    let toast = document.getElementById('inbox-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'inbox-toast';
      toast.className = 'inbox-toast';
      toast.setAttribute('role', 'status');
      toast.setAttribute('aria-live', 'polite');
      document.body.appendChild(toast);
    }
    toast.className = `inbox-toast is-${kind || 'info'}`;
    toast.textContent = text;
    toast.hidden = false;
    if (state.inboxToastTimer) clearTimeout(state.inboxToastTimer);
    state.inboxToastTimer = setTimeout(() => {
      toast.hidden = true;
      state.inboxToastTimer = null;
    }, 2200);
  }

  function onActivateButtonClick(event) {
    if (event.detail !== 1) return;
    if (state.activateClickTimer) clearTimeout(state.activateClickTimer);
    state.activateClickTimer = setTimeout(() => {
      state.activateClickTimer = null;
      dispatchActivatePath().catch((error) => {
        logRendererEvent('renderer.activate.dispatch_failed', {
          message: (error && error.message) || String(error),
        }, 'error');
      });
    }, 240);
  }

  function onActivateButtonDoubleClick(event) {
    event.preventDefault();
    event.stopPropagation();
    if (state.activateClickTimer) {
      clearTimeout(state.activateClickTimer);
      state.activateClickTimer = null;
    }
    openActivateFile();
  }

  async function getActivateFilePath() {
    if (state.activateFilePath) return state.activateFilePath;
    if (!api.getActivateFilePath) throw new Error('Activate file path API is unavailable.');
    state.activateFilePath = await api.getActivateFilePath();
    return state.activateFilePath;
  }

  async function dispatchActivatePath() {
    let filePath = '';
    try {
      filePath = await getActivateFilePath();
    } catch (error) {
      logRendererEvent('renderer.activate.path_failed', {
        message: (error && error.message) || String(error),
      }, 'error');
      return;
    }

    const tab = getCurrentInputTab();
    if (tab && api.writeTerminal) {
      markCurrentTab(tab);
      api.writeTerminal(tab.id, filePath);
      if (isTabVisible(tab)) {
        try { tab.term.focus(); } catch {}
      }
      logRendererEvent('renderer.activate.path_sent_to_terminal', {
        sessionId: tab.id,
        agent: tab.agent,
        cwd: tab.sessionWindow && tab.sessionWindow.folderPath,
      });
      return;
    }

    if (api.writeClipboard) {
      await api.writeClipboard(filePath);
      logRendererEvent('renderer.activate.path_copied_to_clipboard', { filePath });
    }
  }

  async function openActivateFile() {
    if (!api.openActivateFile) return;
    try {
      const result = await api.openActivateFile();
      if (!result || !result.success) {
        throw new Error((result && result.error) || 'Could not open activate file.');
      }
      if (result.path) state.activateFilePath = result.path;
      logRendererEvent('renderer.activate.file_opened', { filePath: result.path || state.activateFilePath });
    } catch (error) {
      logRendererEvent('renderer.activate.open_failed', {
        message: (error && error.message) || String(error),
      }, 'error');
    }
  }

  async function launchClaudeForPath(folderPath, sourceCard) {
    const existing = state.windowsByPath.get(folderPath);
    if (existing) {
      markCurrentTab(getActiveTab(existing));
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
    await terminalBecameVisible(tab, { focus: true, waitForAnimation: true, reason: 'launch' });
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
      markPtyCreated(tab);
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

  const TERMINAL_LAYOUT_DEBOUNCE_MS = 50;
  const TERMINAL_LAYOUT_MAX_FRAMES = 18;
  const TERMINAL_MIN_HOST_WIDTH = 20;
  const TERMINAL_MIN_HOST_HEIGHT = 20;

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

  function isTabReadyForInput(tab) {
    return isTabLive(tab) && tab.ptyCreated === true;
  }

  function markCurrentTab(tab) {
    if (!tab || !tab.id || !state.tabsById.has(tab.id)) return;
    state.lastActiveTabId = tab.id;
  }

  function getCurrentInputTab() {
    const preferred = state.tabsById.get(state.lastActiveTabId);
    if (isTabReadyForInput(preferred)) return preferred;

    const activeVisibleTabs = [];
    const activeTabs = [];
    const liveTabs = [];
    const sessionWindows = Array.from(state.windowsByPath.values()).reverse();

    for (const sessionWindow of sessionWindows) {
      const activeTab = getActiveTab(sessionWindow);
      if (isTabReadyForInput(activeTab)) {
        if (!sessionWindow.minimized && !sessionWindow.windowEl.hidden) {
          activeVisibleTabs.push(activeTab);
        }
        activeTabs.push(activeTab);
      }
      for (const tab of sessionWindow.tabs) {
        if (tab === activeTab) continue;
        if (isTabReadyForInput(tab)) liveTabs.push(tab);
      }
    }

    return activeVisibleTabs[0] || activeTabs[0] || liveTabs[0] || null;
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
      initialFocus = danger ? 'cancel' : 'confirm',
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
          if (document.activeElement === confirmBtn) {
            event.preventDefault();
            cleanup(true);
          } else {
            event.preventDefault();
            cleanup(false);
          }
        }
      };

      backdrop.addEventListener('mousedown', (event) => {
        if (event.target === backdrop) cleanup(false);
      });
      cancelBtn.addEventListener('click', () => cleanup(false));
      confirmBtn.addEventListener('click', () => cleanup(true));
      window.addEventListener('keydown', onKey, true);

      requestAnimationFrame(() => {
        const target = initialFocus === 'confirm' ? confirmBtn : cancelBtn;
        target.focus();
      });
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
    windowEl.setAttribute('data-panel-id', 'session-window');
    windowEl.innerHTML = `
      <div class="folder-terminal-tab-strip" role="tablist" aria-label="Agent sessions"></div>
      <div class="folder-terminal-tab">
        <span class="folder-name-label"></span>
        <div class="session-controls">
          <button class="session-control minimize" title="Minimize">_</button>
          <button class="session-control close" title="Close">×</button>
        </div>
      </div>
      <div class="terminal-pocket">
        <div class="terminal-host is-active"></div>
      </div>
    `;

    const folderNameLabel = windowEl.querySelector('.folder-name-label');
    folderNameLabel.setAttribute('data-panel-id', 'session-window-folder-name-label');
    folderNameLabel.textContent = name;
    folderNameLabel.title = folderPath;

    const tabStripEl = windowEl.querySelector('.folder-terminal-tab-strip');
    tabStripEl.setAttribute('data-panel-id', 'session-window-tab-strip');
    windowEl.querySelector('.folder-terminal-tab').setAttribute('data-panel-id', 'session-window-header');
    windowEl.querySelector('.session-controls').setAttribute('data-panel-id', 'session-window-controls');
    const addTabBtnEl = document.createElement('button');
    addTabBtnEl.type = 'button';
    addTabBtnEl.className = 'folder-terminal-tab-add';
    addTabBtnEl.title = 'New tab — click to open menu, right-click for Codex';
    addTabBtnEl.setAttribute('aria-label', 'New terminal tab');
    addTabBtnEl.setAttribute('aria-haspopup', 'menu');
    addTabBtnEl.setAttribute('aria-expanded', 'false');
    addTabBtnEl.setAttribute('data-panel-id', 'session-window-add-tab');
    addTabBtnEl.textContent = '+';
    tabStripEl.appendChild(addTabBtnEl);

    const terminalPocketEl = windowEl.querySelector('.terminal-pocket');
    terminalPocketEl.setAttribute('data-panel-id', 'terminal-pocket');
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
      pendingFitTab: null,
      pendingFitOptions: null,
      newTabMenuEl: null,
      newTabMenuOpen: false,
      newTabMenuPrevFocus: null,
      attentionState: false,
      _minimizing: false,
    };

    // Build the first tab and attach its chip.
    const firstTab = buildTab(sessionWindow, terminalEl, 'claude');
    sessionWindow.tabs.push(firstTab);
    sessionWindow.activeTabId = firstTab.id;
    state.tabsById.set(firstTab.id, firstTab);
    markCurrentTab(firstTab);
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
    chip.setAttribute('data-panel-id', 'session-window-tab-chip');
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
      lastKnownAtBottom: true,
      lastPtyCols: null,
      lastPtyRows: null,
      ptyCreated: false,
      visibleRepairSeq: 0,
      terminalDisposables: [],
      term,
      fitAddon,
      terminalEl,
      tabChipEl: null,
      tabLabelEl: null,
      tabBadgeEl: null,
      closeBtnEl: null,
    };

    terminalEl.addEventListener('focusin', () => markCurrentTab(tab));
    terminalEl.addEventListener('mousedown', () => markCurrentTab(tab), true);
    attachTerminalViewportTracking(tab);

    return tab;
  }

  function activateTab(sessionWindow, tabId, options) {
    if (!sessionWindow) return null;
    const target = sessionWindow.tabs.find((t) => t.id === tabId);
    if (!target) return null;
    const opts = options || {};
    const previous = getActiveTab(sessionWindow);
    markCurrentTab(target);

    if (sessionWindow.activeTabId === tabId) {
      if (!opts.skipVisibleRepair && (target.needsViewportRefresh || target.scrollToBottomOnReveal)) {
        scheduleTerminalBecameVisible(target, {
          focus: opts.focus,
          reason: 'tab-reactivate',
          scrollToBottom: shouldScrollToBottomOnLayout(target, opts),
        });
      }
      if (opts.focus) {
        try { target.term.focus(); } catch {}
      }
      return target;
    }

    if (previous && previous.id !== target.id) {
      snapshotTabBeforeHide(previous);
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

    if (!opts.skipVisibleRepair) {
      scheduleTerminalBecameVisible(target, {
        focus: opts.focus,
        reason: 'tab-activate',
        scrollToBottom: shouldScrollToBottomOnLayout(target, opts),
      });
    }

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
    disposeTerminalViewportTracking(tab);
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
    activateTab(sessionWindow, tab.id, { focus: true, skipVisibleRepair: true });
    await terminalBecameVisible(tab, { focus: true, scrollToBottom: true, reason: 'new-tab' });

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
      markPtyCreated(tab);
      addNarrationEvent(sessionWindow.folderPath, 'tab-started', `Started ${agentLabel} tab ${getTabLabel(tab)} in ${basename(sessionWindow.folderPath)}.`);
    }

    return tab;
  }

  function minimizeSessionWindow(sessionWindow, sourceCard) {
    if (sessionWindow.minimized || sessionWindow._minimizing) return;
    sessionWindow._minimizing = true;
    closeNewTabMenu(sessionWindow, { restoreFocus: false });
    markSessionWindowForRevealRepair(sessionWindow);
    const card = sourceCard || findCard(sessionWindow.folderPath);
    setAnimationTarget(sessionWindow.windowEl, card, '--to-x', '--to-y');
    sessionWindow.windowEl.classList.remove('opening');
    sessionWindow.windowEl.classList.add('minimizing');
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      sessionWindow.windowEl.removeEventListener('animationend', finish);
      sessionWindow.windowEl.classList.remove('minimizing');
      sessionWindow.windowEl.hidden = true;
      sessionWindow.minimized = true;
      sessionWindow._minimizing = false;
      renderGrid();
    };
    const timer = setTimeout(finish, 500);
    sessionWindow.windowEl.addEventListener('animationend', finish);
  }

  function restoreSessionWindow(sessionWindow, sourceCard) {
    sessionWindow.windowEl.hidden = false;
    sessionWindow.minimized = false;
    sessionWindow._minimizing = false;
    clearSessionAttention(sessionWindow);
    animateOpen(sessionWindow, sourceCard || findCard(sessionWindow.folderPath));
    renderGrid();
    const tab = getActiveTab(sessionWindow);
    markCurrentTab(tab);
    if (tab) {
      const scrollToBottom = shouldScrollToBottomOnLayout(tab, { scrollToBottom: tab.scrollToBottomOnReveal });
      scheduleTerminalBecameVisible(tab, {
        focus: true,
        reason: 'session-restore',
        scrollToBottom,
        waitForAnimation: true,
      });
    }
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
    sessionWindow.pendingFitTab = null;
    sessionWindow.pendingFitOptions = null;

    // Kill or close every tab PTY and dispose every xterm.
    const tabs = sessionWindow.tabs.slice();
    for (const tab of tabs) {
      tab._suppressExitEvent = true;
      try { await api.closeTerminal(tab.id); } catch {}
      disposeTerminalViewportTracking(tab);
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

  function handleWindowLifecycle(payload) {
    const type = payload && payload.type;
    if (type === 'hidden') {
      state.windowRenderable = false;
      markVisibleTerminalViewportsForReveal();
      return;
    }
    if (type === 'visible' || type === 'focus') {
      state.windowRenderable = true;
      refreshVisibleTerminalViewports({ reason: type });
    }
  }

  function refreshVisibleTerminalViewports(options) {
    const opts = options || {};
    for (const sessionWindow of state.windowsByPath.values()) {
      const tab = getActiveTab(sessionWindow);
      if (!tab) continue;
      if (!isTabVisible(tab)) {
        if (!sessionWindow.minimized && !sessionWindow.windowEl.hidden) {
          markTabForRevealRepair(tab, { scrollToBottom: tab.scrollToBottomOnReveal });
        }
        continue;
      }
      scheduleTerminalBecameVisible(tab, {
        reason: opts.reason || 'refresh',
        scrollToBottom: shouldScrollToBottomOnLayout(tab, opts),
      });
    }
  }

  function markVisibleTerminalViewportsForReveal() {
    for (const sessionWindow of state.windowsByPath.values()) {
      if (sessionWindow.windowEl.hidden) continue;
      markSessionWindowForRevealRepair(sessionWindow);
    }
  }

  function markSessionWindowForRevealRepair(sessionWindow) {
    if (!sessionWindow || !sessionWindow.tabs) return;
    for (const tab of sessionWindow.tabs) {
      snapshotTabBeforeHide(tab);
    }
  }

  function snapshotTabBeforeHide(tab) {
    if (!tab) return;
    const atBottom = isTerminalAtBottom(tab);
    tab.lastKnownAtBottom = atBottom;
    markTabForRevealRepair(tab, { scrollToBottom: atBottom || tab.scrollToBottomOnReveal });
  }

  function markTabForRevealRepair(tab, options) {
    if (!tab) return;
    const opts = options || {};
    tab.needsViewportRefresh = true;
    if (opts.scrollToBottom) {
      tab.scrollToBottomOnReveal = true;
      tab.lastKnownAtBottom = true;
    }
  }

  function shouldScrollToBottomOnLayout(tab, options) {
    if (!tab) return false;
    const opts = options || {};
    return !!opts.scrollToBottom
      || !!tab.scrollToBottomOnReveal
      || tab.lastKnownAtBottom === true
      || isTerminalAtBottom(tab);
  }

  function isTerminalAtBottom(tab) {
    if (!tab || !tab.term) return true;
    try {
      const buffer = tab.term.buffer && tab.term.buffer.active;
      if (buffer && typeof buffer.viewportY === 'number' && typeof buffer.baseY === 'number') {
        return buffer.viewportY >= buffer.baseY;
      }
    } catch {}
    try {
      const viewport = tab.terminalEl && tab.terminalEl.querySelector('.xterm-viewport');
      if (!viewport) return tab.lastKnownAtBottom !== false;
      const remaining = viewport.scrollHeight - viewport.clientHeight - viewport.scrollTop;
      return remaining <= 2;
    } catch {}
    return tab.lastKnownAtBottom !== false;
  }

  function attachTerminalViewportTracking(tab) {
    if (!tab || !tab.term) return;
    try {
      tab.terminalDisposables.push(tab.term.onScroll(() => {
        tab.lastKnownAtBottom = isTerminalAtBottom(tab);
      }));
    } catch {}
    try {
      tab.terminalDisposables.push(tab.term.onResize(() => {
        if (isTabVisible(tab)) {
          repairTerminalViewportSoon(tab, { scrollToBottom: shouldScrollToBottomOnLayout(tab) });
        } else {
          markTabForRevealRepair(tab, { scrollToBottom: tab.scrollToBottomOnReveal });
        }
      }));
    } catch {}
  }

  function disposeTerminalViewportTracking(tab) {
    if (!tab || !Array.isArray(tab.terminalDisposables)) return;
    for (const disposable of tab.terminalDisposables.splice(0)) {
      try { disposable.dispose(); } catch {}
    }
  }

  function repairTerminalViewportSoon(tab, options) {
    const opts = options || {};
    requestAnimationFrame(() => repairTerminalViewport(tab, opts));
    setTimeout(() => repairTerminalViewport(tab, opts), 120);
  }

  function observeSessionSize(sessionWindow) {
    if (sessionWindow.resizeObserver || typeof ResizeObserver !== 'function') return;
    sessionWindow.resizeObserver = new ResizeObserver(() => {
      const tab = getActiveTab(sessionWindow);
      if (tab) {
        scheduleTerminalBecameVisible(tab, {
          reason: 'resize-observer',
          scrollToBottom: shouldScrollToBottomOnLayout(tab),
        });
      }
    });
    sessionWindow.resizeObserver.observe(sessionWindow.terminalPocketEl);
  }

  function scheduleTerminalBecameVisible(tab, options) {
    if (!tab || !tab.sessionWindow) return;
    if (!isTabVisible(tab)) {
      markTabForRevealRepair(tab, { scrollToBottom: options && options.scrollToBottom });
      return;
    }
    const sessionWindow = tab.sessionWindow;
    if (sessionWindow.resizeTimer) clearTimeout(sessionWindow.resizeTimer);
    sessionWindow.pendingFitTab = tab;
    sessionWindow.pendingFitOptions = mergeTerminalLayoutOptions(sessionWindow.pendingFitOptions, options);
    sessionWindow.resizeTimer = setTimeout(() => {
      sessionWindow.resizeTimer = null;
      const target = sessionWindow.pendingFitTab;
      const opts = sessionWindow.pendingFitOptions || {};
      sessionWindow.pendingFitTab = null;
      sessionWindow.pendingFitOptions = null;
      terminalBecameVisible(target, {
        ...opts,
        waitForAnimation: opts.waitForAnimation || sessionWindow.windowEl.classList.contains('opening'),
      });
    }, TERMINAL_LAYOUT_DEBOUNCE_MS);
  }

  function mergeTerminalLayoutOptions(current, next) {
    const a = current || {};
    const b = next || {};
    return {
      focus: !!(a.focus || b.focus),
      reason: b.reason || a.reason || '',
      scrollToBottom: !!(a.scrollToBottom || b.scrollToBottom),
      waitForAnimation: !!(a.waitForAnimation || b.waitForAnimation),
    };
  }

  async function terminalBecameVisible(tab, options) {
    const opts = options || {};
    if (!tab || !tab.sessionWindow) return false;
    const repairSeq = (tab.visibleRepairSeq || 0) + 1;
    tab.visibleRepairSeq = repairSeq;
    if (opts.waitForAnimation) await waitForOpeningAnimation(tab.sessionWindow);
    await waitForFonts();
    const hasLayout = await waitForTerminalHostLayout(tab, repairSeq);
    if (!hasLayout) {
      markTabForRevealRepair(tab, { scrollToBottom: opts.scrollToBottom });
      return false;
    }
    if (tab.visibleRepairSeq !== repairSeq || !isTabVisible(tab)) return false;
    const scrollToBottom = shouldScrollToBottomOnLayout(tab, opts);
    if (!fitTab(tab)) {
      markTabForRevealRepair(tab, { scrollToBottom });
      return false;
    }
    repairTerminalViewport(tab, {
      scrollToBottom,
    });
    if (opts.focus) tab.term.focus();
    return true;
  }

  async function waitForTerminalHostLayout(tab, repairSeq) {
    let stableLayoutFrames = 0;
    for (let frame = 0; frame < TERMINAL_LAYOUT_MAX_FRAMES; frame++) {
      if (!isTabVisible(tab) || tab.visibleRepairSeq !== repairSeq) return false;
      if (hasUsableTerminalLayout(tab) && getProposedTerminalDimensions(tab)) {
        stableLayoutFrames += 1;
        if (stableLayoutFrames >= 2) return true;
      } else {
        stableLayoutFrames = 0;
      }
      await nextFrame();
    }
    return false;
  }

  function hasUsableTerminalLayout(tab) {
    if (!tab || !tab.terminalEl) return false;
    try {
      const style = window.getComputedStyle(tab.terminalEl);
      if (style.display === 'none' || style.visibility === 'hidden') return false;
      const rect = tab.terminalEl.getBoundingClientRect();
      return rect.width >= TERMINAL_MIN_HOST_WIDTH && rect.height >= TERMINAL_MIN_HOST_HEIGHT;
    } catch {}
    return false;
  }

  function getProposedTerminalDimensions(tab) {
    if (!tab || !tab.fitAddon || typeof tab.fitAddon.proposeDimensions !== 'function') return null;
    try {
      const dims = tab.fitAddon.proposeDimensions();
      if (!dims) return null;
      const cols = Number(dims.cols);
      const rows = Number(dims.rows);
      if (!Number.isFinite(cols) || !Number.isFinite(rows)) return null;
      if (cols < 2 || rows < 1) return null;
      return { cols, rows };
    } catch {}
    return null;
  }

  function fitTab(tab) {
    if (!isTabVisible(tab)) return false;
    if (!getProposedTerminalDimensions(tab)) return false;
    const beforeCols = tab.term.cols;
    const beforeRows = tab.term.rows;
    try {
      tab.fitAddon.fit();
    } catch {
      return false;
    }
    const changed = beforeCols !== tab.term.cols || beforeRows !== tab.term.rows;
    if (changed) syncPtySize(tab);
    return true;
  }

  function markPtyCreated(tab) {
    if (!tab || !tab.term) return;
    tab.ptyCreated = true;
    tab.lastPtyCols = tab.term.cols;
    tab.lastPtyRows = tab.term.rows;
    markCurrentTab(tab);
  }

  function syncPtySize(tab) {
    if (!tab || !tab.ptyCreated || !tab.term) return;
    const cols = tab.term.cols;
    const rows = tab.term.rows;
    if (tab.lastPtyCols === cols && tab.lastPtyRows === rows) return;
    tab.lastPtyCols = cols;
    tab.lastPtyRows = rows;
    api.resizeTerminal(tab.id, cols, rows);
  }

  function isTabVisible(tab) {
    if (!tab || !tab.sessionWindow || !tab.terminalEl) return false;
    const sessionWindow = tab.sessionWindow;
    return state.windowRenderable !== false
      && document.visibilityState !== 'hidden'
      && !sessionWindow.minimized
      && !sessionWindow._minimizing
      && !sessionWindow.windowEl.hidden
      && !tab.terminalEl.hidden
      && sessionWindow.windowEl.isConnected
      && tab.terminalEl.isConnected;
  }

  function repairTerminalViewport(tab, options) {
    const opts = options || {};
    if (!isTabVisible(tab)) {
      markTabForRevealRepair(tab, { scrollToBottom: opts.scrollToBottom });
      return;
    }
    const shouldScroll = shouldScrollToBottomOnLayout(tab, opts);
    fitTab(tab);
    refreshTerminalViewport(tab, shouldScroll);
    requestAnimationFrame(() => {
      fitTab(tab);
      refreshTerminalViewport(tab, shouldScroll);
    });
    setTimeout(() => {
      fitTab(tab);
      refreshTerminalViewport(tab, shouldScroll);
    }, 80);
    tab.needsViewportRefresh = false;
    tab.scrollToBottomOnReveal = false;
    tab.lastKnownAtBottom = shouldScroll || isTerminalAtBottom(tab);
  }

  function resyncTerminalRenderer(tab) {
    try {
      // Hidden writes can leave xterm's canvas and virtual scrollbar with stale measurements.
      const core = tab.term && tab.term._core;
      if (!core) return;
      const renderService = core._renderService;
      if (renderService) {
        try { renderService.clear(); } catch {}
        try { renderService.handleResize(tab.term.cols, tab.term.rows); } catch {}
        try { renderService.handleCursorMove(); } catch {}
      }
      if (core.viewport && typeof core.viewport.syncScrollArea === 'function') {
        core.viewport.syncScrollArea(true);
      }
    } catch {}
  }

  function refreshTerminalViewport(tab, scrollToBottom) {
    if (!isTabVisible(tab)) return;
    try {
      if (scrollToBottom) tab.term.scrollToBottom();
      resyncTerminalRenderer(tab);
      try { tab.term.clearTextureAtlas(); } catch {}
      tab.term.refresh(0, Math.max(0, tab.term.rows - 1));
      const viewport = tab.terminalEl.querySelector('.xterm-viewport');
      if (scrollToBottom && viewport) {
        viewport.scrollTop = Math.max(0, viewport.scrollHeight - viewport.clientHeight);
      }
      if (scrollToBottom) tab.term.scrollToBottom();
      tab.lastKnownAtBottom = scrollToBottom || isTerminalAtBottom(tab);
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
    return `"${String(p).replace(/"/g, '\\"')}"`;
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

  function setLiveLogOpen(open) {
    state.liveLogOpen = !!open;
    if (els.liveLogToggle) els.liveLogToggle.setAttribute('aria-pressed', state.liveLogOpen ? 'true' : 'false');
    renderLiveLog();
    if (state.liveLogOpen) loadLiveLog();
    logRendererEvent(state.liveLogOpen ? 'renderer.live_log.opened' : 'renderer.live_log.closed');
  }

  async function loadLiveLog() {
    if (!api.getLiveLog) return;
    try {
      const result = await api.getLiveLog();
      state.liveLogEntries = Array.isArray(result && result.entries) ? result.entries : [];
      state.liveLogFile = (result && result.logFile) || '';
      renderLiveLog();
    } catch (error) {
      ingestLiveLogEntry({
        time: new Date().toISOString(),
        level: 'error',
        event: 'renderer.live_log_load_failed',
        details: { message: (error && error.message) || String(error) },
      });
    }
  }

  function ingestLiveLogEntry(entry) {
    if (!entry || typeof entry !== 'object') return;
    state.liveLogEntries.push(entry);
    if (state.liveLogEntries.length > 500) {
      state.liveLogEntries.splice(0, state.liveLogEntries.length - 500);
    }
    if (state.liveLogOpen) renderLiveLog();
  }

  function renderLiveLog() {
    if (!els.liveLogPanel || !els.liveLogBody) return;
    els.liveLogPanel.hidden = !state.liveLogOpen;
    if (!state.liveLogOpen) return;

    els.liveLogFile.textContent = state.liveLogFile || '';
    els.liveLogBody.innerHTML = '';

    if (state.liveLogEntries.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'live-log-empty';
      empty.textContent = 'No diagnostic events yet.';
      els.liveLogBody.appendChild(empty);
      return;
    }

    for (const entry of state.liveLogEntries.slice(-300)) {
      const row = document.createElement('div');
      const level = String(entry.level || 'info').toLowerCase();
      row.className = `live-log-row live-log-${level}`;

      const meta = document.createElement('div');
      meta.className = 'live-log-meta';
      const time = entry.time ? new Date(entry.time).toLocaleTimeString() : '';
      meta.textContent = `${time} ${level.toUpperCase()} ${entry.event || 'event'}`;

      const detail = document.createElement('pre');
      detail.className = 'live-log-detail';
      detail.textContent = formatLogDetails(entry.details);

      row.append(meta, detail);
      els.liveLogBody.appendChild(row);
    }

    requestAnimationFrame(() => {
      els.liveLogBody.scrollTop = els.liveLogBody.scrollHeight;
    });
  }

  function formatLogDetails(details) {
    if (!details || (typeof details === 'object' && Object.keys(details).length === 0)) return '';
    try {
      return JSON.stringify(details, null, 2);
    } catch {
      return String(details);
    }
  }

  async function handleAppCloseRequested(payload) {
    const requestId = payload && payload.requestId;
    const liveSessionCount = Number(payload && payload.liveSessionCount) || 0;
    const noun = liveSessionCount === 1 ? 'live terminal' : 'live terminals';
    logRendererEvent('renderer.close_prompt_shown', { requestId, liveSessionCount });
    const ok = await confirmDestructiveClose({
      title: 'Exit EZvibes?',
      body: `EZvibes still has ${liveSessionCount} ${noun} running. Exiting will end every Claude/Codex session and lose terminal scrollback.`,
      confirmLabel: 'Exit EZvibes',
      cancelLabel: 'Stay',
      danger: true,
      initialFocus: 'cancel',
    });
    logRendererEvent(ok ? 'renderer.close_prompt_confirmed' : 'renderer.close_prompt_cancelled', {
      requestId,
      liveSessionCount,
    });
    try {
      await api.confirmAppClose(requestId, ok);
    } catch (error) {
      logRendererEvent('renderer.close_prompt_response_failed', {
        requestId,
        message: (error && error.message) || String(error),
      }, 'error');
    }
  }

  function logRendererEvent(event, details, level) {
    if (!api.logEvent) return;
    try {
      api.logEvent(event, details || {}, level || 'info');
    } catch {}
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

  window.ezvibesInternals = {
    getSessionWindowByPath(folderPath) {
      if (!folderPath) return null;
      const norm = String(folderPath).replace(/\\/g, '/').toLowerCase();
      for (const [key, value] of state.windowsByPath.entries()) {
        if (String(key).replace(/\\/g, '/').toLowerCase() === norm) return value;
      }
      return null;
    },
    getActiveTab(sessionWindow) {
      return getActiveTab(sessionWindow);
    },
  };

  window.addEventListener('DOMContentLoaded', init);
})();
