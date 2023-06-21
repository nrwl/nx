import { satisfies } from 'semver';
import {
  checkFilesDoNotExist,
  checkFilesExist,
  cleanupProject,
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

describe('js e2e', () => {
  let scope;

  beforeEach(() => (scope = newProject()));
  afterEach(() => cleanupProject());

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
      (output) => output.includes(`Watching for file changes`)
    );
    updateFile(`libs/${lib}/README.md`, `Hello, World!`);
    updateJson(`libs/${lib}/package.json`, (json) => {
      json.version = '999.9.9';
      return json;
    });
    updateFile(`libs/${lib}/docs/a/b/nested.md`, 'Nested File');
    await expect(
      waitUntil(() =>
        readFile(`dist/libs/${lib}/README.md`).includes(`Hello, World!`)
      )
    ).resolves.not.toThrow();
    await expect(
      waitUntil(() =>
        readFile(`dist/libs/${lib}/docs/a/b/nested.md`).includes(`Nested File`)
      )
    ).resolves.not.toThrow();
    await expect(
      waitUntil(() =>
        readFile(`dist/libs/${lib}/package.json`).includes(
          `"version": "999.9.9"`
        )
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

    runCLI(`build ${lib}`);

    const rootPackageJson = readJson(`package.json`);

    expect(readJson(`dist/libs/${lib}/package.json`)).toHaveProperty(
      'peerDependencies.tslib'
    );

    updateJson(`libs/${lib}/tsconfig.json`, (json) => {
      json.compilerOptions = { ...json.compilerOptions, importHelpers: false };
      return json;
    });

    runCLI(`build ${lib}`);

    expect(readJson(`dist/libs/${lib}/package.json`)).not.toHaveProperty(
      'peerDependencies.tslib'
    );

    // check batch build
    rmDist();
    const batchBuildOutput = runCLI(`build ${parentLib} --skip-nx-cache`, {
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
  }, 240_000);

  it('should not create a `.babelrc` file when creating libs with js executors (--compiler=tsc)', () => {
    const lib = uniq('lib');
    runCLI(
      `generate @nx/js:lib ${lib} --compiler=tsc --includeBabelRc=false --no-interactive`
    );

    checkFilesDoNotExist(`libs/${lib}/.babelrc`);
  });
});

describe('package.json updates', () => {
  beforeEach(() => newProject({ name: 'proj', packageManager: 'npm' }));

  afterEach(() => cleanupProject());

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

    runCLI(`build ${lib}`);

    // Check that only 'react' exists, don't care about version
    expect(readJson(`dist/libs/${lib}/package.json`).dependencies).toEqual({
      react: expect.any(String),
    });
    expect(readJson(`dist/libs/${lib}/package.json`).peerDependencies).toEqual({
      tslib: expect.any(String),
    });
    checkFilesDoNotExist(`dist/libs/${lib}/${packageManagerLockFile['npm']}`);
  }, 240_000);
});
