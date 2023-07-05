import {
  cleanupProject,
  newProject,
  runCLI,
  uniq,
  updateFile,
  updateProjectConfig,
} from '@nx/e2e/utils';

describe('js:node error handling', () => {
  let scope: string;

  beforeEach(() => {
    scope = newProject();
  });

  afterEach(() => cleanupProject());

  it('should log out the error', () => {
    const esbuildLib = uniq('esbuildlib');

    runCLI(
      `generate @nx/js:lib ${esbuildLib} --bundler=esbuild --no-interactive`
    );

    updateFile(`libs/${esbuildLib}/src/index.ts`, () => {
      return `
        console.log('Hello from my library!');
        throw new Error('This is an error');
        `;
    });

    updateProjectConfig(esbuildLib, (config) => {
      config.targets['run-node'] = {
        executor: '@nx/js:node',
        options: {
          buildTarget: `${esbuildLib}:build`,
          watch: false,
        },
      };
      return config;
    });

    const output = runCLI(`run ${esbuildLib}:run-node`, {
      redirectStderr: true,
    });
    expect(output).toContain('Hello from my library!');
    expect(output).toContain('This is an error');
  }, 240_000);

  it('should execute library compiled with rollup', () => {
    const rollupLib = uniq('rolluplib');

    runCLI(
      `generate @nx/js:lib ${rollupLib} --bundler=rollup --no-interactive`
    );

    updateFile(`libs/${rollupLib}/src/index.ts`, () => {
      return `
        console.log('Hello from my library!');
        `;
    });

    updateProjectConfig(rollupLib, (config) => {
      config.targets['run-node'] = {
        executor: '@nx/js:node',
        options: {
          buildTarget: `${rollupLib}:build`,
          watch: false,
        },
      };
      return config;
    });

    const output = runCLI(`run ${rollupLib}:run-node`);
    expect(output).toContain('Hello from my library!');
  }, 240_000);

  it('should execute library compiled with tsc', () => {
    const tscLib = uniq('tsclib');

    runCLI(`generate @nx/js:lib ${tscLib} --bundler=tsc --no-interactive`);

    updateFile(`libs/${tscLib}/src/index.ts`, () => {
      return `
        console.log('Hello from my tsc library!');
        `;
    });

    updateProjectConfig(tscLib, (config) => {
      config.targets['run-node'] = {
        executor: '@nx/js:node',
        options: {
          buildTarget: `${tscLib}:build`,
          watch: false,
        },
      };
      return config;
    });

    const output = runCLI(`run ${tscLib}:run-node`);
    expect(output).toContain('Hello from my tsc library!');
  }, 240_000);

  it('should execute library compiled with swc', () => {
    const swcLib = uniq('swclib');

    runCLI(`generate @nx/js:lib ${swcLib} --bundler=swc --no-interactive`);

    updateFile(`libs/${swcLib}/src/index.ts`, () => {
      return `
        console.log('Hello from my swc library!');
        `;
    });

    updateProjectConfig(swcLib, (config) => {
      config.targets['run-node'] = {
        executor: '@nx/js:node',
        options: {
          buildTarget: `${swcLib}:build`,
          watch: false,
        },
      };
      return config;
    });

    const output = runCLI(`run ${swcLib}:run-node`);
    expect(output).toContain('Hello from my swc library!');
  }, 240_000);

  it('should execute webpack app', () => {
    const webpackProject = uniq('webpackproject');

    runCLI(
      `generate @nx/node:application ${webpackProject} --bundler=webpack --no-interactive`
    );

    updateFile(`apps/${webpackProject}/src/main.ts`, () => {
      return `
        console.log('Hello from my webpack app!');
        `;
    });

    updateProjectConfig(webpackProject, (config) => {
      config.targets['run-node'] = {
        executor: '@nx/js:node',
        options: {
          buildTarget: `${webpackProject}:build`,
          watch: false,
        },
      };
      config.targets.build = {
        ...config.targets.build,
        configurations: {
          development: {
            outputPath: 'dist/packages/api-dev',
          },
          production: {
            outputPath: 'dist/packages/api-prod',
          },
        },
      };
      return config;
    });

    const output = runCLI(`run ${webpackProject}:run-node`);
    expect(output).toContain('Hello from my webpack app!');
  }, 240_000);
});
