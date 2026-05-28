'use strict';

// Pure, Electron-free path predicates shared by the main process (authoritative
// folder-operation guards) and unit tests. Keep this module free of `electron`,
// `fs`, and side effects so it stays trivially testable with `node --test`.

const path = require('node:path');

// True when childPath is the same as, or nested inside, parentPath.
function isPathInside(parentPath, childPath) {
  const relative = path.relative(path.resolve(parentPath), path.resolve(childPath));
  return relative === '' || (!!relative && !relative.startsWith('..') && !path.isAbsolute(relative));
}

// True only when targetPath sits exactly one level below parentDir. Mirrors the
// containment guard already used by createFolder/renameFolder so deletes get the
// same confinement: not the parent itself, not a grandchild, not a sibling.
function isImmediateChildOf(parentDir, targetPath) {
  const parent = path.resolve(parentDir);
  const target = path.resolve(targetPath);
  return isPathInside(parent, target) && path.dirname(target) === parent;
}

// Returns the first session path that sits AT or UNDER targetPath (i.e. would be
// invalidated by trashing targetPath), else null. Non-string/blank entries are
// ignored so the renderer can pass raw Map keys without pre-filtering.
function liveSessionAtOrUnder(targetPath, sessionPaths) {
  const target = path.resolve(targetPath);
  for (const raw of sessionPaths || []) {
    if (typeof raw !== 'string' || !raw.trim()) continue;
    if (isPathInside(target, raw)) return path.resolve(raw);
  }
  return null;
}

module.exports = { isPathInside, isImmediateChildOf, liveSessionAtOrUnder };
