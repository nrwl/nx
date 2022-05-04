import {
  checkFilesExist,
  newProject,
  readJson,
  cleanupProject,
  runCLI,
  uniq,
  updateFile,
  expectJestTestsToPass,
  readFile,
  exists,
  workspaceConfigName,
  renameFile,
  updateProjectConfig,
  readProjectConfig,
  tmpProjPath,
  getSelectedPackageManager,
  runCreateWorkspace,
} from '@nrwl/e2e/utils';

let proj: string;

describe('Workspace Tests', () => {
  beforeAll(() => {
    proj = newProject();
  });

  afterAll(() => cleanupProject());

  describe('@nrwl/workspace:library', () => {
    it('should create a library that can be tested and linted', async () => {
      const libName = uniq('mylib');
      const dirName = uniq('dir');

      runCLI(`generate @nrwl/workspace:lib ${libName} --directory ${dirName}`);

      checkFilesExist(
        `libs/${dirName}/${libName}/src/index.ts`,
        `libs/${dirName}/${libName}/README.md`
      );

      // Lint
      const result = runCLI(`lint ${dirName}-${libName}`);

      expect(result).toContain(`Linting "${dirName}-${libName}"...`);
      expect(result).toContain('All files pass linting.');

      // Test
      await expectJestTestsToPass('@nrwl/workspace:lib');
    }, 100000);

    it('should be able to use and be used by other libs', () => {
      const consumerLib = uniq('consumer');
      const producerLib = uniq('producer');

      runCLI(`generate @nrwl/workspace:lib ${consumerLib}`);
      runCLI(`generate @nrwl/workspace:lib ${producerLib}`);

      updateFile(
        `libs/${producerLib}/src/lib/${producerLib}.ts`,
        'export const a = 0;'
      );

      updateFile(
        `libs/${consumerLib}/src/lib/${consumerLib}.ts`,
        `
    import { a } from '@${proj}/${producerLib}';

    export function ${consumerLib}() {
      return a + 1;
    }`
      );
      updateFile(
        `libs/${consumerLib}/src/lib/${consumerLib}.spec.ts`,
        `
    import { ${consumerLib} } from './${consumerLib}';

    describe('', () => {
      it('should return 1', () => {
        expect(${consumerLib}()).toEqual(1);
      });
    });`
      );

      runCLI(`test ${consumerLib}`);
    });

    it('should be able to be built when it is buildable', () => {
      const buildableLib = uniq('buildable');

      runCLI(`generate @nrwl/workspace:lib ${buildableLib} --buildable`);

      const result = runCLI(`build ${buildableLib}`);

      expect(result).toContain(
        `Compiling TypeScript files for project "${buildableLib}"...`
      );
      expect(result).toContain(
        `Done compiling TypeScript files for project "${buildableLib}".`
      );

      checkFilesExist(`dist/libs/${buildableLib}/README.md`);

      const json = readJson(`dist/libs/${buildableLib}/package.json`);
      expect(json.main).toEqual('./src/index.js');
      expect(json.typings).toEqual('./src/index.d.ts');
    });
  });

  describe('@nrwl/workspace:npm-package', () => {
    it('should create a minimal npm package', () => {
      const npmPackage = uniq('npm-package');

      runCLI(`generate @nrwl/workspace:npm-package ${npmPackage}`);

      const result = runCLI(`test ${npmPackage}`);
      expect(result).toContain('Hello World');
    });
  });

  describe('@nrwl/workspace + custom scope', () => {
    const packageManager = getSelectedPackageManager() || 'pnpm';

    it('should generate workspace with custom scope', () => {
      const wsName = uniq('scope');
      runCreateWorkspace(wsName, {
        preset: 'core',
        packageManager,
        npmScope: 'my-scope',
      });
      const libName = uniq('mylib');
      runCLI(`generate @nrwl/workspace:lib ${libName}`);

      const tsConfig = readJson('tsconfig.base.json');
      expect(tsConfig.compilerOptions.paths).toEqual({
        [`@my-scope/${libName}`]: [`packages/${libName}/src/index.ts`],
      });
    });

    it('should generate workspace with no scope', () => {
      const wsName = uniq('scope');
      runCreateWorkspace(wsName, {
        preset: 'core',
        packageManager,
        npmScope: '',
      });
      const libName = uniq('mylib');
      runCLI(`generate @nrwl/workspace:lib ${libName}`);

      const tsConfig = readJson('tsconfig.base.json');
      expect(tsConfig.compilerOptions.paths).toEqual({
        [`${libName}`]: [`packages/${libName}/src/index.ts`],
      });
    });
  });

  describe('workspace-generator', () => {
    let custom: string;
    let failing: string;

    beforeEach(() => {
      custom = uniq('custom');
      failing = uniq('custom-failing');
      runCLI(
        `g @nrwl/workspace:workspace-generator ${custom} --no-interactive`
      );
      runCLI(
        `g @nrwl/workspace:workspace-generator ${failing} --no-interactive`
      );

      checkFilesExist(
        `tools/generators/${custom}/index.ts`,
        `tools/generators/${custom}/schema.json`
      );
      checkFilesExist(
        `tools/generators/${failing}/index.ts`,
        `tools/generators/${failing}/schema.json`
      );
    });

    it('should compile only generator files with dependencies', () => {
      const workspace = uniq('workspace');

      updateFile(
        'tools/utils/command-line-utils.ts',
        `
        export const noop = () => {}
        `
      );
      updateFile(
        'tools/utils/logger.ts',
        `
        export const log = (...args: any[]) => console.log(...args)
        `
      );
      updateFile(
        `tools/generators/utils.ts`,
        `
        export const noop = ()=>{}
        `
      );
      updateFile(`tools/generators/${custom}/index.ts`, (content) => {
        return `
          import { log } from '../../utils/logger'; \n
          ${content}
        `;
      });

      runCLI(`workspace-generator ${custom} ${workspace} --no-interactive -d`);

      expect(() =>
        checkFilesExist(
          `dist/out-tsc/tools/generators/${custom}/index.js`,
          `dist/out-tsc/tools/generators/utils.js`,
          `dist/out-tsc/tools/utils/logger.js`
        )
      ).not.toThrow();
      expect(() =>
        checkFilesExist(`dist/out-tsc/tools/utils/utils.js`)
      ).toThrow();
    });

    it('should support workspace-specific generators', async () => {
      const json = readJson(`tools/generators/${custom}/schema.json`);
      json.properties['directory'] = {
        type: 'string',
        description: 'lib directory',
      };
      json.properties['skipTsConfig'] = {
        type: 'boolean',
        description: 'skip changes to tsconfig',
      };
      updateFile(
        `tools/generators/${custom}/schema.json`,
        JSON.stringify(json)
      );

      const indexFile = readFile(`tools/generators/${custom}/index.ts`);
      updateFile(
        `tools/generators/${custom}/index.ts`,
        indexFile.replace(
          'name: schema.name',
          'name: schema.name, directory: schema.directory, skipTsConfig: schema.skipTsConfig'
        )
      );

      const workspace = uniq('workspace');
      const dryRunOutput = runCLI(
        `workspace-generator ${custom} ${workspace} --no-interactive --directory=dir --skipTsConfig=true -d`
      );
      expect(exists(`libs/dir/${workspace}/src/index.ts`)).toEqual(false);
      expect(dryRunOutput).toContain(`UPDATE ${workspaceConfigName()}`);

      const output = runCLI(
        `workspace-generator ${custom} ${workspace} --no-interactive --directory=dir`
      );
      checkFilesExist(`libs/dir/${workspace}/src/index.ts`);
      expect(output).toContain(`UPDATE ${workspaceConfigName()}`);
      expect(output).not.toContain('UPDATE nx.json');

      const jsonFailing = readJson(`tools/generators/${failing}/schema.json`);
      jsonFailing.properties = {};
      jsonFailing.required = [];
      updateFile(
        `tools/generators/${failing}/schema.json`,
        JSON.stringify(jsonFailing)
      );

      updateFile(
        `tools/generators/${failing}/index.ts`,
        `
          export default function() {
            throw new Error();
          }
        `
      );

      try {
        await runCLI(`workspace-generator ${failing} --no-interactive`);
        fail(`Should exit 1 for a workspace-generator that throws an error`);
      } catch (e) {}

      const listOutput = runCLI('workspace-generator --list-generators');
      expect(listOutput).toContain(custom);
      expect(listOutput).toContain(failing);
    }, 1000000);

    it('should support angular devkit schematics', () => {
      const angularDevkitSchematic = uniq('angular-devkit-schematic');
      runCLI(
        `g @nrwl/workspace:workspace-generator ${angularDevkitSchematic} --no-interactive`
      );

      const json = readJson(
        `tools/generators/${angularDevkitSchematic}/schema.json`
      );
      json.properties = {};
      json.required = [];
      delete json.cli;
      updateFile(
        `tools/generators/${angularDevkitSchematic}/schema.json`,
        JSON.stringify(json)
      );

      updateFile(
        `tools/generators/${angularDevkitSchematic}/index.ts`,
        `
          export default function() {
            return (tree) => tree;
          }
        `
      );

      runCLI(`workspace-generator ${angularDevkitSchematic} --no-interactive`);
    });
  });

  describe('move project', () => {
    /**
     * Tries moving a library from ${lib}/data-access -> shared/${lib}/data-access
     */
    it('should work for libraries', () => {
      const lib1 = uniq('mylib');
      const lib2 = uniq('mylib');
      const lib3 = uniq('mylib');
      runCLI(`generate @nrwl/workspace:lib ${lib1}/data-access`);

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

      runCLI(`generate @nrwl/workspace:lib ${lib2}/ui`);

      updateFile(
        `libs/${lib2}/ui/src/lib/${lib2}-ui.ts`,
        `import { fromLibOne } from '@${proj}/${lib1}/data-access';

        export const fromLibTwo = () => fromLibOne();`
      );

      /**
       * Create a library which has an implicit dependency on lib1
       */

      runCLI(`generate @nrwl/workspace:lib ${lib3}`);
      updateProjectConfig(lib3, (config) => {
        config.implicitDependencies = [`${lib1}-data-access`];
        return config;
      });

      /**
       * Now try to move lib1
       */

      const moveOutput = runCLI(
        `generate @nrwl/workspace:move --project ${lib1}-data-access shared/${lib1}/data-access`
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

      let workspaceJson = readJson(workspaceConfigName());
      expect(workspaceJson.projects[`${lib1}-data-access`]).toBeUndefined();
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
          `@${proj}/shared-${lib1}-data-access`
        ]
      ).toEqual([`libs/shared/${lib1}/data-access/src/index.ts`]);

      expect(moveOutput).toContain(`UPDATE workspace.json`);
      workspaceJson = readJson(workspaceConfigName());
      expect(workspaceJson.projects[`${lib1}-data-access`]).toBeUndefined();
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
        `import { fromLibOne } from '@${proj}/shared-${lib1}-data-access';`
      );
    });

    it('should work for libs created with --importPath', () => {
      const importPath = '@wibble/fish';
      const lib1 = uniq('mylib');
      const lib2 = uniq('mylib');
      const lib3 = uniq('mylib');
      runCLI(
        `generate @nrwl/workspace:lib ${lib1}/data-access --importPath=${importPath}`
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

      runCLI(`generate @nrwl/workspace:lib ${lib2}/ui`);

      updateFile(
        `libs/${lib2}/ui/src/lib/${lib2}-ui.ts`,
        `import { fromLibOne } from '${importPath}';

        export const fromLibTwo = () => fromLibOne();`
      );

      /**
       * Create a library which has an implicit dependency on lib1
       */

      runCLI(`generate @nrwl/workspace:lib ${lib3}`);
      updateProjectConfig(lib3, (config) => {
        config.implicitDependencies = [`${lib1}-data-access`];
        return config;
      });

      /**
       * Now try to move lib1
       */

      const moveOutput = runCLI(
        `generate @nrwl/workspace:move --project ${lib1}-data-access shared/${lib1}/data-access`
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
          `@${proj}/shared-${lib1}-data-access`
        ]
      ).toEqual([`libs/shared/${lib1}/data-access/src/index.ts`]);

      expect(moveOutput).toContain(`UPDATE workspace.json`);
      const workspaceJson = readJson(workspaceConfigName());
      expect(workspaceJson.projects[`${lib1}-data-access`]).toBeUndefined();
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
        `import { fromLibOne } from '@${proj}/shared-${lib1}-data-access';`
      );
    });

    it('should work for custom workspace layouts', () => {
      const lib1 = uniq('mylib');
      const lib2 = uniq('mylib');
      const lib3 = uniq('mylib');

      let nxJson = readJson('nx.json');
      nxJson.workspaceLayout = { libsDir: 'packages' };
      updateFile('nx.json', JSON.stringify(nxJson));

      runCLI(`generate @nrwl/workspace:lib ${lib1}/data-access`);

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

      runCLI(`generate @nrwl/workspace:lib ${lib2}/ui`);

      updateFile(
        `packages/${lib2}/ui/src/lib/${lib2}-ui.ts`,
        `import { fromLibOne } from '@${proj}/${lib1}/data-access';

        export const fromLibTwo = () => fromLibOne();`
      );

      /**
       * Create a library which has an implicit dependency on lib1
       */

      runCLI(`generate @nrwl/workspace:lib ${lib3}`);
      updateProjectConfig(lib3, (config) => {
        config.implicitDependencies = [`${lib1}-data-access`];
        return config;
      });

      /**
       * Now try to move lib1
       */

      const moveOutput = runCLI(
        `generate @nrwl/workspace:move --project ${lib1}-data-access shared/${lib1}/data-access`
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
          `@${proj}/shared-${lib1}-data-access`
        ]
      ).toEqual([`packages/shared/${lib1}/data-access/src/index.ts`]);

      expect(moveOutput).toContain(`UPDATE workspace.json`);
      const workspaceJson = readJson(workspaceConfigName());
      expect(workspaceJson.projects[`${lib1}-data-access`]).toBeUndefined();
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
        `import { fromLibOne } from '@${proj}/shared-${lib1}-data-access';`
      );

      nxJson = readJson('nx.json');
      delete nxJson.workspaceLayout;
      updateFile('nx.json', JSON.stringify(nxJson));
    });
  });

  describe('remove project', () => {
    /**
     * Tries creating then deleting a lib
     */
    it('should work', () => {
      const lib1 = uniq('myliba');
      const lib2 = uniq('mylibb');

      runCLI(`generate @nrwl/workspace:lib ${lib1}`);
      expect(exists(tmpProjPath(`libs/${lib1}`))).toBeTruthy();

      /**
       * Create a library which has an implicit dependency on lib1
       */

      runCLI(`generate @nrwl/workspace:lib ${lib2}`);
      updateProjectConfig(lib2, (config) => {
        config.implicitDependencies = [lib1];
        return config;
      });

      /**
       * Try removing the project (should fail)
       */

      let error;
      try {
        console.log(
          runCLI(`generate @nrwl/workspace:remove --project ${lib1}`)
        );
      } catch (e) {
        error = e;
      }

      expect(error).toBeDefined();
      expect(error.stderr.toString()).toContain(
        `${lib1} is still depended on by the following projects`
      );
      expect(error.stderr.toString()).toContain(lib2);

      /**
       * Try force removing the project
       */

      const removeOutputForced = runCLI(
        `generate @nrwl/workspace:remove --project ${lib1} --forceRemove`
      );

      expect(removeOutputForced).toContain(`DELETE libs/${lib1}`);
      expect(exists(tmpProjPath(`libs/${lib1}`))).toBeFalsy();

      expect(removeOutputForced).not.toContain(`UPDATE nx.json`);
      const workspaceJson = readJson(workspaceConfigName());
      expect(workspaceJson.projects[`${lib1}`]).toBeUndefined();
      const lib2Config = readProjectConfig(lib2);
      expect(lib2Config.implicitDependencies).toEqual([]);

      expect(removeOutputForced).toContain(`UPDATE workspace.json`);
      expect(workspaceJson.projects[`${lib1}`]).toBeUndefined();
    });
  });

  describe('workspace-lint', () => {
    it('should identify issues with the workspace', () => {
      // Unfortunately, this is required as this test is testing a different workspace layout
      newProject();
      const appBefore = uniq('before');
      const appAfter = uniq('after');

      // this tests an issue that doesn't come up when using standalone configurations
      runCLI(`generate @nrwl/web:app ${appBefore} --standalone-config false`);
      renameFile(`apps/${appBefore}`, `apps/${appAfter}`);

      const stdout = runCLI('workspace-lint', { silenceError: true });
      expect(stdout).toContain(
        `- Cannot find project '${appBefore}' in 'apps/${appBefore}'`
      );
      expect(stdout).toContain(
        'The following file(s) do not belong to any projects:'
      );
      expect(stdout).toContain(`- apps/${appAfter}/jest.config.ts`);
      expect(stdout).toContain(`- apps/${appAfter}/src/app/app.element.css`);
      expect(stdout).toContain(`- apps/${appAfter}/src/app/app.element.ts`);
      expect(stdout).toContain(
        `- apps/${appAfter}/src/app/app.element.spec.ts`
      );
    });
  });
});
