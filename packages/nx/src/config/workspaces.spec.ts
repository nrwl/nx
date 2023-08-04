import { toProjectName, Workspaces } from './workspaces';
import { TargetConfiguration } from './workspace-json-project-json';
import { TempFs } from '../utils/testing/temp-fs';

const libConfig = (root, name?: string) => ({
  name: name ?? toProjectName(`${root}/some-file`),
  projectType: 'library',
  root: `libs/${root}`,
  sourceRoot: `libs/${root}/src`,
});

const packageLibConfig = (root, name?: string) => ({
  name: name ?? toProjectName(`${root}/some-file`),
  root,
  sourceRoot: root,
  projectType: 'library',
});

describe('Workspaces', () => {
  let fs: TempFs;
  beforeEach(() => {
    fs = new TempFs('Workspaces');
  });
  afterEach(() => {
    fs.cleanup();
  });

  describe('readWorkspaceConfiguration', () => {
    it('should be able to inline project configurations', async () => {
      const standaloneConfig = libConfig('lib1');

      const config = {
        version: 2,
        projects: {
          lib1: 'libs/lib1',
          lib2: libConfig('lib2'),
        },
      };
      await fs.createFiles({
        'libs/lib1/project.json': JSON.stringify(standaloneConfig),
        'libs/lib2/package.json': JSON.stringify({}),
        'libs/domain/lib3/package.json': JSON.stringify({}),
        'libs/domain/lib4/project.json': JSON.stringify({}),
        'workspace.json': JSON.stringify(config),
      });

      const workspaces = new Workspaces(fs.tempDir);
      const resolved = workspaces.readProjectsConfigurations();
      expect(resolved.projects.lib1).toEqual(standaloneConfig);
    });

    it('should build project configurations from glob', async () => {
      const lib1Config = libConfig('lib1');
      const lib2Config = packageLibConfig('libs/lib2');
      const domainPackageConfig = packageLibConfig(
        'libs/domain/lib3',
        'domain-lib3'
      );
      const domainLibConfig = libConfig('domain/lib4');

      await fs.createFiles({
        'libs/lib1/project.json': JSON.stringify(lib1Config),
        'libs/lib1/package.json': JSON.stringify({ name: 'some-other-name' }),
        'libs/lib2/package.json': JSON.stringify({ name: 'lib2' }),
        'libs/domain/lib3/package.json': JSON.stringify({
          name: 'domain-lib3',
        }),
        'libs/domain/lib4/project.json': JSON.stringify(domainLibConfig),
        'libs/domain/lib4/package.json': JSON.stringify({}),
        'package.json': JSON.stringify({
          name: 'package-name',
          workspaces: ['**/package.json'],
        }),
      });

      const workspaces = new Workspaces(fs.tempDir);
      const { projects } = workspaces.readProjectsConfigurations();

      // projects got merged for lib1
      expect(projects['lib1']).toEqual({
        name: 'lib1',
        root: 'libs/lib1',
        sourceRoot: 'libs/lib1/src',
        projectType: 'library',
      });
      expect(projects.lib2).toEqual(lib2Config);
      expect(projects['domain-lib3']).toEqual(domainPackageConfig);
      expect(projects['lib4']).toEqual(domainLibConfig);
    });
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

      const workspaces = new Workspaces(fs.tempDir);
      const resolved = workspaces.readProjectsConfigurations();
      expect(resolved.projects['my-package']).toEqual({
        name: 'my-package',
        root: 'packages/my-package',
        sourceRoot: 'packages/my-package',
        projectType: 'library',
      });
    });
  });
});
