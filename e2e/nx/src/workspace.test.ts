import {
  checkFilesExist,
  cleanupProject,
  exists,
  getPackageManagerCommand,
  getSelectedPackageManager,
  newProject,
  readFile,
  readJson,
  runCLI,
  runCommand,
  runE2ETests,
  tmpProjPath,
  uniq,
  updateFile,
  updateJson,
} from '@nx/e2e/utils';
import { join } from 'path';

let proj: string;

describe('@nx/workspace:infer-targets', () => {
  beforeEach(() => {
    proj = newProject({
      packages: ['@nx/playwright', '@nx/remix', '@nx/eslint', '@nx/jest'],
    });
  });

  afterEach(() => cleanupProject());

  it('should run or skip conversions depending on whether executors are present', async () => {
    // default case, everything is generated with crystal, everything should be skipped
    const remixApp = uniq('remix');
    runCLI(
      `generate @nx/remix:app apps/${remixApp} --unitTestRunner jest --e2eTestRunner=playwright --projectNameAndDirectoryFormat=as-provided --no-interactive`
    );

    const output = runCLI(`generate infer-targets --no-interactive`);

    expect(output).toContain('@nx/remix:convert-to-inferred - Skipped');
    expect(output).toContain('@nx/playwright:convert-to-inferred - Skipped');
    expect(output).toContain('@nx/eslint:convert-to-inferred - Skipped');
    expect(output).toContain('@nx/jest:convert-to-inferred - Skipped');

    // if we make sure there are executors to convert, conversions will run
    updateJson('nx.json', (json) => {
      json.plugins = [];
      return json;
    });

    updateJson(join('apps', remixApp, 'project.json'), (json) => {
      json.targets = {
        build: {
          executor: '@nx/remix:build',
        },
        lint: {
          executor: '@nx/eslint:lint',
        },
      };
      return json;
    });

    const output2 = runCLI(`generate infer-targets --no-interactive`);

    expect(output2).toContain('@nx/remix:convert-to-inferred - Success');
    expect(output2).toContain('@nx/eslint:convert-to-inferred - Success');
  });

  it('should run or skip only specific conversions if --plugins is passed', async () => {
    // default case, everything is generated with crystal, relevant plugins should be skipped
    const remixApp = uniq('remix');
    runCLI(
      `generate @nx/remix:app apps/${remixApp} --unitTestRunner jest --e2eTestRunner=playwright --projectNameAndDirectoryFormat=as-provided --no-interactive`
    );

    const output = runCLI(
      `generate infer-targets --plugins=@nx/eslint,@nx/jest --no-interactive`
    );

    expect(output).toContain('@nx/eslint:convert-to-inferred - Skipped');
    expect(output).toContain('@nx/jest:convert-to-inferred - Skipped');

    expect(output).not.toContain('@nx/remix');
    expect(output).not.toContain('@nx/playwright');

    // if we make sure there are executors to convert, relevant conversions will run
    updateJson('nx.json', (json) => {
      json.plugins = [];
      return json;
    });

    updateJson(join('apps', remixApp, 'project.json'), (json) => {
      json.targets = {
        build: {
          executor: '@nx/remix:build',
        },
        lint: {
          executor: '@nx/eslint:lint',
        },
      };
      return json;
    });

    const output2 = runCLI(
      `generate infer-targets --plugins=@nx/remix,@nx/eslint --no-interactive`
    );

    expect(output2).toContain('@nx/remix:convert-to-inferred - Success');
    expect(output2).toContain('@nx/eslint:convert-to-inferred - Success');

    expect(output2).not.toContain('@nx/jest');
    expect(output2).not.toContain('@nx/playwright');
  });

  it('should run only specific conversions for a specific project if --project is passed', async () => {
    // even if we make sure there are executors for remix & remix-e2e, only remix conversions will run with --project option
    const remixApp = uniq('remix');
    runCLI(
      `generate @nx/remix:app apps/${remixApp} --unitTestRunner jest --e2eTestRunner=playwright --projectNameAndDirectoryFormat=as-provided --no-interactive`
    );

    updateJson('nx.json', (json) => {
      json.plugins = [];
      return json;
    });

    updateJson(join('apps', remixApp, 'project.json'), (json) => {
      json.targets = {
        build: {
          executor: '@nx/remix:build',
        },
        lint: {
          executor: '@nx/eslint:lint',
        },
      };
      return json;
    });

    updateJson(join('apps', `${remixApp}-e2e`, 'project.json'), (json) => {
      json.targets = {
        e2e: {
          executor: '@nx/playwright:playwright',
        },
      };
      return json;
    });

    const output2 = runCLI(
      `generate infer-targets --project ${remixApp}  --no-interactive`
    );

    expect(output2).toContain('@nx/remix:convert-to-inferred - Success');
    expect(output2).toContain('@nx/eslint:convert-to-inferred - Success');

    expect(output2).toContain('@nx/jest:convert-to-inferred - Skipped');
    expect(output2).toContain('@nx/playwright:convert-to-inferred - Skipped');
  });
});

describe('@nx/workspace:convert-to-monorepo', () => {
  beforeEach(() => {
    proj = newProject({ packages: ['@nx/react', '@nx/js'] });
  });

  afterEach(() => cleanupProject());

  it('should be convert a standalone vite and playwright react project to a monorepo', async () => {
    const reactApp = uniq('reactapp');
    runCLI(
      `generate @nx/react:app --name=${reactApp} --directory="." --rootProject=true --bundler=vite --unitTestRunner vitest --e2eTestRunner=playwright --no-interactive`
    );

    runCLI('generate @nx/workspace:convert-to-monorepo --no-interactive');

    checkFilesExist(
      `apps/${reactApp}/src/main.tsx`,
      `apps/e2e/playwright.config.ts`
    );

    expect(() => runCLI(`build ${reactApp}`)).not.toThrow();
    expect(() => runCLI(`test ${reactApp}`)).not.toThrow();
    expect(() => runCLI(`lint ${reactApp}`)).not.toThrow();
    expect(() => runCLI(`lint e2e`)).not.toThrow();
    if (runE2ETests()) {
      expect(() => runCLI(`e2e e2e`)).not.toThrow();
    }
  });
});

describe('Workspace Tests', () => {
  beforeAll(() => {
    proj = newProject();
  });

  afterAll(() => cleanupProject());

  describe('@nx/workspace:npm-package', () => {
    it('should create a minimal npm package', () => {
      const npmPackage = uniq('npm-package');

      runCLI(`generate @nx/workspace:npm-package ${npmPackage}`);

      updateFile('package.json', (content) => {
        const json = JSON.parse(content);
        json.workspaces = ['libs/*'];
        return JSON.stringify(json);
      });

      const pmc = getPackageManagerCommand({
        packageManager: getSelectedPackageManager(),
      });

      runCommand(pmc.install);

      const result = runCLI(`test ${npmPackage}`);
      expect(result).toContain('Hello World');
    });
  });

  describe('move project', () => {
    /**
     * Tries moving a library from ${lib}/data-access -> shared/${lib}/data-access
     */
    it('should work for libraries', async () => {
      const lib1 = uniq('mylib');
      const lib2 = uniq('mylib');
      const lib3 = uniq('mylib');
      runCLI(
        `generate @nx/js:lib --name=${lib1}-data-access --directory=${lib1}/data-access --unitTestRunner=jest`
      );

      updateFile(
        `${lib1}/data-access/src/lib/${lib1}-data-access.ts`,
        `export function fromLibOne() { console.log('This is completely pointless'); }`
      );

      updateFile(
        `${lib1}/data-access/src/index.ts`,
        `export * from './lib/${lib1}-data-access.ts'`
      );

      /**
       * Create a library which imports a class from lib1
       */

      runCLI(
        `generate @nx/js:lib --name=${lib2}-ui --directory=${lib2}/ui --unitTestRunner=jest`
      );

      updateFile(
        `${lib2}/ui/src/lib/${lib2}-ui.ts`,
        `import { fromLibOne } from '@${proj}/${lib1}-data-access';

        export const fromLibTwo = () => fromLibOne();`
      );

      /**
       * Create a library which has an implicit dependency on lib1
       */

      runCLI(`generate @nx/js:lib ${lib3} --unitTestRunner=jest`);
      updateFile(join(lib3, 'project.json'), (content) => {
        const data = JSON.parse(content);
        data.implicitDependencies = [`${lib1}-data-access`];
        return JSON.stringify(data, null, 2);
      });

      /**
       * Now try to move lib1
       */

      const moveOutput = runCLI(
        `generate @nx/workspace:move --project ${lib1}-data-access shared/${lib1}/data-access --newProjectName=shared-${lib1}-data-access`
      );

      expect(moveOutput).toContain(`DELETE ${lib1}/data-access`);
      expect(exists(`${lib1}/data-access`)).toBeFalsy();

      const newPath = `shared/${lib1}/data-access`;
      const newName = `shared-${lib1}-data-access`;

      const readmePath = `${newPath}/README.md`;
      expect(moveOutput).toContain(`CREATE ${readmePath}`);
      checkFilesExist(readmePath);

      const jestConfigPath = `${newPath}/jest.config.ts`;
      expect(moveOutput).toContain(`CREATE ${jestConfigPath}`);
      checkFilesExist(jestConfigPath);
      const jestConfig = readFile(jestConfigPath);
      expect(jestConfig).toContain(`displayName: 'shared-${lib1}-data-access'`);
      expect(jestConfig).toContain(`preset: '../../../jest.preset.js'`);
      expect(jestConfig).toContain(`'../../../coverage/${newPath}'`);

      const tsConfigPath = `${newPath}/tsconfig.json`;
      expect(moveOutput).toContain(`CREATE ${tsConfigPath}`);
      checkFilesExist(tsConfigPath);

      const tsConfigLibPath = `${newPath}/tsconfig.lib.json`;
      expect(moveOutput).toContain(`CREATE ${tsConfigLibPath}`);
      checkFilesExist(tsConfigLibPath);
      const tsConfigLib = readJson(tsConfigLibPath);
      expect(tsConfigLib.compilerOptions.outDir).toEqual(
        '../../../dist/out-tsc'
      );

      const tsConfigSpecPath = `${newPath}/tsconfig.spec.json`;
      expect(moveOutput).toContain(`CREATE ${tsConfigSpecPath}`);
      checkFilesExist(tsConfigSpecPath);
      const tsConfigSpec = readJson(tsConfigSpecPath);
      expect(tsConfigSpec.compilerOptions.outDir).toEqual(
        '../../../dist/out-tsc'
      );

      const indexPath = `${newPath}/src/index.ts`;
      expect(moveOutput).toContain(`CREATE ${indexPath}`);
      checkFilesExist(indexPath);

      const rootClassPath = `${newPath}/src/lib/${lib1}-data-access.ts`;
      expect(moveOutput).toContain(`CREATE ${rootClassPath}`);
      checkFilesExist(rootClassPath);

      let projects = runCLI('show projects').split('\n');
      expect(projects).not.toContain(`${lib1}-data-access`);
      const newConfig = readJson(join(newPath, 'project.json'));
      expect(newConfig).toMatchObject({
        tags: [],
      });
      const lib3Config = readJson(join(lib3, 'project.json'));
      expect(lib3Config.implicitDependencies).toEqual([
        `shared-${lib1}-data-access`,
      ]);

      expect(moveOutput).toContain('UPDATE tsconfig.base.json');
      const rootTsConfig = readJson('tsconfig.base.json');
      expect(
        rootTsConfig.compilerOptions.paths[`@${proj}/${lib1}-data-access`]
      ).toBeUndefined();
      expect(
        rootTsConfig.compilerOptions.paths[
          `@${proj}/shared-${lib1}-data-access`
        ]
      ).toEqual([`shared/${lib1}/data-access/src/index.ts`]);

      projects = runCLI('show projects').split('\n');
      expect(projects).not.toContain(`${lib1}-data-access`);
      const project = readJson(join(newPath, 'project.json'));
      expect(project).toBeTruthy();
      expect(project.sourceRoot).toBe(`${newPath}/src`);

      /**
       * Check that the import in lib2 has been updated
       */
      const lib2FilePath = `${lib2}/ui/src/lib/${lib2}-ui.ts`;
      const lib2File = readFile(lib2FilePath);
      expect(lib2File).toContain(
        `import { fromLibOne } from '@${proj}/shared-${lib1}-data-access';`
      );
    });

    it('should work for libs created with --importPath', async () => {
      const importPath = '@wibble/fish';
      const lib1 = uniq('mylib');
      const lib2 = uniq('mylib');
      const lib3 = uniq('mylib');
      runCLI(
        `generate @nx/js:lib --name=${lib1}-data-access --directory=${lib1}/data-access --importPath=${importPath} --unitTestRunner=jest`
      );

      updateFile(
        `${lib1}/data-access/src/lib/${lib1}-data-access.ts`,
        `export function fromLibOne() { console.log('This is completely pointless'); }`
      );

      updateFile(
        `${lib1}/data-access/src/index.ts`,
        `export * from './lib/${lib1}-data-access.ts'`
      );

      /**
       * Create a library which imports a class from lib1
       */

      runCLI(
        `generate @nx/js:lib --name=${lib2}-ui --directory=${lib2}/ui --unitTestRunner=jest`
      );

      updateFile(
        `${lib2}/ui/src/lib/${lib2}-ui.ts`,
        `import { fromLibOne } from '${importPath}';

        export const fromLibTwo = () => fromLibOne();`
      );

      /**
       * Create a library which has an implicit dependency on lib1
       */

      runCLI(`generate @nx/js:lib ${lib3} --unitTestRunner=jest`);
      updateFile(join(lib3, 'project.json'), (content) => {
        const data = JSON.parse(content);
        data.implicitDependencies = [`${lib1}-data-access`];
        return JSON.stringify(data, null, 2);
      });

      /**
       * Now try to move lib1
       */

      const moveOutput = runCLI(
        `generate @nx/workspace:move --project ${lib1}-data-access shared/${lib1}/data-access --newProjectName=shared-${lib1}-data-access`
      );

      expect(moveOutput).toContain(`DELETE ${lib1}/data-access`);
      expect(exists(`${lib1}/data-access`)).toBeFalsy();

      const newPath = `shared/${lib1}/data-access`;
      const newName = `shared-${lib1}-data-access`;

      const readmePath = `${newPath}/README.md`;
      expect(moveOutput).toContain(`CREATE ${readmePath}`);
      checkFilesExist(readmePath);

      const jestConfigPath = `${newPath}/jest.config.ts`;
      expect(moveOutput).toContain(`CREATE ${jestConfigPath}`);
      checkFilesExist(jestConfigPath);
      const jestConfig = readFile(jestConfigPath);
      expect(jestConfig).toContain(`displayName: 'shared-${lib1}-data-access'`);
      expect(jestConfig).toContain(`preset: '../../../jest.preset.js'`);
      expect(jestConfig).toContain(`'../../../coverage/${newPath}'`);

      const tsConfigPath = `${newPath}/tsconfig.json`;
      expect(moveOutput).toContain(`CREATE ${tsConfigPath}`);
      checkFilesExist(tsConfigPath);

      const tsConfigLibPath = `${newPath}/tsconfig.lib.json`;
      expect(moveOutput).toContain(`CREATE ${tsConfigLibPath}`);
      checkFilesExist(tsConfigLibPath);
      const tsConfigLib = readJson(tsConfigLibPath);
      expect(tsConfigLib.compilerOptions.outDir).toEqual(
        '../../../dist/out-tsc'
      );

      const tsConfigSpecPath = `${newPath}/tsconfig.spec.json`;
      expect(moveOutput).toContain(`CREATE ${tsConfigSpecPath}`);
      checkFilesExist(tsConfigSpecPath);
      const tsConfigSpec = readJson(tsConfigSpecPath);
      expect(tsConfigSpec.compilerOptions.outDir).toEqual(
        '../../../dist/out-tsc'
      );

      const indexPath = `${newPath}/src/index.ts`;
      expect(moveOutput).toContain(`CREATE ${indexPath}`);
      checkFilesExist(indexPath);

      const rootClassPath = `${newPath}/src/lib/${lib1}-data-access.ts`;
      expect(moveOutput).toContain(`CREATE ${rootClassPath}`);
      checkFilesExist(rootClassPath);

      expect(moveOutput).toContain('UPDATE tsconfig.base.json');
      const rootTsConfig = readJson('tsconfig.base.json');
      expect(
        rootTsConfig.compilerOptions.paths[`@${proj}/${lib1}-data-access`]
      ).toBeUndefined();
      expect(
        rootTsConfig.compilerOptions.paths[
          `@${proj}/shared-${lib1}-data-access`
        ]
      ).toEqual([`shared/${lib1}/data-access/src/index.ts`]);

      const projects = runCLI('show projects').split('\n');
      expect(projects).not.toContain(`${lib1}-data-access`);
      const project = readJson(join(newPath, 'project.json'));
      expect(project).toBeTruthy();
      expect(project.sourceRoot).toBe(`${newPath}/src`);
      expect(project.tags).toEqual([]);
      const lib3Config = readJson(join(lib3, 'project.json'));
      expect(lib3Config.implicitDependencies).toEqual([newName]);

      /**
       * Check that the import in lib2 has been updated
       */
      const lib2FilePath = `${lib2}/ui/src/lib/${lib2}-ui.ts`;
      const lib2File = readFile(lib2FilePath);
      expect(lib2File).toContain(
        `import { fromLibOne } from '@${proj}/shared-${lib1}-data-access';`
      );
    });

    it('should work when moving a lib to a subfolder', async () => {
      const lib1 = uniq('lib1');
      const lib2 = uniq('lib2');
      const lib3 = uniq('lib3');
      runCLI(`generate @nx/js:lib ${lib1} --unitTestRunner=jest`);

      updateFile(
        `${lib1}/src/lib/${lib1}.ts`,
        `export function fromLibOne() { console.log('This is completely pointless'); }`
      );

      updateFile(`${lib1}/src/index.ts`, `export * from './lib/${lib1}.ts'`);

      /**
       * Create a library which imports a class from lib1
       */

      runCLI(
        `generate @nx/js:lib --name=${lib2}-ui --directory=${lib2}/ui --unitTestRunner=jest`
      );

      updateFile(
        `${lib2}/ui/src/lib/${lib2}-ui.ts`,
        `import { fromLibOne } from '@${proj}/${lib1}';

        export const fromLibTwo = () => fromLibOne();`
      );

      /**
       * Create a library which has an implicit dependency on lib1
       */

      runCLI(`generate @nx/js:lib ${lib3} --unitTestRunner=jest`);
      updateFile(join(lib3, 'project.json'), (content) => {
        const data = JSON.parse(content);
        data.implicitDependencies = [lib1];
        return JSON.stringify(data, null, 2);
      });

      /**
       * Now try to move lib1
       */

      const moveOutput = runCLI(
        `generate @nx/workspace:move --project ${lib1} ${lib1}/data-access --newProjectName=${lib1}-data-access`
      );

      expect(moveOutput).toContain(`DELETE ${lib1}/project.json`);
      expect(exists(`${lib1}/project.json`)).toBeFalsy();

      const newPath = `${lib1}/data-access`;
      const newName = `${lib1}-data-access`;

      const readmePath = `${newPath}/README.md`;
      expect(moveOutput).toContain(`CREATE ${readmePath}`);
      checkFilesExist(readmePath);

      const jestConfigPath = `${newPath}/jest.config.ts`;
      expect(moveOutput).toContain(`CREATE ${jestConfigPath}`);
      checkFilesExist(jestConfigPath);
      const jestConfig = readFile(jestConfigPath);
      expect(jestConfig).toContain(`displayName: '${lib1}-data-access'`);
      expect(jestConfig).toContain(`preset: '../../jest.preset.js'`);
      expect(jestConfig).toContain(`'../../coverage/${newPath}'`);

      const tsConfigPath = `${newPath}/tsconfig.json`;
      expect(moveOutput).toContain(`CREATE ${tsConfigPath}`);
      checkFilesExist(tsConfigPath);

      const tsConfigLibPath = `${newPath}/tsconfig.lib.json`;
      expect(moveOutput).toContain(`CREATE ${tsConfigLibPath}`);
      checkFilesExist(tsConfigLibPath);
      const tsConfigLib = readJson(tsConfigLibPath);
      expect(tsConfigLib.compilerOptions.outDir).toEqual('../../dist/out-tsc');

      const tsConfigSpecPath = `${newPath}/tsconfig.spec.json`;
      expect(moveOutput).toContain(`CREATE ${tsConfigSpecPath}`);
      checkFilesExist(tsConfigSpecPath);
      const tsConfigSpec = readJson(tsConfigSpecPath);
      expect(tsConfigSpec.compilerOptions.outDir).toEqual('../../dist/out-tsc');

      const indexPath = `${newPath}/src/index.ts`;
      expect(moveOutput).toContain(`CREATE ${indexPath}`);
      checkFilesExist(indexPath);

      const rootClassPath = `${newPath}/src/lib/${lib1}.ts`;
      expect(moveOutput).toContain(`CREATE ${rootClassPath}`);
      checkFilesExist(rootClassPath);

      let projects = runCLI('show projects').split('\n');
      expect(projects).not.toContain(lib1);
      const newConfig = readJson(join(newPath, 'project.json'));
      expect(newConfig).toMatchObject({
        tags: [],
      });
      const lib3Config = readJson(join(lib3, 'project.json'));
      expect(lib3Config.implicitDependencies).toEqual([`${lib1}-data-access`]);

      expect(moveOutput).toContain('UPDATE tsconfig.base.json');
      const rootTsConfig = readJson('tsconfig.base.json');
      expect(
        rootTsConfig.compilerOptions.paths[`@${proj}/${lib1}`]
      ).toBeUndefined();
      expect(
        rootTsConfig.compilerOptions.paths[`@${proj}/${lib1}-data-access`]
      ).toEqual([`${lib1}/data-access/src/index.ts`]);

      projects = runCLI('show projects').split('\n');
      expect(projects).not.toContain(lib1);
      const project = readJson(join(newPath, 'project.json'));
      expect(project).toBeTruthy();
      expect(project.sourceRoot).toBe(`${newPath}/src`);

      /**
       * Check that the import in lib2 has been updated
       */
      const lib2FilePath = `${lib2}/ui/src/lib/${lib2}-ui.ts`;
      const lib2File = readFile(lib2FilePath);
      expect(lib2File).toContain(
        `import { fromLibOne } from '@${proj}/${lib1}-data-access';`
      );
    });

    it('should work for libraries when scope is unset', async () => {
      const json = readJson('package.json');
      json.name = proj;
      updateFile('package.json', JSON.stringify(json));

      const lib1 = uniq('mylib');
      const lib2 = uniq('mylib');
      const lib3 = uniq('mylib');
      runCLI(
        `generate @nx/js:lib --name=${lib1}-data-access --directory=${lib1}/data-access --unitTestRunner=jest`
      );
      let rootTsConfig = readJson('tsconfig.base.json');
      expect(
        rootTsConfig.compilerOptions.paths[`@${proj}/${lib1}-data-access`]
      ).toBeUndefined();
      expect(
        rootTsConfig.compilerOptions.paths[`${lib1}-data-access`]
      ).toBeDefined();

      updateFile(
        `${lib1}/data-access/src/lib/${lib1}-data-access.ts`,
        `export function fromLibOne() { console.log('This is completely pointless'); }`
      );

      updateFile(
        `${lib1}/data-access/src/index.ts`,
        `export * from './lib/${lib1}-data-access.ts'`
      );

      /**
       * Create a library which imports a class from lib1
       */

      runCLI(
        `generate @nx/js:lib --name${lib2}-ui --directory=${lib2}/ui --unitTestRunner=jest`
      );

      updateFile(
        `${lib2}/ui/src/lib/${lib2}-ui.ts`,
        `import { fromLibOne } from '${lib1}-data-access';

        export const fromLibTwo = () => fromLibOne();`
      );

      /**
       * Create a library which has an implicit dependency on lib1
       */

      runCLI(`generate @nx/js:lib ${lib3} --unitTestRunner=jest`);
      updateFile(join(lib3, 'project.json'), (content) => {
        const data = JSON.parse(content);
        data.implicitDependencies = [`${lib1}-data-access`];
        return JSON.stringify(data, null, 2);
      });

      /**
       * Now try to move lib1
       */

      const moveOutput = runCLI(
        `generate @nx/workspace:move --project ${lib1}-data-access shared/${lib1}/data-access --newProjectName=shared-${lib1}-data-access`
      );

      expect(moveOutput).toContain(`DELETE ${lib1}/data-access`);
      expect(exists(`${lib1}/data-access`)).toBeFalsy();

      const newPath = `shared/${lib1}/data-access`;
      const newName = `shared-${lib1}-data-access`;

      const readmePath = `${newPath}/README.md`;
      expect(moveOutput).toContain(`CREATE ${readmePath}`);
      checkFilesExist(readmePath);

      const indexPath = `${newPath}/src/index.ts`;
      expect(moveOutput).toContain(`CREATE ${indexPath}`);
      checkFilesExist(indexPath);

      const rootClassPath = `${newPath}/src/lib/${lib1}-data-access.ts`;
      expect(moveOutput).toContain(`CREATE ${rootClassPath}`);
      checkFilesExist(rootClassPath);

      const newConfig = readJson(join(newPath, 'project.json'));
      expect(newConfig).toMatchObject({
        tags: [],
      });
      const lib3Config = readJson(join(lib3, 'project.json'));
      expect(lib3Config.implicitDependencies).toEqual([
        `shared-${lib1}-data-access`,
      ]);

      expect(moveOutput).toContain('UPDATE tsconfig.base.json');
      rootTsConfig = readJson('tsconfig.base.json');
      expect(
        rootTsConfig.compilerOptions.paths[`${lib1}-data-access`]
      ).toBeUndefined();
      expect(
        rootTsConfig.compilerOptions.paths[`shared-${lib1}-data-access`]
      ).toEqual([`shared/${lib1}/data-access/src/index.ts`]);

      const projects = runCLI('show projects').split('\n');
      expect(projects).not.toContain(`${lib1}-data-access`);
      const project = readJson(join(newPath, 'project.json'));
      expect(project).toBeTruthy();
      expect(project.sourceRoot).toBe(`${newPath}/src`);

      /**
       * Check that the import in lib2 has been updated
       */
      const lib2FilePath = `${lib2}/ui/src/lib/${lib2}-ui.ts`;
      const lib2File = readFile(lib2FilePath);
      expect(lib2File).toContain(
        `import { fromLibOne } from 'shared-${lib1}-data-access';`
      );
    });
  });

  describe('remove project', () => {
    /**
     * Tries creating then deleting a lib
     */
    it('should work', async () => {
      const lib1 = uniq('myliba');
      const lib2 = uniq('mylibb');

      runCLI(
        `generate @nx/js:lib ${lib1} --unitTestRunner=jest --directory=libs/${lib1}`
      );
      expect(exists(tmpProjPath(`libs/${lib1}`))).toBeTruthy();

      /**
       * Create a library which has an implicit dependency on lib1
       */

      runCLI(`generate @nx/js:lib libs/${lib2} --unitTestRunner=jest`);
      updateFile(join('libs', lib2, 'project.json'), (content) => {
        const data = JSON.parse(content);
        data.implicitDependencies = [lib1];
        return JSON.stringify(data, null, 2);
      });

      /**
       * Try removing the project (should fail)
       */

      let error;
      try {
        console.log(runCLI(`generate @nx/workspace:remove --project ${lib1}`));
      } catch (e) {
        error = e;
      }

      expect(error).toBeDefined();
      expect(error.stdout.toString()).toContain(
        `${lib1} is still a dependency of the following projects`
      );
      expect(error.stdout.toString()).toContain(lib2);

      /**
       * Try force removing the project
       */

      const removeOutputForced = runCLI(
        `generate @nx/workspace:remove --project ${lib1} --forceRemove`
      );

      expect(removeOutputForced).toContain(`DELETE libs/${lib1}`);
      expect(exists(tmpProjPath(`libs/${lib1}`))).toBeFalsy();

      expect(removeOutputForced).not.toContain(`UPDATE nx.json`);
      const projects = runCLI('show projects').split('\n');
      expect(projects).not.toContain(lib1);
      const lib2Config = readJson(join('libs', lib2, 'project.json'));
      expect(lib2Config.implicitDependencies).toEqual([]);

      expect(projects[`${lib1}`]).toBeUndefined();
    });
  });
});
