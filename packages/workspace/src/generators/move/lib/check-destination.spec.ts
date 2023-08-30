import { Tree } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { NormalizedSchema } from '../schema';
import { checkDestination } from './check-destination';

// nx-ignore-next-line
const { libraryGenerator } = require('@nx/js');

describe('checkDestination', () => {
  let tree: Tree;

  beforeEach(async () => {
    tree = createTreeWithEmptyWorkspace();
    await libraryGenerator(tree, {
      name: 'my-lib',
      projectNameAndRootFormat: 'as-provided',
    });
  });

  it('should throw an error if the path is not explicit', async () => {
    const schema: NormalizedSchema = {
      projectName: 'my-lib',
      importPath: undefined,
      updateImportPath: true,
      relativeToRootDestination: '',
    };

    expect(() => {
      checkDestination(tree, schema, '../apps/not-an-app');
    }).toThrow(
      `Invalid destination: [../apps/not-an-app] - Please specify explicit path.`
    );
  });

  it('should throw an error if the path already exists', async () => {
    await libraryGenerator(tree, {
      name: 'my-other-lib',
      projectNameAndRootFormat: 'as-provided',
    });

    const schema: NormalizedSchema = {
      projectName: 'my-lib',
      importPath: undefined,
      updateImportPath: true,
      relativeToRootDestination: 'my-other-lib',
    };

    expect(() => {
      checkDestination(tree, schema, 'my-other-lib');
    }).toThrow(`Invalid destination: [my-other-lib] - Path is not empty.`);
  });

  it('should NOT throw an error if the path is available', async () => {
    const schema: NormalizedSchema = {
      projectName: 'my-lib',
      importPath: undefined,
      updateImportPath: true,
      relativeToRootDestination: 'my-other-lib',
    };

    expect(() => {
      checkDestination(tree, schema, 'my-other-lib');
    }).not.toThrow();
  });
});
