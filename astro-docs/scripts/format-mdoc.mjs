/**
 * Formats .mdoc files with oxfmt's markdown formatter. oxfmt selects its
 * parser by extension and cannot be configured to treat .mdoc as markdown,
 * so each file is piped through `oxfmt --stdin-filepath=x.md` instead.
 *
 * Usage: node format-mdoc.mjs [--check]
 */
import { execFile } from 'node:child_process';
import { createRequire } from 'node:module';
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const oxfmtPkg = require.resolve('oxfmt/package.json', {
  paths: [join(projectRoot, '..')],
});
const oxfmtBin = join(
  dirname(oxfmtPkg),
  require(oxfmtPkg).bin.oxfmt ?? require(oxfmtPkg).bin
);

const check = process.argv.includes('--check');
const CONCURRENCY = 8;

const contentDir = join(projectRoot, 'src/content');
const files = (await readdir(contentDir, { recursive: true }))
  .filter((f) => f.endsWith('.mdoc'))
  .map((f) => join(contentDir, f));

function formatOne(file, source) {
  return new Promise((res, rej) => {
    const child = execFile(
      process.execPath,
      [oxfmtBin, `--stdin-filepath=${join(projectRoot, '..', 'x.md')}`],
      { maxBuffer: 64 * 1024 * 1024 },
      (err, stdout) => (err ? rej(err) : res(stdout))
    );
    child.stdin.end(source);
  });
}

let unformatted = 0;
const queue = [...files];
await Promise.all(
  Array.from({ length: CONCURRENCY }, async () => {
    for (let file = queue.shift(); file; file = queue.shift()) {
      const source = await readFile(file, 'utf8');
      const formatted = await formatOne(file, source);
      if (formatted !== source) {
        unformatted++;
        if (check) {
          console.log(relative(projectRoot, file));
        } else {
          await writeFile(file, formatted);
        }
      }
    }
  })
);

if (check && unformatted > 0) {
  console.error(
    `\n${unformatted} file(s) are not formatted. Run \`nx run astro-docs:format:write\` to fix.`
  );
  process.exit(1);
}
console.log(
  check
    ? `All ${files.length} .mdoc files are formatted.`
    : `Formatted ${unformatted} of ${files.length} .mdoc files.`
);
