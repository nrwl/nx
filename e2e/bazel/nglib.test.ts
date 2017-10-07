import {
  checkFilesExist,
  cleanup,
  copyMissingPackages,
  ngNew,
  ngNewBazel,
  readFile,
  runCLI,
  runCommand,
  runSchematic,
  updateFile
} from '../utils';

describe('angular library', () => {
  beforeEach(cleanup);

  describe('generate', () => {
    it('creates a new  angularlibrary in a workspace', () => {
      ngNewBazel('--collection=@nrwl/bazel --skip-install');
      runSchematic('@nrwl/bazel:nglib --name=myLib');

      checkFilesExist(
        'tsconfig.json',
        'WORKSPACE',
        'BUILD.bazel',
        'libs/my-lib/BUILD.bazel',
        'libs/my-lib/index.ts',
        'libs/my-lib/src/my-lib.module.ts'
      );

      const cliConfig = JSON.parse(readFile('.angular-cli.json'));
      expect(cliConfig.apps[0].name).toEqual('myLib');
      expect(cliConfig.apps[0].root).toEqual('libs/my-lib/src');
    });
  });

  describe('build', () => {
    it('should work', () => {
      ngNewBazel('--collection=@nrwl/bazel');
      copyMissingPackages();
      runSchematic('@nrwl/bazel:nglib --name=myLib');

      expect(runCLI('build')).not.toContain('error');
    });
  });

  describe('test', () => {
    it('should work', () => {
      ngNewBazel('--collection=@nrwl/bazel');
      copyMissingPackages();
      runSchematic('@nrwl/bazel:nglib --name=myLib');
      expect(runCLI('test --single-run')).toContain('Executed 0 of 0');
    });
  });
});
