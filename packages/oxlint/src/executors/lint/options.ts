import { createCliOptions, createOverrides } from '@nx/devkit/internal';
import type { LintExecutorSchema, OxlintOutputFormat } from './schema.js';

const SUPPORTED_FORMATS: readonly OxlintOutputFormat[] = [
  'default',
  'agent',
  'github',
  'json',
];

export interface ResolvedLintOptions {
  /** Flags forwarded to Oxlint, in order: target options, `args`, then CLI overrides. */
  flags: string[];
  format: OxlintOutputFormat;
  silent: boolean;
  maxWarnings: number | undefined;
  denyWarnings: boolean;
}

/**
 * Splits the executor options into flags for Oxlint and the ones this executor
 * applies per task: the run needs `--format=json`, `--silent` would empty the
 * JSON, and Oxlint's exit code covers the whole run, not one project.
 */
export function resolveLintOptions(
  options: LintExecutorSchema
): ResolvedLintOptions {
  const {
    lintFilePatterns: _patterns,
    nestedProjectRoots: _nestedRoots,
    args,
    __unparsed__: unparsed = [],
    ...forwarded
  } = options;

  // Nx passes each CLI override parsed (`config: 'a.json'`) and verbatim
  // (`--config=a.json`), and the verbatim copy wins. Nx's parse names `-c` and
  // positionals; the raw names add `--no-*` flags, which it names unprefixed.
  const cliOverrides = createOverrides(unparsed);
  const cliNames = new Set([
    ...unparsed.map(flagName).filter(Boolean),
    ...Object.keys(cliOverrides).map(kebabCase),
  ]);
  const fromOptions = Object.fromEntries(
    Object.entries(forwarded).filter(([key]) => !cliNames.has(kebabCase(key)))
  ) as Parameters<typeof createCliOptions>[0];

  const resolved: ResolvedLintOptions = {
    flags: [],
    format: 'default',
    silent: false,
    maxWarnings: undefined,
    denyWarnings: false,
  };

  const candidates = [
    ...createCliOptions(fromOptions),
    ...argsTokens(args, cliOverrides.args),
    ...unparsed,
  ];
  for (let i = 0; i < candidates.length; i++) {
    const flag = candidates[i];
    const name = flagName(flag);
    const value = () =>
      flag.includes('=') ? flag.slice(flag.indexOf('=') + 1) : candidates[++i];

    if (name === 'verbose' || name === 'no-verbose') {
      // Nx keeps its own --verbose in the options it hands an executor.
      continue;
    } else if (
      name &&
      ['args', 'lint-file-patterns', 'nested-project-roots'].includes(
        kebabCase(name)
      )
    ) {
      // The CLI copy of an option destructured above: drop it and its value.
      value();
    } else if (name === 'format' || flag.startsWith('-f')) {
      // Oxlint also takes the value attached, as in `-fjson`.
      resolved.format = assertSupportedFormat(
        /^-f[^=]/.test(flag) ? flag.slice(2) : value()
      );
    } else if (name === 'silent') {
      resolved.silent = true;
    } else if (name === 'max-warnings') {
      resolved.maxWarnings = Number(value());
    } else if (name === 'deny-warnings') {
      resolved.denyWarnings = true;
    } else {
      resolved.flags.push(flag);
    }
  }
  return resolved;
}

function assertSupportedFormat(value: string): OxlintOutputFormat {
  if (!SUPPORTED_FORMATS.includes(value as OxlintOutputFormat)) {
    throw new Error(
      `Unsupported Oxlint output format "${value}". @nx/oxlint renders ${SUPPORTED_FORMATS.map(
        (f) => `"${f}"`
      ).join(', ')}.`
    );
  }
  return value as OxlintOutputFormat;
}

/** Splits on whitespace outside single or double quotes, and strips the quotes. */
function splitArgsString(args: string | undefined): string[] {
  if (!args) {
    return [];
  }
  const tokens = args.match(/(?:[^\s"']+|"[^"]*"|'[^']*')+/g) ?? [];
  return tokens.map((token) =>
    token.replace(
      /"([^"]*)"|'([^']*)'/g,
      (_, double, single) => double ?? single
    )
  );
}

/**
 * Nx splits a CLI `--args` string on commas; rejoining recovers what was typed,
 * with Nx's interpolation applied. A repeated `--args` arrives as an array.
 */
function argsTokens(
  args: string | string[] | undefined,
  cliArgs: unknown
): string[] {
  if (cliArgs === undefined) {
    return Array.isArray(args) ? args : splitArgsString(args);
  }
  const values = [args].flat();
  return Array.isArray(cliArgs)
    ? values.flatMap((value) => splitArgsString(value))
    : splitArgsString(values.join(','));
}

function flagName(flag: string): string | null {
  if (!flag.startsWith('--')) {
    return null;
  }
  const end = flag.indexOf('=');
  return flag.slice(2, end === -1 ? undefined : end);
}

function kebabCase(key: string): string {
  return key.replace(/[A-Z]/g, (m) => '-' + m.toLowerCase());
}
