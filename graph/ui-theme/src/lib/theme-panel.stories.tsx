import type { Meta, StoryObj } from '@storybook/react';
import { ThemePanel } from './theme-panel';

const meta: Meta<typeof ThemePanel> = {
  component: ThemePanel,
  decorators: [
    (Story) => (
      <div className="block h-auto w-auto border-2 bg-white px-8 py-4 dark:bg-slate-800">
        <div className="flex justify-end">
          <Story className="justify-items-end" />
        </div>
      </div>
    ),
  ],
  title: 'ThemePanel',
};

export default meta;
type Story = StoryObj<typeof ThemePanel>;

export const Primary: Story = {
  args: {},
};
