import {
  checkFilesExist,
  cleanupProject,
  exists,
  readFile,
  readJson,
  runCLI,
  uniq,
  updateFile,
} from '@nx/e2e-utils';
import { join } from 'path';
import { setupWorkspaceTests } from './workspace-setup';

describe('move project', () => {
  let proj: string;

  beforeAll(() => {
    proj = setupWorkspaceTests();
  });

  afterAll(() => cleanupProject());

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
    expect(tsConfigLib.compilerOptions.outDir).toEqual('../../../dist/out-tsc');

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
      rootTsConfig.compilerOptions.paths[`@${proj}/shared-${lib1}-data-access`]
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
    expect(tsConfigLib.compilerOptions.outDir).toEqual('../../../dist/out-tsc');

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
      rootTsConfig.compilerOptions.paths[`@${proj}/shared-${lib1}-data-access`]
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
