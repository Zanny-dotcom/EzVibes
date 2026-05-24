# Active Sessions Sidebar Filter Plan

## Goal

Add an `ACTIVE SESSIONS` control in the left sidebar, above `Home`, styled with green text. When clicked, the main folder grid should switch into an active-session view that shows every folder across the filesystem that currently has a Claude session open or minimized, regardless of which directory the user is browsing.

## Current Code Shape

- Sidebar markup lives in `renderer/index.html`.
- Sidebar button rendering is handled by `renderQuickPaths()` in `renderer/app.js`.
- Folder grid rendering is handled by `renderGrid()` in `renderer/app.js`.
- Active session state already exists in `state.windowsByPath`, keyed by absolute folder path.
- Folder cards already use `state.windowsByPath.get(entry.path)` to apply `session-open` and `session-minimized` styling.
- Session creation adds to `state.windowsByPath` in `launchClaudeForPath()`.
- Session close removes from `state.windowsByPath` in `closeSessionWindow()`.
- A `basename()` helper already exists in `renderer/app.js` (around line 970) and can derive a display name from any absolute path.
- Double-clicking a folder card that has an active session already restores the session window (the existing orange-folder behavior), so synthesized session cards in active-session mode will restore correctly without any extra wiring.

This means the feature can be implemented entirely in the renderer without new IPC or main-process changes.

## Proposed Behavior

1. Add a sidebar button labeled `ACTIVE SESSIONS` above the normal quick paths.
2. Style this button green so it stands apart from `Home`, `Desktop`, `Documents`, etc.
3. Clicking `ACTIVE SESSIONS` should not navigate to another filesystem path. The current `state.currentPath` and breadcrumb stay where they are; only the grid changes.
4. Instead, it should set a renderer view mode such as `state.viewMode = 'active-sessions'`.
5. In active-session mode, `renderGrid()` should ignore `state.entries` entirely and instead synthesize entries from `state.windowsByPath`. For each path key, build a lightweight entry:
   - `path` — the absolute folder path (the map key).
   - `name` — `basename(path)`.
   - `kind` — `'directory'`.
   Then apply the search query against this synthesized list, if one is active.
6. Quick path clicks, path navigation, Back, Up, Refresh, and drag/drop navigation should reset the mode back to the normal directory view.
7. Launching or closing a Claude session while active-session mode is selected should immediately update the grid because those paths are added to or removed from `state.windowsByPath`, and `renderGrid()` already runs after those mutations.
8. The folder count should communicate the global filtered state, for example:
   - `1 active session`
   - `3 active sessions`
   - `No active sessions`
9. If no sessions exist anywhere, show an empty-state message in the grid rather than a blank screen.
10. Double-clicking an active-session card in this view restores that session window (existing behavior); the active-session view remains until the user navigates.

## Implementation Steps

1. Update `renderer/index.html`.
   - Add a dedicated button before `<div id="quick-paths"></div>`.
   - Suggested markup:

     ```html
     <button id="active-sessions-btn" class="quick-path active-sessions-link" type="button">
       ACTIVE SESSIONS
     </button>
     ```

2. Update renderer state in `renderer/app.js`.
   - Add a mode field:

     ```js
     viewMode: 'all',
     ```

   - Cache the new element in `init()`:

     ```js
     els.activeSessionsBtn = document.getElementById('active-sessions-btn');
     ```

3. Bind the sidebar action.
   - In `bindEvents()`, add a click handler:

     ```js
     els.activeSessionsBtn.addEventListener('click', () => {
       state.viewMode = 'active-sessions';
       state.previewPath = '';
       renderSidebarState();
       renderGrid();
       renderNarrationSidebar();
     });
     ```

4. Reset the mode on normal navigation.
   - In `navigateTo()`, set `state.viewMode = 'all'` unless an option like `{ preserveViewMode: true }` is explicitly passed.
   - Quick path buttons can rely on this reset.
   - Back, Up, Refresh, and dropped folder navigation should also use normal mode.

5. Update `renderGrid()`.
   - Split entry sourcing into a helper that branches on `state.viewMode`:

     ```js
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
     ```

   - Use this helper in `renderGrid()`.
   - Update `folderCount` text based on `state.viewMode` (e.g. `${n} active session(s)` vs. the existing folder count).
   - Add an empty-state element when active-session mode returns no folders ("No active sessions").
   - Confirm that the synthesized entries still pick up `session-open` / `session-minimized` styling via the existing `state.windowsByPath.get(entry.path)` lookup in the card renderer — they should, because the entry `path` matches the map key by construction.

6. Update active styling.
   - Add a small helper such as `renderSidebarState()` that toggles `is-active` on the active sessions button.
   - Call it after navigation and after clicking the active sessions button.

7. Update CSS in `renderer/styles.css`.
   - Add green text and selected styling:

     ```css
     .active-sessions-link {
       color: #5af78e;
       font-weight: 700;
       text-transform: uppercase;
     }

     .active-sessions-link:hover,
     .active-sessions-link.is-active {
       border-color: rgba(90, 247, 142, 0.42);
       background: rgba(90, 247, 142, 0.1);
       color: #8cffad;
     }
     ```

   - Add an empty-state style if one does not already exist.

## Edge Cases

- Active sessions across the entire filesystem appear in this view, regardless of which directory the user is browsing. The synthesized entries are sourced from `state.windowsByPath`, not from `api.listDirectory()`.
- Minimized sessions count as active because they still exist in `state.windowsByPath`.
- Closed sessions disappear immediately because `closeSessionWindow()` deletes the folder path from `state.windowsByPath` and calls `renderGrid()`.
- If the underlying folder is renamed or deleted on disk while a session is open, the card will still appear with its original path/name until the session itself is closed. The path key in `state.windowsByPath` is not refreshed against the filesystem. This matches the existing behavior of the source folder card on the directory view.
- The sidebar's current path/breadcrumb does not change when entering active-session mode, so leaving the view (via Back, Up, a quick path, or clicking a card to navigate into the folder) returns the user to a coherent location.
- Search continues to narrow results inside active-session mode, filtering by folder name across the global list.

## Verification Checklist

1. Start the app with `npm start`.
2. Confirm the sidebar shows green `ACTIVE SESSIONS` above `Home`.
3. Open Claude sessions for folders in at least two different directories (e.g. one under `Documents`, one under `Desktop`).
4. From any directory, click `ACTIVE SESSIONS`; every active folder from across the filesystem should appear in the grid, regardless of the directory currently shown in the breadcrumb.
5. Minimize one session; it should still remain visible in the active-session view.
6. Close all sessions; the active-session view should show the "No active sessions" empty state.
7. Navigate to a quick path or use Back/Up and confirm the grid returns to the normal directory view.
8. Use search while active-session mode is selected and confirm it filters the global active-session list by folder name.
9. Double-click a session card in the active-session view and confirm the session window restores correctly.
