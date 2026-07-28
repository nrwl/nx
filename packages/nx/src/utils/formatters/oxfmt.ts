import { execFile, execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import * as path from 'node:path';
import { pathToFileURL } from 'node:url';
import type { Tree } from '../../generators/tree';
import { parseJson } from '../json';
import { readModulePackageJson } from '../package-json';
import { FORMATTER_MAX_BUFFER } from './shared';

const dynamicImport = new Function('specifier', 'return import(specifier)') as (
  specifier: string
) => Promise<any>;

/**
 * oxfmt reports a file it has no parser for as an error rather than skipping
 * it, and nx hands it every changed file.
 */
const UNSUPPORTED_FILE_TYPE = 'Unsupported file type';

type OxfmtFormat = (
  fileName: string,
  sourceText: string,
  options?: Record<string, unknown>
) => Promise<{ code: string; errors?: { message: string }[] }>;

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

let cachedOxfmtModule: Promise<{ format: OxfmtFormat }> | undefined;

/**
 * oxfmt ships a programmatic API alongside its CLI, but only as ESM, so it
 * cannot be `require`d from nx's CommonJS build. Going through `import()` via
 * `new Function` keeps TypeScript from downlevelling it back to a `require`.
 *
 * The package is resolved the same way as the binary - from the workspace's own
 * install - because nx does not depend on oxfmt itself.
 */
function loadOxfmtModule(): Promise<{ format: OxfmtFormat }> {
  if (!cachedOxfmtModule) {
    const { packageJson, path: packageJsonPath } =
      readModulePackageJson('oxfmt');
    const entryPoint = path.resolve(
      path.dirname(packageJsonPath),
      packageJson.main ?? 'dist/index.js'
    );
    cachedOxfmtModule = dynamicImport(pathToFileURL(entryPoint).href).then(
      (imported) => (imported.format ? imported : imported.default)
    );
  }

  return cachedOxfmtModule;
}

/**
 * oxfmt's programmatic API takes options directly rather than discovering a
 * config file, so the workspace's config is read here. A config the generator
 * just created lives only in the tree, so it is passed in as `seedConfig` and
 * takes precedence over whatever is on disk.
 *
 * Only the JSON forms can be read this way; a `oxfmt.config.{ts,js,...}` would
 * have to be executed to be understood, so those workspaces fall back to
 * oxfmt's defaults.
 */
function resolveOxfmtOptions(
  workspaceRoot: string,
  seedConfig?: { name: string; content: string }
): Record<string, unknown> | undefined {
  let source: { name: string; content: string } | undefined = seedConfig;

  if (!source) {
    for (const name of oxfmtConfigFiles) {
      const configPath = path.join(workspaceRoot, name);
      if (existsSync(configPath)) {
        source = { name, content: readFileSync(configPath, 'utf-8') };
        break;
      }
    }
  }

  if (
    !source ||
    (!source.name.endsWith('.json') && !source.name.endsWith('.jsonc'))
  ) {
    return undefined;
  }

  try {
    return parseJson(source.content);
  } catch {
    // An unreadable config is oxfmt's to complain about, not formatting's.
    return undefined;
  }
}

/**
 * Formats a batch of in-memory files through oxfmt's programmatic API.
 *
 * The files exist only in a virtual tree, and formatting them must not touch
 * the workspace: staging copies of project files (project.json, package.json)
 * inside a workspace races the daemon's file watcher and the project graph
 * while a generator is running. oxfmt's `format` takes the content directly and
 * only reads the file name to pick a parser, so nothing is written to disk.
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

  const { format } = await loadOxfmtModule();
  const options = resolveOxfmtOptions(workspaceRoot, seedConfig);

  let error: string | undefined;
  await Promise.all(
    files.map(async (file) => {
      try {
        const result = await format(
          path.join(workspaceRoot, file.path),
          file.content,
          options
        );

        const failure = result.errors?.[0];
        if (failure) {
          // oxfmt is handed every changed file, most of which it has no parser
          // for. Those are skipped rather than reported, matching the CLI's
          // --no-error-on-unmatched-pattern; a real parse failure is reported
          // but costs only its own file.
          if (!failure.message.startsWith(UNSUPPORTED_FILE_TYPE)) {
            error ??= failure.message;
          }
          return;
        }

        if (result.code !== file.content) {
          formatted.set(file.path, result.code);
        }
      } catch (e) {
        error ??= e.message;
      }
    })
  );

  return { formatted, error };
}
