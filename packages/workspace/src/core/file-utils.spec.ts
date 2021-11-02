import {
  calculateFileChanges,
  createProjectFileMap,
  updateProjectFileMap,
  WholeFileChange,
} from './file-utils';
import { DiffType, JsonChange, jsonDiff } from '../utilities/json-diff';

const ignore = require('ignore');

describe('calculateFileChanges', () => {
  it('should return a whole file change by default', () => {
    const changes = calculateFileChanges(
      ['proj/index.ts'],
      undefined,
      (path, revision) => {
        return revision === 'sha1' ? '' : 'const a = 0;';
      }
    );

    expect(changes[0].getChanges()).toEqual([new WholeFileChange()]);
  });

  it('should return a json changes for json files', () => {
    const changes = calculateFileChanges(
      ['package.json'],
      {
        base: 'sha1',
        head: 'sha2',
      },
      (path, revision) => {
        return revision === 'sha1'
          ? JSON.stringify({
              dependencies: {
                'happy-nrwl': '0.0.1',
                'not-awesome-nrwl': '0.0.1',
              },
            })
          : JSON.stringify({
              dependencies: {
                'happy-nrwl': '0.0.2',
                'awesome-nrwl': '0.0.1',
              },
            });
      }
    );

    expect(changes[0].getChanges()).toContainEqual({
      type: DiffType.Modified,
      path: ['dependencies', 'happy-nrwl'],
      value: {
        lhs: '0.0.1',
        rhs: '0.0.2',
      },
    });
    expect(changes[0].getChanges()).toContainEqual({
      type: DiffType.Deleted,
      path: ['dependencies', 'not-awesome-nrwl'],
      value: {
        lhs: '0.0.1',
        rhs: undefined,
      },
    });
    expect(changes[0].getChanges()).toContainEqual({
      type: DiffType.Added,
      path: ['dependencies', 'awesome-nrwl'],
      value: {
        lhs: undefined,
        rhs: '0.0.1',
      },
    });
  });

  it('should ignore *.md changes', () => {
    const ig = ignore();
    ig.add('*.md');
    const changes = calculateFileChanges(
      ['proj/readme.md'],
      undefined,
      (path, revision) => {
        return revision === 'sha1' ? '' : 'const a = 0;';
      },
      ig
    );
    expect(changes.length).toEqual(0);
  });

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
