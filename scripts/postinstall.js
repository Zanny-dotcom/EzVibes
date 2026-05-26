const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const projectRoot = path.join(__dirname, '..');
const nodePtyDir = path.join(projectRoot, 'node_modules', 'node-pty');
const electronRebuildBin = path.join(
  projectRoot,
  'node_modules',
  '.bin',
  process.platform === 'win32' ? 'electron-rebuild.cmd' : 'electron-rebuild'
);

const sourcePatchSpecs = [
  {
    filePath: path.join(nodePtyDir, 'deps', 'winpty', 'src', 'winpty.gyp'),
    replacements: [
      ['cd shared && GetCommitHash.bat', 'cd shared && .\\\\GetCommitHash.bat'],
      ['cd shared && UpdateGenVersion.bat', 'cd shared && .\\\\UpdateGenVersion.bat'],
      ["'SpectreMitigation': 'Spectre'", "'SpectreMitigation': ''"],
    ],
  },
  {
    filePath: path.join(nodePtyDir, 'binding.gyp'),
    replacements: [
      ["'SpectreMitigation': 'Spectre'", "'SpectreMitigation': ''"],
    ],
  },
];

main();

function main() {
  printTargetInfo();

  requireDirectory(nodePtyDir, 'node-pty install directory');

  let sourceReplacementCount = 0;
  for (const spec of sourcePatchSpecs) {
    sourceReplacementCount += patchRequiredFile(spec.filePath, spec.replacements);
  }

  const generatedReplacementCount = patchGeneratedBuildFiles();
  console.log(
    `Patched node-pty build files (${sourceReplacementCount} source replacement(s), ${generatedReplacementCount} generated replacement(s)).`
  );

  runElectronRebuild();
}

function printTargetInfo() {
  const electronVersion = readElectronVersion();
  const electronAbi = electronVersion ? readElectronAbi(electronVersion) : null;

  console.log(`Host Node: ${process.version}`);
  console.log(`Target Electron: ${electronVersion || 'unknown'}`);
  console.log(`Expected Electron ABI: ${electronAbi || 'unknown'}`);
}

function readElectronVersion() {
  try {
    return require(path.join(projectRoot, 'node_modules', 'electron', 'package.json')).version;
  } catch (_error) {
    return null;
  }
}

function readElectronAbi(electronVersion) {
  try {
    return require('node-abi').getAbi(electronVersion, 'electron');
  } catch (_error) {
    return null;
  }
}

function patchRequiredFile(filePath, replacements) {
  requireFile(filePath);

  let content = fs.readFileSync(filePath, 'utf8');
  let replacementCount = 0;
  let changed = false;

  for (const [search, replace] of replacements) {
    const count = countOccurrences(content, search);

    if (count === 0) {
      const alreadyPatchedCount = countOccurrences(content, replace);
      if (alreadyPatchedCount > 0) {
        console.log(`${relativePath(filePath)} already patched for: ${summarize(search)}`);
        continue;
      }

      throw new Error(
        `Expected patch text was not found in ${relativePath(filePath)}: ${summarize(search)}`
      );
    }

    content = content.split(search).join(replace);
    replacementCount += count;
    changed = true;
    console.log(`${relativePath(filePath)}: ${count} replacement(s) for ${summarize(search)}`);
  }

  if (changed) {
    fs.writeFileSync(filePath, content, 'utf8');
  }

  return replacementCount;
}

function patchGeneratedBuildFiles() {
  const buildDir = path.join(nodePtyDir, 'build');
  if (!fs.existsSync(buildDir)) {
    console.log('node-pty generated build directory does not exist yet; skipping generated project file patch.');
    return 0;
  }

  const files = findFiles(buildDir, ['.vcxproj', '.props', '.targets']);
  if (files.length === 0) {
    console.log('No generated node-pty project files found; skipping generated project file patch.');
    return 0;
  }

  let replacementCount = 0;
  let alreadyPatchedCount = 0;
  for (const filePath of files) {
    let content = fs.readFileSync(filePath, 'utf8');
    const count = countOccurrences(content, '<SpectreMitigation>Spectre</SpectreMitigation>');

    if (count === 0) {
      alreadyPatchedCount += countOccurrences(content, '<SpectreMitigation>false</SpectreMitigation>');
      continue;
    }

    content = content
      .split('<SpectreMitigation>Spectre</SpectreMitigation>')
      .join('<SpectreMitigation>false</SpectreMitigation>');
    fs.writeFileSync(filePath, content, 'utf8');
    replacementCount += count;
    console.log(`${relativePath(filePath)}: ${count} generated SpectreMitigation replacement(s)`);
  }

  if (replacementCount === 0 && alreadyPatchedCount > 0) {
    console.log(`Generated node-pty project files already patched (${alreadyPatchedCount} occurrence(s)).`);
  } else if (replacementCount === 0) {
    console.log('No generated node-pty SpectreMitigation entries found.');
  }

  return replacementCount;
}

function runElectronRebuild() {
  requireFile(electronRebuildBin);

  const args = ['--force', '--which-module', 'node-pty', '--build-from-source'];
  console.log(`Running ${relativePath(electronRebuildBin)} ${args.join(' ')}...`);

  const result = runLocalBinary(electronRebuildBin, args);

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    process.exit(result.status || 1);
  }
}

function requireDirectory(dirPath, label) {
  if (!fs.existsSync(dirPath) || !fs.statSync(dirPath).isDirectory()) {
    throw new Error(`Missing ${label}: ${relativePath(dirPath)}`);
  }
}

function runLocalBinary(binPath, args) {
  if (process.platform === 'win32') {
    return spawnSync(process.env.ComSpec || 'cmd.exe', ['/d', '/c', binPath, ...args], {
      cwd: projectRoot,
      stdio: 'inherit',
    });
  }

  return spawnSync(binPath, args, {
    cwd: projectRoot,
    stdio: 'inherit',
  });
}

function requireFile(filePath) {
  if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
    throw new Error(`Missing required file: ${relativePath(filePath)}`);
  }
}

function findFiles(root, extensions) {
  const output = [];
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    const fullPath = path.join(root, entry.name);
    if (entry.isDirectory()) {
      output.push(...findFiles(fullPath, extensions));
    } else if (extensions.includes(path.extname(entry.name))) {
      output.push(fullPath);
    }
  }
  return output;
}

function countOccurrences(content, search) {
  return content.split(search).length - 1;
}

function relativePath(filePath) {
  return path.relative(projectRoot, filePath) || '.';
}

function summarize(value) {
  return JSON.stringify(value.length > 80 ? `${value.slice(0, 77)}...` : value);
}
