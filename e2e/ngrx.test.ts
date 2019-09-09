import {
  runCLI,
  expectTestsPass,
  runCLIAsync,
  uniq,
  ensureProject,
  readJson,
  forEachCli
} from './utils';

forEachCli(() => {
  describe('ngrx', () => {
    it('should work', async () => {
      ensureProject();

      const myapp = uniq('myapp');
      runCLI(`generate @nrwl/angular:app ${myapp} --no-interactive`);

      // Generate root ngrx state management
      runCLI(
        `generate @nrwl/angular:ngrx users --module=apps/${myapp}/src/app/app.module.ts --root`
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
        `generate @nrwl/angular:ngrx flights --module=libs/${mylib}/src/lib/${mylib}.module.ts --facade`
      );

      expect(runCLI(`build ${myapp}`)).toContain(
        'chunk {main} main-es2015.js,'
      );
      expect(runCLI(`build ${myapp}`)).toContain(
        'ES5 bundle generation complete'
      );
      expectTestsPass(await runCLIAsync(`test ${myapp} --no-watch`));
      expectTestsPass(await runCLIAsync(`test ${mylib} --no-watch`));
    }, 1000000);

    it('should work with creators', async () => {
      ensureProject();

      const myapp = uniq('myapp');
      runCLI(`generate @nrwl/angular:app ${myapp} --routing --no-interactive`);

      // Generate root ngrx state management
      runCLI(
        `generate @nrwl/angular:ngrx users --module=apps/${myapp}/src/app/app.module.ts --root --minimal --syntax=creators`
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

      const flags = `--facade --syntax=creators --useDataPersistence=false --barrels`;
      runCLI(
        `generate @nrwl/angular:ngrx flights --module=libs/${mylib}/src/lib/${mylib}.module.ts ${flags}`
      );

      expect(runCLI(`build ${myapp}`)).toContain(
        'chunk {main} main-es2015.js,'
      );
      expect(runCLI(`build ${myapp}`)).toContain(
        'ES5 bundle generation complete'
      );
      expectTestsPass(await runCLIAsync(`test ${myapp} --no-watch`));
      expectTestsPass(await runCLIAsync(`test ${mylib} --no-watch`));
    }, 1000000);
  });
});
