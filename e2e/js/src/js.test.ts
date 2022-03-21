import {
  checkFilesExist,
  newProject,
  readFile,
  readJson,
  runCLI,
  runCLIAsync,
  runCommand,
  runCommandUntil,
  uniq,
  updateFile,
  updateJson,
  waitUntil,
} from '../../utils';

describe('js e2e', () => {
  it('should create libs with npm scripts', () => {
    const scope = newProject();
    const npmScriptsLib = uniq('npmscriptslib');
    runCLI(`generate @nrwl/js:lib ${npmScriptsLib} --config=npm-scripts`);
    const libPackageJson = readJson(`libs/${npmScriptsLib}/package.json`);
    expect(libPackageJson.scripts.test).toBeDefined();
    expect(libPackageJson.scripts.build).toBeDefined();
    expect(runCLI(`test ${npmScriptsLib}`)).toContain('implement test');
    expect(runCLI(`test ${npmScriptsLib}`)).toContain('match the cache');

    const tsconfig = readJson(`tsconfig.base.json`);
    expect(tsconfig.compilerOptions.paths).toEqual({
      [`@${scope}/${npmScriptsLib}`]: [`libs/${npmScriptsLib}/src/index.ts`],
    });
  }, 120000);

  it('should create libs with js executors (--compiler=tsc)', async () => {
    const scope = newProject();
    const lib = uniq('lib');
    runCLI(`generate @nrwl/js:lib ${lib} --buildable --compiler=tsc`);
    const libPackageJson = readJson(`libs/${lib}/package.json`);
    expect(libPackageJson.scripts).toBeUndefined();
    expect((await runCLIAsync(`test ${lib}`)).combinedOutput).toContain(
      'Ran all test suites'
    );
    expect((await runCLIAsync(`test ${lib}`)).combinedOutput).toContain(
      'match the cache'
    );

    expect(runCLI(`build ${lib}`)).toContain('Done compiling TypeScript files');
    checkFilesExist(
      `dist/libs/${lib}/README.md`,
      `dist/libs/${lib}/package.json`,
      `dist/libs/${lib}/src/index.js`,
      `dist/libs/${lib}/src/lib/${lib}.js`,
      `dist/libs/${lib}/src/index.d.ts`,
      `dist/libs/${lib}/src/lib/${lib}.d.ts`
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
    runCLI(`generate @nrwl/js:lib ${parentLib} --buildable --compiler=tsc`);
    const parentLibPackageJson = readJson(`libs/${parentLib}/package.json`);
    expect(parentLibPackageJson.scripts).toBeUndefined();
    expect((await runCLIAsync(`test ${parentLib}`)).combinedOutput).toContain(
      'Ran all test suites'
    );
    expect((await runCLIAsync(`test ${parentLib}`)).combinedOutput).toContain(
      'match the cache'
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
    expect(output).toContain('1 task(s) it depends on');
    expect(output).toContain('Done compiling TypeScript files');
  }, 120000);

  it('should create libs with js executors (--compiler=swc)', async () => {
    const scope = newProject();
    const lib = uniq('lib');
    runCLI(`generate @nrwl/js:lib ${lib} --buildable --compiler=swc`);
    const libPackageJson = readJson(`libs/${lib}/package.json`);
    expect(libPackageJson.scripts).toBeUndefined();
    expect((await runCLIAsync(`test ${lib}`)).combinedOutput).toContain(
      'Ran all test suites'
    );
    expect((await runCLIAsync(`test ${lib}`)).combinedOutput).toContain(
      'match the cache'
    );

    expect(runCLI(`build ${lib}`)).toContain(
      'Successfully compiled: 2 files with swc'
    );
    checkFilesExist(
      `dist/libs/${lib}/package.json`,
      `dist/libs/${lib}/src/index.js`,
      `dist/libs/${lib}/src/lib/${lib}.js`,
      `dist/libs/${lib}/src/index.d.ts`,
      `dist/libs/${lib}/src/lib/${lib}.d.ts`
    );

    const parentLib = uniq('parentlib');
    runCLI(`generate @nrwl/js:lib ${parentLib} --buildable --compiler=swc`);
    const parentLibPackageJson = readJson(`libs/${parentLib}/package.json`);
    expect(parentLibPackageJson.scripts).toBeUndefined();
    expect((await runCLIAsync(`test ${parentLib}`)).combinedOutput).toContain(
      'Ran all test suites'
    );
    expect((await runCLIAsync(`test ${parentLib}`)).combinedOutput).toContain(
      'match the cache'
    );

    expect(runCLI(`build ${parentLib}`)).toContain(
      'Successfully compiled: 2 files with swc'
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
        import { ${lib} } from '@${scope}/${lib}';
        export * from './lib/${parentLib}';
      `;
    });

    const output = runCLI(`build ${parentLib}`);
    expect(output).toContain('1 task(s) it depends on');
    expect(output).toContain('Successfully compiled: 2 files with swc');
  }, 120000);
});
