/* eslint-disable @nx/enforce-module-boundaries */
// nx-ignore-next-line
import type { MigrationDetailsWithId } from 'nx/src/config/misc-interfaces';
// nx-ignore-next-line
import {
  addFailedMigration,
  addSkippedMigration,
  addSuccessfulMigration,
  MigrationsJsonMetadata,
} from 'nx/src/command-line/migrate/migrate-ui-api';
/* eslint-enable @nx/enforce-module-boundaries */

import { interpret } from 'xstate';
import { automaticMigrationMachine } from './automatic-migration.machine';

const dummyMigrations: MigrationDetailsWithId[] = [
  {
    id: 'migration-1',
    name: 'migration-1',
    description: 'This is a migration that does a thing labeled with one.',
    version: '1.0.0',
    package: 'nx',
  },
  {
    id: 'migration-2',
    name: 'migration-2',
    description:
      'Funnily, this is another migration that does a thing labeled with two.',
    version: '1.0.1',
    package: '@nx/react',
  },
  {
    id: 'migration-3',
    name: 'migration-3',
    description: 'This is a migration that does a thing labeled with three.',
    version: '1.0.1',
    package: '@nx/js',
  },
  {
    id: 'migration-4',
    name: 'migration-4',
    description: 'This is a migration that does a thing labeled with four.',
    version: '1.0.2',
    package: 'nx',
  },
  {
    id: 'migration-3-1',
    name: 'migration-3',
    description: 'This is a migration that does a thing labeled with three.',
    version: '1.0.1',
    package: '@nx/js',
  },
  {
    id: 'migration-6',
    name: 'migration-6',
    description: 'This migration performs updates labeled as number six.',
    version: '1.0.3',
    package: '@nx/workspace',
  },
  {
    id: 'migration-7',
    name: 'migration-7',
    description: 'Lucky number seven migration that updates configurations.',
    version: '1.0.3',
    package: '@nx/devkit',
  },
];

describe('Automatic Migration Machine', () => {
  it('should start in paused state', () => {
    const service = interpret(automaticMigrationMachine);
    service.start();
    expect(service.getSnapshot().value).toBe('paused');
    service.stop();
  });

  it('should keep running migrations until one fails', async () => {
    let metadata: MigrationsJsonMetadata = {
      targetVersion: '20.3.2',
    };
    const service = interpret(
      automaticMigrationMachine.withConfig({
        actions: {
          runMigration: (ctx) => {
            const migration = ctx.currentMigration;
            if (!migration) {
              return;
            }
            console.log('running migration', migration.id);
            if (migration.id !== 'migration-3') {
              metadata = addSuccessfulMigration(migration.id, [])(metadata);
            } else {
              metadata = addFailedMigration(migration.id, 'error')(metadata);
            }
            service.send({
              type: 'updateMetadata',
              metadata,
            });
          },
        },
      })
    );
    service.start();
    service.send({
      type: 'loadInitialData',
      migrations: dummyMigrations,
      metadata: metadata,
    });

    service.send('startRunning');
    expect(service.getSnapshot().value).toBe('needsReview');
    expect(service.getSnapshot().context.currentMigration?.id).toEqual(
      'migration-3'
    );

    service.stop();
  });

  it('should continue running migrations after failed one is skipped', async () => {
    let metadata: MigrationsJsonMetadata = {
      targetVersion: '20.3.2',
    };
    const service = interpret(
      automaticMigrationMachine.withConfig({
        actions: {
          runMigration: (ctx) => {
            const migration = ctx.currentMigration;
            if (!migration) {
              return;
            }
            console.log('running migration', migration.id);
            if (migration.id !== 'migration-3') {
              metadata = addSuccessfulMigration(migration.id, [])(metadata);
            } else {
              metadata = addFailedMigration(migration.id, 'error')(metadata);
            }
            service.send({
              type: 'updateMetadata',
              metadata,
            });
          },
        },
      })
    );
    service.start();
    service.send({
      type: 'loadInitialData',
      migrations: dummyMigrations,
      metadata: metadata,
    });

    service.send('startRunning');
    expect(service.getSnapshot().value).toBe('needsReview');
    expect(service.getSnapshot().context.currentMigration?.id).toEqual(
      'migration-3'
    );

    metadata = addSkippedMigration('migration-3')(metadata);

    service.send({
      type: 'updateMetadata',
      metadata,
    });

    expect(service.getSnapshot().value).toBe('done');
    expect(service.getSnapshot().context.currentMigration?.id).toEqual(
      'migration-7'
    );

    service.stop();
  });

  it('should not continue running migrations after failed one is skipped if state is paused', async () => {
    let metadata: MigrationsJsonMetadata = {
      targetVersion: '20.3.2',
    };
    const service = interpret(
      automaticMigrationMachine.withConfig({
        actions: {
          runMigration: (ctx) => {
            const migration = ctx.currentMigration;
            if (!migration) {
              return;
            }
            console.log('running migration', migration.id);
            if (migration.id !== 'migration-3') {
              metadata = addSuccessfulMigration(migration.id, [])(metadata);
            } else {
              metadata = addFailedMigration(migration.id, 'error')(metadata);
            }
            service.send({
              type: 'updateMetadata',
              metadata,
            });
          },
        },
      })
    );
    service.start();
    service.send({
      type: 'loadInitialData',
      migrations: dummyMigrations,
      metadata: metadata,
    });

    service.send('startRunning');
    expect(service.getSnapshot().value).toBe('needsReview');
    expect(service.getSnapshot().context.currentMigration?.id).toEqual(
      'migration-3'
    );

    service.send('pause');

    metadata = addSkippedMigration('migration-3')(metadata);

    service.send({
      type: 'updateMetadata',
      metadata,
    });

    expect(service.getSnapshot().value).toBe('paused');
    expect(service.getSnapshot().context.currentMigration?.id).toEqual(
      'migration-3'
    );

    service.stop();
  });
});
