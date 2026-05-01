import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { Tree, ProjectGraph, addDependenciesToPackageJson } from '@nx/devkit';
import {
  isNext14,
  isNext15,
  getNextDependenciesVersionsToInstall,
} from './version-utils';
import { next14Version, next15Version, next16Version } from './versions';

let projectGraph: ProjectGraph;
jest.mock('@nx/devkit', () => ({
  ...jest.requireActual<any>('@nx/devkit'),
  createProjectGraphAsync: jest.fn().mockImplementation(async () => {
    return projectGraph;
  }),
}));

describe('version-utils', () => {
  let tree: Tree;

  beforeEach(() => {
    projectGraph = {
      nodes: {},
      dependencies: {},
      externalNodes: {},
    };
    tree = createTreeWithEmptyWorkspace();
  });

  describe('isNext15', () => {
    it('should return true when Next.js 15 is installed from project graph', async () => {
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

      const result = await isNext15(tree);
      expect(result).toBe(true);
    });

    it('should return true when Next.js 15 is installed from package.json', async () => {
      addDependenciesToPackageJson(tree, { next: '15.2.4' }, {});

      const result = await isNext15(tree);
      expect(result).toBe(true);
    });

    it('should return false when Next.js 14 is installed', async () => {
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

      const result = await isNext15(tree);
      expect(result).toBe(false);
    });

    it('should return false when Next.js 16 is installed', async () => {
      projectGraph.externalNodes = {
        'npm:next': {
          type: 'npm',
          name: 'npm:next',
          data: {
            packageName: 'next',
            version: '16.0.1',
          },
        },
      };

      const result = await isNext15(tree);
      expect(result).toBe(false);
    });
  });

  describe('isNext14', () => {
    it('should return true when Next.js 14 is installed from project graph', async () => {
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

      const result = await isNext14(tree);
      expect(result).toBe(true);
    });

    it('should return true when Next.js 14 is installed from package.json', async () => {
      addDependenciesToPackageJson(tree, { next: '14.2.26' }, {});

      const result = await isNext14(tree);
      expect(result).toBe(true);
    });

    it('should return false when Next.js 15 is installed', async () => {
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

      const result = await isNext14(tree);
      expect(result).toBe(false);
    });

    it('should return false when Next.js 16 is installed', async () => {
      projectGraph.externalNodes = {
        'npm:next': {
          type: 'npm',
          name: 'npm:next',
          data: {
            packageName: 'next',
            version: '16.0.1',
          },
        },
      };

      const result = await isNext14(tree);
      expect(result).toBe(false);
    });
  });

  describe('getNextDependenciesVersionsToInstall', () => {
    it('should return Next.js 15 versions when Next.js 15 is installed', async () => {
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

      const result = await getNextDependenciesVersionsToInstall(tree);
      expect(result).toEqual({
        next: next15Version,
      });
    });

    it('should return Next.js 14 versions when Next.js 14 is installed', async () => {
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

      const result = await getNextDependenciesVersionsToInstall(tree);
      expect(result).toEqual({
        next: next14Version,
      });
    });

    it('should return Next.js 16 versions (default) when no Next.js is installed', async () => {
      const result = await getNextDependenciesVersionsToInstall(tree);
      expect(result).toEqual({
        next: next16Version,
      });
    });

    it('should return Next.js 16 versions when Next.js 16 is installed', async () => {
      projectGraph.externalNodes = {
        'npm:next': {
          type: 'npm',
          name: 'npm:next',
          data: {
            packageName: 'next',
            version: '16.0.1',
          },
        },
      };

      const result = await getNextDependenciesVersionsToInstall(tree);
      expect(result).toEqual({
        next: next16Version,
      });
    });
  });
});
