import { ProjectType } from '../config/workspace-json-project-json';
import { createFileMap, updateFileMap } from './file-map-utils';

describe('fileMapUtils', () => {
  describe('createFileMap', () => {
    it('should map files to projects', () => {
      const projectsConfigurations = {
        version: 2,
        projects: {
          demo: {
            name: 'demo',
            root: 'apps/demo',
            sourceRoot: 'apps/demo/src',
            projectType: 'application' as ProjectType,
          },
          'demo-e2e': {
            name: 'demo-e2e',
            root: 'apps/demo-e2e',
            sourceRoot: 'apps/demo-e2e/src',
            projectType: 'application' as ProjectType,
          },
          ui: {
            name: 'ui',
            root: 'libs/ui',
            sourceRoot: 'libs/ui/src',
            projectType: 'library' as ProjectType,
          },
        },
      };
      const files = [
        { file: 'apps/demo/src/main.ts', hash: 'some-hash', size: 0 },
        { file: 'apps/demo-e2e/src/main.ts', hash: 'some-hash', size: 0 },
        { file: 'libs/ui/src/index.ts', hash: 'some-hash', size: 0 },
        { file: 'tools/myfile.txt', hash: 'some-hash', size: 0 },
      ];

      const result = createFileMap(projectsConfigurations, files);

      expect(result).toEqual({
        fileMap: {
          projectFileMap: {
            demo: [
              { file: 'apps/demo/src/main.ts', hash: 'some-hash', size: 0 },
            ],
            'demo-e2e': [
              { file: 'apps/demo-e2e/src/main.ts', hash: 'some-hash', size: 0 },
            ],
            ui: [{ file: 'libs/ui/src/index.ts', hash: 'some-hash', size: 0 }],
          },
          nonProjectFiles: [
            { file: 'tools/myfile.txt', hash: 'some-hash', size: 0 },
          ],
        },
        allWorkspaceFiles: [
          { file: 'apps/demo/src/main.ts', hash: 'some-hash', size: 0 },
          { file: 'apps/demo-e2e/src/main.ts', hash: 'some-hash', size: 0 },
          { file: 'libs/ui/src/index.ts', hash: 'some-hash', size: 0 },
          { file: 'tools/myfile.txt', hash: 'some-hash', size: 0 },
        ],
      });
    });
  });
});
