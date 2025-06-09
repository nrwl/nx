import type { Meta, StoryObj } from '@storybook/react-webpack5';
import { ShowHideAll } from './show-hide-all';

const meta: Meta<typeof ShowHideAll> = {
  component: ShowHideAll,
  title: 'Project Graph/ShowHideAllProjects',
  argTypes: {
    hideAll: { action: 'hideAllProjects' },
    showAffected: { action: 'showAffectedProjects' },
    showAll: { action: 'showAllProjects' },
  },
};

export default meta;
type Story = StoryObj<typeof ShowHideAll>;

export const Primary: Story = {
  args: {
    hasAffected: false,
  },
};

export const Affected: Story = {
  args: {
    hasAffected: true,
  },
};
