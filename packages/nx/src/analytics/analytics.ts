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

export function reportCommandRunEvent(command: string) {
  command = command === 'g' ? 'generate' : command;
  trackEvent(command, undefined, true);
}

export function reportProjectGraphCreationEvent(time: number) {
  trackEvent('project_graph_creation', {
    [EventCustomMetric.ProjectGraphCreationTime]: time,
  });
}

function trackEvent(
  eventName: string,
  parameters?: Record<string, ParameterValue>,
  isPageView?: boolean
) {
  if (_analyticsCollector) {
    _analyticsCollector.event(eventName, parameters, isPageView);
  }
}

export async function flushAnalytics() {
  if (_analyticsCollector) {
    await _analyticsCollector.flush();
  }
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
