import {
  checkFilesDoNotExist,
  checkFilesExist,
  newProject,
  readFile,
  readJson,
  runCLI,
  uniq,
  updateFile,
} from '@nrwl/e2e/utils';

describe('Build React libraries and apps', () => {
  /**
   * Graph:
   *
   *                      childLib
   *                     /
   * app => parentLib =>
   *                    \
   *                     childLib2
   *
   */
  let app: string;
  let parentLib: string;
  let childLib: string;
  let childLib2: string;

  beforeEach(() => {
    app = uniq('app');
    parentLib = uniq('parentlib');
    childLib = uniq('childlib');
    childLib2 = uniq('childlib2');

    newProject();

    runCLI(`generate @nrwl/react:app ${app}`);

    runCLI(
      `generate @nrwl/react:library ${parentLib} --publishable --importPath=@proj/${parentLib} --no-interactive`
    );
    runCLI(
      `generate @nrwl/react:library ${childLib} --publishable --importPath=@proj/${childLib} --no-interactive`
    );
    runCLI(
      `generate @nrwl/react:library ${childLib2} --publishable --importPath=@proj/${childLib2} --no-interactive`
    );

    // create dependencies by importing
    const createDep = (parent, children: string[]) => {
      updateFile(
        `libs/${parent}/src/lib/${parent}.tsx`,
        `
              ${children.map((entry) => `import '@proj/${entry}';`).join('\n')}

            `
      );
    };

    createDep(parentLib, [childLib, childLib2]);

    updateFile(
      `apps/${app}/src/main.tsx`,
      `
        import "@proj/${parentLib}";
        `
    );

    // we are setting paths to {} to make sure built libs are read from dist
    updateFile('tsconfig.base.json', (c) => {
      const json = JSON.parse(c);
      json.compilerOptions.paths = {};
      return JSON.stringify(json, null, 2);
    });

    // Add assets to child lib
    updateFile('workspace.json', (c) => {
      const json = JSON.parse(c);
      json.projects[childLib].architect.build.options.assets = [
        `libs/${childLib}/src/assets`,
      ];
      return JSON.stringify(json, null, 2);
    });
    updateFile(`libs/${childLib}/src/assets/hello.txt`, 'Hello World!');
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

  it('should preserve the tsconfig target set by user', () => {
    // Setup
    const myLib = uniq('my-lib');
    runCLI(
      `generate @nrwl/react:library ${myLib} --publishable=true --importPath="@mproj/${myLib}" --no-interactive`
    );

    /**
     *
     * Here I update my library file
     * I am just adding this in the end:
     *
     * export const TestFunction = async () => {
     *     return await Promise.resolve('Done!')
     * }
     *
     * So that I can see the change in the Promise.
     *
     */

    updateFile(`libs/${myLib}/src/lib/${myLib}.tsx`, (content) => {
      return `
        ${content} \n
          export const TestFunction = async () => {
               return await Promise.resolve('Done!')
          }
        `;
    });

    updateFile(`libs/${myLib}/tsconfig.json`, (content) => {
      const json = JSON.parse(content);

      /**
       * Set target as es3!!
       */

      json.compilerOptions.target = 'es3';
      return JSON.stringify(json, null, 2);
    });
    // What we're testing
    runCLI(`build ${myLib}`);
    // Assertion
    const content = readFile(`dist/libs/${myLib}/${myLib}.esm.js`);

    /**
     * Then check if the result contains this "promise" polyfill?
     */

    expect(content).toContain('function __generator(thisArg, body) {');
  });

  it('should build the library when it does not have any deps', () => {
    const output = runCLI(`build ${childLib}`);
    expect(output).toContain(`${childLib}.esm.js`);
    expect(output).toContain(`Bundle complete`);
    checkFilesExist(`dist/libs/${childLib}/assets/hello.txt`);
  });

  it('should copy the README to dist', () => {
    const output = runCLI(`build ${childLib2}`);
    expect(output).toContain(`Bundle complete`);
    checkFilesExist(`dist/libs/${childLib2}/README.md`);
  });

  it('should properly add references to any dependency into the parent package.json', () => {
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
    expect(jsonFile.peerDependencies).toEqual(
      expect.objectContaining({
        [`@proj/${childLib}`]: '0.0.1',
        [`@proj/${childLib2}`]: '0.0.1',
        react: expect.anything(),
      })
    );
  });

  it('should build an app composed out of buildable libs', () => {
    const buildWithDeps = runCLI(`build ${app} --with-deps`);
    expect(buildWithDeps).toContain(`Running target "build" succeeded`);
    checkFilesDoNotExist(`apps/${app}/tsconfig/tsconfig.nx-tmp`);

    // we remove all path mappings from the root tsconfig, so when trying to build
    // libs from source, the builder will throw
    const failedBuild = runCLI(
      `build ${app} --with-deps --buildLibsFromSource`,
      { silenceError: true }
    );
    expect(failedBuild).toContain(`Can't resolve`);
  }, 1000000);
});
