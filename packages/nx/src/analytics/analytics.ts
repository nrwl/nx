import { readNxJson } from '../config/nx-json';
import { workspaceRoot } from '../utils/workspace-root';
import { nxVersion } from '../utils/versions';
import {
  initializeTelemetry,
  flushTelemetry,
  trackEvent as trackEventNative,
  trackPageView as trackPageViewNative,
} from '../native';
import {
  getPackageManagerVersion,
  detectPackageManager,
} from '../utils/package-manager';
import {
  EventCustomDimension,
  EventCustomMetric,
  ParameterValue,
} from './parameter';
import { parse } from 'semver';
import * as os from 'os';
import { getCurrentMachineId } from '../utils/machine-id-cache';
import { isCI } from '../utils/is-ci';

let _telemetryInitialized = false;

export async function startAnalytics() {
  const workspaceId = getAnalyticsId();
  if (!workspaceId) {
    // Analytics are disabled, exit early.
    return;
  }
  const userId = await getCurrentMachineId();
  const packageManagerInfo = getPackageManagerInfo();

  const nodeVersion = parse(process.version);
  const nodeVersionString = nodeVersion
    ? `${nodeVersion.major}.${nodeVersion.minor}.${nodeVersion.patch}`
    : 'unknown';

  try {
    initializeTelemetry(
      workspaceId,
      userId,
      nxVersion,
      packageManagerInfo.name,
      packageManagerInfo.version,
      nodeVersionString,
      os.arch(),
      os.platform(),
      os.release(),
      !!isCI()
    );
    _telemetryInitialized = true;
  } catch (error) {
    // If telemetry service fails to initialize, continue without it
    if (process.env.NX_VERBOSE_LOGGING === 'true') {
      console.log(`Failed to initialize telemetry: ${error.message}`);
    }
  }
}

export function reportNxAddCommand(packageName: string, version: string) {
  reportCommandRunEvent('add', {
    [EventCustomDimension.PackageName]: packageName,
    [EventCustomDimension.PackageVersion]: version,
  });
}

export function reportNxGenerateCommand(generator: string) {
  reportCommandRunEvent('generate', {
    [EventCustomDimension.GeneratorName]: generator,
  });
}

export function reportCommandRunEvent(
  command: string,
  parameters?: Record<string, ParameterValue | any>,
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

export function reportProjectGraphCreationEvent(time: number) {
  trackEvent('project_graph_creation', {
    [EventCustomMetric.Time]: time,
  });
}

const INTERNAL_ARGS_KEYS = new Set([
  '$0',
  '_',
  '__overrides_unparsed__',
  '__overrides__',
]);

const SENSITIVE_ARGS_KEYS = new Set([
  // Project identifiers — could reveal internal project/business names
  'project',
  'projects',
  'projectName',
  'focus',
  'exclude',
  'groups',
  'group',
  'appProject',
  'e2eProject',
  'backendProject',
  'name',

  // File paths — could reveal usernames, directory structure, client names
  'file',
  'files',
  'cwd',
  'envFile',
  'outputPath',
  'tsConfig',
  'directory',
  'source',
  'destination',
  'sourceDirectory',
  'destinationDirectory',
  'main',
  'index',
  'polyfills',
  'config',
  'configFile',
  'webpackConfig',
  'rspackConfig',
  'viteConfig',
  'jestConfig',
  'cypressConfig',
  'entryFile',
  'coverageDirectory',
  'projectRoot',
  'sourceRoot',
  'workspaceRoot',
  'input',
  'output',

  // URLs and hosts — could expose internal infrastructure
  'host',
  'baseUrl',
  'baseHref',
  'deployUrl',
  'publicUrl',
  'publicPath',
  'url',
  'remote',
  'registry',
  'sourceRepository',

  // Package/module names — could reveal private packages
  'importPath',
  'npmScope',
  'packageName',
  'moduleName',
  'packageSpecifier',
  'packageAndVersion',
  'generator',
  'collection',
  'plugin',
  'bundleName',
  'entryName',
  'outputFileName',

  // Free-form text — could contain anything
  'message',
  'commitPrefix',
  'gitCommitMessage',
  'gitTagMessage',
  'gitCommitArgs',
  'gitTagArgs',
  'gitPushArgs',
  'command',
  'commands',
  'script',
  'description',
  'prefix',
  'displayName',
  'tags',
  'title',
  'label',
  'scope',
  'tag',

  // Credentials and auth
  'otp',
  'key',
  'access',
  'ciBuildId',

  // Git refs — could reveal branch naming conventions
  'base',
  'head',
  'ref',
  'from',
  'to',

  // Keys that can be string paths (not just booleans)
  'runMigrations',
  'graph',
]);

function isSensitiveKey(key: string): boolean {
  if (SENSITIVE_ARGS_KEYS.has(key)) return true;
  // Normalize kebab-case to camelCase and re-check
  if (key.includes('-')) {
    const camelKey = key.replace(/-(.)/g, (_, c) => c.toUpperCase());
    return SENSITIVE_ARGS_KEYS.has(camelKey);
  }
  return false;
}

function sanitizeValue(value: any): string {
  // Preserve booleans — we still want to know true vs false
  if (typeof value === 'boolean') {
    return String(value);
  }
  return '<redacted>';
}

export function argsToQueryString(args: Record<string, any>): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(args)) {
    if (INTERNAL_ARGS_KEYS.has(key)) continue;
    if (value === undefined || value === null) continue;
    if (typeof value === 'object' && !Array.isArray(value)) continue;

    const sensitive = isSensitiveKey(key);

    if (Array.isArray(value)) {
      for (const item of value) {
        params.append(key, sensitive ? sanitizeValue(item) : String(item));
      }
    } else {
      params.append(key, sensitive ? sanitizeValue(value) : String(value));
    }
  }
  return params.toString();
}

function trackEvent(
  eventName: string,
  parameters?: Record<string, ParameterValue>
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
  parameters?: Record<string, ParameterValue>
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

export function exitAndFlushAnalytics(code: string | number): never {
  if (_telemetryInitialized) {
    // Synchronously flush analytics before exit
    // This is a blocking operation that waits for HTTP requests to complete
    flushAnalytics();
  }
  process.exit(code);
}

function getPackageManagerInfo() {
  const pm = detectPackageManager();
  return {
    name: pm,
    version: getPackageManagerVersion(pm),
  };
}

function getAnalyticsId(): string | false | undefined {
  const nxJson = readNxJson(workspaceRoot);
  return nxJson?.analytics;
}
