import { logger } from '../utils/logger';
import {
  resolveOldFormatWithInlineProjects,
  workspaceConfigName,
  Workspaces,
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
const originalRequire = Module.prototype.require;

let patched = false;
let loggedWriteWorkspaceWarning = false;

if (!patched) {
  Module.prototype.require = function () {
    const result = originalRequire.apply(this, arguments);
    if (arguments[0].startsWith('@angular-devkit/core')) {
      // Register `workspace.json` as a nonstandard workspace config file
      const core = originalRequire.apply(this, [
        `@angular-devkit/core/src/workspace/core`,
      ]);
      core._test_addWorkspaceFile('workspace.json', core.WorkspaceFormat.JSON);
      const originalReadWorkspace = core.readWorkspace;
      core.readWorkspace = (path, ...rest) => {
        const configFile = workspaceConfigName(workspaceRoot);
        if (!configFile) {
          path = 'workspace.json';
        }
        return originalReadWorkspace.apply(this, [path, ...rest]);
      };
      const originalWriteWorkspace = core.writeWorkspace;
      core.writeWorkspace = (...args) => {
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
      };

      // Patch readJsonWorkspace to inline project configurations
      // as well as work in workspaces without a central workspace file.
      const readJsonUtils = originalRequire.apply(this, [
        `@angular-devkit/core/src/workspace/json/reader`,
      ]);
      const originalReadJsonWorkspace = readJsonUtils.readJsonWorkspace;
      readJsonUtils.readJsonWorkspace = async (
        path,
        host: { readFile: (p) => Promise<string> }
      ) => {
        try {
          return await originalReadJsonWorkspace(path, host);
        } catch {
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
          ]);
        }
      };
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
