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
});
