import { TempFs } from '../../internal-testing-utils/temp-fs';
import {
  retrieveProjectConfigurationPaths,
  retrieveProjectConfigurations,
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
