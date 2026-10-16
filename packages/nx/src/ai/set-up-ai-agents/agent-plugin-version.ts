import { gt, valid } from 'semver';
import { resolvePackageVersionUsingRegistry } from '../../utils/package-manager';
import { claudePluginPackage } from '../constants';

// The daemon checks agent configuration in the background on every run, so the
// registry lookup is cached. Failures are retried sooner than successes.
const successTtlMs = 60 * 60 * 1000;
const failureTtlMs = 5 * 60 * 1000;

let cachedLatest: { version: string | null; expiresAt: number } | undefined;

/**
 * The latest released version of the Nx agent plugins, or `null` when the
 * registry can't be reached. All plugin packages are released together, so
 * one lookup covers every agent.
 */
export async function getLatestAgentPluginVersion(): Promise<string | null> {
  if (cachedLatest && cachedLatest.expiresAt > Date.now()) {
    return cachedLatest.version;
  }
  let version: string | null = null;
  try {
    const resolved = await resolvePackageVersionUsingRegistry(
      claudePluginPackage,
      'latest'
    );
    version = valid(resolved) ? resolved : null;
  } catch {
    version = null;
  }
  cachedLatest = {
    version,
    expiresAt: Date.now() + (version ? successTtlMs : failureTtlMs),
  };
  return version;
}

export function resetLatestAgentPluginVersionCache(): void {
  cachedLatest = undefined;
}

/**
 * The version to pin: the latest release, unless the workspace pins a newer
 * one. Falls back to the existing pin, or null when neither is known.
 */
export function pickAgentPluginVersion(
  latest: string | null,
  pinned: string | null | undefined
): string | null {
  const validPinned = pinned && valid(pinned) ? pinned : null;
  if (latest && validPinned) {
    return gt(validPinned, latest) ? validPinned : latest;
  }
  return latest ?? validPinned;
}
