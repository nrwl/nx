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

describe('Angular Package', () => {
  ['publishable', 'buildable'].forEach((testConfig) => {
    describe(`library builder - ${testConfig}`, () => {
      /**
       * Graph:
       *
       *                 childLib
       *               /
       * parentLib =>
       *               \
       *                 childLib2
       *
       */
      let parentLib: string;
      let childLib: string;
      let childLib2: string;
      let proj: string;

      beforeEach(() => {
        parentLib = uniq('parentlib');
        childLib = uniq('childlib');
        childLib2 = uniq('childlib2');

        // These fail with pnpm due to incompatibilities with ngcc for buildable libraries.
        // therefore switch to yarn
        proj =
          getSelectedPackageManager() === 'pnpm' && testConfig !== 'publishable'
            ? newProject({ packageManager: 'yarn' })
            : newProject();

        if (testConfig === 'buildable') {
          runCLI(
            `generate @nrwl/angular:library ${parentLib} --buildable=true --no-interactive`
          );
          runCLI(
            `generate @nrwl/angular:library ${childLib} --buildable=true --no-interactive`
          );
          runCLI(
            `generate @nrwl/angular:library ${childLib2} --buildable=true --no-interactive`
          );
        } else {
          runCLI(
            `generate @nrwl/angular:library ${parentLib} --publishable=true --importPath=@${proj}/${parentLib} --no-interactive`
          );
          runCLI(
            `generate @nrwl/angular:library ${childLib} --publishable=true --importPath=@${proj}/${childLib} --no-interactive`
          );
          runCLI(
            `generate @nrwl/angular:library ${childLib2} --publishable=true --importPath=@${proj}/${childLib2} --no-interactive`
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
              `"@${proj}/${childLib}": ["libs/${childLib}/src/index.ts"],`,
              `"@${proj}/${childLib}": ["libs/${childLib}/src/index.ts"],
      "@${proj}/${childLib}/sub": ["libs/${childLib}/sub/src/index.ts"],
        `
            );
          });
        }

        // create dependencies by importing
        const createDep = (parent, children: string[]) => {
          let moduleContent = `
              import { NgModule } from '@angular/core';
              import { CommonModule } from '@angular/common';
              ${children
                .map(
                  (entry) =>
                    `import { ${
                      names(entry).className
                    }Module } from '@${proj}/${entry}';`
                )
                .join('\n')}
            `;

          if (testConfig === 'publishable') {
            moduleContent += `
              import { SubModule } from '@${proj}/${childLib}/sub';

              @NgModule({
                imports: [CommonModule, ${children
                  .map((entry) => `${names(entry).className}Module`)
                  .join(',')}, SubModule]
              })
              export class ${names(parent).className}Module {}`;
          }

          updateFile(
            `libs/${parent}/src/lib/${parent}.module.ts`,
            moduleContent
          );
        };

        createDep(parentLib, [childLib, childLib2]);
      });

      afterEach(() => cleanupProject());

      it('should build properly and update the parent package.json with the dependencies', () => {
        runCLI(`build ${childLib}`);
        runCLI(`build ${childLib2}`);
        runCLI(`build ${parentLib}`);

        checkFilesExist(
          `dist/libs/${childLib}/package.json`,
          `dist/libs/${childLib2}/package.json`,
          `dist/libs/${parentLib}/package.json`
        );

        const jsonFile = readJson(`dist/libs/${parentLib}/package.json`);

        expect(jsonFile.dependencies['tslib']).toMatch(/\^2\.\d+\.\d+/); // match any ^2.x.x
        expect(jsonFile.peerDependencies[`@${proj}/${childLib}`]).toBeDefined();
        expect(
          jsonFile.peerDependencies[`@${proj}/${childLib2}`]
        ).toBeDefined();
        expect(jsonFile.peerDependencies['@angular/common']).toBeDefined();
        expect(jsonFile.peerDependencies['@angular/core']).toBeDefined();
      });
    });
  });

  describe('Publishable library secondary entry point', () => {
    let project: string;
    let lib: string;
    let entryPoint: string;

    beforeEach(() => {
      project = newProject();
      lib = uniq('lib');
      entryPoint = uniq('entrypoint');

      runCLI(
        `generate @nrwl/angular:lib ${lib} --publishable --importPath=@${project}/${lib} --no-interactive`
      );
      runCLI(
        `generate @nrwl/angular:secondary-entry-point --name=${entryPoint} --library=${lib} --no-interactive`
      );
    });

    it('should build successfully', () => {
      const buildOutput = runCLI(`build ${lib}`);

      expect(buildOutput).toContain(
        `Building entry point '@${project}/${lib}'`
      );
      expect(buildOutput).toContain(
        `Building entry point '@${project}/${lib}/${entryPoint}'`
      );
      expect(buildOutput).toContain('Running target "build" succeeded');
    });
  });
});
