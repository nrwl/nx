import { logger } from '../utils/logger';
import {
  resolveOldFormatWithInlineProjects,
  workspaceConfigName,
} from '../config/workspaces';
import { workspaceRoot } from '../utils/workspace-root';
import {
  createProjectGraphAsync,
  readProjectsConfigurationFromProjectGraph,
} from '../project-graph/project-graph';
import { ProjectsConfigurations } from '../config/workspace-json-project-json';
import { readNxJson } from '../config/configuration';
import { NxJsonConfiguration } from '../config/nx-json';

/* eslint-disable */
const Module = require('module');
const originalRequire: NodeRequire = Module.prototype.require;

let patched = false;
let loggedWriteWorkspaceWarning = false;

const allowedProjectExtensions = [
  'tags',
  'implicitDependencies',
  'configFilePath',
  '$schema',
  'generators',
  'namedInputs',
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
      // Register `workspace.json` as a nonstandard workspace config file
      const ngCoreWorkspace = originalRequire.apply(this, [
        `@angular-devkit/core/src/workspace/core`,
      ]);
      ngCoreWorkspace._test_addWorkspaceFile(
        'workspace.json',
        ngCoreWorkspace.WorkspaceFormat.JSON
      );

      mockReadWorkspace(ngCoreWorkspace);
      mockWriteWorkspace(ngCoreWorkspace);

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
        const configFile = workspaceConfigName(workspaceRoot);
        if (!configFile) {
          path = 'workspace.json';
        }
        return originalReadWorkspace.apply(this, [path, ...rest]);
      }
  );
}

function mockWriteWorkspace(
  ngCoreWorkspace: typeof import('@angular-devkit/core/src/workspace/core')
) {
  mockMember(
    ngCoreWorkspace,
    'writeWorkspace',
    (originalWriteWorkspace) =>
      (...args) => {
        const configFile = workspaceConfigName(workspaceRoot);
        if (!loggedWriteWorkspaceWarning) {
          if (configFile) {
            logger.warn(
              `[NX] Angular devkit called \`writeWorkspace\`, this may have had unintended consequences in ${configFile}`
            );
            logger.warn(`[NX] Double check ${configFile} before proceeding`);
          } else {
            logger.warn(
              `[NX] Angular devkit called \`writeWorkspace\`, this may have created 'workspace.json' or 'angular.json`
            );
            logger.warn(
              `[NX] Double check workspace configuration before proceeding`
            );
          }
          loggedWriteWorkspaceWarning = true;
        }
        return originalWriteWorkspace.apply(this, args);
      }
  );
}

/**
 * Patch readJsonWorkspace to inline project configurations
 * as well as work in workspaces without a central workspace file.
 *
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
        logger.debug(
          '[NX] Angular devkit readJsonWorkspace fell back to Nx workspaces logic'
        );
        const projectGraph = await createProjectGraphAsync();
        const nxJson = readNxJson();

        // Construct old workspace.json format from project graph
        const w: ProjectsConfigurations & NxJsonConfiguration = {
          ...nxJson,
          ...readProjectsConfigurationFromProjectGraph(projectGraph),
        };

        // Read our v1 workspace schema
        const workspaceConfiguration = resolveOldFormatWithInlineProjects(w);
        // readJsonWorkspace actually has AST parsing + more, so we
        // still need to call it rather than just return our file
        return originalReadJsonWorkspace.apply(this, [
          'workspace.json', // path name, doesn't matter
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
