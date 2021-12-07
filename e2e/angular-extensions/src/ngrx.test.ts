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

    it('should work', async () => {
      const myapp = uniq('myapp');
      runCLI(`generate @nrwl/angular:app ${myapp} --no-interactive`);

      // Generate root ngrx state management
      runCLI(
        `generate @nrwl/angular:ngrx users --module=apps/${myapp}/src/app/app.module.ts --root --minimal=false --syntax=classes --useDataPersistence=true`
      );
      const packageJson = readJson('package.json');
      expect(packageJson.dependencies['@ngrx/store']).toBeDefined();
      expect(packageJson.dependencies['@ngrx/effects']).toBeDefined();
      expect(packageJson.dependencies['@ngrx/router-store']).toBeDefined();
      expect(packageJson.devDependencies['@ngrx/store-devtools']).toBeDefined();

      const mylib = uniq('mylib');
      // Generate feature library and ngrx state within that library
      runCLI(`g @nrwl/angular:lib ${mylib} --prefix=fl`);
      runCLI(
        `generate @nrwl/angular:ngrx flights --module=libs/${mylib}/src/lib/${mylib}.module.ts --facade --syntax=classes`
      );

      expect(runCLI(`build ${myapp}`)).toMatch(/main\.[a-z0-9]+\.js/);
      expectTestsPass(await runCLIAsync(`test ${myapp} --no-watch`));
      // TODO: remove this condition
      if (getSelectedPackageManager() !== 'pnpm') {
        expectTestsPass(await runCLIAsync(`test ${mylib} --no-watch`));
      }
    }, 1000000);

    it('should work with creators', async () => {
      const myapp = uniq('myapp');
      runCLI(`generate @nrwl/angular:app ${myapp} --routing --no-interactive`);

      // Generate root ngrx state management
      runCLI(
        `generate @nrwl/angular:ngrx users --module=apps/${myapp}/src/app/app.module.ts --root`
      );
      const packageJson = readJson('package.json');
      expect(packageJson.dependencies['@ngrx/entity']).toBeDefined();
      expect(packageJson.dependencies['@ngrx/store']).toBeDefined();
      expect(packageJson.dependencies['@ngrx/effects']).toBeDefined();
      expect(packageJson.dependencies['@ngrx/router-store']).toBeDefined();
      expect(packageJson.devDependencies['@ngrx/schematics']).toBeDefined();
      expect(packageJson.devDependencies['@ngrx/store-devtools']).toBeDefined();

      const mylib = uniq('mylib');
      // Generate feature library and ngrx state within that library
      runCLI(`g @nrwl/angular:lib ${mylib} --prefix=fl`);

      const flags = `--facade --barrels`;
      runCLI(
        `generate @nrwl/angular:ngrx flights --module=libs/${mylib}/src/lib/${mylib}.module.ts ${flags}`
      );

      expect(runCLI(`build ${myapp}`)).toMatch(/main\.[a-z0-9]+\.js/);
      expectTestsPass(await runCLIAsync(`test ${myapp} --no-watch`));
      // TODO: remove this condition
      if (getSelectedPackageManager() !== 'pnpm') {
        expectTestsPass(await runCLIAsync(`test ${mylib} --no-watch`));
      }
    }, 1000000);
  });
});
