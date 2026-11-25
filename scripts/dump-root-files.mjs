import { execSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const label = process.argv[2] ?? 'unknown';
const root = process.cwd();
const print = (line) => console.log(`[root-files ${label}] ${line}`);

print(`cwd ${root}`);

const status = execSync('git status --porcelain --untracked-files=all', {
  encoding: 'utf8',
  maxBuffer: 64 * 1024 * 1024,
});
const statusLines = status.split('\n').filter(Boolean);
print(`git status entries ${statusLines.length}`);
for (const line of statusLines.slice(0, 500)) print(`STATUS ${line}`);

const dataDir =
  process.env.NX_WORKSPACE_DATA_DIRECTORY ?? join(root, '.nx/workspace-data');
const fileMapPath = join(dataDir, 'file-map.json');
if (!existsSync(fileMapPath)) {
  print(`no file map at ${fileMapPath}`);
  process.exit(0);
}

const { fileMap } = JSON.parse(readFileSync(fileMapPath, 'utf8'));
const files = [...(fileMap.projectFileMap['@nx/nx-source'] ?? [])].sort(
  (a, b) => (a.file < b.file ? -1 : 1)
);
const digest = createHash('sha256');
for (const f of files) digest.update(`${f.file}\0${f.hash}\n`);
print(`projects ${Object.keys(fileMap.projectFileMap).length}`);
print(`root project files ${files.length} digest ${digest.digest('hex')}`);
for (const f of files) print(`FILE ${f.hash} ${f.file}`);
