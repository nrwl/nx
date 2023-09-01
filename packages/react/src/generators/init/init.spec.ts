import { readJson, Tree, updateJson } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import reactInitGenerator from './init';
import { InitSchema } from './schema';

describe('init', () => {
  let tree: Tree;
  let schema: InitSchema = {
    unitTestRunner: 'jest',
    e2eTestRunner: 'cypress',
    skipFormat: false,
  };

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
  });

  it('should add react dependencies', async () => {
    await reactInitGenerator(tree, schema);
    const packageJson = readJson(tree, 'package.json');
    expect(packageJson.dependencies['react']).toBeDefined();
    expect(packageJson.dependencies['react-dom']).toBeDefined();
    expect(packageJson.devDependencies['@types/node']).toBeDefined();
    expect(packageJson.devDependencies['@types/react']).toBeDefined();
    expect(packageJson.devDependencies['@types/react-dom']).toBeDefined();
    expect(packageJson.devDependencies['@testing-library/react']).toBeDefined();
  });

  it('should not add jest config if unitTestRunner is none', async () => {
    await reactInitGenerator(tree, { ...schema, unitTestRunner: 'none' });
    expect(tree.exists('jest.config.js')).toEqual(false);
  });

  it('should set projectNameAndRootFormat default when the option is set to "as-provided"', async () => {
    await reactInitGenerator(tree, {
      ...schema,
      projectNameAndRootFormat: 'as-provided',
    });

    const { generators } = readJson(tree, 'nx.json');
    expect(
      generators['@nx/react'].application.projectNameAndRootFormat
    ).toEqual('as-provided');
    expect(generators['@nx/react'].library.projectNameAndRootFormat).toEqual(
      'as-provided'
    );
    expect(generators['@nx/react'].host.projectNameAndRootFormat).toEqual(
      'as-provided'
    );
    expect(generators['@nx/react'].remote.projectNameAndRootFormat).toEqual(
      'as-provided'
    );
  });

  it('should not set projectNameAndRootFormat default when the option is set to "derived"', async () => {
    await reactInitGenerator(tree, {
      ...schema,
      projectNameAndRootFormat: 'derived',
    });

    const { generators } = readJson(tree, 'nx.json');
    expect(
      generators['@nx/react'].application?.projectNameAndRootFormat
    ).toBeUndefined();
    expect(
      generators['@nx/react'].library?.projectNameAndRootFormat
    ).toBeUndefined();
    expect(
      generators['@nx/react'].host?.projectNameAndRootFormat
    ).toBeUndefined();
    expect(
      generators['@nx/react'].remote?.projectNameAndRootFormat
    ).toBeUndefined();
  });

  it('should not set projectNameAndRootFormat=as-provided default when not running for the first time', async () => {
    updateJson(tree, 'package.json', (json) => ({
      ...json,
      dependencies: {
        ...json.dependencies,
        react: '*',
      },
    }));

    await reactInitGenerator(tree, {
      ...schema,
      projectNameAndRootFormat: 'as-provided',
    });

    const { generators } = readJson(tree, 'nx.json');
    expect(
      generators['@nx/react'].application?.projectNameAndRootFormat
    ).toBeUndefined();
    expect(
      generators['@nx/react'].library?.projectNameAndRootFormat
    ).toBeUndefined();
    expect(
      generators['@nx/react'].host?.projectNameAndRootFormat
    ).toBeUndefined();
    expect(
      generators['@nx/react'].remote?.projectNameAndRootFormat
    ).toBeUndefined();
  });
});
