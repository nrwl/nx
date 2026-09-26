/**
 * Formats .mdoc files with oxfmt's markdown formatter. oxfmt picks a parser
 * from the file extension and cannot be told to treat .mdoc as markdown, so
 * the files are mirrored into a temp dir as .md, formatted there in a single
 * oxfmt run, and only the changed ones are copied back.
 *
 * Usage: node format-mdoc.mjs [--check]
 */
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { mkdtempSync, rmSync } from 'node:fs';
import { copyFile, mkdir, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const workspaceRoot = join(projectRoot, '..');
const contentDir = join(projectRoot, 'src/content');
const check = process.argv.includes('--check');

const require = createRequire(import.meta.url);
const oxfmtPkg = require.resolve('oxfmt/package.json', {
  paths: [workspaceRoot],
});
const oxfmtBin = join(
  dirname(oxfmtPkg),
  require(oxfmtPkg).bin.oxfmt ?? require(oxfmtPkg).bin
);

const files = (await readdir(contentDir, { recursive: true })).filter((f) =>
  f.endsWith('.mdoc')
);

const mirror = mkdtempSync(join(tmpdir(), 'nx-format-mdoc-'));
try {
  await Promise.all(
    files.map(async (f) => {
      const dest = join(mirror, `${f}.md`);
      await mkdir(dirname(dest), { recursive: true });
      await copyFile(join(contentDir, f), dest);
    })
  );

  // `-c` because config discovery starts from the mirrored file, outside the repo.
  const args = [
    oxfmtBin,
    '--list-different',
    '-c',
    join(workspaceRoot, '.oxfmtrc.json'),
    mirror,
  ];
  let listing = '';
  try {
    listing = execFileSync(process.execPath, args, {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'inherit'],
    });
  } catch (e) {
    if (e.status !== 1 || typeof e.stdout !== 'string') throw e;
    listing = e.stdout;
  }
  const changed = listing
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.endsWith('.mdoc.md'))
    .map((l) => relative(mirror, l).slice(0, -'.md'.length));

  if (check) {
    for (const f of changed)
      console.log(relative(projectRoot, join(contentDir, f)));
    if (changed.length > 0) {
      console.error(
        `\n${changed.length} file(s) are not formatted. Run \`nx run astro-docs:format:write\` to fix.`
      );
      process.exit(1);
    }
    console.log(`All ${files.length} .mdoc files are formatted.`);
  } else {
    if (changed.length > 0) {
      execFileSync(
        process.execPath,
        [
          oxfmtBin,
          '--write',
          '-c',
          join(workspaceRoot, '.oxfmtrc.json'),
          ...changed.map((f) => join(mirror, `${f}.md`)),
        ],
        { stdio: ['ignore', 'ignore', 'inherit'] }
      );
      await Promise.all(
        changed.map((f) =>
          copyFile(join(mirror, `${f}.md`), join(contentDir, f))
        )
      );
    }
    console.log(`Formatted ${changed.length} of ${files.length} .mdoc files.`);
  }
} finally {
  rmSync(mirror, { recursive: true, force: true });
}
