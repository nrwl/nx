import { execSync } from 'child_process';
import { existsSync, readFileSync } from 'fs';
import { homedir } from 'os';
import { dirname, join } from 'path';
import { minimatch } from 'minimatch';
import { lt, rcompare, satisfies, validRange } from 'semver';
import { MS_PER_MINUTE } from '../constants';
import { MinReleaseAgeViolationError } from '../errors';
import type { RegistryMetadata } from '../packument';
import {
  blockedVersionsFrom,
  classifySpec,
  degradeTagToCompliant,
  newestInRange,
  splitPackageDescriptor,
  type PickOutcome,
} from '../pick';
import type {
  MinReleaseAgePolicy,
  MinReleaseAgePolicyReadResult,
} from '../policy';

// yarn 4.15.0+ default gate is `1d` (1440 minutes); the lockfile-migration
// escape only fires for the default-only window.
const DEFAULT_WINDOW_MINUTES = 1440;

/**
 * Reads yarn berry's effective cooldown config. yarn resolves its own rc chain
 * (project + home .yarnrc.yml), env (`YARN_NPM_MINIMAL_AGE_GATE`) and defaults,
 * so we ask it for the resolved values via `yarn config get ... --json` rather
 * than merging rc files ourselves. The returned `npmMinimalAgeGate` is already
 * normalized to minutes (DURATION >=4.11; parseInt minutes on 4.10.x). On 4.15+
 * we still mirror yarn's first-install migration that opts old lockfiles out of
 * the new default gate.
 */
export async function readYarnPolicy(
  root: string,
  pmVersion: string
): Promise<MinReleaseAgePolicyReadResult> {
  let gateMinutes: number | null;
  let preapproved: string[];
  try {
    gateMinutes = readGateMinutes(root);
    preapproved = readPreapprovedPackages(root);
  } catch {
    // `yarn config get` itself throws on an unparseable duration (>=4.11) or
    // when yarn cannot load; let callers fall back to a real install.
    return {
      outcome: 'ambiguous',
      reason: 'Unable to read the effective yarn configuration.',
    };
  }

  // NaN comes back as JSON null (4.10.x parseInt of a non-numeric value);
  // yarn's falsy guard treats it as no gate.
  if (gateMinutes === null || !Number.isFinite(gateMinutes)) {
    return { outcome: 'inactive' };
  }
  // 0 disables; negative pushes the cutoff into the future (everything passes).
  if (gateMinutes <= 0) {
    return { outcome: 'inactive' };
  }

  if (
    isDefaultLockfileMigrationEscape(root, pmVersion, gateMinutes, preapproved)
  ) {
    return { outcome: 'inactive' };
  }

  const windowMs = gateMinutes * MS_PER_MINUTE;
  const cutoffMs = Date.now() - windowMs;
  const matcher = compileExcludeMatchers(preapproved);
  // 4.10.0-4.10.1 pass a version with no time entry; >=4.10.2 quarantines it.
  const missingVersionTime = lt(pmVersion, '4.10.2') ? 'pass' : 'quarantine';

  return {
    outcome: 'active',
    policy: {
      packageManagerVersion: pmVersion,
      cutoffMs,
      windowMs,
      sourceDescription: `yarn npmMinimalAgeGate (${gateMinutes} min)`,
      isExcluded: (name, version) => matcher(name, version),
      behavior: { packageManager: 'yarn', missingVersionTime },
    },
  };
}

function readGateMinutes(root: string): number | null {
  const raw = execSync('yarn config get npmMinimalAgeGate --json', {
    cwd: root,
    encoding: 'utf-8',
    windowsHide: true,
  }).trim();
  if (!raw) {
    return null;
  }
  const parsed = JSON.parse(raw) as number | null;
  return typeof parsed === 'number' ? parsed : null;
}

function readPreapprovedPackages(root: string): string[] {
  const raw = execSync('yarn config get npmPreapprovedPackages --json', {
    cwd: root,
    encoding: 'utf-8',
    windowsHide: true,
  }).trim();
  if (!raw) {
    return [];
  }
  const parsed = JSON.parse(raw) as unknown;
  return Array.isArray(parsed)
    ? parsed.filter((entry): entry is string => typeof entry === 'string')
    : [];
}

/**
 * On 4.15.0+ yarn's first `install` writes `npmMinimalAgeGate: 0` into the
 * project .yarnrc.yml for pre-v10 lockfiles when the key is unset, so existing
 * projects permanently opt out of the new default gate. We mirror that: the
 * default-only window does not apply to a project whose lockfile predates v10
 * and that has not explicitly set the gate. A missing lockfile means a fresh
 * project, where the default does apply.
 */
function isDefaultLockfileMigrationEscape(
  root: string,
  pmVersion: string,
  gateMinutes: number,
  preapproved: string[]
): boolean {
  if (lt(pmVersion, '4.15.0')) {
    return false;
  }
  if (gateMinutes !== DEFAULT_WINDOW_MINUTES) {
    return false;
  }
  if (isGateExplicitlySet(root)) {
    return false;
  }
  const lockfileVersion = readLockfileMetadataVersion(root);
  // Missing lockfile -> fresh project -> default applies (no escape).
  if (lockfileVersion === null) {
    return false;
  }
  return lockfileVersion < 10;
}

/**
 * Explicitness check only (NOT value merging): the migration gate is
 * `configuration.sources.get('npmMinimalAgeGate') === undefined`, so the gate
 * counts as explicitly set when the key appears in ANY rc file yarn would load
 * (every ancestor .yarnrc.yml from root up to the filesystem root, plus home -
 * mirroring Configuration.findRcFiles) or the `YARN_NPM_MINIMAL_AGE_GATE` env
 * var is present.
 */
function isGateExplicitlySet(root: string): boolean {
  if (process.env.YARN_NPM_MINIMAL_AGE_GATE !== undefined) {
    return true;
  }
  let dir = root;
  let prev: string | null = null;
  while (dir !== prev) {
    if (yarnrcHasGateKey(join(dir, '.yarnrc.yml'))) {
      return true;
    }
    prev = dir;
    dir = dirname(dir);
  }
  return yarnrcHasGateKey(join(homedir(), '.yarnrc.yml'));
}

function yarnrcHasGateKey(file: string): boolean {
  if (!existsSync(file)) {
    return false;
  }
  try {
    // A top-level scalar key in .yarnrc.yml; a simple line check avoids pulling
    // a YAML parser for an explicitness probe.
    return readFileSync(file, 'utf-8')
      .split('\n')
      .some((line) => /^\s*npmMinimalAgeGate\s*:/.test(line));
  } catch {
    return false;
  }
}

function readLockfileMetadataVersion(root: string): number | null {
  const file = join(root, 'yarn.lock');
  if (!existsSync(file)) {
    return null;
  }
  try {
    const content = readFileSync(file, 'utf-8');
    // yarn.lock encodes `__metadata:\n  version: N`; read just that field.
    const match = content.match(
      /^__metadata:\s*\n(?:\s+.*\n)*?\s+version:\s*(\d+)/m
    );
    if (match) {
      return Number(match[1]);
    }
    // A legacy yarn-classic v1 lockfile has no __metadata; Project sets
    // lockfileLastVersion = -1, which the `v => v < 10` migration selector
    // matches (escape applies), distinct from a missing lockfile (null).
    return content.includes('yarn lockfile v1') ? -1 : null;
  } catch {
    return null;
  }
}

type ExcludeMatcher = (name: string, version: string) => boolean;

/**
 * Compiles `npmPreapprovedPackages` descriptors into a name/version matcher:
 * bare ident bypasses any version, `name@<range>` bypasses matching versions,
 * and a glob on the name (with or without a range) bypasses matching packages.
 * Case-sensitive; an unparseable entry yields no bypass.
 */
function compileExcludeMatchers(entries: string[]): ExcludeMatcher {
  const matchers = entries
    .map(parseExcludeEntry)
    .filter((m): m is ExcludeMatcher => m !== null);
  if (matchers.length === 0) {
    return () => false;
  }
  return (name, version) => matchers.some((m) => m(name, version));
}

function parseExcludeEntry(entry: string): ExcludeMatcher | null {
  const { name, range } = splitDescriptor(entry);
  if (!name) {
    return null;
  }
  // checkIdent matches the ident first (exact identHash OR an unconditional
  // micromatch) and only then applies the range, so run minimatch on every
  // entry - no isGlob gate - to catch extglobs (`+(...)`, `@(...)`) yarn would
  // glob-match. Residual: minimatch and micromatch disagree on `!(foo)`
  // negation, which cannot be reconciled without micromatch (not an allowed
  // dep).
  const nameMatches = (pkg: string) => pkg === name || minimatch(pkg, name);
  if (range) {
    if (!validRange(range)) {
      // yarn parses the version part as a semver range; an invalid one bypasses
      // nothing.
      return null;
    }
    // Plain semver Range.test (no includePrerelease): a stable range does not
    // pre-approve a prerelease.
    return (pkg, version) => nameMatches(pkg) && satisfies(version, range);
  }
  // Bare ident or name glob: any version of a name-matching package.
  return (pkg) => nameMatches(pkg);
}

/**
 * Splits a descriptor into name and optional range, honoring scoped names where
 * the leading `@` is part of the package name rather than a version separator.
 */
function splitDescriptor(entry: string): {
  name: string;
  range: string | null;
} {
  const { name, versionPart } = splitPackageDescriptor(entry);
  return { name, range: versionPart || null };
}

/**
 * yarn resolution under an active cooldown. Exact pins and ranges mirror yarn
 * berry's NpmSemverResolver gate; dist-tag degrade uses the shared cross-PM rule:
 * - exact/range: newest approved match; none approved -> violation (YN0016
 *   wording >=4.13, YN0082 wording <4.13).
 * - dist-tag too new -> degrade to the newest compliant version in the tag's
 *   own channel, falling back to stable (`degradeTagToCompliant`); none -> violation.
 */
export function pickYarnVersion(
  spec: string,
  metadata: RegistryMetadata,
  policy: MinReleaseAgePolicy
): PickOutcome {
  const type = classifySpec(spec);

  if (type === 'exact') {
    if (isApproved(metadata, policy, spec)) {
      return { version: spec, unconstrained: spec };
    }
    throw quarantined(metadata, policy, spec, [spec]);
  }

  if (type === 'tag') {
    return pickTag(spec, metadata, policy);
  }

  return pickRange(spec, metadata, policy, newestInRange(metadata, spec));
}

function pickTag(
  spec: string,
  metadata: RegistryMetadata,
  policy: MinReleaseAgePolicy
): PickOutcome {
  const target = metadata.distTags[spec];
  if (!target) {
    throw quarantined(metadata, policy, spec, []);
  }
  const unconstrained = target;
  if (isApproved(metadata, policy, target)) {
    return { version: target, unconstrained };
  }
  const degraded = degradeTagToCompliant(target, metadata, (v) =>
    isApproved(metadata, policy, v)
  );
  if (degraded) {
    return { version: degraded, unconstrained };
  }
  throw quarantined(metadata, policy, spec, [target]);
}

function pickRange(
  spec: string,
  metadata: RegistryMetadata,
  policy: MinReleaseAgePolicy,
  unconstrained: string
): PickOutcome {
  const inRange = metadata.versions
    .filter((v) => satisfies(v, spec, { includePrerelease: false }))
    .sort(rcompare);
  const approved = inRange.filter((v) => isApproved(metadata, policy, v));
  if (approved.length > 0) {
    return {
      version: approved[0],
      unconstrained,
    };
  }
  throw quarantined(metadata, policy, spec, inRange);
}

/**
 * yarn approval combines the maturity test with its missing-time policy: a
 * version with no time entry passes on 4.10.0-4.10.1 but is quarantined on
 * >=4.10.2, and a whole missing time map quarantines everything (>=4.10.2).
 * Excludes bypass the gate regardless.
 */
function isApproved(
  metadata: RegistryMetadata,
  policy: MinReleaseAgePolicy,
  version: string
): boolean {
  if (policy.isExcluded(metadata.name, version)) {
    return true;
  }
  const behavior = policy.behavior;
  if (behavior.packageManager !== 'yarn') {
    throw new Error('isApproved received a non-yarn policy.');
  }
  const hasTime = !!metadata.time && metadata.time[version] !== undefined;
  if (!hasTime) {
    return behavior.missingVersionTime === 'pass';
  }
  return Date.parse(metadata.time![version]) <= policy.cutoffMs;
}

function quarantined(
  metadata: RegistryMetadata,
  policy: MinReleaseAgePolicy,
  spec: string,
  blockedVersions: string[]
): MinReleaseAgeViolationError {
  // YN0016 wording landed in 4.13.0; earlier versions surface the generic
  // YN0082 "No candidates found" shape.
  const detail = lt(policy.packageManagerVersion, '4.13.0')
    ? `${metadata.name}@${spec}: No candidates found`
    : `All versions satisfying "${spec}" are quarantined`;
  return new MinReleaseAgeViolationError({
    packageManager: 'yarn',
    packageName: metadata.name,
    spec,
    pmShapedDetail: detail,
    blocked: blockedVersionsFrom(metadata, blockedVersions),
    remediation: [remediationHint(metadata, policy)],
  });
}

function remediationHint(
  metadata: RegistryMetadata,
  policy: MinReleaseAgePolicy
): string {
  return `Wait until a matching version is older than the configured window, lower ${policy.sourceDescription}, or add ${metadata.name} to npmPreapprovedPackages in .yarnrc.yml.`;
}
