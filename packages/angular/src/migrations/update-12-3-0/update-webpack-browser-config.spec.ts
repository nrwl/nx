import { addProjectConfiguration, readJson, Tree } from '@nrwl/devkit';
import { createTreeWithEmptyWorkspace } from '@nrwl/devkit/testing';
import updateAngularConfig from './update-webpack-browser-config';

function getBuildTarget(tree: Tree) {
  return readJson(tree, 'workspace.json').projects['ng-app'].architect.build;
}

describe('Migration to update targets with @nrwl/angular:webpack-browser executor', () => {
  let tree: Tree;

  beforeEach(async () => {
    tree = createTreeWithEmptyWorkspace();

    addProjectConfiguration(tree, 'ng-app', {
      root: '',
      sourceRoot: 'src',
      projectType: 'application',
      targets: {
        build: {
          executor: '@nrwl/angular:webpack-browser',
          options: {
            aot: true,
            optimization: true,
            experimentalRollupPass: false,
            buildOptimizer: false,
            namedChunks: true,
          } as any,
          configurations: {
            one: {
              aot: true,
            },
            two: {
              experimentalRollupPass: true,
              aot: false,
              optimization: false,
            },
          } as any,
        },
      },
    });
  });

  it(`should remove 'experimentalRollupPass'`, async () => {
    await updateAngularConfig(tree);
    const { configurations, options } = getBuildTarget(tree);

    expect(options.experimentalRollupPass).toBeUndefined();
    expect(options.buildOptimizer).toBe(false);
    expect(configurations).toBeDefined();
    expect(configurations?.one.experimentalRollupPass).toBeUndefined();
    expect(configurations?.two.experimentalRollupPass).toBeUndefined();
  });

  it(`should remove value from "options" section which value is now the new default`, async () => {
    await updateAngularConfig(tree);
    const { configurations, options } = getBuildTarget(tree);

    expect(options.aot).toBeUndefined();
    expect(configurations?.one.aot).toBeUndefined();
    expect(configurations?.two.aot).toBe(false);
  });

  it(`should remove value from "configuration" section when value is the same as that of "options"`, async () => {
    await updateAngularConfig(tree);
    const { configurations, options } = getBuildTarget(tree);

    expect(options.aot).toBeUndefined();
    expect(configurations?.one.aot).toBeUndefined();
    expect(configurations?.two.aot).toBe(false);
  });

  it(`should add value in "options" section when option was not defined`, async () => {
    await updateAngularConfig(tree);
    const { configurations, options } = getBuildTarget(tree);

    expect(options.sourceMap).toBe(true);
    expect(configurations?.one.sourceMap).toBeUndefined();
    expect(configurations?.two.sourceMap).toBeUndefined();
    expect(configurations?.two.optimization).toBe(false);
  });

  it(`should not remove value in "options" when value is not the new default`, async () => {
    await updateAngularConfig(tree);
    const { options } = getBuildTarget(tree);

    expect(options.namedChunks).toBe(true);
    expect(options.buildOptimizer).toBe(false);
  });
});
