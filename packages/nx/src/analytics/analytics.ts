import { readNxJson } from '../config/nx-json';
import { workspaceRoot } from '../utils/workspace-root';
import { nxVersion } from '../utils/versions';
import { IS_WASM } from '../native';
import type {
  initializeTelemetry as InitializeTelemetryType,
  flushTelemetry as FlushTelemetryType,
  trackEvent as TrackEventType,
  trackPageView as TrackPageViewType,
  getEventDimensions as GetEventDimensionsType,
  EventDimensions,
} from '../native';
import {
  getPackageManagerVersion,
  detectPackageManager,
} from '../utils/package-manager';
import { parse } from 'semver';
import * as os from 'os';
import { getCurrentMachineId } from '../utils/machine-id-cache';
import { isCI } from '../utils/is-ci';
import { generateWorkspaceId } from '../utils/analytics-prompt';
import { getDbConnection } from '../utils/db-connection';

// Conditionally import telemetry functions only on non-WASM platforms
let initializeTelemetry: typeof InitializeTelemetryType;
let flushTelemetry: typeof FlushTelemetryType;
let trackEventNative: typeof TrackEventType;
let trackPageViewNative: typeof TrackPageViewType;

let getEventDimensions: typeof GetEventDimensionsType;

if (!IS_WASM) {
  const nativeModule = require('../native');
  initializeTelemetry = nativeModule.initializeTelemetry;
  flushTelemetry = nativeModule.flushTelemetry;
  trackEventNative = nativeModule.trackEvent;
  trackPageViewNative = nativeModule.trackPageView;
  getEventDimensions = nativeModule.getEventDimensions;
}

export const customDimensions = IS_WASM
  ? null
  : (getEventDimensions?.() ?? null);

export type EventParameters = Partial<
  Record<EventDimensions[keyof EventDimensions], string | number | boolean>
>;

let _telemetryInitialized = false;

export async function startAnalytics() {
  // Analytics not supported on WASM
  if (IS_WASM) {
    return;
  }

  if (!isAnalyticsEnabled()) {
    return;
  }

  const nxJson = readNxJson(workspaceRoot);
  const workspaceId = generateWorkspaceId();
  if (!workspaceId) {
    // Not a git repo — no telemetry
    return;
  }
  const isNxCloud = !!(nxJson?.nxCloudId ?? nxJson?.nxCloudAccessToken);
  const userId = await getCurrentMachineId();
  const packageManagerInfo = getPackageManagerInfo();

  const nodeVersion = parse(process.version);
  const nodeVersionString = nodeVersion
    ? `${nodeVersion.major}.${nodeVersion.minor}.${nodeVersion.patch}`
    : 'unknown';

  try {
    const dbConnection = getDbConnection();

    initializeTelemetry(
      dbConnection,
      workspaceId,
      userId,
      nxVersion,
      packageManagerInfo.name,
      packageManagerInfo.version,
      nodeVersionString,
      os.arch(),
      os.platform(),
      os.release(),
      !!isCI(),
      isNxCloud
    );
    _telemetryInitialized = true;

    // Flush analytics automatically on process exit so every code path
    // is covered without needing explicit exitAndFlushAnalytics() calls.
    process.on('exit', () => {
      flushAnalytics();
    });
  } catch (error) {
    // If telemetry service fails to initialize, continue without it
    if (process.env.NX_VERBOSE_LOGGING === 'true') {
      console.log(`Failed to initialize telemetry: ${error.message}`);
    }
  }
}

export function reportNxAddCommand(packageName: string, version: string) {
  reportCommandRunEvent('add', {
    [customDimensions.packageName]: packageName,
    [customDimensions.packageVersion]: version,
  });
}

export function reportNxGenerateCommand(generator: string) {
  reportCommandRunEvent('generate', {
    [customDimensions.generatorName]: generator,
  });
}

export function reportCommandRunEvent(
  command: string,
  parameters?: Record<string, any>,
  args?: Record<string, any>
) {
  command = command === 'g' ? 'generate' : command;
  let pageLocation = command;
  if (args) {
    const qs = argsToQueryString(args);
    if (qs) {
      pageLocation = `${command}?${qs}`;
    }
  }
  trackPageView(command, pageLocation, parameters);
}

export function reportEvent(name: string, eventParameters?: EventParameters) {
  trackEvent(name, eventParameters);
}

const SKIP_ARGS_KEYS = new Set([
  '$0',
  '_',
  '__overrides_unparsed__',
  '__overrides__',
]);

// String args with fixed enum values that are safe to include in analytics.
// All boolean and number args are included automatically.
const ALLOWED_STRING_ARGS = new Set([
  'outputStyle',
  'type',
  'view',
  'access',
  'preset',
  'interactive',
  'printConfig',
  'resolveVersionPlans',
]);

export function argsToQueryString(args: Record<string, any>): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(args)) {
    if (SKIP_ARGS_KEYS.has(key)) continue;
    if (value === undefined || value === null) continue;

    if (typeof value === 'boolean' || typeof value === 'number') {
      params.append(key, String(value));
    } else if (typeof value === 'string' && ALLOWED_STRING_ARGS.has(key)) {
      params.append(key, value);
    }
    // All other types (strings, arrays, objects) are dropped
  }
  return params.toString();
}

function trackEvent(
  eventName: string,
  parameters?: Record<string, string | number | boolean>
) {
  if (_telemetryInitialized) {
    // Convert parameters to string map for Rust
    const stringParams: Record<string, string> = {};
    if (parameters) {
      for (const [key, value] of Object.entries(parameters)) {
        if (value !== undefined && value !== null) {
          stringParams[key] = String(value);
        }
      }
    }

    // Fire and forget - synchronous call
    try {
      trackEventNative(eventName, stringParams);
    } catch {
      // Silently ignore errors
    }
  }
}

function trackPageView(
  pageTitle: string,
  pageLocation?: string,
  parameters?: Record<string, string | number | boolean>
) {
  if (_telemetryInitialized) {
    // Convert parameters to string map for Rust
    const stringParams: Record<string, string> = {};
    if (parameters) {
      for (const [key, value] of Object.entries(parameters)) {
        if (value !== undefined && value !== null) {
          stringParams[key] = String(value);
        }
      }
    }

    // Fire and forget - synchronous call
    try {
      trackPageViewNative(pageTitle, pageLocation, stringParams);
    } catch {
      // Silently ignore errors
    }
  }
}

export function flushAnalytics() {
  if (_telemetryInitialized) {
    try {
      flushTelemetry();
    } catch (error) {
      // Failure to report analytics shouldn't crash the CLI
      if (process.env.NX_VERBOSE_LOGGING === 'true') {
        console.log(`Failed to flush telemetry: ${error.message}`);
      }
    }
  }
}

function getPackageManagerInfo() {
  const pm = detectPackageManager();
  return {
    name: pm,
    version: getPackageManagerVersion(pm),
  };
}

function isAnalyticsEnabled(): boolean {
  const nxJson = readNxJson(workspaceRoot);
  return nxJson?.analytics === true;
}
