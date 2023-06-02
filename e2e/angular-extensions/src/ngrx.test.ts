import {
  cleanupProject,
  expectTestsPass,
  getSelectedPackageManager,
  newProject,
  readJson,
  runCLI,
  runCLIAsync,
  uniq,
} from '@nx/e2e/utils';

describe('Angular Package', () => {
  describe('ngrx', () => {
    beforeAll(() => {
      newProject();
    });
    afterAll(() => {
      cleanupProject();
    });

    it('should work', async () => {
      const myapp = uniq('myapp');
      runCLI(`generate @nx/angular:app ${myapp} --no-interactive`);

      // Generate root ngrx state management
      runCLI(
        `generate @nx/angular:ngrx users --parent=apps/${myapp}/src/app/app.module.ts --root --minimal=false`
      );
      const packageJson = readJson('package.json');
      expect(packageJson.dependencies['@ngrx/store']).toBeDefined();
      expect(packageJson.dependencies['@ngrx/effects']).toBeDefined();
      expect(packageJson.dependencies['@ngrx/router-store']).toBeDefined();
      expect(packageJson.devDependencies['@ngrx/store-devtools']).toBeDefined();

      const mylib = uniq('mylib');
      // Generate feature library and ngrx state within that library
      runCLI(`g @nx/angular:lib ${mylib} --prefix=fl`);
      runCLI(
        `generate @nx/angular:ngrx flights --parent=libs/${mylib}/src/lib/${mylib}.module.ts --facade`
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
      runCLI(`generate @nx/angular:app ${myapp} --routing --no-interactive`);

      // Generate root ngrx state management
      runCLI(
        `generate @nx/angular:ngrx users --parent=apps/${myapp}/src/app/app.module.ts --root`
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
      runCLI(`g @nx/angular:lib ${mylib} --prefix=fl`);

      const flags = `--facade --barrels`;
      runCLI(
        `generate @nx/angular:ngrx flights --parent=libs/${mylib}/src/lib/${mylib}.module.ts ${flags}`
      );

      expect(runCLI(`build ${myapp}`)).toMatch(/main\.[a-z0-9]+\.js/);
      expectTestsPass(await runCLIAsync(`test ${myapp} --no-watch`));
      // TODO: remove this condition
      if (getSelectedPackageManager() !== 'pnpm') {
        expectTestsPass(await runCLIAsync(`test ${mylib} --no-watch`));
      }
    }, 1000000);

    it('should work with creators using --module', async () => {
      const myapp = uniq('myapp');
      runCLI(`generate @nx/angular:app ${myapp} --routing --no-interactive`);

      // Generate root ngrx state management
      runCLI(
        `generate @nx/angular:ngrx users --parent=apps/${myapp}/src/app/app.module.ts --root`
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
      runCLI(`g @nx/angular:lib ${mylib} --prefix=fl`);

      const flags = `--facade --barrels`;
      runCLI(
        `generate @nx/angular:ngrx flights --module=libs/${mylib}/src/lib/${mylib}.module.ts ${flags}`
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
