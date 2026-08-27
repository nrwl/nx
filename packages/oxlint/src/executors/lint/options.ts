import { createCliOptions } from '@nx/devkit/internal';
import type { LintExecutorSchema, OxlintOutputFormat } from './schema.js';

export const SUPPORTED_FORMATS: readonly OxlintOutputFormat[] = [
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
 * Splits the executor options into flags Oxlint gets and flags this executor
 * interprets itself. `--format` is always ours (the run needs JSON), `--silent`
 * would empty the JSON so it is honoured on the rendered output instead, and
 * the warning thresholds decide per-project success after the diagnostics are
 * split — Oxlint's exit code covers the whole run, not a project.
 */
export function resolveLintOptions(
  options: LintExecutorSchema
): ResolvedLintOptions {
  const {
    lintFilePatterns: _patterns,
    format,
    args,
    __unparsed__: unparsed = [],
    // Nx keeps its own --verbose in the options it hands an executor.
    verbose: _verbose,
    ...forwarded
  } = options;

  // A CLI override arrives both parsed (`maxWarnings: 0`) and verbatim
  // (`--max-warnings=0`); the verbatim copy wins so the flag reaches Oxlint
  // exactly as typed.
  const unparsedNames = new Set(unparsed.map(flagName).filter(Boolean));
  const fromOptions = Object.fromEntries(
    Object.entries(forwarded).filter(
      ([key]) => !unparsedNames.has(kebabCase(key))
    )
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
    ...(Array.isArray(args) ? args : args ? args.split(' ') : []),
    ...unparsed,
  ];
  for (let i = 0; i < candidates.length; i++) {
    const flag = candidates[i];
    const name = flagName(flag);
    const value = () =>
      flag.includes('=') ? flag.slice(flag.indexOf('=') + 1) : candidates[++i];

    if (name === 'verbose' || name === 'no-verbose') {
      continue;
    } else if (name === 'format' || flag === '-f' || flag.startsWith('-f=')) {
      resolved.format = assertSupportedFormat(value());
    } else if (name === 'silent') {
      resolved.silent = true;
    } else if (name === 'max-warnings') {
      resolved.maxWarnings = Number(value());
      resolved.flags.push(`--max-warnings=${resolved.maxWarnings}`);
    } else if (name === 'deny-warnings') {
      resolved.denyWarnings = true;
      resolved.flags.push(flag);
    } else {
      resolved.flags.push(flag);
    }
  }

  if (format) {
    resolved.format = assertSupportedFormat(format);
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
