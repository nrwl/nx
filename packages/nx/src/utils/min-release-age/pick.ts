import { prerelease, rcompare, satisfies, valid, validRange } from 'semver';
import { pickBunVersion } from './behavior/bun';
import { pickNpmVersion } from './behavior/npm';
import { pickPnpmVersion } from './behavior/pnpm';
import { pickYarnVersion } from './behavior/yarn';
import type { BlockedVersion } from './errors';
import type { RegistryMetadata } from './packument';
import type { MinReleaseAgePolicy } from './policy';

export type VersionSpecType = 'exact' | 'range' | 'tag';

export interface PickOutcome {
  version: string;
  // what would have been picked with no gate; equal to `version` when unchanged
  unconstrained: string;
  // pnpm v11 loose fallback picked an immature version (drives exclude writes)
  immature?: boolean;
}

/**
 * Classifies a version spec the way the package managers do: an exact semver is
 * a pin, a valid range is a range, anything else (latest, hot, canary, ...) is
 * a dist-tag. Catalog refs are dereferenced before this layer.
 */
export function classifySpec(spec: string): VersionSpecType {
  if (valid(spec)) {
    return 'exact';
  }
  if (validRange(spec)) {
    return 'range';
  }
  return 'tag';
}

/**
 * Splits an npm package descriptor into its name and the raw version part after
 * the separating `@`, honoring scoped names where the leading `@` is part of the
 * name. `versionPart` is null when there is no separator (bare name) and an
 * empty string for a trailing `@`; callers interpret the version part.
 */
export function splitPackageDescriptor(entry: string): {
  name: string;
  versionPart: string | null;
} {
  const scoped = entry.startsWith('@');
  const at = entry.indexOf('@', scoped ? 1 : 0);
  if (at === -1) {
    return { name: entry, versionPart: null };
  }
  return { name: entry.slice(0, at), versionPart: entry.slice(at + 1) };
}

/**
 * Shared maturity test: a version passes when its publish time is at or before
 * the cutoff (inclusive), or when it is explicitly excluded.
 */
export function isVersionMature(
  name: string,
  version: string,
  metadata: RegistryMetadata,
  policy: MinReleaseAgePolicy
): boolean {
  if (policy.isExcluded(name, version)) {
    return true;
  }
  const time = metadata.time?.[version];
  if (!time) {
    // Missing individual time: callers that diverge (pnpm blocks, yarn
    // quarantines) handle it themselves; the default is to pass like npm/bun.
    return true;
  }
  return Date.parse(time) <= policy.cutoffMs;
}

/**
 * Newest version satisfying the range, ignoring the cooldown gate. Used only to
 * compute PickOutcome.unconstrained (messaging); never gates a pick. Falls back
 * to the raw range when nothing matches.
 */
export function newestInRange(
  metadata: RegistryMetadata,
  range: string
): string {
  return (
    metadata.versions
      .filter((v) => satisfies(v, range, { includePrerelease: false }))
      .sort(rcompare)[0] ?? range
  );
}

/**
 * The prerelease channel of a version: the first dotted identifier of its
 * prerelease tag (e.g. `rc` for `23.0.0-rc.0`, `pr` for `23.0.0-pr.123`), or
 * null for a stable release. Channels keep parallel prerelease lines apart so a
 * cooldown degrade never crosses from `rc` into an internal `pr` build.
 */
function prereleaseChannel(version: string): string | null {
  const pre = prerelease(version);
  return pre && pre.length > 0 ? String(pre[0]) : null;
}

// Prerelease channels with a conventional maturity order, least mature first.
// A blocked target may descend to a lower rung of its own release line
// (rc.0 -> beta.x); channels off the ladder (pr, canary, ...) have no implied
// ordering and stay walled off. `next` is deliberately omitted: it is pre-rc
// in some ecosystems (Angular) but a rolling dev snapshot in others - exactly
// the kind of build a degrade must never land on.
const ORDERED_CHANNELS = ['alpha', 'beta', 'rc'];

// Whether a prerelease channel may serve as a degrade candidate for a target
// on `targetChannel`: the target's own channel always; a strictly lower rung
// when both sit on the ladder. A stable target (null channel) admits none.
function channelAdmits(targetChannel: string | null, channel: string): boolean {
  if (channel === targetChannel) {
    return true;
  }
  if (targetChannel === null) {
    return false;
  }
  const rank = ORDERED_CHANNELS.indexOf(channel);
  const targetRank = ORDERED_CHANNELS.indexOf(targetChannel);
  return rank !== -1 && targetRank !== -1 && rank < targetRank;
}

/**
 * Degrades a too-new dist-tag target to a cooldown-compliant version "of the
 * same kind", shared by every package manager: the highest compliant version by
 * semver, never by publish time, among those at or below the target that are
 * stable or are prereleases of the target's own release line, in its channel
 * or on a lower rung of the alpha < beta < rc ladder. Returns null when none is
 * compliant.
 */
export function degradeTagToCompliant(
  target: string,
  metadata: RegistryMetadata,
  isCompliant: (version: string) => boolean
): string | null {
  // A non-semver tag target has no channel or ordering to reason about.
  if (!valid(target)) {
    return null;
  }
  const targetChannel = prereleaseChannel(target);

  const pool = metadata.versions.filter((version) => {
    // npm's `<=target`: a prerelease only qualifies on the target's own
    // major.minor.patch, never from an older release line.
    if (!valid(version) || !satisfies(version, `<=${target}`)) {
      return false;
    }
    const channel = prereleaseChannel(version);
    // Stables always stay; a prerelease stays only in the target's channel or
    // on a lower ladder rung (every prerelease is out for a stable target).
    return channel === null || channelAdmits(targetChannel, channel);
  });

  pool.sort(rcompare);

  return pool.find((version) => isCompliant(version)) ?? null;
}

/**
 * Maps a list of held-back versions to the blocked-candidate shape carried by
 * MinReleaseAgeViolationError, keeping only versions the registry has a publish
 * time for.
 */
export function blockedVersionsFrom(
  metadata: RegistryMetadata,
  versions: string[]
): BlockedVersion[] {
  return versions
    .filter((v) => !!metadata.time?.[v])
    .map((v) => ({ version: v, publishedAt: metadata.time![v] }));
}

/**
 * Resolves a spec to a version that complies with the effective cooldown
 * policy, dispatching to the per-PM pick rules. Throws
 * MinReleaseAgeViolationError when the PM at this version would fail.
 */
export function pickMinReleaseAgeCompliantVersion(
  spec: string,
  metadata: RegistryMetadata,
  policy: MinReleaseAgePolicy
): PickOutcome {
  switch (policy.behavior.packageManager) {
    case 'npm':
      return pickNpmVersion(spec, metadata, policy);
    case 'pnpm':
      return pickPnpmVersion(spec, metadata, policy);
    case 'yarn':
      return pickYarnVersion(spec, metadata, policy);
    case 'bun':
      return pickBunVersion(spec, metadata, policy);
  }
}
