import { WorkspaceIntegrityChecks } from './workspace-integrity-checks';
import { ProjectType } from './affected-apps';

describe('WorkspaceIntegrityChecks', () => {
  describe('.angular-cli.json is in sync with the filesystem', () => {
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
      expect(errors.length).toEqual(1);
      expect(errors[0].errors[0]).toEqual(
        `Cannot find project 'project1' in 'libs/project1'`
      );
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
      expect(errors.length).toEqual(1);
      expect(errors[0].errors[0]).toEqual(
        `The 'libs/project2/src/index.ts' file doesn't belong to any project.`
      );
    });
  });
});
