import { toProjectName, Workspaces } from './workspaces';
import { TempFs } from '../internal-testing-utils/temp-fs';
import { withEnvironmentVariables } from '../internal-testing-utils/with-environment';
import { retrieveProjectConfigurations } from '../project-graph/utils/retrieve-workspace-files';
import { readNxJson } from './configuration';

const libConfig = (root, name?: string) => ({
  name: name ?? toProjectName(`${root}/some-file`),
  projectType: 'library',
  root: `libs/${root}`,
  sourceRoot: `libs/${root}/src`,
  targets: {
    'nx-release-publish': {
      dependsOn: ['^nx-release-publish'],
      executor: '@nx/js:release-publish',
      options: {},
    },
  },
});

const packageLibConfig = (root, name?: string) => ({
  name: name ?? toProjectName(`${root}/some-file`),
  root,
  sourceRoot: root,
  projectType: 'library',
  targets: {
    'nx-release-publish': {
      dependsOn: ['^nx-release-publish'],
      executor: '@nx/js:release-publish',
      options: {},
    },
  },
});

describe('Workspaces', () => {
  let fs: TempFs;
  beforeEach(() => {
    fs = new TempFs('Workspaces');
  });
  afterEach(() => {
    fs.cleanup();
  });

  describe('to project name', () => {
    it('should lowercase names', () => {
      const appResults = toProjectName('my-apps/directory/my-app/package.json');
      const libResults = toProjectName('packages/directory/MyLib/package.json');
      expect(appResults).toEqual('my-app');
      expect(libResults).toEqual('mylib');
    });

    it('should use the workspace globs in package.json', async () => {
      await fs.createFiles({
        'packages/my-package/package.json': JSON.stringify({
          name: 'my-package',
        }),
        'package.json': JSON.stringify({
          name: 'package-name',
          workspaces: ['packages/**'],
        }),
      });

      withEnvironmentVariables(
        {
          NX_WORKSPACE_ROOT: fs.tempDir,
        },
        async () => {
          const resolved = await retrieveProjectConfigurations(
            fs.tempDir,
            readNxJson(fs.tempDir)
          );
          expect(resolved.projectNodes['my-package']).toEqual({
            name: 'my-package',
            root: 'packages/my-package',
            sourceRoot: 'packages/my-package',
            projectType: 'library',
            targets: {
              'nx-release-publish': {
                dependsOn: ['^nx-release-publish'],
                executor: '@nx/js:release-publish',
                options: {},
              },
            },
          });
        }
      );
    });
  });
});
