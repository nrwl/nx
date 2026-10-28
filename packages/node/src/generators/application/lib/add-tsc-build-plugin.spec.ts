import {
  type ExpandedPluginConfiguration,
  readNxJson,
  type Tree,
  updateNxJson,
} from '@nx/devkit';
import { findMatchingConfigFiles } from '@nx/devkit/internal';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { addTscAppBuildPlugin } from './add-tsc-build-plugin';

describe('addTscAppBuildPlugin', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
  });

  function appBuildIncludes() {
    return readNxJson(tree)
      .plugins.filter((p) => typeof p !== 'string')
      .find((p) => p.plugin === '@nx/js/typescript').include;
  }

  it('should include a root project with a pattern the plugin matcher accepts', () => {
    addTscAppBuildPlugin(tree, '.');

    expect(appBuildIncludes()).toEqual(['*']);
    expect(
      findMatchingConfigFiles(
        ['tsconfig.app.json', 'apps/web/tsconfig.app.json'],
        appBuildIncludes(),
        undefined
      )
    ).toEqual(['tsconfig.app.json']);
  });

  it('should append later apps to the shared registration', () => {
    addTscAppBuildPlugin(tree, 'apps/api');
    addTscAppBuildPlugin(tree, 'apps/worker');
    addTscAppBuildPlugin(tree, 'apps/api');

    expect(appBuildIncludes()).toEqual(['apps/api/*', 'apps/worker/*']);
  });

  it('should add a registration when the existing one excludes the app', () => {
    addTscAppBuildPlugin(tree, 'apps/api');
    const nxJson = readNxJson(tree);
    const shared = nxJson.plugins.find(
      (p) => typeof p !== 'string' && p.plugin === '@nx/js/typescript'
    ) as ExpandedPluginConfiguration;
    shared.exclude = ['apps/worker/**'];
    updateNxJson(tree, nxJson);

    expect(addTscAppBuildPlugin(tree, 'apps/worker')).toBe('build');

    const registrations = readNxJson(tree).plugins.filter(
      (p): p is ExpandedPluginConfiguration =>
        typeof p !== 'string' && p.plugin === '@nx/js/typescript'
    );
    expect(registrations.map((p) => [p.include, p.exclude])).toEqual([
      [['apps/api/*'], ['apps/worker/**']],
      [['apps/worker/*'], undefined],
    ]);
  });
});
