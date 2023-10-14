import { ProjectType } from '../config/workspace-json-project-json';
import { createFileMap, updateFileMap } from './file-map-utils';

describe('fileMapUtils', () => {
  describe('createFileMap', () => {
    it('should map files to projects', () => {
      const projectsConfigurations = {
        version: 2,
        projects: {
          demo: {
            root: 'apps/demo',
            sourceRoot: 'apps/demo/src',
            projectType: 'application' as ProjectType,
          },
          'demo-e2e': {
            root: 'apps/demo-e2e',
            sourceRoot: 'apps/demo-e2e/src',
            projectType: 'application' as ProjectType,
          },
          ui: {
            root: 'libs/ui',
            sourceRoot: 'libs/ui/src',
            projectType: 'library' as ProjectType,
          },
        },
      };
      const files = [
        { file: 'apps/demo/src/main.ts', hash: 'some-hash' },
        { file: 'apps/demo-e2e/src/main.ts', hash: 'some-hash' },
        { file: 'libs/ui/src/index.ts', hash: 'some-hash' },
        { file: 'tools/myfile.txt', hash: 'some-hash' },
      ];

      const result = createFileMap(projectsConfigurations, files);

      expect(result).toEqual({
        fileMap: {
          projectFileMap: {
            demo: [{ file: 'apps/demo/src/main.ts', hash: 'some-hash' }],
            'demo-e2e': [
              { file: 'apps/demo-e2e/src/main.ts', hash: 'some-hash' },
            ],
            ui: [{ file: 'libs/ui/src/index.ts', hash: 'some-hash' }],
          },
          nonProjectFiles: [{ file: 'tools/myfile.txt', hash: 'some-hash' }],
        },
        allWorkspaceFiles: [
          { file: 'apps/demo/src/main.ts', hash: 'some-hash' },
          { file: 'apps/demo-e2e/src/main.ts', hash: 'some-hash' },
          { file: 'libs/ui/src/index.ts', hash: 'some-hash' },
          { file: 'tools/myfile.txt', hash: 'some-hash' },
        ],
      });
    });
  });
});
