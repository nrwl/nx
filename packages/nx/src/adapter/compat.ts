import {
  createProjectGraphAsync,
  readProjectsConfigurationFromProjectGraph,
} from '../project-graph/project-graph';
import {
  ProjectConfiguration,
  ProjectsConfigurations,
} from '../config/workspace-json-project-json';
import { readNxJson } from '../config/configuration';
import { NxJsonConfiguration } from '../config/nx-json';
import { toOldFormat } from './angular-json';

/* eslint-disable */
const Module = require('module');
const originalRequire: NodeRequire = Module.prototype.require;

let patched = false;

// Checks that a given const array has all keys in the union provided as T2,
// and marks it mutable. In this case, this is useful s.t. we can ensure the
// arrays we pass to angular for allowedProjectExtensions and allowedWorkspaceExtensions
// contain all of the keys which we may be passing through.
type CheckHasKeys<Arr extends readonly unknown[], Keys extends Arr[number]> = {
  -readonly [P in keyof Arr]: Arr[P];
};

// If we pass props on a project that angular doesn't know about,
// it throws a warning that users see. We want to pass them still,
// so older plugins writtin in Ng Devkit can update these.
//
// There are some props in here (root) that angular already knows about,
// but it doesn't hurt to have them in here as well to help static analysis.
export const allowedProjectExtensions = [
  'tags',
  'implicitDependencies',
  'configFilePath',
  '$schema',
  'generators',
  'namedInputs',
  'name',
  'files',
  'root',
  'sourceRoot',
  'projectType',
  'release',
  'includedScripts',
] as const;

// If we pass props on the workspace that angular doesn't know about,
// it throws a warning that users see. We want to pass them still,
// so older plugins writtin in Ng Devkit can update these.
//
// There are some props in here (root) that angular already knows about,
// but it doesn't hurt to have them in here as well to help static analysis.
export const allowedWorkspaceExtensions = [
  'implicitDependencies',
  'affected',
  'tasksRunnerOptions',
  'workspaceLayout',
  'plugins',
  'targetDefaults',
  'files',
  'generators',
  'namedInputs',
  'extends',
  'cli',
  'pluginsConfig',
  'defaultProject',
  'installation',
  'release',
  'nxCloudAccessToken',
  'nxCloudUrl',
  'nxCloudEncryptionKey',
  'parallel',
  'cacheDirectory',
  'useDaemonProcess',
] as const;

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
        allowedProjectExtensions: allowedProjectExtensions as CheckHasKeys<
          typeof allowedProjectExtensions,
          keyof Omit<ProjectConfiguration, 'targets' | 'generators'>
        >,
        allowedWorkspaceExtensions: allowedWorkspaceExtensions as CheckHasKeys<
          typeof allowedWorkspaceExtensions,
          keyof NxJsonConfiguration
        >,
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
