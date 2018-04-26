import { WorkspaceIntegrityChecks } from './workspace-integrity-checks';
import { ProjectType } from './affected-apps';

describe('WorkspaceIntegrityChecks', () => {
  const packageJson = {
    dependencies: {
      '@nrwl/nx': '1.2.3'
    },
    devDependencies: {
      '@nrwl/schematics': '1.2.3'
    }
  };

  describe('.angular-cli.json is in sync with the filesystem', () => {
    it('should not error when they are in sync', () => {
      const c = new WorkspaceIntegrityChecks(
        [
          {
            name: 'project1',
            type: ProjectType.lib,
            root: 'libs/project1',
            tags: [],
            files: ['libs/project1/src/index.ts']
          }
        ],
        ['libs/project1/src/index.ts'],
        packageJson
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
            files: []
          },
          {
            name: 'project2',
            type: ProjectType.lib,
            root: 'libs/project2',
            tags: [],
            files: ['libs/project2/src/index.ts']
          }
        ],
        ['libs/project2/src/index.ts'],
        packageJson
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
            tags: [],
            files: ['libs/project1/src/index.ts']
          }
        ],
        ['libs/project1/src/index.ts', 'libs/project2/src/index.ts'],
        packageJson
      );

      const errors = c.run();
      expect(errors.length).toEqual(1);
      expect(errors[0].errors[0]).toEqual(
        `The 'libs/project2/src/index.ts' file doesn't belong to any project.`
      );
    });
  });

  describe('package.json is consistent', () => {
    it('should not error when @nrwl/nx and @nrwl/schematics are in sync', () => {
      const c = new WorkspaceIntegrityChecks([], [], packageJson);
      expect(c.run().length).toEqual(0);
    });

    it('should error when @nrwl/nx and @nrwl/schematics are not in sync', () => {
      const c = new WorkspaceIntegrityChecks([], [], {
        dependencies: {
          '@nrwl/nx': '1.2.3'
        },
        devDependencies: {
          '@nrwl/schematics': '4.5.6'
        }
      });
      const errors = c.run();
      expect(errors.length).toEqual(1);
      expect(errors[0].errors[0]).toEqual(
        `The versions of the @nrwl/nx and @nrwl/schematics packages must be the same.`
      );
    });
  });
});
