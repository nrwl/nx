import {
  newApp,
  runCLI,
  expectTestsPass,
  runCLIAsync,
  uniq,
  ensureProject
} from '../utils';

describe('ngrx', () => {
  it('should work', async () => {
    ensureProject();

    const myapp = uniq('myapp');
    newApp(myapp);

    // Generate root ngrx state management
    runCLI(
      `generate ngrx users --module=apps/${myapp}/src/app/app.module.ts --root`
    );

    const mylib = uniq('mylib');
    // Generate feature library and ngrx state within that library
    runCLI(`g lib ${mylib} --framework angular --prefix=fl`);
    runCLI(
      `generate ngrx flights --module=libs/${mylib}/src/lib/${mylib}.module.ts --facade`
    );

    expect(runCLI(`build ${myapp}`)).toContain('chunk {main} main.js,');
    expectTestsPass(await runCLIAsync(`test ${myapp} --no-watch`));
    expectTestsPass(await runCLIAsync(`test ${mylib} --no-watch`));
  }, 1000000);
});
