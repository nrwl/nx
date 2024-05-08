import type { Meta, StoryObj } from '@storybook/react';
import { TargetTechnologies } from './target-technologies';

const meta: Meta<typeof TargetTechnologies> = {
  component: TargetTechnologies,
  title: 'TargetTechnologies',
};
export default meta;

type Story = StoryObj<typeof TargetTechnologies>;

export const Simple: Story = {
  args: {
    technologies: ['react', 'angular'],
  },
};
