import {
  forEachCli,
  ensureProject,
  uniq,
  runCLI,
  updateFile,
  expectTestsPass,
  runCLIAsync,
  checkFilesExist,
  readJson
} from './utils';
import { readNxJson } from '@nrwl/workspace';

forEachCli(currentCLIName => {
  const linter = currentCLIName === 'angular' ? 'tslint' : 'eslint';

  describe('Nx Plugin', () => {
    it('should be able to generate a Nx Plugin ', async done => {
      ensureProject();
      const plugin = uniq('plugin');

      runCLI(
        `generate @nrwl/nx-plugin:plugin ${plugin} --linter=${linter} --tags=e2etag,e2ePackage`
      );
      const lintResults = runCLI(`lint ${plugin}`);
      expect(lintResults).toContain('All files pass linting.');

      expectTestsPass(await runCLIAsync(`test ${plugin}`));

      const buildResults = runCLI(`build ${plugin}`);
      expect(buildResults).toContain('Done compiling TypeScript files');
      checkFilesExist(
        `dist/libs/${plugin}/package.json`,
        `dist/libs/${plugin}/collection.json`,
        `dist/libs/${plugin}/builders.json`,
        `dist/libs/${plugin}/src/index.js`,
        `dist/libs/${plugin}/src/schematics/${plugin}/schema.json`,
        `dist/libs/${plugin}/src/schematics/${plugin}/schema.d.ts`,
        `dist/libs/${plugin}/src/schematics/${plugin}/schematic.js`,
        `dist/libs/${plugin}/src/schematics/${plugin}/files/src/index.ts.template`,
        `dist/libs/${plugin}/src/builders/${plugin}/builder.js`,
        `dist/libs/${plugin}/src/builders/${plugin}/schema.d.ts`,
        `dist/libs/${plugin}/src/builders/${plugin}/schema.json`
      );
      const nxJson = readJson('nx.json');
      expect(nxJson).toMatchObject({
        projects: expect.objectContaining({
          [plugin]: {
            tags: ['e2etag', 'e2ePackage']
          },
          [`${plugin}-e2e`]: {
            tags: [],
            implicitDependencies: [`${plugin}`]
          }
        })
      });
      done();
    }, 45000);

    //   it('should be able to build a Nx Plugin lib', async done => {
    //   ensureProject();
    //   const plugin = uniq('plugin');
    //   runCLI(`generate @nrwl/nx-plugin:plugin ${plugin} --linter=${linter}`);
    //   const buildResults = runCLI(`build ${plugin}`);
    // });
  });
});
