import {
  cleanupProject,
  createFile,
  newProject,
  readFile,
  removeFile,
  rmDist,
  runCLI,
  uniq,
  updateFile,
  updateJson,
  checkFilesExist,
} from "@nx/e2e-utils";

describe("Vite Plugin", () => {
  let proj: string;
  let originalEnv: string;
  beforeAll(() => {
    originalEnv = process.env.NX_ADD_PLUGINS;
    process.env.NX_ADD_PLUGINS = "false";
    proj = newProject({
      packages: ["@nx/react", "@nx/web"],
    });
  });

  afterAll(() => {
    process.env.NX_ADD_PLUGINS = originalEnv;
    cleanupProject();
  });

  describe("Vite on React apps", () => {
    describe("set up new React app with --bundler=vite option", () => {
      let myApp;

      beforeAll(() => {
        myApp = uniq("my-app");
        runCLI(
          `generate @nx/react:app ${myApp} --bundler=vite --unitTestRunner=vitest`
        );
      });

      afterEach(() => {
        rmDist();
      });

      describe("build the app", () => {
        it("should build application", async () => {
          runCLI(`build ${myApp}`);
          expect(readFile(`dist/${myApp}/favicon.ico`)).toBeDefined();
          expect(readFile(`dist/${myApp}/index.html`)).toBeDefined();
        }, 200_000);

        describe("when the app has static assets", () => {
          beforeAll(() => {
            createFile(`${myApp}/public/hello.md`, `# Hello World`);
          });

          afterAll(() => {
            removeFile(`${myApp}/public/hello.md`);
          });

          it("should copy the assets to the output path", async () => {
            runCLI(`build ${myApp}`);
            expect(readFile(`dist/${myApp}/favicon.ico`)).toBeDefined();
            expect(readFile(`dist/${myApp}/hello.md`)).toBeDefined();
            expect(readFile(`dist/${myApp}/index.html`)).toBeDefined();
          }, 200_000);
        });
      });

      describe("test the app", () => {
        it("should test application", async () => {
          const result = runCLI(`test ${myApp}`);
          expect(result).toContain("Successfully ran target test");
        }, 200_000);

        it("should generate a coverage file specified by the executor", async () => {
          updateJson(`${myApp}/project.json`, (json) => {
            json.targets.test.options.reportsDirectory = "../coverage/test-dir";
            return json;
          });

          const result = runCLI(`test ${myApp} --coverage`);

          checkFilesExist(`coverage/test-dir/index.html`);
          expect(result).toContain("Coverage report");
        }, 200_000);
      });
    });

    describe("set up new React app with --bundler=vite option and use environments api", () => {
      let myApp;

      beforeAll(() => {
        myApp = uniq("my-app");
        runCLI(
          `generate @nx/react:app ${myApp} --bundler=vite --unitTestRunner=vitest`
        );
        updateJson(`${myApp}/project.json`, (json) => {
          json.targets.build.options.useEnvironmentsApi = true;
          return json;
        });
        updateFile(
          `${myApp}/vite.config.ts`,
          `/// <reference types='vitest' />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { nxViteTsPaths } from '@nx/vite/plugins/nx-tsconfig-paths.plugin';
import { nxCopyAssetsPlugin } from '@nx/vite/plugins/nx-copy-assets.plugin';

export default defineConfig({
  root: __dirname,
  cacheDir: './node_modules/.vite/${myApp}',
  server: {
    port: 4200,
    host: 'localhost',
  },
  preview: {
    port: 4300,
    host: 'localhost',
  },
  plugins: [react(), nxViteTsPaths(), nxCopyAssetsPlugin(['*.md'])],
  // Uncomment this if you are using workers.
  // worker: {
  //  plugins: [ nxViteTsPaths() ],
  // },
  builder: {},
  environments: {
    ssr: {
      build: {
        rollupOptions: {
          input: '${myApp}/src/main.server.tsx'
        }
      }
    }
  },
  build: {
    outDir: './dist/${myApp}',
    emptyOutDir: false,
    reportCompressedSize: true,
    commonjsOptions: {
      transformMixedEsModules: true,
    },
  },
  test: {
    watch: false,
    globals: true,
    environment: 'jsdom',
    include: ['src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    reporters: ['default'],
    coverage: {
      reportsDirectory: './coverage/${myApp}',
      provider: 'v8',
    },
  },
});
`
        );
        updateFile(
          `${myApp}/src/main.server.tsx`,
          `import React from 'react'
import ReactDOMServer from 'react-dom/server'
import App from './app/app';

export default async function render(_url: string, document: string) {
  const html = ReactDOMServer.renderToString(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  )
  return document.replace('<!--app-html-->', html);
}`
        );
      });

      afterEach(() => {
        rmDist();
      });

      it("should build application", async () => {
        runCLI(`build ${myApp}`);
        expect(readFile(`dist/${myApp}/favicon.ico`)).toBeDefined();
        expect(readFile(`dist/${myApp}/index.html`)).toBeDefined();
        expect(readFile(`dist/${myApp}/main.server.mjs`)).toBeDefined();
      }, 200_000);
    });
  });
});
