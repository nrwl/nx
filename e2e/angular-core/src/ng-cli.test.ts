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
    // update package.json
    const packageJson = readJson('package.json');
    packageJson.description = 'some description';
    updateFile('package.json', JSON.stringify(packageJson, null, 2));

    // use vite to build a library
    packageInstall('vite', undefined, 'latest');
    packageInstall('@nrwl/vite');
    const angularJson = readJson('angular.json');
    angularJson.projects[project].architect.build = {
      builder: '@nrwl/vite:build',
      options: {
        configFile: 'vite.config.ts',
        outputPath: 'dist',
      },
    };
    updateFile('angular.json', JSON.stringify(angularJson, null, 2));
    updateFile(
      'vite.config.ts',
      `
      import { defineConfig } from 'vite';
      export default defineConfig({
        build: {
          lib: {
            entry: 'src/main.ts',
            name: 'my-app',
            fileName: 'main',
            formats: ['cjs']
          }
        }
      });
    `
    );
    updateFile(`src/main.ts`, `console.log('Hello World');`);

    runCommand(`npx ng build ${project}`);

    checkFilesExist(`dist/main.js`);
    expect(runCommand(`node dist/main.js`)).toMatch(/Hello World/);
  });
});
