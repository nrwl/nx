import { WorkspaceIntegrityChecks } from './workspace-integrity-checks';
import * as chalk from 'chalk';
import { ProjectType } from '../core/project-graph';

describe('WorkspaceIntegrityChecks', () => {
  describe('workspace.json is in sync with the filesystem', () => {
    it('should not error when they are in sync', () => {
      const c = new WorkspaceIntegrityChecks(
        {
          nodes: {
            project1: {
              name: 'project1',
              type: ProjectType.lib,
              data: {
                root: 'libs/project1',
                tags: [],
                implicitDependencies: [],
                architect: {},
                files: [createFile('libs/project1/src/index.ts')],
              },
            },
          },
          dependencies: {},
        },
        ['libs/project1/src/index.ts']
      );
      expect(c.run().length).toEqual(0);
    });

    it('should error when there are projects without files', () => {
      const c = new WorkspaceIntegrityChecks(
        {
          nodes: {
            project1: {
              name: 'project1',
              type: ProjectType.lib,
              data: {
                root: 'libs/project1',
                tags: [],
                implicitDependencies: [],
                architect: {},
                files: [],
              },
            },
            project2: {
              name: 'project2',
              type: ProjectType.lib,
              data: {
                root: 'libs/project2',
                tags: [],
                implicitDependencies: [],
                architect: {},
                files: [createFile('libs/project2/src/index.ts')],
              },
            },
          },
          dependencies: {},
        },
        ['libs/project2/src/index.ts']
      );

      const errors = c.run();
      expect(errors).toEqual([
        {
          bodyLines: [
            `${chalk.dim(
              '-'
            )} Cannot find project 'project1' in 'libs/project1'`,
          ],
          title: 'The workspace.json file is out of sync',
        },
      ]);
    });

    it('should error when there are files in apps or libs without projects', () => {
      const c = new WorkspaceIntegrityChecks(
        {
          nodes: {
            project1: {
              name: 'project1',
              type: ProjectType.lib,
              data: {
                root: 'libs/project1',
                tags: [],
                implicitDependencies: [],
                architect: {},
                files: [createFile('libs/project1/src/index.ts')],
              },
            },
          },
          dependencies: {},
        },
        ['libs/project1/src/index.ts', 'libs/project2/src/index.ts']
      );

      const errors = c.run();
      expect(errors).toEqual([
        {
          bodyLines: [`${chalk.dim('-')} libs/project2/src/index.ts`],
          title: 'The following file(s) do not belong to any projects:',
        },
      ]);
    });
  });
});

function createFile(f) {
  return { file: f, hash: '' };
}
