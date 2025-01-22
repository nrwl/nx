import type { Meta, StoryObj } from '@storybook/react';
import { MigrateUI } from './migrate';

const meta: Meta<typeof MigrateUI> = {
  component: MigrateUI,
  title: 'MigrateUI',
};
export default meta;
type Story = StoryObj<typeof MigrateUI>;

export const Primary = {
  args: {
    migrations: [
      {
        name: 'migration-1',
        description: 'This is a migration that does a thing labeled with one.',
        version: '1.0.0',
        package: 'nx',
      },
      {
        name: 'migration-2',
        description:
          'Funnily, this is another migration that does a thing labeled with two.',
        version: '1.0.1',
        package: '@nx/react',
      },
      {
        name: 'migration-3',
        description:
          'This is a migration that does a thing labeled with three.',
        version: '1.0.1',
        package: '@nx/js',
      },
      {
        name: 'migration-4',
        description: 'This is a migration that does a thing labeled with four.',
        version: '1.0.2',
        package: 'nx',
      },
      {
        name: 'migration-5',
        description: 'This is a migration that does a thing labeled with five.',
        version: '1.0.2',
        package: '@nx/angular',
      },
      {
        name: 'migration-6',
        description: 'This migration performs updates labeled as number six.',
        version: '1.0.3',
        package: '@nx/workspace',
      },
      {
        name: 'migration-7',
        description:
          'Lucky number seven migration that updates configurations.',
        version: '1.0.3',
        package: '@nx/devkit',
      },
    ],
    nxConsoleMetadata: {
      completedMigrations: {
        'migration-1': {
          type: 'successful',
          changedFiles: [],
        },
        'migration-4': {
          type: 'successful',
          changedFiles: ['blub.ts'],
        },
        'migration-3': {
          type: 'failed',
          error: 'This is an error',
        },
      },
      runningMigrations: ['migration-2'],
      targetVersion: '20.3.2',
    },
    onRunMigration: (
      migration: any,
      configuration: { createCommits: boolean }
    ) => {
      console.log(migration, configuration);
    },
    onRunMany: (
      migrations: any[],
      configuration: { createCommits: boolean }
    ) => {
      console.log(migrations, configuration);
    },
  },
};
