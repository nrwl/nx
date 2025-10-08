import {
  checkFilesExist,
  cleanupProject,
  getPackageManagerCommand,
  newProject,
  runCLI,
  runCommand,
  uniq,
  updateFile,
  updateJson,
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

  describe("ESM-only apps", () => {
    beforeAll(() => {
      newProject({
        packages: ["@nx/react"],
      });
    });

    it("should support ESM-only plugins in vite.config.ts for root apps (#NXP-168)", () => {
      // ESM-only plugin to test with
      updateFile(
        "foo/package.json",
        JSON.stringify({
          name: "@acme/foo",
          type: "module",
          version: "1.0.0",
          main: "index.js",
        })
      );
      updateFile(
        "foo/index.js",
        `
        export default function fooPlugin() {
          return {
            name: 'foo-plugin',
            configResolved() {
              console.log('Foo plugin');
            }
          }
        }`
      );
      updateJson("package.json", (json) => {
        json.devDependencies["@acme/foo"] = "file:./foo";
        return json;
      });
      runCommand(getPackageManagerCommand().install);

      const rootApp = uniq("root");
      runCLI(
        `generate @nx/react:app ${rootApp} --rootProject --bundler=vite --unitTestRunner=none --e2eTestRunner=none --style=css --no-interactive`
      );
      updateJson(`package.json`, (json) => {
        // This allows us to use ESM-only packages in vite.config.ts.
        json.type = "module";
        return json;
      });
      updateFile(
        `vite.config.ts`,
        `
        import fooPlugin from '@acme/foo';
        import { defineConfig } from 'vite';
        import react from '@vitejs/plugin-react';
        import { nxViteTsPaths } from '@nx/vite/plugins/nx-tsconfig-paths.plugin';
        
        export default defineConfig({
          cacheDir: '../../node_modules/.vite/root-app',
          server: {
            port: 4200,
            host: 'localhost',
          },
          plugins: [react(), nxViteTsPaths(), fooPlugin()],
        });`
      );

      runCLI(`build ${rootApp}`);

      checkFilesExist(`dist/${rootApp}/index.html`);
    });
  });
});
