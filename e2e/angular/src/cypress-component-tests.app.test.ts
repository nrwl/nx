import {
  checkFilesDoNotExist,
  checkFilesExist,
  cleanupProject,
  createFile,
  newProject,
  runCLI,
  runE2ETests,
  uniq,
  updateFile,
  removeFile,
  updateJson,
} from '@nx/e2e-utils';
import { names } from '@nx/devkit';
import { join } from 'path';

describe('Angular Cypress Component Tests - app', () => {
  let projectName: string;
  const appName = uniq('cy-angular-app');
  const usedInAppLibName = uniq('cy-angular-lib');
  const buildableLibName = uniq('cy-angular-buildable-lib');

  beforeAll(async () => {
    projectName = newProject({
      name: uniq('cy-ng'),
      packages: ['@nx/angular'],
    });

    runCLI(
      `generate @nx/angular:app ${appName} --bundler=webpack --no-interactive`
    );
    runCLI(
      `generate @nx/angular:component ${appName}/src/lib/fancy-component/fancy-component --no-interactive`
    );
  });

  afterAll(() => cleanupProject());

  it('should test app', () => {
    runCLI(
      `generate @nx/angular:cypress-component-configuration --project=${appName} --generate-tests --no-interactive`
    );
    if (runE2ETests('cypress')) {
      expect(runCLI(`component-test ${appName}`)).toContain(
        'All specs passed!'
      );
    }
  }, 300_000);
});
