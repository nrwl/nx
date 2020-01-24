import { toClassName } from '@nrwl/workspace';
import {
  ensureProject,
  forEachCli,
  readJson,
  runCLI,
  uniq,
  updateFile
} from './utils';

forEachCli('angular', cli => {
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

      ensureProject();

      runCLI(
        `generate @nrwl/angular:library ${parentLib} --publishable=true --no-interactive`
      );
      runCLI(
        `generate @nrwl/angular:library ${childLib} --publishable=true --no-interactive`
      );
      runCLI(
        `generate @nrwl/angular:library ${childLib2} --publishable=true --no-interactive`
      );

      // create dependencies by importing
      const createDep = (parent, children: string[]) => {
        updateFile(
          `libs/${parent}/src/lib/${parent}.module.ts`,
          `
              import { NgModule } from '@angular/core';
              import { CommonModule } from '@angular/common';
              ${children
                .map(
                  entry =>
                    `import { ${toClassName(
                      entry
                    )}Module } from '@proj/${entry}';`
                )
                .join('\n')}
              
              @NgModule({
                imports: [CommonModule, ${children
                  .map(entry => `${toClassName(entry)}Module`)
                  .join(',')}]
              })
              export class ${toClassName(parent)}Module {}          
            `
        );
      };
      debugger;

      createDep(parentLib, [childLib, childLib2]);
    });

    it('should throw an error if the dependent library has not been built before building the parent lib', () => {
      expect.assertions(2);

      try {
        runCLI(`build ${parentLib}`);
      } catch (e) {
        expect(e.stderr.toString()).toContain(
          `Some of the library ${parentLib}'s dependencies have not been built yet. Please build these libraries before:`
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

      // assert package.json deps have been set
      const assertPackageJson = (
        parent: string,
        lib: string,
        version: string
      ) => {
        const jsonFile = readJson(`dist/libs/${parent}/package.json`);
        const childDependencyVersion = jsonFile.dependencies[`@proj/${lib}`];
        expect(childDependencyVersion).toBe(version);
      };

      assertPackageJson(parentLib, childLib, '0.0.1');
      assertPackageJson(parentLib, childLib2, '0.0.1');
    });
  });
});
