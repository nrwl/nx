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
 * Module state because init is a single-shot command whose flows write from a
 * dozen call sites across six files, several behind early returns. The only
 * alternative is threading a collector through every one of them.
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

  // Repo-relative, and both writers are given `repoRoot` as their cwd. That
  // keeps the paths short in the output and pins oxfmt's config and
  // `.editorconfig` lookup to the repo root, which it resolves from the
  // working directory rather than per file.
  const files = recorded
    .map((file) =>
      path
        .relative(repoRoot, path.resolve(repoRoot, file))
        .split(path.sep)
        .join('/')
    )
    .filter(
      (file) =>
        file &&
        !file.startsWith('../') &&
        !path.isAbsolute(file) &&
        existsSync(path.join(repoRoot, file))
    );
  if (files.length === 0) {
    return;
  }

  const formatter = detectFormatter(repoRoot);
  if (!formatter) {
    return;
  }

  // Chunked for the same reason `nx format` chunks: the Angular flow records a
  // `project.json` per project, so a large workspace can record more paths than
  // one command line holds. The prettier path quotes on its way to the shell,
  // so it is sized against that; oxfmt goes through execFile and gets them raw.
  try {
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
      title: `Could not format the files nx init wrote with ${formatter}.`,
      bodyLines: [
        ...(e?.message ? [e.message] : []),
        'Run "nx format:write" to format them.',
      ],
    });
  }
}
