import { logger } from '../shared/logger';
import {
  resolveOldFormatWithInlineProjects,
  workspaceConfigName,
  Workspaces,
} from '../shared/workspace';
import { appRootPath } from '../utils/app-root';

/* eslint-disable */
const Module = require('module');
const originalRequire = Module.prototype.require;

let patched = false;

if (!patched) {
  Module.prototype.require = function () {
    const result = originalRequire.apply(this, arguments);
    if (arguments[0].startsWith('@angular-devkit/core')) {
      // Register `workspace.json` as a nonstandard workspace config file
      const core = originalRequire.apply(this, [
        `@angular-devkit/core/src/workspace/core`,
      ]);
      core._test_addWorkspaceFile('workspace.json', core.WorkspaceFormat.JSON);
      const originalWriteWorkspace = core.writeWorkspace;
      core.writeWorkspace = (...args) => {
        originalWriteWorkspace.apply(this, args);
        const configFile = workspaceConfigName(appRootPath);
        logger.warn(
          `[NX] An Angular builder called \`writeWorkspace\`, this may have had unintended consequences in ${configFile}`
        );
        logger.warn(`[NX] Double check ${configFile} before proceeding`);
      };

      // Patch readJsonWorkspace to inline project configurations
      // as well as work in workspaces without a central workspace file.
      const readJsonUtils = originalRequire.apply(this, [
        `@angular-devkit/core/src/workspace/json/reader`,
      ]);
      const originalReadJsonWorkspace = readJsonUtils.readJsonWorkspace;
      readJsonUtils.readJsonWorkspace = () => {
        // Read our v1 workspace schema
        const w = resolveOldFormatWithInlineProjects(
          new Workspaces(appRootPath).readWorkspaceConfiguration()
        );
        // readJsonWorkspace actually has AST parsing + more, so we
        // still need to call it rather than just return our file
        return originalReadJsonWorkspace.apply(this, [
          'workspace.json', // path name, doesn't matter
          {
            // second arg is a host, only method used is readFile
            readFile: () => {
              const buf = JSON.stringify(w);
              return buf;
            },
          },
        ]);
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
