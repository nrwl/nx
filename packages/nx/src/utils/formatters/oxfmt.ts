import ignore = require('ignore');
import { Minimatch } from 'minimatch';
import { execFile, execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import * as path from 'node:path';
import { pathToFileURL } from 'node:url';
import type { Tree } from '../../generators/tree';
import { readFileIfExisting } from '../fileutils';
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
) => Promise<{
  code: string;
  // `codeframe` carries the path and line; `message` on its own does not.
  errors?: { message: string; codeframe?: string }[];
}>;

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
        // A failure that never produced an exit code - the binary could not be
        // spawned, the process was killed, stdout overran maxBuffer - reports
        // a string `code` or none at all. Treating those as exit 0 would let
        // `nx format:check` pass on a formatter that never ran, so they have
        // to reject before the exit code is read.
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
 * Loads oxfmt's programmatic API, which ships only as ESM.
 *
 * `require` is tried first: Node resolves an ESM-only package through `require`
 * on its own (20.19+/22.12+), and going through the bare package name is what
 * lets jest intercept it with a CommonJS mock. Older runtimes throw there, so
 * the fallback imports the entry point directly - `import()` is reached through
 * `new Function` so TypeScript cannot downlevel it back to a `require`.
 *
 * The two paths resolve differently and deliberately so: the bare `require`
 * resolves from nx's own directory chain, while the fallback (like
 * `getOxfmtBinPath`) resolves from the workspace's install, because nx does not
 * depend on oxfmt itself.
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
 * `require` handles a CommonJS config directly, which keeps it out of the ESM
 * loader; only a config that is really ESM needs to be imported.
 */
async function loadJsOxfmtConfig(configPath: string): Promise<any> {
  try {
    return require(configPath);
  } catch {
    return await dynamicImport(pathToFileURL(configPath).href);
  }
}

/**
 * Builds the ignore matcher for a batch: the workspace-root `.gitignore` and
 * `.prettierignore`, plus the config's own `ignorePatterns`, which oxfmt
 * defines as gitignore-style and rooted at the config's directory.
 *
 * Only the root ignore files are read. The CLI additionally honours ignore
 * files sitting in subdirectories; formatting from memory deliberately does
 * not, because a generator batch is resolved against the workspace root.
 */
function readIgnoreMatcher(
  workspaceRoot: string,
  ignorePatterns?: string[]
): ReturnType<typeof ignore> | undefined {
  const patterns = ['.gitignore', '.prettierignore']
    .map((name) => readFileIfExisting(path.join(workspaceRoot, name)))
    .filter((contents) => contents.length > 0);

  if (patterns.length === 0 && !ignorePatterns?.length) {
    return undefined;
  }

  const matcher = ignore();
  for (const contents of patterns) {
    matcher.add(contents);
  }
  if (ignorePatterns?.length) {
    matcher.add(ignorePatterns);
  }

  return matcher;
}

type EditorConfigSection = {
  matches: (filePath: string) => boolean;
  properties: Record<string, string>;
};

/**
 * Reads the workspace's `.editorconfig` and compiles each section's glob once
 * for the whole batch - the globs are invariant, and recompiling them per file
 * is the difference between O(sections) and O(files x sections) regex builds.
 *
 * Only the root `.editorconfig` is read: nested files and the spec's
 * `root = true` walk-up are deliberately not implemented, matching the
 * workspace-root scope the rest of this batch is resolved against.
 */
function readEditorConfigSections(
  workspaceRoot: string
): EditorConfigSection[] | undefined {
  let contents: string;
  try {
    contents = readFileSync(path.join(workspaceRoot, '.editorconfig'), 'utf-8');
  } catch {
    return undefined;
  }

  const sections: EditorConfigSection[] = [];
  let current: EditorConfigSection | undefined;

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

    // Anything before the first section is preamble (`root = true`).
    const separator = trimmed.indexOf('=');
    if (!current || separator === -1) {
      continue;
    }
    current.properties[trimmed.slice(0, separator).trim().toLowerCase()] =
      trimmed
        .slice(separator + 1)
        .trim()
        .toLowerCase();
  }

  return sections.length > 0 ? sections : undefined;
}

/**
 * Compiles one `.editorconfig` section header into a matcher.
 *
 * Per the spec, a pattern containing `/` anywhere is relative to the directory
 * holding the `.editorconfig` (a leading `/` is only an anchor and is stripped);
 * a pattern with no separator at all applies at any depth.
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
 * Translates the `.editorconfig` properties that have an oxfmt equivalent. Any
 * value oxfmt has no meaning for - including the spec's `unset` - is left out
 * so that oxfmt's own default applies.
 */
function editorConfigOptionsForFile(
  sections: EditorConfigSection[],
  filePath: string
): Record<string, unknown> {
  const properties: Record<string, string> = {};
  for (const section of sections) {
    if (section.matches(filePath)) {
      // Later sections win, matching how editorconfig resolves a property.
      Object.assign(properties, section.properties);
    }
  }

  const options: Record<string, unknown> = {};

  const indentStyle = properties['indent_style'];
  if (indentStyle === 'tab' || indentStyle === 'space') {
    options.useTabs = indentStyle === 'tab';
  }

  // The spec makes `indent_size` the indentation width and `tab_width` only a
  // fallback for it, so `indent_size` wins here. Note oxfmt's CLI resolves the
  // pair the other way around, so a workspace setting both to different values
  // gets a different width from `nx format` than from a generator.
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

type ResolvedOxfmtConfig = {
  /** Options shaped the way `format()` accepts them. */
  options?: Record<string, unknown>;
  overrides?: OxfmtOverride[];
  ignorePatterns?: string[];
  /** Set when a config file exists but could not be read. */
  error?: string;
};

/**
 * `overrides` and `ignorePatterns` belong to oxfmt's *config file* schema, not
 * to the `FormatConfig` its programmatic API accepts - handing them to
 * `format()` would silently drop them, so a generator would format a file
 * differently from `nx format`. They are split out here and applied per file by
 * `formatFilesWithOxfmt` instead.
 */
function splitOxfmtConfig(
  config: Record<string, unknown> | undefined
): ResolvedOxfmtConfig {
  if (!config || typeof config !== 'object') {
    return {};
  }

  const { overrides, ignorePatterns, ...options } = config as {
    overrides?: {
      files?: string[];
      excludeFiles?: string[];
      options?: object;
    }[];
    ignorePatterns?: string[];
  } & Record<string, unknown>;

  return {
    options,
    ignorePatterns: Array.isArray(ignorePatterns) ? ignorePatterns : undefined,
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

function compileGlobSet(globs: string[] | undefined): (p: string) => boolean {
  if (!Array.isArray(globs) || globs.length === 0) {
    return () => false;
  }
  const matchers = globs.map((glob) => new Minimatch(glob, { dot: true }));
  return (filePath) => matchers.some((matcher) => matcher.match(filePath));
}

/** Options from every override matching this file; later overrides win. */
function overrideOptionsForFile(
  overrides: OxfmtOverride[] | undefined,
  filePath: string
): Record<string, unknown> | undefined {
  if (!overrides?.length) {
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
 * oxfmt's programmatic API takes options directly rather than discovering a
 * config file, so the workspace's config is read here. A config the generator
 * just created lives only in the tree, so it is passed in as `seedConfig` and
 * takes precedence over whatever is on disk. Nx only ever generates the JSON
 * form, so a seed is parsed rather than executed; a seed in any other form
 * falls through to the config on disk rather than formatting with oxfmt's bare
 * defaults.
 *
 * A config that has to be executed to be understood is loaded the same way Nx
 * loads any other config file: TypeScript through the workspace's transpiler,
 * plain JavaScript through `import()`.
 *
 * Unlike the CLI, only the workspace-root config is read - nested configs
 * (which the CLI discovers unless given `--disable-nested-config`) are not.
 */
async function resolveOxfmtConfig(
  workspaceRoot: string,
  seedConfig?: { name: string; content: string }
): Promise<ResolvedOxfmtConfig> {
  if (seedConfig && isJsonOxfmtConfig(seedConfig.name)) {
    try {
      return splitOxfmtConfig(parseJson(seedConfig.content));
    } catch (e) {
      return { error: `Could not read ${seedConfig.name}: ${e.message}` };
    }
  }

  for (const name of oxfmtConfigFiles) {
    const configPath = path.join(workspaceRoot, name);
    if (!existsSync(configPath)) {
      continue;
    }

    try {
      if (isJsonOxfmtConfig(name)) {
        return splitOxfmtConfig(parseJson(readFileSync(configPath, 'utf-8')));
      }

      // Required lazily so that reading a JSON config does not pull in the
      // TypeScript transpiler machinery.
      const loaded = /\.(ts|mts|cts)$/.test(name)
        ? (
            require('../../plugins/js/utils/register') as typeof import('../../plugins/js/utils/register')
          ).loadTsFile(configPath)
        : await loadJsOxfmtConfig(configPath);

      return splitOxfmtConfig(loaded?.default ?? loaded);
    } catch (e) {
      // Unlike the CLI, oxfmt never sees this file - it is handed options in
      // memory - so nothing else will report that the config is unusable.
      return { error: `Could not read ${name}: ${e.message}` };
    }
  }

  return {};
}

/**
 * `ignore` rejects anything that is not already a relative path, and callers
 * pass both workspace-relative paths (from a tree) and absolute ones (from
 * `writeFormattedJsonFile`). Returns undefined for a path outside the
 * workspace, which the workspace's ignore files could not cover anyway.
 */
function toWorkspaceRelative(
  workspaceRoot: string,
  filePath: string
): string | undefined {
  const relative = path
    .relative(workspaceRoot, path.resolve(workspaceRoot, filePath))
    .split(path.sep)
    .join('/');

  return relative && !relative.startsWith('../') ? relative : undefined;
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
 * Returns the formatted content keyed by the path the caller passed in. A file
 * is absent from the map when oxfmt has no parser for it, when an ignore file
 * covers it, or when it is already formatted - callers leave those untouched.
 * A file oxfmt cannot parse fails only itself: the rest of the batch is still
 * applied, and every failure is reported through `errors`, one entry per file.
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
  const config = await resolveOxfmtConfig(workspaceRoot, seedConfig);
  // .editorconfig properties are matched per file. Precedence runs
  // .editorconfig < the config's own options < a matching override, which is
  // the order the CLI resolves them in.
  const editorConfigSections = readEditorConfigSections(workspaceRoot);
  const ignoreMatcher = readIgnoreMatcher(workspaceRoot, config.ignorePatterns);

  const errors: string[] = config.error ? [config.error] : [];
  await Promise.all(
    files.map(async (file) => {
      try {
        // Inside the try: `ignores()` throws on a path it considers
        // non-relative, and an unhandled rejection here would discard the
        // formatting of every other file in the batch.
        const relativePath =
          toWorkspaceRelative(workspaceRoot, file.path) ?? file.path;
        if (ignoreMatcher?.ignores(relativePath)) {
          return;
        }

        const result = await format(
          path.resolve(workspaceRoot, file.path),
          file.content,
          {
            ...(editorConfigSections &&
              editorConfigOptionsForFile(editorConfigSections, relativePath)),
            ...config.options,
            ...overrideOptionsForFile(config.overrides, relativePath),
          }
        );

        const failure = result.errors?.[0];
        if (failure) {
          // oxfmt is handed every changed file, most of which it has no parser
          // for. Those are skipped rather than reported, matching the CLI's
          // --no-error-on-unmatched-pattern; a real parse failure is reported
          // but costs only its own file.
          if (!failure.message.startsWith(UNSUPPORTED_FILE_TYPE)) {
            // `message` alone is context-free ("Unexpected token"); the path
            // and line live in the codeframe.
            errors.push(
              `${file.path}: ${
                (failure as { codeframe?: string }).codeframe?.trim() ||
                failure.message
              }`
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
