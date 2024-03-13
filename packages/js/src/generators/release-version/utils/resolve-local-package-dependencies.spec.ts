import { ProjectGraph, Tree, workspaceRoot } from '@nx/devkit';
import { createTree } from '@nx/devkit/testing';
import { createWorkspaceWithPackageDependencies } from '../test-utils/create-workspace-with-package-dependencies';
import { resolveLocalPackageDependencies } from './resolve-local-package-dependencies';

expect.addSnapshotSerializer({
  serialize: (str: string) => {
    // replace all instances of the workspace root with a placeholder to ensure consistency
    return JSON.stringify(
      str.replaceAll(
        new RegExp(workspaceRoot.replace(/\\/g, '\\\\'), 'g'),
        '<workspaceRoot>'
      )
    );
  },
  test(val: string) {
    return (
      val != null && typeof val === 'string' && val.includes(workspaceRoot)
    );
  },
});

describe('resolveLocalPackageDependencies()', () => {
  let tree: Tree;
  let projectGraph: ProjectGraph;

  describe('fixed versions', () => {
    beforeEach(() => {
      tree = createTree();

      projectGraph = createWorkspaceWithPackageDependencies(tree, {
        projectA: {
          projectRoot: 'packages/projectA',
          packageName: 'projectA',
          version: '1.0.0',
          packageJsonPath: 'packages/projectA/package.json',
          localDependencies: [
            {
              projectName: 'projectB',
              dependencyCollection: 'dependencies',
              version: '1.0.0',
            },
            {
              projectName: 'projectC',
              dependencyCollection: 'devDependencies',
              version: '1.0.0',
            },
            {
              projectName: 'projectD',
              dependencyCollection: 'optionalDependencies',
              version: '1.0.0',
            },
          ],
        },
        projectB: {
          projectRoot: 'packages/projectB',
          packageName: 'projectB',
          version: '1.0.0',
          packageJsonPath: 'packages/projectB/package.json',
          localDependencies: [],
        },
        projectC: {
          projectRoot: 'packages/projectC',
          packageName: 'projectC',
          version: '1.0.0',
          packageJsonPath: 'packages/projectC/package.json',
          localDependencies: [],
        },
        projectD: {
          projectRoot: 'packages/projectD',
          packageName: 'projectD',
          version: '1.0.0',
          packageJsonPath: 'packages/projectD/package.json',
          localDependencies: [],
        },
      });
    });

    it('should resolve local dependencies based on fixed semver versions', () => {
      const allProjects = Object.values(projectGraph.nodes);
      const projectNameToPackageRootMap = new Map<string, string>();
      for (const project of allProjects) {
        projectNameToPackageRootMap.set(project.name, project.data.root);
      }

      const result = resolveLocalPackageDependencies(
        tree,
        projectGraph,
        allProjects,
        projectNameToPackageRootMap,
        (p) => p.data.root,
        false
      );

      expect(result).toMatchInlineSnapshot(`
        {
          "projectA": [
            {
              "dependencyCollection": "dependencies",
              "rawVersionSpec": "1.0.0",
              "source": "projectA",
              "target": "projectB",
              "type": "static",
            },
            {
              "dependencyCollection": "devDependencies",
              "rawVersionSpec": "1.0.0",
              "source": "projectA",
              "target": "projectC",
              "type": "static",
            },
            {
              "dependencyCollection": "optionalDependencies",
              "rawVersionSpec": "1.0.0",
              "source": "projectA",
              "target": "projectD",
              "type": "static",
            },
          ],
        }
      `);
    });
  });

  describe(`"file:", "link:" and "workspace:" protocols`, () => {
    beforeEach(() => {
      tree = createTree();

      projectGraph = createWorkspaceWithPackageDependencies(tree, {
        projectA: {
          projectRoot: 'packages/projectA',
          packageName: 'projectA',
          version: '1.0.0',
          packageJsonPath: 'packages/projectA/package.json',
          localDependencies: [
            {
              projectName: 'projectB',
              dependencyCollection: 'dependencies',
              version: 'file:../projectB',
            },
            {
              projectName: 'projectC',
              dependencyCollection: 'devDependencies',
              version: 'workspace:*',
            },
            {
              projectName: 'projectD',
              dependencyCollection: 'optionalDependencies',
              version: 'workspace:../projectD',
            },
            {
              projectName: 'projectE',
              dependencyCollection: 'dependencies',
              version: 'link:../projectE', // yarn classic equivalent of `file:`
            },
          ],
        },
        projectB: {
          projectRoot: 'packages/projectB',
          packageName: 'projectB',
          version: '1.0.0',
          packageJsonPath: 'packages/projectB/package.json',
          localDependencies: [
            {
              projectName: 'projectC',
              dependencyCollection: 'dependencies',
              version: 'workspace:1.0.0',
            },
            {
              projectName: 'projectD',
              dependencyCollection: 'dependencies',
              /**
               * Wrong version is specified, shouldn't be resolved as a local package dependency
               * (pnpm will likely error on this at install time anyway, so it's unlikely
               * to occur in a real-world setup)
               */
              version: 'workspace:2.0.0',
            },
          ],
        },
        projectC: {
          projectRoot: 'packages/projectC',
          packageName: 'projectC',
          version: '1.0.0',
          packageJsonPath: 'packages/projectC/package.json',
          localDependencies: [],
        },
        projectD: {
          projectRoot: 'packages/projectD',
          packageName: 'projectD',
          version: '1.0.0',
          packageJsonPath: 'packages/projectD/package.json',
          localDependencies: [],
        },
        projectE: {
          projectRoot: 'packages/projectE',
          packageName: 'projectE',
          version: '1.0.0',
          packageJsonPath: 'packages/projectE/package.json',
          localDependencies: [],
        },
      });
    });

    it('should resolve local dependencies based on file, link and workspace protocols', () => {
      const allProjects = Object.values(projectGraph.nodes);
      const projectNameToPackageRootMap = new Map<string, string>();
      for (const project of allProjects) {
        projectNameToPackageRootMap.set(project.name, project.data.root);
      }

      const result = resolveLocalPackageDependencies(
        tree,
        projectGraph,
        allProjects,
        projectNameToPackageRootMap,
        (p) => p.data.root,
        false
      );

      expect(result).toMatchInlineSnapshot(`
        {
          "projectA": [
            {
              "dependencyCollection": "dependencies",
              "rawVersionSpec": "file:../projectB",
              "source": "projectA",
              "target": "projectB",
              "type": "static",
            },
            {
              "dependencyCollection": "devDependencies",
              "rawVersionSpec": "workspace:*",
              "source": "projectA",
              "target": "projectC",
              "type": "static",
            },
            {
              "dependencyCollection": "optionalDependencies",
              "rawVersionSpec": "workspace:../projectD",
              "source": "projectA",
              "target": "projectD",
              "type": "static",
            },
            {
              "dependencyCollection": "dependencies",
              "rawVersionSpec": "link:../projectE",
              "source": "projectA",
              "target": "projectE",
              "type": "static",
            },
          ],
          "projectB": [
            {
              "dependencyCollection": "dependencies",
              "rawVersionSpec": "workspace:1.0.0",
              "source": "projectB",
              "target": "projectC",
              "type": "static",
            },
          ],
        }
      `);
    });
  });

  describe('npm scopes', () => {
    beforeEach(() => {
      tree = createTree();

      projectGraph = createWorkspaceWithPackageDependencies(tree, {
        projectA: {
          projectRoot: 'packages/projectA',
          packageName: '@acme/projectA',
          version: '1.0.0',
          packageJsonPath: 'packages/projectA/package.json',
          localDependencies: [
            {
              projectName: 'projectB',
              dependencyCollection: 'dependencies',
              version: '1.0.0',
            },
          ],
        },
        projectB: {
          projectRoot: 'packages/projectB',
          packageName: '@acme/projectB',
          version: '1.0.0',
          packageJsonPath: 'packages/projectB/package.json',
          localDependencies: [],
        },
      });
    });

    it('should resolve local dependencies which contain npm scopes', () => {
      const allProjects = Object.values(projectGraph.nodes);
      const projectNameToPackageRootMap = new Map<string, string>();
      for (const project of allProjects) {
        projectNameToPackageRootMap.set(project.name, project.data.root);
      }

      const result = resolveLocalPackageDependencies(
        tree,
        projectGraph,
        allProjects,
        projectNameToPackageRootMap,
        (p) => p.data.root,
        false
      );

      expect(result).toMatchInlineSnapshot(`
        {
          "projectA": [
            {
              "dependencyCollection": "dependencies",
              "rawVersionSpec": "1.0.0",
              "source": "projectA",
              "target": "projectB",
              "type": "static",
            },
          ],
        }
      `);
    });
  });

  describe('custom package roots', () => {
    beforeEach(() => {
      tree = createTree();

      projectGraph = createWorkspaceWithPackageDependencies(tree, {
        projectA: {
          projectRoot: 'packages/projectA',
          packageName: '@acme/projectA',
          version: '1.0.0',
          // Custom package.json path coming from a build/dist location, not the project root
          packageJsonPath: 'build/packages/projectA/package.json',
          localDependencies: [
            {
              projectName: 'projectB',
              dependencyCollection: 'dependencies',
              version: '1.0.0',
            },
            {
              projectName: 'projectC',
              dependencyCollection: 'dependencies',
              version: '1.0.0',
            },
            {
              projectName: 'projectD',
              dependencyCollection: 'dependencies',
              // relative from projectA's package.json path to projectD's package.json path
              version: 'file:../../../packages/projectD',
            },
          ],
        },
        projectB: {
          projectRoot: 'packages/projectB',
          packageName: '@acme/projectB',
          version: '1.0.0',
          // Custom package.json path coming from a build/dist location, not the project root
          packageJsonPath: 'build/packages/projectB/package.json',
          localDependencies: [],
        },
        projectC: {
          projectRoot: 'packages/projectC',
          packageName: '@acme/projectC',
          version: '1.0.0',
          // Standard package.json path coming from the project root
          packageJsonPath: 'packages/projectC/package.json',
          localDependencies: [],
        },
        projectD: {
          projectRoot: 'packages/projectD',
          packageName: 'projectD',
          version: '1.0.0',
          // Standard package.json path coming from the project root
          packageJsonPath: 'packages/projectD/package.json',
          localDependencies: [],
        },
      });
    });

    it('should resolve local dependencies using custom package roots', () => {
      const allProjects = Object.values(projectGraph.nodes);
      const projectNameToPackageRootMap = new Map<string, string>();
      projectNameToPackageRootMap.set('projectA', 'build/packages/projectA');
      projectNameToPackageRootMap.set('projectB', 'build/packages/projectB');
      projectNameToPackageRootMap.set('projectC', 'packages/projectC');
      projectNameToPackageRootMap.set('projectD', 'packages/projectD');

      const result = resolveLocalPackageDependencies(
        tree,
        projectGraph,
        allProjects,
        projectNameToPackageRootMap,
        (p) => p.data.root,
        false
      );

      expect(result).toMatchInlineSnapshot(`
        {
          "projectA": [
            {
              "dependencyCollection": "dependencies",
              "rawVersionSpec": "1.0.0",
              "source": "projectA",
              "target": "projectB",
              "type": "static",
            },
            {
              "dependencyCollection": "dependencies",
              "rawVersionSpec": "1.0.0",
              "source": "projectA",
              "target": "projectC",
              "type": "static",
            },
            {
              "dependencyCollection": "dependencies",
              "rawVersionSpec": "file:../../../packages/projectD",
              "source": "projectA",
              "target": "projectD",
              "type": "static",
            },
          ],
        }
      `);
    });
  });
});
