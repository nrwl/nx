import type { NxJsonConfiguration } from '../../config/nx-json';
import { isCI } from '../is-ci';
import type { ResolvedTelemetrySettings, TelemetrySettings } from './types';
import {
  getUserTelemetrySettings,
  hasUserTelemetryPreference,
} from './user-settings';

/**
 * Default OTLP endpoint for Nx telemetry.
 */
const NX_CLOUD_ENDPOINT = 'https://snapshot.nx.app';
const DEFAULT_TELEMETRY_ENDPOINT = `${NX_CLOUD_ENDPOINT}/nx-cloud/ingest-fix-ci-traces`;

/**
 * Cached resolved settings to avoid repeated resolution.
 */
let cachedSettings: ResolvedTelemetrySettings | null = null;
let cacheKey: string | null = null;

/**
 * Resolves telemetry settings by merging configuration from multiple sources.
 *
 * Resolution order (highest priority first):
 * 1. NX_TELEMETRY environment variable
 * 2. NX_OTLP_ENDPOINT environment variable (for custom endpoint)
 * 3. nx.json telemetry section
 * 4. ~/.nxrc telemetry section (non-CI only)
 * 5. Defaults based on environment
 *
 * @param nxJson - The workspace nx.json configuration (or null if not in a workspace)
 * @returns Resolved telemetry settings
 */
export function resolveTelemetrySettings(
  nxJson: NxJsonConfiguration | null
): ResolvedTelemetrySettings {
  // Check cache
  const newCacheKey = JSON.stringify({
    env: {
      NX_TELEMETRY: process.env.NX_TELEMETRY,
      NX_OTLP_ENDPOINT: process.env.NX_OTLP_ENDPOINT,
    },
    nxJson: nxJson?.telemetry,
  });

  if (cachedSettings && cacheKey === newCacheKey) {
    return cachedSettings;
  }

  const settings = resolveSettingsInternal(nxJson);
  cachedSettings = settings;
  cacheKey = newCacheKey;

  return settings;
}

function resolveSettingsInternal(
  nxJson: NxJsonConfiguration | null
): ResolvedTelemetrySettings {
  const endpoints: string[] = [];
  let enabled: boolean | undefined;
  let source: ResolvedTelemetrySettings['source'] = 'default';

  // 1. Check NX_TELEMETRY environment variable (highest priority)
  const envTelemetry = process.env.NX_TELEMETRY;
  if (envTelemetry !== undefined) {
    enabled = envTelemetry === 'true';
    source = 'env';
  }

  // 2. Check NX_OTLP_ENDPOINT for custom endpoint
  const envEndpoint = process.env.NX_OTLP_ENDPOINT;
  if (envEndpoint) {
    endpoints.push(envEndpoint);
  }

  // 3. Check nx.json telemetry section
  if (enabled === undefined && nxJson?.telemetry?.enabled !== undefined) {
    enabled = nxJson.telemetry.enabled;
    source = 'repo';
  }

  // Add custom endpoint from nx.json
  if (nxJson?.telemetry?.customEndpoint) {
    endpoints.push(nxJson.telemetry.customEndpoint);
  }

  // 4. Check ~/.nxrc (user settings) - only for non-CI environments
  if (enabled === undefined && !isCI()) {
    const userSettings = getUserTelemetrySettings();
    if (userSettings?.enabled !== undefined) {
      enabled = userSettings.enabled;
      source = 'user';
    }

    // Add custom endpoint from user settings
    if (userSettings?.customEndpoint) {
      endpoints.push(userSettings.customEndpoint);
    }
  }

  // 5. Apply defaults based on environment
  if (enabled === undefined) {
    if (isCI()) {
      // CI: enabled by default
      enabled = true;
      source = 'default';
    } else if (process.stdin.isTTY && process.stdout.isTTY) {
      // Local interactive: will be prompted (return false until prompted)
      enabled = false;
      source = 'default';
    } else {
      // Local non-interactive: disabled by default
      enabled = false;
      source = 'default';
    }
  }

  // Always include default endpoint when enabled
  if (enabled) {
    endpoints.unshift(DEFAULT_TELEMETRY_ENDPOINT);
  }

  // Deduplicate endpoints
  const uniqueEndpoints = [...new Set(endpoints)];

  return {
    enabled,
    endpoints: uniqueEndpoints,
    source,
  };
}

/**
 * Checks if telemetry is enabled based on all configuration sources.
 *
 * @param nxJson - The workspace nx.json configuration
 * @returns Whether telemetry is enabled
 */
export function isTelemetryEnabled(
  nxJson: NxJsonConfiguration | null
): boolean {
  return resolveTelemetrySettings(nxJson).enabled;
}

/**
 * Gets the OTLP endpoints for telemetry.
 *
 * @param nxJson - The workspace nx.json configuration
 * @returns Array of OTLP endpoints
 */
export function getTelemetryEndpoints(
  nxJson: NxJsonConfiguration | null
): string[] {
  return resolveTelemetrySettings(nxJson).endpoints;
}

/**
 * Checks if the user needs to be prompted for telemetry opt-in.
 *
 * Returns true only when:
 * - Not in CI environment
 * - Interactive terminal (stdin and stdout are TTY)
 * - No explicit telemetry setting from environment or repo config
 * - User hasn't been prompted before
 *
 * @param nxJson - The workspace nx.json configuration
 * @returns Whether to show the opt-in prompt
 */
export function shouldPromptForTelemetry(
  nxJson: NxJsonConfiguration | null
): boolean {
  // Don't prompt in CI
  if (isCI()) {
    return false;
  }

  // Don't prompt in non-interactive terminals
  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    return false;
  }

  // Don't prompt if NX_TELEMETRY env var is set
  if (process.env.NX_TELEMETRY !== undefined) {
    return false;
  }

  // Don't prompt if repo has explicit telemetry config
  if (nxJson?.telemetry?.enabled !== undefined) {
    return false;
  }

  // Don't prompt if user already made a choice
  if (hasUserTelemetryPreference()) {
    return false;
  }

  return true;
}

/**
 * Clears the cached settings. Useful for testing.
 */
export function clearSettingsCache(): void {
  cachedSettings = null;
  cacheKey = null;
}
