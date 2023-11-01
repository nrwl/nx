import { ProjectGraph, Tree, output, readJson } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { ReleaseGroupWithName } from 'nx/src/command-line/release/config/filter-release-groups';
import { releaseVersionGenerator } from './release-version';
import { createWorkspaceWithPackageDependencies } from './test-utils/create-workspace-with-package-dependencies';

// Using the daemon in unit tests would cause jest to never exit
process.env.NX_DAEMON = 'false';

describe('release-version', () => {
  let tree: Tree;
  let projectGraph: ProjectGraph;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();

    projectGraph = createWorkspaceWithPackageDependencies(tree, {
      'my-lib': {
        projectRoot: 'libs/my-lib',
        packageName: 'my-lib',
        version: '0.0.1',
        packageJsonPath: 'libs/my-lib/package.json',
        localDependencies: [],
      },
      'project-with-dependency-on-my-pkg': {
        projectRoot: 'libs/project-with-dependency-on-my-pkg',
        packageName: 'project-with-dependency-on-my-pkg',
        version: '0.0.1',
        packageJsonPath: 'libs/project-with-dependency-on-my-pkg/package.json',
        localDependencies: [
          {
            projectName: 'my-lib',
            dependencyCollection: 'dependencies',
            version: '0.0.1',
          },
        ],
      },
      'project-with-devDependency-on-my-pkg': {
        projectRoot: 'libs/project-with-devDependency-on-my-pkg',
        packageName: 'project-with-devDependency-on-my-pkg',
        version: '0.0.1',
        packageJsonPath:
          'libs/project-with-devDependency-on-my-pkg/package.json',
        localDependencies: [
          {
            projectName: 'my-lib',
            dependencyCollection: 'devDependencies',
            version: '0.0.1',
          },
        ],
      },
    });
  });

  it(`should work with semver keywords and exact semver versions`, async () => {
    expect(readJson(tree, 'libs/my-lib/package.json').version).toEqual('0.0.1');
    await releaseVersionGenerator(tree, {
      projects: Object.values(projectGraph.nodes), // version all projects
      projectGraph,
      specifier: 'major',
      currentVersionResolver: 'disk',
      releaseGroup: createReleaseGroup(),
    });
    expect(readJson(tree, 'libs/my-lib/package.json').version).toEqual('1.0.0');

    await releaseVersionGenerator(tree, {
      projects: Object.values(projectGraph.nodes), // version all projects
      projectGraph,
      specifier: 'minor',
      currentVersionResolver: 'disk',
      releaseGroup: createReleaseGroup(),
    });
    expect(readJson(tree, 'libs/my-lib/package.json').version).toEqual('1.1.0');

    await releaseVersionGenerator(tree, {
      projects: Object.values(projectGraph.nodes), // version all projects
      projectGraph,
      specifier: 'patch',
      currentVersionResolver: 'disk',
      releaseGroup: createReleaseGroup(),
    });
    expect(readJson(tree, 'libs/my-lib/package.json').version).toEqual('1.1.1');

    await releaseVersionGenerator(tree, {
      projects: Object.values(projectGraph.nodes), // version all projects
      projectGraph,
      specifier: '1.2.3', // exact version
      currentVersionResolver: 'disk',
      releaseGroup: createReleaseGroup(),
    });
    expect(readJson(tree, 'libs/my-lib/package.json').version).toEqual('1.2.3');
  });

  it(`should apply the updated version to the projects, including updating dependents`, async () => {
    await releaseVersionGenerator(tree, {
      projects: Object.values(projectGraph.nodes), // version all projects
      projectGraph,
      specifier: 'major',
      currentVersionResolver: 'disk',
      releaseGroup: createReleaseGroup(),
    });

    expect(readJson(tree, 'libs/my-lib/package.json')).toMatchInlineSnapshot(`
      {
        "name": "my-lib",
        "version": "1.0.0",
      }
    `);

    expect(
      readJson(tree, 'libs/project-with-dependency-on-my-pkg/package.json')
    ).toMatchInlineSnapshot(`
      {
        "dependencies": {
          "my-lib": "1.0.0",
        },
        "name": "project-with-dependency-on-my-pkg",
        "version": "1.0.0",
      }
    `);
    expect(
      readJson(tree, 'libs/project-with-devDependency-on-my-pkg/package.json')
    ).toMatchInlineSnapshot(`
      {
        "devDependencies": {
          "my-lib": "1.0.0",
        },
        "name": "project-with-devDependency-on-my-pkg",
        "version": "1.0.0",
      }
    `);
  });

  describe('not all given projects have package.json files', () => {
    beforeEach(() => {
      tree.delete('libs/my-lib/package.json');
    });

    it(`should exit with code one and print guidance when not all of the given projects are appropriate for JS versioning`, async () => {
      const processSpy = jest.spyOn(process, 'exit').mockImplementation(() => {
        return undefined as never;
      });
      const outputSpy = jest.spyOn(output, 'error').mockImplementation(() => {
        return undefined as never;
      });

      await releaseVersionGenerator(tree, {
        projects: Object.values(projectGraph.nodes), // version all projects
        projectGraph,
        specifier: 'major',
        currentVersionResolver: 'disk',
        releaseGroup: createReleaseGroup(),
      });

      expect(outputSpy).toHaveBeenCalledWith({
        title: `The project "my-lib" does not have a package.json available at libs/my-lib/package.json.

To fix this you will either need to add a package.json file at that location, or configure "release" within your nx.json to exclude "my-lib" from the current release group, or amend the packageRoot configuration to point to where the package.json should be.`,
      });

      expect(processSpy).toHaveBeenCalledWith(1);

      processSpy.mockRestore();
      outputSpy.mockRestore();
    });
  });
});

function createReleaseGroup(
  partialGroup: Partial<ReleaseGroupWithName> = {}
): ReleaseGroupWithName {
  return {
    name: 'default',
    releaseTagPattern: '{projectName}@v{version}',
    ...partialGroup,
  } as ReleaseGroupWithName;
}
