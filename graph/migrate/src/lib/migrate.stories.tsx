import type { Meta, StoryObj } from '@storybook/react-webpack5';
// nx-ignore-next-line
import type { MigrationDetailsWithId } from 'nx/src/config/misc-interfaces';
import { useState } from 'react';
import { MigrateUI } from './migrate';
import {
  isPromptOnlyShape,
  type MigrationsJsonMetadata,
} from './migration-shape';

const meta: Meta<typeof MigrateUI> = {
  component: MigrateUI,
  title: 'MigrateUI',
};
export default meta;
type Story = StoryObj<typeof MigrateUI>;

export const Automatic: Story = {
  args: {
    migrations: [
      {
        id: 'migration-1',
        name: 'migration-1',
        description: 'This is a migration that does a thing labeled with one.',
        version: '1.0.0',
        package: 'nx',
        implementation: './src/migrations/migration-1.ts',
      },
      {
        id: 'migration-2',
        name: 'migration-2',
        description:
          'Funnily, this is another migration that does a thing labeled with two.',
        version: '1.0.1',
        package: '@nx/react',
        implementation: './src/migrations/migration-2.ts',
      },
      {
        id: 'migration-3',
        name: 'migration-3',
        description:
          'This is a migration that does a thing labeled with three.',
        version: '1.0.1',
        package: '@nx/js',
        implementation: './src/migrations/migration-3.ts',
      },
      {
        id: 'migration-4',
        name: 'migration-4',
        description: 'This is a migration that does a thing labeled with four.',
        version: '1.0.2',
        package: 'nx',
        implementation: './src/migrations/migration-4.ts',
      },
      {
        id: 'migration-3-1',
        name: 'migration-3',
        description:
          'This is a migration that does a thing labeled with three.',
        version: '1.0.1',
        package: '@nx/js',
        implementation: './src/migrations/migration-3.ts',
      },
      {
        id: 'migration-6',
        name: 'migration-6',
        description: 'This migration performs updates labeled as number six.',
        version: '1.0.3',
        package: '@nx/workspace',
        implementation: './src/migrations/migration-6.ts',
      },
      {
        id: 'migration-7',
        name: 'migration-7',
        description:
          'Lucky number seven migration that updates configurations.',
        version: '1.0.3',
        package: '@nx/devkit',
        implementation: './src/migrations/migration-7.ts',
      },
    ],
    nxConsoleMetadata: {
      completedMigrations: {
        'migration-1': {
          name: 'migration-1',
          type: 'successful',
          changedFiles: [],
          ref: '123',
        },
        'migration-2': {
          type: 'skipped',
        },
        'migration-3': {
          name: 'migration-3',
          type: 'failed',
          error: 'This is an error',
        },
      },
      targetVersion: '20.3.2',
    },
    onFinish: (squash: boolean) => {
      console.log('finished', squash);
    },
  },
};

export const AllCompleted: Story = {
  args: {
    migrations: [
      {
        id: 'migration-1',
        name: 'migration-1',
        description: 'This is a migration that does a thing labeled with one.',
        version: '1.0.0',
        package: 'nx',
        implementation: './src/migrations/migration-1.ts',
      },
      {
        id: 'migration-2',
        name: 'migration-2',
        description:
          'Funnily, this is another migration that does a thing labeled with two.',
        version: '1.0.1',
        package: '@nx/react',
        implementation: './src/migrations/migration-2.ts',
      },
      {
        id: 'migration-3',
        name: 'migration-3',
        description:
          'This is a migration that does a thing labeled with three.',
        version: '1.0.1',
        package: '@nx/js',
        implementation: './src/migrations/migration-3.ts',
      },
      {
        id: 'migration-4',
        name: 'migration-4',
        description: 'This is a migration that does a thing labeled with four.',
        version: '1.0.2',
        package: 'nx',
        implementation: './src/migrations/migration-4.ts',
      },
      {
        id: 'migration-3-1',
        name: 'migration-3',
        description:
          'This is a migration that does a thing labeled with three.',
        version: '1.0.1',
        package: '@nx/js',
        implementation: './src/migrations/migration-3.ts',
      },
      {
        id: 'migration-6',
        name: 'migration-6',
        description: 'This migration performs updates labeled as number six.',
        version: '1.0.3',
        package: '@nx/workspace',
        implementation: './src/migrations/migration-6.ts',
      },
      {
        id: 'migration-7',
        name: 'migration-7',
        description:
          'Lucky number seven migration that updates configurations.',
        version: '1.0.3',
        package: '@nx/devkit',
        implementation: './src/migrations/migration-7.ts',
      },
    ],
    nxConsoleMetadata: {
      completedMigrations: {
        'migration-1': {
          name: 'migration-1',
          type: 'successful',
          changedFiles: [],
          ref: '123',
        },
        'migration-2': {
          name: 'migration-2',
          type: 'successful',
          changedFiles: [],
          ref: '124',
        },
        'migration-3': {
          name: 'migration-3',
          type: 'successful',
          changedFiles: [],
          ref: '125',
        },
        'migration-4': {
          name: 'migration-4',
          type: 'successful',
          changedFiles: [],
          ref: '126',
        },
        'migration-3-1': {
          name: 'migration-3',
          type: 'successful',
          changedFiles: [],
          ref: '127',
        },
        'migration-6': {
          name: 'migration-6',
          type: 'successful',
          changedFiles: [],
          ref: '128',
        },
        'migration-7': {
          name: 'migration-7',
          type: 'successful',
          changedFiles: [],
          ref: '129',
        },
      },
      targetVersion: '20.3.2',
    },
    onRunMigration: (migration) => {
      console.log('run migration', migration);
    },
    onRunMany: (migrations, configuration) => {
      console.log('run many migrations', migrations, configuration);
    },
    onSkipMigration: (migration) => {
      console.log('skip migration', migration);
    },
    onFileClick: (migration, file) => {
      console.log('file click', migration, file);
    },
    onViewImplementation: (migration) => {
      console.log('view implementation', migration);
    },
    onViewDocumentation: (migration) => {
      console.log('view documentation', migration);
    },
    onCancel: () => {
      console.log('cancel');
    },
    onFinish: (squash: boolean) => {
      console.log('finished', squash);
    },
  },
};

export const PendingApproval: Story = {
  args: {
    currentMigrationId: 'migration-2',
    migrations: [
      {
        id: 'migration-1',
        name: 'migration-1',
        description: 'This is a test migration',
        version: '1.0.0',
        package: 'nx',
        implementation: './src/migrations/migration-1.ts',
      },
      {
        id: 'migration-2',
        name: 'migration-2',
        description: 'This is a test migration',
        version: '1.0.1',
        package: '@nx/react',
        implementation: './src/migrations/migration-2.ts',
      },
      {
        id: 'migration-3',
        name: 'migration-3',
        description: 'Migrate 3',
        version: '1.0.1',
        package: '@nx/react',
        implementation: './src/migrations/migration-3.ts',
      },
    ],
    nxConsoleMetadata: {
      completedMigrations: {
        'migration-1': {
          name: 'migration-1',
          type: 'successful',
          changedFiles: [],
          ref: '123',
          nextSteps: [],
        },
        'migration-2': {
          name: 'migration-2',
          type: 'successful',
          changedFiles: [{ path: 'foo.txt', type: 'CREATE' }],
          ref: '124',
          nextSteps: [
            'Check something: https://nx.dev/docs',
            'Check another thing: https://nx.dev/docs',
          ],
        },
      },
      targetVersion: '20.3.2',
    },
    onRunMigration: (migration) => {
      console.log('run migration', migration);
    },
    onRunMany: (migrations, configuration) => {
      console.log('run many migrations', migrations, configuration);
    },
    onSkipMigration: (migration) => {
      console.log('skip migration', migration);
    },
    onUndoMigration: (migration) => {
      console.log('undo migration', migration);
    },
    onFileClick: (migration, file) => {
      console.log('file click', migration, file);
    },
    onViewImplementation: (migration) => {
      console.log('view implementation', migration);
    },
    onViewDocumentation: (migration) => {
      console.log('view documentation', migration);
    },
    onCancel: () => {
      console.log('cancel');
    },
    onFinish: (squash: boolean) => {
      console.log('finished', squash);
    },
  },
};

export const PromptBearing: Story = {
  args: {
    // Ordering reflects the realistic flow: past migrations have already been
    // processed (auto-run or approved), the current one is paused on review,
    // and future ones are still waiting to be auto-run.
    currentMigrationId: 'hybrid-pending-ack',
    migrations: [
      {
        id: 'hybrid-completed',
        name: 'update-imports',
        description:
          'Updates legacy imports, then prompts for manual import cleanup.',
        version: '19.0.0',
        package: '@nx/react',
        implementation: './src/migrations/update-imports.ts',
        prompt: 'tools/ai-migrations/@nx/react/19.0.0/import-cleanup.md',
      },
      {
        id: 'prompt-only-completed',
        name: 'adopt-new-router',
        description: 'Adopt the new router API across the workspace.',
        version: '19.0.0',
        package: '@nx/react',
        prompt: 'tools/ai-migrations/@nx/react/19.0.0/new-router.md',
      },
      {
        id: 'hybrid-pending-ack',
        name: 'update-jsx-runtime',
        description:
          'Updates JSX runtime config, then prompts for manual JSX refactor.',
        version: '19.0.0',
        package: '@nx/react',
        implementation: './src/migrations/update-jsx-runtime.ts',
        prompt: 'tools/ai-migrations/@nx/react/19.0.0/jsx-refactor.md',
      },
      {
        id: 'prompt-only-pending',
        name: 'migrate-class-components-to-hooks',
        description:
          'Convert class components to functional components using hooks.',
        version: '19.0.0',
        package: '@nx/react',
        prompt: 'tools/ai-migrations/@nx/react/19.0.0/class-to-hooks.md',
      },
    ],
    nxConsoleMetadata: {
      completedMigrations: {
        'hybrid-pending-ack': {
          name: 'update-jsx-runtime',
          type: 'successful',
          changedFiles: [{ path: 'tsconfig.json', type: 'UPDATE' }],
          ref: 'abc',
          nextSteps: [
            'Run the AI prompt at tools/ai-migrations/@nx/react/19.0.0/jsx-refactor.md to complete this migration.',
          ],
        },
        'hybrid-completed': {
          name: 'update-imports',
          type: 'successful',
          changedFiles: [{ path: 'src/app.tsx', type: 'UPDATE' }],
          ref: 'def',
          nextSteps: [
            'Run the AI prompt at tools/ai-migrations/@nx/react/19.0.0/import-cleanup.md to complete this migration.',
          ],
          acknowledgedPrompt: true,
        },
        'prompt-only-completed': {
          name: 'adopt-new-router',
          type: 'successful',
          changedFiles: [],
          ref: 'ghi',
          nextSteps: [
            'Run the AI prompt at tools/ai-migrations/@nx/react/19.0.0/new-router.md to complete this migration.',
          ],
        },
      },
      targetVersion: '19.0.0',
    },
  },
  // Storybook has no backend, so `onAcknowledgePrompt` mirrors what
  // `acknowledgeMigrationPrompt` does server-side — records success for
  // prompt-only, sets the ack flag for hybrid — so the full lifecycle is
  // visible end-to-end. The state machine never auto-runs anything in this
  // all-prompt-bearing story, so `onRunMigration` stays a logger.
  render: function PromptBearingStory(args) {
    const [metadata, setMetadata] = useState<MigrationsJsonMetadata>(
      args.nxConsoleMetadata
    );

    const onAcknowledgePrompt = (migration: MigrationDetailsWithId) => {
      setMetadata((prev) => {
        if (isPromptOnlyShape(migration)) {
          return {
            ...prev,
            completedMigrations: {
              ...prev.completedMigrations,
              [migration.id]: {
                type: 'successful',
                name: migration.id,
                changedFiles: [],
                ref: 'simulated',
                nextSteps: [
                  `Run the AI prompt at ${migration.prompt} to complete this migration.`,
                ],
              },
            },
          };
        }
        const existing = prev.completedMigrations?.[migration.id];
        if (existing?.type !== 'successful') return prev;
        return {
          ...prev,
          completedMigrations: {
            ...prev.completedMigrations,
            [migration.id]: { ...existing, acknowledgedPrompt: true },
          },
        };
      });
    };

    return (
      <MigrateUI
        {...args}
        nxConsoleMetadata={metadata}
        onAcknowledgePrompt={onAcknowledgePrompt}
        onRunMigration={(migration, configuration) =>
          console.log('run migration', migration, configuration)
        }
        onRunMany={(migrations, configuration) =>
          console.log('run many migrations', migrations, configuration)
        }
        onSkipMigration={(migration) =>
          console.log('skip migration', migration)
        }
        onUndoMigration={(migration) =>
          console.log('undo migration', migration)
        }
        onFileClick={(migration, file) =>
          console.log('file click', migration, file)
        }
        onViewImplementation={(migration) =>
          console.log('view implementation', migration)
        }
        onViewDocumentation={(migration) =>
          console.log('view documentation', migration)
        }
        onCancel={() => console.log('cancel')}
        onFinish={(squash) => console.log('finished', squash)}
        onStopMigration={(migration) =>
          console.log('stop migration', migration)
        }
      />
    );
  },
};

export const MigrationStopped: Story = {
  args: {
    currentMigrationId: 'migration-2',
    migrations: [
      {
        id: 'migration-1',
        name: 'migration-1',
        description: 'This is a test migration',
        version: '1.0.0',
        package: 'nx',
        implementation: './src/migrations/migration-1.ts',
      },
      {
        id: 'migration-2',
        name: 'migration-2',
        description: 'This is a test migration',
        version: '1.0.1',
        package: '@nx/react',
        implementation: './src/migrations/migration-2.ts',
      },
      {
        id: 'migration-3',
        name: 'migration-3',
        description: 'Migrate 3',
        version: '1.0.1',
        package: '@nx/react',
        implementation: './src/migrations/migration-3.ts',
      },
    ],
    nxConsoleMetadata: {
      completedMigrations: {
        'migration-1': {
          name: 'migration-1',
          type: 'successful',
          changedFiles: [],
          ref: '123',
          nextSteps: [],
        },
        'migration-2': {
          name: 'migration-2',
          type: 'stopped',
          error: 'Migration was stopped by the user',
        },
      },
      targetVersion: '20.3.2',
    },
    onRunMigration: (migration) => {
      console.log('run migration', migration);
    },
    onRunMany: (migrations, configuration) => {
      console.log('run many migrations', migrations, configuration);
    },
    onSkipMigration: (migration) => {
      console.log('skip migration', migration);
    },
    onUndoMigration: (migration) => {
      console.log('undo migration', migration);
    },
    onFileClick: (migration, file) => {
      console.log('file click', migration, file);
    },
    onViewImplementation: (migration) => {
      console.log('view implementation', migration);
    },
    onViewDocumentation: (migration) => {
      console.log('view documentation', migration);
    },
    onCancel: () => {
      console.log('cancel');
    },
    onFinish: (squash: boolean) => {
      console.log('finished', squash);
    },
    onStopMigration: (migration) => {
      console.log('stop migration', migration);
    },
  },
};
