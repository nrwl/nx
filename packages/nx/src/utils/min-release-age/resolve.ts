import { fetchDeprecations, fetchRegistryMetadata } from './packument';
import {
  classifySpec,
  pickMinReleaseAgeCompliantVersion,
  type PickOutcome,
} from './pick';
import type { MinReleaseAgePolicy } from './policy';

/**
 * Resolves an already catalog-dereferenced spec to a cooldown-compliant version
 * under the given policy: fetches the packument, lazily fetches the deprecation
 * map only for the pnpm >=10.20 any-major latest-tag degrade (the one path that
 * prefers a non-deprecated candidate), then picks. Throws
 * MinReleaseAgeViolationError when the PM at this version would refuse to resolve.
 */
export async function resolveCompliantVersion(
  packageName: string,
  spec: string,
  policy: MinReleaseAgePolicy
): Promise<PickOutcome> {
  const metadata = await fetchRegistryMetadata(packageName);
  if (
    policy.behavior.packageManager === 'pnpm' &&
    policy.behavior.latestTagDegrade === 'any-major' &&
    classifySpec(spec) === 'tag'
  ) {
    metadata.deprecations = await fetchDeprecations(packageName);
  }
  return pickMinReleaseAgeCompliantVersion(spec, metadata, policy);
}
