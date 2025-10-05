import { interpret } from 'xstate';
import { machine } from './machine';
/* eslint-disable @nx/enforce-module-boundaries */
// nx-ignore-next-line
import type { MigrationDetailsWithId } from 'nx/src/config/misc-interfaces';
// nx-ignore-next-line
import type { MigrationsJsonMetadata } from 'nx/src/command-line/migrate/migrate-ui-api';
/* eslint-enable @nx/enforce-module-boundaries */
const makeMigration = (id: string): MigrationDetailsWithId => ({
  id,
  name: `migration-${id}`,
  version: '1.0.0',
  package: 'test',
  description: 'Test migration for ' + id,
  implementation: './migrations/' + id + '.js',
});

const baseMetadata: MigrationsJsonMetadata = {
  completedMigrations: {},
};

describe('automatic migration state machine', () => {
  it('starts in init', () => {
    const service = interpret(machine).start();
    expect(service.state.value).toBe('init');
  });

  it('transitions to evaluate from startRunning', () => {
    const migration = makeMigration('a');
    const service = interpret(machine).start();

    service.send({
      type: 'loadInitialData',
      migrations: [migration],
      metadata: baseMetadata,
    });

    service.send({ type: 'startRunning' });

    // Should move to evaluate first then end in running
    expect(service.state.value).toBe('running');
  });

  it('enters done if the last migration is reviewed', () => {
    const migration = makeMigration('a');

    const metadata: MigrationsJsonMetadata = {
      completedMigrations: {
        [migration.id]: {
          type: 'successful',
          changedFiles: [],
          name: migration.id,
          ref: 'migration-ref',
        },
      },
    };

    const service = interpret(machine).start();

    service.send({
      type: 'loadInitialData',
      migrations: [migration],
      metadata,
    });

    service.send({ type: 'startRunning' });

    service.send({ type: 'reviewMigration', migrationId: migration.id });

    expect(service.state.value).toBe('done');
  });

  it('enters needsReview if there are file changes', () => {
    const migration = makeMigration('a');

    const metadata: MigrationsJsonMetadata = {
      completedMigrations: {
        [migration.id]: {
          type: 'successful',
          changedFiles: [{ path: 'file.ts', type: 'CREATE' }],
          name: migration.id,
          ref: 'migration-ref',
        },
      },
    };

    const service = interpret(machine).start();

    service.send({
      type: 'loadInitialData',
      migrations: [migration],
      metadata,
    });

    service.send({ type: 'startRunning' });

    expect(service.state.value).toBe('needsReview');
  });

  it('goes to next migration after review', () => {
    const m1 = makeMigration('a');
    const m2 = makeMigration('b');

    const metadata: MigrationsJsonMetadata = {
      completedMigrations: {
        [m1.id]: {
          type: 'successful',
          changedFiles: [],
          name: m1.id,
          ref: 'migration-a',
        },
      },
    };

    const service = interpret(machine).start();

    service.send({
      type: 'loadInitialData',
      migrations: [m1, m2],
      metadata,
    });

    service.send({ type: 'startRunning' });

    service.send({ type: 'reviewMigration', migrationId: m1.id });

    expect(service.state.context.currentMigration?.id).toBe(m2.id);
    expect(service.state.value).toBe('running');
  });

  it('transitions to running state when startRunning is sent', () => {
    const service = interpret(machine).start();
    const migration = makeMigration('a');

    service.send({
      type: 'loadInitialData',
      migrations: [migration],
      metadata: baseMetadata,
    });

    service.send({ type: 'startRunning' });

    expect(service.state.value).toBe('running');
  });

  it('transitions to evaluate when stopped via stop event', () => {
    const migration = makeMigration('a');

    const service = interpret(machine).start();

    service.send({
      type: 'loadInitialData',
      migrations: [migration],
      metadata: baseMetadata,
    });

    service.send({ type: 'startRunning' });

    // Verify we're in running state first
    expect(service.state.value).toBe('running');

    service.send({ type: 'stop' });

    // The stop event transitions out of running, but we need to update metadata
    // to reflect the actual stopped state from the backend
    service.send({
      type: 'updateMetadata',
      metadata: {
        completedMigrations: {
          [migration.id]: {
            type: 'stopped' as const,
            name: migration.id,
            error: 'Manually stopped',
          },
        },
      },
    });

    // After metadata update, should be in stopped state
    expect(service.state.value).toBe('stopped');
  });

  it('transitions to stopped when stopped via metadata update', () => {
    const migration = makeMigration('a');

    const service = interpret(machine).start();

    service.send({
      type: 'loadInitialData',
      migrations: [migration],
      metadata: baseMetadata,
    });

    service.send({ type: 'startRunning' });

    // Verify we're in running state first
    expect(service.state.value).toBe('running');

    // Update metadata to mark migration as stopped
    service.send({
      type: 'updateMetadata',
      metadata: {
        completedMigrations: {
          [migration.id]: {
            type: 'stopped' as const,
            name: migration.id,
            error: 'Manually stopped',
          },
        },
      },
    });

    // After updateMetadata, state should be stopped
    expect(service.state.value).toBe('stopped');
  });

  it('can restart and continue with multiple migrations after stop', () => {
    const m1 = makeMigration('migration-1');
    const m2 = makeMigration('migration-2');
    const m3 = makeMigration('migration-3');

    const service = interpret(machine).start();

    // Load 3 migrations with first one already completed
    const initialMetadata = {
      completedMigrations: {
        [m1.id]: {
          type: 'successful' as const,
          changedFiles: [],
          name: m1.id,
          ref: 'ref-1',
        },
      },
    };

    service.send({
      type: 'loadInitialData',
      migrations: [m1, m2, m3],
      metadata: initialMetadata,
    });

    service.send({ type: 'startRunning' });

    // Should start with migration-2 (since migration-1 is completed)
    expect(service.state.value).toBe('running');
    expect(service.state.context.currentMigration?.id).toBe(m2.id);

    // Stop the migration while running migration-2
    service.send({ type: 'stop' });

    // Update metadata to reflect the migration is stopped (this would come from backend)
    service.send({
      type: 'updateMetadata',
      metadata: {
        completedMigrations: {
          [m1.id]: {
            type: 'successful' as const,
            changedFiles: [],
            name: m1.id,
            ref: 'ref-1',
          },
          [m2.id]: {
            type: 'stopped' as const,
            name: m2.id,
            error: 'Manually stopped',
          },
        },
      },
    });

    // Should be in stopped state
    expect(service.state.value).toBe('stopped');
    expect(service.state.context.currentMigration?.id).toBe(m2.id);

    // Clear the stopped status from metadata (simulating user clearing the stop)
    service.send({
      type: 'updateMetadata',
      metadata: initialMetadata, // Back to just having m1 completed
    });

    // Now restart - should continue with migration-2
    service.send({ type: 'startRunning' });

    // Should resume running migration-2
    expect(service.state.value).toBe('running');
    expect(service.state.context.currentMigration?.id).toBe(m2.id);
  });

  it('skips migrations marked as skipped and moves to next migration', () => {
    const m1 = makeMigration('migration-1');
    const m2 = makeMigration('migration-2');
    const m3 = makeMigration('migration-3');

    const metadata: MigrationsJsonMetadata = {
      completedMigrations: {
        [m2.id]: {
          type: 'skipped',
        },
      },
    };

    const service = interpret(machine).start();

    service.send({
      type: 'loadInitialData',
      migrations: [m1, m2, m3],
      metadata,
    });

    service.send({ type: 'startRunning' });

    // Should start with m1 (first incomplete migration)
    expect(service.state.value).toBe('running');
    expect(service.state.context.currentMigration?.id).toBe(m1.id);

    // Complete m1 successfully without changes
    service.send({
      type: 'updateMetadata',
      metadata: {
        completedMigrations: {
          [m1.id]: {
            type: 'successful',
            changedFiles: [],
            name: m1.id,
            ref: 'ref-1',
          },
          [m2.id]: {
            type: 'skipped',
          },
        },
      },
    });

    // After m1 completes, machine should move to m2. Since m2 is skipped,
    // it should be considered "done" and automatically increment to m3
    expect(service.state.value).toBe('running');
    expect(service.state.context.currentMigration?.id).toBe(m3.id);
  });

  it('does not attempt to run skipped migrations', () => {
    const migration = makeMigration('skipped-migration');

    const metadata: MigrationsJsonMetadata = {
      completedMigrations: {
        [migration.id]: {
          type: 'skipped',
        },
      },
    };

    const service = interpret(machine).start();

    service.send({
      type: 'loadInitialData',
      migrations: [migration],
      metadata,
    });

    service.send({ type: 'startRunning' });

    // Should go to done state since the only migration is skipped
    expect(service.state.value).toBe('done');
    expect(service.state.context.currentMigration?.id).toBe(migration.id);
  });
});
