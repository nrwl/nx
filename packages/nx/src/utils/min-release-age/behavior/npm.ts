import { execSync } from 'child_process';
import { homedir } from 'os';
import { join } from 'path';
import { gte, rcompare, satisfies } from 'semver';
import { MS_PER_DAY } from '../constants';
import { MinReleaseAgeViolationError } from '../errors';
import { readNpmrcEntries } from '../npmrc';
import type { RegistryMetadata } from '../packument';
import {
  blockedVersionsFrom,
  classifySpec,
  isVersionMature,
  newestInRange,
  type PickOutcome,
} from '../pick';
import type {
  MinReleaseAgePolicy,
  MinReleaseAgePolicyReadResult,
} from '../policy';

interface NpmEffectiveConfig {
  'min-release-age'?: unknown;
  before?: unknown;
}

// npm flattens config sources from least to highest priority (default ->
// builtin -> global -> user -> project -> env -> cli), each overwriting the
// flat `before` value. In the migrate context we can only detect a subset; a
// key present in the merged config but in none of these ranks lowest.
type NpmConfigRank = 0 | 1 | 2 | 3;
const RANK_UNKNOWN: NpmConfigRank = 0; // global/builtin/default - not detectable here
const RANK_USER: NpmConfigRank = 1;
const RANK_PROJECT: NpmConfigRank = 2;
const RANK_ENV: NpmConfigRank = 3;

/**
 * Reads npm's merged effective config (project + user + global + builtin npmrc
 * plus npm_config_* env) by spawning `npm config list --json` once at the
 * workspace root, then derives the cooldown cutoff from `min-release-age`
 * (days) and `before` (absolute date).
 */
export async function readNpmPolicy(
  root: string,
  pmVersion: string,
  env: NodeJS.ProcessEnv = process.env
): Promise<MinReleaseAgePolicyReadResult> {
  let config: NpmEffectiveConfig;
  try {
    const raw = execSync('npm config list --json', {
      cwd: root,
      encoding: 'utf-8',
      windowsHide: true,
    });
    config = JSON.parse(raw) as NpmEffectiveConfig;
  } catch {
    return {
      outcome: 'ambiguous',
      reason: 'Unable to read the effective npm configuration.',
    };
  }

  const mraRaw = config['min-release-age'];
  const beforeRaw = config['before'];
  const hasMra = mraRaw !== undefined && mraRaw !== null;
  const hasBefore = beforeRaw !== undefined && beforeRaw !== null;

  if (hasMra && hasBefore) {
    // 11.10-11.14 has no per-source guard and npm itself can TypeError when a
    // git: dep is involved, so we don't try to mimic it.
    if (!gte(pmVersion, '11.15.0')) {
      return {
        outcome: 'ambiguous',
        reason:
          'Both min-release-age and before are set; npm 11.10-11.14 may error.',
      };
    }
    // 11.15+ resolves the two keys by emulating npm's per-source flatten
    // (before wins within a source; normal precedence wins across sources).
    return resolveBothKeys(mraRaw, beforeRaw, pmVersion, root, env);
  }

  if (hasBefore) {
    return buildPolicyFromBefore(beforeRaw, pmVersion);
  }

  if (hasMra) {
    return buildPolicyFromMinReleaseAge(mraRaw, pmVersion);
  }

  return { outcome: 'inactive' };
}

/**
 * Emulates npm 11.15+ config flatten for the case where both `min-release-age`
 * and `before` resolve to a value. npm iterates config sources from lowest to
 * highest precedence, each overwriting the flat `before`. Within one source,
 * `before` wins (the `Object.hasOwn(obj, 'before')` guard skips the
 * min-release-age flatten); across sources, the highest-precedence source's
 * contribution wins.
 */
function resolveBothKeys(
  mraRaw: unknown,
  beforeRaw: unknown,
  pmVersion: string,
  root: string,
  env: NodeJS.ProcessEnv
): MinReleaseAgePolicyReadResult {
  const surfaces = detectSurfaces(root, env);

  // Highest detected rank per key; the merged values already reflect npm's
  // per-key precedence, so we only need to know which key's source wins.
  const mraRank = surfaces.minReleaseAge ?? RANK_UNKNOWN;
  const beforeRank = surfaces.before ?? RANK_UNKNOWN;

  // Same source carries both keys -> before wins there (hasOwn guard). When the
  // before source ranks at least as high as the min-release-age source, before
  // is the last writer; otherwise min-release-age overwrites a lower-ranked
  // before.
  if (beforeRank >= mraRank) {
    return buildPolicyFromBefore(beforeRaw, pmVersion);
  }
  return buildPolicyFromMinReleaseAge(mraRaw, pmVersion);
}

interface DetectedSurfaces {
  // highest-precedence source rank that sets each key, or undefined if unset
  minReleaseAge?: NpmConfigRank;
  before?: NpmConfigRank;
}

// Detects which config surface(s) set each cooldown key, ranked by npm's
// precedence. Only env + project/user .npmrc are observable here; global,
// builtin, and default sources fall into RANK_UNKNOWN.
function detectSurfaces(
  root: string,
  env: NodeJS.ProcessEnv
): DetectedSurfaces {
  const result: DetectedSurfaces = {};

  const note = (key: keyof DetectedSurfaces, rank: NpmConfigRank): void => {
    const current = result[key];
    if (current === undefined || rank > current) {
      result[key] = rank;
    }
  };

  const userNpmrc = readNpmrcKeys(
    env['npm_config_userconfig'] ?? env['NPM_CONFIG_USERCONFIG'],
    join(homedir(), '.npmrc')
  );
  if (userNpmrc.minReleaseAge) note('minReleaseAge', RANK_USER);
  if (userNpmrc.before) note('before', RANK_USER);

  const projectNpmrc = readNpmrcKeys(undefined, join(root, '.npmrc'));
  if (projectNpmrc.minReleaseAge) note('minReleaseAge', RANK_PROJECT);
  if (projectNpmrc.before) note('before', RANK_PROJECT);

  // npm matches npm_config_* case-insensitively; replaces non-leading _ with -.
  if (readEnvKey(env, 'min-release-age') !== undefined) {
    note('minReleaseAge', RANK_ENV);
  }
  if (readEnvKey(env, 'before') !== undefined) {
    note('before', RANK_ENV);
  }

  return result;
}

interface NpmrcCooldownKeys {
  minReleaseAge: boolean;
  before: boolean;
}

function readNpmrcKeys(
  override: string | undefined,
  fallback: string
): NpmrcCooldownKeys {
  const present: NpmrcCooldownKeys = { minReleaseAge: false, before: false };
  for (const { key } of readNpmrcEntries(override ?? fallback) ?? []) {
    if (key === 'min-release-age') {
      present.minReleaseAge = true;
    } else if (key === 'before') {
      present.before = true;
    }
  }
  return present;
}

// npm's loadEnv strips the npm_config_ prefix (case-insensitive), then
// normalizes the rest with `key.replace(/(?!^)_/g, '-').toLowerCase()`, so both
// npm_config_min_release_age and npm_config_min-release-age map to the kebab key.
function readEnvKey(
  env: NodeJS.ProcessEnv,
  kebabKey: string
): string | undefined {
  for (const [name, value] of Object.entries(env)) {
    if (value === undefined || value === '') {
      continue;
    }
    if (!/^npm_config_/i.test(name)) {
      continue;
    }
    const normalized = name
      .slice('npm_config_'.length)
      .replace(/(?!^)_/g, '-')
      .toLowerCase();
    if (normalized === kebabKey) {
      return value;
    }
  }
  return undefined;
}

function buildPolicyFromMinReleaseAge(
  mraRaw: unknown,
  pmVersion: string
): MinReleaseAgePolicyReadResult {
  const days = typeof mraRaw === 'number' ? mraRaw : Number(mraRaw);
  if (!Number.isFinite(days)) {
    return {
      outcome: 'ambiguous',
      reason: `Invalid npm min-release-age value: ${String(mraRaw)}.`,
    };
  }
  // 0 disables (11.15+) or sets cutoff=now (11.10-11.14, everything published
  // passes); negative pushes the cutoff into the future. Both are inert.
  if (days <= 0) {
    return { outcome: 'inactive' };
  }

  const windowMs = days * MS_PER_DAY;
  const cutoffMs = Date.now() - windowMs;
  return {
    outcome: 'active',
    policy: createNpmPolicy({
      pmVersion,
      cutoffMs,
      windowMs,
      sourceDescription: `npm min-release-age (${days} day${
        days === 1 ? '' : 's'
      })`,
    }),
  };
}

function buildPolicyFromBefore(
  beforeRaw: unknown,
  pmVersion: string
): MinReleaseAgePolicyReadResult {
  const cutoffMs = Date.parse(String(beforeRaw));
  if (Number.isNaN(cutoffMs)) {
    return {
      outcome: 'ambiguous',
      reason: `Invalid npm before value: ${String(beforeRaw)}.`,
    };
  }
  const windowMs = Date.now() - cutoffMs;
  // before in the future -> every published version passes; nothing to gate.
  if (windowMs <= 0) {
    return { outcome: 'inactive' };
  }
  return {
    outcome: 'active',
    policy: createNpmPolicy({
      pmVersion,
      cutoffMs,
      windowMs,
      sourceDescription: `npm before (${new Date(cutoffMs).toISOString()})`,
    }),
  };
}

function createNpmPolicy(opts: {
  pmVersion: string;
  cutoffMs: number;
  windowMs: number;
  sourceDescription: string;
}): MinReleaseAgePolicy {
  return {
    packageManager: 'npm',
    packageManagerVersion: opts.pmVersion,
    cutoffMs: opts.cutoffMs,
    windowMs: opts.windowMs,
    sourceDescription: opts.sourceDescription,
    // npm has no excludes surface.
    isExcluded: () => false,
    behavior: { packageManager: 'npm' },
  };
}

/**
 * Mirrors npm-pick-manifest@11.0.3 under an active `before` filter:
 * - exact pin too new -> ETARGET (no fallback).
 * - unknown dist-tag -> ETARGET (no version to resolve against).
 * - dist-tag too new -> recurse with `<=tagTarget` (newest passing version at
 *   or below the tag target, prereleases of the same line included).
 * - range -> filter every version by maturity FIRST; empty -> ENOVERSIONS;
 *   else newest in-range survivor; survivors but none in range -> ETARGET.
 */
export function pickNpmVersion(
  spec: string,
  metadata: RegistryMetadata,
  policy: MinReleaseAgePolicy
): PickOutcome {
  const type = classifySpec(spec);

  if (type === 'exact') {
    const unconstrained = spec;
    // npm-pick-manifest resolves `mani = versions[ver]` -> undefined for an
    // unpublished pin and throws ETARGET. `versions` is the sole source of
    // truth: an unpublished version lingers in the `time` map but is gone from
    // `versions`, so a `time` entry alone must not make it resolvable.
    const exists = metadata.versions.includes(spec);
    if (exists && isVersionMature(metadata.name, spec, metadata, policy)) {
      return { version: spec, unconstrained };
    }
    throw etarget(metadata, policy, spec, [spec]);
  }

  if (type === 'tag') {
    const tagTarget = metadata.distTags[spec];
    if (!tagTarget) {
      // npm-pick-manifest returns undefined for an unknown tag (no dist-tag
      // entry, no version), then throws ETARGET - not ENOVERSIONS.
      throw etarget(metadata, policy, spec, []);
    }
    const unconstrained = tagTarget;
    if (isVersionMature(metadata.name, tagTarget, metadata, policy)) {
      return { version: tagTarget, unconstrained };
    }
    // npm recurses with `<=tagTarget`, which flows through the range path.
    return pickRange(metadata, policy, `<=${tagTarget}`, spec, unconstrained);
  }

  return pickRange(metadata, policy, spec, spec, newestInRange(metadata, spec));
}

function pickRange(
  metadata: RegistryMetadata,
  policy: MinReleaseAgePolicy,
  range: string,
  reportedSpec: string,
  unconstrained: string
): PickOutcome {
  const mature = metadata.versions.filter((v) =>
    isVersionMature(metadata.name, v, metadata, policy)
  );
  // npm throws ENOVERSIONS when the date filter leaves nothing at all.
  if (mature.length === 0) {
    throw enoVersions(metadata, policy, reportedSpec);
  }

  const inRange = mature
    .filter((v) => satisfies(v, range, { includePrerelease: false }))
    .sort(rcompare);
  if (inRange.length === 0) {
    const blocked = metadata.versions
      .filter((v) => satisfies(v, range, { includePrerelease: false }))
      .sort(rcompare);
    throw etarget(metadata, policy, reportedSpec, blocked);
  }

  return { version: inRange[0], unconstrained };
}

function etarget(
  metadata: RegistryMetadata,
  policy: MinReleaseAgePolicy,
  spec: string,
  blockedVersions: string[]
): MinReleaseAgeViolationError {
  const beforeStr = new Date(policy.cutoffMs).toLocaleString();
  return new MinReleaseAgeViolationError({
    packageManager: 'npm',
    packageName: metadata.name,
    spec,
    pmShapedDetail: `No matching version found for ${metadata.name}@${spec} with a date before ${beforeStr}.`,
    blocked: blockedVersionsFrom(metadata, blockedVersions),
    remediation: [
      `Wait until a matching version is older than the configured window, or lower ${policy.sourceDescription}.`,
    ],
  });
}

function enoVersions(
  metadata: RegistryMetadata,
  policy: MinReleaseAgePolicy,
  spec: string
): MinReleaseAgeViolationError {
  return new MinReleaseAgeViolationError({
    packageManager: 'npm',
    packageName: metadata.name,
    spec,
    pmShapedDetail: `No versions available for ${metadata.name}`,
    blocked: blockedVersionsFrom(metadata, metadata.versions),
    remediation: [
      `Wait until a version is older than the configured window, or lower ${policy.sourceDescription}.`,
    ],
  });
}
