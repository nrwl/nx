import { ensureProject, uniq, runCLI, forEachCli } from './utils';

let originalCIValue: any;

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
      const mylib = uniq('mylib');
      const mylib2 = uniq('mylib2');
      const mylib3 = uniq('mylib3');
      runCLI(`generate @nrwl/angular:lib ${mylib} --publishable`);
      runCLI(`generate @nrwl/angular:lib ${mylib2} --publishable`);
      runCLI(`generate @nrwl/angular:lib ${mylib3} --publishable`);

      const buildParallel = runCLI(
        `run-many --target=build --projects="${mylib},${mylib2}" --parallel`
      );
      expect(buildParallel).toContain(`Running target build for projects:`);
      expect(buildParallel).toContain(`- ${mylib}`);
      expect(buildParallel).toContain(`- ${mylib2}`);
      expect(buildParallel).not.toContain(`- ${mylib3}`);
      expect(buildParallel).toContain('Running target "build" succeeded');

      const buildAllParallel = runCLI(
        `run-many --target=build --all --parallel`
      );
      expect(buildAllParallel).toContain(`Running target build for projects:`);
      expect(buildAllParallel).toContain(`- ${mylib}`);
      expect(buildAllParallel).toContain(`- ${mylib2}`);
      expect(buildAllParallel).toContain(`- ${mylib3}`);
      expect(buildAllParallel).toContain('Running target "build" succeeded');
    }, 1000000);
  });
});
