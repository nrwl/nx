import ignore = require('ignore');
import { Minimatch } from 'minimatch';
import { execFile, execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import * as path from 'node:path';
import { pathToFileURL } from 'node:url';
import type { Tree } from '../../generators/tree';
import { readFileIfExisting } from '../fileutils';
import {
  createIgnoreChainResolver,
  isIgnoredByChain,
  OXFMT_IGNORE_OPTIONS,
  posixDirname,
  type ScopedIgnoreMatcher,
} from '../ignore';
import { parseJson } from '../json';
import { readModulePackageJson } from '../package-json';
import { FORMATTER_MAX_BUFFER } from './shared';

const dynamicImport = new Function('specifier', 'return import(specifier)') as (
  specifier: string
) => Promise<any>;

/**
 * oxfmt errors on a file it has no parser for rather than skipping it, and
 * nx hands it every changed file.
 */
const UNSUPPORTED_FILE_TYPE = 'Unsupported file type';

type OxfmtFormat = (
  fileName: string,
  sourceText: string,
  options?: Record<string, unknown>
) => Promise<{
  code: string;
  // oxfmt's own types make `errors` and `codeframe` required; widened to
  // optional so the jest mock's shape fits.
  errors?: { message: string; codeframe?: string | null }[];
}>;

/**
 * Config filenames oxfmt *discovers* - narrower than the set `-c` accepts.
 * Measured against 0.60.0: `oxfmt.config.{js,cjs,mjs,cts}` load when named
 * but are never searched for, so treating one as config would format on
 * options oxfmt ignores. No precedence order - oxfmt fails with
 * "Both '<a>' and '<b>' found in <dir>" when a directory holds two.
 */
export const oxfmtConfigFiles = [
  '.oxfmtrc.json',
  '.oxfmtrc.jsonc',
  'oxfmt.config.ts',
  'oxfmt.config.mts',
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
 * oxfmt exits 2 when *every* path was skipped. Nx routinely passes mixed
 * file lists, so an empty match is success, not failure.
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

export function writeWithOxfmt(
  patterns: string[],
  // Defaults to the caller's cwd. `nx init` sets it so it can pass paths
  // relative to the repo root rather than absolute ones the user has to read.
  cwd?: string
): void {
  const oxfmtPath = getOxfmtBinPath();
  execFileSync(
    'node',
    [oxfmtPath, ...OXFMT_BASE_ARGS, '--write', '--', ...patterns],
    {
      cwd,
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
      [oxfmtPath, ...OXFMT_BASE_ARGS, '--list-different', '--', ...patterns],
      {
        encoding: 'utf-8' as const,
        windowsHide: true,
        maxBuffer: FORMATTER_MAX_BUFFER,
      },
      (error, stdout, stderr) => {
        // A spawn failure, kill, or maxBuffer overrun reports a string `code` or
        // none. Treating those as exit 0 would let `nx format:check` pass on a
        // formatter that never ran, so they reject before the code is read.
        if (error && typeof error['code'] !== 'number') {
          reject(
            new Error(
              `oxfmt could not be run to completion (${
                error['code'] ?? error.signal ?? 'unknown'
              }): ${error.message}`
            )
          );
          return;
        }

        // oxfmt writes the differing paths to stdout *before* it reports any
        // error, so a non-empty stdout does not mean the run succeeded. The
        // exit code is the only reliable signal.
        const code = error ? (error['code'] as number) : OxfmtExitCode.Success;
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

let cachedOxfmtModule: Promise<{ format: OxfmtFormat }> | undefined;

/**
 * `require` first: Node resolves ESM-only through it (20.19+/22.12+), and the
 * bare specifier is what lets jest swap in a CommonJS mock. The fallback reaches
 * `import()` via `new Function` so TypeScript cannot downlevel it to `require`.
 *
 * The two resolve from different places on purpose - `require` from nx's own
 * chain, the fallback from the workspace's install, since nx does not depend
 * on oxfmt.
 */
function loadOxfmtModule(): Promise<{ format: OxfmtFormat }> {
  if (!cachedOxfmtModule) {
    cachedOxfmtModule = (async () => {
      try {
        // Node resolves an ESM-only package through `require` on its own, and
        // going through the package name keeps the module mockable.
        const required = require('oxfmt');
        return required.format ? required : required.default;
      } catch {
        // Older runtimes cannot `require` an ESM package, so import the entry
        // point the same way the binary is resolved - from the workspace's own
        // install, because nx does not depend on oxfmt itself.
        const { packageJson, path: packageJsonPath } =
          readModulePackageJson('oxfmt');
        const entryPoint = path.resolve(
          path.dirname(packageJsonPath),
          packageJson.main ?? 'dist/index.js'
        );
        const imported = await dynamicImport(pathToFileURL(entryPoint).href);
        return imported.format ? imported : imported.default;
      }
    })().catch((error) => {
      // Do not hold on to the failure - the next call gets to try again.
      cachedOxfmtModule = undefined;
      throw error;
    });
  }

  return cachedOxfmtModule;
}

function isJsonOxfmtConfig(name: string): boolean {
  return name.endsWith('.json') || name.endsWith('.jsonc');
}

/**
 * `register` is required lazily so a JSON config does not pull in the
 * transpiler. `loadTsFile` bubbles the ESM-redispatch codes for a caller like
 * this one to dispatch to `import()`.
 *
 * The retry is deliberately not gated on those codes: the same config surfaces
 * as `ERR_REQUIRE_ASYNC_MODULE` or as `exports is not defined` depending on
 * whether swc/ts-node registered, and both mean "this is ESM, import it".
 * Only `import()` ever evaluates the config, so its error is thrown with the
 * `require` one as its cause rather than either being chosen.
 *
 * Covered by `create-nx-workspace-formatter.test.ts`; unreachable from jest.
 */
async function loadTsOxfmtConfig(configPath: string): Promise<unknown> {
  try {
    return (
      require('../../plugins/js/utils/register') as typeof import('../../plugins/js/utils/register')
    ).loadTsFile(configPath);
  } catch (loadError) {
    try {
      return await dynamicImport(pathToFileURL(configPath).href);
    } catch (importError) {
      throw Object.assign(importError, { cause: loadError });
    }
  }
}

/**
 * True when an ignore file along the chain covers the file, or the resolved
 * config's own `ignorePatterns` do.
 *
 * `ignorePatterns` is not an ignore file: oxfmt roots it at that config's
 * directory, so it is matched separately from the chain.
 */
function isIgnored(
  chain: ScopedIgnoreMatcher[],
  relativePath: string,
  config: DirectoryConfig,
  absoluteFilePath: string
): boolean {
  if (isIgnoredByChain(chain, relativePath)) {
    return true;
  }

  if (config.ignoreMatcher) {
    const relative = toRelativeWithin(config.dir, absoluteFilePath);
    if (relative !== undefined && config.ignoreMatcher.ignores(relative)) {
      return true;
    }
  }

  return false;
}

type EditorConfigSection = {
  matches: (filePath: string) => boolean;
  properties: Record<string, string>;
};

/** One `.editorconfig`, with the directory its section globs are relative to. */
type EditorConfigFile = {
  dir: string;
  sections: EditorConfigSection[];
  isRoot: boolean;
};

/**
 * Compiles each section's glob once per batch, not per file: the globs are
 * invariant, so this is O(sections) rather than O(files x sections).
 */
function readEditorConfigInDir(
  dir: string
): { sections: EditorConfigSection[]; isRoot: boolean } | undefined {
  let contents: string;
  try {
    contents = readFileSync(path.join(dir, '.editorconfig'), 'utf-8');
  } catch (e) {
    // Not having one is the common case. Anything else - unreadable, a
    // directory, a broken mount - would otherwise look identical to that and
    // silently format to different widths than `nx format` produces.
    if (e.code !== 'ENOENT') {
      throw new Error(`Could not read .editorconfig: ${e.message}`);
    }
    return undefined;
  }

  const sections: EditorConfigSection[] = [];
  let current: EditorConfigSection | undefined;
  let isRoot = false;

  for (const line of contents.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith(';')) {
      continue;
    }

    const header = /^\[(.*)\]$/.exec(trimmed);
    if (header) {
      current = { matches: compileEditorConfigGlob(header[1]), properties: {} };
      sections.push(current);
      continue;
    }

    const separator = trimmed.indexOf('=');
    if (separator === -1) {
      continue;
    }
    const key = trimmed.slice(0, separator).trim().toLowerCase();
    const value = trimmed
      .slice(separator + 1)
      .trim()
      .toLowerCase();

    // Anything before the first section is preamble, where `root = true` stops
    // the walk-up.
    if (!current) {
      if (key === 'root' && value === 'true') {
        isRoot = true;
      }
      continue;
    }
    current.properties[key] = value;
  }

  return { sections, isRoot };
}

/**
 * The `.editorconfig` files applying to a directory, farthest first, walking
 * up until one declares `root = true` - the spec's termination rule, which
 * the oxfmt CLI follows. Deliberately continues above the workspace root,
 * where a repo nested in a larger checkout keeps shared settings.
 *
 * Cached per directory; returned in application order, so nearer overwrites
 * farther.
 */
function createEditorConfigResolver(): (fileDir: string) => EditorConfigFile[] {
  const cache = new Map<string, EditorConfigFile[]>();

  return (fileDir: string) => {
    const key = path.resolve(fileDir);
    let chain = cache.get(key);
    if (chain) {
      return chain;
    }

    const found: EditorConfigFile[] = [];
    let current = key;
    while (true) {
      const parsed = readEditorConfigInDir(current);
      if (parsed) {
        found.push({ ...parsed, dir: current });
        if (parsed.isRoot) {
          break;
        }
      }
      const parent = path.dirname(current);
      if (parent === current) {
        break;
      }
      current = parent;
    }

    chain = found.reverse();
    cache.set(key, chain);
    return chain;
  };
}

/**
 * Compiles one `.editorconfig` section header into a matcher.
 *
 * Per the spec a pattern containing `/` is relative to the `.editorconfig`'s
 * directory (a leading `/` is only an anchor and is stripped); one with no
 * separator applies at any depth.
 */
function compileEditorConfigGlob(glob: string): (filePath: string) => boolean {
  const pattern = glob.startsWith('/')
    ? glob.slice(1)
    : glob.includes('/')
      ? glob
      : `**/${glob}`;

  const matcher = new Minimatch(pattern, { dot: true });

  return (filePath) => matcher.match(filePath);
}

/**
 * Translates the `.editorconfig` properties with an oxfmt equivalent. Values
 * oxfmt has no meaning for - including the spec's `unset` - are left out so
 * oxfmt's own default applies.
 */
function editorConfigOptionsForFile(
  files: EditorConfigFile[],
  absoluteFilePath: string
): Record<string, unknown> {
  const properties: Record<string, string> = {};
  for (const file of files) {
    // Globs are relative to the directory holding the `.editorconfig`.
    const relative = toRelativeWithin(file.dir, absoluteFilePath);
    if (relative === undefined) {
      continue;
    }
    for (const section of file.sections) {
      if (section.matches(relative)) {
        // Later sections win, matching how editorconfig resolves a property.
        Object.assign(properties, section.properties);
      }
    }
  }

  const options: Record<string, unknown> = {};

  const indentStyle = properties['indent_style'];
  if (indentStyle === 'tab' || indentStyle === 'space') {
    options.useTabs = indentStyle === 'tab';
  }

  // Measured divergence, left deliberately: with no `indent_style` the CLI
  // ignores `indent_size` and uses `tab_width` (default 2), while this follows
  // the spec and honours `indent_size`. Matching the quirk would drop a width
  // the user asked for. With `indent_style` set - nearly every file - the two
  // agree.
  const indentSize = properties['indent_size'] ?? properties['tab_width'];
  if (indentSize === 'tab') {
    options.useTabs = true;
  } else if (indentSize && /^\d+$/.test(indentSize)) {
    options.tabWidth = Number(indentSize);
  }

  const maxLineLength = properties['max_line_length'];
  if (maxLineLength && /^\d+$/.test(maxLineLength)) {
    options.printWidth = Number(maxLineLength);
  }

  const quoteType = properties['quote_type'];
  if (quoteType === 'single' || quoteType === 'double') {
    options.singleQuote = quoteType === 'single';
  }

  const endOfLine = properties['end_of_line'];
  if (endOfLine === 'lf' || endOfLine === 'crlf' || endOfLine === 'cr') {
    options.endOfLine = endOfLine;
  }

  const insertFinalNewline = properties['insert_final_newline'];
  if (insertFinalNewline === 'true' || insertFinalNewline === 'false') {
    options.insertFinalNewline = insertFinalNewline === 'true';
  }

  return options;
}

type OxfmtOverride = {
  matches: (filePath: string) => boolean;
  options: Record<string, unknown>;
};

/**
 * Either a usable config or the reason there isn't one, never both. Only
 * half is enforced: the error arm types every payload key as `undefined`,
 * but `strict: false` erases the `| undefined` that would force callers to
 * check `error` first. They must anyway - formatting past a workspace's
 * `ignorePatterns` is the case that matters.
 */
type ResolvedOxfmtConfig =
  | {
      error: string;
      options?: undefined;
      overrides?: undefined;
      ignorePatterns?: undefined;
    }
  | {
      error?: undefined;
      /** Options shaped the way `format()` accepts them. */
      options?: Record<string, unknown>;
      overrides?: OxfmtOverride[];
      ignorePatterns?: string[];
    };

/**
 * `overrides` and `ignorePatterns` are config-file schema, not the
 * `FormatConfig` the programmatic API takes - `format()` would silently drop
 * them, so a generator would diverge from `nx format`. Split out here and
 * applied per file by `formatFilesWithOxfmt`.
 */
function splitOxfmtConfig(config: unknown): ResolvedOxfmtConfig {
  if (config === undefined) {
    return {};
  }
  // Measured: `123` / `"x"` / `[]` / `null` / `true` each exit 1 with
  // "invalid type: ... expected struct Oxfmtrc". Returning `{}` would instead
  // format on bare defaults - the divergence the `error` arm prevents. `[]`
  // needs its own check since `typeof [] === 'object'`. `config` stays
  // `unknown` so the guard does not look dead.
  if (config === null || typeof config !== 'object' || Array.isArray(config)) {
    return { error: 'the config must be an object' };
  }

  const {
    overrides: rawOverrides,
    ignorePatterns: rawIgnorePatterns,
    ...options
  } = config as {
    overrides?: {
      files?: string[];
      excludeFiles?: string[];
      options?: object;
    }[];
    ignorePatterns?: string[];
  } & Record<string, unknown>;

  // oxfmt reads an explicit `null` as an absent key and formats without
  // complaint, so it is normalised rather than rejected - erroring here would
  // skip the whole batch over a config `nx format` accepts.
  const overrides = rawOverrides ?? undefined;
  const ignorePatterns = rawIgnorePatterns ?? undefined;

  // Shapes oxfmt refuses to load are reported rather than dropped. Quietly
  // ignoring them would leave the batch formatting past exclusions the config
  // asked for, while `nx format` on the same workspace fails outright.
  if (
    ignorePatterns !== undefined &&
    (!Array.isArray(ignorePatterns) ||
      ignorePatterns.some((pattern) => typeof pattern !== 'string'))
  ) {
    return { error: '"ignorePatterns" must be an array of strings' };
  }
  if (
    overrides !== undefined &&
    (!Array.isArray(overrides) ||
      overrides.some(
        (override) =>
          override === null ||
          typeof override !== 'object' ||
          // `files` is required by oxfmt, not merely typed: an override that
          // omits it fails the whole config with "missing field `files`".
          override.files === undefined ||
          !isGlobSet(override.files) ||
          !isGlobSet(override.excludeFiles)
      ))
  ) {
    return {
      error:
        '"overrides" must be an array of { files, excludeFiles } string arrays, each with "files"',
    };
  }

  return {
    options,
    ignorePatterns,
    overrides: Array.isArray(overrides)
      ? overrides.map((override) => {
          // oxfmt matches these against paths relative to the config file,
          // which for a workspace batch is the workspace root.
          const include = compileGlobSet(override?.files);
          const exclude = compileGlobSet(override?.excludeFiles);
          return {
            matches: (filePath: string) =>
              include(filePath) && !exclude(filePath),
            options: (override?.options ?? {}) as Record<string, unknown>,
          };
        })
      : undefined,
  };
}

/**
 * oxfmt's `GlobSet` is `string[]`. Absent passes: it is legal for
 * `excludeFiles`, and `files` is checked separately by its caller.
 */
function isGlobSet(globs: unknown): boolean {
  return (
    globs === undefined ||
    (Array.isArray(globs) && globs.every((g) => typeof g === 'string'))
  );
}

function compileGlobSet(globs: string[] | undefined): (p: string) => boolean {
  // Not lenient about a bare string, though prettier allows one: oxfmt's type
  // is `GlobSet = string[]` and its CLI rejects the config with "invalid type:
  // string, expected a sequence". Accepting it would apply an override that
  // `nx format` refuses to run.
  if (!Array.isArray(globs) || globs.length === 0) {
    return () => false;
  }
  const matchers = globs.map((glob) => {
    // oxfmt lifts a separator-less pattern to any depth and reads `./` as
    // anchored to the config's directory; minimatch does neither, so `*.md`
    // would match only at the root - the shape `oxfmt migrate-prettier` emits.
    // See GlobSet::new in crates/oxc_config/src/glob_set.rs.
    const lifted = glob.startsWith('./')
      ? glob.slice(2)
      : glob.includes('/')
        ? glob
        : `**/${glob}`;

    // Under negation oxfmt collapses a *single* leading globstar to one segment:
    // `!**/t.ts` selects as `!*/t.ts`, where minimatch's zero-or-more `**` would
    // exclude every `t.ts`. Interior and doubled leading globstars already agree
    // - measured against 0.60.0, so rewriting those would introduce divergence.
    const pattern =
      lifted.startsWith('!**/') && !lifted.startsWith('!**/**/')
        ? `!*/${lifted.slice(4)}`
        : lifted;

    // minimatch's `!` handling is left on: oxfmt normalizes then matches with
    // fast-glob, which also treats leading `!` as inversion. A separator-less
    // `!*.ts` is lifted above, so its `!` stops being leading and neither
    // inverts.
    return new Minimatch(pattern, { dot: true });
  });
  return (filePath) => matchers.some((matcher) => matcher.match(filePath));
}

/**
 * Options from every override matching this file; later ones win. Globs are
 * rooted at the workspace, so a path outside it matches nothing.
 */
function overrideOptionsForFile(
  overrides: OxfmtOverride[] | undefined,
  filePath: string | undefined
): Record<string, unknown> | undefined {
  if (!overrides?.length || filePath === undefined) {
    return undefined;
  }
  let options: Record<string, unknown> | undefined;
  for (const override of overrides) {
    if (override.matches(filePath)) {
      options = { ...options, ...override.options };
    }
  }
  return options;
}

/**
 * Reimplements oxfmt's own config resolution because `format()` discovers
 * nothing. Tracked at https://github.com/oxc-project/oxc/issues/19922.
 *
 * The nearest config at or above the file's directory wins and *replaces* the
 * one above rather than merging - measured against oxfmt 0.60.0, so merging
 * here would format differently from `nx format:write`.
 *
 * `seedConfig` is a root config that exists only in the tree, so it outranks
 * disk. Only the JSON form is parsed; any other form falls through to disk.
 * There is no JavaScript branch - oxfmt does not discover `oxfmt.config.js`.
 */
async function resolveOxfmtConfigInDir(
  dir: string,
  workspaceRoot: string,
  seedConfig?: { name: string; content: string }
): Promise<ResolvedOxfmtConfig | undefined> {
  // The seed is the root config the generator just created, so it only stands
  // in for a config at the root itself.
  if (
    seedConfig &&
    isJsonOxfmtConfig(seedConfig.name) &&
    path.resolve(dir) === path.resolve(workspaceRoot)
  ) {
    try {
      return splitOxfmtConfig(parseJson(seedConfig.content));
    } catch (e) {
      return { error: `Could not read ${seedConfig.name}: ${e.message}` };
    }
  }

  for (const name of oxfmtConfigFiles) {
    const configPath = path.join(dir, name);
    if (!existsSync(configPath)) {
      continue;
    }

    try {
      if (isJsonOxfmtConfig(name)) {
        return splitOxfmtConfig(parseJson(readFileSync(configPath, 'utf-8')));
      }

      // Every discovered name is JSON above or TypeScript here - there is no
      // JavaScript branch, because oxfmt does not discover `oxfmt.config.js`.
      const loaded = (await loadTsOxfmtConfig(configPath)) as
        | { default?: unknown }
        | undefined;

      return splitOxfmtConfig(loaded?.default ?? loaded);
    } catch (e) {
      // Unlike the CLI, oxfmt never sees this file - it is handed options in
      // memory - so nothing else will report that the config is unusable.
      return {
        error: `Could not read ${path.relative(workspaceRoot, configPath)}: ${
          e.message
        }`,
      };
    }
  }

  return undefined;
}

/**
 * The config for each file, keyed by directory and cached - every batch
 * re-resolves the same handful of directories.
 *
 * `dir` is where the winning config was found; `ignorePatterns` are
 * gitignore-style and rooted there, not at the workspace root.
 */
type DirectoryConfig = ResolvedOxfmtConfig & {
  dir: string;
  /** `ignorePatterns` compiled once per directory rather than per file. */
  ignoreMatcher?: ReturnType<typeof ignore>;
};

function createOxfmtConfigResolver(
  workspaceRoot: string,
  seedConfig?: { name: string; content: string }
): (fileDir: string) => Promise<DirectoryConfig> {
  const cache = new Map<string, Promise<DirectoryConfig>>();

  const resolve = async (fileDir: string): Promise<DirectoryConfig> => {
    for (const dir of ancestorsWithin(workspaceRoot, fileDir)) {
      const config = await resolveOxfmtConfigInDir(
        dir,
        workspaceRoot,
        seedConfig
      );
      if (config) {
        return {
          ...config,
          dir,
          ignoreMatcher: config.ignorePatterns?.length
            ? ignore().add(config.ignorePatterns)
            : undefined,
        };
      }
    }
    return { dir: workspaceRoot };
  };

  return (fileDir: string) => {
    const key = path.resolve(fileDir);
    let pending = cache.get(key);
    if (!pending) {
      pending = resolve(key);
      cache.set(key, pending);
    }
    return pending;
  };
}

/**
 * `dir` and every directory between it and `workspaceRoot`, nearest first.
 * Yields nothing when `dir` is outside the workspace.
 */
function* ancestorsWithin(
  workspaceRoot: string,
  dir: string
): Generator<string> {
  const root = path.resolve(workspaceRoot);
  let current = path.resolve(dir);

  if (current !== root && !current.startsWith(root + path.sep)) {
    return;
  }

  while (true) {
    yield current;
    if (current === root) {
      return;
    }
    const parent = path.dirname(current);
    // `dirname` of a filesystem root returns itself; without this a path that
    // somehow escaped the check above would spin forever.
    if (parent === current) {
      return;
    }
    current = parent;
  }
}

/**
 * `ignore` rejects anything not already relative, and callers pass both
 * workspace-relative and absolute paths.
 *
 * Undefined for a path outside the workspace root, including the root
 * itself; the caller reads that as "no ignore rules apply". On Windows a
 * path on another drive comes back looking relative (`D:/...`) - wrong
 * rather than undefined, but no shipped caller does that.
 */
function toRelativeWithin(
  baseDir: string,
  filePath: string
): string | undefined {
  const relative = path
    .relative(baseDir, path.resolve(baseDir, filePath))
    .split(path.sep)
    .join('/');

  return relative && !relative.startsWith('../') ? relative : undefined;
}

/**
 * The batch's own oxfmt config, by discovery order.
 *
 * Any discovered name is returned; only the JSON form is honoured, and
 * `resolveOxfmtConfigInDir` is what gates that.
 */
function findOxfmtConfigInBatch(
  files: { path: string; content: string }[]
): { name: string; content: string } | undefined {
  for (const name of oxfmtConfigFiles) {
    const match = files.find((file) => file.path === name);
    if (match) {
      return { name, content: match.content };
    }
  }
  return undefined;
}

/**
 * Nothing is written to disk: staging files inside the workspace would race the
 * daemon's watcher and the project graph mid-generator.
 *
 * A path is absent from the result when oxfmt has no parser for it, an ignore
 * file covers it, or it is already formatted. One unparseable file fails only
 * itself; the rest of the batch still applies.
 */
export async function formatFilesWithOxfmt(
  files: { path: string; content: string }[],
  workspaceRoot: string,
  seedConfig?: { name: string; content: string }
): Promise<{ formatted: Map<string, string>; errors?: string[] }> {
  const formatted = new Map<string, string>();
  if (files.length === 0) {
    return { formatted };
  }

  const { format } = await loadOxfmtModule();
  // Resolved from the file's own directory upwards, as the CLI does, cached
  // per directory. A config in the batch is the freshest there is, and for a
  // tree-holding caller may be the only copy. Callers that know which file
  // that is still pass it; this is the fallback.
  const resolveConfig = createOxfmtConfigResolver(
    workspaceRoot,
    seedConfig ?? findOxfmtConfigInBatch(files)
  );
  // All three generator-side values come from one constant so they cannot
  // drift. oxfmt honours `.prettierignore` as well as `.gitignore` (measured
  // against its CLI), keeping one matcher per file so a `!` in one cannot
  // re-include what the other excluded.
  const resolveIgnores = createIgnoreChainResolver(
    (relativePath) =>
      readFileIfExisting(path.join(workspaceRoot, relativePath)),
    OXFMT_IGNORE_OPTIONS.filenames,
    OXFMT_IGNORE_OPTIONS.merge
  );
  const resolveEditorConfig = createEditorConfigResolver();

  const errors: string[] = [];
  await Promise.all(
    files.map(async (file) => {
      try {
        const absolutePath = path.resolve(workspaceRoot, file.path);
        const fileDir = path.dirname(absolutePath);

        const config = await resolveConfig(fileDir);
        if (config.error) {
          // An unreadable config costs the workspace's style *and* its
          // `ignorePatterns`, so formatting on bare defaults would rewrite files the
          // config asks to skip - and `tree.write` is not undone by a warning. Only
          // files under that config are skipped.
          errors.push(config.error);
          return;
        }

        // Inside the try: `ignores()` throws on a path it considers non-relative,
        // and an unhandled rejection would discard the whole batch's formatting. A
        // path outside the workspace cannot be covered by its ignore files.
        const relativePath = toRelativeWithin(workspaceRoot, file.path);
        if (
          relativePath !== undefined &&
          isIgnored(
            resolveIgnores(
              OXFMT_IGNORE_OPTIONS.cascade ? posixDirname(relativePath) : ''
            ),
            relativePath,
            config,
            absolutePath
          )
        ) {
          return;
        }

        // Overrides are globs in the config's own file, so they match relative
        // to wherever that config was found rather than to the workspace root.
        const relativeToConfig = toRelativeWithin(config.dir, absolutePath);

        const result = await format(absolutePath, file.content, {
          // Precedence runs .editorconfig < the config's own options < a
          // matching override, which is the order the CLI resolves them in.
          ...editorConfigOptionsForFile(
            resolveEditorConfig(fileDir),
            absolutePath
          ),
          ...config.options,
          ...overrideOptionsForFile(config.overrides, relativeToConfig),
        });

        if (result.errors?.length) {
          // Most changed files have no oxfmt parser; those are skipped rather than
          // reported, matching the CLI's --no-error-on-unmatched-pattern. Every
          // diagnostic is read, not just [0]: an `Unsupported file type` entry can
          // precede a real one.
          for (const failure of result.errors) {
            if (failure.message.startsWith(UNSUPPORTED_FILE_TYPE)) {
              continue;
            }
            // `message` alone is context-free ("Unexpected token"); the path
            // and line live in the codeframe.
            errors.push(
              `${file.path}: ${failure.codeframe?.trim() || failure.message}`
            );
          }
          return;
        }

        if (result.code !== file.content) {
          formatted.set(file.path, result.code);
        }
      } catch (e) {
        errors.push(`${file.path}: ${e.message}`);
      }
    })
  );

  return { formatted, errors: errors.length > 0 ? errors : undefined };
}
