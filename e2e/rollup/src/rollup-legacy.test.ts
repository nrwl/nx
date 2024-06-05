import {
  checkFilesExist,
  cleanupProject,
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
    runCLI(`generate @nx/js:lib ${myPkg} --bundler=none`);
    updateFile(`libs/${myPkg}/src/index.ts`, `console.log('Hello');\n`);

    // babel (default)
    runCLI(
      `generate @nx/rollup:configuration ${myPkg} --target=node --tsConfig=libs/${myPkg}/tsconfig.lib.json --main=libs/${myPkg}/src/index.ts`
    );
    rmDist();
    runCLI(`build ${myPkg} --format=cjs,esm --generateExportsField`);
    checkFilesExist(`dist/libs/${myPkg}/index.cjs.d.ts`);
    expect(readJson(`dist/libs/${myPkg}/package.json`).exports).toEqual({
      '.': {
        module: './index.esm.js',
        import: './index.cjs.mjs',
        default: './index.cjs.js',
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
    runCLI(`generate @nx/js:lib ${myPkg} --bundler=none`);
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
    checkFilesExist(`dist/libs/${myPkg}/index.cjs.d.ts`);
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
      },
      './bar': {
        module: './bar.esm.js',
        import: './bar.cjs.mjs',
        default: './bar.cjs.js',
      },
      './foo': {
        module: './foo.esm.js',
        import: './foo.cjs.mjs',
        default: './foo.cjs.js',
      },
    });
  });

  it('should be able to build libs generated with @nx/js:lib --bundler rollup', () => {
    const jsLib = uniq('jslib');
    runCLI(`generate @nx/js:lib ${jsLib} --bundler rollup`);
    expect(() => runCLI(`build ${jsLib}`)).not.toThrow();
  });

  it('should be able to build libs generated with @nx/js:lib --bundler rollup with a custom rollup.config.{cjs|mjs}', () => {
    const jsLib = uniq('jslib');
    runCLI(`generate @nx/js:lib ${jsLib} --bundler rollup`);
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

  it('should support array config from rollup.config.js', () => {
    const jsLib = uniq('jslib');
    runCLI(`generate @nx/js:lib ${jsLib} --bundler rollup --verbose`);
    updateFile(
      `libs/${jsLib}/rollup.config.js`,
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
      config.targets.build.options.rollupConfig = `libs/${jsLib}/rollup.config.js`;
      return config;
    });

    expect(() => runCLI(`build ${jsLib} --format=esm`)).not.toThrow();

    checkFilesExist(`dist/test/index.js`);
  });
});
