import type { Meta, StoryObj } from '@storybook/react';
import { TechnologyIcon } from './technology-icon';

const meta: Meta<typeof TechnologyIcon> = {
  component: TechnologyIcon,
  title: 'TechnologyIcon',
};
export default meta;

type Story = StoryObj<typeof TechnologyIcon>;

export const Simple: Story = {
  args: {
    technology: 'react',
  },
};

export const UnknownTechnology: Story = {
  args: {
    technology: 'unknown',
  },
};
