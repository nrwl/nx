import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import {
  readJson,
  Tree,
  ProjectGraph,
  addDependenciesToPackageJson,
} from '@nx/devkit';
import { withPnpm } from '@nx/devkit/internal-testing-utils';

import { nextInitGenerator } from './init';
import {
  next14Version,
  next15Version,
  next16Version,
} from '../../utils/versions';

let projectGraph: ProjectGraph;
jest.mock('@nx/devkit', () => ({
  ...jest.requireActual<any>('@nx/devkit'),
  createProjectGraphAsync: jest.fn().mockImplementation(async () => {
    return projectGraph;
  }),
}));
describe('init', () => {
  let tree: Tree;

  beforeEach(() => {
    projectGraph = {
      nodes: {},
      dependencies: {},
      externalNodes: {},
    };
    tree = createTreeWithEmptyWorkspace();
  });

  it('should add react dependencies', async () => {
    await nextInitGenerator(tree, {});
    const packageJson = readJson(tree, 'package.json');
    expect(packageJson.dependencies['@nx/react']).toBeUndefined();
    expect(packageJson.devDependencies['@nx/next']).toBeDefined();
    expect(packageJson.dependencies['next']).toBeDefined();
  });

  it('should install Next.js 16 by default for new workspaces', async () => {
    await nextInitGenerator(tree, {});
    const packageJson = readJson(tree, 'package.json');
    expect(packageJson.dependencies['next']).toBe(next16Version);
  });

  it('should keep Next.js 15 when already installed', async () => {
    projectGraph.externalNodes = {
      'npm:next': {
        type: 'npm',
        name: 'npm:next',
        data: {
          packageName: 'next',
          version: '15.2.4',
        },
      },
    };

    await nextInitGenerator(tree, {});
    const packageJson = readJson(tree, 'package.json');
    expect(packageJson.dependencies['next']).toBe(next15Version);
  });

  it('should keep Next.js 14 when already installed', async () => {
    projectGraph.externalNodes = {
      'npm:next': {
        type: 'npm',
        name: 'npm:next',
        data: {
          packageName: 'next',
          version: '14.2.26',
        },
      },
    };

    await nextInitGenerator(tree, {});
    const packageJson = readJson(tree, 'package.json');
    expect(packageJson.dependencies['next']).toBe(next14Version);
  });

  it('should respect keepExistingVersions option', async () => {
    addDependenciesToPackageJson(tree, { next: '15.0.0' }, {});

    await nextInitGenerator(tree, { keepExistingVersions: true });
    const packageJson = readJson(tree, 'package.json');
    expect(packageJson.dependencies['next']).toBe('15.0.0');
  });

  describe('pnpm 11 build scripts', () => {
    it('should deny the sharp build script pulled in by next 15+', async () => {
      await withPnpm(tree, '11.2.2', () => nextInitGenerator(tree, {}));

      expect(tree.read('pnpm-workspace.yaml', 'utf-8')).toContain(
        'sharp: false'
      );
    });

    it('should not record a sharp decision for next 14', async () => {
      projectGraph.externalNodes = {
        'npm:next': {
          type: 'npm',
          name: 'npm:next',
          data: { packageName: 'next', version: '14.2.26' },
        },
      };

      await withPnpm(tree, '11.2.2', () => nextInitGenerator(tree, {}));

      expect(tree.read('pnpm-workspace.yaml', 'utf-8') ?? '').not.toContain(
        'sharp'
      );
    });
  });
});
