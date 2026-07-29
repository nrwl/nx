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
 * Module state because init is a single-shot command whose flows write from
 * many call sites across several files, a number of them behind early returns.
 * The only alternative is threading a collector through every one of them.
 */
const writtenFiles = new Set<string>();

/**
 * Records a file for `formatInitWrites` to format. Only worth calling for
 * files a formatter handles - `.gitignore` and the vendored `.nx` wrapper
 * scripts are deliberately left out rather than filtered later.
 *
 * Two of the recording helpers (`configure-plugins`, `check-compatible-with-
 * plugins`) are shared with `nx import`, which records but never drains. That
 * is inert - the process exits - but it means those writes are not formatted
 * there. Draining in `nx import` would be a behavior change for a different
 * command, so it is left alone deliberately.
 */
export function recordInitWrite(filePath: string): void {
  writtenFiles.add(filePath);
}

/**
 * Formats what init just wrote with the repo's own formatter, and nothing
 * else: an existing repo's other files are not init's to reformat.
 *
 * Failure is never fatal. The repo is already initialised by this point, so a
 * formatter that cannot run costs the user a `nx format` they can run
 * themselves, not their setup.
 */
export async function formatInitWrites(repoRoot: string): Promise<void> {
  const recorded = [...writtenFiles];
  // Cleared unconditionally: a second init in the same process must not
  // reformat the first one's files.
  writtenFiles.clear();

  if (process.env.NX_SKIP_FORMAT === 'true' || recorded.length === 0) {
    return;
  }

  // Repo-relative, and both writers are given `repoRoot` as their cwd, so the
  // paths stay short in the output and resolve against the repo rather than
  // wherever the command was invoked. That also pins oxfmt's `.editorconfig`
  // lookup, which it does once from the working directory. It does *not* pin
  // config discovery: oxfmt still finds a nested `.oxfmtrc.json` for files
  // under it, the same as the CLI does.
  // De-duplicated *after* normalising, not by the Set alone: the same file is
  // routinely recorded both ways - `'nx.json'` by one helper and
  // `join(repoRoot, 'nx.json')` by another - which are two Set keys for one
  // file and would otherwise be handed to the formatter twice.
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

  // `detectFormatter` reads package.json, so it belongs inside the try as much
  // as the formatter run does - a workspace whose package.json cannot be parsed
  // must not fail an init that has already finished.
  //
  // Chunked for the same reason `nx format` chunks: the Angular flow records a
  // `project.json` per project, so a large workspace can record more paths than
  // one command line holds. The prettier path quotes on its way to the shell,
  // so it is sized against that; oxfmt goes through execFile and gets them raw.
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
      // does not handle, while prettier fails the batch on one.
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
        ? `Could not format the files nx init wrote with ${formatter}.`
        : 'Could not work out which formatter to use for the files nx init wrote.',
      bodyLines: [
        ...(e?.message ? [e.message] : []),
        'Run "nx format:write" to format them.',
      ],
    });
  }
}
