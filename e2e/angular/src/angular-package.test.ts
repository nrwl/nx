import { toClassName } from '@nrwl/workspace';
import {
  forEachCli,
  newProject,
  readJson,
  runCLI,
  uniq,
  updateFile,
} from '@nrwl/e2e/utils';

forEachCli('angular', (cli) => {
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

    beforeEach(() => {
      parentLib = uniq('parentlib');
      childLib = uniq('childlib');
      childLib2 = uniq('childlib2');

      newProject();

      runCLI(
        `generate @nrwl/angular:library ${parentLib} --publishable=true --importPath=@proj/${parentLib} --no-interactive`
      );
      runCLI(
        `generate @nrwl/angular:library ${childLib} --publishable=true --importPath=@proj/${childLib} --no-interactive`
      );
      runCLI(
        `generate @nrwl/angular:library ${childLib2} --publishable=true --importPath=@proj/${childLib2} --no-interactive`
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
          `"@proj/${childLib}": ["libs/${childLib}/src/index.ts"],`,
          `"@proj/${childLib}": ["libs/${childLib}/src/index.ts"],
      "@proj/${childLib}/sub": ["libs/${childLib}/sub/src/index.ts"],
        `
        );
      });

      // create dependencies by importing
      const createDep = (parent, children: string[]) => {
        updateFile(
          `libs/${parent}/src/lib/${parent}.module.ts`,
          `
              import { NgModule } from '@angular/core';
              import { CommonModule } from '@angular/common';
              ${children
                .map(
                  (entry) =>
                    `import { ${toClassName(
                      entry
                    )}Module } from '@proj/${entry}';`
                )
                .join('\n')}
              import { SubModule } from '@proj/${childLib}/sub';
              
              @NgModule({
                imports: [CommonModule, ${children
                  .map((entry) => `${toClassName(entry)}Module`)
                  .join(',')}, SubModule]
              })
              export class ${toClassName(parent)}Module {}          
            `
        );
      };

      createDep(parentLib, [childLib, childLib2]);
    });

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
      const parentLibOutput = runCLI(`build ${childLib}`);
      expect(parentLibOutput).toContain(`Built @proj/${childLib}`);
    });

    it('should properly add references to any dependency into the parent package.json', () => {
      const childLibOutput = runCLI(`build ${childLib}`);
      const childLib2Output = runCLI(`build ${childLib2}`);
      const parentLibOutput = runCLI(`build ${parentLib}`);

      expect(childLibOutput).toContain(`Built @proj/${childLib}`);
      expect(childLib2Output).toContain(`Built @proj/${childLib2}`);
      expect(parentLibOutput).toContain(`Built @proj/${parentLib}`);

      const jsonFile = readJson(`dist/libs/${parentLib}/package.json`);
      expect(jsonFile.dependencies).toEqual({
        tslib: '^2.0.0',
        [`@proj/${childLib}`]: '0.0.1',
        [`@proj/${childLib2}`]: '0.0.1',
      });
      expect(jsonFile.peerDependencies['@angular/common']).toBeDefined();
      expect(jsonFile.peerDependencies['@angular/core']).toBeDefined();
    });
  });
});

forEachCli('nx', () => {
  describe('Build Angular library', () => {
    it('should work', async () => {}, 1000000);
  });
});
