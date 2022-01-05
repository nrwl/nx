import {
  checkFilesExist,
  newProject,
  readJson,
  readProjectConfig,
  runCLI,
  runCLIAsync,
  runCommand,
  uniq,
  updateFile,
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

  it('xxxshould create libs and apps with js executors (--compiler=tsc)', async () => {
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
      `dist/libs/${lib}/package.json`,
      `dist/libs/${lib}/src/index.js`,
      `dist/libs/${lib}/src/lib/${lib}.js`
    );

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

    // expect(runCommand(`serve ${app} --watch=false`)).toContain(`Running ${lib}`)
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

  it('should create/build/test js:swc lib', async () => {
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
      `dist/libs/${lib}/src/lib/${lib}.js`
    );
  });

  it('should create/build/test js:swc lib with nested directories', async () => {
    const lib = uniq('lib');
    runCLI(
      `generate @nrwl/js:lib ${lib} --directory=dir --buildable --compiler=swc`
    );

    const libPackageJson = readJson(`libs/dir/${lib}/package.json`);
    expect(libPackageJson.scripts).toBeUndefined();
    expect((await runCLIAsync(`test dir-${lib}`)).combinedOutput).toContain(
      'Ran all test suites'
    );
    expect((await runCLIAsync(`test dir-${lib}`)).combinedOutput).toContain(
      'match the cache'
    );

    expect(runCLI(`build dir-${lib}`)).toContain(
      'Successfully compiled: 2 files with swc'
    );
    checkFilesExist(
      `dist/libs/dir/${lib}/package.json`,
      `dist/libs/dir/${lib}/src/index.js`,
      `dist/libs/dir/${lib}/src/lib/dir-${lib}.js`
    );
  });

  describe('convert js:tsc to js:swc', () => {
    it('should convert apps', async () => {
      const app = uniq('app');
      runCLI(`generate @nrwl/js:app ${app}`);

      let projectConfig = readProjectConfig(app);
      expect(projectConfig.targets['build'].executor).toEqual('@nrwl/js:tsc');

      await runCLIAsync(`generate @nrwl/js:convert-to-swc ${app}`);
      projectConfig = readProjectConfig(app);
      expect(projectConfig.targets['build'].executor).toEqual('@nrwl/js:swc');
    });

    it('should convert libs', async () => {
      const lib = uniq('lib');
      runCLI(`generate @nrwl/js:lib ${lib} --buildable`);

      let projectConfig = readProjectConfig(lib);
      expect(projectConfig.targets['build'].executor).toEqual('@nrwl/js:tsc');

      await runCLIAsync(`generate @nrwl/js:convert-to-swc ${lib}`);
      projectConfig = readProjectConfig(lib);
      expect(projectConfig.targets['build'].executor).toEqual('@nrwl/js:swc');
    });
  });
});
