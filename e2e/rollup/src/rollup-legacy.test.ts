import {
  checkFilesExist,
  cleanupProject,
  getPublishedVersion,
  newProject,
  packageInstall,
  readJson,
  rmDist,
  runCLI,
  runCommand,
  uniq,
  updateFile,
  updateJson,
} from '@nx/e2e/utils';
import { join } from 'path';

describe('Rollup Plugin', () => {
  let originalAddPluginsEnv: string | undefined;

  beforeAll(() => {
    originalAddPluginsEnv = process.env.NX_ADD_PLUGINS;
    process.env.NX_ADD_PLUGINS = 'false';
    newProject({ packages: ['@nx/rollup', '@nx/js'] });
  });

  afterAll(() => {
    process.env.NX_ADD_PLUGINS = originalAddPluginsEnv;
    cleanupProject();
  });

  it('should be able to setup project to build node programs with rollup and different compilers', async () => {
    const myPkg = uniq('my-pkg');
    runCLI(
      `generate @nx/js:lib ${myPkg} --directory=libs/${myPkg} --bundler=none`
    );
    updateFile(`libs/${myPkg}/src/index.ts`, `console.log('Hello');\n`);

    // babel (default)
    runCLI(
      `generate @nx/rollup:configuration ${myPkg} --target=node --tsConfig=libs/${myPkg}/tsconfig.lib.json --main=libs/${myPkg}/src/index.ts`
    );
    rmDist();
    runCLI(`build ${myPkg} --format=cjs,esm --generateExportsField`);
    checkFilesExist(`dist/libs/${myPkg}/index.d.ts`);
    expect(readJson(`dist/libs/${myPkg}/package.json`).exports).toEqual({
      '.': {
        module: './index.esm.js',
        import: './index.cjs.mjs',
        default: './index.cjs.js',
        types: './index.d.ts',
      },
      './package.json': './package.json',
    });
    let output = runCommand(`node dist/libs/${myPkg}/index.cjs.js`);
    expect(output).toMatch(/Hello/);

    updateJson(join('libs', myPkg, 'project.json'), (config) => {
      delete config.targets.build;
      return config;
    });

    // swc
    runCLI(
      `generate @nx/rollup:configuration ${myPkg} --target=node --tsConfig=libs/${myPkg}/tsconfig.lib.json --main=libs/${myPkg}/src/index.ts --compiler=swc`
    );
    rmDist();
    runCLI(`build ${myPkg} --format=cjs,esm --generateExportsField`);
    output = runCommand(`node dist/libs/${myPkg}/index.cjs.js`);
    expect(output).toMatch(/Hello/);

    updateJson(join('libs', myPkg, 'project.json'), (config) => {
      delete config.targets.build;
      return config;
    });

    // tsc
    runCLI(
      `generate @nx/rollup:configuration ${myPkg} --target=node --tsConfig=libs/${myPkg}/tsconfig.lib.json --main=libs/${myPkg}/src/index.ts --compiler=tsc`
    );
    rmDist();
    runCLI(`build ${myPkg} --format=cjs,esm --generateExportsField`);
    output = runCommand(`node dist/libs/${myPkg}/index.cjs.js`);
    expect(output).toMatch(/Hello/);
  }, 500000);

  it('should support additional entry-points', async () => {
    const myPkg = uniq('my-pkg');
    runCLI(
      `generate @nx/js:lib ${myPkg} --directory=libs/${myPkg} --bundler=none`
    );
    runCLI(
      `generate @nx/rollup:configuration ${myPkg} --target=node --tsConfig=libs/${myPkg}/tsconfig.lib.json --main=libs/${myPkg}/src/index.ts --compiler=tsc`
    );
    updateJson(join('libs', myPkg, 'project.json'), (config) => {
      config.targets.build.options.format = ['cjs', 'esm'];
      config.targets.build.options.generateExportsField = true;
      config.targets.build.options.additionalEntryPoints = [
        `libs/${myPkg}/src/{foo,bar}.ts`,
      ];
      return config;
    });
    updateFile(`libs/${myPkg}/src/foo.ts`, `export const foo = 'foo';`);
    updateFile(`libs/${myPkg}/src/bar.ts`, `export const bar = 'bar';`);

    runCLI(`build ${myPkg}`);

    checkFilesExist(`dist/libs/${myPkg}/index.esm.js`);
    checkFilesExist(`dist/libs/${myPkg}/index.cjs.js`);
    checkFilesExist(`dist/libs/${myPkg}/index.d.ts`);
    checkFilesExist(`dist/libs/${myPkg}/foo.esm.js`);
    checkFilesExist(`dist/libs/${myPkg}/foo.cjs.js`);
    checkFilesExist(`dist/libs/${myPkg}/bar.esm.js`);
    checkFilesExist(`dist/libs/${myPkg}/bar.cjs.js`);
    expect(readJson(`dist/libs/${myPkg}/package.json`).exports).toEqual({
      './package.json': './package.json',
      '.': {
        module: './index.esm.js',
        import: './index.cjs.mjs',
        default: './index.cjs.js',
        types: './index.d.ts',
      },
      './bar': {
        module: './bar.esm.js',
        import: './bar.cjs.mjs',
        default: './bar.cjs.js',
        types: './bar.d.ts',
      },
      './foo': {
        module: './foo.esm.js',
        import: './foo.cjs.mjs',
        default: './foo.cjs.js',
        types: './foo.d.ts',
      },
    });
  });

  it('should be able to build libs generated with @nx/js:lib --bundler rollup', () => {
    const jsLib = uniq('jslib');
    runCLI(
      `generate @nx/js:lib ${jsLib} --directory=libs/${jsLib} --bundler rollup`
    );
    expect(() => runCLI(`build ${jsLib}`)).not.toThrow();
  });

  it('should be able to build libs generated with @nx/js:lib --bundler rollup with a custom rollup.config.{cjs|mjs}', () => {
    const jsLib = uniq('jslib');
    runCLI(
      `generate @nx/js:lib ${jsLib} --directory=libs/${jsLib} --bundler rollup`
    );
    updateFile(
      `libs/${jsLib}/rollup.config.cjs`,
      `module.exports = {
        output: {
          format: "cjs",
          dir: "dist/test",
          name: "Mylib",
          entryFileNames: "[name].cjs.js",
          chunkFileNames: "[name].cjs.js"
        }
      }`
    );
    updateJson(join('libs', jsLib, 'project.json'), (config) => {
      config.targets.build.options.rollupConfig = `libs/${jsLib}/rollup.config.cjs`;
      return config;
    });
    expect(() => runCLI(`build ${jsLib}`)).not.toThrow();
    checkFilesExist(`dist/test/index.cjs.js`);

    updateFile(
      `libs/${jsLib}/rollup.config.mjs`,
      `export default {
        output: {
          format: "es",
          dir: "dist/test",
          name: "Mylib",
          entryFileNames: "[name].mjs.js",
          chunkFileNames: "[name].mjs.js"
        }
      }`
    );
    updateJson(join('libs', jsLib, 'project.json'), (config) => {
      config.targets.build.options.rollupConfig = `libs/${jsLib}/rollup.config.mjs`;
      return config;
    });
    expect(() => runCLI(`build ${jsLib}`)).not.toThrow();
    checkFilesExist(`dist/test/index.mjs.js`);
  });

  it('should support array config from rollup.config.cjs', () => {
    const jsLib = uniq('jslib');
    runCLI(
      `generate @nx/js:lib ${jsLib} --directory=libs/${jsLib} --bundler rollup --verbose`
    );
    updateFile(
      `libs/${jsLib}/rollup.config.cjs`,
      `module.exports = (config) => [{
        ...config,
        output: {
          format: "esm",
          dir: "dist/test",
          name: "Mylib",
          entryFileNames: "[name].js",
          chunkFileNames: "[name].js"
        }
      }]`
    );
    updateJson(join('libs', jsLib, 'project.json'), (config) => {
      config.targets.build.options.rollupConfig = `libs/${jsLib}/rollup.config.cjs`;
      return config;
    });

    expect(() => runCLI(`build ${jsLib} --format=esm`)).not.toThrow();

    checkFilesExist(`dist/test/index.js`);
  });

  it('should always generate package.json even if the plugin is removed from rollup config file (Nx < 19.4 behavior)', () => {
    const jsLib = uniq('jslib');
    runCLI(
      `generate @nx/js:lib ${jsLib} --directory=libs/${jsLib} --bundler rollup --verbose`
    );
    updateFile(
      `libs/${jsLib}/rollup.config.cjs`,
      `module.exports = (config) => ({
        ...config,
        // Filter out the plugin, but the @nx/rollup:rollup executor should add it back
        plugins: config.plugins.filter((p) => p.name !== 'rollup-plugin-nx-generate-package-json'),
      })`
    );
    updateJson(join('libs', jsLib, 'project.json'), (config) => {
      config.targets.build.options.rollupConfig = `libs/${jsLib}/rollup.config.cjs`;
      return config;
    });

    expect(() => runCLI(`build ${jsLib}`)).not.toThrow();

    checkFilesExist(`dist/libs/${jsLib}/package.json`);
  });

  // This tests the case where a dependency has no source code, but the files are generated in dist and should not cause the parent library to fail.
  // This does not handle rolling up d.ts files from dependencies, thus is not a feature we support out of the box.
  // See: https://github.com/nrwl/nx/issues/10395
  it('should support building libraries from dist (e.g. buildLibsFromSource: false)', async () => {
    const parentLib = uniq('parent');
    const childLib = uniq('child');
    packageInstall('tsconfig-paths', undefined, '4.2.0', 'prod');
    packageInstall('@nx/devkit', undefined, getPublishedVersion(), 'prod');
    runCLI(`generate @nx/js:lib libs/${parentLib} --bundler rollup`);
    runCLI(`generate @nx/js:lib libs/${childLib} --bundler none`);
    updateFile(
      `libs/${childLib}/package.json`,
      JSON.stringify({ name: `@proj/${childLib}` })
    );
    // Update child library such that it generates code rather than contain any source files.
    updateJson(`libs/${childLib}/project.json`, (json) => {
      json.targets = {
        build: {
          command: 'node gen.cjs',
          outputs: [`{workspaceRoot}/dist/libs/${childLib}`],
        },
      };
      return json;
    });
    // Code generator for child library.
    updateFile(
      'gen.cjs',
      `
        const fs = require('node:fs');
        const path = require('node:path');
        const OUTPUT_PATH = path.join('dist', 'libs', '${childLib}');
        if (fs.existsSync(OUTPUT_PATH)) {
          fs.rmSync(OUTPUT_PATH, { recursive: true });
        }
        fs.mkdirSync(OUTPUT_PATH, { recursive: true });
        const packageJson = {
          name: '@proj/${childLib}',
          version: '1.0.0',
          main: 'index.js',
          types: 'index.d.ts'
        };
        fs.writeFileSync(
          path.join(OUTPUT_PATH, 'package.json'),
          JSON.stringify(packageJson, null, 2)
        );
        fs.writeFileSync(
          path.join(OUTPUT_PATH, 'index.js'),
          'export const hello = () => "hello";\\n'
        );
        fs.writeFileSync(
          path.join(OUTPUT_PATH, 'index.d.ts'),
          'export declare const hello: () => string;\\n'
        );
    `
    );
    // Use the child library, which only works if pointing to dist since there are no source files.
    updateFile(
      `libs/${parentLib}/src/index.ts`,
      `
        import { hello } from '@proj/${childLib}';
        console.log(hello());
      `
    );
    // Update rollup config so path aliases works for workspace libs and may be bundled.
    updateJson(`libs/${parentLib}/project.json`, (json) => {
      json.targets.build.options.buildLibsFromSource = false;
      json.targets.build.options.rollupConfig = `libs/${parentLib}/rollup.config.mjs`;
      return json;
    });
    updateFile(
      `libs/${parentLib}/rollup.config.mjs`,
      `
        import {
          createProjectGraphAsync,
          workspaceRoot,
        } from '@nx/devkit';
        import { dirname, join, relative } from 'node:path';
        import { fileURLToPath } from 'node:url';
        import {
          loadConfig,
          createMatchPath,
        } from 'tsconfig-paths';
        import {
          calculateProjectBuildableDependencies,
          createTmpTsConfig,
        } from '@nx/js/src/utils/buildable-libs-utils.js';
        
        const __dirname = dirname(fileURLToPath(import.meta.url));
        
        function tsconfigPaths(tsconfigPath) {
          let matcher;
          return {
            name: 'tsconfig-paths',
            async buildStart() {
              const projectGraph = await createProjectGraphAsync({
                exitOnError: false,
                resetDaemonClient: true,
              });
              const { dependencies } = calculateProjectBuildableDependencies(
                undefined,
                projectGraph,
                workspaceRoot,
                process.env.NX_TASK_TARGET_PROJECT,
                process.env.NX_TASK_TARGET_TARGET,
                process.env.NX_TASK_TARGET_CONFIGURATION
              );
              const tmpTsconfigPath = createTmpTsConfig(
                tsconfigPath,
                workspaceRoot,
                relative(workspaceRoot, __dirname),
                dependencies,
                true
              );
              const parsed = loadConfig(tmpTsconfigPath);
              matcher = createMatchPath(
                parsed.absoluteBaseUrl,
                parsed.paths,
              );
        
            },
            resolveId(importPath) {
              let resolvedFile;
              try {
                resolvedFile = matcher(importPath);
                return resolvedFile || null;
              } catch (e) {
                return null;
              }
            },
          }
        }
        
        export default (config) => {
          config.plugins.push(tsconfigPaths(
            join(__dirname, 'tsconfig.lib.json'),
          ));
          return config;
        }
      `
    );

    expect(() => runCLI(`build ${parentLib} --verbose`)).not.toThrow();
  });
});
