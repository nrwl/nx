import {
  cleanupProject,
  directoryExists,
  exists,
  newProject,
  runCLI,
  runCLIAsync,
  tmpProjPath,
  uniq,
  updateFile,
  updateJson,
} from '@nx/e2e-utils';
import { join } from 'path';

describe('Vite Plugin', () => {
  let proj: string;
  let originalEnv: string;
  beforeAll(() => {
    originalEnv = process.env.NX_ADD_PLUGINS;
    process.env.NX_ADD_PLUGINS = 'false';
    proj = newProject({
      packages: ['@nx/react', '@nx/web'],
    });
  });

  afterAll(() => {
    process.env.NX_ADD_PLUGINS = originalEnv;
    cleanupProject();
  });

  describe('should be able to create libs that use vitest', () => {
    describe('using custom project configuration', () => {
      const lib = uniq('my-custom-lib');
      beforeEach(() => {
        proj = newProject({ name: uniq('vite-proj'), packages: ['@nx/react'] });
      });

      it('should be able to run tests', async () => {
        runCLI(
          `generate @nx/react:lib ${lib} --directory=libs/${lib} --unitTestRunner=vitest`
        );
        expect(exists(tmpProjPath(`libs/${lib}/vite.config.ts`))).toBeTruthy();

        const result = await runCLIAsync(`test ${lib}`);
        expect(result.combinedOutput).toContain(
          `Successfully ran target test for project ${lib}`
        );

        const nestedResults = await runCLIAsync(`test ${lib} --skip-nx-cache`, {
          cwd: `${tmpProjPath()}/libs/${lib}`,
        });
        expect(nestedResults.combinedOutput).toContain(
          `Successfully ran target test for project ${lib}`
        );
      }, 100_000);

      it('should collect coverage', () => {
        runCLI(
          `generate @nx/react:lib ${lib} --directory=libs/${lib} --unitTestRunner=vitest`
        );
        updateFile(`libs/${lib}/vite.config.ts`, () => {
          return `/// <reference types='vitest' />
        import { defineConfig } from 'vite';
        import react from '@vitejs/plugin-react';
        import { nxViteTsPaths } from '@nx/vite/plugins/nx-tsconfig-paths.plugin';
        
        export default defineConfig({
          root: __dirname,
          cacheDir: '../../node_modules/.vite/libs/${lib}',
          plugins: [react(), nxViteTsPaths()],
          test: {
            globals: true,
            cache: {
              dir: '../../node_modules/.vitest',
            },
            environment: 'jsdom',
            include: ['src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
            reporters: ['default'],
            coverage: {
              reportsDirectory: '../../coverage/libs/${lib}',
              provider: 'v8',
              enabled: true,
              thresholds: {
                lines: 100,
                statements: 100,
                functions: 100,
                branches: 1000,
              }
            },
          },
        });
        `;
        });

        const coverageDir = `${tmpProjPath()}/coverage/libs/${lib}`;

        const results = runCLI(`test ${lib} --coverage`, {
          silenceError: true,
        });
        expect(results).toContain(
          `Running target test for project ${lib} failed`
        );
        expect(results).toContain(`ERROR: Coverage`);
        expect(directoryExists(coverageDir)).toBeTruthy();
      }, 100_000);

      it('should not delete the project directory when coverage is enabled', async () => {
        // when coverage is enabled in the vite.config.ts but reportsDirectory is removed
        // from the @nx/vite:test executor options, vite will delete the project root directory
        runCLI(
          `generate @nx/react:lib ${lib} --directory=libs/${lib} --unitTestRunner=vitest`
        );
        updateFile(`libs/${lib}/vite.config.ts`, () => {
          return `import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { nxViteTsPaths } from '@nx/vite/plugins/nx-tsconfig-paths.plugin';


export default defineConfig({
  server: {
    port: 4200,
    host: 'localhost',
  },
  plugins: [
    react(),
    nxViteTsPaths()
  ],
  test: {
    globals: true,
    cache: {
      dir: './node_modules/.vitest',
    },
    environment: 'jsdom',
    include: ['src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    reporters: ['junit'],
    outputFile: 'junit.xml',
    coverage: {
      enabled: true,
      reportsDirectory: 'coverage',
    }
  },
});
`;
        });
        updateJson(join('libs', lib, 'project.json'), (config) => {
          delete config.targets.test.options.reportsDirectory;
          return config;
        });

        const projectRoot = `${tmpProjPath()}/libs/${lib}`;

        const results = runCLI(`test ${lib}`, {
          env: {
            CI: 'true', // prevent vitest from watching for file changes and making the process hang
          },
        });

        expect(directoryExists(projectRoot)).toBeTruthy();
        expect(results).toContain(
          `Successfully ran target test for project ${lib}`
        );
        expect(results).toContain(`JUNIT report written`);
      }, 100_000);

      it('should be able to run tests with inSourceTests set to true', async () => {
        runCLI(
          `generate @nx/react:lib ${lib} --directory=libs/${lib} --unitTestRunner=vitest --inSourceTests`
        );
        expect(
          exists(tmpProjPath(`libs/${lib}/src/lib/${lib}.spec.tsx`))
        ).toBeFalsy();

        updateFile(`libs/${lib}/src/lib/${lib}.tsx`, (content) => {
          content += `
        if (import.meta.vitest) {
          const { expect, it } = import.meta.vitest;
          it('should be successful', () => {
            expect(1 + 1).toBe(2);
          });
        }
        `;
          return content;
        });

        const result = await runCLIAsync(`test ${lib}`);
        expect(result.combinedOutput).toContain(`1 passed`);
      }, 100_000);
    });
  });
});
