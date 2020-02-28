import {
  ensureProject,
  forEachCli,
  readJson,
  runCLI,
  uniq,
  updateFile
} from './utils';

forEachCli('nx', cli => {
  describe('Build React library', () => {
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
        `generate @nrwl/react:library ${parentLib} --publishable=true --no-interactive`
      );
      runCLI(
        `generate @nrwl/react:library ${childLib} --publishable=true --no-interactive`
      );
      runCLI(
        `generate @nrwl/react:library ${childLib2} --publishable=true --no-interactive`
      );

      // create dependencies by importing
      const createDep = (parent, children: string[]) => {
        updateFile(
          `libs/${parent}/src/lib/${parent}.tsx`,
          `
              ${children.map(entry => `import '@proj/${entry}';`).join('\n')}

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
      const output = runCLI(`build ${childLib}`);
      expect(output).toContain(`${childLib}.esm5.js`);
      expect(output).toContain(`Bundle complete`);
    });

    fit('should properly add references to any dependency into the parent package.json', () => {
      const childLibOutput = runCLI(`build ${childLib}`);
      const childLib2Output = runCLI(`build ${childLib2}`);
      const parentLibOutput = runCLI(`build ${parentLib}`);

      expect(childLibOutput).toContain(`${childLib}.esm.js`);
      expect(childLibOutput).toContain(`${childLib}.umd.js`);
      expect(childLibOutput).toContain(`Bundle complete`);

      expect(childLib2Output).toContain(`${childLib2}.esm.js`);
      expect(childLib2Output).toContain(`${childLib2}.umd.js`);
      expect(childLib2Output).toContain(`Bundle complete`);

      expect(parentLibOutput).toContain(`${parentLib}.esm.js`);
      expect(parentLibOutput).toContain(`${parentLib}.umd.js`);
      expect(parentLibOutput).toContain(`Bundle complete`);

      const jsonFile = readJson(`dist/libs/${parentLib}/package.json`);
      expect(jsonFile.dependencies).toEqual({
        [`@proj/${childLib}`]: '0.0.1',
        [`@proj/${childLib2}`]: '0.0.1'
      });
    });
  });
});

forEachCli('angular', () => {
  describe('Build Angular library', () => {
    it('should work', async () => {}, 1000000);
  });
});
