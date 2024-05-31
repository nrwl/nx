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
    process.env.NX_ADD_PLUGINS = 'false';
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
    updateJson(join('libs', childLib, 'project.json'), (json) => {
      json.targets.build.options.assets = [`libs/${childLib}/src/assets`];
      return json;
    });
    updateFile(`libs/${childLib}/src/assets/hello.txt`, 'Hello World!');
  });

  afterEach(() => {
    killPorts();
    cleanupProject();
    delete process.env.NX_ADD_PLUGINS;
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

      checkFilesExist(`dist/libs/${childLib}/index.cjs.js`);
      checkFilesExist(`dist/libs/${childLib}/index.esm.js`);

      const cjsPackageSize = getSize(
        tmpProjPath(`dist/libs/${childLib}/index.cjs.js`)
      );
      const esmPackageSize = getSize(
        tmpProjPath(`dist/libs/${childLib}/index.esm.js`)
      );

      // This is a loose requirement that ESM should be smaller than CJS output.
      expect(esmPackageSize).toBeLessThanOrEqual(cjsPackageSize);
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
        `generate @nx/react:lib ${libName} --bundler=rollup --importPath=@${proj}/${libName} --no-interactive --unitTestRunner=jest`
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
