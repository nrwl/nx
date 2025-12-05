import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { homedir } from 'os';
import { dirname, join } from 'path';
import type { TelemetrySettings } from './types';

/**
 * Structure of the ~/.nxrc user configuration file.
 */
interface NxUserConfig {
  telemetry?: TelemetrySettings;
}

const NXRC_FILENAME = '.nxrc';

/**
 * Gets the path to the user's ~/.nxrc file.
 */
export function getNxrcPath(): string {
  return join(homedir(), NXRC_FILENAME);
}

/**
 * Reads the ~/.nxrc file and returns its contents.
 * Returns an empty object if the file doesn't exist or is invalid.
 */
function readNxrc(): NxUserConfig {
  const nxrcPath = getNxrcPath();

  if (!existsSync(nxrcPath)) {
    return {};
  }

  try {
    const contents = readFileSync(nxrcPath, 'utf-8');
    const parsed = JSON.parse(contents);

    // Ensure we got an object
    if (
      typeof parsed !== 'object' ||
      parsed === null ||
      Array.isArray(parsed)
    ) {
      return {};
    }

    return parsed as NxUserConfig;
  } catch {
    // File exists but is invalid JSON - return empty config
    return {};
  }
}

/**
 * Writes the configuration to ~/.nxrc.
 * Creates the file if it doesn't exist.
 */
function writeNxrc(config: NxUserConfig): void {
  const nxrcPath = getNxrcPath();

  try {
    // Ensure parent directory exists (should always exist for homedir)
    const dir = dirname(nxrcPath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }

    writeFileSync(nxrcPath, JSON.stringify(config, null, 2) + '\n', 'utf-8');
  } catch {
    // Silently fail if we can't write - don't break user's workflow
    if (process.env.NX_VERBOSE_LOGGING === 'true') {
      console.error(`Failed to write telemetry settings to ${nxrcPath}`);
    }
  }
}

/**
 * Gets the user's telemetry settings from ~/.nxrc.
 * Returns undefined if no telemetry settings are configured.
 */
export function getUserTelemetrySettings(): TelemetrySettings | undefined {
  const config = readNxrc();
  return config.telemetry;
}

/**
 * Sets the user's telemetry settings in ~/.nxrc.
 * Merges with existing configuration, preserving other settings.
 */
export function setUserTelemetrySettings(settings: TelemetrySettings): void {
  const config = readNxrc();
  config.telemetry = settings;
  writeNxrc(config);
}

/**
 * Checks if the user has explicitly set a telemetry preference.
 * Returns true if the user has been prompted and made a choice.
 */
export function hasUserTelemetryPreference(): boolean {
  const settings = getUserTelemetrySettings();
  return settings?.enabled !== undefined;
}
