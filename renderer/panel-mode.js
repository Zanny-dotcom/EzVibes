(function () {
  const PANEL_REGIONS = new Map([
    // Static regions (tagged in renderer/index.html)
    ['topbar', { name: 'Top bar', file: 'renderer/index.html', line: '16-29', describe: 'Header strip: brand label, nav buttons, path bar, search input, narration / panel-mode / log toggles.' }],
    ['window-title', { name: 'Window title', file: 'renderer/index.html', line: '17', describe: 'The EZvibes brand label at top-left of the header.' }],
    ['nav-buttons-group', { name: 'Nav buttons group', file: 'renderer/index.html', line: '18-22', describe: 'Container for the back / up / refresh icon buttons.' }],
    ['back-btn', { name: 'Back button', file: 'renderer/index.html', line: '19', describe: 'The back button; navigates back in folder history.' }],
    ['up-btn', { name: 'Up button', file: 'renderer/index.html', line: '20', describe: 'The up button; navigates to the parent folder.' }],
    ['refresh-btn', { name: 'Refresh button', file: 'renderer/index.html', line: '21', describe: 'The refresh button; re-reads the current folder.' }],
    ['path-bar', { name: 'Path bar', file: 'renderer/index.html', line: '23', describe: 'Displays the current folder path.' }],
    ['search-input', { name: 'Search input', file: 'renderer/index.html', line: '25', describe: 'Search box that filters visible folder/file entries.' }],
    ['narration-toggle', { name: 'Narration toggle', file: 'renderer/index.html', line: '27', describe: 'The narration button; opens the "What Was Made" sidebar.' }],
    ['panel-mode-toggle', { name: 'Panel-mode toggle', file: 'renderer/index.html', line: '28', describe: 'The panel mode button; toggles this feature.' }],
    ['live-log-toggle', { name: 'Live-log toggle', file: 'renderer/index.html', line: '29', describe: 'The LOG button; opens the live diagnostics drawer.' }],
    ['sidebar', { name: 'Sidebar', file: 'renderer/index.html', line: '32-38', describe: 'Left rail: ACTIVE SESSIONS link plus the Places quick-paths.' }],
    ['active-sessions-btn', { name: 'Active sessions link', file: 'renderer/index.html', line: '33-35', describe: 'The green ACTIVE SESSIONS link at the top of the sidebar.' }],
    ['quick-paths-list', { name: 'Places list', file: 'renderer/index.html', line: '37', describe: 'Dynamic quick-paths under Places (Home, Desktop, Documents, and others).' }],
    ['content', { name: 'Content area', file: 'renderer/index.html', line: '40-46', describe: 'Center pane containing the command bar and the folder grid.' }],
    ['command-bar', { name: 'Command bar', file: 'renderer/index.html', line: '41-44', describe: 'Strip above the folder grid: Launch Claude Here button plus item count.' }],
    ['new-session-btn', { name: 'Launch Claude Here button', file: 'renderer/index.html', line: '42', describe: 'Button that starts a Claude session in the current folder.' }],
    ['folder-count', { name: 'Folder count', file: 'renderer/index.html', line: '43', describe: 'Text showing the number of items in the current folder.' }],
    ['folder-grid', { name: 'Folder grid', file: 'renderer/index.html', line: '45', describe: 'Grid of folder/file cards in the current directory.' }],
    ['narration-sidebar', { name: 'Narration sidebar', file: 'renderer/index.html', line: '48-57', describe: 'Right-side "What Was Made" panel; visible when narration toggle is on.' }],
    ['live-log-panel', { name: 'Live-log drawer', file: 'renderer/index.html', line: '59-68', describe: 'Fixed drawer that shows recent diagnostic events; opened by the LOG button.' }],

    // Dynamic regions (tagged in renderer/app.js)
    ['folder-card', { name: 'Folder card', file: 'renderer/app.js', line: '~595', describe: 'A single folder/file card in the grid, built per entry by renderGrid().' }],
    ['session-window', { name: 'Session window', file: 'renderer/app.js', line: '~1184', describe: 'The yellow folder-shaped popup hosting a Claude/Codex terminal.' }],
    ['session-window-tab-strip', { name: 'Session window tab strip', file: 'renderer/app.js', line: '~1187', describe: 'Chrome-style strip overhanging the top edge: tab chips plus the + button.' }],
    ['session-window-header', { name: 'Session window header', file: 'renderer/app.js', line: '~1188', describe: 'Yellow strip flush with the top of the popup: folder-name label plus minimize/close controls.' }],
    ['session-window-tab-chip', { name: 'Session tab chip', file: 'renderer/app.js', line: '~1288', describe: 'One tab in a session window (CLAUDE, CODEX, custom name).' }],
    ['session-window-add-tab', { name: 'Session "new tab" button', file: 'renderer/app.js', line: '~1206', describe: 'The + button at the right end of the tab strip; left-click adds Claude, right-click adds Codex.' }],
    ['session-window-folder-name-label', { name: 'Session window folder label', file: 'renderer/app.js', line: '~1189', describe: 'The small folder-name chip on the yellow header strip.' }],
    ['session-window-controls', { name: 'Session window controls', file: 'renderer/app.js', line: '~1190', describe: 'The minimize/close buttons on the session window header.' }],
    ['terminal-pocket', { name: 'Terminal pocket', file: 'renderer/app.js', line: '~1196', describe: 'The dark frame inside a session window that surrounds the xterm terminal.' }],
  ]);

  function findRegion(target) {
    if (!target || typeof target.closest !== 'function') return null;
    const el = target.closest('[data-panel-id]');
    if (!el) return null;
    const id = el.dataset.panelId;
    const meta = PANEL_REGIONS.get(id);
    if (!meta) return null;
    return { id, element: el, meta };
  }

  let highlightEl = null;
  let chipEl = null;
  let currentRegion = null;

  function ensureHighlight() {
    if (highlightEl) return highlightEl;
    highlightEl = document.createElement('div');
    highlightEl.id = 'panel-mode-highlight';
    chipEl = document.createElement('span');
    chipEl.className = 'panel-mode-chip';
    highlightEl.appendChild(chipEl);
    document.body.appendChild(highlightEl);
    return highlightEl;
  }

  function paintHighlight(region) {
    ensureHighlight();
    if (!region) {
      highlightEl.classList.remove('visible');
      currentRegion = null;
      return;
    }
    const rect = region.element.getBoundingClientRect();
    highlightEl.style.top = `${rect.top}px`;
    highlightEl.style.left = `${rect.left}px`;
    highlightEl.style.width = `${rect.width}px`;
    highlightEl.style.height = `${rect.height}px`;
    chipEl.textContent = region.meta.name;
    highlightEl.classList.add('visible');
    currentRegion = region;
  }

  let composerEl = null;
  let composerTextarea = null;
  let composerToast = null;
  let composerCancelBtn = null;
  let composerSendBtn = null;
  let frozenRegion = null;

  function ensureComposer() {
    if (composerEl) return composerEl;
    composerEl = document.createElement('div');
    composerEl.id = 'panel-mode-composer';
    composerEl.hidden = true;
    composerEl.innerHTML = `
      <div class="panel-mode-composer-header">
        <span class="panel-mode-composer-name"></span>
        <code class="panel-mode-composer-selector"></code>
        <span class="panel-mode-composer-file"></span>
        <p class="panel-mode-composer-describe"></p>
      </div>
      <textarea class="panel-mode-composer-input" placeholder="Describe the change..."></textarea>
      <div class="panel-mode-composer-toast" hidden></div>
      <div class="panel-mode-composer-actions">
        <button type="button" data-action="cancel">Cancel</button>
        <button type="button" data-action="send" class="primary">Send</button>
      </div>
    `;
    document.body.appendChild(composerEl);
    composerTextarea = composerEl.querySelector('textarea');
    composerToast = composerEl.querySelector('.panel-mode-composer-toast');
    composerCancelBtn = composerEl.querySelector('[data-action="cancel"]');
    composerSendBtn = composerEl.querySelector('[data-action="send"]');
    composerCancelBtn.addEventListener('click', closeComposer);
    return composerEl;
  }

  function positionComposer(anchorRect) {
    ensureComposer();
    const margin = 12;
    const cw = composerEl.offsetWidth;
    const ch = composerEl.offsetHeight;
    let left = anchorRect.right + 8;
    if (left + cw + margin > window.innerWidth) {
      left = Math.max(margin, anchorRect.left - cw - 8);
    }
    if (left < margin) left = margin;
    let top = anchorRect.top;
    if (top + ch + margin > window.innerHeight) {
      top = Math.max(margin, window.innerHeight - ch - margin);
    }
    composerEl.style.left = `${left}px`;
    composerEl.style.top = `${top}px`;
  }

  function openComposer(region) {
    ensureComposer();
    frozenRegion = region;
    paintHighlight(region);
    composerEl.querySelector('.panel-mode-composer-name').textContent = region.meta.name;
    composerEl.querySelector('.panel-mode-composer-selector').textContent =
      `[data-panel-id="${region.id}"]`;
    composerEl.querySelector('.panel-mode-composer-file').textContent =
      `${region.meta.file}:${region.meta.line}`;
    composerEl.querySelector('.panel-mode-composer-describe').textContent = region.meta.describe;
    composerTextarea.value = '';
    composerToast.hidden = true;
    composerEl.hidden = false;
    positionComposer(region.element.getBoundingClientRect());
    composerTextarea.focus();
  }

  function closeComposer() {
    if (!composerEl) return;
    composerEl.hidden = true;
    frozenRegion = null;
    paintHighlight(null);
  }

  function onClickCapture(event) {
    if (!active) return;
    if (event.target.closest('#panel-mode-toggle')) return;
    if (event.target.closest('#panel-mode-composer')) return;
    // Swallow app clicks while panel mode is selecting a region.
    event.preventDefault();
    event.stopPropagation();
    if (frozenRegion) return;
    const region = findRegion(event.target);
    if (!region) return;
    openComposer(region);
  }

  function onKeydown(event) {
    if (!active) return;
    if (event.key === 'Escape') {
      if (frozenRegion) {
        closeComposer();
      } else {
        setActive(false);
      }
      event.preventDefault();
      event.stopPropagation();
    }
  }

  function onContextMenu(event) {
    if (!active) return;
    if (event.target.closest('#panel-mode-composer')) return;
    event.preventDefault();
    event.stopPropagation();
    paintHighlight(null);
  }

  function onMouseMove(event) {
    if (!active || frozenRegion) return;
    const el = document.elementFromPoint(event.clientX, event.clientY);
    const region = findRegion(el);
    if (!region) {
      paintHighlight(null);
      return;
    }
    if (currentRegion && currentRegion.element === region.element) return;
    paintHighlight(region);
  }

  let active = false;

  function setActive(next) {
    const value = !!next;
    if (value === active) return;
    active = value;
    document.body.classList.toggle('panel-mode-active', active);
    if (active) {
      document.addEventListener('mousemove', onMouseMove, { capture: true });
      document.addEventListener('click', onClickCapture, { capture: true });
      document.addEventListener('keydown', onKeydown, { capture: true });
      document.addEventListener('contextmenu', onContextMenu, { capture: true });
    } else {
      document.removeEventListener('mousemove', onMouseMove, { capture: true });
      document.removeEventListener('click', onClickCapture, { capture: true });
      document.removeEventListener('keydown', onKeydown, { capture: true });
      document.removeEventListener('contextmenu', onContextMenu, { capture: true });
      closeComposer();
      paintHighlight(null);
      const toggle = document.getElementById('panel-mode-toggle');
      if (toggle) toggle.setAttribute('aria-pressed', 'false');
    }
    console.log('[panel-mode] active =', active);
  }

  function isActive() {
    return active;
  }

  window.ezvibesPanelMode = { setActive, isActive, _test: { findRegion, PANEL_REGIONS } };
})();
