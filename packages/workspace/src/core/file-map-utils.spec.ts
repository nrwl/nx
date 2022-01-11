import { createProjectFileMap, updateProjectFileMap } from './file-map-utils';

const ignore = require('ignore');

describe('fileMapUtils', () => {
  describe('createFileMap', () => {
    it('should map files to projects', () => {
      const workspaceJson = {
        projects: {
          demo: {
            root: 'apps/demo',
            sourceRoot: 'apps/demo/src',
            projectType: 'application',
          },
          'demo-e2e': {
            root: 'apps/demo-e2e',
            sourceRoot: 'apps/demo-e2e/src',
            projectType: 'application',
          },
          ui: {
            root: 'libs/ui',
            sourceRoot: 'libs/ui/src',
            projectType: 'library',
          },
        },
      };
      const files = [
        { file: 'apps/demo/src/main.ts', hash: 'some-hash' },
        { file: 'apps/demo-e2e/src/main.ts', hash: 'some-hash' },
        { file: 'libs/ui/src/index.ts', hash: 'some-hash' },
        { file: 'tools/myfile.txt', hash: 'some-hash' },
      ];

      const result = createProjectFileMap(workspaceJson, files);

      expect(result).toEqual({
        projectFileMap: {
          demo: [{ file: 'apps/demo/src/main.ts', hash: 'some-hash' }],
          'demo-e2e': [
            { file: 'apps/demo-e2e/src/main.ts', hash: 'some-hash' },
          ],
          ui: [{ file: 'libs/ui/src/index.ts', hash: 'some-hash' }],
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

  describe('updateFileMap', () => {
    it('should map files to projects', () => {
      const workspaceJson = {
        projects: {
          demo: {
            root: 'apps/demo',
            sourceRoot: 'apps/demo/src',
            projectType: 'application',
          },
          'demo-e2e': {
            root: 'apps/demo-e2e',
            sourceRoot: 'apps/demo-e2e/src',
            projectType: 'application',
          },
          ui: {
            root: 'libs/ui',
            sourceRoot: 'libs/ui/src',
            projectType: 'library',
          },
        },
      };
      const files = [
        { file: 'apps/demo/src/main.ts', hash: 'some-hash' },
        { file: 'apps/demo-e2e/src/main.ts', hash: 'some-hash' },
        { file: 'libs/ui/src/index.ts', hash: 'some-hash' },
        { file: 'libs/ui/src/second.ts', hash: 'some-hash' },
        { file: 'tools/myfile.txt', hash: 'some-hash' },
      ];

      const projectFileMap = {
        demo: [{ file: 'apps/demo/src/main.ts', hash: 'some-hash' }],
        'demo-e2e': [{ file: 'apps/demo-e2e/src/main.ts', hash: 'some-hash' }],
        ui: [
          { file: 'libs/ui/src/index.ts', hash: 'some-hash' },
          { file: 'libs/ui/src/second.ts', hash: 'some-hash' },
        ],
      };
      const result = updateProjectFileMap(
        workspaceJson,
        projectFileMap,
        files,
        new Map([
          ['apps/demo/src/main.ts', 'demo-main-update'],
          ['apps/demo/src/new-main.ts', 'new-main-hash'],
        ]),
        ['libs/ui/src/second.ts']
      );

      expect(result).toEqual({
        projectFileMap: {
          demo: [
            {
              file: 'apps/demo/src/main.ts',
              hash: 'demo-main-update',
            },
            {
              file: 'apps/demo/src/new-main.ts',
              hash: 'new-main-hash',
            },
          ],
          'demo-e2e': [
            { file: 'apps/demo-e2e/src/main.ts', hash: 'some-hash' },
          ],
          ui: [{ file: 'libs/ui/src/index.ts', hash: 'some-hash' }],
        },
        allWorkspaceFiles: [
          { file: 'apps/demo/src/main.ts', hash: 'demo-main-update' },
          { file: 'apps/demo-e2e/src/main.ts', hash: 'some-hash' },
          { file: 'libs/ui/src/index.ts', hash: 'some-hash' },
          { file: 'tools/myfile.txt', hash: 'some-hash' },
          { file: 'apps/demo/src/new-main.ts', hash: 'new-main-hash' },
        ],
      });
    });
  });
});
