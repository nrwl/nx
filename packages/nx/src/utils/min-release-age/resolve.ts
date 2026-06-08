import { gte } from 'semver';
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
 * map for pnpm >=10.18 dist-tag resolution (the versions where pnpm prefers a
 * non-deprecated candidate when degrading a tag), then picks. Throws
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
    gte(policy.packageManagerVersion, '10.18.0') &&
    classifySpec(spec) === 'tag'
  ) {
    metadata.deprecations = await fetchDeprecations(packageName);
  }
  return pickMinReleaseAgeCompliantVersion(spec, metadata, policy);
}
