import 'nx/src/internal-testing-utils/mock-project-graph';

import {
  ProjectConfiguration,
  readProjectConfiguration,
  Tree,
} from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { NormalizedSchema } from '../schema';
import { moveProjectFiles } from './move-project-files';

// nx-ignore-next-line
const { libraryGenerator } = require('@nx/js');

describe('moveProject', () => {
  let tree: Tree;
  let projectConfig: ProjectConfiguration;

  beforeEach(async () => {
    tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });
    await libraryGenerator(tree, {
      directory: 'my-lib',
    });
    projectConfig = readProjectConfiguration(tree, 'my-lib');
  });

  it('should copy all files and delete the source folder', async () => {
    const schema: NormalizedSchema = {
      projectName: 'my-lib',
      destination: 'my-destination',
      importPath: '@proj/my-destination',
      updateImportPath: true,
      newProjectName: 'my-destination',
      relativeToRootDestination: 'my-destination',
    };

    moveProjectFiles(tree, schema, projectConfig);

    const destinationChildren = tree.children('my-destination');
    expect(destinationChildren.length).toBeGreaterThan(0);
    expect(tree.exists('my-lib')).toBeFalsy();
  });

  it('should move vite.config.mts for root projects', () => {
    const rootProjectConfig: ProjectConfiguration = {
      root: '.',
      sourceRoot: 'src',
      name: 'root-project',
    };
    const schema: NormalizedSchema = {
      projectName: 'root-project',
      destination: 'apps/my-app',
      importPath: '@proj/my-app',
      updateImportPath: true,
      newProjectName: 'my-app',
      relativeToRootDestination: 'apps/my-app',
    };
    tree.write('vite.config.mts', 'export default {}');

    moveProjectFiles(tree, schema, rootProjectConfig);

    expect(tree.exists('apps/my-app/vite.config.mts')).toBeTruthy();
    expect(tree.exists('vite.config.mts')).toBeFalsy();
  });

  it('should move vite.config.mjs for root projects', () => {
    const rootProjectConfig: ProjectConfiguration = {
      root: '.',
      sourceRoot: 'src',
      name: 'root-project',
    };
    const schema: NormalizedSchema = {
      projectName: 'root-project',
      destination: 'apps/my-app',
      importPath: '@proj/my-app',
      updateImportPath: true,
      newProjectName: 'my-app',
      relativeToRootDestination: 'apps/my-app',
    };
    tree.write('vite.config.mjs', 'export default {}');

    moveProjectFiles(tree, schema, rootProjectConfig);

    expect(tree.exists('apps/my-app/vite.config.mjs')).toBeTruthy();
    expect(tree.exists('vite.config.mjs')).toBeFalsy();
  });
});
