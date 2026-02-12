import { readNxJson } from '../config/nx-json';
import { workspaceRoot } from '../utils/workspace-root';
import { nxVersion } from '../utils/versions';
import { AnalyticsCollector } from './analytics-collector';
import { machineId } from 'node-machine-id';
import {
  getPackageManagerVersion,
  detectPackageManager,
} from '../utils/package-manager';
import {
  EventCustomDimension,
  EventCustomMetric,
  ParameterValue,
} from './parameter';
import { extname, join } from 'path';
import { writeFileSync } from 'fs';
import { spawn } from 'child_process';

let _analyticsCollector: AnalyticsCollector = null;
let _currentMachineId: string = null;

export async function startAnalytics() {
  const workspaceId = getAnalyticsId();
  if (!workspaceId) {
    // Analytics are disabled, exit early.
    return;
  }
  const userId = await currentMachineId();
  const packageManagerInfo = getPackageManagerInfo();

  _analyticsCollector = new AnalyticsCollector(
    workspaceId,
    userId,
    nxVersion,
    packageManagerInfo
  );
}

export function reportNxAddCommand(packageName: string, version: string) {
  reportCommandRunEvent('add', {
    [EventCustomDimension.PackageName]: packageName,
    [EventCustomDimension.PackageVersion]: version,
  });
}

export function reportNxGenerateCommand(generator: string) {
  trackEvent(
    'generator_used',
    { [EventCustomDimension.GeneratorName]: generator },
    false
  );
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
  trackEvent(command, parameters, true, pageLocation);
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
  parameters?: Record<string, ParameterValue>,
  isPageView?: boolean,
  pageLocation?: string
) {
  if (_analyticsCollector) {
    _analyticsCollector.event(eventName, parameters, isPageView, pageLocation);
  }
}

export async function flushAnalytics() {
  if (_analyticsCollector) {
    await _analyticsCollector.flush();
  }
}

let processorSpawned = false;
export function exitAndFlushAnalytics(code: string | number): never {
  if (_analyticsCollector && !processorSpawned) {
    processorSpawned = true;

    // Multiple processes running at the same time can cause issues with the file system.
    // Write to unique file path and pass to the spawned process
    const analyticsBufferFile = join(
      workspaceRoot,
      '.nx',
      'workspace-data',
      `analytics-${process.pid}-${Date.now()}.json`
    );
    writeFileSync(analyticsBufferFile, _analyticsCollector.serialize());

    const pathToProcessor = require.resolve('./analytics-processor');
    const isUsingTS = extname(pathToProcessor) === '.ts';
    spawn(
      'node',
      [
        ...(isUsingTS ? ['--require', 'ts-node/register'] : []),
        pathToProcessor,
      ],
      {
        env: {
          ...process.env,
          NX_ANALYTICS_BUFFER_FILE: analyticsBufferFile,
          ...(isUsingTS
            ? {
                TS_NODE_COMPILER_OPTIONS: JSON.stringify({
                  module: 'commonjs',
                  moduleResolution: 'node',
                }),
              }
            : {}),
        },
        detached: true,
        windowsHide: true,
        stdio: 'ignore',
      }
    ).unref();
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

async function currentMachineId() {
  if (!_currentMachineId) {
    try {
      _currentMachineId = await machineId();
    } catch (e) {
      if (process.env.NX_VERBOSE_LOGGING === 'true') {
        console.log(`Unable to get machineId. Error: ${e.message}`);
      }
      _currentMachineId = '';
    }
  }
  return _currentMachineId;
}
