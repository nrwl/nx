import { logger } from '../utils/logger';
import {
  createProjectGraphAsync,
  readProjectsConfigurationFromProjectGraph,
} from '../project-graph/project-graph';
import { ProjectsConfigurations } from '../config/workspace-json-project-json';
import { readNxJson } from '../config/configuration';
import { NxJsonConfiguration } from '../config/nx-json';
import { toOldFormat } from './angular-json';

/* eslint-disable */
const Module = require('module');
const originalRequire: NodeRequire = Module.prototype.require;

let patched = false;

const allowedProjectExtensions = [
  'tags',
  'implicitDependencies',
  'configFilePath',
  '$schema',
  'generators',
  'namedInputs',
  'name',
  'files',
];

const allowedWorkspaceExtensions = [
  'implicitDependencies',
  'affected',
  'npmScope',
  'tasksRunnerOptions',
  'workspaceLayout',
  'plugins',
  'targetDefaults',
  'files',
  'generators',
  'namedInputs',
];

if (!patched) {
  Module.prototype.require = function () {
    const result = originalRequire.apply(this, arguments);
    if (arguments[0].startsWith('@angular-devkit/core')) {
      const ngCoreWorkspace = originalRequire.apply(this, [
        `@angular-devkit/core/src/workspace/core`,
      ]);
      mockReadWorkspace(ngCoreWorkspace);
      const readJsonUtils = originalRequire.apply(this, [
        `@angular-devkit/core/src/workspace/json/reader`,
      ]);
      mockReadJsonWorkspace(readJsonUtils);
    }
    return result;
  };

  try {
    require('@angular-devkit/build-angular/src/utils/version').Version.assertCompatibleAngularVersion =
      () => {};
  } catch (e) {}

  try {
    require('@angular-devkit/build-angular/src/utils/version').assertCompatibleAngularVersion =
      () => {};
  } catch (e) {}

  patched = true;
}

function mockReadWorkspace(
  ngCoreWorkspace: typeof import('@angular-devkit/core/src/workspace/core')
) {
  mockMember(
    ngCoreWorkspace,
    'readWorkspace',
    (originalReadWorkspace) =>
      (path, ...rest) => {
        path = 'angular.json';
        return originalReadWorkspace.apply(this, [path, ...rest]);
      }
  );
}

/**
 * Patch readJsonWorkspace to handle workspaces without a central workspace file.
 * NOTE: We hide warnings that would be logged during this process.
 */
function mockReadJsonWorkspace(
  readJsonUtils: typeof import('@angular-devkit/core/src/workspace/json/reader')
) {
  mockMember(
    readJsonUtils,
    'readJsonWorkspace',
    (originalReadJsonWorkspace) => async (path, host, options) => {
      const modifiedOptions = {
        ...options,
        allowedProjectExtensions,
        allowedWorkspaceExtensions,
      };
      try {
        // Attempt angular CLI default behaviour
        return await originalReadJsonWorkspace(path, host, modifiedOptions);
      } catch {
        // This failed. Its most likely due to a lack of a workspace definition file,
        // or other things that are different between NgCLI and Nx config files.
        const projectGraph = await createProjectGraphAsync();
        const nxJson = readNxJson();

        // Construct old workspace.json format from project graph
        const w: ProjectsConfigurations & NxJsonConfiguration = {
          ...nxJson,
          ...readProjectsConfigurationFromProjectGraph(projectGraph),
        };

        // Read our v1 workspace schema
        const workspaceConfiguration = toOldFormat(w);
        // readJsonWorkspace actually has AST parsing + more, so we
        // still need to call it rather than just return our file
        return originalReadJsonWorkspace.apply(this, [
          'angular.json', // path name, doesn't matter
          {
            // second arg is a host, only method used is readFile
            readFile: () => JSON.stringify(workspaceConfiguration),
          },
          modifiedOptions,
        ]);
      }
    }
  );
}

function mockMember<T, T2 extends keyof T>(
  obj: T,
  method: T2,
  factory: (originalValue: T[T2]) => T[T2]
) {
  obj[method] = factory(obj[method]);
}
