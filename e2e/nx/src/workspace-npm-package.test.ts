import {
  cleanupProject,
  getPackageManagerCommand,
  getSelectedPackageManager,
  runCLI,
  runCommand,
  uniq,
  updateFile,
} from '@nx/e2e-utils';
import { setupWorkspaceTests } from './workspace-setup';

describe('Workspace Tests - @nx/workspace:npm-package', () => {
  let proj: string;

  beforeAll(() => {
    proj = setupWorkspaceTests();
  });

  afterAll(() => cleanupProject());

  it('should create a minimal npm package', () => {
    const npmPackage = uniq('npm-package');

    runCLI(`generate @nx/workspace:npm-package ${npmPackage}`);

    updateFile('package.json', (content) => {
      const json = JSON.parse(content);
      json.workspaces = ['libs/*'];
      return JSON.stringify(json);
    });

    const pmc = getPackageManagerCommand({
      packageManager: getSelectedPackageManager(),
    });

    runCommand(pmc.install);

    const result = runCLI(`test ${npmPackage}`);
    expect(result).toContain('Hello World');
  });
});
