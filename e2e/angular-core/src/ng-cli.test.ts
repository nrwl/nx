import * as isCI from 'is-ci';
import {
  checkFilesExist,
  getSelectedPackageManager,
  packageInstall,
  readJson,
  runCommand,
  runNgNew,
  tmpProjPath,
  uniq,
  updateFile,
} from '@nrwl/e2e/utils';
import { PackageManager } from 'nx/src/utils/package-manager';
import { removeSync } from 'fs-extra';

process.env.SELECTED_CLI = 'angular';

describe('using Nx executors and generators with Angular CLI', () => {
  let project: string;
  let packageManager: PackageManager;

  beforeEach(() => {
    project = uniq('proj');
    packageManager = getSelectedPackageManager();
    runNgNew(project, packageManager);
  });

  afterEach(() => {
    if (isCI) {
      try {
        removeSync(tmpProjPath());
      } catch (e) {}
    }
  });

  it('should convert Nx executors into Angular CLI compatible builders', () => {
    packageInstall('@nrwl/angular');
    const angularJson = readJson('angular.json');
    angularJson.projects[project].architect.build.builder =
      '@nrwl/angular:webpack-browser';
    updateFile('angular.json', JSON.stringify(angularJson, null, 2));

    runCommand(`npx ng build ${project} --configuration=development`);

    checkFilesExist(`dist/${project}/main.js`);
  });
});
