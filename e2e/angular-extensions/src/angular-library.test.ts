process.env.SELECTED_CLI = 'angular';

import {
  checkFilesExist,
  getSelectedPackageManager,
  newProject,
  readJson,
  cleanupProject,
  runCLI,
  uniq,
  updateFile,
} from '@nrwl/e2e/utils';
import { names } from '@nrwl/devkit';

describe('Angular Library Package', () => {
  let project: string;
  beforeAll(() => {
    // These fail with pnpm due to incompatibilities with ngcc for buildable libraries.
    // therefore switch to yarn
    project =
      getSelectedPackageManager() === 'pnpm'
        ? newProject({ packageManager: 'npm' })
        : newProject();
  });

  afterAll(() => cleanupProject());

  describe(`library builder - publishable`, () => {
    it('should build publishable libs successfully', () => {
      // ARRANGE
      const lib = uniq('lib');
      const childLib = uniq('childLib');
      const entryPoint = uniq('entrypoint');

      runCLI(
        `generate @nrwl/angular:lib ${lib} --publishable --importPath=@${project}/${lib} --no-interactive`
      );
      runCLI(
        `generate @nrwl/angular:secondary-entry-point --name=${entryPoint} --library=${lib} --no-interactive`
      );

      runCLI(
        `generate @nrwl/angular:library ${childLib} --publishable=true --importPath=@${project}/${childLib} --no-interactive`
      );

      // create secondary entrypoint
      updateFile(
        `libs/${childLib}/sub/package.json`,
        `
    {
      "ngPackage": {}
    }
  `
      );
      updateFile(
        `libs/${childLib}/sub/src/lib/sub.module.ts`,
        `
    import { NgModule } from '@angular/core';
    import { CommonModule } from '@angular/common';
    @NgModule({ imports: [CommonModule] })
    export class SubModule {}
  `
      );

      updateFile(
        `libs/${childLib}/sub/src/public_api.ts`,
        `export * from './lib/sub.module';`
      );

      updateFile(
        `libs/${childLib}/sub/src/index.ts`,
        `export * from './public_api';`
      );

      updateFile(`tsconfig.base.json`, (s) => {
        return s.replace(
          `"@${project}/${childLib}": ["libs/${childLib}/src/index.ts"],`,
          `"@${project}/${childLib}": ["libs/${childLib}/src/index.ts"],
"@${project}/${childLib}/sub": ["libs/${childLib}/sub/src/index.ts"],
  `
        );
      });

      const moduleContent = `
      import { NgModule } from '@angular/core';
      import { CommonModule } from '@angular/common';
            import { ${
              names(childLib).className
            }Module } from '@${project}/${childLib}';
      import { SubModule } from '@${project}/${childLib}/sub';
      @NgModule({
        imports: [CommonModule, ${names(childLib).className}Module, SubModule]
      })
      export class ${names(lib).className}Module {}`;

      updateFile(`libs/${lib}/src/lib/${lib}.module.ts`, moduleContent);

      // ACT
      const buildOutput = runCLI(`build ${lib}`);

      // ASSERT
      expect(buildOutput).toContain(
        `Building entry point '@${project}/${lib}'`
      );
      expect(buildOutput).toContain(
        `Building entry point '@${project}/${lib}/${entryPoint}'`
      );
      expect(buildOutput).toContain('Running target "build" succeeded');
    });
  });

  describe(`library builder - buildable`, () => {
    it('should build properly and update the parent package.json with the dependencies', () => {
      // ARRANGE
      const parentLib = uniq('parentlib');
      const childLib = uniq('childlib');

      runCLI(
        `generate @nrwl/angular:library ${parentLib} --buildable=true --no-interactive`
      );
      runCLI(
        `generate @nrwl/angular:library ${childLib} --buildable=true --no-interactive`
      );

      // create dependencies by importing
      const moduleContent = `
      import { NgModule } from '@angular/core';
      import { CommonModule } from '@angular/common';
      import { ${
        names(childLib).className
      }Module } from '@${project}/${childLib}';`;

      updateFile(
        `libs/${parentLib}/src/lib/${parentLib}.module.ts`,
        moduleContent
      );

      // ACT

      runCLI(`build ${childLib}`);
      runCLI(`build ${parentLib}`);

      // ASSERT

      checkFilesExist(
        `dist/libs/${childLib}/package.json`,
        `dist/libs/${parentLib}/package.json`
      );

      const jsonFile = readJson(`dist/libs/${parentLib}/package.json`);

      expect(jsonFile.dependencies['tslib']).toMatch(/\^2\.\d+\.\d+/); // match any ^2.x.x
      expect(
        jsonFile.peerDependencies[`@${project}/${childLib}`]
      ).toBeDefined();
      expect(jsonFile.peerDependencies['@angular/common']).toBeDefined();
      expect(jsonFile.peerDependencies['@angular/core']).toBeDefined();
    });
  });
});
