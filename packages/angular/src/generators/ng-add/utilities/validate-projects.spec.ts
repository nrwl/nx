import * as chalk from 'chalk';
import { ProjectMigrator } from './project.migrator';
import { validateProjects } from './validate-projects';

describe('validateProjects', () => {
  it('should not throw if there are not validation errors', () => {
    const migrators: ProjectMigrator[] = [
      { projectName: 'app1', validate: () => null } as ProjectMigrator,
      { projectName: 'lib1', validate: () => null } as ProjectMigrator,
      { projectName: 'lib2', validate: () => null } as ProjectMigrator,
    ];

    expect(() => validateProjects(migrators)).not.toThrow();
  });

  it('should throw with a message using the right format', () => {
    const migrators: ProjectMigrator[] = [
      {
        projectName: 'app1',
        validate: () => [
          {
            message: 'Some error message',
            hint: 'Some hint message',
          },
          {
            messageGroup: {
              title: 'Some title',
              messages: [
                'First error message',
                'Second error message',
                'Third error message',
              ],
            },
            hint: 'Some hint message',
          },
        ],
      } as ProjectMigrator,
      {
        projectName: 'lib1',
        validate: () => [
          {
            messageGroup: {
              title: 'Some group',
              messages: [
                'First error message',
                'Second error message',
                'Third error message',
              ],
            },
          },
          {
            messageGroup: {
              title: 'Another group',
              messages: ['First error message', 'Second error message'],
            },
          },
        ],
      } as ProjectMigrator,
      {
        projectName: 'lib2',
        validate: () => [
          {
            message: 'Some error message',
          },
          {
            message: 'Another error message',
            hint: 'Some hint message',
          },
        ],
      } as ProjectMigrator,
    ];

    expect(() => validateProjects(migrators))
      .toThrowError(`The workspace cannot be migrated because of the following issues:

${chalk.bold(`--------
  app1
--------`)}

  - Some error message
  ${chalk.dim(chalk.italic(`  Some hint message`))}

  - Some title:
    - Errors:
      - First error message
      - Second error message
      - Third error message
  ${chalk.dim(chalk.italic(`  - Some hint message`))}

${chalk.bold(`--------
  lib1
--------`)}

  - Some group:
    - Errors:
      - First error message
      - Second error message
      - Third error message

  - Another group:
    - Errors:
      - First error message
      - Second error message

${chalk.bold(`--------
  lib2
--------`)}

  - Some error message

  - Another error message
  ${chalk.dim(chalk.italic(`  Some hint message`))}`);
  });
});
