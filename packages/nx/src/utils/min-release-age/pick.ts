import { rcompare, satisfies, valid, validRange } from 'semver';
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
