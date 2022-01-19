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
  it('should create libs and apps with npm scripts', () => {
    const scope = newProject();
    const npmScriptsLib = uniq('npmscriptslib');
    runCLI(`generate @nrwl/js:lib ${npmScriptsLib} --config=npm-scripts`);
    const libPackageJson = readJson(`libs/${npmScriptsLib}/package.json`);
    expect(libPackageJson.scripts.test).toBeDefined();
    expect(libPackageJson.scripts.build).toBeDefined();
    expect(runCLI(`test ${npmScriptsLib}`)).toContain('implement test');
    expect(runCLI(`test ${npmScriptsLib}`)).toContain('match the cache');

    const npmScriptsApp = uniq('npmscriptsapp');
    runCLI(`generate @nrwl/js:app ${npmScriptsApp} --config=npm-scripts`);
    const appPackageJson = readJson(`apps/${npmScriptsApp}/package.json`);
    expect(appPackageJson.scripts.test).toBeDefined();
    expect(appPackageJson.scripts.build).toBeDefined();
    expect(runCLI(`test ${npmScriptsApp}`)).toContain('implement test');
    expect(runCLI(`test ${npmScriptsApp}`)).toContain('match the cache');

    const tsconfig = readJson(`tsconfig.base.json`);
    expect(tsconfig.compilerOptions.paths).toEqual({
      [`@${scope}/${npmScriptsLib}`]: [`libs/${npmScriptsLib}/src/index.ts`],
    });
  }, 120000);

  it('should create libs and apps with js executors (--compiler=tsc)', async () => {
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
      `dist/libs/${lib}/src/lib/${lib}.js`
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

    const app = uniq('app');
    runCLI(`generate @nrwl/js:app ${app} --buildable --compiler=tsc`);
    const appPackageJson = readJson(`apps/${app}/package.json`);
    expect(appPackageJson.scripts).toBeUndefined();
    expect((await runCLIAsync(`test ${app}`)).combinedOutput).toContain(
      'Ran all test suites'
    );
    expect((await runCLIAsync(`test ${app}`)).combinedOutput).toContain(
      'match the cache'
    );

    expect(runCLI(`build ${app}`)).toContain('Done compiling TypeScript files');
    checkFilesExist(
      `dist/apps/${app}/package.json`,
      `dist/apps/${app}/src/index.js`,
      `dist/apps/${app}/src/app/${app}.js`
    );

    expect(runCommand(`node dist/apps/${app}/src/index.js`)).toContain(
      `Running ${app}`
    );

    const tsconfig = readJson(`tsconfig.base.json`);
    expect(tsconfig.compilerOptions.paths).toEqual({
      [`@${scope}/${lib}`]: [`libs/${lib}/src/index.ts`],
    });

    updateFile(`apps/${app}/src/index.ts`, () => {
      return `
        import { ${lib} } from '@${scope}/${lib}'
        console.log('Running ' + ${lib}())
      `;
    });

    const output = runCLI(`build ${app}`);
    expect(output).toContain('1 task(s) that it depends on');
    expect(output).toContain('Done compiling TypeScript files');

    expect(runCLI(`serve ${app} --no-watch`)).toContain(`Running ${lib}`);
  }, 120000);

  // reenable when once ci runs on node 16
  // it('should create libs and apps with js executors (--compiler=swc)', async () => {
  //   const scope = newProject();
  //   const lib = uniq('lib');
  //   runCLI(`generate @nrwl/js:lib ${lib} --buildable --compiler=swc`);
  //   const libPackageJson = readJson(`libs/${lib}/package.json`);
  //   expect(libPackageJson.scripts).toBeUndefined();
  //   expect((await runCLIAsync(`test ${lib}`)).combinedOutput).toContain(
  //     'Ran all test suites'
  //   );
  //   expect((await runCLIAsync(`test ${lib}`)).combinedOutput).toContain(
  //     'match the cache'
  //   );
  //
  //   expect(runCLI(`build ${lib}`)).toContain('Successfully compiled: 2 files with swc');
  //   checkFilesExist(
  //     `dist/libs/${lib}/package.json`,
  //     `dist/libs/${lib}/src/index.js`,
  //     `dist/libs/${lib}/src/lib/${lib}.js`
  //   );
  //
  //   const app = uniq('app');
  //   runCLI(`generate @nrwl/js:app ${app} --buildable --compiler=swc`);
  //   const appPackageJson = readJson(`apps/${app}/package.json`);
  //   expect(appPackageJson.scripts).toBeUndefined();
  //   expect((await runCLIAsync(`test ${app}`)).combinedOutput).toContain(
  //     'Ran all test suites'
  //   );
  //   expect((await runCLIAsync(`test ${app}`)).combinedOutput).toContain(
  //     'match the cache'
  //   );
  //
  //   expect(runCLI(`build ${app}`)).toContain('Successfully compiled: 2 files with swc');
  //   checkFilesExist(
  //     `dist/apps/${app}/package.json`,
  //     `dist/apps/${app}/src/index.js`,
  //     `dist/apps/${app}/src/app/${app}.js`
  //   );
  //
  //   expect(runCommand(`node dist/apps/${app}/src/index.js`)).toContain(
  //     `Running ${app}`
  //   );
  //
  //   const tsconfig = readJson(`tsconfig.base.json`);
  //   expect(tsconfig.compilerOptions.paths).toEqual({
  //     [`@${scope}/${lib}`]: [`libs/${lib}/src/index.ts`],
  //   });
  //
  //   updateFile(`apps/${app}/src/index.ts`, () => {
  //     return `
  //       import { ${lib} } from '@${scope}/${lib}'
  //       console.log('Running ' + ${lib}())
  //     `;
  //   });
  //
  //   const output = runCLI(`build ${app}`);
  //   expect(output).toContain('1 task(s) that it depends on');
  //   expect(output).toContain('Successfully compiled: 2 files with swc');
  //
  // expect(runCommand(`serve ${app} --watch=false`)).toContain(`Running ${lib}`)
  // }, 120000);
});
