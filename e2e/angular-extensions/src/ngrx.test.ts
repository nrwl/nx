import {
  expectTestsPass,
  getSelectedPackageManager,
  newProject,
  readJson,
  cleanupProject,
  runCLI,
  runCLIAsync,
  uniq,
} from '@nrwl/e2e/utils';

describe('Angular Package', () => {
  describe('ngrx', () => {
    beforeAll(() => newProject());
    afterAll(() => cleanupProject());

    it('should work and work with creators', async () => {
      // ARRANGE

      const myapp = uniq('myapp');
      const mylib = uniq('mylib');

      runCLI(`generate @nrwl/angular:app ${myapp} --no-interactive`);

      // Generate users using data persistence ngrx state management with classes
      runCLI(
        `generate @nrwl/angular:ngrx users --module=apps/${myapp}/src/app/app.module.ts --root --minimal=false --syntax=classes --useDataPersistence=true`
      );

      // Generate ngrx state management with creators
      runCLI(
        `generate @nrwl/angular:ngrx otherUsers --module=apps/${myapp}/src/app/app.module.ts`
      );

      // Generate feature library and ngrx state within that library
      runCLI(`g @nrwl/angular:lib ${mylib} --prefix=fl`);
      runCLI(
        `generate @nrwl/angular:ngrx flights --module=libs/${mylib}/src/lib/${mylib}.module.ts --facade --syntax=classes`
      );

      const flags = `--facade --barrels`;
      runCLI(
        `generate @nrwl/angular:ngrx otherFlights --module=libs/${mylib}/src/lib/${mylib}.module.ts ${flags}`
      );

      const packageJson = readJson('package.json');
      expect(packageJson.dependencies['@ngrx/entity']).toBeDefined();
      expect(packageJson.dependencies['@ngrx/store']).toBeDefined();
      expect(packageJson.dependencies['@ngrx/effects']).toBeDefined();
      expect(packageJson.dependencies['@ngrx/router-store']).toBeDefined();
      expect(packageJson.devDependencies['@ngrx/schematics']).toBeDefined();
      expect(packageJson.devDependencies['@ngrx/store-devtools']).toBeDefined();

      expect(runCLI(`build ${myapp}`)).toMatch(/main\.[a-z0-9]+\.js/);
      expectTestsPass(await runCLIAsync(`test ${myapp} --no-watch`));
      // TODO: remove this condition
      if (getSelectedPackageManager() !== 'pnpm') {
        expectTestsPass(await runCLIAsync(`test ${mylib} --no-watch`));
      }
    }, 1000000);
  });
});
