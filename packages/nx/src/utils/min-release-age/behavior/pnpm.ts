import { existsSync, readFileSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';
import { gte, maxSatisfying, minSatisfying, rcompare, valid } from 'semver';
import { MS_PER_DAY, MS_PER_MINUTE } from '../constants';
import { MinReleaseAgeViolationError } from '../errors';
import type { RegistryMetadata } from '../packument';
import {
  blockedVersionsFrom,
  classifySpec,
  newestInRange,
  type PickOutcome,
  type VersionSpecType,
} from '../pick';
import type {
  MinReleaseAgePolicy,
  MinReleaseAgePolicyReadResult,
  PmMinReleaseAgeBehavior,
} from '../policy';

// First-match-by-version-range row describing how a pnpm version treats the
// cooldown gate. Resolution semantics differ enough across the 10.16/10.19/
// 10.20/11.0.0/11.0.4/11.1.0/11.1.3 boundaries that they are encoded as data.
interface PnpmBehaviorRow {
  // Inclusive lower bound; the first row whose bound is <= the version wins
  // when iterating newest-bound-first.
  minVersion: string;
  major: 10 | 11;
  // v10 is hardcoded strict; v11 defaults loose with optional auto-strict.
  strictMode: 'always' | 'default-loose';
  // >=11.0.4: window explicitly set on any surface auto-enables strict.
  strictAutoOnWhenExplicit: boolean;
  latestTagDegrade: 'same-major' | 'any-major';
  excludeGrammar: 'v1-exact-names' | 'v2-globs-unions';
  writesExcludes: boolean;
  // v11.1.0+ also reads uppercase PNPM_CONFIG_* env vars.
  uppercaseEnv: boolean;
}

// Ordered newest-bound-first so the first matching row applies.
const PNPM_BEHAVIOR_ROWS: PnpmBehaviorRow[] = [
  {
    minVersion: '11.1.3',
    major: 11,
    strictMode: 'default-loose',
    strictAutoOnWhenExplicit: true,
    latestTagDegrade: 'any-major',
    excludeGrammar: 'v2-globs-unions',
    writesExcludes: true,
    uppercaseEnv: true,
  },
  {
    minVersion: '11.1.0',
    major: 11,
    strictMode: 'default-loose',
    strictAutoOnWhenExplicit: true,
    latestTagDegrade: 'any-major',
    excludeGrammar: 'v2-globs-unions',
    writesExcludes: false,
    uppercaseEnv: true,
  },
  {
    minVersion: '11.0.4',
    major: 11,
    strictMode: 'default-loose',
    strictAutoOnWhenExplicit: true,
    latestTagDegrade: 'any-major',
    excludeGrammar: 'v2-globs-unions',
    writesExcludes: false,
    uppercaseEnv: false,
  },
  {
    minVersion: '11.0.0',
    major: 11,
    strictMode: 'default-loose',
    strictAutoOnWhenExplicit: false,
    latestTagDegrade: 'any-major',
    excludeGrammar: 'v2-globs-unions',
    writesExcludes: false,
    uppercaseEnv: false,
  },
  {
    minVersion: '10.20.0',
    major: 10,
    strictMode: 'always',
    strictAutoOnWhenExplicit: false,
    latestTagDegrade: 'any-major',
    excludeGrammar: 'v2-globs-unions',
    writesExcludes: false,
    uppercaseEnv: false,
  },
  {
    minVersion: '10.19.0',
    major: 10,
    strictMode: 'always',
    strictAutoOnWhenExplicit: false,
    latestTagDegrade: 'same-major',
    excludeGrammar: 'v2-globs-unions',
    writesExcludes: false,
    uppercaseEnv: false,
  },
  {
    minVersion: '10.16.0',
    major: 10,
    strictMode: 'always',
    strictAutoOnWhenExplicit: false,
    latestTagDegrade: 'same-major',
    excludeGrammar: 'v1-exact-names',
    writesExcludes: false,
    uppercaseEnv: false,
  },
];

function findBehaviorRow(pmVersion: string): PnpmBehaviorRow | undefined {
  return PNPM_BEHAVIOR_ROWS.find((row) => gte(pmVersion, row.minVersion));
}

// A single resolved cooldown window plus its excludes, tagged with where the
// window came from for messaging.
interface WindowResolution {
  kind: 'ok';
  windowMinutes: number;
  excludes: string[];
  sourceDescription: string;
  // True when the window came from a real surface (env/yaml/global/.npmrc);
  // false only for the invisible built-in 1440 default. Drives the >=11.0.4
  // strict auto-on rule, which fires only on an explicitly set window.
  windowExplicit: boolean;
}

// Sentinel for an unparseable surface value. A discriminant (rather than a bare
// `{ invalid }` shape) is required because nx builds with strictNullChecks off,
// where `in`/equality narrowing does not subtract object union members.
interface InvalidWindow {
  kind: 'invalid';
  reason: string;
}

/**
 * Reads pnpm's effective cooldown configuration once. The surface set and
 * precedence depend on the pnpm major: v10 layers npm-conf surfaces
 * (workspace yaml > npm_config env > project .npmrc > user .npmrc); v11
 * layers pnpm-native surfaces (pnpm_config / PNPM_CONFIG env >
 * pnpm-workspace.yaml > global config.yaml > built-in 1440-minute default).
 */
export async function readPnpmPolicy(
  root: string,
  pmVersion: string
): Promise<MinReleaseAgePolicyReadResult> {
  // A pnpm major newer than the table knows can behave differently; defer to a
  // real install rather than guessing.
  if (gte(pmVersion, '12.0.0')) {
    return {
      outcome: 'ambiguous',
      reason: `pnpm ${pmVersion} is newer than the known cooldown behavior table.`,
    };
  }

  const row = findBehaviorRow(pmVersion);
  if (!row) {
    return { outcome: 'inactive' };
  }

  let resolution: WindowResolution | InvalidWindow | null;
  let strictExplicit: boolean | undefined;
  let ignoreMissingTimeExplicit: boolean | undefined;
  if (row.major === 11) {
    const read = readV11Surfaces(root, row);
    resolution = read.window;
    strictExplicit = read.strictExplicit;
    ignoreMissingTimeExplicit = read.ignoreMissingTime;
  } else {
    resolution = readV10Surfaces(root);
    // v10 strict is hardcoded; no surface toggles it.
    strictExplicit = undefined;
  }

  if (!resolution) {
    return { outcome: 'inactive' };
  }
  if (resolution.kind !== 'ok') {
    return { outcome: 'ambiguous', reason: resolution.reason };
  }

  const { windowMinutes, excludes, sourceDescription, windowExplicit } =
    resolution;
  if (!Number.isFinite(windowMinutes)) {
    return {
      outcome: 'ambiguous',
      reason: `Invalid pnpm minimumReleaseAge value: ${String(windowMinutes)}.`,
    };
  }
  // 0 disables; negatives push the cutoff into the future -> everything passes.
  if (windowMinutes <= 0) {
    return { outcome: 'inactive' };
  }

  const windowMs = windowMinutes * MS_PER_MINUTE;
  const cutoffMs = Date.now() - windowMs;

  const strict = resolveStrict(row, strictExplicit, windowExplicit);
  // v10 always errors on missing time; v11 defaults to skip unless a surface
  // explicitly disabled it.
  const ignoreMissingTime =
    row.major === 11 ? (ignoreMissingTimeExplicit ?? true) : false;
  const behavior: PmMinReleaseAgeBehavior = {
    packageManager: 'pnpm',
    strict,
    // Loose fallback only exists on v11 when strict is off.
    looseFallback: row.major === 11 && !strict,
    latestTagDegrade: row.latestTagDegrade,
    writesExcludes: row.writesExcludes,
    missingTimeMap:
      row.major === 10 ? 'error' : ignoreMissingTime ? 'skip' : 'error',
  };

  const isExcluded = buildExcludeMatcher(excludes, row.excludeGrammar);
  if (isExcluded === null) {
    // An invalid exclude entry is a version-dependent landmine in pnpm; do not
    // mimic its crash, just defer.
    return {
      outcome: 'ambiguous',
      reason: 'Invalid pnpm minimumReleaseAgeExclude entry.',
    };
  }

  return {
    outcome: 'active',
    policy: {
      packageManager: 'pnpm',
      packageManagerVersion: pmVersion,
      cutoffMs,
      windowMs,
      sourceDescription,
      isExcluded,
      behavior,
    },
  };
}

function resolveStrict(
  row: PnpmBehaviorRow,
  strictExplicit: boolean | undefined,
  windowExplicit: boolean
): boolean {
  if (row.strictMode === 'always') {
    return true;
  }
  if (strictExplicit !== undefined) {
    return strictExplicit;
  }
  // >=11.0.4: an explicitly set window with no explicit strict flag turns
  // strict on. The invisible built-in 1440 default is NOT in explicitlySetKeys,
  // so it stays loose - the normal pnpm 11 state.
  return row.strictAutoOnWhenExplicit && windowExplicit;
}

// --- v11 surfaces -----------------------------------------------------------

function readV11Surfaces(
  root: string,
  row: PnpmBehaviorRow
): {
  window: WindowResolution | InvalidWindow | null;
  strictExplicit: boolean | undefined;
  ignoreMissingTime: boolean | undefined;
} {
  const env = process.env;
  const keySet = envKeySetForMajor(row);

  const wsRead = readYamlWindow(join(root, 'pnpm-workspace.yaml'));
  if (wsRead && wsRead.kind === 'invalid') {
    return {
      window: wsRead,
      strictExplicit: undefined,
      ignoreMissingTime: undefined,
    };
  }
  const globalRead = readYamlWindow(join(getConfigDir(env), 'config.yaml'));
  if (globalRead && globalRead.kind === 'invalid') {
    return {
      window: globalRead,
      strictExplicit: undefined,
      ignoreMissingTime: undefined,
    };
  }
  const wsYaml = wsRead && wsRead.kind === 'ok' ? wsRead : null;
  const globalYaml = globalRead && globalRead.kind === 'ok' ? globalRead : null;

  // pnpm v11 resolves each cooldown key independently across surfaces:
  // env > pnpm-workspace.yaml > global config.yaml > built-in default.
  const strictExplicit =
    readEnvBoolean(env, keySet, 'minimum_release_age_strict') ??
    wsYaml?.strict ??
    globalYaml?.strict;
  const ignoreMissingTime =
    readEnvBoolean(env, keySet, 'minimum_release_age_ignore_missing_time') ??
    wsYaml?.ignoreMissingTime ??
    globalYaml?.ignoreMissingTime;
  const envExcludes = readEnvArray(env, keySet, 'minimum_release_age_exclude');
  if (envExcludes === 'invalid') {
    return {
      window: {
        kind: 'invalid',
        reason: 'Invalid pnpm minimumReleaseAgeExclude entry.',
      },
      strictExplicit: undefined,
      ignoreMissingTime: undefined,
    };
  }
  const excludes =
    envExcludes ?? wsYaml?.excludes ?? globalYaml?.excludes ?? [];

  const envWindow = readEnvNumber(env, keySet, 'minimum_release_age');
  // pnpm drops a NaN env value rather than erroring; treat 'invalid' as unset
  // and fall through to lower surfaces.
  if (envWindow !== undefined && envWindow !== 'invalid') {
    return {
      window: {
        kind: 'ok',
        windowMinutes: envWindow,
        excludes,
        sourceDescription: `pnpm minimumReleaseAge (${envWindow} min, env)`,
        windowExplicit: true,
      },
      strictExplicit,
      ignoreMissingTime,
    };
  }
  if (wsYaml && wsYaml.windowMinutes !== undefined) {
    return {
      window: {
        kind: 'ok',
        windowMinutes: wsYaml.windowMinutes,
        excludes,
        sourceDescription: `pnpm minimumReleaseAge (${wsYaml.windowMinutes} min, pnpm-workspace.yaml)`,
        windowExplicit: true,
      },
      strictExplicit,
      ignoreMissingTime,
    };
  }
  if (globalYaml && globalYaml.windowMinutes !== undefined) {
    return {
      window: {
        kind: 'ok',
        windowMinutes: globalYaml.windowMinutes,
        excludes,
        sourceDescription: `pnpm minimumReleaseAge (${globalYaml.windowMinutes} min, global config.yaml)`,
        windowExplicit: true,
      },
      strictExplicit,
      ignoreMissingTime,
    };
  }

  // Built-in 1440-minute (1 day) default, injected programmatically and
  // invisible to `pnpm config get`. Loose unless some surface set strict.
  return {
    window: {
      kind: 'ok',
      windowMinutes: 1440,
      excludes,
      sourceDescription: 'pnpm minimumReleaseAge (1440 min, default)',
      windowExplicit: false,
    },
    strictExplicit,
    ignoreMissingTime,
  };
}

// --- v10 surfaces -----------------------------------------------------------

function readV10Surfaces(
  root: string
): WindowResolution | InvalidWindow | null {
  // v10 layers config via @pnpm/npm-conf, per key:
  // workspace yaml > npm_config_* env > project .npmrc > user .npmrc.
  const wsRead = readYamlWindow(join(root, 'pnpm-workspace.yaml'));
  if (wsRead && wsRead.kind === 'invalid') {
    return wsRead;
  }
  const wsYaml = wsRead && wsRead.kind === 'ok' ? wsRead : null;

  const env = process.env;
  const keySet: EnvKeySet = { prefix: 'npm_config_', uppercase: false };
  const rawEnvWindow = readEnvNumber(env, keySet, 'minimum_release_age');
  // npm-conf drops values that fail the Number type; treat as unset.
  const envWindow = rawEnvWindow === 'invalid' ? undefined : rawEnvWindow;

  const projectNpmrc = readNpmrcSurface(join(root, '.npmrc'));
  const userNpmrc = readNpmrcSurface(join(homedir(), '.npmrc'));

  // v10 reads npm_config_*, which never JSON-parses, so readEnvArray can only
  // yield a single-entry array or undefined here - never 'invalid'.
  const envExcludes = readEnvArray(env, keySet, 'minimum_release_age_exclude');
  const excludes =
    wsYaml?.excludes ??
    (envExcludes === 'invalid' ? undefined : envExcludes) ??
    projectNpmrc?.excludes ??
    userNpmrc?.excludes ??
    [];

  if (wsYaml && wsYaml.windowMinutes !== undefined) {
    return {
      kind: 'ok',
      windowMinutes: wsYaml.windowMinutes,
      excludes,
      sourceDescription: `pnpm minimumReleaseAge (${wsYaml.windowMinutes} min, pnpm-workspace.yaml)`,
      windowExplicit: true,
    };
  }
  if (envWindow !== undefined) {
    return {
      kind: 'ok',
      windowMinutes: envWindow,
      excludes,
      sourceDescription: `pnpm minimumReleaseAge (${envWindow} min, env)`,
      windowExplicit: true,
    };
  }
  for (const npmrc of [projectNpmrc, userNpmrc]) {
    if (npmrc && npmrc.windowMinutes !== undefined) {
      return {
        kind: 'ok',
        windowMinutes: npmrc.windowMinutes,
        excludes,
        sourceDescription: `pnpm minimumReleaseAge (${npmrc.windowMinutes} min, .npmrc)`,
        windowExplicit: true,
      };
    }
  }

  return null;
}

// --- surface parsers --------------------------------------------------------

interface YamlWindow {
  kind: 'ok';
  windowMinutes?: number;
  // undefined when the key is absent, so per-key precedence can fall through
  // to a lower surface.
  excludes?: string[];
  strict?: boolean;
  ignoreMissingTime?: boolean;
}

function readYamlRaw(path: string): Record<string, unknown> | null {
  if (!existsSync(path)) {
    return null;
  }
  try {
    const { load } = require('@zkochan/js-yaml');
    return (load(readFileSync(path, 'utf-8')) as Record<string, unknown>) ?? {};
  } catch {
    return null;
  }
}

function readYamlWindow(path: string): YamlWindow | InvalidWindow | null {
  const doc = readYamlRaw(path);
  if (!doc) {
    return null;
  }
  // Each key is read independently; pnpm merges surfaces per key.
  const excludes = readArrayKey(doc, 'minimumReleaseAgeExclude');
  const strict = readBooleanKey(doc, 'minimumReleaseAgeStrict');
  const ignoreMissingTime = readBooleanKey(
    doc,
    'minimumReleaseAgeIgnoreMissingTime'
  );
  const raw = doc['minimumReleaseAge'];
  if (raw === undefined || raw === null) {
    return { kind: 'ok', excludes, strict, ignoreMissingTime };
  }
  const num = toNumber(raw);
  if (num === null) {
    return {
      kind: 'invalid',
      reason: `Invalid pnpm minimumReleaseAge value: ${String(raw)}.`,
    };
  }
  return {
    kind: 'ok',
    windowMinutes: num,
    excludes,
    strict,
    ignoreMissingTime,
  };
}

function readNpmrcSurface(
  path: string
): { windowMinutes?: number; excludes?: string[] } | null {
  if (!existsSync(path)) {
    return null;
  }
  let raw: string;
  try {
    raw = readFileSync(path, 'utf-8');
  } catch {
    return null;
  }
  // v10 reads the kebab-case keys via npm-conf; camelCase in .npmrc is never
  // honored. Only the two cooldown keys are relevant here.
  let windowMinutes: number | undefined;
  let excludes: string[] | undefined;
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith(';')) {
      continue;
    }
    const eq = trimmed.indexOf('=');
    if (eq === -1) {
      continue;
    }
    const key = trimmed.slice(0, eq).trim();
    const value = stripQuotes(trimmed.slice(eq + 1).trim());
    if (key === 'minimum-release-age') {
      const num = toNumber(value);
      if (num !== null) {
        windowMinutes = num;
      }
    } else if (key === 'minimum-release-age-exclude') {
      // npm-conf accumulates repeated ini keys into an array.
      (excludes ??= []).push(value);
    }
  }
  return { windowMinutes, excludes };
}

// pnpm mirrors getConfigDir: XDG_CONFIG_HOME, else per-platform default.
function getConfigDir(env: NodeJS.ProcessEnv): string {
  if (env.XDG_CONFIG_HOME) {
    return join(env.XDG_CONFIG_HOME, 'pnpm');
  }
  if (process.platform === 'darwin') {
    return join(homedir(), 'Library/Preferences/pnpm');
  }
  if (process.platform !== 'win32') {
    return join(homedir(), '.config/pnpm');
  }
  if (env.LOCALAPPDATA) {
    return join(env.LOCALAPPDATA, 'pnpm/config');
  }
  return join(homedir(), '.config/pnpm');
}

// --- env helpers ------------------------------------------------------------

// Which env surface a pnpm major honors. v10 layers config via @pnpm/npm-conf,
// which reads `npm_config_*`; `pnpm_config_*` is dead there. v11 reads
// `pnpm_config_*` (and uppercase `PNPM_CONFIG_*` only >=11.1.0); `npm_config_*`
// is dead there.
interface EnvKeySet {
  prefix: 'pnpm_config_' | 'npm_config_';
  uppercase: boolean;
}

function envKeySetForMajor(row: PnpmBehaviorRow): EnvKeySet {
  return row.major === 11
    ? { prefix: 'pnpm_config_', uppercase: row.uppercaseEnv }
    : { prefix: 'npm_config_', uppercase: false };
}

function envKeys(keySet: EnvKeySet, suffix: string): string[] {
  const keys = [`${keySet.prefix}${suffix}`];
  if (keySet.uppercase) {
    keys.push(`${keySet.prefix.toUpperCase()}${suffix.toUpperCase()}`);
  }
  return keys;
}

function readEnvRaw(
  env: NodeJS.ProcessEnv,
  keySet: EnvKeySet,
  suffix: string
): string | undefined {
  for (const key of envKeys(keySet, suffix)) {
    if (env[key] !== undefined) {
      return env[key];
    }
  }
  return undefined;
}

function readEnvNumber(
  env: NodeJS.ProcessEnv,
  keySet: EnvKeySet,
  suffix: string
): number | 'invalid' | undefined {
  const raw = readEnvRaw(env, keySet, suffix);
  if (raw === undefined) {
    return undefined;
  }
  const num = toNumber(raw);
  // pnpm parses env values via Number(); NaN drops the key.
  return num === null ? 'invalid' : num;
}

function readEnvBoolean(
  env: NodeJS.ProcessEnv,
  keySet: EnvKeySet,
  suffix: string
): boolean | undefined {
  const raw = readEnvRaw(env, keySet, suffix);
  // pnpm's Boolean env schema (config/reader/src/env.ts) yields only true/false
  // for the literals; anything else drops the key, so the value falls through to
  // lower surfaces / defaults instead of coercing to false.
  if (raw === 'true') {
    return true;
  }
  if (raw === 'false') {
    return false;
  }
  return undefined;
}

function readEnvArray(
  env: NodeJS.ProcessEnv,
  keySet: EnvKeySet,
  suffix: string
): string[] | 'invalid' | undefined {
  const raw = readEnvRaw(env, keySet, suffix);
  if (raw === undefined) {
    return undefined;
  }
  // pnpm v11's [String, Array] env schema tries a JSON array first, then falls
  // back to the raw value as a single entry. v10 (nopt) never JSON-parses.
  if (keySet.prefix === 'pnpm_config_') {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        // pnpm passes the array verbatim, then errors at install
        // (ERR_PNPM_INVALID_MINIMUM_RELEASE_AGE_EXCLUDE) on any non-string
        // element; signal invalid so the caller defers to a real install.
        return parsed.every((e) => typeof e === 'string')
          ? (parsed as string[])
          : 'invalid';
      }
    } catch {}
  }
  return [raw];
}

// --- value helpers ----------------------------------------------------------

function toNumber(value: unknown): number | null {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed === '') {
      return null;
    }
    const num = Number(trimmed);
    return Number.isFinite(num) ? num : null;
  }
  return null;
}

function stripQuotes(value: string): string {
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }
  return value;
}

function readArrayKey(
  doc: Record<string, unknown>,
  key: string
): string[] | undefined {
  const value = doc[key];
  if (Array.isArray(value)) {
    return value.map((v) => String(v));
  }
  if (typeof value === 'string') {
    return [value];
  }
  return undefined;
}

function readBooleanKey(
  doc: Record<string, unknown> | null,
  key: string
): boolean | undefined {
  if (!doc) {
    return undefined;
  }
  const value = doc[key];
  if (typeof value === 'boolean') {
    return value;
  }
  if (value === 'true') {
    return true;
  }
  if (value === 'false') {
    return false;
  }
  return undefined;
}

// --- excludes ---------------------------------------------------------------

interface ExcludeRule {
  // null name matcher => the whole-name verdict; exactVersions empty => exclude
  // every version of the matched name, otherwise only the listed versions.
  matchesName: (name: string) => boolean;
  exactVersions: string[];
}

/**
 * Builds the exclude predicate matching pnpm's version-policy semantics.
 * Returns null when any entry is invalid (pnpm would error on it), so the
 * caller can defer to a real install rather than apply a partial policy.
 */
function buildExcludeMatcher(
  patterns: string[],
  grammar: 'v1-exact-names' | 'v2-globs-unions'
): ((name: string, version: string) => boolean) | null {
  if (patterns.length === 0) {
    return () => false;
  }

  if (grammar === 'v1-exact-names') {
    // 10.16-10.18: exact-name membership only; version specs are not matched
    // and invalid entries are silently ignored.
    const names = new Set(patterns);
    return (name: string) => names.has(name);
  }

  const rules: ExcludeRule[] = [];
  for (const pattern of patterns) {
    const parsed = parseVersionPolicyRule(pattern);
    if (parsed === null) {
      return null;
    }
    rules.push({
      matchesName: createNameMatcher(parsed.packageName),
      exactVersions: parsed.exactVersions,
    });
  }

  return (name: string, version: string) => {
    for (const rule of rules) {
      if (!rule.matchesName(name)) {
        continue;
      }
      if (rule.exactVersions.length === 0) {
        return true;
      }
      return rule.exactVersions.includes(version);
    }
    return false;
  };
}

interface ParsedRule {
  packageName: string;
  exactVersions: string[];
}

// Mirrors @pnpm/config.version-policy parseVersionPolicyRule. Returns null for
// invalid entries (invalid version union / name pattern with version union).
function parseVersionPolicyRule(pattern: string): ParsedRule | null {
  const isScoped = pattern.startsWith('@');
  const atIndex = isScoped ? pattern.indexOf('@', 1) : pattern.indexOf('@');

  if (atIndex === -1) {
    return { packageName: pattern, exactVersions: [] };
  }

  const packageName = pattern.slice(0, atIndex);
  const versionsPart = pattern.slice(atIndex + 1);

  const exactVersions: string[] = [];
  for (const versionRaw of versionsPart.split('||')) {
    const version = valid(versionRaw);
    if (version === null) {
      // ERR_PNPM_INVALID_VERSION_UNION.
      return null;
    }
    exactVersions.push(version);
  }
  if (packageName.includes('*')) {
    // ERR_PNPM_NAME_PATTERN_IN_VERSION_UNION.
    return null;
  }

  return { packageName, exactVersions };
}

// Mirrors @pnpm/config.matcher for a single pattern: '*' anywhere becomes
// '.*', '!' prefix negates, otherwise exact (case-sensitive) equality.
function createNameMatcher(pattern: string): (name: string) => boolean {
  if (pattern.startsWith('!')) {
    const inner = createNameMatcher(pattern.slice(1));
    return (name: string) => !inner(name);
  }
  if (pattern === '*') {
    return () => true;
  }
  const escaped = escapeRegExp(pattern).replace(/\\\*/g, '.*');
  if (escaped === pattern) {
    return (name: string) => name === pattern;
  }
  const regexp = new RegExp(`^${escaped}$`);
  return (name: string) => regexp.test(name);
}

function escapeRegExp(value: string): string {
  return value.replace(/[|\\{}()[\]^$+*?.]/g, '\\$&').replace(/-/g, '\\x2d');
}

// --- pick -------------------------------------------------------------------

/**
 * Mirrors pnpm's resolver under an active cooldown:
 * - exact pin too new -> strict/v10 violation; v11 loose installs it (immature).
 * - range -> newest mature; none -> v10/strict violation, v11 loose lowest
 *   (least-immature) version unfiltered (immature).
 * - latest tag -> degrade to newest mature (same-major <10.20, any-major after),
 *   none -> violation (loose installs the original target immature when even
 *   the unfiltered tag exists).
 * - non-latest tags (all versions) -> same-major mature required, else
 *   violation/loose-immature.
 */
export function pickPnpmVersion(
  spec: string,
  metadata: RegistryMetadata,
  policy: MinReleaseAgePolicy
): PickOutcome {
  const behavior = policy.behavior;
  if (behavior.packageManager !== 'pnpm') {
    throw new Error('pickPnpmVersion received a non-pnpm policy.');
  }

  const wholeMapMissing = metadata.time === null;
  if (wholeMapMissing && behavior.missingTimeMap === 'error') {
    throw missingTime(metadata, policy);
  }

  const type = classifySpec(spec);
  if (type === 'exact') {
    return pickExact(spec, metadata, policy, behavior);
  }
  if (type === 'tag') {
    return pickTag(spec, metadata, policy, behavior);
  }
  return pickRange(
    spec,
    metadata,
    policy,
    behavior,
    newestInRange(metadata, spec)
  );
}

type PnpmBehavior = Extract<
  PmMinReleaseAgeBehavior,
  { packageManager: 'pnpm' }
>;

function pickExact(
  spec: string,
  metadata: RegistryMetadata,
  policy: MinReleaseAgePolicy,
  behavior: PnpmBehavior
): PickOutcome {
  const unconstrained = spec;
  if (mature(metadata, policy, spec, behavior)) {
    return { version: spec, unconstrained };
  }
  if (behavior.looseFallback) {
    // v11 loose installs the pin anyway and records it as immature.
    return { version: spec, unconstrained, immature: true };
  }
  throw violation(metadata, policy, spec, 'exact', [spec]);
}

function pickTag(
  spec: string,
  metadata: RegistryMetadata,
  policy: MinReleaseAgePolicy,
  behavior: PnpmBehavior
): PickOutcome {
  const tagTarget = metadata.distTags[spec];
  if (!tagTarget) {
    throw violation(metadata, policy, spec, 'tag', []);
  }
  const unconstrained = tagTarget;
  if (mature(metadata, policy, tagTarget, behavior)) {
    return { version: tagTarget, unconstrained };
  }

  // latest degrades any-major (>=10.20) or same-major; non-latest is always
  // same-major. Prerelease flag must match the original tag target.
  const anyMajor =
    spec === 'latest' && behavior.latestTagDegrade === 'any-major';
  const degraded = degradeTag(metadata, policy, behavior, tagTarget, anyMajor);
  if (degraded) {
    return { version: degraded, unconstrained };
  }
  if (behavior.looseFallback) {
    // No mature tag candidate; loose keeps the original (immature) target.
    return { version: tagTarget, unconstrained, immature: true };
  }
  throw violation(metadata, policy, spec, 'tag', [tagTarget]);
}

function pickRange(
  spec: string,
  metadata: RegistryMetadata,
  policy: MinReleaseAgePolicy,
  behavior: PnpmBehavior,
  unconstrained: string
): PickOutcome {
  const matureInRange = matureVersions(metadata, policy, behavior);
  const newest = maxSatisfying(matureInRange, spec, {
    includePrerelease: false,
  });
  if (newest) {
    return { version: newest, unconstrained };
  }
  if (behavior.looseFallback) {
    // pnpm v11 loose falls back to the LOWEST version in range, unfiltered.
    const lowest = minSatisfying(metadata.versions, spec, {
      includePrerelease: false,
    });
    if (lowest) {
      return {
        version: lowest,
        unconstrained,
        immature: true,
      };
    }
  }
  const blocked = metadata.versions
    .filter((v) => inRange(v, spec))
    .sort(rcompare);
  throw violation(metadata, policy, spec, 'range', blocked);
}

// Mirrors filterMetaByPublishedDate dist-tag repopulation: highest mature
// candidate with (unless any-major) the same major as the original target.
// 10.16-10.18 matched the major by string prefix with no prerelease filter and
// no deprecation tie-break; 10.19.0 switched to numeric-major comparison and
// added both (registry/pkg-metadata-filter).
function degradeTag(
  metadata: RegistryMetadata,
  policy: MinReleaseAgePolicy,
  behavior: PnpmBehavior,
  target: string,
  anyMajor: boolean
): string | undefined {
  const filtersPrereleaseAndDeprecation = gte(
    policy.packageManagerVersion,
    '10.19.0'
  );
  const targetMajor = majorOf(target);
  const targetIsPre = isPrerelease(target);
  const targetMajorPrefix = `${targetMajor}.`;
  const candidates = matureVersions(metadata, policy, behavior).filter((v) => {
    if (filtersPrereleaseAndDeprecation && isPrerelease(v) !== targetIsPre) {
      return false;
    }
    if (anyMajor) {
      return true;
    }
    return filtersPrereleaseAndDeprecation
      ? majorOf(v) === targetMajor
      : v.startsWith(targetMajorPrefix);
  });
  if (candidates.length === 0) {
    return undefined;
  }
  return pickPreferringNonDeprecated(
    candidates,
    metadata,
    filtersPrereleaseAndDeprecation
  );
}

function pickPreferringNonDeprecated(
  candidates: string[],
  metadata: RegistryMetadata,
  preferNonDeprecated: boolean
): string {
  const sorted = [...candidates].sort(rcompare);
  // Deprecations are fetched lazily by the migrate layer when needed; the
  // synchronous pick prefers highest and lets the deprecation map (if attached
  // to metadata) break ties. 10.16-10.18 never had the tie-break.
  const deprecated = preferNonDeprecated ? metadata.deprecations : undefined;
  if (!deprecated) {
    return sorted[0];
  }
  const nonDeprecated = sorted.filter((v) => !deprecated[v]);
  return nonDeprecated[0] ?? sorted[0];
}

function matureVersions(
  metadata: RegistryMetadata,
  policy: MinReleaseAgePolicy,
  behavior: PnpmBehavior
): string[] {
  return metadata.versions.filter((v) => mature(metadata, policy, v, behavior));
}

// pnpm blocks a version whose individual time entry is missing (treated too
// new). The whole-map-missing skip case is handled before any pick.
function mature(
  metadata: RegistryMetadata,
  policy: MinReleaseAgePolicy,
  version: string,
  behavior: PnpmBehavior
): boolean {
  if (policy.isExcluded(metadata.name, version)) {
    return true;
  }
  if (metadata.time === null) {
    // Whole map missing reached here only with missingTimeMap 'skip' -> gate
    // is effectively off for this package.
    return true;
  }
  const time = metadata.time[version];
  if (!time) {
    return false;
  }
  return Date.parse(time) <= policy.cutoffMs;
}

function inRange(version: string, range: string): boolean {
  return maxSatisfying([version], range, { includePrerelease: false }) !== null;
}

function majorOf(version: string): number {
  return Number(version.split('.')[0].replace(/[^0-9].*$/, '')) || 0;
}

function isPrerelease(version: string): boolean {
  return version.includes('-');
}

// --- errors -----------------------------------------------------------------

function violation(
  metadata: RegistryMetadata,
  policy: MinReleaseAgePolicy,
  spec: string,
  type: VersionSpecType,
  blockedVersions: string[]
): MinReleaseAgeViolationError {
  return new MinReleaseAgeViolationError({
    packageManager: 'pnpm',
    packageName: metadata.name,
    spec,
    pmShapedDetail: violationDetail(
      metadata,
      policy,
      spec,
      type,
      blockedVersions
    ),
    blocked: blockedVersionsFrom(metadata, blockedVersions),
    remediation: [
      `Add ${metadata.name} (optionally with a version) to minimumReleaseAgeExclude in pnpm-workspace.yaml, wait for a matching version to age past the window, or lower ${policy.sourceDescription}.`,
    ],
  });
}

// Per pnpm version (source-verified against npm-resolver/index.ts and
// installing/commands/policyHandlers.ts):
// - v10: always NO_MATCHING.
// - 11.0.0..11.1.2: range/exact emit the single-version NO_MATURE form;
//   tags can't derive an immatureVersion from a tag name, so they fall back to
//   NO_MATCHING.
// - >=11.1.3: strict install fails via failOnImmature with the multi-entry
//   list form.
function violationDetail(
  metadata: RegistryMetadata,
  policy: MinReleaseAgePolicy,
  spec: string,
  type: VersionSpecType,
  blockedVersions: string[]
): string {
  const version = policy.packageManagerVersion;
  if (!gte(version, '11.0.0')) {
    return noMatchingDetail(metadata, spec);
  }
  if (gte(version, '11.1.3')) {
    return failOnImmatureDetail(metadata, policy, spec, type, blockedVersions);
  }
  if (type === 'tag') {
    return noMatchingDetail(metadata, spec);
  }
  return noMatureSingleDetail(metadata, spec, blockedVersions);
}

// ERR_PNPM_NO_MATCHING_VERSION headline (10.x always; v11 fallback).
function noMatchingDetail(metadata: RegistryMetadata, spec: string): string {
  return `No matching version found for ${metadata.name}@${spec} while fetching it from the registry`;
}

// 11.0.0..11.1.2 single-version NO_MATURE form (NoMatchingVersionError).
function noMatureSingleDetail(
  metadata: RegistryMetadata,
  spec: string,
  blockedVersions: string[]
): string {
  const newest = blockedVersions[0];
  const time = newest ? metadata.time?.[newest] : undefined;
  const ago = time ? formatTimeAgo(Date.parse(time)) : null;
  // pnpm emits the NO_MATURE message only with an immature pick that has a
  // known publish time; otherwise it falls back to NO_MATCHING.
  if (!newest || !ago) {
    return noMatchingDetail(metadata, spec);
  }
  return `Version ${newest} (released ${ago}) of ${metadata.name} does not meet the minimumReleaseAge constraint`;
}

// >=11.1.3 failOnImmature list form. failOnImmature lists the picks the resolver
// actually selected, one per resolution; resolving a single nx package yields a
// single immature pick. Each entry's reason mirrors detectMinReleaseAgeViolation
// (published-at ISO + cutoff ISO). For a range the resolver loose-picks the
// lowest in-range version; exact/tag carry their single target.
function failOnImmatureDetail(
  metadata: RegistryMetadata,
  policy: MinReleaseAgePolicy,
  spec: string,
  type: VersionSpecType,
  blockedVersions: string[]
): string {
  const resolved =
    type === 'range'
      ? blockedVersions[blockedVersions.length - 1]
      : blockedVersions[0];
  const publishedAt = resolved ? metadata.time?.[resolved] : undefined;
  if (!resolved || !publishedAt) {
    return noMatchingDetail(metadata, spec);
  }
  const cutoffIso = new Date(policy.cutoffMs).toISOString();
  const publishedIso = new Date(publishedAt).toISOString();
  return (
    '1 version does not meet the minimumReleaseAge constraint:\n' +
    `  ${metadata.name}@${resolved} was published at ${publishedIso}, within the minimumReleaseAge cutoff (${cutoffIso})`
  );
}

function missingTime(
  metadata: RegistryMetadata,
  policy: MinReleaseAgePolicy
): MinReleaseAgeViolationError {
  return new MinReleaseAgeViolationError({
    packageManager: 'pnpm',
    packageName: metadata.name,
    spec: '',
    pmShapedDetail: `The metadata of ${metadata.name} is missing the "time" field`,
    blocked: [],
    remediation: [
      `Set minimumReleaseAgeIgnoreMissingTime to true, or use a registry that serves package publish times.`,
    ],
  });
}

// Mirrors pnpm v11's formatTimeAgo buckets exactly (npm-resolver): 'just now'
// under a minute (and for future dates), days at >=48h, hours at >=90min.
function formatTimeAgo(ts: number): string | null {
  if (Number.isNaN(ts)) {
    return null;
  }
  const diffMs = Date.now() - ts;
  if (diffMs < MS_PER_MINUTE) {
    return 'just now';
  }
  const diffMin = Math.floor(diffMs / MS_PER_MINUTE);
  const diffHour = Math.floor(diffMs / (60 * MS_PER_MINUTE));
  const diffDay = Math.floor(diffMs / MS_PER_DAY);
  if (diffHour >= 48) return `${diffDay} day${diffDay === 1 ? '' : 's'} ago`;
  if (diffMin >= 90) return `${diffHour} hour${diffHour === 1 ? '' : 's'} ago`;
  return `${diffMin} minute${diffMin === 1 ? '' : 's'} ago`;
}
