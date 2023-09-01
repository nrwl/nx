import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { readJson, NxJsonConfiguration, Tree, updateJson } from '@nx/devkit';

import { nextInitGenerator } from './init';

describe('init', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });
  });

  it('should add react dependencies', async () => {
    await nextInitGenerator(tree, {});
    const packageJson = readJson(tree, 'package.json');
    expect(packageJson.dependencies['@nx/react']).toBeUndefined();
    expect(packageJson.devDependencies['@nx/next']).toBeDefined();
    expect(packageJson.dependencies['next']).toBeDefined();
  });

  it('should not add jest config if unitTestRunner is none', async () => {
    await nextInitGenerator(tree, { unitTestRunner: 'none' });
    expect(tree.exists('jest.config.js')).toEqual(false);
  });

  it('should set projectNameAndRootFormat default when the option is set to "as-provided"', async () => {
    await nextInitGenerator(tree, { projectNameAndRootFormat: 'as-provided' });

    const { generators } = readJson<NxJsonConfiguration>(tree, 'nx.json');
    expect(generators['@nx/next:application'].projectNameAndRootFormat).toEqual(
      'as-provided'
    );
    expect(generators['@nx/next:library'].projectNameAndRootFormat).toEqual(
      'as-provided'
    );
  });

  it('should not set projectNameAndRootFormat default when the option is set to "derived"', async () => {
    await nextInitGenerator(tree, { projectNameAndRootFormat: 'derived' });

    const { generators } = readJson<NxJsonConfiguration>(tree, 'nx.json');
    expect(
      generators['@nx/next:application']?.projectNameAndRootFormat
    ).toBeUndefined();
    expect(
      generators['@nx/next:library']?.projectNameAndRootFormat
    ).toBeUndefined();
  });

  it('should not set projectNameAndRootFormat=as-provided default when not running for the first time', async () => {
    updateJson(tree, 'package.json', (json) => ({
      ...json,
      dependencies: {
        ...json.dependencies,
        next: '*',
      },
    }));

    await nextInitGenerator(tree, { projectNameAndRootFormat: 'as-provided' });

    const { generators } = readJson<NxJsonConfiguration>(tree, 'nx.json');
    expect(
      generators['@nx/next:application']?.projectNameAndRootFormat
    ).toBeUndefined();
    expect(
      generators['@nx/next:library']?.projectNameAndRootFormat
    ).toBeUndefined();
  });
});
