/* eslint-disable */
const Module = require('module');
const originalRequire = Module.prototype.require;

Module.prototype.require = function () {
  const result = originalRequire.apply(this, arguments);
  if (arguments[0].startsWith('@angular-devkit/core')) {
    const Workspace = originalRequire.apply(this, [
      `@angular-devkit/core/src/experimental/workspace`,
    ]).Workspace;
    Workspace._workspaceFileNames = [
      'workspace.json',
      ...Workspace._workspaceFileNames,
    ];
    const core = originalRequire.apply(this, [
      `@angular-devkit/core/src/workspace/core`,
    ]);
    core._test_addWorkspaceFile('workspace.json', core.WorkspaceFormat.JSON);
  }
  return result;
};

try {
  require('@angular-devkit/build-angular/src/utils/version').Version.assertCompatibleAngularVersion = () => {};
} catch (e) {}

try {
  require('@angular-devkit/build-angular/src/utils/version').assertCompatibleAngularVersion = () => {};
} catch (e) {}
