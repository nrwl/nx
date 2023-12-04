import { cleanupProject, newProject, runCLI, uniq } from '@nx/e2e/utils';

const myApp = uniq('my-app');

describe('@nx/vite/plugin', () => {
  let proj: string;
  let originalEnv: string;

  beforeAll(() => {
    originalEnv = process.env.NX_PCV3;
    process.env.NX_PCV3 = 'true';
  });

  afterAll(() => {
    process.env.NODE_ENV = originalEnv;
  });

  describe('build and test React Vite app', () => {
    beforeAll(() => {
      proj = newProject();
      runCLI(
        `generate @nx/react:app ${myApp} --bundler=vite --unitTestRunner=vitest`
      );
    });

    afterAll(() => cleanupProject());

    it('should build application', () => {
      const result = runCLI(`build ${myApp}`);
      expect(result).toContain('Successfully ran target build');
    }, 200_000);

    it('should test application', () => {
      const result = runCLI(`test ${myApp}`);
      expect(result).toContain('Successfully ran target test');
    }, 200_000);
  });

  describe('build and test Vue app', () => {
    beforeAll(() => {
      proj = newProject();
      runCLI(`generate @nx/vue:app ${myApp} --unitTestRunner=vitest`);
    });

    afterAll(() => {
      cleanupProject();
    });

    it('should build application', () => {
      const result = runCLI(`build ${myApp}`);
      expect(result).toContain('Successfully ran target build');
    }, 200_000);

    it('should test application', () => {
      const result = runCLI(`test ${myApp}`);
      expect(result).toContain('Successfully ran target test');
    }, 200_000);
  });
});
