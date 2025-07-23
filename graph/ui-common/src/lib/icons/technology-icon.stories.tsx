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

export const SimpleLarge: Story = {
  args: {
    technology: 'react',
    className: 'h-8 w-8',
  },
};

export const Monochromatic: Story = {
  args: {
    technology: 'react',
    monochromatic: true,
  },
};

export const MonochromaticLarge: Story = {
  args: {
    technology: 'react',
    monochromatic: true,
    className: 'h-8 w-8',
  },
};

export const UnknownTechnology: Story = {
  args: {
    technology: 'unknown',
  },
};

export const UnknownTechnologyLarge: Story = {
  args: {
    technology: 'unknown',
    className: 'h-8 w-8',
  },
};

export const MonochromaticUnknownTechnology: Story = {
  args: {
    technology: 'unknown',
    monochromatic: true,
  },
};
