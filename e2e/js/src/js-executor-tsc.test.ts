import {
  checkFilesDoNotExist,
  checkFilesExist,
  cleanupProject,
  createFile,
  detectPackageManager,
  getPackageManagerCommand,
  newProject,
  packageManagerLockFile,
  readFile,
  readJson,
  rmDist,
  runCLI,
  runCLIAsync,
  runCommand,
  runCommandUntil,
  tmpProjPath,
  uniq,
  updateFile,
  updateJson,
  waitUntil,
} from '../../utils';

describe('js:tsc executor', () => {
  let scope;
  beforeAll(() => (scope = newProject()));
  afterAll(() => cleanupProject());

  it('should create libs with js executors (--compiler=tsc)', async () => {
    const lib = uniq('lib');
    runCLI(`generate @nx/js:lib ${lib} --bundler=tsc --no-interactive`);
    const libPackageJson = readJson(`libs/${lib}/package.json`);
    expect(libPackageJson.scripts).toBeUndefined();

    expect(runCLI(`build ${lib}`)).toContain('Done compiling TypeScript files');
    checkFilesExist(
      `dist/libs/${lib}/README.md`,
      `dist/libs/${lib}/package.json`,
      `dist/libs/${lib}/src/index.js`,
      `dist/libs/${lib}/src/lib/${lib}.js`,
      `dist/libs/${lib}/src/index.d.ts`,
      `dist/libs/${lib}/src/lib/${lib}.d.ts`
    );

    runCLI(`build ${lib} --generateLockfile=true`);
    checkFilesExist(
      `dist/libs/${lib}/package.json`,
      `dist/libs/${lib}/${
        packageManagerLockFile[detectPackageManager(tmpProjPath())]
      }`
    );

    updateJson(`libs/${lib}/project.json`, (json) => {
      json.targets.build.options.assets.push({
        input: `libs/${lib}/docs`,
        glob: '**/*.md',
        output: 'docs',
      });
      return json;
    });
    const libBuildProcess = await runCommandUntil(
      `build ${lib} --watch`,
      (output) => output.includes(`Watching for file changes`),
      {
        env: {
          NX_DAEMON: 'true',
        },
      }
    );
    updateFile(`libs/${lib}/README.md`, `Hello, World!`);
    updateJson(`libs/${lib}/package.json`, (json) => {
      json.version = '999.9.9';
      return json;
    });
    updateFile(`libs/${lib}/docs/a/b/nested.md`, 'Nested File');
    await expect(
      waitUntil(
        () => readFile(`dist/libs/${lib}/README.md`).includes(`Hello, World!`),
        {
          timeout: 20_000,
          ms: 500,
        }
      )
    ).resolves.not.toThrow();
    await expect(
      waitUntil(
        () =>
          readFile(`dist/libs/${lib}/docs/a/b/nested.md`).includes(
            `Nested File`
          ),
        {
          timeout: 20_000,
          ms: 500,
        }
      )
    ).resolves.not.toThrow();
    await expect(
      waitUntil(
        () =>
          readFile(`dist/libs/${lib}/package.json`).includes(
            `"version": "999.9.9"`
          ),
        {
          timeout: 20_000,
          ms: 500,
        }
      )
    ).resolves.not.toThrow();
    libBuildProcess.kill();

    const parentLib = uniq('parentlib');
    runCLI(`generate @nx/js:lib ${parentLib} --bundler=tsc --no-interactive`);
    const parentLibPackageJson = readJson(`libs/${parentLib}/package.json`);
    expect(parentLibPackageJson.scripts).toBeUndefined();
    expect((await runCLIAsync(`test ${parentLib}`)).combinedOutput).toContain(
      'Ran all test suites'
    );

    expect(runCLI(`build ${parentLib}`)).toContain(
      'Done compiling TypeScript files'
    );
    checkFilesExist(
      `dist/libs/${parentLib}/package.json`,
      `dist/libs/${parentLib}/src/index.js`,
      `dist/libs/${parentLib}/src/lib/${parentLib}.js`,
      `dist/libs/${parentLib}/src/index.d.ts`,
      `dist/libs/${parentLib}/src/lib/${parentLib}.d.ts`
    );

    const tsconfig = readJson(`tsconfig.base.json`);
    expect(tsconfig.compilerOptions.paths).toEqual({
      [`@${scope}/${lib}`]: [`libs/${lib}/src/index.ts`],
      [`@${scope}/${parentLib}`]: [`libs/${parentLib}/src/index.ts`],
    });

    updateFile(`libs/${parentLib}/src/index.ts`, () => {
      return `
        import { ${lib} } from '@${scope}/${lib}'
        export * from './lib/${parentLib}';
      `;
    });

    const output = runCLI(`build ${parentLib}`);
    expect(output).toContain('1 task it depends on');
    expect(output).toContain('Done compiling TypeScript files');

    updateJson(`libs/${lib}/tsconfig.json`, (json) => {
      json.compilerOptions = { ...json.compilerOptions, importHelpers: true };
      return json;
    });

    updateJson(`libs/${lib}/package.json`, (json) => {
      // Delete automatically generated helper dependency to test legacy behavior.
      delete json.dependencies.tslib;
      return json;
    });

    // check batch build
    rmDist();
    let batchBuildOutput = runCLI(`build ${parentLib} --skip-nx-cache`, {
      env: { NX_BATCH_MODE: 'true' },
    });

    expect(batchBuildOutput).toContain(`Running 2 tasks with @nx/js:tsc`);
    expect(batchBuildOutput).toContain(
      `Compiling TypeScript files for project "${lib}"...`
    );
    expect(batchBuildOutput).toContain(
      `Done compiling TypeScript files for project "${lib}".`
    );
    expect(batchBuildOutput).toContain(
      `Compiling TypeScript files for project "${parentLib}"...`
    );
    expect(batchBuildOutput).toContain(
      `Done compiling TypeScript files for project "${parentLib}".`
    );
    expect(batchBuildOutput).toContain(
      `Successfully ran target build for project ${parentLib} and 1 task it depends on`
    );

    batchBuildOutput = runCLI(`build ${parentLib} --skip-nx-cache --batch`);
    expect(batchBuildOutput).toContain(`Running 2 tasks with @nx/js:tsc`);

    checkFilesExist(
      // parent
      `dist/libs/${parentLib}/package.json`,
      `dist/libs/${parentLib}/README.md`,
      `dist/libs/${parentLib}/tsconfig.tsbuildinfo`,
      `dist/libs/${parentLib}/src/index.js`,
      `dist/libs/${parentLib}/src/index.d.ts`,
      `dist/libs/${parentLib}/src/lib/${parentLib}.js`,
      `dist/libs/${parentLib}/src/lib/${parentLib}.d.ts`,
      // child
      `dist/libs/${lib}/package.json`,
      `dist/libs/${lib}/README.md`,
      `dist/libs/${lib}/tsconfig.tsbuildinfo`,
      `dist/libs/${lib}/src/index.js`,
      `dist/libs/${lib}/src/index.d.ts`,
      `dist/libs/${lib}/src/lib/${lib}.js`,
      `dist/libs/${lib}/src/lib/${lib}.d.ts`
    );

    // run a second time skipping the nx cache and with the outputs present
    const secondBatchBuildOutput = runCLI(
      `build ${parentLib} --skip-nx-cache`,
      { env: { NX_BATCH_MODE: 'true' } }
    );
    expect(secondBatchBuildOutput).toContain(
      `Successfully ran target build for project ${parentLib} and 1 task it depends on`
    );
  }, 240_000);

  it('should not create a `.babelrc` file when creating libs with js executors (--compiler=tsc)', () => {
    const lib = uniq('lib');
    runCLI(
      `generate @nx/js:lib ${lib} --compiler=tsc --includeBabelRc=false --no-interactive`
    );

    checkFilesDoNotExist(`libs/${lib}/.babelrc`);
  });

  it('should allow wildcard ts path alias', async () => {
    const base = uniq('base');
    runCLI(`generate @nx/js:lib ${base} --bundler=tsc --no-interactive`);

    const lib = uniq('lib');
    runCLI(`generate @nx/js:lib ${lib} --bundler=tsc --no-interactive`);

    updateFile(`libs/${base}/src/index.ts`, () => {
      return `
        import { ${lib} } from '@${scope}/${lib}'
        export * from './lib/${base}';

        ${lib}();
      `;
    });

    expect(runCLI(`build ${base}`)).toContain(
      'Done compiling TypeScript files'
    );

    updateJson('tsconfig.base.json', (json) => {
      json['compilerOptions']['paths'][`@${scope}/${lib}/*`] = [
        `libs/${lib}/src/*`,
      ];
      return json;
    });

    createFile(
      `libs/${lib}/src/${lib}.ts`,
      `
export function ${lib}Wildcard() {
  return '${lib}-wildcard';
};
    `
    );

    updateFile(`libs/${base}/src/index.ts`, () => {
      return `
        import { ${lib} } from '@${scope}/${lib}';
        import { ${lib}Wildcard } from '@${scope}/${lib}/src/${lib}';
        export * from './lib/${base}';

        ${lib}();
        ${lib}Wildcard();
      `;
    });

    expect(runCLI(`build ${base}`)).toContain(
      'Done compiling TypeScript files'
    );
  }, 240_000);

  it('should update package.json with detected dependencies', async () => {
    const pmc = getPackageManagerCommand();
    const lib = uniq('lib');
    runCLI(`generate @nx/js:lib ${lib} --bundler=tsc --no-interactive`);

    // Add a dependency for this lib to check the built package.json
    runCommand(`${pmc.addProd} react`);
    runCommand(`${pmc.addDev} @types/react`);
    updateFile(`libs/${lib}/src/index.ts`, (content) => {
      return `
        import 'react';
        ${content};
    `;
    });
  }, 240_000);
});
