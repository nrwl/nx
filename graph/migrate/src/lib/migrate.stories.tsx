import type { Meta, StoryObj } from '@storybook/react-webpack5';
import { MigrateUI } from './migrate';

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
