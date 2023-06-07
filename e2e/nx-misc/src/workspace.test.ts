import {
  checkFilesExist,
  newProject,
  readJson,
  cleanupProject,
  runCLI,
  uniq,
  updateFile,
  readFile,
  exists,
  updateProjectConfig,
  readProjectConfig,
  tmpProjPath,
  readResolvedConfiguration,
  getPackageManagerCommand,
  getSelectedPackageManager,
  runCommand,
  runCreateWorkspace,
} from '@nx/e2e/utils';

let proj: string;

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
      runCLI(`generate @nx/js:lib ${lib1}/data-access --unitTestRunner=jest`);

      updateFile(
        `libs/${lib1}/data-access/src/lib/${lib1}-data-access.ts`,
        `export function fromLibOne() { console.log('This is completely pointless'); }`
      );

      updateFile(
        `libs/${lib1}/data-access/src/index.ts`,
        `export * from './lib/${lib1}-data-access.ts'`
      );

      /**
       * Create a library which imports a class from lib1
       */

      runCLI(`generate @nx/js:lib ${lib2}/ui --unitTestRunner=jest`);

      updateFile(
        `libs/${lib2}/ui/src/lib/${lib2}-ui.ts`,
        `import { fromLibOne } from '@${proj}/${lib1}/data-access';

        export const fromLibTwo = () => fromLibOne();`
      );

      /**
       * Create a library which has an implicit dependency on lib1
       */

      runCLI(`generate @nx/js:lib ${lib3} --unitTestRunner=jest`);
      updateProjectConfig(lib3, (config) => {
        config.implicitDependencies = [`${lib1}-data-access`];
        return config;
      });

      /**
       * Now try to move lib1
       */

      const moveOutput = runCLI(
        `generate @nx/workspace:move --project ${lib1}-data-access shared/${lib1}/data-access`
      );

      expect(moveOutput).toContain(`DELETE libs/${lib1}/data-access`);
      expect(exists(`libs/${lib1}/data-access`)).toBeFalsy();

      const newPath = `libs/shared/${lib1}/data-access`;
      const newName = `shared-${lib1}-data-access`;

      const readmePath = `${newPath}/README.md`;
      expect(moveOutput).toContain(`CREATE ${readmePath}`);
      checkFilesExist(readmePath);

      const jestConfigPath = `${newPath}/jest.config.ts`;
      expect(moveOutput).toContain(`CREATE ${jestConfigPath}`);
      checkFilesExist(jestConfigPath);
      const jestConfig = readFile(jestConfigPath);
      expect(jestConfig).toContain(`displayName: 'shared-${lib1}-data-access'`);
      expect(jestConfig).toContain(`preset: '../../../../jest.preset.js'`);
      expect(jestConfig).toContain(`'../../../../coverage/${newPath}'`);

      const tsConfigPath = `${newPath}/tsconfig.json`;
      expect(moveOutput).toContain(`CREATE ${tsConfigPath}`);
      checkFilesExist(tsConfigPath);

      const tsConfigLibPath = `${newPath}/tsconfig.lib.json`;
      expect(moveOutput).toContain(`CREATE ${tsConfigLibPath}`);
      checkFilesExist(tsConfigLibPath);
      const tsConfigLib = readJson(tsConfigLibPath);
      expect(tsConfigLib.compilerOptions.outDir).toEqual(
        '../../../../dist/out-tsc'
      );

      const tsConfigSpecPath = `${newPath}/tsconfig.spec.json`;
      expect(moveOutput).toContain(`CREATE ${tsConfigSpecPath}`);
      checkFilesExist(tsConfigSpecPath);
      const tsConfigSpec = readJson(tsConfigSpecPath);
      expect(tsConfigSpec.compilerOptions.outDir).toEqual(
        '../../../../dist/out-tsc'
      );

      const indexPath = `${newPath}/src/index.ts`;
      expect(moveOutput).toContain(`CREATE ${indexPath}`);
      checkFilesExist(indexPath);

      const rootClassPath = `${newPath}/src/lib/${lib1}-data-access.ts`;
      expect(moveOutput).toContain(`CREATE ${rootClassPath}`);
      checkFilesExist(rootClassPath);

      let workspace = await readResolvedConfiguration();
      expect(workspace.projects[`${lib1}-data-access`]).toBeUndefined();
      const newConfig = readProjectConfig(newName);
      expect(newConfig).toMatchObject({
        tags: [],
      });
      const lib3Config = readProjectConfig(lib3);
      expect(lib3Config.implicitDependencies).toEqual([
        `shared-${lib1}-data-access`,
      ]);

      expect(moveOutput).toContain('UPDATE tsconfig.base.json');
      const rootTsConfig = readJson('tsconfig.base.json');
      expect(
        rootTsConfig.compilerOptions.paths[`@${proj}/${lib1}/data-access`]
      ).toBeUndefined();
      expect(
        rootTsConfig.compilerOptions.paths[
          `@${proj}/shared/${lib1}/data-access`
        ]
      ).toEqual([`libs/shared/${lib1}/data-access/src/index.ts`]);

      workspace = readResolvedConfiguration();
      expect(workspace.projects[`${lib1}-data-access`]).toBeUndefined();
      const project = readProjectConfig(newName);
      expect(project).toBeTruthy();
      expect(project.sourceRoot).toBe(`${newPath}/src`);
      expect(project.targets.lint.options.lintFilePatterns).toEqual([
        `libs/shared/${lib1}/data-access/**/*.ts`,
      ]);

      /**
       * Check that the import in lib2 has been updated
       */
      const lib2FilePath = `libs/${lib2}/ui/src/lib/${lib2}-ui.ts`;
      const lib2File = readFile(lib2FilePath);
      expect(lib2File).toContain(
        `import { fromLibOne } from '@${proj}/shared/${lib1}/data-access';`
      );
    });

    it('should work for libs created with --importPath', async () => {
      const importPath = '@wibble/fish';
      const lib1 = uniq('mylib');
      const lib2 = uniq('mylib');
      const lib3 = uniq('mylib');
      runCLI(
        `generate @nx/js:lib ${lib1}/data-access --importPath=${importPath} --unitTestRunner=jest`
      );

      updateFile(
        `libs/${lib1}/data-access/src/lib/${lib1}-data-access.ts`,
        `export function fromLibOne() { console.log('This is completely pointless'); }`
      );

      updateFile(
        `libs/${lib1}/data-access/src/index.ts`,
        `export * from './lib/${lib1}-data-access.ts'`
      );

      /**
       * Create a library which imports a class from lib1
       */

      runCLI(`generate @nx/js:lib ${lib2}/ui --unitTestRunner=jest`);

      updateFile(
        `libs/${lib2}/ui/src/lib/${lib2}-ui.ts`,
        `import { fromLibOne } from '${importPath}';

        export const fromLibTwo = () => fromLibOne();`
      );

      /**
       * Create a library which has an implicit dependency on lib1
       */

      runCLI(`generate @nx/js:lib ${lib3} --unitTestRunner=jest`);
      updateProjectConfig(lib3, (config) => {
        config.implicitDependencies = [`${lib1}-data-access`];
        return config;
      });

      /**
       * Now try to move lib1
       */

      const moveOutput = runCLI(
        `generate @nx/workspace:move --project ${lib1}-data-access shared/${lib1}/data-access`
      );

      expect(moveOutput).toContain(`DELETE libs/${lib1}/data-access`);
      expect(exists(`libs/${lib1}/data-access`)).toBeFalsy();

      const newPath = `libs/shared/${lib1}/data-access`;
      const newName = `shared-${lib1}-data-access`;

      const readmePath = `${newPath}/README.md`;
      expect(moveOutput).toContain(`CREATE ${readmePath}`);
      checkFilesExist(readmePath);

      const jestConfigPath = `${newPath}/jest.config.ts`;
      expect(moveOutput).toContain(`CREATE ${jestConfigPath}`);
      checkFilesExist(jestConfigPath);
      const jestConfig = readFile(jestConfigPath);
      expect(jestConfig).toContain(`displayName: 'shared-${lib1}-data-access'`);
      expect(jestConfig).toContain(`preset: '../../../../jest.preset.js'`);
      expect(jestConfig).toContain(`'../../../../coverage/${newPath}'`);

      const tsConfigPath = `${newPath}/tsconfig.json`;
      expect(moveOutput).toContain(`CREATE ${tsConfigPath}`);
      checkFilesExist(tsConfigPath);

      const tsConfigLibPath = `${newPath}/tsconfig.lib.json`;
      expect(moveOutput).toContain(`CREATE ${tsConfigLibPath}`);
      checkFilesExist(tsConfigLibPath);
      const tsConfigLib = readJson(tsConfigLibPath);
      expect(tsConfigLib.compilerOptions.outDir).toEqual(
        '../../../../dist/out-tsc'
      );

      const tsConfigSpecPath = `${newPath}/tsconfig.spec.json`;
      expect(moveOutput).toContain(`CREATE ${tsConfigSpecPath}`);
      checkFilesExist(tsConfigSpecPath);
      const tsConfigSpec = readJson(tsConfigSpecPath);
      expect(tsConfigSpec.compilerOptions.outDir).toEqual(
        '../../../../dist/out-tsc'
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
        rootTsConfig.compilerOptions.paths[`@${proj}/${lib1}/data-access`]
      ).toBeUndefined();
      expect(
        rootTsConfig.compilerOptions.paths[
          `@${proj}/shared/${lib1}/data-access`
        ]
      ).toEqual([`libs/shared/${lib1}/data-access/src/index.ts`]);

      const workspace = await readResolvedConfiguration();
      expect(workspace.projects[`${lib1}-data-access`]).toBeUndefined();
      const project = readProjectConfig(newName);
      expect(project).toBeTruthy();
      expect(project.sourceRoot).toBe(`${newPath}/src`);
      expect(project.tags).toEqual([]);
      const lib3Config = readProjectConfig(lib3);
      expect(lib3Config.implicitDependencies).toEqual([newName]);

      expect(project.targets.lint.options.lintFilePatterns).toEqual([
        `libs/shared/${lib1}/data-access/**/*.ts`,
      ]);

      /**
       * Check that the import in lib2 has been updated
       */
      const lib2FilePath = `libs/${lib2}/ui/src/lib/${lib2}-ui.ts`;
      const lib2File = readFile(lib2FilePath);
      expect(lib2File).toContain(
        `import { fromLibOne } from '@${proj}/shared/${lib1}/data-access';`
      );
    });

    it('should work for custom workspace layouts', async () => {
      const lib1 = uniq('mylib');
      const lib2 = uniq('mylib');
      const lib3 = uniq('mylib');

      let nxJson = readJson('nx.json');
      nxJson.workspaceLayout = { libsDir: 'packages' };
      updateFile('nx.json', JSON.stringify(nxJson));

      runCLI(`generate @nx/js:lib ${lib1}/data-access --unitTestRunner=jest`);

      updateFile(
        `packages/${lib1}/data-access/src/lib/${lib1}-data-access.ts`,
        `export function fromLibOne() { console.log('This is completely pointless'); }`
      );

      updateFile(
        `packages/${lib1}/data-access/src/index.ts`,
        `export * from './lib/${lib1}-data-access.ts'`
      );

      /**
       * Create a library which imports a class from lib1
       */

      runCLI(`generate @nx/js:lib ${lib2}/ui --unitTestRunner=jest`);

      updateFile(
        `packages/${lib2}/ui/src/lib/${lib2}-ui.ts`,
        `import { fromLibOne } from '@${proj}/${lib1}/data-access';

        export const fromLibTwo = () => fromLibOne();`
      );

      /**
       * Create a library which has an implicit dependency on lib1
       */

      runCLI(`generate @nx/js:lib ${lib3} --unitTestRunner=jest`);
      updateProjectConfig(lib3, (config) => {
        config.implicitDependencies = [`${lib1}-data-access`];
        return config;
      });

      /**
       * Now try to move lib1
       */

      const moveOutput = runCLI(
        `generate @nx/workspace:move --project ${lib1}-data-access shared/${lib1}/data-access`
      );

      expect(moveOutput).toContain(`DELETE packages/${lib1}/data-access`);
      expect(exists(`packages/${lib1}/data-access`)).toBeFalsy();

      const newPath = `packages/shared/${lib1}/data-access`;
      const newName = `shared-${lib1}-data-access`;

      const readmePath = `${newPath}/README.md`;
      expect(moveOutput).toContain(`CREATE ${readmePath}`);
      checkFilesExist(readmePath);

      const jestConfigPath = `${newPath}/jest.config.ts`;
      expect(moveOutput).toContain(`CREATE ${jestConfigPath}`);
      checkFilesExist(jestConfigPath);
      const jestConfig = readFile(jestConfigPath);
      expect(jestConfig).toContain(`displayName: 'shared-${lib1}-data-access'`);
      expect(jestConfig).toContain(`preset: '../../../../jest.preset.js'`);
      expect(jestConfig).toContain(`'../../../../coverage/${newPath}'`);

      const tsConfigPath = `${newPath}/tsconfig.json`;
      expect(moveOutput).toContain(`CREATE ${tsConfigPath}`);
      checkFilesExist(tsConfigPath);

      const tsConfigLibPath = `${newPath}/tsconfig.lib.json`;
      expect(moveOutput).toContain(`CREATE ${tsConfigLibPath}`);
      checkFilesExist(tsConfigLibPath);
      const tsConfigLib = readJson(tsConfigLibPath);
      expect(tsConfigLib.compilerOptions.outDir).toEqual(
        '../../../../dist/out-tsc'
      );

      const tsConfigSpecPath = `${newPath}/tsconfig.spec.json`;
      expect(moveOutput).toContain(`CREATE ${tsConfigSpecPath}`);
      checkFilesExist(tsConfigSpecPath);
      const tsConfigSpec = readJson(tsConfigSpecPath);
      expect(tsConfigSpec.compilerOptions.outDir).toEqual(
        '../../../../dist/out-tsc'
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
        rootTsConfig.compilerOptions.paths[`@${proj}/${lib1}/data-access`]
      ).toBeUndefined();
      expect(
        rootTsConfig.compilerOptions.paths[
          `@${proj}/shared/${lib1}/data-access`
        ]
      ).toEqual([`packages/shared/${lib1}/data-access/src/index.ts`]);

      const workspace = await readResolvedConfiguration();
      expect(workspace.projects[`${lib1}-data-access`]).toBeUndefined();
      const project = readProjectConfig(newName);
      expect(project).toBeTruthy();
      expect(project.sourceRoot).toBe(`${newPath}/src`);
      expect(project.targets.lint.options.lintFilePatterns).toEqual([
        `packages/shared/${lib1}/data-access/**/*.ts`,
      ]);
      expect(project.tags).toEqual([]);

      /**
       * Check that the import in lib2 has been updated
       */
      const lib2FilePath = `packages/${lib2}/ui/src/lib/${lib2}-ui.ts`;
      const lib2File = readFile(lib2FilePath);
      expect(lib2File).toContain(
        `import { fromLibOne } from '@${proj}/shared/${lib1}/data-access';`
      );

      nxJson = readJson('nx.json');
      delete nxJson.workspaceLayout;
      updateFile('nx.json', JSON.stringify(nxJson));
    });

    it('should work when moving a lib to a subfolder', async () => {
      const lib1 = uniq('lib1');
      const lib2 = uniq('lib2');
      const lib3 = uniq('lib3');
      runCLI(`generate @nx/js:lib ${lib1} --unitTestRunner=jest`);

      updateFile(
        `libs/${lib1}/src/lib/${lib1}.ts`,
        `export function fromLibOne() { console.log('This is completely pointless'); }`
      );

      updateFile(
        `libs/${lib1}/src/index.ts`,
        `export * from './lib/${lib1}.ts'`
      );

      /**
       * Create a library which imports a class from lib1
       */

      runCLI(`generate @nx/js:lib ${lib2}/ui --unitTestRunner=jest`);

      updateFile(
        `libs/${lib2}/ui/src/lib/${lib2}-ui.ts`,
        `import { fromLibOne } from '@${proj}/${lib1}';

        export const fromLibTwo = () => fromLibOne();`
      );

      /**
       * Create a library which has an implicit dependency on lib1
       */

      runCLI(`generate @nx/js:lib ${lib3} --unitTestRunner=jest`);
      updateProjectConfig(lib3, (config) => {
        config.implicitDependencies = [lib1];
        return config;
      });

      /**
       * Now try to move lib1
       */

      const moveOutput = runCLI(
        `generate @nx/workspace:move --project ${lib1} ${lib1}/data-access`
      );

      expect(moveOutput).toContain(`DELETE libs/${lib1}/project.json`);
      expect(exists(`libs/${lib1}/project.json`)).toBeFalsy();

      const newPath = `libs/${lib1}/data-access`;
      const newName = `${lib1}-data-access`;

      const readmePath = `${newPath}/README.md`;
      expect(moveOutput).toContain(`CREATE ${readmePath}`);
      checkFilesExist(readmePath);

      const jestConfigPath = `${newPath}/jest.config.ts`;
      expect(moveOutput).toContain(`CREATE ${jestConfigPath}`);
      checkFilesExist(jestConfigPath);
      const jestConfig = readFile(jestConfigPath);
      expect(jestConfig).toContain(`displayName: '${lib1}-data-access'`);
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

      const rootClassPath = `${newPath}/src/lib/${lib1}.ts`;
      expect(moveOutput).toContain(`CREATE ${rootClassPath}`);
      checkFilesExist(rootClassPath);

      let workspace = readResolvedConfiguration();
      expect(workspace.projects[lib1]).toBeUndefined();
      const newConfig = readProjectConfig(newName);
      expect(newConfig).toMatchObject({
        tags: [],
      });
      const lib3Config = readProjectConfig(lib3);
      expect(lib3Config.implicitDependencies).toEqual([`${lib1}-data-access`]);

      expect(moveOutput).toContain('UPDATE tsconfig.base.json');
      const rootTsConfig = readJson('tsconfig.base.json');
      expect(
        rootTsConfig.compilerOptions.paths[`@${proj}/${lib1}`]
      ).toBeUndefined();
      expect(
        rootTsConfig.compilerOptions.paths[`@${proj}/${lib1}/data-access`]
      ).toEqual([`libs/${lib1}/data-access/src/index.ts`]);

      workspace = readResolvedConfiguration();
      expect(workspace.projects[lib1]).toBeUndefined();
      const project = readProjectConfig(newName);
      expect(project).toBeTruthy();
      expect(project.sourceRoot).toBe(`${newPath}/src`);
      expect(project.targets.lint.options.lintFilePatterns).toEqual([
        `libs/${lib1}/data-access/**/*.ts`,
      ]);

      /**
       * Check that the import in lib2 has been updated
       */
      const lib2FilePath = `libs/${lib2}/ui/src/lib/${lib2}-ui.ts`;
      const lib2File = readFile(lib2FilePath);
      expect(lib2File).toContain(
        `import { fromLibOne } from '@${proj}/${lib1}/data-access';`
      );
    });

    it('should work for libraries when scope is unset', async () => {
      const json = readJson('package.json');
      json.name = proj;
      updateFile('package.json', JSON.stringify(json));

      const lib1 = uniq('mylib');
      const lib2 = uniq('mylib');
      const lib3 = uniq('mylib');
      runCLI(`generate @nx/js:lib ${lib1}/data-access --unitTestRunner=jest`);
      let rootTsConfig = readJson('tsconfig.base.json');
      expect(
        rootTsConfig.compilerOptions.paths[`@${proj}/${lib1}/data-access`]
      ).toBeUndefined();
      expect(
        rootTsConfig.compilerOptions.paths[`${lib1}/data-access`]
      ).toBeDefined();

      updateFile(
        `libs/${lib1}/data-access/src/lib/${lib1}-data-access.ts`,
        `export function fromLibOne() { console.log('This is completely pointless'); }`
      );

      updateFile(
        `libs/${lib1}/data-access/src/index.ts`,
        `export * from './lib/${lib1}-data-access.ts'`
      );

      /**
       * Create a library which imports a class from lib1
       */

      runCLI(`generate @nx/js:lib ${lib2}/ui --unitTestRunner=jest`);

      updateFile(
        `libs/${lib2}/ui/src/lib/${lib2}-ui.ts`,
        `import { fromLibOne } from '${lib1}/data-access';

        export const fromLibTwo = () => fromLibOne();`
      );

      /**
       * Create a library which has an implicit dependency on lib1
       */

      runCLI(`generate @nx/js:lib ${lib3} --unitTestRunner=jest`);
      updateProjectConfig(lib3, (config) => {
        config.implicitDependencies = [`${lib1}-data-access`];
        return config;
      });

      /**
       * Now try to move lib1
       */

      const moveOutput = runCLI(
        `generate @nx/workspace:move --project ${lib1}-data-access shared/${lib1}/data-access`
      );

      expect(moveOutput).toContain(`DELETE libs/${lib1}/data-access`);
      expect(exists(`libs/${lib1}/data-access`)).toBeFalsy();

      const newPath = `libs/shared/${lib1}/data-access`;
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

      const newConfig = readProjectConfig(newName);
      expect(newConfig).toMatchObject({
        tags: [],
      });
      const lib3Config = readProjectConfig(lib3);
      expect(lib3Config.implicitDependencies).toEqual([
        `shared-${lib1}-data-access`,
      ]);

      expect(moveOutput).toContain('UPDATE tsconfig.base.json');
      rootTsConfig = readJson('tsconfig.base.json');
      expect(
        rootTsConfig.compilerOptions.paths[`${lib1}/data-access`]
      ).toBeUndefined();
      expect(
        rootTsConfig.compilerOptions.paths[`shared/${lib1}/data-access`]
      ).toEqual([`libs/shared/${lib1}/data-access/src/index.ts`]);

      const projects = readResolvedConfiguration();
      expect(projects.projects[`${lib1}-data-access`]).toBeUndefined();
      const project = readProjectConfig(newName);
      expect(project).toBeTruthy();
      expect(project.sourceRoot).toBe(`${newPath}/src`);
      expect(project.targets.lint.options.lintFilePatterns).toEqual([
        `libs/shared/${lib1}/data-access/**/*.ts`,
      ]);

      /**
       * Check that the import in lib2 has been updated
       */
      const lib2FilePath = `libs/${lib2}/ui/src/lib/${lib2}-ui.ts`;
      const lib2File = readFile(lib2FilePath);
      expect(lib2File).toContain(
        `import { fromLibOne } from 'shared/${lib1}/data-access';`
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

      runCLI(`generate @nx/js:lib ${lib1} --unitTestRunner=jest`);
      expect(exists(tmpProjPath(`libs/${lib1}`))).toBeTruthy();

      /**
       * Create a library which has an implicit dependency on lib1
       */

      runCLI(`generate @nx/js:lib ${lib2} --unitTestRunner=jest`);
      updateProjectConfig(lib2, (config) => {
        config.implicitDependencies = [lib1];
        return config;
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
        `${lib1} is still depended on by the following projects`
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
      const projectsConfigurations = readResolvedConfiguration();
      expect(projectsConfigurations.projects[`${lib1}`]).toBeUndefined();
      const lib2Config = readProjectConfig(lib2);
      expect(lib2Config.implicitDependencies).toEqual([]);

      expect(projectsConfigurations.projects[`${lib1}`]).toBeUndefined();
    });
  });
});
