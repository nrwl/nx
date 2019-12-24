import { NxJson } from '@nrwl/workspace';
import {
  checkFilesExist,
  exists,
  forEachCli,
  newProject,
  readFile,
  readJson,
  runCLI,
  uniq,
  updateFile
} from './utils';

forEachCli(cli => {
  describe('Move Project', () => {
    const workspace: string = cli === 'angular' ? 'angular' : 'workspace';

    /**
     * Tries moving a library from ${lib}/data-access -> shared/${lib}/data-access
     */
    it('should work for libraries', () => {
      const lib1 = uniq('mylib');
      const lib2 = uniq('mylib');
      newProject();
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
       * Create a library which imports a class from the other lib
       */

      runCLI(`generate @nrwl/workspace:lib ${lib2}/ui`);

      updateFile(
        `libs/${lib2}/ui/src/lib/${lib2}-ui.ts`,
        `import { fromLibOne } from '@proj/${lib1}/data-access';

        export const fromLibTwo = () => fromLibOne(); }`
      );

      const moveOutput = runCLI(
        `generate @nrwl/workspace:move --projectName=${lib1}-data-access --destination=shared/${lib1}/data-access`
      );

      expect(moveOutput).toContain(`DELETE libs/${lib1}/data-access`);
      expect(exists(`libs/${lib1}/data-access`)).toBeFalsy();

      const newPath = `libs/shared/${lib1}/data-access`;
      const newName = `shared-${lib1}-data-access`;

      const readmePath = `${newPath}/README.md`;
      expect(moveOutput).toContain(`CREATE ${readmePath}`);
      checkFilesExist(readmePath);

      const jestConfigPath = `${newPath}/jest.config.js`;
      expect(moveOutput).toContain(`CREATE ${jestConfigPath}`);
      checkFilesExist(jestConfigPath);
      const jestConfig = readFile(jestConfigPath);
      expect(jestConfig).toContain(`name: 'shared-${lib1}-data-access'`);
      expect(jestConfig).toContain(`preset: '../../../../jest.config.js'`);
      expect(jestConfig).toContain(
        `coverageDirectory: '../../../../coverage/${newPath}'`
      );

      const tsConfigPath = `${newPath}/tsconfig.json`;
      expect(moveOutput).toContain(`CREATE ${tsConfigPath}`);
      checkFilesExist(tsConfigPath);
      const tsConfig = readJson(tsConfigPath);
      expect(tsConfig.extends).toEqual('../../../../tsconfig.json');

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

      expect(moveOutput).toContain('UPDATE nx.json');
      const nxJson = JSON.parse(readFile('nx.json')) as NxJson;
      expect(nxJson.projects[`${lib1}-data-access`]).toBeUndefined();
      expect(nxJson.projects[newName]).toEqual({
        tags: []
      });

      expect(moveOutput).toContain('UPDATE tsconfig.json');
      const rootTsConfig = readJson('tsconfig.json');
      expect(
        rootTsConfig.compilerOptions.paths[`@proj/${lib1}/data-access`]
      ).toBeUndefined();
      expect(
        rootTsConfig.compilerOptions.paths[`@proj/shared/${lib1}/data-access`]
      ).toEqual([`libs/shared/${lib1}/data-access/src/index.ts`]);

      expect(moveOutput).toContain(`UPDATE ${workspace}.json`);
      const workspaceJson = readJson(`${workspace}.json`);
      expect(workspaceJson.projects[`${lib1}-data-access`]).toBeUndefined();
      const project = workspaceJson.projects[newName];
      expect(project).toBeTruthy();
      expect(project.root).toBe(newPath);
      expect(project.sourceRoot).toBe(`${newPath}/src`);
      expect(project.architect.lint.options.tsConfig).toEqual([
        `libs/shared/${lib1}/data-access/tsconfig.lib.json`,
        `libs/shared/${lib1}/data-access/tsconfig.spec.json`
      ]);

      /**
       * Check that the import in lib2 has been updated
       */
      const lib2FilePath = `libs/${lib2}/ui/src/lib/${lib2}-ui.ts`;
      const lib2File = readFile(lib2FilePath);
      expect(lib2File).toContain(
        `import { fromLibOne } from '@proj/shared/${lib1}/data-access';`
      );
    });
  });
});
