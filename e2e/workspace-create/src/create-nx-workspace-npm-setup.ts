import {
  cleanupProject,
  getSelectedPackageManager,
  runCommand,
  runCreateWorkspace,
  uniq,
} from '@nx/e2e-utils';

const wsName = uniq('npm');

let orginalGlobCache;

export function setupNpmWorkspaceTest() {
  beforeAll(() => {
    orginalGlobCache = process.env.NX_PROJECT_GLOB_CACHE;
    // glob cache is causing previous projects to show in Workspace for maxWorkers overrides
    // which fails due to files no longer being available
    process.env.NX_PROJECT_GLOB_CACHE = 'false';

    runCreateWorkspace(wsName, {
      preset: 'npm',
      packageManager: getSelectedPackageManager(),
    });
  });

  afterEach(() => {
    // cleanup previous projects
    runCommand(`rm -rf packages/** tsconfig.base.json tsconfig.json`);
  });

  afterAll(() => {
    process.env.NX_PROJECT_GLOB_CACHE = orginalGlobCache;
    cleanupProject({ skipReset: true });
  });
}

export function getWorkspaceName() {
  return wsName;
}
