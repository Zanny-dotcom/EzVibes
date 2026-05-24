const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const nodePtyDir = path.join(__dirname, '..', 'node_modules', 'node-pty');

function patchFile(filePath, replacements) {
  if (!fs.existsSync(filePath)) return;
  let content = fs.readFileSync(filePath, 'utf8');
  for (const [search, replace] of replacements) {
    content = content.split(search).join(replace);
  }
  fs.writeFileSync(filePath, content, 'utf8');
}

patchFile(path.join(nodePtyDir, 'deps', 'winpty', 'src', 'winpty.gyp'), [
  ['cd shared && GetCommitHash.bat', 'cd shared && .\\\\GetCommitHash.bat'],
  ['cd shared && UpdateGenVersion.bat', 'cd shared && .\\\\UpdateGenVersion.bat'],
  ["'SpectreMitigation': 'Spectre'", "'SpectreMitigation': ''"],
]);

patchFile(path.join(nodePtyDir, 'binding.gyp'), [
  ["'SpectreMitigation': 'Spectre'", "'SpectreMitigation': ''"],
]);

for (const filePath of findFiles(path.join(nodePtyDir, 'build'), ['.vcxproj', '.props', '.targets'])) {
  patchFile(filePath, [
    ['<SpectreMitigation>Spectre</SpectreMitigation>', '<SpectreMitigation>false</SpectreMitigation>'],
  ]);
}

console.log('Patched node-pty build files.');
console.log('Running electron-rebuild...');
execSync('npx @electron/rebuild', { stdio: 'inherit', cwd: path.join(__dirname, '..') });

function findFiles(root, extensions) {
  if (!fs.existsSync(root)) return [];
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
