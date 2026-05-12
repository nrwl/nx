import { gt, lt, parse, valid } from 'semver';
import { resolvePackageVersionUsingRegistry } from '../../utils/package-manager';

export const DIST_TAGS = ['latest', 'next', 'canary'] as const;
export type DistTag = (typeof DIST_TAGS)[number];

export function normalizeVersion(version: string) {
  const [semver, ...prereleaseTagParts] = version.split('-');
  // Handle versions like 1.0.0-beta-next.2
  const prereleaseTag = prereleaseTagParts.join('-');

  const [major, minor, patch] = semver.split('.');

  const newSemver = `${major || 0}.${minor || 0}.${patch || 0}`;

  const newVersion = prereleaseTag
    ? `${newSemver}-${prereleaseTag}`
    : newSemver;

  const withoutPatch = `${major || 0}.${minor || 0}.0`;
  const withoutPatchAndMinor = `${major || 0}.0.0`;

  const variationsToCheck = [
    newVersion,
    newSemver,
    withoutPatch,
    withoutPatchAndMinor,
  ];

  for (const variation of variationsToCheck) {
    try {
      if (gt(variation, '0.0.0')) {
        return variation;
      }
    } catch {}
  }

  return '0.0.0';
}

export async function normalizeVersionWithTagCheck(
  pkg: string,
  version: string
): Promise<string> {
  // Treat non-parseable inputs (e.g. dist-tags like `latest`/`next`) as
  // registry references and resolve them. Throws on registry failure;
  // callers that need to tolerate registry outages must wrap.
  if (version && !parse(version)) {
    return resolvePackageVersionUsingRegistry(pkg, version);
  }
  return normalizeVersion(version);
}

export function isNxEquivalentTarget(
  targetPackage: string,
  targetVersion: string
): boolean {
  // Non-semver values (e.g., the literal `'latest'` sentinel used during bare
  // invocation before tag resolution, or in tests) are treated as modern era.
  if (valid(targetVersion) && lt(targetVersion, '14.0.0-beta.0')) {
    return targetPackage === '@nrwl/workspace';
  }
  return targetPackage === 'nx' || targetPackage === '@nx/workspace';
}
