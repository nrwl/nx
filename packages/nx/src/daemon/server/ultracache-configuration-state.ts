import type { UltracacheConfigurations } from '../../native';
import { getUltracacheConfigurationStore } from '../../ultracache/store';
import type { UltracacheConfigurationVersion } from '../message-types/ultracache-configuration-version';

// One handle at a time: entries read for a request serve the next one while
// the version holds, and another version replaces it, so nothing accumulates
// over a long-lived daemon.
let remembered: UltracacheConfigurations | undefined;

/**
 * Exactly the version the client hashes from, never a newer import for the
 * same commit. `undefined` when it is not stored, e.g. after `nx reset`.
 */
export function getUltracacheConfigurationsForVersion(
  version: UltracacheConfigurationVersion | undefined
): UltracacheConfigurations | undefined {
  if (!version) {
    return undefined;
  }
  if (
    remembered?.commit === version.commit &&
    remembered.resolution.fetchedAt === version.fetchedAt
  ) {
    return remembered;
  }
  const stored = readStored(version);
  if (stored) {
    remembered = stored;
  }
  return stored;
}

function readStored({
  commit,
  fetchedAt,
}: UltracacheConfigurationVersion): UltracacheConfigurations | undefined {
  try {
    return (
      getUltracacheConfigurationStore().getVersion(commit, fetchedAt) ??
      undefined
    );
  } catch {
    // An unusable database hashes natively rather than failing the request.
    return undefined;
  }
}
