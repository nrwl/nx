import {
  cleanupProject,
  newProject,
  runCLI,
  uniq,
  updateFile,
  updateJson,
} from '@nx/e2e/utils';
import { join } from 'path';

describe('js:node executor', () => {
  let scope: string;

  beforeAll(() => {
    scope = newProject();
  });

  afterAll(() => cleanupProject());

  it('should log out the error', async () => {
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

    updateJson(join('libs', esbuildLib, 'project.json'), (config) => {
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

  // TODO: investigate this failure
  xit('should execute library compiled with rollup', async () => {
    const rollupLib = uniq('rolluplib');

    runCLI(
      `generate @nx/js:lib ${rollupLib} --bundler=rollup --no-interactive`
    );

    updateFile(`libs/${rollupLib}/src/index.ts`, () => {
      return `
        console.log('Hello from my library!');
        `;
    });

    updateJson(join('libs', rollupLib, 'project.json'), (config) => {
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

  it('should execute library compiled with tsc', async () => {
    const tscLib = uniq('tsclib');

    runCLI(`generate @nx/js:lib ${tscLib} --bundler=tsc --no-interactive`);

    updateFile(`libs/${tscLib}/src/index.ts`, () => {
      return `
        console.log('Hello from my tsc library!');
        `;
    });

    updateJson(join('libs', tscLib, 'project.json'), (config) => {
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

  it('should execute library compiled with swc', async () => {
    const swcLib = uniq('swclib');

    runCLI(`generate @nx/js:lib ${swcLib} --bundler=swc --no-interactive`);

    updateFile(`libs/${swcLib}/src/index.ts`, () => {
      return `
        console.log('Hello from my swc library!');
        `;
    });

    updateJson(join('libs', swcLib, 'project.json'), (config) => {
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

  it('should execute webpack app', async () => {
    const webpackProject = uniq('webpackproject');

    runCLI(
      `generate @nx/node:application ${webpackProject} --bundler=webpack --no-interactive`
    );

    updateFile(`apps/${webpackProject}/src/main.ts`, () => {
      return `
        console.log('Hello from my webpack app!');
        `;
    });

    updateJson(join('apps', webpackProject, 'project.json'), (config) => {
      config.targets['run-node'] = {
        executor: '@nx/js:node',
        options: {
          buildTarget: `${webpackProject}:build`,
          watch: false,
        },
      };
      return config;
    });

    const output = runCLI(`run ${webpackProject}:run-node`);
    expect(output).toContain('Hello from my webpack app!');
  }, 240_000);
});
