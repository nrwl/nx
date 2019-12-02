import { ensureProject, updateFile, uniq, runCLI, forEachCli } from './utils';

let originalCIValue: any;

const DEBUG = false;
const l = (str: string) => {
  if (DEBUG) {
    console.log(str);
  }

  return str;
};

forEachCli(() => {
  /**
   * Setting CI=true makes it simpler to configure assertions around output, as there
   * won't be any colors.
   */
  beforeAll(() => {
    originalCIValue = process.env.CI;
    process.env.CI = 'true';
  });

  afterAll(() => {
    process.env.CI = originalCIValue;
  });

  describe('Run Many', () => {
    it('should build specific and all projects', () => {
      ensureProject();
      const libA = uniq('liba-rand');
      const libB = uniq('libb-rand');
      const libC = uniq('libc-rand');
      const libD = uniq('libd-rand');

      l(runCLI(`generate @nrwl/angular:lib ${libA} --publishable`));
      l(runCLI(`generate @nrwl/angular:lib ${libB} --publishable`));
      l(runCLI(`generate @nrwl/angular:lib ${libC} --publishable`));
      l(runCLI(`generate @nrwl/angular:lib ${libD}`));

      l('=======> libA depends on libC');
      updateFile(
        `libs/${libA}/src/lib/${libA}.module.spec.ts`,
        `
              import '@proj/${libC}';
              describe('sample test', () => {
                it('should test', () => {
                  expect(1).toEqual(1);
                });
              });
            `
      );

      l('=======> testing run many starting');

      const buildParallel = l(
        runCLI(
          `run-many --target=build --projects="${libC},${libB}" --parallel`
        )
      );
      expect(buildParallel).toContain(`Running target build for projects:`);
      expect(buildParallel).not.toContain(`- ${libA}`);
      expect(buildParallel).toContain(`- ${libB}`);
      expect(buildParallel).toContain(`- ${libC}`);
      expect(buildParallel).not.toContain(`- ${libD}`);
      expect(buildParallel).toContain('Running target "build" succeeded');

      l('=======> testing run many complete');

      l('=======> testing run many --all starting');
      const buildAllParallel = l(runCLI(`run-many --target=build --all`));
      expect(buildAllParallel).toContain(`Running target build for projects:`);
      expect(buildAllParallel).toContain(`- ${libA}`);
      expect(buildAllParallel).toContain(`- ${libB}`);
      expect(buildAllParallel).toContain(`- ${libC}`);
      expect(buildAllParallel).not.toContain(`- ${libD}`);
      expect(buildAllParallel).toContain('Running target "build" succeeded');

      l('=======> testing run many --all complete');

      l('=======> testing run many --with-deps');

      const buildWithDeps = l(
        runCLI(
          `run-many --target=build --projects="${libA}" --with-deps --parallel`
        )
      );
      expect(buildWithDeps).toContain(`Running target build for projects:`);
      expect(buildWithDeps).toContain(`- ${libA}`);
      expect(buildWithDeps).toContain(`"build" "${libC}"`);
      expect(buildWithDeps).not.toContain(`- ${libB}`);
      expect(buildWithDeps).not.toContain(`- ${libC}`);
      expect(buildWithDeps).not.toContain(`- ${libD}`);
      expect(buildWithDeps).toContain('Running target "build" succeeded');

      l('=======> testing run many --with-deps complete');
    }, 1000000);
  });
});
