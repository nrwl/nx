import {
  checkFilesDoNotExist,
  checkFilesExist,
  getSize,
  killPorts,
  newProject,
  readFile,
  readJson,
  rmDist,
  runCLI,
  tmpProjPath,
  uniq,
  updateFile,
  updateProjectConfig,
} from '@nrwl/e2e/utils';
import { names } from '@nrwl/devkit';

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

  let proj: string;

  beforeEach(() => {
    app = uniq('app');
    parentLib = uniq('parentlib');
    childLib = uniq('childlib');
    childLib2 = uniq('childlib2');

    proj = newProject();

    // create dependencies by importing
    const createDep = (parent, children: string[]) => {
      updateFile(
        `libs/${parent}/src/index.ts`,
        `
        export * from './lib/${parent}';

              ${children
                .map(
                  (entry) =>
                    `import { ${
                      names(entry).className
                    } } from '@${proj}/${entry}'; console.log(${
                      names(entry).className
                    });`
                )
                .join('\n')}
            `
      );
    };

    runCLI(`generate @nrwl/react:app ${app} `);

    // generate publishable libs
    runCLI(
      `generate @nrwl/react:library ${parentLib} --publishable --importPath=@${proj}/${parentLib} --no-interactive `
    );
    runCLI(
      `generate @nrwl/react:library ${childLib} --publishable --importPath=@${proj}/${childLib} --no-interactive `
    );
    runCLI(
      `generate @nrwl/react:library ${childLib2} --publishable --importPath=@${proj}/${childLib2} --no-interactive `
    );

    createDep(parentLib, [childLib, childLib2]);

    updateFile(
      `apps/${app}/src/main.tsx`,
      `
        import {${names(parentLib).className}} from "@${proj}/${parentLib}";
        console.log(${names(parentLib).className});
        `
    );

    // Add assets to child lib
    updateProjectConfig(childLib, (json) => {
      json.targets.build.options.assets = [`libs/${childLib}/src/assets`];
      return json;
    });
    updateFile(`libs/${childLib}/src/assets/hello.txt`, 'Hello World!');

    // we are setting paths to {} to make sure built libs are read from dist
    updateFile('tsconfig.base.json', (c) => {
      const json = JSON.parse(c);
      json.compilerOptions.paths = {};
      return JSON.stringify(json, null, 2);
    });
  });

  afterEach(() => killPorts());

  describe('Publishable libraries', () => {
    it('should build libraries with and without dependencies', () => {
      /*
       * 1. Without dependencies
       */
      runCLI(`build ${childLib}`);
      runCLI(`build ${childLib2}`);

      checkFilesExist(`dist/libs/${childLib}/${childLib}.esm.js`);
      checkFilesExist(`dist/libs/${childLib}/${childLib}.umd.js`);

      checkFilesExist(`dist/libs/${childLib2}/${childLib2}.esm.js`);
      checkFilesExist(`dist/libs/${childLib2}/${childLib2}.umd.js`);

      checkFilesExist(`dist/libs/${childLib}/assets/hello.txt`);
      checkFilesExist(`dist/libs/${childLib2}/README.md`);

      /*
       * 2. With dependencies
       */
      runCLI(`build ${parentLib}`);

      checkFilesExist(`dist/libs/${parentLib}/${parentLib}.esm.js`);
      checkFilesExist(`dist/libs/${parentLib}/${parentLib}.umd.js`);

      const jsonFile = readJson(`dist/libs/${parentLib}/package.json`);
      expect(jsonFile.peerDependencies).toEqual(
        expect.objectContaining({
          [`@${proj}/${childLib}`]: '0.0.1',
          [`@${proj}/${childLib2}`]: '0.0.1',
        })
      );

      /*
       * 3. With dependencies without existing dist
       */
      rmDist();

      runCLI(`build ${parentLib} --with-deps --skip-nx-cache`);

      checkFilesExist(`dist/libs/${parentLib}/${parentLib}.esm.js`);
      checkFilesExist(`dist/libs/${childLib}/${childLib}.esm.js`);
      checkFilesExist(`dist/libs/${childLib2}/${childLib2}.esm.js`);
    });

    it('should support --format option', () => {
      updateFile(
        `libs/${childLib}/src/index.ts`,
        (s) => `${s}
export async function f() { return 'a'; }
export async function g() { return 'b'; }
export async function h() { return 'c'; }
`
      );

      runCLI(`build ${childLib} --format cjs,esm,umd`);

      checkFilesExist(`dist/libs/${childLib}/${childLib}.cjs.js`);
      checkFilesExist(`dist/libs/${childLib}/${childLib}.esm.js`);
      checkFilesExist(`dist/libs/${childLib}/${childLib}.umd.js`);

      const cjsPackageSize = getSize(
        tmpProjPath(`dist/libs/${childLib}/${childLib}.cjs.js`)
      );
      const esmPackageSize = getSize(
        tmpProjPath(`dist/libs/${childLib}/${childLib}.esm.js`)
      );
      const umdPackageSize = getSize(
        tmpProjPath(`dist/libs/${childLib}/${childLib}.umd.js`)
      );

      // This is a loose requirement that ESM and CJS packages should be less than the UMD counterpart.
      expect(esmPackageSize).toBeLessThanOrEqual(umdPackageSize);
      expect(cjsPackageSize).toBeLessThanOrEqual(umdPackageSize);
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

    it('should build an app composed out of publishable libs', () => {
      const buildWithDeps = runCLI(
        `build ${app} --with-deps --buildLibsFromSource=false`
      );
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
});
