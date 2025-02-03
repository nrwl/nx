import type { Meta, StoryObj } from '@storybook/react';
import { MigrateUI } from './migrate';
import { userEvent, within } from '@storybook/test';

const meta: Meta<typeof MigrateUI> = {
  component: MigrateUI,
  title: 'MigrateUI',
};
export default meta;
type Story = StoryObj<typeof MigrateUI>;

export const Manual: Story = {
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
        },
        'migration-4': {
          name: 'migration-4',
          type: 'successful',
          changedFiles: [
            { path: 'blub.ts', type: 'CREATE' },
            { path: 'blub2.ts', type: 'UPDATE' },
            { path: 'blub3.ts', type: 'DELETE' },
            { path: 'blub4.ts', type: 'UPDATE' },
            { path: 'blub5.ts', type: 'CREATE' },
          ],
        },
        'migration-3': {
          name: 'migration-3',
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
    onFileClick: (file: any) => {
      console.log(file);
    },
    onViewImplementation: (migration: any) => {
      console.log(migration);
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const manualButton = await canvas.findByText('Switch to manual mode');
    await userEvent.click(manualButton);
  },
};

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
        },
        'migration-2': {
          name: 'migration-2',
          type: 'failed',
          error: 'This is an error',
        },
      },
      targetVersion: '20.3.2',
    },
  },
};
