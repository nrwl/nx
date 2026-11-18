import { TempFs } from '../../internal-testing-utils/temp-fs';
import {
  retrieveProjectConfigurationPaths,
  retrieveProjectConfigurations,
  retrieveProjectConfigurationsWithAngularProjects,
} from './retrieve-workspace-files';
import { LoadedNxPlugin } from '../plugins/loaded-nx-plugin';
import { ProjectJsonProjectsPlugin } from '../../plugins/project-json/build-nodes/project-json';
import { dirname, join } from 'path';
import { readFile } from 'fs/promises';
import {
  CreateNodesContext,
  createNodesFromFiles,
  CreateNodesResultArray,
} from '../plugins';

describe('retrieve-workspace-files', () => {
  describe('retrieveProjectConfigurationPaths', () => {
    let fs: TempFs;
    beforeAll(() => {
      fs = new TempFs('retrieveProjectConfigurationPaths');
    });
    afterAll(() => {
      fs.cleanup();
    });

    it('should not find files that are listed by .nxignore', async () => {
      await fs.createFile('.nxignore', `not-projects`);
      await fs.createFile(
        'not-projects/project.json',
        JSON.stringify({
          name: 'not-project-1',
        })
      );
      await fs.createFile(
        'projects/project.json',
        JSON.stringify({
          name: 'project-1',
        })
      );

      const configPaths = await retrieveProjectConfigurationPaths(fs.tempDir, [
        {
          name: 'test',
          createNodes: [
            '{project.json,**/project.json}',
            async () => {
              return [];
            },
          ],
        },
      ]);

      expect(configPaths).not.toContain('not-projects/project.json');
      expect(configPaths).toContain('projects/project.json');
    });

    it('should glob only the include patterns of a scoped plugin', async () => {
      // Own workspace: the shared one's file context predates these files.
      const scopedFs = new TempFs('retrieveProjectConfigurationPaths-scoped');
      await scopedFs.createFiles({
        'apps/api/package.json': '{}',
        'apps/api/src/main.ts': '',
        'apps/api/src/other.ts': '',
        'apps/web/src/main.ts': '',
        'libs/a/src/index.ts': '',
      });

      const configPaths = await retrieveProjectConfigurationPaths(
        scopedFs.tempDir,
        [
          {
            name: 'scoped',
            include: [
              'apps/api/{package.json,src/main.{ts,js}}',
              'libs/*/README.md',
            ],
            createNodes: ['{**/*.ts,**/package.json}', async () => []],
          },
          {
            name: 'negated',
            include: ['apps/*/src/main.ts', '!apps/api/**'],
            createNodes: ['**/main.ts', async () => []],
          },
          {
            name: 'broad',
            include: ['libs/**/*'],
            createNodes: ['**/index.ts', async () => []],
          },
        ]
      );

      expect(configPaths.sort()).toEqual([
        // scoped: include results that also match the plugin pattern
        'apps/api/package.json',
        'apps/api/src/main.ts',
        // negated and broad: plugin pattern only; include is applied later
        'apps/api/src/main.ts',
        'apps/web/src/main.ts',
        'libs/a/src/index.ts',
      ]);
      scopedFs.cleanup();
    });
  });

  describe('retrieveProjectConfigurations', () => {
    let fs: TempFs;
    beforeAll(() => {
      fs = new TempFs('retrieveProjectConfigurations');
    });
    afterAll(() => {
      fs.cleanup();
    });

    it('should find project configurations based on plugin globs', async () => {
      await fs.createFile(
        'project1/project.json',
        JSON.stringify({
          name: 'project1',
          root: 'project1',
        })
      );
      await fs.createFile(
        'project2/project.json',
        JSON.stringify({
          name: 'project2',
          root: 'project2',
        })
      );
      await fs.createFile(
        'project3/package.json',
        JSON.stringify({
          name: 'project3',
          root: 'project3',
        })
      );

      const mockPlugin = createTestPlugin('test-plugin', '**/project.json');
      const mockPlugin3 = createTestPlugin('test-plugin-3', '**/package.json');

      const result = await retrieveProjectConfigurations(
        { specifiedPlugins: [], defaultPlugins: [mockPlugin, mockPlugin3] },
        fs.tempDir,
        {}
      );

      expect(result.projects).toBeDefined();
      expect(Object.keys(result.projects)).toHaveLength(3);
      expect(result.projects['project1']).toBeDefined();
      expect(result.projects['project2']).toBeDefined();
      expect(result.projects['project3']).toBeDefined();
    });

    it('multiple plugins should not affect other plugins', async () => {
      await fs.createFile(
        'project1/project.json',
        JSON.stringify({
          name: 'project1',
          root: 'project1',
        })
      );
      await fs.createFile(
        'project2/project.json',
        JSON.stringify({
          name: 'project2',
          root: 'project2',
        })
      );

      const mockPlugin1 = createTestPlugin('test-plugin-1', '**/project.json');
      // this plugin would exclude all files, so it should not affect the first plugin's results
      const mockPlugin2 = createTestPlugin('test-plugin-2', '!**/*');

      const result = await retrieveProjectConfigurations(
        { specifiedPlugins: [], defaultPlugins: [mockPlugin1, mockPlugin2] },
        fs.tempDir,
        {}
      );

      expect(result.projects).toBeDefined();
      expect(Object.keys(result.projects)).toHaveLength(2);
      expect(result.projects['project1']).toBeDefined();
      expect(result.projects['project2']).toBeDefined();
    });
  });

  describe('retrieveProjectConfigurations with an unnamed project.json', () => {
    let fs: TempFs;
    beforeAll(() => {
      fs = new TempFs('retrieveProjectConfigurationsUnnamedProjectJson');
    });
    afterAll(() => {
      fs.cleanup();
    });

    it('should keep the name inferred by an earlier plugin', async () => {
      await fs.createFile(
        'libs/a/package.json',
        JSON.stringify({ name: '@scope/a' })
      );
      await fs.createFile('libs/a/project.json', JSON.stringify({}));

      const result = await retrieveProjectConfigurations(
        {
          specifiedPlugins: [],
          defaultPlugins: [
            createTestPlugin('test-package-json-plugin', '**/package.json'),
            new LoadedNxPlugin(
              ProjectJsonProjectsPlugin,
              'nx/core/project-json'
            ),
          ],
        },
        fs.tempDir,
        {}
      );

      expect(result.projects['libs/a'].name).toEqual('@scope/a');
    });
  });

  describe('retrieveProjectConfigurationsWithAngularProjects', () => {
    let fs: TempFs;
    let isolatePlugins: string | undefined;
    beforeAll(() => {
      // Keep workspaceRoot on this repo: default plugins read it, and with
      // @nx/angular resolvable here they would add angular.json themselves.
      fs = new TempFs(
        'retrieveProjectConfigurationsWithAngularProjects',
        false
      );
      isolatePlugins = process.env.NX_ISOLATE_PLUGINS;
      process.env.NX_ISOLATE_PLUGINS = 'false';
    });
    afterAll(() => {
      fs.cleanup();
      if (isolatePlugins === undefined) {
        delete process.env.NX_ISOLATE_PLUGINS;
      } else {
        process.env.NX_ISOLATE_PLUGINS = isolatePlugins;
      }
    });

    it('should include angular.json projects when nx.json has no plugins', async () => {
      await fs.createFile(
        'angular.json',
        JSON.stringify({
          version: 1,
          projects: {
            'my-app': { root: 'projects/my-app', architect: {} },
          },
        })
      );

      const result = await retrieveProjectConfigurationsWithAngularProjects(
        fs.tempDir,
        {}
      );

      expect(result.projects['projects/my-app']?.name).toEqual('my-app');
    });
  });
});

function createTestPlugin(name: string, pattern: string): LoadedNxPlugin {
  return new LoadedNxPlugin(
    {
      name,
      createNodes: [
        pattern,
        async (
          projectFiles: readonly string[],
          _,
          context: CreateNodesContext
        ): Promise<CreateNodesResultArray> => {
          return await createNodesFromFiles(
            async (configFile, options, context) => {
              const fullPath = join(context.workspaceRoot, configFile);
              const project = JSON.parse(await readFile(fullPath, 'utf8'));
              return {
                projects: {
                  [project.name]: {
                    name: project.name,
                    root: dirname(configFile),
                  },
                },
              };
            },
            projectFiles,
            _,
            context
          );
        },
      ],
    },
    {
      plugin: name,
    }
  );
}
