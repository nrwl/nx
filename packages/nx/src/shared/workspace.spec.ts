import { toProjectName, Workspaces } from './workspace';
import { NxJsonConfiguration } from './nx';
import { vol } from 'memfs';

import * as fastGlob from 'fast-glob';

jest.mock('fs', () => require('memfs').fs);

const libConfig = (name) => ({
  root: `libs/${name}`,
  sourceRoot: `libs/${name}/src`,
});

const packageLibConfig = (root) => ({
  root,
  sourceRoot: root,
  projectType: 'library',
});

describe('Workspaces', () => {
  let globResults: string[];
  beforeEach(() => {
    globResults = [
      'libs/lib1/package.json',
      'libs/lib1/project.json',
      'libs/lib2/package.json',
      'libs/domain/lib3/package.json',
      'libs/domain/lib4/project.json',
      'libs/domain/lib4/package.json',
    ];
    jest.spyOn(fastGlob, 'sync').mockImplementation(() => globResults);
  });

  afterEach(() => {
    jest.resetAllMocks();
    vol.reset();
  });

  describe('readWorkspaceConfiguration', () => {
    it('should be able to inline project configurations', () => {
      const standaloneConfig = libConfig('lib1');

      const config = {
        version: 2,
        projects: {
          lib1: 'libs/lib1',
          lib2: libConfig('lib2'),
        },
      };
      vol.fromJSON(
        {
          'libs/lib1/project.json': JSON.stringify(standaloneConfig),
          'workspace.json': JSON.stringify(config),
        },
        '/root'
      );

      const workspaces = new Workspaces('/root');
      const resolved = workspaces.readWorkspaceConfiguration();
      expect(resolved.projects.lib1).toEqual(standaloneConfig);
    });

    it('should build project configurations from glob', () => {
      const lib1Config = libConfig('lib1');
      const lib2Config = packageLibConfig('libs/lib2');
      const domainPackageConfig = packageLibConfig('libs/domain/lib3');
      const domainLibConfig = libConfig('domain/lib4');

      vol.fromJSON(
        {
          'libs/lib1/project.json': JSON.stringify(lib1Config),
          'libs/lib1/package.json': JSON.stringify({ name: 'some-other-name' }),
          'libs/lib2/package.json': JSON.stringify({ name: 'lib2' }),
          'libs/domain/lib3/package.json': JSON.stringify({
            name: 'domain-lib3',
          }),
          'libs/domain/lib4/project.json': JSON.stringify(domainLibConfig),
          'libs/domain/lib4/package.json': JSON.stringify({}),
        },
        '/root'
      );

      const workspaces = new Workspaces('/root');
      const { projects } = workspaces.readWorkspaceConfiguration();
      expect(projects.lib1).toEqual(lib1Config);
      expect(projects.lib2).toEqual(lib2Config);
      expect(projects['domain-lib3']).toEqual(domainPackageConfig);
      expect(projects['domain-lib4']).toEqual(domainLibConfig);
    });
  });

  describe('to project name', () => {
    it('should trim default directories from beginning', () => {
      const appResults = toProjectName(
        'apps/directory/my-app/project.json',
        null
      );
      const libResults = toProjectName(
        'libs/directory/my-lib/project.json',
        null
      );
      expect(appResults).toEqual('directory-my-app');
      expect(libResults).toEqual('directory-my-lib');
    });

    it('should trim custom directories from beginning', () => {
      const nxJson: NxJsonConfiguration = {
        npmScope: '',
        workspaceLayout: {
          appsDir: 'my-apps',
          libsDir: 'packages',
        },
      };
      const appResults = toProjectName(
        'my-apps/directory/my-app/project.json',
        nxJson
      );
      const libResults = toProjectName(
        'packages/directory/my-lib/project.json',
        nxJson
      );
      expect(appResults).toEqual('directory-my-app');
      expect(libResults).toEqual('directory-my-lib');
    });

    it('should lowercase names', () => {
      const nxJson: NxJsonConfiguration = {
        npmScope: '',
        workspaceLayout: {
          appsDir: 'my-apps',
          libsDir: 'packages',
        },
      };
      const appResults = toProjectName(
        'my-apps/directory/my-app/package.json',
        nxJson
      );
      const libResults = toProjectName(
        'packages/directory/MyLib/package.json',
        nxJson
      );
      expect(appResults).toEqual('directory-my-app');
      expect(libResults).toEqual('directory-mylib');
    });

    it('should use the workspace globs in package.json', () => {
      globResults = ['packages/my-package/package.json'];
      vol.fromJSON(
        {
          'packages/my-package/package.json': JSON.stringify({
            name: 'my-package',
          }),
          'package.json': JSON.stringify({
            workspaces: ['packages/**'],
          }),
        },
        '/root2'
      );

      const workspaces = new Workspaces('/root2');
      const resolved = workspaces.readWorkspaceConfiguration();
      expect(resolved.projects['my-package']).toEqual({
        root: 'packages/my-package',
        sourceRoot: 'packages/my-package',
        projectType: 'library',
      });
    });
  });
});
