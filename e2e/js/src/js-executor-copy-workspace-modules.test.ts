import {
  checkFilesExist,
  cleanupProject,
  newProject,
  readFile,
  readJson,
  runCLI,
  uniq,
  updateJson,
  updateFile,
  runCommand,
} from '@nx/e2e/utils';

describe('@nx/js:copy-workspace-modules', () => {
  let scope: string;

  beforeAll(() => {
    scope = newProject({
      packages: ['@nx/node', '@nx/js'],
      preset: 'ts',
      packageManager: 'pnpm',
    });
  });

  afterAll(() => {
    cleanupProject();
  });

  it('should copy a single workspace library to build output directory', async () => {
    const nodeapp = uniq('nodeapp');
    const nodelib = uniq('nodelib');

    // Generate a node application
    runCLI(
      `generate @nx/node:app ${nodeapp} --linter=eslint --unitTestRunner=jest`
    );

    // Generate a workspace library
    runCLI(
      `generate @nx/js:lib ${nodelib} --bundler=tsc --linter=eslint --unitTestRunner=jest`
    );

    // Update the library to export something testable
    updateFile(
      `${nodelib}/src/lib/${nodelib}.ts`,
      `export function ${nodelib}() {
  return '${nodelib} works!';
}`
    );

    updateFile(
      `${nodelib}/src/index.ts`,
      `export * from './lib/${nodelib}.js';`
    );

    // Add workspace dependency to the app's package.json
    updateJson(`${nodeapp}/package.json`, (json) => {
      json.dependencies = {
        ...json.dependencies,
        [`@${scope}/${nodelib}`]: 'workspace:*',
      };
      return json;
    });
    runCommand(`pnpm install`);

    // Update the app to use the library
    updateFile(
      `${nodeapp}/src/main.ts`,
      `import { ${nodelib} } from '@${scope}/${nodelib}';
console.log('Hello World!');
console.log(${nodelib}());`
    );

    // Build the application first (required for copy-workspace-modules)
    runCLI(`build ${nodeapp}`);

    // Verify build output exists (should be in {projectRoot}/dist)
    checkFilesExist(`${nodeapp}/dist/main.js`);

    // Add copy-workspace-modules target to the app's package.json nx targets
    updateJson(`${nodeapp}/package.json`, (json) => {
      if (!json.nx) {
        json.nx = {};
      }
      if (!json.nx.targets) {
        json.nx.targets = {};
      }
      json.nx.targets['copy-workspace-modules'] = {
        executor: '@nx/js:copy-workspace-modules',
        options: {
          buildTarget: 'build',
        },
      };
      return json;
    });

    // Run the copy-workspace-modules executor
    const result = runCLI(`run ${nodeapp}:copy-workspace-modules`);
    expect(result).toContain('Success!');

    // Verify workspace_modules directory was created in the build output
    checkFilesExist(`${nodeapp}/dist/workspace_modules`);

    // Verify the library was copied to workspace_modules
    checkFilesExist(
      `${nodeapp}/dist/workspace_modules/@${scope}/${nodelib}/package.json`
    );
  }, 300_000);

  it('should copy multiple workspace libraries correctly', async () => {
    const nodeapp = uniq('nodeapp');
    const nodelib1 = uniq('nodelib1');
    const nodelib2 = uniq('nodelib2');

    // Generate a node application
    runCLI(
      `generate @nx/node:app ${nodeapp} --linter=eslint --unitTestRunner=jest`
    );

    // Generate workspace libraries
    runCLI(
      `generate @nx/js:lib ${nodelib1} --bundler=tsc --linter=eslint --unitTestRunner=jest`
    );
    runCLI(
      `generate @nx/js:lib ${nodelib2} --bundler=tsc --linter=eslint --unitTestRunner=jest`
    );

    // Update libraries to export something testable
    updateFile(
      `${nodelib1}/src/lib/${nodelib1}.ts`,
      `export function ${nodelib1}() {
  return '${nodelib1} works!';
}`
    );
    updateFile(
      `${nodelib1}/src/index.ts`,
      `export * from './lib/${nodelib1}.js';`
    );

    updateFile(
      `${nodelib2}/src/lib/${nodelib2}.ts`,
      `export function ${nodelib2}() {
  return '${nodelib2} works!';
}`
    );
    updateFile(
      `${nodelib2}/src/index.ts`,
      `export * from './lib/${nodelib2}.js';`
    );

    // Add workspace dependencies to the app's package.json
    updateJson(`${nodeapp}/package.json`, (json) => {
      json.dependencies = {
        ...json.dependencies,
        [`@${scope}/${nodelib1}`]: 'workspace:*',
        [`@${scope}/${nodelib2}`]: 'workspace:*',
      };
      return json;
    });

    // Update the app to use both libraries
    updateFile(
      `${nodeapp}/src/main.ts`,
      `import { ${nodelib1} } from '@${scope}/${nodelib1}';
import { ${nodelib2} } from '@${scope}/${nodelib2}';
console.log('Hello World!');
console.log(${nodelib1}());
console.log(${nodelib2}());`
    );
    runCommand(`pnpm install`);

    // Build the application
    runCLI(`build ${nodeapp}`);

    // Add copy-workspace-modules target
    updateJson(`${nodeapp}/package.json`, (json) => {
      if (!json.nx) {
        json.nx = {};
      }
      if (!json.nx.targets) {
        json.nx.targets = {};
      }
      json.nx.targets['copy-workspace-modules'] = {
        executor: '@nx/js:copy-workspace-modules',
        options: {
          buildTarget: 'build',
        },
      };
      return json;
    });

    // Run the copy-workspace-modules executor
    const result = runCLI(`run ${nodeapp}:copy-workspace-modules`);
    expect(result).toContain('Success!');

    // Verify both libraries were copied
    checkFilesExist(
      `${nodeapp}/dist/workspace_modules/@${scope}/${nodelib1}/package.json`,
      `${nodeapp}/dist/workspace_modules/@${scope}/${nodelib2}/package.json`
    );
  }, 300_000);

  it('should handle file: protocol dependencies', async () => {
    const nodeapp = uniq('nodeapp');
    const nodelib = uniq('nodelib');

    // Generate a node application and library
    runCLI(
      `generate @nx/node:app ${nodeapp} --linter=eslint --unitTestRunner=jest`
    );
    runCLI(
      `generate @nx/js:lib ${nodelib} --bundler=tsc --linter=eslint --unitTestRunner=jest`
    );

    // Add file: protocol dependency
    updateJson(`${nodeapp}/package.json`, (json) => {
      json.dependencies = {
        ...json.dependencies,
        [`@${scope}/${nodelib}`]: `file:../${nodelib}`,
      };
      return json;
    });
    runCommand(`pnpm install`);

    // Build the application
    runCLI(`build ${nodeapp}`);

    // Add copy-workspace-modules target
    updateJson(`${nodeapp}/package.json`, (json) => {
      if (!json.nx) {
        json.nx = {};
      }
      if (!json.nx.targets) {
        json.nx.targets = {};
      }
      json.nx.targets['copy-workspace-modules'] = {
        executor: '@nx/js:copy-workspace-modules',
        options: {
          buildTarget: 'build',
        },
      };
      return json;
    });

    // Run the copy-workspace-modules executor
    const result = runCLI(`run ${nodeapp}:copy-workspace-modules`);
    expect(result).toContain('Success!');

    // Verify library was copied
    checkFilesExist(
      `${nodeapp}/dist/workspace_modules/@${scope}/${nodelib}/package.json`
    );
  }, 300_000);
});
