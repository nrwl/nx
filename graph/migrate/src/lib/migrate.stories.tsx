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
        description: 'Migration 1',
        version: '1.0.0',
      },
      {
        description: 'Migration 2',
        version: '1.0.1',
      },
    ],
    onRunMigration: (migration: any) => {
      console.log(migration);
    },
  },
};
