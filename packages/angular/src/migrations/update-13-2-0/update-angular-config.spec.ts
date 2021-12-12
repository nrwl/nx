import {
  addProjectConfiguration,
  readProjectConfiguration,
} from '@nrwl/devkit';
import { createTreeWithEmptyWorkspace } from '@nrwl/devkit/testing';
import updateAngularConfig from './update-angular-config';

describe('update-angular-config migration', () => {
  it('should remove deprecated options from webpack server executor', async () => {
    // ARRANGE
    const tree = createTreeWithEmptyWorkspace(2);
    addProjectConfiguration(tree, 'testing', {
      root: 'apps/testing',
      targets: {
        build: {
          executor: '@nrwl/angular:webpack-server',
          options: {
            somethingThatShouldNotBeRemoved: true,
            optimization: true,
            aot: true,
            progress: true,
            deployUrl: 'myurl.com',
            sourceMap: true,
            vendorChunk: true,
            commonChunk: true,
            baseHref: '/',
            servePathDefaultWarning: true,
            hmrWarning: true,
            extractCss: true,
          },
        },
      },
    });

    // ACT
    await updateAngularConfig(tree);

    // ASSERT
    const { targets } = readProjectConfiguration(tree, 'testing');
    expect(targets.build.options.somethingThatShouldNotBeRemoved).toBeDefined();
    expect(targets.build.options.optimization).toBeUndefined();
    expect(targets.build.options.aot).toBeUndefined();
    expect(targets.build.options.progress).toBeUndefined();
    expect(targets.build.options.deployUrl).toBeUndefined();
    expect(targets.build.options.sourceMap).toBeUndefined();
    expect(targets.build.options.vendorChunk).toBeUndefined();
    expect(targets.build.options.commonChunk).toBeUndefined();
    expect(targets.build.options.baseHref).toBeUndefined();
    expect(targets.build.options.servePathDefaultWarning).toBeUndefined();
    expect(targets.build.options.hmrWarning).toBeUndefined();
    expect(targets.build.options.extractCss).toBeUndefined();
  });

  it('should remove deprecated options from webpack browser executor', async () => {
    // ARRANGE
    const tree = createTreeWithEmptyWorkspace(2);
    addProjectConfiguration(tree, 'testing', {
      root: 'apps/testing',
      targets: {
        build: {
          executor: '@nrwl/angular:webpack-server',
          options: {
            somethingThatShouldNotBeRemoved: true,
            extractCss: true,
          },
        },
      },
    });

    // ACT
    await updateAngularConfig(tree);

    // ASSERT
    const { targets } = readProjectConfiguration(tree, 'testing');
    expect(targets.build.options.somethingThatShouldNotBeRemoved).toBeDefined();
    expect(targets.build.options.extractCss).toBeUndefined();
  });

  it('should not fail for projects with no targets', async () => {
    // ARRANGE
    const tree = createTreeWithEmptyWorkspace(2);
    addProjectConfiguration(tree, 'testing', {
      root: 'apps/testing',
    });

    // ACT
    await updateAngularConfig(tree);

    // ASSERT
    const { targets } = readProjectConfiguration(tree, 'testing');
    expect(targets).toBeUndefined();
  });
});
