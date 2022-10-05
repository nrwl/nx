import {
  mergeTargetConfigurations,
  readTargetDefaultsForTarget,
  toProjectName,
  Workspaces,
} from './workspaces';
import { NxJsonConfiguration } from './nx-json';
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
          'libs/lib2/package.json': JSON.stringify({}),
          'libs/domain/lib3/package.json': JSON.stringify({}),
          'libs/domain/lib4/project.json': JSON.stringify({}),
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
          'workspace.json': JSON.stringify({
            projects: { 'lib1-workspace': 'libs/lib1' },
          }),
          'package.json': JSON.stringify({
            workspaces: ['**/package.json'],
          }),
        },
        '/root'
      );

      const workspaces = new Workspaces('/root');
      const { projects } = workspaces.readWorkspaceConfiguration();
      // projects got deduped so the workspace one remained
      expect(projects['lib1-workspace']).toEqual(lib1Config);
      expect(projects['lib1']).toBeUndefined();
      expect(projects.lib2).toEqual(lib2Config);
      expect(projects['domain-lib3']).toEqual(domainPackageConfig);
      expect(projects['lib4']).toEqual(domainLibConfig);
    });
  });

  describe('to project name', () => {
    it('should lowercase names', () => {
      const nxJson: NxJsonConfiguration = {
        npmScope: '',
        workspaceLayout: {
          appsDir: 'my-apps',
          libsDir: 'packages',
        },
      };
      const appResults = toProjectName('my-apps/directory/my-app/package.json');
      const libResults = toProjectName('packages/directory/MyLib/package.json');
      expect(appResults).toEqual('my-app');
      expect(libResults).toEqual('mylib');
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

  describe('target defaults', () => {
    const nxJson = {
      targetDefaults: {
        'build|nx:run-commands': {
          options: {
            key: 't:e',
          },
        },
        '*|nx:run-commands': {
          options: {
            key: '*:e',
          },
        },
        build: {
          options: {
            key: 't',
          },
        },
      },
    };

    it('should prefer target|executor key', () => {
      expect(
        readTargetDefaultsForTarget('build', nxJson, 'run-commands').options[
          'key'
        ]
      ).toEqual('t:e');
    });

    it('should prefer *|executor key', () => {
      expect(
        readTargetDefaultsForTarget('other-target', nxJson, 'run-commands')
          .options['key']
      ).toEqual('*:e');
    });

    it('should fallback to target key', () => {
      expect(
        readTargetDefaultsForTarget('build', nxJson, 'other-executor').options[
          'key'
        ]
      ).toEqual('t');
    });

    it('should return undefined if not found', () => {
      expect(
        readTargetDefaultsForTarget('other-target', nxJson, 'other-executor')
      ).toBeNull();
    });

    it.each(['configurations', 'options'])(
      'should merge %s if executor matches',
      (property) => {
        expect(
          mergeTargetConfigurations(
            {
              executor: 'target',
              [property]: {
                a: {},
              },
            },
            {
              executor: 'target',
              [property]: {
                a: 'overriden',
                b: {},
              },
            }
          )[property]
        ).toEqual({ a: {}, b: {} });
      }
    );

    it.each(['configurations', 'options'])(
      'should merge %s if executor is only provided by target',
      (property) => {
        expect(
          mergeTargetConfigurations(
            {
              executor: 'target',
              [property]: {
                a: {},
              },
            },
            {
              [property]: {
                b: {},
              },
            }
          )[property]
        ).toEqual({ a: {}, b: {} });
      }
    );

    it.each(['configurations', 'options'])(
      'should merge %s if executor is only provided by defaults',
      (property) => {
        expect(
          mergeTargetConfigurations(
            {
              [property]: {
                a: {},
              },
            },
            {
              executor: 'target',
              [property]: {
                b: {},
              },
            }
          )[property]
        ).toEqual({ a: {}, b: {} });
      }
    );

    it.each(['configurations', 'options'])(
      'should not merge %s if executor is only provided by defaults',
      (property) => {
        expect(
          mergeTargetConfigurations(
            {
              [property]: {
                a: {},
              },
            },
            {
              executor: 'target',
              [property]: {
                b: {},
              },
            }
          )[property]
        ).toEqual({ a: {}, b: {} });
      }
    );
  });
});
