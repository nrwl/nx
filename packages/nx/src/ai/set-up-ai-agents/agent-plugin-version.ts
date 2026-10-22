import { valid } from 'semver';
import { resolvePackageVersionUsingRegistry } from '../../utils/package-manager';
import { agentPluginsDistTag, claudePluginPackage } from '../constants';

// The daemon checks agent configuration in the background on every run, so the
// registry lookup is cached. Failures are retried sooner than successes.
const successTtlMs = 60 * 60 * 1000;
const failureTtlMs = 5 * 60 * 1000;

let cachedLatest: { version: string | null; expiresAt: number } | undefined;

/**
 * The latest version of the Nx agent plugins on the channel workspaces
 * follow, or `null` when the registry can't be reached. All plugin packages are released together, so
 * the Claude Code package's version stands for the Codex one too.
 */
export async function getLatestAgentPluginVersion(): Promise<string | null> {
  if (cachedLatest && cachedLatest.expiresAt > Date.now()) {
    return cachedLatest.version;
  }
  let version: string | null = null;
  try {
    const resolved = await resolvePackageVersionUsingRegistry(
      claudePluginPackage,
      agentPluginsDistTag
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
