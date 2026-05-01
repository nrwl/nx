import { Tree, readJson, writeJson } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import * as utilities from '../../utils/utilities';
import * as migrate10Generator from '../../generators/migrate-10/migrate-10';
import migrateToStorybook10 from './migrate-to-storybook-10';

describe('migrate-to-storybook-10 migration', () => {
  let tree: Tree;
  let storybookMajorVersionSpy: jest.SpyInstance;
  let migrate10GeneratorSpy: jest.SpyInstance;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });
    storybookMajorVersionSpy = jest.spyOn(utilities, 'storybookMajorVersion');
    migrate10GeneratorSpy = jest
      .spyOn(migrate10Generator, 'default')
      .mockResolvedValue(undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should call migrate-10 generator when Storybook is installed', async () => {
    storybookMajorVersionSpy.mockReturnValue(9);
    writeJson(tree, 'package.json', {
      devDependencies: { storybook: '^9.0.0' },
    });

    await migrateToStorybook10(tree);

    expect(migrate10GeneratorSpy).toHaveBeenCalledWith(tree, {
      autoAcceptAllPrompts: true,
    });
  });

  it('should pass the tree to migrate-10 generator', async () => {
    storybookMajorVersionSpy.mockReturnValue(9);
    writeJson(tree, 'package.json', {
      dependencies: { storybook: '^9.5.0' },
    });

    await migrateToStorybook10(tree);

    expect(migrate10GeneratorSpy).toHaveBeenCalledTimes(1);
    expect(migrate10GeneratorSpy.mock.calls[0][0]).toBe(tree);
  });
});
