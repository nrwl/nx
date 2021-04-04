import {
  checkFilesExist,
  newProject,
  readJson,
  removeProject,
  runCLI,
  uniq,
  updateFile,
} from '@nrwl/e2e/utils';
import { names } from '@nrwl/devkit';

['publishable', 'buildable'].forEach((testConfig) => {
  describe('Build Angular library', () => {
    /**
     * Graph:
     *
     *                 childLib
     *               /
     * parentLib =>
     *               \
     *                \
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

      proj = newProject();

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

        updateFile(`libs/${parent}/src/lib/${parent}.module.ts`, moduleContent);
      };

      createDep(parentLib, [childLib, childLib2]);
    });

    afterEach(() => removeProject({ onlyOnCI: true }));

    it('should throw an error if the dependent library has not been built before building the parent lib', () => {
      expect.assertions(2);

      try {
        runCLI(`build ${parentLib}`);
      } catch (e) {
        expect(e.stderr.toString()).toContain(
          `Some of the project ${parentLib}'s dependencies have not been built yet. Please build these libraries before:`
        );
        expect(e.stderr.toString()).toContain(`${childLib}`);
      }
    });

    it('should build the library when it does not have any deps', () => {
      runCLI(`build ${childLib}`);

      checkFilesExist(`dist/libs/${childLib}/package.json`);
    });

    it('aaashould properly add references to any dependency into the parent package.json', () => {
      runCLI(`build ${childLib}`);
      runCLI(`build ${childLib2}`);
      runCLI(`build ${parentLib}`);

      checkFilesExist(
        `dist/libs/${childLib}/package.json`,
        `dist/libs/${childLib2}/package.json`,
        `dist/libs/${parentLib}/package.json`
      );

      const jsonFile = readJson(`dist/libs/${parentLib}/package.json`);

      expect(jsonFile.dependencies['tslib']).toEqual('^2.0.0');
      expect(jsonFile.peerDependencies[`@${proj}/${childLib}`]).toBeDefined();
      expect(jsonFile.peerDependencies[`@${proj}/${childLib2}`]).toBeDefined();
      expect(jsonFile.peerDependencies['@angular/common']).toBeDefined();
      expect(jsonFile.peerDependencies['@angular/core']).toBeDefined();
    });
  });
});
