import {
  checkFilesExist,
  cleanupProject,
  getSelectedPackageManager,
  packageInstall,
  readJson,
  runCommand,
  runNgNew,
  uniq,
  updateFile,
} from '@nrwl/e2e/utils';
import { PackageManager } from 'nx/src/utils/package-manager';

describe('using Nx executors and generators with Angular CLI', () => {
  let project: string;
  let packageManager: PackageManager;

  beforeEach(() => {
    project = uniq('proj');
    packageManager = getSelectedPackageManager();
    runNgNew(project, packageManager);
  });

  afterEach(() => cleanupProject({ skipReset: true }));

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
