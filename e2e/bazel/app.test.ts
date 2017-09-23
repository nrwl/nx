import {checkFilesExist, cleanup, copyMissingPackages, ngNewBazel, readFile, runCLI, runSchematic} from '../utils';

describe('application', () => {
  beforeEach(cleanup);

  describe('generate', () => {
    it('should work', () => {
      ngNewBazel('--collection=@nrwl/bazel --skip-install');
      runSchematic('@nrwl/bazel:app --name=myApp');

      checkFilesExist(
          `tsconfig.json`, `WORKSPACE`, `BUILD.bazel`, `apps/my-app/BUILD.bazel`, `apps/my-app/src/index.html`,
          `apps/my-app/src/app/app.module.ts`, `apps/my-app/src/app/app.component.ts`);

      expect(readFile('apps/my-app/src/app/app.module.ts')).toContain('bootstrap: [AppComponent]');

      const cliConfig = JSON.parse(readFile('.angular-cli.json'));
      expect(cliConfig.apps.length).toEqual(1);
      expect(cliConfig.apps[0].name).toEqual('myApp');
      expect(cliConfig.apps[0].root).toEqual('apps/my-app/src');
    });

    it('should work with multiple applications', () => {
      runSchematic('@nrwl/bazel:application --name=proj');
      runSchematic('@nrwl/bazel:app --name=first');
      runSchematic('@nrwl/bazel:app --name=second');

      const cliConfig = JSON.parse(readFile('.angular-cli.json'));
      expect(cliConfig.apps[0].name).toEqual('first');
      expect(cliConfig.apps[0].root).toEqual('apps/first/src');
      expect(cliConfig.apps[1].name).toEqual('second');
      expect(cliConfig.apps[1].root).toEqual('apps/second/src');
    });
  });

  describe('build', () => {
    it('should work', () => {
      ngNewBazel('--collection=@nrwl/bazel');
      copyMissingPackages();
      runSchematic('@nrwl/bazel:app --name=myApp');
      expect(runCLI('build')).toContain('main.bundle.js');
    });
  });

  describe('test', () => {
    it('should work', () => {
      ngNewBazel('--collection=@nrwl/bazel');
      copyMissingPackages();
      runSchematic('@nrwl/bazel:app --name=myApp');
      expect(runCLI('test --single-run')).toContain('Executed 1 of 1 SUCCESS');
    });
  });
});
