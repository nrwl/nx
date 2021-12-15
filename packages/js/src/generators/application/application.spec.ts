import { readJson, readProjectConfiguration, Tree } from '@nrwl/devkit';
import { createTreeWithEmptyWorkspace } from '@nrwl/devkit/testing';
import { GeneratorSchema } from '../../utils/schema';
import applicationGenerator from './application';

// most of the functionality is tested via the library generator because the library and application share
// most of the code
// only testing the difference here
describe('app', () => {
  let tree: Tree;
  const defaultOptions: Omit<GeneratorSchema, 'name'> = {
    skipTsConfig: false,
    unitTestRunner: 'jest',
    skipFormat: false,
    linter: 'eslint',
    testEnvironment: 'jsdom',
    js: false,
    pascalCaseFiles: false,
    strict: true,
    config: 'project',
    compiler: 'tsc',
  };

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace(2);
  });

  it('should generate an empty ts app using --config=npm-scripts', async () => {
    await applicationGenerator(tree, {
      ...defaultOptions,
      name: 'myApp',
      config: 'npm-scripts',
    });
    expect(readJson(tree, '/apps/my-app/package.json')).toEqual({
      name: '@proj/my-app',
      version: '0.0.1',
      type: 'commonjs',
      scripts: {
        build: "echo 'implement build'",
        test: "echo 'implement test'",
      },
    });

    expect(tree.exists('apps/my-app/src/index.ts')).toBeTruthy();
    expect(tree.exists('apps/my-app/src/app/my-app.ts')).toBeTruthy();

    // unitTestRunner property is ignored.
    // It only works with our executors.
    expect(tree.exists('apps/my-app/src/app/my-app.spec.ts')).toBeFalsy();
    const workspaceJson = readJson(tree, '/workspace.json');
    // Blocked on Craigory merging optional config PR
    // expect(workspaceJson.projects['my-app']).toBeUndefined();
    // expect(tree.exists('apps/my-app/project.json')).toBeFalsy();
  });

  it('should generate an empty ts app using --config=project', async () => {
    await applicationGenerator(tree, {
      ...defaultOptions,
      name: 'my-app',
      config: 'project',
    });
    const projectConfig = readProjectConfiguration(tree, 'my-app');
    expect(projectConfig.root).toEqual('apps/my-app');
    expect(projectConfig.targets.build).toEqual({
      executor: '@nrwl/js:tsc',
      options: {
        assets: ['apps/my-app/*.md'],
        main: 'apps/my-app/src/index.ts',
        outputPath: 'dist/apps/my-app',
        tsConfig: 'apps/my-app/tsconfig.app.json',
      },
      outputs: ['{options.outputPath}'],
    });
  });
});
