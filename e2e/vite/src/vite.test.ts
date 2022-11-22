import {
  cleanupProject,
  createFile,
  killPorts,
  listFiles,
  newProject,
  promisifiedTreeKill,
  readFile,
  rmDist,
  runCLI,
  runCLIAsync,
  runCommandUntil,
  uniq,
  updateFile,
  updateProjectConfig,
} from '@nrwl/e2e/utils';

const myApp = uniq('my-app');

describe('Vite Plugin', () => {
  let proj: string;

  describe('set up new project manually', () => {
    beforeEach(() => {
      proj = newProject();
      runCLI(`generate @nrwl/react:app ${myApp}`);
      runCLI(`generate @nrwl/vite:init`);
      updateFile(
        `apps/${myApp}/index.html`,
        `
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <title>My App</title>
        <base href="/" />

        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" type="image/x-icon" href="favicon.ico" />
      </head>
      <body>
        <div id="root"></div>
        <script type="module" src="src/main.tsx"></script>
      </body>
    </html>
    `
      );

      createFile(
        `apps/${myApp}/src/environments/environment.prod.ts`,
        `export const environment = {
        production: true,
        myTestVar: 'MyProductionValue',
      };`
      );
      createFile(
        `apps/${myApp}/src/environments/environment.ts`,
        `export const environment = {
        production: false,
        myTestVar: 'MyDevelopmentValue',
      };`
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

    it('should build application and replace files', async () => {
      runCLI(`build ${myApp}`);
      expect(readFile(`dist/apps/${myApp}/index.html`)).toBeDefined();
      const fileArray = listFiles(`dist/apps/${myApp}/assets`);
      const mainBundle = fileArray.find((file) => file.endsWith('.js'));
      expect(readFile(`dist/apps/${myApp}/assets/${mainBundle}`)).toContain(
        'MyProductionValue'
      );
      expect(readFile(`dist/apps/${myApp}/assets/${mainBundle}`)).not.toContain(
        'MyDevelopmentValue'
      );
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
  });

  describe('set up new React project with --bundler=vite option', () => {
    beforeEach(() => {
      proj = newProject();
      runCLI(`generate @nrwl/react:app ${myApp} --bundler=vite`);
      updateFile(
        `apps/${myApp}/src/environments/environment.prod.ts`,
        `export const environment = {
        production: true,
        myTestVar: 'MyProductionValue',
      };`
      );
      updateFile(
        `apps/${myApp}/src/environments/environment.ts`,
        `export const environment = {
        production: false,
        myTestVar: 'MyDevelopmentValue',
      };`
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
    });
    afterEach(() => cleanupProject());
    it('should build application and replace files', async () => {
      runCLI(`build ${myApp}`);
      expect(readFile(`dist/apps/${myApp}/index.html`)).toBeDefined();
      const fileArray = listFiles(`dist/apps/${myApp}/assets`);
      const mainBundle = fileArray.find((file) => file.endsWith('.js'));
      expect(readFile(`dist/apps/${myApp}/assets/${mainBundle}`)).toContain(
        'MyProductionValue'
      );
      expect(readFile(`dist/apps/${myApp}/assets/${mainBundle}`)).not.toContain(
        'MyDevelopmentValue'
      );
      rmDist();
    }, 200000);
  });

  describe('convert React webpack project to vite using the vite:configuration generator', () => {
    beforeEach(() => {
      proj = newProject();
      runCLI(`generate @nrwl/react:app ${myApp} --bundler=webpack`);
      runCLI(`generate @nrwl/vite:configuration ${myApp}`);
      updateFile(
        `apps/${myApp}/src/environments/environment.prod.ts`,
        `export const environment = {
        production: true,
        myTestVar: 'MyProductionValue',
      };`
      );
      updateFile(
        `apps/${myApp}/src/environments/environment.ts`,
        `export const environment = {
        production: false,
        myTestVar: 'MyDevelopmentValue',
      };`
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
    });
    afterEach(() => cleanupProject());
    it('should build application and replace files', async () => {
      runCLI(`build ${myApp}`);
      expect(readFile(`dist/apps/${myApp}/index.html`)).toBeDefined();
      const fileArray = listFiles(`dist/apps/${myApp}/assets`);
      const mainBundle = fileArray.find((file) => file.endsWith('.js'));
      expect(readFile(`dist/apps/${myApp}/assets/${mainBundle}`)).toContain(
        'MyProductionValue'
      );
      expect(readFile(`dist/apps/${myApp}/assets/${mainBundle}`)).not.toContain(
        'MyDevelopmentValue'
      );
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
  });
});
