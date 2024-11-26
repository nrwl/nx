const originalExit = process.exit;
let stubProcessExit = false;

const processExitSpy = jest
  .spyOn(process, 'exit')
  .mockImplementation((...args) => {
    if (stubProcessExit) {
      return undefined as never;
    }
    return originalExit(...args);
  });

import { ProjectGraph, Tree } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { ReleaseGroupWithName } from 'nx/src/command-line/release/config/filter-release-groups';
import { releaseVersionGenerator } from './release-version';
import { createWorkspaceWithPackageDependencies } from './test-utils/create-workspace-with-package-dependencies';

jest.mock('enquirer');

// Using the daemon in unit tests would cause jest to never exit
process.env.NX_DAEMON = 'false';

describe('release-version-workspace-root-project', () => {
  let tree: Tree;
  let projectGraph: ProjectGraph;

  beforeEach(() => {
    // @ts-expect-error read-only property
    process.exit = processExitSpy;

    tree = createTreeWithEmptyWorkspace();
  });
  afterEach(() => {
    jest.clearAllMocks();
    stubProcessExit = false;
  });
  afterAll(() => {
    process.exit = originalExit;
  });

  describe('independent projects relationship', () => {
    describe('with workspace root as a project in the graph', () => {
      it('should not error when run with custom packageRoot containing {projectRoot}', async () => {
        projectGraph = createWorkspaceWithPackageDependencies(tree, {
          'my-lib': {
            projectRoot: 'libs/my-lib',
            packageName: 'my-lib',
            version: '0.0.1',
            packageJsonPath: 'dist/libs/my-lib/package.json',
            localDependencies: [],
          },
          root: {
            projectRoot: '.',
            packageName: 'root',
            version: '0.0.1',
            packageJsonPath: 'package.json',
            localDependencies: [],
          },
          'project-with-dependency-on-my-pkg': {
            projectRoot: 'libs/project-with-dependency-on-my-pkg',
            packageName: 'project-with-dependency-on-my-pkg',
            version: '0.0.1',
            packageJsonPath:
              'dist/libs/project-with-dependency-on-my-pkg/package.json',
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
              'dist/libs/project-with-devDependency-on-my-pkg/package.json',
            localDependencies: [
              {
                projectName: 'my-lib',
                dependencyCollection: 'devDependencies',
                version: '0.0.1',
              },
            ],
          },
        });

        await releaseVersionGenerator(tree, {
          projects: Object.values(projectGraph.nodes), // version all projects
          projectGraph,
          specifier: 'patch',
          currentVersionResolver: 'disk',
          specifierSource: 'prompt',
          releaseGroup: {
            name: 'myReleaseGroup',
            releaseTagPattern: '{projectName}@{version}',
            projectsRelationship: 'independent',
          } as ReleaseGroupWithName,
          packageRoot: 'dist/{projectRoot}',
        });
      });

      // TODO This will not pass until NXC-573 is resolved
      // Until then, this test will error because the version generator is incorrectly
      // looking for 'dist/libs/depends-on-my-lib/package.json' when it doesn't exist.
      it.skip('should not error when run with custom packageRoot containing {projectRoot}', async () => {
        projectGraph = createWorkspaceWithPackageDependencies(tree, {
          'depends-on-my-lib': {
            projectRoot: 'libs/depends-on-my-lib',
            packageName: 'depends-on-my-lib',
            version: '0.0.1',
            // Note that the path here does not match the packageRoot pattern of the other projects
            packageJsonPath: 'dist/pkgs/depends-on-my-lib/package.json',
            localDependencies: [
              {
                projectName: 'my-lib',
                dependencyCollection: 'dependencies',
                version: '0.0.1',
              },
            ],
          },
          root: {
            projectRoot: '.',
            packageName: 'root',
            version: '0.0.1',
            packageJsonPath: 'package.json',
            localDependencies: [],
          },
          'my-lib': {
            projectRoot: 'libs/my-lib',
            packageName: 'my-lib',
            version: '0.0.1',
            packageJsonPath: 'dist/libs/my-lib/package.json',
            localDependencies: [],
          },
          'my-lib-2': {
            projectRoot: 'libs/my-lib-2',
            packageName: 'my-lib-2',
            version: '0.0.1',
            packageJsonPath: 'dist/libs/my-lib-2/package.json',
            localDependencies: [],
          },
        });

        // depends-on-my-lib will get its dependencies updated in package.json because my-lib is being versioned
        // this will happen regardless of if depends-on-my-lib should be versioned
        const projectsToVersion = [
          projectGraph.nodes['my-lib'],
          projectGraph.nodes['my-lib-2'],
        ];
        await releaseVersionGenerator(tree, {
          projects: projectsToVersion,
          projectGraph,
          specifier: 'patch',
          currentVersionResolver: 'disk',
          specifierSource: 'prompt',
          releaseGroup: {
            name: 'myReleaseGroup',
            releaseTagPattern: '{projectName}@{version}',
            projectsRelationship: 'independent',
          } as ReleaseGroupWithName,
          packageRoot: 'dist/{projectRoot}',
        });
      });
    });
  });
});
