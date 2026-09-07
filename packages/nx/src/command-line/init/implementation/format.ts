import { existsSync } from 'node:fs';
import * as path from 'node:path';
import { chunkify } from '../../../utils/chunkify';
import { detectFormatter } from '../../../utils/formatters';
import { writeWithOxfmt } from '../../../utils/formatters/oxfmt';
import {
  filterToPrettierSupportedFiles,
  quoteForShell,
  writeWithPrettier,
} from '../../../utils/formatters/prettier';
import { output } from '../../../utils/output';

/**
 * Paths `nx init` has created or modified.
 *
 * Module state because init's flows write from many call sites across
 * several files, a number behind early returns; the alternative is threading
 * a collector through every one.
 */
const writtenFiles = new Set<string>();

/**
 * Records a file for `formatInitWrites`. Only for files a formatter handles -
 * `.gitignore` and the vendored `.nx` scripts are left out rather than
 * filtered later.
 *
 * Two recording helpers are shared with `nx import`, which drains before each
 * commit amend; draining after one would leave the formatting uncommitted.
 * The drain is a no-op when empty.
 */
export function recordInitWrite(filePath: string): void {
  writtenFiles.add(filePath);
}

/**
 * Formats what init just wrote and nothing else: an existing repo's other
 * files are not init's to reformat.
 *
 * Never fatal - the repo is already initialised, so a formatter that cannot
 * run costs a `nx format` the user can run themselves, not their setup.
 */
export async function formatInitWrites(
  repoRoot: string,
  // `nx import` drains this set too, and a user who never ran `nx init` should
  // not be told `nx init` failed.
  command = 'nx init'
): Promise<void> {
  const recorded = [...writtenFiles];
  // Cleared unconditionally: a second init in the same process must not
  // reformat the first one's files.
  writtenFiles.clear();

  if (process.env.NX_SKIP_FORMAT === 'true' || recorded.length === 0) {
    return;
  }

  // Repo-relative with `repoRoot` as cwd, so paths stay short and resolve
  // against the repo. That also pins oxfmt's `.editorconfig` lookup, which it
  // does once from the working directory; it does not pin config discovery.
  //
  // De-duplicated *after* normalising: the same file is routinely recorded
  // both as `'nx.json'` and as `join(repoRoot, 'nx.json')`, which are two Set
  // keys for one file.
  const files = [
    ...new Set(
      recorded.map((file) =>
        path
          .relative(repoRoot, path.resolve(repoRoot, file))
          .split(path.sep)
          .join('/')
      )
    ),
  ].filter(
    (file) =>
      file &&
      !file.startsWith('../') &&
      !path.isAbsolute(file) &&
      existsSync(path.join(repoRoot, file))
  );
  if (files.length === 0) {
    return;
  }

  // `detectFormatter` reads package.json, so it belongs inside the try - a
  // workspace whose package.json cannot be parsed must not fail an init that
  // already finished.
  //
  // Chunked as `nx format` chunks: the Angular flow records a `project.json`
  // per project. The prettier path is sized against its quoted length; oxfmt
  // goes through execFile and gets raw paths.
  let formatter: ReturnType<typeof detectFormatter> = null;
  try {
    formatter = detectFormatter(repoRoot);
    if (!formatter) {
      return;
    }
    if (formatter === 'oxfmt') {
      for (const chunk of chunkify(files)) {
        if (chunk.length) {
          writeWithOxfmt(chunk, repoRoot);
        }
      }
    } else {
      // oxfmt needs no equivalent filter - it silently skips file types it
      // does not handle and exits 0. prettier still formats the rest of the
      // batch, but exits 2 on one unsupported file, which would end a
      // successful init with a spurious warning and prettier's own stderr.
      const supported = await filterToPrettierSupportedFiles(files);
      for (const chunk of chunkify(
        supported,
        undefined,
        (pattern) => quoteForShell(pattern).length
      )) {
        if (chunk.length) {
          writeWithPrettier(chunk, repoRoot);
        }
      }
    }
  } catch (e) {
    output.warn({
      title: formatter
        ? `Could not format the files ${command} wrote with ${formatter}.`
        : `Could not work out which formatter to use for the files ${command} wrote.`,
      bodyLines: [
        ...(e?.message ? [e.message] : []),
        'Run "nx format:write" to format them.',
      ],
    });
  }
}
