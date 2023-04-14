import {
  checkFilesDoNotExist,
  checkFilesExist,
  cleanupProject,
  getSize,
  killPorts,
  newProject,
  readFile,
  readJson,
  rmDist,
  runCLI,
  runCLIAsync,
  tmpProjPath,
  uniq,
  updateFile,
  updateJson,
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
    updateJson('nx.json', (json) => ({
      ...json,
      generators: {
        ...json.generators,
        '@nrwl/react': {
          library: {
            unitTestRunner: 'none',
          },
        },
      },
    }));
    // generate buildable libs
    runCLI(
      `generate @nrwl/react:library ${parentLib} --bundler=rollup --importPath=@${proj}/${parentLib} --no-interactive --unitTestRunner=jest`
    );
    runCLI(
      `generate @nrwl/react:library ${childLib} --bundler=rollup --importPath=@${proj}/${childLib} --no-interactive --unitTestRunner=jest`
    );
    runCLI(
      `generate @nrwl/react:library ${childLib2} --bundler=rollup --importPath=@${proj}/${childLib2} --no-interactive --unitTestRunner=jest`
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
  });

  afterEach(() => {
    killPorts();
    cleanupProject();
  });

  describe('Buildable libraries', () => {
    it('should build libraries with and without dependencies', () => {
      /*
       * 1. Without dependencies
       */
      runCLI(`build ${childLib}`);
      runCLI(`build ${childLib2}`);

      checkFilesExist(`dist/libs/${childLib}/index.js`);

      checkFilesExist(`dist/libs/${childLib2}/index.js`);

      checkFilesExist(`dist/libs/${childLib}/assets/hello.txt`);
      checkFilesExist(`dist/libs/${childLib2}/README.md`);

      /*
       * 2. With dependencies
       */
      runCLI(`build ${parentLib}`);

      checkFilesExist(`dist/libs/${parentLib}/index.js`);

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

      runCLI(`build ${parentLib} --skip-nx-cache`);

      checkFilesExist(`dist/libs/${parentLib}/index.js`);
      checkFilesExist(`dist/libs/${childLib}/index.js`);
      checkFilesExist(`dist/libs/${childLib2}/index.js`);

      expect(readFile(`dist/libs/${childLib}/index.js`)).not.toContain(
        'react/jsx-dev-runtime'
      );
      expect(readFile(`dist/libs/${childLib}/index.js`)).toContain(
        'react/jsx-runtime'
      );
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

      runCLI(`build ${childLib} --format cjs,esm`);

      checkFilesExist(`dist/libs/${childLib}/index.cjs`);
      checkFilesExist(`dist/libs/${childLib}/index.js`);

      const cjsPackageSize = getSize(
        tmpProjPath(`dist/libs/${childLib}/index.cjs`)
      );
      const esmPackageSize = getSize(
        tmpProjPath(`dist/libs/${childLib}/index.js`)
      );

      // This is a loose requirement that ESM should be smaller than CJS output.
      expect(esmPackageSize).toBeLessThanOrEqual(cjsPackageSize);
    });

    it('should preserve the tsconfig target set by user', () => {
      // Setup
      const myLib = uniq('my-lib');
      runCLI(
        `generate @nrwl/react:library ${myLib} --bundler=rollup --publishable --importPath="@mproj/${myLib}" --no-interactive --unitTestRunner=jest`
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
      const content = readFile(`dist/libs/${myLib}/index.js`);

      /**
       * Then check if the result contains this "promise" polyfill?
       */

      expect(content).toContain('function __generator(thisArg, body) {');
    });

    it('should build an app composed out of buildable libs', () => {
      const buildFromSource = runCLI(
        `build ${app} --buildLibsFromSource=false`
      );
      expect(buildFromSource).toContain('Successfully ran target build');
      checkFilesDoNotExist(`apps/${app}/tsconfig/tsconfig.nx-tmp`);
    }, 1000000);

    it('should not create a dist folder if there is an error', async () => {
      const libName = uniq('lib');

      runCLI(
        `generate @nrwl/react:lib ${libName} --bundler=rollup --importPath=@${proj}/${libName} --no-interactive --unitTestRunner=jest`
      );

      const mainPath = `libs/${libName}/src/lib/${libName}.tsx`;
      updateFile(mainPath, `${readFile(mainPath)}\n console.log(a);`); // should error - "a" will be undefined

      await expect(runCLIAsync(`build ${libName}`)).rejects.toThrow(
        /Bundle failed/
      );
      expect(() => {
        checkFilesExist(`dist/libs/${libName}/package.json`);
      }).toThrow();
    }, 250000);
  });
});
