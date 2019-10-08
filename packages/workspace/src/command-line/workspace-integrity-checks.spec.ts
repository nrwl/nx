import { WorkspaceIntegrityChecks } from './workspace-integrity-checks';
import { ProjectType } from './shared';
import chalk from 'chalk';

describe('WorkspaceIntegrityChecks', () => {
  describe('workspace.json is in sync with the filesystem', () => {
    it('should not error when they are in sync', () => {
      const c = new WorkspaceIntegrityChecks(
        [
          {
            name: 'project1',
            type: ProjectType.lib,
            root: 'libs/project1',
            tags: [],
            implicitDependencies: [],
            architect: {},
            files: ['libs/project1/src/index.ts'],
            fileMTimes: {
              'libs/project1/src/index.ts': 1
            }
          }
        ],
        ['libs/project1/src/index.ts']
      );
      expect(c.run().length).toEqual(0);
    });

    it('should error when there are projects without files', () => {
      const c = new WorkspaceIntegrityChecks(
        [
          {
            name: 'project1',
            type: ProjectType.lib,
            root: 'libs/project1',
            tags: [],
            implicitDependencies: [],
            architect: {},
            files: [],
            fileMTimes: {}
          },
          {
            name: 'project2',
            type: ProjectType.lib,
            root: 'libs/project2',
            tags: [],
            implicitDependencies: [],
            architect: {},
            files: ['libs/project2/src/index.ts'],
            fileMTimes: {
              'libs/project2/src/index.ts': 1
            }
          }
        ],
        ['libs/project2/src/index.ts']
      );

      const errors = c.run();
      expect(errors).toEqual([
        {
          bodyLines: [
            `${chalk.grey(
              '-'
            )} Cannot find project 'project1' in 'libs/project1'`
          ],
          title: 'The angular.json file is out of sync'
        }
      ]);
    });

    it('should error when there are files in apps or libs without projects', () => {
      const c = new WorkspaceIntegrityChecks(
        [
          {
            name: 'project1',
            type: ProjectType.lib,
            root: 'libs/project1',
            fileMTimes: {
              'libs/project1/src/index.ts': 1
            },
            tags: [],
            implicitDependencies: [],
            architect: {},
            files: ['libs/project1/src/index.ts']
          }
        ],
        ['libs/project1/src/index.ts', 'libs/project2/src/index.ts']
      );

      const errors = c.run();
      expect(errors).toEqual([
        {
          bodyLines: [`${chalk.grey('-')} libs/project2/src/index.ts`],
          title: 'The following file(s) do not belong to any projects:'
        }
      ]);
    });
  });
});
