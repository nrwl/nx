import { execFile } from 'child_process';
import { existsSync, mkdtempSync, rmSync } from 'fs';
import { mkdir, readFile, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import * as path from 'path';
import { readModulePackageJson } from './package-json';

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

/**
 * Config filenames oxfmt discovers, in its own precedence order.
 * See apps/oxfmt/src/core/config in oxc-project/oxc.
 */
export const oxfmtConfigFiles = [
  '.oxfmtrc.json',
  '.oxfmtrc.jsonc',
  'oxfmt.config.ts',
  'oxfmt.config.mts',
];

export function formatContentWithOxfmt(
  filepath: string,
  content: string
): Promise<string> {
  const oxfmtBin = getOxfmtBinPath();
  return new Promise((resolve, reject) => {
    const child = execFile(
      'node',
      [oxfmtBin, `--stdin-filepath=${filepath}`],
      { encoding: 'utf-8' as const, windowsHide: true },
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
 * those files untouched.
 */
export async function formatFilesWithOxfmt(
  files: { path: string; content: string }[],
  workspaceRoot: string,
  seedConfig?: { name: string; content: string }
): Promise<Map<string, string>> {
  const formatted = new Map<string, string>();
  if (files.length === 0) {
    return formatted;
  }

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

    await Promise.all(
      files.map(async (file) => {
        const staged = path.join(scratch, file.path);
        await mkdir(path.dirname(staged), { recursive: true });
        await writeFile(staged, file.content, 'utf-8');
      })
    );

    await new Promise<void>((resolve, reject) => {
      execFile(
        'node',
        [oxfmtBin, '--no-error-on-unmatched-pattern', '--write', scratch],
        { encoding: 'utf-8' as const, windowsHide: true },
        (error, _stdout, stderr) => {
          if (error) {
            reject(new Error(stderr?.trim() || error.message));
          } else {
            resolve();
          }
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

  return formatted;
}
