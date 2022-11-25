import {
  checkFilesExist,
  cleanupProject,
  createFile,
  exists,
  killPorts,
  listFiles,
  newProject,
  promisifiedTreeKill,
  readFile,
  rmDist,
  runCLI,
  runCLIAsync,
  runCommandUntil,
  tmpProjPath,
  uniq,
  updateFile,
  updateProjectConfig,
} from '@nrwl/e2e/utils';

const myApp = uniq('my-app');

describe('Vite Plugin', () => {
  let proj: string;

  describe('Vite on React apps', () => {
    describe('set up new React app manually', () => {
      beforeEach(() => {
        proj = newProject();
        runCLI(`generate @nrwl/react:app ${myApp}`);
        runCLI(`generate @nrwl/vite:init`);
        updateFile(
          `apps/${myApp}/index.html`,
          `
    <!DOCTYPE html>
    <html lang='en'>
      <head>
        <meta charset='utf-8' />
        <title>My App</title>
        <base href='/' />

        <meta name='viewport' content='width=device-width, initial-scale=1' />
        <link rel='icon' type='image/x-icon' href='favicon.ico' />
      </head>
      <body>
        <div id='root'></div>
        <script type='module' src='src/main.tsx'></script>
      </body>
    </html>
    `
        );

        updateFile(
          `apps/${myApp}/src/app/app.tsx`,
          `
        import { environment } from './../environments/environment';
        export function App() {
          return (
            <>
              <h1>{environment.myTestVar}</h1>
              <p>Welcome ${myApp}!</p>
            </>
          );
        }
        export default App;
      `
        );

        createFile(
          `apps/${myApp}/vite.config.ts`,
          `
    /// <reference types="vitest" />
    import { defineConfig } from 'vite';
    import react from '@vitejs/plugin-react';
    import plugin from 'vite-tsconfig-paths';

    export default defineConfig({
      plugins: [
        react(),
        plugin({
          root: '../../',
          projects: ['tsconfig.base.json'],
        }),
      ],
      test: {
        globals: true,
        environment: 'jsdom',
      }
    });`
        );

        updateFile(
          `apps/${myApp}/tsconfig.json`,
          `
      {
        "extends": "../../tsconfig.base.json",
        "compilerOptions": {
          "jsx": "react-jsx",
          "allowJs": false,
          "esModuleInterop": false,
          "allowSyntheticDefaultImports": true,
          "forceConsistentCasingInFileNames": true,
          "isolatedModules": true,
          "lib": ["DOM", "DOM.Iterable", "ESNext"],
          "module": "ESNext",
          "moduleResolution": "Node",
          "noEmit": true,
          "resolveJsonModule": true,
          "skipLibCheck": true,
          "strict": true,
          "target": "ESNext",
          "types": ["vite/client"],
          "useDefineForClassFields": true
        },
        "files": [],
        "include": [],
        "references": [
          {
            "path": "./tsconfig.app.json"
          },
          {
            "path": "./tsconfig.spec.json"
          }
        ]
      }
    `
        );

        updateProjectConfig(myApp, (config) => {
          config.targets.serve.executor = '@nrwl/vite:dev-server';
          config.targets.test.executor = '@nrwl/vite:test';

          config.targets.build = {
            executor: '@nrwl/vite:build',
            outputs: ['{options.outputPath}'],
            defaultConfiguration: 'production',
            options: {
              outputPath: `dist/apps/${myApp}`,
              fileReplacements: [
                {
                  replace: `apps/${myApp}/src/environments/environment.ts`,
                  with: `apps/${myApp}/src/environments/environment.prod.ts`,
                },
              ],
            },
            configurations: {},
          };

          config.targets.serve.options = {
            buildTarget: `${myApp}:build`,
          };

          return config;
        });
      });

      it('should serve application in dev mode', async () => {
        const port = 4212;
        const p = await runCommandUntil(
          `run ${myApp}:serve --port=${port}`,
          (output) => {
            return output.includes('Local:');
          }
        );
        try {
          await promisifiedTreeKill(p.pid, 'SIGKILL');
          await killPorts(port);
        } catch {
          // ignore
        }
      }, 200000);

      it('should test application', async () => {
        const result = await runCLIAsync(`test ${myApp}`);
        expect(result.combinedOutput).toContain(
          `Successfully ran target test for project ${myApp}`
        );
      });
    });

    describe('convert React webpack app to vite using the vite:configuration generator', () => {
      beforeEach(() => {
        proj = newProject();
        runCLI(`generate @nrwl/react:app ${myApp} --bundler=webpack`);
        runCLI(`generate @nrwl/vite:configuration ${myApp}`);

        updateFile(
          `apps/${myApp}/src/app/app.tsx`,
          `
        import { environment } from './../environments/environment';
        export function App() {
          return (
            <>
              <h1>{environment.myTestVar}</h1>
              <p>Welcome ${myApp}!</p>
            </>
          );
        }
        export default App;
      `
        );
      });
      afterEach(() => cleanupProject());

      it('should serve application in dev mode', async () => {
        const port = 4212;
        const p = await runCommandUntil(
          `run ${myApp}:serve --port=${port}`,
          (output) => {
            return output.includes('Local:');
          }
        );
        try {
          await promisifiedTreeKill(p.pid, 'SIGKILL');
          await killPorts(port);
        } catch {
          // ignore
        }
      }, 200000);

      it('should test application', async () => {
        const result = await runCLIAsync(`test ${myApp}`);
        expect(result.combinedOutput).toContain(
          `Successfully ran target test for project ${myApp}`
        );
      });
    });
  });

  describe('Vite on Web apps', () => {
    describe('set up new @nrwl/web app with --bundler=vite option', () => {
      beforeEach(() => {
        proj = newProject();
        runCLI(`generate @nrwl/web:app ${myApp} --bundler=vite`);
      });
      afterEach(() => cleanupProject());
      it('should build application', async () => {
        runCLI(`build ${myApp}`);
        expect(readFile(`dist/apps/${myApp}/index.html`)).toBeDefined();
        const fileArray = listFiles(`dist/apps/${myApp}/assets`);
        const mainBundle = fileArray.find((file) => file.endsWith('.js'));
        expect(
          readFile(`dist/apps/${myApp}/assets/${mainBundle}`)
        ).toBeDefined();
        rmDist();
      }, 200_000);
    });

    describe('convert @nrwl/web webpack app to vite using the vite:configuration generator', () => {
      beforeEach(() => {
        proj = newProject();
        runCLI(`generate @nrwl/web:app ${myApp} --bundler=webpack`);
        runCLI(`generate @nrwl/vite:configuration ${myApp}`);
      });
      afterEach(() => cleanupProject());
      it('should build application', async () => {
        runCLI(`build ${myApp}`);
        expect(readFile(`dist/apps/${myApp}/index.html`)).toBeDefined();
        const fileArray = listFiles(`dist/apps/${myApp}/assets`);
        const mainBundle = fileArray.find((file) => file.endsWith('.js'));
        expect(
          readFile(`dist/apps/${myApp}/assets/${mainBundle}`)
        ).toBeDefined();
        rmDist();
      }, 200000);

      it('should serve application in dev mode', async () => {
        const port = 4212;
        const p = await runCommandUntil(
          `run ${myApp}:serve --port=${port}`,
          (output) => {
            return output.includes('Local:');
          }
        );
        try {
          await promisifiedTreeKill(p.pid, 'SIGKILL');
          await killPorts(port);
        } catch {
          // ignore
        }
      }, 200000);

      it('should test application', async () => {
        const result = await runCLIAsync(`test ${myApp}`);
        expect(result.combinedOutput).toContain(
          `Successfully ran target test for project ${myApp}`
        );
      });
    }),
      100_000;
  });

  describe('should be able to create libs that use vitest', () => {
    const lib = uniq('my-lib');
    beforeEach(() => {
      proj = newProject();
    }),
      100_000;

    it('should be able to run tests', async () => {
      runCLI(`generate @nrwl/react:lib ${lib} --unitTestRunner=vitest`);
      expect(exists(tmpProjPath(`libs/${lib}/vite.config.ts`))).toBeTruthy();

      const result = await runCLIAsync(`test ${lib}`);
      expect(result.combinedOutput).toContain(
        `Successfully ran target test for project ${lib}`
      );
    }),
      100_000;

    it('should be able to run tests with inSourceTests set to true', async () => {
      runCLI(
        `generate @nrwl/react:lib ${lib} --unitTestRunner=vitest --inSourceTests`
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
