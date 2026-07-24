import { execFile, execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import * as path from 'node:path';
import type { Tree } from '../../generators/tree';
import { readModulePackageJson } from '../package-json';
import { FORMATTER_MAX_BUFFER } from './shared';

/**
 * Config filenames oxfmt discovers, in its own precedence order.
 * See apps/oxfmt/src/core/config in oxc-project/oxc.
 */
export const oxfmtConfigFiles = [
  '.oxfmtrc.json',
  '.oxfmtrc.jsonc',
  'oxfmt.config.ts',
  'oxfmt.config.mts',
  'oxfmt.config.cts',
  'oxfmt.config.js',
  'oxfmt.config.mjs',
  'oxfmt.config.cjs',
];

export function isUsingOxfmt(root: string): boolean {
  for (const file of oxfmtConfigFiles) {
    if (existsSync(path.join(root, file))) {
      return true;
    }
  }
  return false;
}

export function isUsingOxfmtInTree(tree: Tree): boolean {
  for (const file of oxfmtConfigFiles) {
    if (tree.exists(file)) {
      return true;
    }
  }
  return false;
}

/**
 * oxfmt silently skips paths it does not recognise, and exits 2 when *every*
 * path was skipped. Nx routinely passes mixed file lists, so treat an empty
 * match as success rather than a failure.
 */
const OXFMT_BASE_ARGS = ['--no-error-on-unmatched-pattern'];

const enum OxfmtExitCode {
  Success = 0,
  Mismatch = 1,
  Failure = 2,
}

let cachedOxfmtBin: string | undefined;

export function getOxfmtBinPath(): string {
  if (cachedOxfmtBin) {
    return cachedOxfmtBin;
  }

  const { packageJson, path: packageJsonPath } = readModulePackageJson('oxfmt');
  const bin =
    typeof packageJson.bin === 'string'
      ? packageJson.bin
      : packageJson.bin?.['oxfmt'];
  if (!bin) {
    throw new Error(`Could not find the oxfmt binary in ${packageJsonPath}`);
  }
  cachedOxfmtBin = path.resolve(path.dirname(packageJsonPath), bin);

  return cachedOxfmtBin;
}

export function writeWithOxfmt(patterns: string[]): void {
  const oxfmtPath = getOxfmtBinPath();
  execFileSync(
    'node',
    [oxfmtPath, ...OXFMT_BASE_ARGS, '--write', ...patterns],
    {
      stdio: [0, 1, 2],
      windowsHide: true,
    }
  );
}

export function checkWithOxfmt(patterns: string[]): Promise<string[]> {
  const oxfmtPath = getOxfmtBinPath();
  return new Promise((resolve, reject) => {
    execFile(
      'node',
      [oxfmtPath, ...OXFMT_BASE_ARGS, '--list-different', ...patterns],
      {
        encoding: 'utf-8' as const,
        windowsHide: true,
        maxBuffer: FORMATTER_MAX_BUFFER,
      },
      (error, stdout, stderr) => {
        // oxfmt writes the differing paths to stdout *before* it reports any
        // error, so a non-empty stdout does not mean the run succeeded. The
        // exit code is the only reliable signal.
        const code = typeof error?.['code'] === 'number' ? error['code'] : 0;
        if (code === OxfmtExitCode.Success) {
          resolve([]);
        } else if (
          code === OxfmtExitCode.Mismatch &&
          stdout.trim().length > 0
        ) {
          resolve(stdout.trim().split('\n'));
        } else {
          // Exit 1 with no stdout means an invalid config; exit 2 means oxfmt
          // failed outright (parse error, unreadable file).
          reject(
            new Error(
              stderr?.trim() ||
                error?.message ||
                `oxfmt exited with code ${code}`
            )
          );
        }
      }
    );
  });
}

export function formatContentWithOxfmt(
  filepath: string,
  content: string
): Promise<string> {
  const oxfmtBin = getOxfmtBinPath();
  return new Promise((resolve, reject) => {
    const child = execFile(
      'node',
      [oxfmtBin, `--stdin-filepath=${filepath}`],
      {
        encoding: 'utf-8' as const,
        windowsHide: true,
        maxBuffer: FORMATTER_MAX_BUFFER,
      },
      (error, stdout) => {
        if (error) {
          reject(error);
        } else {
          resolve(stdout);
        }
      }
    );
    child.stdin.write(content);
    child.stdin.end();
  });
}

/**
 * Formats a batch of in-memory files in a single oxfmt invocation.
 *
 * oxfmt resolves its config by walking up from each file on disk, so files
 * held only in a virtual tree are staged into a scratch directory first. The
 * scratch directory is placed inside `workspaceRoot` when that exists so the
 * workspace's own config is still discovered by walking up; `seedConfig` (a
 * config the generator just created, which is not on disk yet) is written at
 * the scratch root where it takes precedence.
 *
 * Returns the formatted content keyed by the original relative path. Paths
 * oxfmt does not handle are absent from the map, and callers should leave
 * those files untouched. A file oxfmt cannot parse fails only itself: the rest
 * of the batch is still applied, and the failure is reported through `error`.
 */
export async function formatFilesWithOxfmt(
  files: { path: string; content: string }[],
  workspaceRoot: string,
  seedConfig?: { name: string; content: string }
): Promise<{ formatted: Map<string, string>; error?: string }> {
  const formatted = new Map<string, string>();
  if (files.length === 0) {
    return { formatted };
  }

  let error: string | undefined;
  const oxfmtBin = getOxfmtBinPath();
  const baseDir = existsSync(workspaceRoot) ? workspaceRoot : tmpdir();
  const scratch = mkdtempSync(path.join(baseDir, '.nx-oxfmt-'));

  try {
    if (seedConfig) {
      await writeFile(
        path.join(scratch, seedConfig.name),
        seedConfig.content,
        'utf-8'
      );
    }

    // Staged files sit outside the workspace tree, so oxfmt would not find the
    // ignore files it normally honours. Copy them next to the staged content
    // so ignored paths stay ignored, matching the prettier backend.
    await Promise.all(
      ['.gitignore', '.prettierignore'].map(async (name) => {
        const source = path.join(workspaceRoot, name);
        if (existsSync(source)) {
          await writeFile(
            path.join(scratch, name),
            await readFile(source, 'utf-8'),
            'utf-8'
          );
        }
      })
    );

    await Promise.all(
      files.map(async (file) => {
        const staged = path.join(scratch, file.path);
        await mkdir(path.dirname(staged), { recursive: true });
        await writeFile(staged, file.content, 'utf-8');
      })
    );

    // A parse failure in one file exits the whole run non-zero, but oxfmt has
    // still written every file it could. Record the failure and keep going, so
    // one unparseable file does not cost the batch its formatting.
    error = await new Promise<string | undefined>((resolve) => {
      execFile(
        'node',
        [oxfmtBin, '--no-error-on-unmatched-pattern', '--write', scratch],
        {
          encoding: 'utf-8' as const,
          windowsHide: true,
          maxBuffer: FORMATTER_MAX_BUFFER,
        },
        (execError, _stdout, stderr) => {
          resolve(execError ? stderr?.trim() || execError.message : undefined);
        }
      );
    });

    await Promise.all(
      files.map(async (file) => {
        const content = await readFile(path.join(scratch, file.path), 'utf-8');
        if (content !== file.content) {
          formatted.set(file.path, content);
        }
      })
    );
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }

  return { formatted, error };
}
