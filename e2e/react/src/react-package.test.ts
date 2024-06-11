import {
  checkFilesExist,
  cleanupProject,
  killPorts,
  newProject,
  readFile,
  rmDist,
  runCLI,
  runCLIAsync,
  uniq,
  updateFile,
  updateJson,
} from '@nx/e2e/utils';
import { names } from '@nx/devkit';
import { join } from 'path';

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

  beforeEach(async () => {
    app = uniq('app');
    parentLib = uniq('parentlib');
    childLib = uniq('childlib');
    childLib2 = uniq('childlib2');

    proj = newProject({ packages: ['@nx/react'] });

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

    runCLI(`generate @nx/react:app ${app} `);
    updateJson('nx.json', (json) => ({
      ...json,
      generators: {
        ...json.generators,
        '@nx/react': {
          library: {
            unitTestRunner: 'none',
          },
        },
      },
    }));
    // generate buildable libs
    runCLI(
      `generate @nx/react:library ${parentLib} --bundler=rollup --importPath=@${proj}/${parentLib} --no-interactive --unitTestRunner=jest --skipFormat`
    );
    runCLI(
      `generate @nx/react:library ${childLib} --bundler=rollup --importPath=@${proj}/${childLib} --no-interactive --unitTestRunner=jest --skipFormat`
    );
    runCLI(
      `generate @nx/react:library ${childLib2} --bundler=rollup --importPath=@${proj}/${childLib2} --no-interactive --unitTestRunner=jest --skipFormat`
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
    updateFile(
      join('libs', childLib, 'rollup.config.js'),
      `const { withNx } = require('@nx/rollup/with-nx');
module.exports = withNx(
  {
    main: './src/index.ts',
    outputPath: '../../dist/libs/${childLib}',
    tsConfig: './tsconfig.lib.json',
    compiler: 'babel',
    external: ['react', 'react-dom', 'react/jsx-runtime'],
    format: ['esm'],
    assets: ['./src/assets'],
  }
);
`
    );
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

      checkFilesExist(`dist/libs/${childLib}/index.esm.js`);

      checkFilesExist(`dist/libs/${childLib2}/index.esm.js`);

      checkFilesExist(`dist/libs/${childLib}/assets/hello.txt`);
      checkFilesExist(`dist/libs/${childLib2}/README.md`);

      /*
       * 2. With dependencies without existing dist
       */
      rmDist();

      runCLI(`build ${parentLib} --skip-nx-cache`);

      checkFilesExist(`dist/libs/${parentLib}/index.esm.js`);
      checkFilesExist(`dist/libs/${childLib}/index.esm.js`);
      checkFilesExist(`dist/libs/${childLib2}/index.esm.js`);

      expect(readFile(`dist/libs/${childLib}/index.esm.js`)).not.toContain(
        'react/jsx-dev-runtime'
      );
      expect(readFile(`dist/libs/${childLib}/index.esm.js`)).toContain(
        'react/jsx-runtime'
      );
    });

    it('should preserve the tsconfig target set by user', () => {
      // Setup
      const myLib = uniq('my-lib');
      runCLI(
        `generate @nx/react:library ${myLib} --bundler=rollup --publishable --importPath="@mproj/${myLib}" --no-interactive --unitTestRunner=jest`
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
         * Set target as es5!!
         */

        json.compilerOptions.target = 'es5';
        return JSON.stringify(json, null, 2);
      });
      // What we're testing
      runCLI(`build ${myLib}`);
      // Assertion
      const content = readFile(`dist/libs/${myLib}/index.esm.js`);

      /**
       * Then check if the result contains this "promise" polyfill?
       */

      expect(content).toContain('function __generator(thisArg, body) {');
    });

    it('should not create a dist folder if there is an error', async () => {
      const libName = uniq('lib');

      runCLI(
        `generate @nx/react:lib ${libName} --bundler=rollup --importPath=@${proj}/${libName} --no-interactive --unitTestRunner=jest`
      );

      const mainPath = `libs/${libName}/src/lib/${libName}.tsx`;
      updateFile(mainPath, `${readFile(mainPath)}\n console.log(a);`); // should error - "a" will be undefined

      await expect(runCLIAsync(`build ${libName}`)).rejects.toThrow(
        /Command failed/
      );
      expect(() => {
        checkFilesExist(`dist/libs/${libName}/package.json`);
      }).toThrow();
    }, 250000);
  });
});
