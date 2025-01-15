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
    ],
    nxConsoleMetadata: {
      successfulMigrations: [
        { name: 'migration-1', changes: [] },
        { name: 'migration-4', changes: ['blub.ts'] },
      ],
      failedMigrations: [{ name: 'migration-3', error: 'This is an error' }],
    },
    onRunMigration: (migration: any) => {
      console.log(migration);
    },
  },
};
